# ParcelProof AI — 2:40 demonstration video

**One-line story:** PayPal confirms what the buyer paid for; ParcelProof helps the merchant check what is about to be packed.

Target runtime: **2 minutes 40 seconds**. Record the real hosted application in a desktop browser. Use the existing synthetic demonstration order and its saved inspection; do not create more test data solely for the video.

| Time | Show | Narration |
|---|---|---|
| 0:00–0:15 | Open the live app on the Orders page. | “A PayPal payment confirms an order, but it does not confirm that the correct item is going into the parcel. ParcelProof adds a packing check before sealing.” |
| 0:15–0:40 | Open the existing paid demonstration order. Show its PayPal reference and the purchased item/quantity. | “This order was paid through PayPal Sandbox. ParcelProof verifies the completed payment and uses the purchased order lines as the source for the packing manifest.” |
| 0:40–1:00 | Show the finalized manifest and its SHA-256 fingerprint. | “The merchant confirms the item and quantity. Finalizing the manifest creates a fingerprint for the declared contents.” |
| 1:00–1:20 | Briefly show the product profile: short buyer description, private packing details and saved reference photo. | “The buyer sees a simple product description. The detailed identity information and reference image stay in the merchant's packing workflow and can be reused for later orders.” |
| 1:20–1:48 | Show the existing packing photo and completed Gemini inspection. Show the model and processing time displayed by the app. | “The merchant takes one overview photo before sealing. Gemini compares what is visible with the paid-order manifest and the saved product reference. It returns observations, not a shipment decision.” |
| 1:48–2:20 | Show the catalogue reference beside the original packing photo, then the saved NEEDS_CORRECTION review and shipment-on-hold status. | “In this example, the model says MATCH because it sees one mug and the expected quantity. The merchant notices that the exact design is not verified, requests correction and keeps the shipment on hold. The human decision is stored separately from the AI result.” |
| 2:20–2:40 | Show the inspection's manifest fingerprint, photo SHA-256 and review history. End on the product name. | “The result is a traceable record of the paid order, declared items, packing photo, AI observation and merchant decision. It is not proof of sealed contents or carrier delivery. ParcelProof keeps the final decision with the merchant.” |

## Recording checklist

- Use the actual hosted app and existing persisted order/inspection.
- Keep the video **under three minutes**.
- Make sure the AI result and the merchant's NEEDS_CORRECTION decision are both visible; do not say the AI detected the variant mismatch.
- Do not show passwords, API keys, buyer credentials, personal data or private dashboard information.
- Do not claim carrier events, PayPal tracking submission, Seller Protection eligibility or production payments.
- Do not claim that the photograph proves what is inside a sealed parcel.
- Use your own narration or silence. Do not add copyrighted music or unlicensed third-party material.
- Upload the final video to YouTube with public visibility and paste its URL into Devpost.
