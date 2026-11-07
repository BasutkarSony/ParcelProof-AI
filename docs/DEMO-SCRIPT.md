# ParcelProof AI — 2:45 Demo Script

**Story:** A small PayPal merchant wants to avoid sending the wrong or incomplete order. ParcelProof links the verified payment to the exact purchased items, then checks visible packing evidence before the parcel is sealed.

Target runtime: 2 minutes 45 seconds. Use the deployed judge environment, a PayPal Sandbox buyer and the physical item in the finalized manifest. Do not show secrets, live PayPal credentials or fabricated AI output.

| Time | Show | Narration |
|---|---|---|
| 0:00–0:15 | Shipment Review landing screen | “A small merchant can receive a PayPal payment, but still make a costly pick-and-pack mistake. ParcelProof AI focuses on catching visible wrong-item or missing-item discrepancies before dispatch.” |
| 0:15–0:45 | New Checkout; select the actual product and quantity; PayPal Sandbox approval and return | “We start with a real PayPal Sandbox checkout. The backend verifies the capture, amount and currency. The shipment is linked to the exact items the buyer paid for.” |
| 0:45–1:10 | Manifests; show order-derived item descriptions, quantities and finalized fingerprint | “The packing manifest is generated from that paid order. The merchant confirms the item descriptions and quantities. The SKU is an internal reference, not something the AI expects to read from the product.” |
| 1:10–1:45 | Packing Station; show one overview photo of all unpacked items before sealing; run the configured vision inspection | “One clear overview photo is normally enough. Vision AI compares what is visible with the manifest description and flags possible discrepancies or uncertainty. It does not require the merchant to photograph the same item from multiple angles, cannot prove sealed contents and never approves the shipment.” |
| 1:45–2:15 | AI Inspections; inspect original photos and model observations; enter reviewer label/notes; record the real human decision | “A human reviews the original evidence and the AI observations, then records a separate decision: approve the packing review, request correction or reject the evidence. The AI does not make that decision.” |
| 2:15–2:35 | Show Shipment Record Checks and PayPal tracking section with gate locked | “The record checks help find missing or inconsistent information. Carrier events are not integrated yet, so merchant-entered tracking notes are not presented as carrier proof. PayPal tracking writes stay locked in this demo.” |
| 2:35–2:45 | Return to overview / product name | “ParcelProof connects payment, declared items, packing evidence and human review to help prevent avoidable fulfilment mistakes before dispatch.” |

## Recording notes

- Use a real Sandbox checkout and the exact item shown in the finalized manifest.
- Photograph the actual item(s) before sealing the parcel. One overview photo is normally enough when all items are visible; add detail photos only when they show a separate item, a useful label or a visible issue. Do not substitute stock photos, generic product images or an image of a sealed box.
- Use an inspection result that actually completed in the hosted deployment. Do not present mock AI output, a local-only run or an `AI_FAILED` attempt as a successful inspection.
- Do not record the video as a complete E2E workflow until hosted AI inspection, durable photo retrieval and the separate human-review decision have all passed.
- Show the reviewer decision as a distinct action after AI analysis.
- Describe AI findings as possible visible discrepancies, not proof of parcel contents or a delivery guarantee.
- Do not claim exact SKU verification: the current catalogue has no product reference images or barcode/GTIN matching, and internal merchant SKUs are not expected to appear on the item.
- Explain that no carrier event feed is connected yet.
- Do not enable PayPal tracking submission just to make the screen look complete.
- If a live step fails, fix it and re-record. Do not narrate a success that did not happen.
- Keep the video under three minutes and upload it to YouTube with visibility allowed by the event rules.
