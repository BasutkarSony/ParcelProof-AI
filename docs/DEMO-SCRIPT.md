# ParcelProof AI — 2:45 Demo Script

Target runtime: 2 minutes 45 seconds. Use the deployed judge environment and PayPal Sandbox buyer credentials. Keep the browser zoom and sample data ready before recording. Do not show secrets or a live PayPal account.

| Time | Show | Narration |
|---|---|---|
| 0:00–0:15 | Shipment Review landing screen | “ParcelProof AI is an AI-assisted fulfilment verification workspace for PayPal merchants. It connects a paid order to the packing evidence and the merchant's review.” |
| 0:15–0:45 | New Checkout; select products; PayPal Sandbox approval and return | “The workflow starts with a real PayPal Sandbox checkout. The backend verifies the capture and uses the purchased item lines to create the shipment record.” |
| 0:45–1:10 | Shipment Review and Manifests; show order-derived items and finalized hash | “The manifest is derived from the paid order. The merchant checks the declared items and quantities, then finalizes it. The fingerprint binds the declared manifest content to the inspection record.” |
| 1:10–1:45 | Packing Station; upload photos; run AI inspection; show result | “The operator uploads packing photos. Vision AI reports visible observations and uncertainty. It does not approve the shipment, and it cannot prove the contents of a sealed box.” |
| 1:45–2:15 | AI Inspections; inspect photos and enter reviewer label/notes; approve or request correction | “A human reviews the original photos and AI observations and records a separate decision. The latest inspection and its review history remain retrievable.” |
| 2:15–2:35 | Show tracking section with gate locked; evidence record | “The tracking workflow is guarded by the verified payment, finalized manifest and latest human approval. Tracking writes remain disabled in this demo.” |
| 2:35–2:45 | Return to overview / product name | “ParcelProof AI creates a traceable packing evidence record around a PayPal order. It supplements, but does not replace, carrier tracking or PayPal's own protection decisions.” |

## Recording notes

- If the live PayPal Sandbox flow is slow, record a separate successful run and edit only to remove idle waiting; do not fake or stage a payment result.
- Use an inspection result that actually completed. Do not present mock AI output as a live provider result.
- Show the human decision as a separate action from AI analysis.
- Do not enable PayPal tracking submission just to make the screen look complete.
- If a step fails during recording, fix the environment and record again instead of narrating a success that did not happen.
