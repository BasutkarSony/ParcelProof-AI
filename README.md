# ParcelProof AI

**Check the pack against what the buyer paid for.**

ParcelProof AI is a PayPal-connected packing check for small online merchants who prepare physical orders themselves. It links a completed PayPal payment to the items to be packed, compares a pre-seal photo with the order and saved product reference, and lets the merchant record the final decision.

**[Open the live demo](https://parcelproof-ai-058h.onrender.com)** · **[View the source code](https://github.com/BasutkarSony/ParcelProof-AI)** · **[Read the demo script](docs/DEMO-SCRIPT.md)** · **[Devpost submission notes](docs/DEVPOST-SUBMISSION.md)**

The hosted demo opens at a branded merchant sign-in screen. It uses PayPal Sandbox and synthetic demonstration records. Do not enter real customer or payment data.

## The problem

For a small merchant, taking payment is only the beginning of fulfilment. Someone still has to pick the right product and variant, check the quantity, pack it and seal the parcel. These checks can happen away from the original order record. A wrong or incomplete item may only be noticed after dispatch.

ParcelProof focuses on one practical moment: **check the visible contents against the paid order before the parcel is sealed.**

The initial target user is an owner-operated online shop or a small team that manually fulfils physical orders. This customer profile is a product hypothesis; it has not yet been validated through formal customer interviews.

## How it works

1. **A buyer pays through PayPal Sandbox.** The backend verifies the completed PayPal order and capture, including the amount and currency.
2. **The paid items become the packing list.** ParcelProof creates a shipment and a draft manifest from the exact purchased order lines and quantities.
3. **The merchant confirms the manifest.** Finalizing it creates a SHA-256 fingerprint of the declared contents.
4. **The merchant takes a packing photo.** One clear overview photo before sealing is usually enough. A saved product reference image can be reused; it is not counted as a packed item.
5. **Gemini examines the visible evidence.** It compares the photo with the finalized manifest and the private product identity details, then returns structured observations.
6. **The merchant decides.** The reviewer can approve the packing review, request correction or reject the inspection. The AI never approves a shipment. A correction request keeps the shipment on hold until new evidence is inspected.

## Why PayPal is central

PayPal is not just a payment button in this project. The verified PayPal Sandbox order is the source of the purchased line items. Those exact items and quantities are used to create the shipment's packing manifest. The order and capture references remain linked to the shipment and subsequent inspection record.

Without the verified paid order, ParcelProof has no trusted order-derived packing list to compare with the photograph.

## AI, human review and the evidence record

The hosted demo currently uses **Google Gemini Vision, model gemini-3.5-flash-lite**. It receives the packing photograph, the finalized manifest and the saved product identity context. It reports what appears visible and can identify possible missing items, extra items, matches or uncertainty.

AI output is fallible. In the latest demonstrated mug inspection, Gemini reported a match for one visible mug and the expected quantity. The merchant compared the photograph with the saved catalogue design and recorded **NEEDS_CORRECTION** because the exact variant was not verified. The shipment remained on hold. This is intentional: a model result is an observation, not the merchant's decision.

ParcelProof keeps a traceable evidence record:
- a SHA-256 fingerprint for the finalized manifest;
- SHA-256 digests and stored records for uploaded packing photographs;
- the inspection result and model information;
- a separate human-review decision linked to the inspection.

This is an application-level evidence trail, **not a blockchain or a guarantee that a photograph proves the contents of a sealed parcel**.

## Current hosted demo

Snapshot checked on **11 November 2026**:

| Persisted demo data | Count |
|---|---:|
| Orders | 2 |
| Shipments | 2 |
| Finalized manifests | 2 |
| Inspection attempts | 7 |
| Packing photo records | 10 |
| Human-review records | 3 |

The latest mug inspection used one photo and Gemini 3.5 Flash Lite. The app displayed 9.1 seconds of server processing for that run. The AI result was MATCH; the merchant separately recorded NEEDS_CORRECTION. Earlier failed provider attempts remain in the history and are not approvable.

These are demonstration records and observed results, not a performance guarantee or measured reduction in packing errors.

## Try the demo

**https://parcelproof-ai-058h.onrender.com**

- Sign in with the shared demo account:
  - Username: `merchant.demo`
  - Password: `PackSafe#2026`
- Open **Orders**, choose an existing demonstration order and continue to its shipment.
- Review its manifest, packing inspection and saved merchant decision.
- **Test checkout** is a separate PayPal Sandbox tool. A fresh checkout requires a PayPal Sandbox buyer account; do not use a live PayPal account.
- The service runs on Render's Free plan and can take time to wake after inactivity.
- Use only synthetic data. The public demo does not provide individual merchant accounts or tenant separation.

## Product catalogue: buyer copy and private packing details

The product catalogue deliberately stores two different descriptions:
- a short shop description displayed to a buyer at checkout;
- private product identity details used in the packing manifest and AI comparison.

Reference photographs are saved once per SKU and reused. GTIN is optional metadata entered by the merchant; the current prototype validates its check digit but does not scan barcode bars.

## Built with

- **PayPal Developer Platform:** PayPal Orders v2 Sandbox checkout and capture.
- **Google Gemini API:** multimodal packing-photo inspection with structured output.
- **Python / FastAPI:** payment verification, manifests, inspections and review APIs.
- **React / Vite:** merchant and checkout interface.
- **Supabase Postgres and private Storage:** hosted records and evidence files.
- **Render:** hosted application.

## Run locally

### Requirements

- Python 3.11+
- Node.js 22+
- Git

### Backend

~~~bash
git clone https://github.com/BasutkarSony/ParcelProof-AI.git
cd ParcelProof-AI/backend
python -m venv .venv
~~~

On Windows, activate the environment with:

~~~powershell
.venv\Scripts\Activate.ps1
~~~

Then install and configure:

~~~bash
python -m pip install -r requirements.txt
~~~

Copy .env.example to .env. Add a PayPal Sandbox REST app's PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET, plus a Google AI Studio GEMINI_API_KEY. The example uses Gemini as the inspection provider. Keep PAYPAL_TRACKING_SUBMISSION_ENABLED=false.

Start the API from the backend directory:

~~~bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
~~~

Local development uses SQLite unless DATABASE_URL is configured. Supabase credentials are only needed when using the hosted Postgres/Storage setup.

### Frontend

Open a second terminal:

~~~bash
cd frontend
npm ci
npm run dev
~~~

Open the local Vite URL shown in the terminal (normally http://localhost:5173).

Never commit .env files, API keys, PayPal secrets or database credentials.

## Tests

Backend:

~~~bash
cd backend
python -m unittest discover -s tests -v
~~~

Frontend:

~~~bash
cd frontend
npm ci
npm test
npm run lint
npm run build
~~~

GitHub Actions also runs backend tests, PostgreSQL integration tests, frontend tests/lint/build and a Docker image build.

## What this prototype does not claim

- It does not prove what is inside a sealed parcel.
- It does not guarantee an exact SKU or variant from visual similarity alone.
- It does not connect to carrier event feeds or independently prove dispatch/delivery.
- PayPal tracking writes are disabled in the hosted demo.
- It does not calculate PayPal Seller Protection eligibility or guarantee a dispute outcome.
- The hosted payment flow is PayPal Sandbox, not production payment processing.
- The hosted demo has one shared merchant login, not individual merchant accounts, role-based access or live-store integration.
- No measured reduction in errors, returns or support cost has been collected yet.

The export-document reconciliation code is outside the primary packing-verification demonstration and is not part of the submission walkthrough.

## License

MIT. See LICENSE.
