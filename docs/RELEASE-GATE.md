# ParcelProof AI — Release Gate

Use this checklist against the deployed judge environment. A green unit-test suite alone is not enough: the PayPal and AI flows must be demonstrated end to end.

## A. Build and repository

- [ ] Public repository opens without authentication.
- [ ] Repository contains source, `README.md`, this manual, `.env.example`, tests and an open-source licence.
- [ ] No `.env`, API keys, database files, buyer data, uploaded photos, `node_modules`, build output or local virtual environment is committed.
- [ ] GitHub Actions backend tests pass.
- [ ] GitHub Actions frontend tests pass.
- [ ] GitHub Actions lint and production build pass.
- [ ] Docker image builds successfully.

## B. Hosted demo and access

- [ ] Hosted URL loads over HTTPS.
- [ ] Shared judge username/password work.
- [ ] `/health` returns `{"status":"ok"}` without requiring demo login.
- [ ] Incorrect credentials are rejected.
- [ ] Database and uploaded evidence survive a service restart/redeploy.
- [ ] No paid plan or external account is required from judges to use the hosted demo.
- [ ] Demo credentials and required Sandbox accounts are included in the private judge instructions / submission access fields, not committed to source.

## C. PayPal Sandbox checkout

- [ ] PayPal status shows whether the Sandbox credentials are configured.
- [ ] A buyer can select catalogue items and quantities.
- [ ] Recipient and delivery details are validated before checkout.
- [ ] PayPal approval redirects back to the app.
- [ ] Backend verifies capture status, amount, currency and order linkage.
- [ ] Successful capture creates exactly one persistent shipment.
- [ ] Repeated capture/retry does not create duplicate shipments.
- [ ] Cancelled, failed or unverified payment does not create a shipment.

## D. Manifest and packing evidence

- [ ] Shipment manifest is derived from the paid order's exact item lines and quantities.
- [ ] Merchant can review/edit the draft before finalization.
- [ ] Finalization generates a manifest fingerprint and locks the manifest.
- [ ] Inspection is blocked when no finalized manifest exists.
- [ ] Up to five packing photos can be uploaded and retrieved after reload.
- [ ] Inspection stores the manifest fingerprint and photo hashes.
- [ ] Gemini Vision returns structured observations, or a clear recoverable error is shown.
- [ ] Temporary Gemini failure follows the bounded retry/fallback path when configured.
- [ ] All uploaded photos are preserved for the optional OpenAI fallback.
- [ ] AI never makes the human approval/rejection decision.

## E. Human review and evidence history

- [ ] Latest inspection is clearly identified.
- [ ] Reviewer can inspect original photos and model observations.
- [ ] Approve requires a reviewer label.
- [ ] Request-correction and reject require an explanation.
- [ ] Human decision is persisted separately from AI output.
- [ ] Older inspections cannot be reviewed after a newer inspection exists.
- [ ] A new inspection can be submitted after corrections.
- [ ] Inspection details and photos can be retrieved after page reload and service restart.

## F. PayPal tracking safety

- [ ] `PAYPAL_TRACKING_SUBMISSION_ENABLED=false` in the deployed judge environment.
- [ ] UI clearly explains that tracking writes are locked.
- [ ] Unpaid/sample shipments cannot submit tracking.
- [ ] Unfinalized manifests cannot submit tracking.
- [ ] A shipment without latest human approval cannot submit tracking.
- [ ] No live PayPal transaction or live tracking write is used in the demo.

Only if an explicitly approved Sandbox write test is planned:

- [ ] Confirm the exact Sandbox order ID and capture ID.
- [ ] Confirm carrier and tracking number are test values.
- [ ] Obtain approval before temporarily enabling the write gate.
- [ ] Submit once and record the PayPal Sandbox response.
- [ ] Restore the write gate to `false` immediately after the test.

## G. Presentation and submission

- [ ] Product description states the customer, problem, workflow and limitations.
- [ ] User manual is linked from the README.
- [ ] YouTube demo is public/unlisted as permitted by the event and under three minutes.
- [ ] Video shows the real running product, not only slides or mockups.
- [ ] Demo covers PayPal Sandbox payment → shipment → finalized manifest → photos/AI → human review → evidence retrieval.
- [ ] Devpost includes hosted demo URL, public repository, video and judge access instructions.
- [ ] No claim says the product guarantees Seller Protection or replaces carrier delivery proof.

## Release decision

Do not call the project release-ready until sections A–G have been checked against the actual deployed version. Record any unchecked item as a known limitation rather than implying it passed.
