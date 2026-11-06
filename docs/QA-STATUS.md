# QA Status — 6 November 2026

## Canonical project and repository

The active PayPal AI Hackathon project is **ParcelProof AI**:

- Repository: https://github.com/BasutkarSony/ParcelProof-AI
- Branch: `main`
- GitHub license detection: MIT
- Current repository creation date: 4 November 2026.
- Hosted demo: https://parcelproof-ai-058h.onrender.com

The older public [ShipProof-AI repository](https://github.com/BasutkarSony/ShipProof-AI) is a historical snapshot created on 30 October 2026. The live Render service and current CI are connected to **ParcelProof-AI**. Use ParcelProof-AI as the repository link in the Devpost submission. The old repository remains public and was not modified by this workflow.

Both repository creation dates fall after the Hackathon Submission Period began on 1 October 2026, based on the official rules supplied for this project.

## Latest verified build

Latest green workflow: [GitHub Actions run 42241783179](https://github.com/BasutkarSony/ParcelProof-AI/actions/runs/42241783179)

Commit: `635282cde69cebcc929f72390ed970e005d80ea9`

| Check | Result |
|---|---|
| Backend unit suite | **238 tests discovered; 235 passed and 3 PostgreSQL-only tests skipped in this job** |
| PostgreSQL persistence integration | **3 passed** against temporary PostgreSQL 17 |
| Frontend tests | **Passed** |
| Oxlint | **Passed** |
| Vite production build | **Passed** |
| Docker image build | **Passed** |

The three PostgreSQL-only tests are run separately in the PostgreSQL integration job. The test suite covers checkout-to-shipment/manifest/inspection/review persistence, duplicate shipment retry handling, concurrent manifest finalization, photo preservation after AI failure, and Gemini rate/quota error handling.

These are automated repository tests. They do not replace live testing of Google AI, Supabase Storage, carrier events or PayPal tracking writes.

## Hosted Render service

- Service: [parcelproof-ai-058h](https://dashboard.render.com/web/srv-dbmpto5g1s2s73bjbtgg)
- URL: https://parcelproof-ai-058h.onrender.com
- Plan: Free web service, Docker runtime, Singapore region.
- Current deployed commit: `635282cde69cebcc929f72390ed970e005d80ea9`.
- Current deployment: `dep-dbmuvpmc6qcc73bk795g`, status **LIVE**.
- Render application logs show `GET /health` HTTP 200 after this deployment.
- The public app root returned HTTP 401, which is expected because the demo is protected by shared HTTP Basic Authentication.
- Render deploys from `main` after repository checks pass.

The latest deployment is on the same existing Render service; no new hosting service or repository was created.

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

The hosted PayPal Sandbox checkout created one paid order, one linked shipment and one finalized manifest derived from the purchased item lines. The manifest fingerprint is stored. The shipment remains on hold because no packing inspection or human decision has been completed.

Previously inspected security and storage setup:
- All nine ParcelProof application tables exist and have RLS enabled.
- Direct `anon` and `authenticated` browser-role access is denied.
- The `inspection-photos` bucket is private, with a 10 MB limit and JPEG, PNG and WebP restrictions.
- Backend database and storage credentials are not intended for browser use.

The database snapshot above has zero inspection/photo/review rows. Therefore the hosted photo upload, AI inspection and human-review workflow has **not yet passed a real hosted end-to-end test**.

## PayPal Sandbox verification

Verified through the hosted app:
- PayPal OAuth authentication succeeded and the tracking write gate showed **Locked**.
- A buyer-approved PayPal Sandbox checkout was captured and persisted as PAID.
- The local order, PayPal order ID, nested capture ID, captured amount/currency and item line were checked in Supabase.
- Exactly one linked shipment and one order-derived finalized manifest were persisted.

Not verified:
- A PayPal Orders v2 tracking write. `PAYPAL_TRACKING_SUBMISSION_ENABLED=false` remains the intended hosted setting.
- Production PayPal payments or live tracking.
- Seller Protection eligibility. PayPal makes that decision; ParcelProof does not.

The Orders v2 tracking implementation uses the order ID in `/v2/checkout/orders/{id}/track` and the stored capture ID. PayPal's current documentation requires the order to be captured and in a supported state before tracking can be assigned. No tracking write has been made in this project.

## AI packing inspection and evidence retention

Configured model: `gemini-3.8-flash`. Google's current model-specific page lists this as a stable model and documents image input and structured outputs.

Implemented and CI-tested:
- Gemini is the primary vision provider.
- HTTP 503 transient service failures receive one bounded server-side retry.
- HTTP 429 rate/quota failures are not immediately retried. The API returns 429 and tells the operator to retry after the relevant limit resets.
- The UI provides separate retry wording for 503 recovery and 429 rate/quota recovery.
- Other errors such as invalid model, permissions or invalid request do not show a transient retry button.
- If Gemini fails, the backend stores a non-approvable `AI_FAILED` inspection attempt with manifest fingerprint, photo hashes and photo references when the database write succeeds.
- Uploaded photo evidence is not deleted merely because the AI provider fails.
- An `AI_FAILED` inspection cannot receive human approval and cannot satisfy the PayPal tracking gate.
- The optional OpenAI Vision fallback can be used when `OPENAI_API_KEY` is configured. It is not configured in the current hosted service.
- The frontend safely handles empty or non-JSON error responses.

Not yet verified against the live hosted environment:
- A successful Gemini inspection using photographs of the physical item in the hosted manifest.
- Upload and read-back of those photos using the private Supabase Storage bucket.
- A live hosted provider failure that creates a retrievable `AI_FAILED` database row and retained Storage objects.
- Re-loading inspection records and photos after a page reload/redeploy.
- A real human-review decision stored separately from AI observations.

Google API error guidance distinguishes HTTP 503 temporary service unavailability from HTTP 429 rate/quota limits. The project now treats those differently.

## Shipment-record checks and PayPal policy wording

The deterministic analyzer now reports operational shipment-record completeness only. The old Seller Protection “eligibility/readiness” labels and hard-coded USD 750 signature rule were removed.

The UI distinguishes merchant-entered fields/notes from carrier-verified events. The prototype does **not** connect to carrier event feeds. A tracking number typed by a merchant, a manually entered DELIVERED status or an address-text match is not independent proof of shipment or delivery.

PayPal's India Seller Protection terms require valid proof of shipment or delivery and state that PayPal determines eligibility at its sole discretion. ParcelProof does not calculate or guarantee protection eligibility.

## Hackathon submission checklist

The official rules supplied for the project require:
- Central PayPal developer-platform integration (Sandbox is allowed) and an AI tool/model.
- A real runnable application, not a static mockup.
- A public code repository with an open-source licence.
- A working demo URL or complete setup/run instructions and judge access details.
- A YouTube demonstration video under three minutes.
- Testing access free of charge during the judging period.

The current demo script is 2:45. The video has not yet been recorded or uploaded. The Devpost project overview and access fields were not independently verified because the provided manage/submission page could not be fetched without the authenticated Devpost session.

## Remaining release gaps

1. Complete one real hosted packing-photo upload and successful Gemini inspection using the physical item in the finalized manifest.
2. Verify that original photos can be retrieved after reload from private Supabase Storage.
3. Complete one hosted human-review decision and verify persistence/retrieval.
4. Decide the intended product boundary for the demo: the current verified workflow stops at packing review. Carrier event integration is not implemented.
5. Keep PayPal tracking writes disabled for the ordinary demo. Only test a Sandbox write after explicit approval of the exact order, capture, carrier and tracking number.
6. Confirm the Devpost project uses the current ParcelProof-AI repository and hosted URL, then add the judge access instructions.
7. Record and upload the actual working demonstration video to YouTube and link it in Devpost.
8. Perform a final public repository secret/data audit.

## Release decision

**Not release-ready yet.** The latest code is green in CI and deployed LIVE on Render. A real PayPal Sandbox payment, persisted shipment and finalized order-derived manifest are verified. The most important remaining task is a successful live hosted packing-photo inspection followed by a human-review decision. Carrier events, PayPal tracking writes, the demo recording and the final Devpost checks remain open.
