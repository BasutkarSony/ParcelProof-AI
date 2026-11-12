# ParcelProof AI — 2:50 demonstration video

**One-line story:** PayPal confirms what the buyer paid for; ParcelProof helps the merchant check what is about to be packed.

Target runtime: **2 minutes 50 seconds**. Record the real hosted application in a desktop browser. Use the existing synthetic demonstration order and its saved inspection; do not create extra test data solely for the video.

| Time | Show | Narration |
|---|---|---|
| 0:00–0:12 | Open the live app on the Orders page. | “A PayPal payment confirms an order, but it does not confirm that the correct product and quantity are going into the parcel. ParcelProof adds a packing check before sealing.” |
| 0:12–0:36 | Show one paid order card with buyer, PayPal payment received, order total, product name and quantity. | “This order was paid through PayPal Sandbox. The captured order supplies the exact product lines and quantities ParcelProof uses for packing.” |
| 0:36–0:55 | Open the order and show the confirmed manifest and SHA-256 fingerprint. | “The merchant checks the order items and confirms the packing list. Its fingerprint gives later inspections a fixed reference for what was declared.” |
| 0:55–1:12 | Show the private catalogue identity description and saved reference image. | “The buyer sees short shop copy. The merchant can save the product’s distinguishing details and reference photo once, then reuse them for packing checks.” |
| 1:12–1:42 | Show the existing original packing photo, AI observation, model and timing. | “Gemini compares what is visible in the pre-seal photo with the paid-order manifest and saved product reference. It separates object detection from variant assessment. The AI does not make the final decision.” |
| 1:42–2:10 | Show the catalogue reference next to the packing photo. Record or show the merchant selecting Needs fixing and entering a short explanation. | “Here, the merchant cannot confirm the exact product variant from the photo. They request a correction and explain what needs to change. The shipment remains on hold.” |
| 2:10–2:32 | Return to Packing. Show the saved merchant note, the unchanged manifest reference, and the action to replace the item and take a new photo. | “When the merchant returns to packing, the exact correction note is visible beside the next step. The original paid order and finalized manifest are preserved; a corrected photo creates a new inspection attempt.” |
| 2:32–2:50 | Show inspection history, manifest fingerprint and photo SHA-256 details. End on the product name. | “ParcelProof links the PayPal capture, declared items, original packing evidence, AI observation and separate merchant decision. It is an application evidence trail—not proof of sealed contents or carrier delivery.” |

## Recording checklist

- Use the actual hosted app and existing synthetic demonstration order/inspection.
- Keep the video **under three minutes**.
- Show the purchased items on the Orders card, not just the order ID and amount.
- Show the saved product reference and the original packing photograph together.
- Show that the merchant supplies a reason for a correction and that the note appears again in Packing.
- Do not say the AI detected the variant mismatch when the merchant actually identified the uncertainty.
- Do not claim that a photo proves the contents of a sealed parcel.
- Do not claim live payments, carrier events, PayPal tracking submission, Seller Protection eligibility or a guaranteed dispute outcome.
- Do not show passwords, API keys, buyer credentials, personal data or private dashboard information.
- Use your own narration or silence. Do not add copyrighted music or unlicensed third-party material.
- Upload the final video to YouTube with **public** visibility and paste its URL into Devpost.
