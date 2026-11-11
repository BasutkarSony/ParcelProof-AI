# ParcelProof AI — quick merchant guide

This is a hackathon prototype using PayPal Sandbox and synthetic demonstration data. It is not a production shipping platform.

## What it does

ParcelProof connects a verified PayPal payment to the items a merchant needs to pack. The merchant photographs the visible goods before sealing, reviews Gemini's observations and records the final decision.

## Open the demo

Go to https://parcelproof-ai-058h.onrender.com. The app opens directly into the workspace; no browser password prompt or separate app login is required.

Use only synthetic demo data. Do not enter real customer, address or payment information. The hosted service runs on Render Free and may take time to wake after inactivity.

## Normal order flow

1. **Orders:** choose an existing paid order and continue to its shipment.
2. **Products:** set up each SKU once. Keep the short buyer description separate from the private packing-verification details. Add one clear reference image if useful. The reference can be reused for future orders.
3. **Manifest:** check the item descriptions and quantities derived from the paid order. Finalize only when they are correct. The finalized manifest receives a SHA-256 fingerprint.
4. **Packing:** before sealing, take one clear overview photo showing all items. Add another only for a separate item, useful label or visible issue. One to five photos are supported.
5. **AI inspection:** run the inspection. The hosted demo currently uses Gemini 3.5 Flash Lite. The model compares visible evidence with the manifest and product reference. Its result is advisory.
6. **Human review:** compare the original photo, catalogue reference and AI observations. Then record one decision:
   - **Approve** when the visible evidence supports the packing record.
   - **Request correction** when the product, variant, quantity or photo needs to be corrected. The shipment stays on hold.
   - **Reject** when the inspection/evidence should not be accepted.

A model result of MATCH is not automatic approval. In the current mug example, the model returned MATCH for the visible mug and quantity, but the merchant requested correction because the design/variant was not verified.

## What the evidence record contains

The app stores the finalized manifest fingerprint, photo SHA-256 digests, AI result and a separate merchant decision. This is a traceable application record, not a blockchain and not proof of sealed parcel contents or carrier delivery.

## Important limitations

- PayPal payments use Sandbox only.
- The AI can be wrong and must be reviewed by a person.
- Visual similarity does not prove an exact SKU or variant.
- A photo cannot verify the contents of a sealed parcel.
- No carrier event feed is connected.
- PayPal tracking writes are disabled.
- There are no individual merchant accounts or role-based access controls.
- Do not use this prototype as the sole basis for a real-world shipping or dispute decision.
