# ParcelProof AI — Release Gate

This checklist reflects the verified state of the current PayPal AI Hackathon submission as of 6 November 2026. Passing CI is necessary, but a green build is not proof that external AI, carrier or PayPal tracking workflows work end to end.

## A. Canonical repository and build

- [x] Current submission repository is public: [BasutkarSony/ParcelProof-AI](https://github.com/BasutkarSony/ParcelProof-AI).
- [x] GitHub detects the MIT open-source licence.
- [x] Current repository created during the Hackathon Submission Period (4 November 2026).
- [x] Latest green CI run: [42242821982](https://github.com/BasutkarSony/ParcelProof-AI/actions/runs/42242821982), current `main` head `96d659826fc9ab9270c5faf99c02e7cc5ab5b2ad`. The application behavior changes are in ancestor commit `635282cde69cebcc929f72390ed970e005d80ea9`.
- [x] Backend unit suite: 238 tests discovered, 235 passed and 3 PostgreSQL-only tests skipped in this job.
- [x] Three PostgreSQL 17 persistence integration tests passed in the separate job.
- [x] Frontend tests, Oxlint and Vite production build passed.
- [x] Docker deployment image built successfully.
- [x] Inspect the current `main` working tree: no real `.env`, DB, uploaded photo, local build or dependency artifacts are committed; `.gitignore` and `.dockerignore` exclude those paths.
- [ ] Complete a full public repository secret/data audit across commit history.
- [ ] Confirm the Devpost repository URL points to this canonical ParcelProof-AI repository.

Use this repository and its current `main` branch as the source for the submission, hosted demo and judge instructions.

## B. Hosted demo and persistence

- [x] Existing Render Free service is live: https://parcelproof-ai-058h.onrender.com
- [x] Current `main` head `96d659826fc9ab9270c5faf99c02e7cc5ab5b2ad` is deployed LIVE: `dep-dbmv2umc6qcc73bkbpug`.
- [x] Application logs show `GET /health` HTTP 200 after deployment.
- [x] Hosted checkout data persisted through Render into the connected Supabase PostgreSQL database.
- [x] Supabase project is ACTIVE_HEALTHY; PostgreSQL 17 and all nine app tables exist.
- [x] Private `inspection-photos` bucket exists with a 10 MB file limit and JPEG, PNG and WebP restrictions.
- [ ] Verify shared judge login and wrong-password rejection on the deployed app.
- [ ] Verify hosted photo upload, read-back and retrieval through private Supabase Storage.
- [ ] Verify stored inspection/photo evidence survives an actual Render restart/redeploy.
- [ ] Include judge access instructions and any required Sandbox account details in Devpost's private access fields.

Live Supabase row-count snapshot: 1 order, 1 shipment, 1 finalized manifest, 0 packing inspections, 0 inspection photos and 0 inspection reviews.

## C. PayPal Sandbox checkout

- [x] Hosted PayPal OAuth check succeeds; tracking write gate is locked.
- [x] One buyer-approved Sandbox checkout completed and the backend verified the captured order.
- [x] Local paid order, PayPal order ID, nested capture ID, amount, currency and line item persisted in Supabase.
- [x] Exactly one linked shipment was created.
- [x] Paid checkout generated an order-derived manifest that was finalized and fingerprinted.
- [x] Automated tests cover failed/unverified payment rejection and duplicate shipment retry handling.
- [ ] Re-run the buyer approval/capture flow in the final recording environment.
- [ ] Re-check cancel, failed and unverified payment paths in the hosted environment.

Do not use a live PayPal account or imply that Sandbox verification means production readiness.

## D. Packing evidence and AI inspection

- [x] Inspection requires a finalized manifest (automated test coverage).
- [x] Gemini model default/configuration is `gemini-3.8-flash`; Google documents it as stable, with image inputs and structured outputs.
- [x] HTTP 503 gets one bounded server-side retry.
- [x] HTTP 429 rate/quota errors are not immediately retried; the operator is told to wait for the applicable limit reset.
- [x] AI provider failures preserve uploaded photo evidence and create a non-approvable `AI_FAILED` attempt when the database write succeeds (automated regression tests).
- [x] AI_FAILED attempts cannot be approved and cannot satisfy the PayPal tracking gate.
- [x] Frontend safely handles empty/non-JSON errors and has retry UI for provider recovery.
- [ ] Complete one real hosted photo upload and successful Gemini inspection using photographs of the physical item in the finalized manifest.
- [ ] Verify the hosted AI result stores the manifest fingerprint and photo hashes.
- [ ] Verify hosted Gemini failure leaves the original files in private Supabase Storage and creates a retrievable `AI_FAILED` record.
- [ ] Verify original photos and inspection details can be reloaded after a page refresh.
- [ ] Verify a new inspection can be created after the relevant rate window or quota resets.

The optional `OPENAI_API_KEY` fallback is not configured in the current hosted service. Do not present mock AI output or an AI_FAILED attempt as a successful live inspection.

## E. Human review

- [x] Backend tests cover separate persistence of human decisions and latest-inspection checks.
- [x] An `AI_FAILED` inspection is non-approvable and cannot unlock tracking.
- [ ] Complete a real hosted review with reviewer label and notes.
- [ ] Verify Approve, Request Correction and Reject outcomes in the hosted UI.
- [ ] Verify a human decision is stored separately from AI output and can be reloaded.
- [ ] Verify a corrected packing attempt creates a new inspection and older inspections cannot be re-reviewed.

A reviewer label is not an authenticated individual identity. The current demo uses shared Basic Auth, not merchant-level roles.

## F. Carrier events and PayPal tracking safety

- [x] The old heuristic Seller Protection eligibility/readiness score and hard-coded USD 750 signature rule were removed.
- [x] Shipment checks distinguish merchant-entered fields from carrier-verified events.
- [x] Backend tracking code uses the stored PayPal Orders v2 order ID and capture ID.
- [x] `PAYPAL_TRACKING_SUBMISSION_ENABLED=false` remains the intended hosted setting.
- [x] Automated tests cover the tracking gate: paid checkout, finalized manifest and latest human approval.
- [ ] Integrate at least one actual carrier event source and preserve provider, event time, status and verification/source details.
- [ ] Test carrier destination and delivery event matching against a genuine carrier response.
- [ ] Verify the deployed tracking write gate value without exposing secrets.
- [ ] Make a PayPal Sandbox tracking write only after explicit approval of a named test order, capture, carrier and test tracking number.

PayPal's current Orders v2 documentation requires a captured order in a supported state before tracking is assigned. Do not enable writes or use live transactions for an ordinary demo. PayPal makes the final Seller Protection decision.

## G. Video and Devpost submission

- [x] README and merchant manual explain the current prototype and known limitations.
- [x] Demo script is 2:45, below the official three-minute limit.
- [ ] Record a real hosted demo showing only steps that actually complete.
- [ ] Show PayPal Sandbox payment, order-derived finalized manifest, successful AI inspection and separate human review only after those hosted steps pass.
- [ ] Show the shipment-record checks and explain that carrier events are not connected yet.
- [ ] Show the PayPal tracking write gate locked and explain why it remains locked.
- [ ] Upload the demo video to YouTube and set visibility as permitted by the event rules.
- [ ] Confirm Devpost project overview fields, current repository link, hosted demo URL, YouTube link and judge access instructions.
- [ ] Confirm the hosted project is accessible to judges free of charge for the judging period.
- [ ] Ensure all demo footage and audio are owned/licensed and do not include unauthorized third-party marks or copyrighted music.

The submitted official rules specify a deadline of **12 November 2026 at 12:00 PM Pacific Time** (13 November 2026 at 1:30 AM India Standard Time). Re-check the event page for any amended rules before final submission.

## Release decision

**Not release-ready yet.** The latest application commit is green in CI and live on Render. One real PayPal Sandbox payment, linked shipment and finalized order-derived manifest are verified. The blocking evidence is a successful hosted packing-photo inspection and a separate persisted human-review decision. Carrier-event integration, PayPal tracking-write verification, demo recording and final Devpost checks remain open.
