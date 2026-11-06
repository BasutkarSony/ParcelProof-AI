# QA Status — 6 November 2026

## Latest repository verification

GitHub Actions run [42193452445](https://github.com/BasutkarSony/ParcelProof-AI/actions/runs/42193452445) completed successfully on `main` on 6 November 2026.

| Check | Result |
|---|---|
| Backend unit suite | **237 tests, passed** (1 PostgreSQL-only test is skipped in this SQLite job and run separately) |
| PostgreSQL integration | **Passed** against a temporary PostgreSQL 17 service |
| Frontend tests | **Passed** |
| Oxlint | **Passed** |
| Vite production build | **Passed** |
| Docker image build | **Passed** |

The PostgreSQL integration test exercised the persistence sequence: create an order, attach a completed PayPal capture, create one shipment, derive and finalize its manifest, persist inspection photo metadata and record a human review. It also checks shipment retry idempotency and item/photo ordering. The Docker image includes the checked-in SQL migrations.

These are repository-level tests. They do not establish that live external services or the hosted judge environment have passed end-to-end verification.

## Supabase project inspection

The connected Supabase project was inspected directly.

- The four checked-in SQL migrations have been applied.
- All nine ParcelProof application tables exist.
- The three demo catalogue products are present; the other application tables contain no order/evidence records from a real app session.
- All nine application tables have Row Level Security enabled.
- No browser-role policies were created. Direct `anon` and `authenticated` reads are denied; the backend is intended to use its trusted PostgreSQL connection.
- The automatic RLS event trigger remains installed. Direct function execution for `public.rls_auto_enable()` is revoked from `PUBLIC`, `anon` and `authenticated`.
- The `inspection-photos` bucket is private, has a 10 MB object limit and allows JPEG, PNG and WebP. It currently contains zero objects.

The live Supabase schema and its security settings are verified. The ParcelProof application has **not yet been connected to it from a deployed Render service**.

## Persistence implementation

- Local development continues to use SQLite by default.
- When `DATABASE_URL` is set, the backend uses the psycopg 3 PostgreSQL adapter and applies checked-in SQL migrations.
- PostgreSQL queries preserve checkout-item, manifest-item, photo and review ordering.
- Review and checkout-manifest creation use PostgreSQL row locks where serialization is required.
- The Render Blueprint is configured for the Free web-service plan with no disk. It requires `DATABASE_URL` and fails closed rather than silently using an ephemeral SQLite file.
- Inspection photos use the private Supabase Storage adapter when configured.

## Not yet verified in the live hosted environment

- Render deployment and HTTPS health check.
- Render's actual `DATABASE_URL` connection to the Supabase Session Pooler.
- An actual photo upload, AI read, retrieval and cleanup against the private Supabase bucket using the hosted credentials.
- Successful PayPal Sandbox buyer approval, capture and return flow.
- A real Gemini Vision inspection with the configured API key.
- Database and photo retrieval after a hosted restart/redeploy.
- Judge login, wrong-password rejection and full end-to-end demo.
- PayPal tracking writes remain disabled by default and have not been tested.

## Free-tier operational limits

Render Free web services spin down after 15 minutes without inbound traffic and can take about a minute to start again. Their filesystems are ephemeral, which is why the deployment uses Supabase for durable data. Supabase Free projects can pause after a week of very low database activity. These limits are acceptable for a hackathon demo but are not a production availability guarantee.

## Release decision

**Not release-ready yet.** The local/CI SQLite and PostgreSQL code paths are tested, and the Supabase schema has been prepared. The hosted app still needs private environment variables, deployment and live PayPal/AI/storage verification. Track the remaining checks in [RELEASE-GATE.md](RELEASE-GATE.md).
