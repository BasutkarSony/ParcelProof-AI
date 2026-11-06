# QA Status — 6 November 2026

## Current verified build

Repository: [BasutkarSony/ParcelProof-AI](https://github.com/BasutkarSony/ParcelProof-AI), branch `main`

Latest green workflow: [GitHub Actions run 42236129396](https://github.com/BasutkarSony/ParcelProof-AI/actions/runs/42236129396), commit `c4d244508e5ce97ddcfdef43a6659486be410111`.

| Check | Result |
|---|---|
| Backend unit suite | **232 passed; 3 PostgreSQL-only tests skipped in this job** |
| PostgreSQL persistence integration | **3 passed** against temporary PostgreSQL 17 |
| Frontend tests | **Passed** |
| Oxlint | **Passed** |
| Vite production build | **Passed** |
| Docker image build | **Passed** |

The PostgreSQL tests exercise checkout-to-shipment/manifest/inspection/review persistence, duplicate shipment retry handling and concurrent manifest finalization. These are automated repository tests, not a substitute for live AI, carrier or PayPal tracking verification.

## Hosted Render service

- Service: [parcelproof-ai-058h](https://dashboard.render.com/web/srv-dbmpto5g1s2s73bjbtgg)
- Hosted URL: https://parcelproof-ai-058h.onrender.com
- Plan: Free web service, Docker runtime, Singapore region.
- Current deployed commit: `c4d244508e5ce97ddcfdef43a6659486be410111`.
- Current deployment: `dep-dbmuecgn74is73bhdn50`, status **LIVE**.
- Render application logs show repeated `GET /health` responses with HTTP 200 after that deployment.
- Render is configured to deploy `main` after repository checks pass.

The hosted PayPal checkout created records that were independently queried in the connected Supabase database. This verifies the deployed service's PostgreSQL persistence path for that checkout and its shipment/manifest records. It does not verify every upload, restart or recovery path.

## Supabase live data snapshot

Project: `ParcelProof`, region Seoul, PostgreSQL 17, status `ACTIVE_HEALTHY`.

Latest direct row-count query:

| Table | Rows |
|---|---:|
| orders | 1 |
| shipments | 1 |
| shipment_manifests | 1 |
| packing_inspections | 0 |
| inspection_photos | 0 |
| inspection_reviews | 0 |

The single hosted Sandbox order is recorded as PAID, has one linked shipment, and has a finalized manifest derived from its purchased item lines. The manifest fingerprint is stored. The shipment remains on hold; no human packing-review decision exists yet.

Previously inspected security setup:
- Nine ParcelProof application tables exist and have RLS enabled.
- Direct `anon` and `authenticated` browser-role access is denied.
- The `inspection-photos` bucket is private, with a 10 MB size limit and JPEG, PNG and WebP restrictions.
- The backend uses a trusted server-side database connection; service credentials are not intended for browser use.

The database snapshot above has no inspection/photo/review rows. Therefore the private photo upload-and-retrieval workflow has **not yet passed a live hosted end-to-end test**.

## PayPal verification

Verified by the hosted Sandbox run:
- PayPal OAuth indicator returned `OAuth 2.0 Authenticated`.
- The tracking write gate showed `Locked`.
- One buyer-approved Sandbox checkout was captured and recorded as PAID.
- The order amount, currency, item line and capture linkage were checked in Supabase.
- The shipment and order-derived manifest were persisted.

Not verified:
- A real PayPal tracking write. The write gate remains `PAYPAL_TRACKING_SUBMISSION_ENABLED=false`.
- Production PayPal payments or production tracking.
- Any claim that the app determines Seller Protection eligibility.

## AI packing inspection and evidence retention

Google's model catalog lists `gemini-3.8-flash` as a valid model ID. The earlier hosted inspection attempt returned transient HTTP 503/429 provider errors. A successful live Gemini image inspection has not been recorded.

Implemented and CI-tested:
- Gemini is attempted first with one bounded retry.
- OpenAI Vision is an optional fallback, but `OPENAI_API_KEY` is not configured in the current service.
- Provider failure creates a non-approvable `AI_FAILED` inspection record when the database write succeeds.
- Uploaded photo objects and their hashes are retained on an AI provider failure instead of being deleted.
- A failed AI inspection cannot receive human approval or satisfy the latest-approved-inspection tracking gate.
- The frontend handles empty and non-JSON error responses without throwing a secondary JSON parsing exception.

Still not verified against the live hosted environment:
- A fresh image upload to the private Supabase bucket.
- A successful Gemini response with a real packing photo.
- Fetching the saved photo again after page reload/redeploy.
- A live `AI_FAILED` row and retained Storage object from a real hosted provider outage.
- A live human-review decision and subsequent retrieval.

## Shipment-record checks and PayPal policy wording

The deterministic analyzer was changed from a Seller Protection “eligibility/readiness” score to neutral shipment-record completeness checks. It no longer infers eligibility or applies the previous hard-coded USD 750 signature rule. The UI now distinguishes merchant-entered shipment fields and notes from carrier-verified events.

The prototype does not currently connect to carrier event feeds. A tracking number typed by a merchant, a “delivered” status entered by a merchant, or a text match against an address is not independent proof of shipment or delivery. PayPal determines Seller Protection eligibility under the rules applicable to the seller, transaction and claim.

## Known product and hosted-demo gaps

1. Complete a real hosted packing-photo upload and Gemini inspection using photos of the actual item being packed.
2. Verify AI_FAILED evidence retention on the hosted Supabase Storage path when a provider error occurs.
3. Complete the human-review flow in the hosted app and verify the decision is persisted separately from AI output.
4. Add a genuine carrier tracking/event integration and preserve event source, timestamp and verification status. Do not represent manually entered events as carrier verified.
5. Test PayPal tracking only in Sandbox after explicitly agreeing a test order, capture, carrier and tracking number. Keep the write gate off for ordinary demo use.
6. Complete judge login validation, evidence reload after restart, the short demo recording and the Devpost submission/access fields.

## Release decision

**Not release-ready yet.** The latest code is green in CI and live on Render. A real PayPal Sandbox checkout and finalized manifest are verified. The most important remaining hosted proof is a successful or recoverably failed packing-photo inspection with durable evidence, followed by a real human-review decision. Carrier event tracking, tracking-write verification, video and Devpost submission also remain open.
