# ParcelProof AI — 2:48 demonstration video

**One-line story:** PayPal confirms what the buyer paid for; ParcelProof helps the merchant review what is about to be packed.

Target runtime: **about 2 minutes 48 seconds**, and always under three minutes. Record the real hosted application in a desktop browser. Use the existing synthetic demonstration order and its saved packing photo, inspection and merchant decision. This is a walkthrough of a prepared Sandbox example, not a newly created checkout.

| Time | Show | Narration |
|---|---|---|
| 0:00–0:15 | Open the hosted app on **Orders**. Show the paid demonstration order. | “A PayPal payment confirms what the buyer ordered. It does not confirm that the correct product and quantity are on the packing table. ParcelProof adds a review before the parcel is sealed.” |
| 0:15–0:35 | Show the existing paid order, its product line and quantity. | “This is a prepared PayPal Sandbox order. ParcelProof verifies the completed order and capture, including the amount and currency, before using its purchased items as the packing reference.” |
| 0:35–0:55 | Open the finalized manifest and packing screen. Show the original product name and quantity, plus the manifest fingerprint. | “The packing list shows the actual product name and quantity from the paid order. The private matching notes are kept separate. Finalizing the list creates a fingerprint for the contents the merchant declared.” |
| 0:55–1:10 | Briefly show the product reference. If opening product setup, show that extra notes and barcode entry are optional. | “A saved product reference can help with later checks. Extra identifying notes and barcode numbers are optional. Barcode entry is manual in this version; camera scanning is not included.” |
| 1:10–1:40 | Show the saved packing photo beside the AI result. Show the actual observation and model information. | “Gemini reviewed this pre-seal photograph. In this example it recognized the visible mug and quantity, but it did not establish the exact catalogue design or variant. The AI result is an observation, not an approval.” |
| 1:40–2:05 | Show the saved merchant **NEEDS_CORRECTION** decision and its note. Show the shipment hold state if visible. | “The merchant reviewed the same evidence and chose Needs correction because the exact design could not be confirmed. The shipment remains on hold. This is the recorded human decision; the AI did not identify the variant mismatch on its own.” |
| 2:05–2:30 | Select **Verify saved photo** and show the result for the saved packing photograph. | “ParcelProof can re-read the stored photo, recalculate its SHA-256 digest and file size, and compare them with the upload-time record. Here the stored bytes match that record. This checks file integrity, not who took the photo or when.” |
| 2:30–2:48 | Show the inspection history and the linked manifest and photo evidence details. End on the product name. | “ParcelProof links the PayPal capture, declared items, packing photo, AI observation, integrity check and merchant decision. It does not prove the contents of a sealed parcel or independently verify carrier delivery.” |

## Recording checklist

- Sign in before starting the screen recording. Warm the hosted demo first; the Render Free service may take time to wake after inactivity.
- Start from **Orders** and use the existing synthetic paid order. Do not start from an empty test-checkout cart.
- Use the saved packing photo, inspection and recorded merchant decision from the verified QA example.
- Keep the final video **under three minutes**.
- Show the product line and quantity, finalized manifest, saved reference photo, actual AI observation, separate merchant decision and saved-photo integrity check.
- Describe the variant as **not verified by the AI**. Do not say the AI detected a variant mismatch; the merchant made that judgement.
- Show the integrity check only after it is available in the hosted build, and narrate the actual result shown. Do not claim that a corrected replacement photo or a successful second inspection exists. That follow-up cycle has not yet been demonstrated.
- Do not claim a photo proves the contents of a sealed parcel.
- Do not claim live payments, carrier events, PayPal tracking submission, Seller Protection eligibility or a guaranteed dispute outcome.
- Do not show passwords, API keys, buyer credentials, personal data or private dashboard information.
- Use your own narration or silence. Do not add copyrighted music or unlicensed third-party material.
- Upload the final video to YouTube with **public** visibility and paste its URL into Devpost.
