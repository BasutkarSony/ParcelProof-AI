# ParcelProof AI — Merchant User Manual

This guide describes the current hackathon prototype. It is not a guide to a production shipping or warehouse platform.

## 1. What ParcelProof AI does

ParcelProof AI connects a PayPal Sandbox checkout to a shipment record, an order-derived packing manifest, packing photographs, AI-generated observations and a separate human review decision. It can also prepare a PayPal Orders v2 tracking update, but the tracking write is disabled by default.

The app is intended to help a merchant reconstruct what was ordered and what was checked during packing. It does not prove what was inside a sealed parcel, replace carrier tracking, or guarantee PayPal Seller Protection.

## 2. Sign in to the hosted demo

The hosted demo is protected by one shared HTTP Basic Authentication username and password. Use the credentials supplied to you by the project owner or hackathon submission. Each reviewer label entered in the app is only a label; it is not an individually authenticated account.

For local development, demo authentication is normally disabled. Follow the setup instructions in the repository README and configure the backend `.env` file. Never put real credentials in the repository or in screenshots.

## 3. Main navigation

- **Shipment Review** — view PayPal-linked shipment records and select the order to work on.
- **Product Catalogue** — save a product's detailed description, one reference image and optional GTIN once per SKU.
- **Manifests** — confirm the order-derived products and quantities, then finalize the packing manifest.
- **Packing Station** — review the finalized manifest, photograph the actual items before sealing, and run AI vision inspection.
- **AI Inspections** — review original photos and AI observations, then approve, request correction or reject the packing review. The guarded tracking workflow is shown here.
- **Sandbox Checkout** — create a PayPal Sandbox payment for a physical-goods order.

### One-time product identity setup

Before fulfilling a catalogue SKU for the first time:

1. Open **Product Catalogue**.
2. Review the product description and add details that distinguish the ordered variant, such as material, model, size or finish.
3. Optionally enter the digits printed below the product barcode. ParcelProof checks the GTIN check digit; it does not use the device camera to decode barcode bars.
4. Optionally upload one clear reference photo of the actual product. Save the profile.

The reference photo is kept in private storage and reused as catalogue context in future AI packing inspections. It is not counted as a parcel item and does not need to be uploaded again for every order. Reference images are optional; without one, AI uses the manifest description and any supplied GTIN metadata.

## 4. Create a test order

1. Open **New Checkout**.
2. Select one or more items from the sample catalogue and set quantities.
3. Enter the recipient and delivery details requested by the checkout form.
4. Continue to PayPal and sign in with a PayPal Sandbox buyer account. Do not use a live PayPal account.
5. Approve the Sandbox payment and return to ParcelProof AI.
6. Wait for the backend to capture and verify the payment. A shipment should be created from the verified checkout record.

If the payment is cancelled, incomplete or cannot be verified, do not expect a shipment to be created. A retry should use the checkout flow again; do not manually mark an unpaid order as paid.

## 5. Review the shipment

1. Open **Shipment Review**.
2. Find the new order in the shipment list and select it if the screen requires a selection.
3. Check the order identifier, payment/capture reference, amount, recipient and shipment details.
4. Use the available validation and evidence-analysis actions to inspect the record.

The deterministic checks are advisory rules and text-pattern heuristics. They are not a PayPal decision and do not independently verify a carrier's delivery scan.

## 6. Create and finalize the packing manifest

1. Open **Manifests**.
2. Select the shipment created from the paid checkout.
3. Review the item descriptions and quantities populated from the order. Confirm that they match the physical items intended for the parcel.
4. Confirm the item description and quantity. Treat the SKU as your internal catalogue reference; the AI does not expect that code to be printed on the physical product. Add only useful distinguishing details to the description (for example, brand, model, size or material when those details define the ordered item). Do not add items that are not actually being packed.
5. Save the draft if the interface offers a save action.
6. When the declared contents are correct, choose the finalize action.
7. Confirm that the status changes to **FINALIZED** and that a SHA-256 manifest fingerprint is displayed.

Finalization locks the manifest against normal edits. Check quantities and descriptions carefully before finalizing. If the manifest is wrong, use the app's supported correction path rather than assuming the finalized record can be edited.

## 7. Capture packing evidence and run AI inspection

1. From the finalized manifest, open **Packing Station**.
2. Confirm that the selected shipment and manifest are correct.
3. Pack the order and take one clear, well-lit overview photograph showing all unpacked items and their condition before the parcel is sealed. Add a second photograph only when it shows a separate item, a useful label or a visible issue. You do not need repeated angles of the same item.
4. Upload the overview photograph and any genuinely useful detail photograph(s), up to five in total.
5. Review the selected photo thumbnails/count, then choose **Run AI Vision Inspection**.
6. Wait for the inspection result. If a temporary provider error offers **Retry Inspection**, retry only after checking the message. Validation errors such as an unfinalized manifest are not retryable; fix the underlying issue first.

The app selects a vision provider on the server. When Groq is configured and the inspection contains up to three photos, `qwen/qwen3.8-27b` can be used. Groq currently lists this model as Preview and limits each request to three images. If four or five photos are uploaded, the app uses Gemini instead so every photo is analysed. Gemini `gemini-3.8-flash` is also the fallback when Groq is unavailable.

