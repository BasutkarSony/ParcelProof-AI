# ParcelProof AI — 2:45 Demo Script

Target runtime: 2 minutes 45 seconds. Use the deployed judge environment and PayPal Sandbox buyer credentials. Keep the browser zoom and sample data ready before recording. Do not show secrets or a live PayPal account.

| Time | Show | Narration |
|---|---|---|
| 0:00–0:15 | Shipment Review landing screen | “ParcelProof AI is a PayPal-connected fulfilment workspace. It links a verified payment to the exact order, packing evidence and a separate human review. Its record checks are not a PayPal eligibility decision.” |
| 0:15–0:45 | New Checkout; select products; PayPal Sandbox approval and return | “The workflow starts with a real PayPal Sandbox checkout. The backend verifies the capture and uses the purchased item lines to create the shipment record.” |
| 0:45–1:10 | Shipment Review and Manifests; show order-derived items and finalized hash | “The manifest is derived from the paid order. The merchant checks the exact items and quantities, then finalizes it. The fingerprint records which manifest version the packing review refers to.” |
| 1:10–1:45 | Packing Station; upload photos; run AI inspection; show result | “The operator uploads real packing photos. Vision AI reports visible item observations and uncertainty against the manifest. It does not approve the shipment, and a sealed-box photo cannot prove the contents inside.” |
| 1:45–2:15 | AI Inspections; inspect photos and enter reviewer label/notes; approve or request correction | “A human reviews the original photos and AI observations and records a separate decision. The latest inspection and its review history remain retrievable.” |
| 2:15–2:35 | Show Shipment Record Checks and tracking section with gate locked | “These checks flag missing or inconsistent merchant-entered data; they do not fetch carrier events. The PayPal tracking write gate stays locked in this demo.” |
| 2:35–2:45 | Return to overview / product name | “ParcelProof AI keeps payment, order, packing and review records together. Carrier event integration is a remaining step, and PayPal makes its own Seller Protection decisions.” |

## Recording notes

- If the live PayPal Sandbox flow is slow, record a separate successful run and edit only to remove idle waiting; do not fake or stage a payment result.
- Use an inspection result that actually completed in the hosted deployment. Do not present mock AI output, a local-only run or an AI_FAILED attempt as a successful live inspection.
- Do not record the video as a complete end-to-end workflow until the hosted AI inspection, durable photo retrieval and human-review decision have actually passed.
- Show the human decision as a separate action from AI analysis.
- Explain that Shipment Record Checks use entered data and text heuristics; no carrier event feed is connected yet.
- Do not enable PayPal tracking submission just to make the screen look complete.
- If a step fails during recording, fix the environment and record again instead of narrating a success that did not happen.
