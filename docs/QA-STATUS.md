# QA Status — 6 November 2026

## Latest repository verification

GitHub Actions run [42194859971](https://github.com/BasutkarSony/ParcelProof-AI/actions/runs/42194859971) completed successfully on `main` on 6 November 2026.

| Check | Result |
|---|---|
| Backend unit suite | **239 tests discovered: 236 passed, 3 PostgreSQL-only tests skipped** in this SQLite job; all 3 skipped tests run separately and pass in the PostgreSQL job |
| PostgreSQL integration | **3 tests passed** against a temporary PostgreSQL 17 service |
| Frontend tests | **Passed** |
| Oxlint | **Passed** |
| Vite production build | **Passed** |
| Docker image build | **Passed** |

The PostgreSQL integration tests cover:
- Full persistence sequence: checkout order, paid PayPal capture record, shipment, order-derived/finalized manifest, photo metadata and human review.
- Two simultaneous retries for one paid order return one shipment record.
- Two simultaneous manifest finalization requests produce one successful finalization and one rejection.

The Docker image includes the checked-in SQL migrations. These are repository-level tests; they do not establish that live external services or the hosted judge environment have passed end-to-end verification.

## Supabase project inspection

The connected Supabase project was inspected directly.

- Five migrations are recorded: initial schema, photo storage reference, private application RLS, RLS helper-function hardening and explicit row ordering.
- All nine ParcelProof application tables exist.
- The three demo catalogue products are present. The orders, order items, manifests, inspections, reviews, photos and shipments tables currently contain no app records.
- Explicit ordering columns exist on `order_items`, `manifest_items`, `inspection_reviews` and `inspection_photos`.
- All nine application tables have Row Level Security enabled.
- No browser-role policies were created. Direct `anon` and `authenticated` access is denied; the backend uses its trusted PostgreSQL connection.
- The automatic RLS event trigger remains installed. Direct function execution for `public.rls_auto_enable()` is revoked from `PUBLIC`, `anon` and `authenticated`.
- The `inspection-photos` bucket is private, has a 10 MB object limit and allows JPEG, PNG and WebP. It currently contains zero objects.

Supabase schema, ordering columns and security settings are verified. The ParcelProof app has **not yet been connected to this database from a deployed Render service**.

## Persistence implementation

- Local development continues to use SQLite by default.
- When `DATABASE_URL` is set, the backend uses the psycopg 3 PostgreSQL adapter and applies checked-in SQL migrations.
- PostgreSQL queries preserve checkout-item, manifest-item, photo and review ordering.
- Shipment creation, manifest edit/finalization and human review use PostgreSQL row locks where serialization is required.
- Duplicate shipment retries recover safely after unique conflicts.
- The Render Blueprint is configured for the Free web-service plan with no disk. It requires `DATABASE_URL` and fails closed rather than silently using ephemeral SQLite.
- The Docker runtime image includes the migration files.
- Inspection photos use the private Supabase Storage adapter when configured. The adapter distinguishes the new `sb_secret_*` API key from the legacy service-role JWT required for the Storage Bearer header.

## Not yet verified in the live hosted environment

- Render deployment and HTTPS health check.
- Render's actual `DATABASE_URL` connection to the Supabase Session Pooler.
- Actual hosted photo upload, AI read, retrieval and cleanup against the private Supabase bucket.
- Successful PayPal Sandbox buyer approval, capture and return flow.
- A real Gemini Vision inspection with the configured API key.
- Database and photo retrieval after a hosted restart/redeploy.
- Judge login, wrong-password rejection and full end-to-end demo.
- PayPal tracking writes remain disabled by default and have not been tested.

## Free-tier operational limits

Render Free web services spin down after 15 minutes without inbound traffic and can take about a minute to start again. Their filesystems are ephemeral, which is why the deployment uses Supabase for durable data. Supabase Free projects can pause after a week of very low database activity. These limits are suitable for a hackathon demo but are not a production availability guarantee.

## Release decision

**Not release-ready yet.** The SQLite and PostgreSQL code paths are tested, and the Supabase schema and security setup have been prepared. The hosted app still needs private environment variables, deployment and live PayPal/AI/storage verification. Track the remaining checks in [RELEASE-GATE.md](RELEASE-GATE.md).
