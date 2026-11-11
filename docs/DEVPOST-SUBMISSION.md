# Devpost submission — ParcelProof AI

Use the copy below as the basis for the PayPal AI Hackathon form. Add the public YouTube URL after the final recording is uploaded.

## Project name

ParcelProof AI

## Tagline

Check the pack against what the buyer paid for.

## Short description

ParcelProof AI connects a verified PayPal Sandbox payment to the exact items a merchant needs to pack. Before sealing the parcel, the merchant photographs the visible goods, Gemini compares them with the order-derived manifest and saved product reference, and the merchant records the final packing decision. Each inspection remains linked to the manifest and its photo evidence.

## Project description

### The problem

Small online merchants and owner-operated shops often fulfil physical orders by manually picking, checking and packing products. The payment record, item list and packing check can be separate from the photograph or note taken before sealing. A wrong variant or missing item may only be discovered after dispatch, when the merchant has to reconstruct what was paid for and what was checked.

ParcelProof focuses on one specific intervention: checking the visible goods against the paid order before the parcel is sealed.

The initial target user is a small online merchant or a small fulfilment team that manually packs physical orders. This is an initial product hypothesis, not a claim based on a completed customer study.

### What ParcelProof does

1. A buyer checks out through PayPal Sandbox.
2. The backend verifies the completed PayPal order and capture, including amount and currency.
3. The purchased order lines and quantities create a shipment-linked packing manifest.
4. The merchant reviews and finalizes the manifest. Its declared contents receive a SHA-256 fingerprint.
5. Before sealing, the merchant uploads a clear overview photograph of the packed items.
6. Gemini Vision compares the visible goods with the finalized manifest and the saved product identity profile, returning structured observations.
7. The merchant reviews the original photo, the saved catalogue reference and the AI observations, then records APPROVE, NEEDS_CORRECTION or REJECT. AI never makes the final shipment decision.

Product setup separates the short description shown to a buyer from the private product identity details used for packing checks. One saved reference photo can be reused for future orders of the same SKU.

### Why PayPal matters

PayPal is central to the workflow. The verified Sandbox payment and purchased order lines supply the source of truth for the packing manifest. The manifest is derived from the items the buyer paid for. The order and capture references remain linked to the shipment and its evidence record.

### How AI is used

The hosted prototype uses Google Gemini Vision, model gemini-3.5-flash-lite, to inspect packing photographs against the order-derived manifest and saved product identity context. The model returns observations such as MATCH, POSSIBLE_MISSING, POSSIBLE_EXTRA or UNCERTAIN, with confidence and visible evidence.

AI output is fallible and does not approve or reject a shipment. The merchant must review the photographs and make a separate decision.

The current demo includes an important example: Gemini returned MATCH for a photographed ceramic mug and the expected quantity. The merchant compared the photo with the saved catalogue design and recorded NEEDS_CORRECTION because the exact product variant was not verified. The shipment remained on hold. The example shows why the AI result and the human decision are stored separately.

### Evidence and traceability

ParcelProof stores:
- the finalized manifest's SHA-256 fingerprint;
- SHA-256 digests and records for uploaded packing photographs;
- the AI inspection output and model used;
- a separate merchant-review decision linked to that inspection.

This is a traceable application evidence record. It is not a blockchain, does not establish the contents of a sealed package and does not prove carrier dispatch or delivery.

### Potential impact

The intended benefit is to help a merchant notice visible wrong-item, missing-item or quantity discrepancies before dispatch, and to preserve a consistent record of what was ordered, photographed and reviewed. The project has not yet measured error reduction, return reduction or time savings with real merchants.

### What makes the approach useful

The workflow starts with the paid PayPal order, not an independent checklist. That links the buyer's purchased items to the merchant's packing check. AI provides a second look at visible evidence, while the merchant retains control over the decision. A correction request keeps the shipment on hold.

### Tools and technologies

- PayPal Developer Platform — PayPal Orders v2 Sandbox checkout and capture.
- Google Gemini API — multimodal packing-photo inspection and structured observations.
- Python and FastAPI — backend payment verification, manifest, inspection and review services.
- React and Vite — web interface.
- Supabase Postgres and private Storage — hosted records and evidence files.
- Render — hosted demo.

### What we learned / next steps

The prototype demonstrated that the payment, manifest, photo, AI result and human decision can be tied together. It also exposed an important limitation: a model can identify the general object and quantity while missing a design or variant difference. Better product-identity comparison, simpler correction capture, merchant usability testing and carrier-event integration are future work.

## Submission links

- Live demo: https://parcelproof-ai-058h.onrender.com
- Public source repository: https://github.com/BasutkarSony/ParcelProof-AI
- License: MIT (repository includes LICENSE)
- Demo video: **Add the public YouTube URL after recording.**

## Judge testing instructions

The hosted demo opens at a branded merchant sign-in screen. Use the shared demo credentials:
- Username: `merchant.demo`
- Password: `PackSafe#2026`

This is one shared demonstration account, not separate merchant accounts. Successful sign-in creates a 12-hour HttpOnly browser session.

Judges can use the existing synthetic demonstration order to inspect the order, finalized manifest, packing inspection, original photo and saved human decision. A new checkout is optional. If testing a fresh payment, use a PayPal Sandbox buyer account only; never use a live PayPal account.

The hosted service uses Render's Free plan and may take time to wake after inactivity. The demo uses synthetic records. Do not enter real customer or payment information.

## Accuracy and limitations to retain in the submission

- PayPal integration is Sandbox, not production.
- AI suggestions are not guaranteed to be correct and require a human decision.
- A packing photo cannot verify the contents of a sealed parcel.
- Product similarity is not proof of an exact SKU or variant.
- No carrier event feed is connected.
- PayPal tracking writes remain disabled.
- ParcelProof does not calculate or guarantee PayPal Seller Protection eligibility.
- The prototype has one shared demo login, not individual merchant accounts or role-based tenant separation.