- **HTTP 503 from Gemini:** temporary provider unavailability/overload. The backend makes one bounded retry. If it still fails, the UI offers **Retry Inspection** after the provider recovers.
- **HTTP 429:** a short-window rate limit or exhausted daily quota. The backend does not send an immediate second request. Check the Google AI project usage details, wait for the applicable limit to reset, then use **Retry after limit resets**. A daily quota cannot be fixed by repeating the request.
- **Other errors:** model, credentials, permissions or request validation need to be corrected; the UI does not offer a transient retry for these cases.

The optional OpenAI Vision fallback is used only when `OPENAI_API_KEY` is configured; it is not configured in the current hosted demo.

**Evidence retention on provider failure:** the backend records a non-approvable `AI_FAILED` attempt with the manifest fingerprint, photo hashes and saved photo references when the database write succeeds. It does not delete uploaded photos just because the AI service is unavailable. An `AI_FAILED` attempt cannot be approved and cannot unlock PayPal tracking. A retry creates a new attempt; the failed attempt remains in history. This recovery behavior is covered by automated tests, but still needs a fresh end-to-end hosted Storage verification.

AI output is an observation aid, not an approval. The model can miss items or report incorrect findings. A photograph of a sealed parcel cannot establish the parcel's contents. The current catalogue has no saved product reference images or barcode/GTIN matching. Without those references, the model can compare only the visible appearance with the manifest description; it cannot prove an exact internal SKU. Generic descriptions or ambiguous photographs should result in uncertainty, not an assumed mismatch.

## 8. Review an inspection

1. Open **AI Inspections**.
2. Select the relevant shipment and latest inspection.
3. Review all original photographs, the manifest reference, the AI observations, warnings and uncertainty.
4. Enter a reviewer label. This is a demo label, not a verified identity.
5. Record notes describing what you actually checked.
6. Choose one decision:
   - **Approve packing review** only when you have independently checked the available evidence and are satisfied with the packing record.
   - **Request correction** when the packing or evidence needs to be corrected. Explain what must change.
   - **Reject inspection** when the inspection/evidence should not be accepted. Explain why.
7. If correction is requested or the inspection is rejected, return to the packing workflow, resolve the issue and submit a new inspection. Only the latest inspection can receive a human decision.

The human decision is stored separately from the model's observations. Approval means the reviewer approved this packing review; it does not mean PayPal has approved Seller Protection or that delivery has been proven.

## 9. PayPal tracking

The app contains a guarded PayPal Orders v2 tracking workflow. It requires a saved, verified PayPal checkout, the matching capture, a finalized manifest and human approval of the latest inspection.

**Tracking submission is disabled by default.** The hosted Blueprint sets `PAYPAL_TRACKING_SUBMISSION_ENABLED=false`. Do not change it for the purpose of an ordinary demo. An OAuth connection check or a preview is not proof that a tracking update was submitted. Only enable the write gate for an explicitly approved PayPal Sandbox test, after confirming the order, capture, carrier and tracking number. Never test against a live transaction.

## 10. Troubleshooting

| What you see | What to check |
|---|---|
| No shipment after checkout | Confirm the PayPal Sandbox buyer approved payment and that capture verification completed. A cancelled or unverified payment must not create a shipment. |
| No manifest or inspection | Select the correct shipment and create/finalize its manifest first. |
| Inspection says manifest is not finalized | Return to **Manifests**, verify the contents and finalize the draft. |
| AI provider unavailable | Check that the Gemini key is configured and valid. If using fallback, check the OpenAI key. Retry only when the UI offers a retry for a temporary error. |
| Photo upload or inspection fails | Check file type/size, connection and that no more than five photos are selected. Re-select clear images and retry if appropriate. |
| Review controls are unavailable | Confirm that you selected the latest inspection and that it has not already received a final human decision. |
| Tracking is blocked | Check payment verification, manifest finalization and latest human approval. The write gate may also be intentionally disabled. |
| Hosted app is unavailable | Contact the project owner; the demo may be redeploying or its hosting service may be unavailable. |

## 11. Privacy and safe use

- Use Sandbox buyer accounts and test data for the hackathon demonstration.
- Do not upload real customer identity documents, payment credentials or unrelated personal information.
- Treat uploaded packing photos and shipment data as sensitive business records.
- Do not share hosted demo credentials publicly beyond intended judges/testers.
- Do not assume that a shared demo password provides merchant-level access separation.
- Do not use the prototype as the sole record for a real-world dispute or shipment decision.

## 12. Known prototype limitations

- The storefront uses a small sample catalogue; it is not connected to a merchant's Shopify, WooCommerce or other live store.
- Product identity profiles are configured manually once per SKU. The app validates a supplied GTIN's check digit but does not optically scan barcodes; visual similarity is supporting evidence, not proof of an exact SKU.
- The demo uses shared authentication, not separate merchant accounts or role-based access.
- Carrier events are not independently fetched from carrier systems by this prototype.
- AI inspection is fallible and requires a human decision.
- Evidence photos and a manifest fingerprint are supplementary records; they do not replace carrier-verifiable shipment and delivery information.
- PayPal Sandbox integration is not proof of production payment or tracking readiness.
