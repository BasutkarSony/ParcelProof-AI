# ParcelProof AI — Release Gate

This checklist reflects the deployed judge environment as of 6 November 2026. A green CI run is not proof that external AI, carrier or payment-write flows work end to end.

## A. Build and repository

- [x] Public repository opens without authentication.
- [x] Source, README, merchant manual, `.env.example`, tests and MIT licence are present.
- [ ] Complete a final secret/data audit of the public repository and all history.
- [x] Latest GitHub Actions workflow passes on `main`: [run 42236129396](https://github.com/BasutkarSony/ParcelProof-AI/actions/runs/42236129396).
- [x] Backend unit tests: 232 passed; 3 PostgreSQL-only tests run in the separate PostgreSQL job.
- [x] Three PostgreSQL 17 integration tests pass.
- [x] Frontend tests, Oxlint and Vite production build pass.
- [x] Docker deployment image builds with the migrations included.

## B. Hosted demo and persistence

- [x] Existing Render service is live on the Free plan: https://parcelproof-ai-058h.onrender.com
- [x] Current deployed commit is `c4d244508e5ce97ddcfdef43a6659486be410111`; deployment `dep-dbmuecgn74is73bhdn50` is LIVE.
- [x] Render application health checks return HTTP 200 at `/health`.
- [x] Hosted checkout data was persisted through the Render service into the connected Supabase PostgreSQL database.
- [x] Supabase project is ACTIVE_HEALTHY; PostgreSQL 17 and all nine application tables exist.
- [x] Private `inspection-photos` bucket exists with 10 MB limit and JPEG, PNG and WebP restrictions.
- [ ] Verify shared judge login and wrong-password rejection in the deployed app.
- [ ] Verify hosted photo upload, read-back and retrieval after page reload using Supabase Storage.
- [ ] Verify stored inspection/photo evidence survives an actual Render restart/redeploy.
- [ ] Confirm the current judge access instructions and Sandbox buyer-account requirements are present in Devpost's private access fields.

Live Supabase snapshot: 1 order, 1 shipment, 1 finalized manifest, 0 packing inspections, 0 inspection photos and 0 inspection reviews.

## C. PayPal Sandbox checkout

- [x] Hosted PayPal OAuth check succeeds and reports the tracking write gate as locked.
- [x] One buyer-approved Sandbox checkout completed and the backend verified/captured payment.
- [x] The PAID order, amount, currency, item line, PayPal capture linkage and shipment persisted in Supabase.
- [x] Shipment creation and duplicate-retry safety have automated unit/integration coverage.
- [ ] Re-run buyer approval/capture once in the final deployed demo recording environment.
- [ ] Re-verify cancel, failed and unverified payment paths in the hosted environment.

Do not use a live PayPal account or imply that Sandbox verification means production readiness.

## D. Order-derived manifest and packing evidence

- [x] The verified paid order produced a shipment and an order-derived manifest.
- [x] The manifest was finalized and its fingerprint persisted.
- [x] Inspection is blocked unless a finalized manifest exists (automated test coverage).
- [x] AI provider failure now preserves uploaded photo evidence and persists a non-approvable `AI_FAILED` record when the database write succeeds (automated regression coverage).
- [ ] Complete one successful hosted photo upload and AI inspection using real packing photos of the exact item in the manifest.
- [ ] Verify the hosted AI result stores photo hashes and the manifest fingerprint.
- [ ] Verify a hosted AI provider outage leaves the photo in private Supabase Storage and creates a retrievable `AI_FAILED` attempt.
- [ ] Verify retrying an AI_FAILED attempt with the same browser-selected files creates a new attempt without deleting the original evidence.
- [ ] Verify the latest inspection and original photographs can be reloaded after a page refresh.

The configured `gemini-3.8-flash` model identifier is valid, but a successful hosted Gemini image analysis is not yet verified. `OPENAI_API_KEY` is optional and not configured in the current service.

## E. Human review and evidence history

- [x] Backend tests cover separate persisted human decisions and enforce latest-inspection checks.
- [x] An `AI_FAILED` inspection is not approvable and cannot satisfy the tracking gate.
- [ ] Complete a live hosted review with reviewer label and notes.
- [ ] Verify approve, request-correction and reject outcomes in the deployed UI.
- [ ] Verify the human decision is persisted separately from model observations and is retrievable after reload.
- [ ] Verify a corrected packing attempt creates a new inspection and the older inspection cannot be re-reviewed.

A reviewer label is not an authenticated individual identity; the current demo uses shared authentication rather than merchant-level role accounts.

## F. Shipment events and PayPal tracking safety

- [x] Old “Seller Protection eligible / ready” heuristic claims and the hard-coded USD 750 signature rule were removed from the analyzer/UI.
- [x] The UI distinguishes merchant-entered shipment data from independently carrier-verified events.
- [ ] Integrate at least one real carrier tracking/event source and preserve event source, timestamp, status and raw/normalized reference.
- [ ] Verify carrier delivery event and destination matching using an actual carrier response, not merchant-entered notes.
- [x] `PAYPAL_TRACKING_SUBMISSION_ENABLED=false` remains the intended hosted setting; ordinary demo flow keeps writes locked.
- [x] Backend test coverage requires verified payment, finalized manifest and latest human approval before a tracking write.
- [ ] Verify the actual current Render environment value without exposing secrets.
- [ ] Perform a PayPal Sandbox tracking write only if explicitly authorized for a named test order/capture and test tracking number.

Do not enable tracking writes or use a live transaction for an ordinary demo. PayPal makes the final Seller Protection determination; ParcelProof must not claim otherwise.

## G. Presentation and submission

- [x] README and merchant manual explain the current prototype and its limitations.
- [x] Demo script is under three minutes.
- [ ] Record a real end-to-end demo showing only flows that actually complete.
- [ ] Include the real Sandbox checkout, finalized manifest and AI/human-review result only after the hosted flow is verified.
- [ ] Show the locked PayPal tracking write gate and explain why it remains locked.
- [ ] Upload the demo video to YouTube as allowed by the event rules.
- [ ] Verify Devpost project title, description, public repository URL, demo URL, video and judge access instructions.
- [ ] Confirm no unsupported claim says ParcelProof guarantees Seller Protection, verifies carrier delivery without a carrier feed, or replaces PayPal's decision.

## Release decision

**Not release-ready yet.** The code is green in CI and the latest commit is live. One real PayPal Sandbox payment and an order-derived finalized manifest are verified. The live AI photo-inspection and human-review workflow has not been demonstrated successfully in the hosted environment; carrier event integration, final demo recording and Devpost submission checks are also open.