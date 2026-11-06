# ParcelProof AI

> **Canonical PayPal AI Hackathon repository.** Use this repository and its hosted demo for the current submission. The older [ShipProof-AI repository](https://github.com/BasutkarSony/ShipProof-AI) is a historical snapshot and is not the current source or deployment.

### PayPal-connected AI packing verification for small online merchants

**Catch avoidable pick-and-pack mistakes before parcels leave your workspace.**

ParcelProof AI links a verified PayPal payment to the exact purchased items, a finalized packing manifest, pre-seal packing photographs, AI observations and a separate human review decision. Its MVP focuses on packing accuracy and a traceable record tied to the paid order.

Built for the **PayPal AI Hackathon 2026**.

![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)
![React](https://img.shields.io/badge/React-Vite-61DAFB?logo=react&logoColor=black)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white)
![PayPal](https://img.shields.io/badge/Payments-PayPal%20Sandbox-003087?logo=paypal&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

## The problem

Small online merchants often handle payment, order lines, warehouse picking and packing checks in separate tools. When an item is missing or the wrong item is packed, the merchant has to reconstruct what the buyer paid for, what the packing list declared, what was visible before sealing, and who reviewed it.

**ParcelProof AI connects the paid order to a finalized packing manifest, packing photographs, AI observations and a human decision.** The goal is to catch visible pick-and-pack discrepancies before dispatch and keep one traceable operational record for customer support.

## What it does

| Capability | What it provides |
|---|---|
| Buyer checkout | A small storefront for physical merchandise with recipient and delivery details. |
| PayPal payment | PayPal Sandbox Orders v2 checkout with server-priced item lines and verified capture. |
| Order-derived manifest | Creates a packing manifest from the exact items and quantities in the paid order. |
| Packing inspection | Gemini Vision compares visible packing photos with the finalized manifest and reports observations/uncertainty; the merchant makes the decision. |
| Evidence record | Stores photo hashes and the finalized manifest fingerprint with each inspection. |
| Human review | Records an explicit merchant decision separately from model observations. |
| PayPal tracking | Prepares and submits a tracking update to the matching Orders v2 order and capture after all required checks. |

## Workflow

1. Buyer selects merchandise, enters recipient details and approves a PayPal Sandbox payment.
2. Backend verifies the completed PayPal capture, amount, currency and order linkage.
3. ParcelProof creates a persistent shipment and a draft manifest from the purchased items.
4. Merchant reviews and finalizes the manifest; its contents are fingerprinted.
5. Before sealing the parcel, the merchant uploads up to five clear packing photographs showing the actual items.
6. Gemini Vision compares visible items with the finalized manifest and returns structured observations and uncertainty. A 503 receives one bounded retry; a 429 is not immediately retried. An optional OpenAI fallback can run when configured.
7. The model never approves or rejects a shipment. A merchant reviews the original photos and model observations and records APPROVED, REJECTED or NEEDS_CORRECTION.
8. The approved packing record remains linked to the paid order and manifest. A guarded PayPal tracking action is available in the backend, but tracking writes remain disabled by default in the hosted demo.

## AI and evidence safeguards

- Gemini `gemini-3.8-flash` is the primary vision provider; Google documents this stable model as accepting image inputs and structured outputs.
- HTTP 503 temporary service failures receive one bounded retry.
- HTTP 429 rate/quota errors are not automatically retried. The UI tells the operator to wait for the applicable rate window or quota reset before trying again.
- If Gemini remains unavailable, the backend uses OpenAI Vision when `OPENAI_API_KEY` is configured.
- Both providers use the same manifest prompt and server-side response validation.
- The fallback receives every uploaded photo, up to the existing five-photo limit.
- Provider and model names are recorded with each inspection.
- Every inspection remains pending human review until a merchant decision is recorded.
- The app distinguishes what is visible in photos from what is not visible. A sealed parcel's contents cannot be verified from its exterior.
- Deterministic shipment checks use rules and text-pattern heuristics. They are advisory, not a PayPal eligibility decision.

Neither vision model is guaranteed to be error-free or independently auditable. A photo cannot prove the contents of a sealed parcel. The current MVP does not fetch carrier events, so merchant-entered tracking notes are not carrier proof. ParcelProof AI does not calculate Seller Protection eligibility or guarantee a dispute outcome; PayPal makes those decisions.

## Merchant user manual

Step-by-step instructions for the current prototype are in [docs/MERCHANT-USER-MANUAL.md](docs/MERCHANT-USER-MANUAL.md). The [release gate](docs/RELEASE-GATE.md) lists the end-to-end checks required before submission, and the [demo script](docs/DEMO-SCRIPT.md) provides a sub-three-minute walkthrough.

## Run locally

### Prerequisites

- Python 3.11+
- Node.js 22.22.2+ and npm
- Git

### 1. Clone the repository

```cmd
git clone https://github.com/BasutkarSony/ParcelProof-AI.git
cd ParcelProof-AI
```

### 2. Configure the backend

```cmd
cd backend
python -m venv .venv
.venv\Scripts\activate.bat
python -m pip install -r requirements.txt
copy .env.example .env
```

Edit `backend/.env` and add:

- `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` from a PayPal Sandbox REST app.
- `GEMINI_API_KEY` for the primary packing-photo provider.
- `OPENAI_API_KEY` optionally, to enable the vision fallback.

Keep `PAYPAL_TRACKING_SUBMISSION_ENABLED=false`. Never commit the real `.env` file or share its credentials.

Start the backend:

```cmd
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Backend API: `http://127.0.0.1:8000`

### 3. Start the frontend

Open a second terminal at the repository root:

```cmd
cd frontend
npm ci
npm run dev
```

Frontend: `http://localhost:5173`

The local Vite app uses `http://127.0.0.1:8000` for API requests. In production, the frontend uses the same origin as the FastAPI service.

## Repository

The submission repository is already published at [github.com/BasutkarSony/ParcelProof-AI](https://github.com/BasutkarSony/ParcelProof-AI). Clone it using the instructions in **Run locally**. The legacy repository-creation script is not part of the current setup or deployment process.

## Deploy to Render — free tier

The included Blueprint uses a **Free Render web service** and Supabase for durable PostgreSQL data and private photo storage. It does not attach a Render disk and does not create a paid Render database.

1. In Render, choose **New + → Blueprint** and connect the existing `BasutkarSony/ParcelProof-AI` repository.
2. Review the `parcelproof-ai` service and confirm its compute plan is **Free**.
3. Configure the secrets listed below. Render prompts for `sync: false` values when creating a new Blueprint. When updating an existing service, add any missing values manually in **Environment**.
4. Deploy and check that `/health` returns `{"status":"ok"}`.

### Required Render environment variables

Set these values privately in Render. Never commit them to Git or share them in chat.

| Variable | What to enter |
|---|---|
| `DATABASE_URL` | Supabase **Session Pooler** connection string, including the database password. Keep the password private. |
| `SUPABASE_SECRET_KEY` | Supabase server-side API secret key (format `sb_secret_...`). |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase legacy `service_role` JWT. The private Storage REST API needs this as its Bearer token when the new `sb_secret_...` key is used. |
| `PAYPAL_CLIENT_ID` | PayPal Sandbox REST app Client ID. |
| `PAYPAL_CLIENT_SECRET` | PayPal Sandbox REST app Secret. |
| `GEMINI_API_KEY` | Google AI Studio API key for packing-photo inspection. |
| `PARCELPROOF_DEMO_USERNAME` | Demo login username. |
| `PARCELPROOF_DEMO_PASSWORD` | A strong, unique demo password. |

The Blueprint sets `SUPABASE_URL`, `SUPABASE_STORAGE_BUCKET=inspection-photos`, `DATABASE_SSLMODE=require`, `PARCELPROOF_REQUIRE_DATABASE=true`, shared demo authentication and `PAYPAL_TRACKING_SUBMISSION_ENABLED=false`. It also sets `FRONTEND_URL` from the Render service URL. `OPENAI_API_KEY` is optional and enables the fallback vision provider.

**Important:** the hosted app fails startup if `DATABASE_URL` is missing; this prevents silently using an ephemeral SQLite file on Render Free. Local development continues to use SQLite unless `DATABASE_URL` is set.

### Free-tier behaviour and limitations

- Render Free web services spin down after 15 minutes without inbound traffic. The next request can take about a minute while the service starts.
- Render Free services have ephemeral filesystems and cannot attach persistent disks. ParcelProof therefore stores database records in Supabase Postgres and inspection photos in the private Supabase Storage bucket.
- Supabase Free projects can pause after a week of very low database activity. A few real requests a day are usually enough to avoid pausing, but that is not guaranteed.
- Render includes monthly usage allowances; outbound bandwidth beyond the included amount can incur additional charges. Monitor usage in the Render dashboard.
- These free tiers are suitable for a hackathon demo, not a production reliability guarantee.

References: [Render Free instances](https://render.com/docs/free), [Render Blueprint environment variables](https://render.com/docs/blueprint-spec), [Supabase project pausing](https://supabase.com/docs/guides/platform/free-project-pausing).

### What has and has not been verified

At the 6 November 2026 verification, the current application code commit `635282cde69cebcc929f72390ed970e005d80ea9` passed [GitHub Actions run 42241783179](https://github.com/BasutkarSony/ParcelProof-AI/actions/runs/42241783179): 238 backend tests discovered (235 passed; 3 PostgreSQL-only tests run separately), all 3 PostgreSQL integration tests, frontend tests, Oxlint, Vite production build and Docker image build. The existing Render Free service deployed that application code and its logs showed `/health` HTTP 200. See [docs/QA-STATUS.md](docs/QA-STATUS.md) for the detailed verification snapshot.

A real PayPal Sandbox checkout was completed through the hosted app. The backend verified/captured payment and created one persisted order, one linked shipment and one finalized order-derived manifest in Supabase. The live database snapshot contains 1 order, 1 shipment and 1 manifest, but **0 packing inspections, 0 inspection photos and 0 human-review decisions**.

A successful live Gemini packing-photo inspection has not yet been recorded. Previous hosted attempts returned 503/429 provider errors. The code now preserves uploaded evidence and records a non-approvable `AI_FAILED` attempt on provider failure; the recovery paths are covered by automated regression tests, but still need fresh hosted Storage verification. The optional `OPENAI_API_KEY` fallback is not configured.

PayPal OAuth was verified in Sandbox and the tracking write gate displayed as locked. No tracking write has been performed; `PAYPAL_TRACKING_SUBMISSION_ENABLED=false` remains the intended setting. The prototype does not fetch carrier events, so merchant-entered tracking or delivery notes are not independently carrier-verified.

The deterministic shipment analyzer reports shipment-record completeness only. It does not calculate Seller Protection eligibility. PayPal makes its own decision under the requirements applicable to the seller, country, account, transaction and claim.

## Transaction-to-document reconciliation

The first reconciliation API accepts normalized document fields and compares them against the paid PayPal order and finalized shipment manifest:

`POST /api/shipments/{shipment_order_id}/reconcile`

Example request body:

```json
{
  "document": {
    "document_type": "COMMERCIAL_INVOICE",
    "document_number": "INV-1001",
    "currency": "USD",
    "total_amount": "25.00",
    "recipient_name": "Alex Buyer",
    "recipient_address": {
      "address_line_1": "123 River Road",
      "city": "Berlin",
      "postal_code": "10115",
      "country_code": "DE"
    },
    "items": [
      {
        "sku": "SKU-1",
        "description": "Handmade Ceramic Cup",
        "quantity": 2,
        "unit_amount": "12.50"
      }
    ]
  }
}
```

The engine checks currency, invoice total, recipient details, item identity and quantities, and the source links between manifest lines and the exact PayPal order items. It returns source-referenced checks with `MATCH`, `MISMATCH`, `NOT_CHECKED` or `NOT_APPLICABLE` statuses. A missing value is never counted as a match. Invoice-total differences require review because freight, tax, duties or discounts can make unlike totals differ.

This endpoint currently accepts **normalized structured fields**. PDF/image upload, extraction, persistence of reconciliation runs and the merchant-facing reconciliation screen are subsequent implementation stages; the endpoint does not claim to extract documents yet.

The result is an operational consistency check, not customs clearance, carrier proof, export-compliance advice or PayPal Seller Protection eligibility.

## Testing

Backend tests:

```cmd
cd backend
python -m unittest discover -s tests -v
```

Frontend tests, lint and production build:

```cmd
cd frontend
npm ci
npm test
npm run lint
npm run build
```

GitHub Actions runs backend unit tests, frontend tests, frontend lint and the production build on pushes to `main` and on pull requests targeting `main`. Render is configured to deploy after repository checks pass.

## PayPal safety

Checkout and capture use PayPal Orders v2. Tracking submission uses:

`POST /v2/checkout/orders/{id}/track`

The backend uses the saved PayPal order ID, completed capture ID and purchased item lines from the stored checkout record. It rejects sample shipments, unpaid orders, unfinalized manifests and shipments whose latest packing inspection has not been approved by a human reviewer.

Tracking writes are disabled by default:

```env
PAYPAL_TRACKING_SUBMISSION_ENABLED=false
```

Do not enable this setting until the recipient, Sandbox payment and human review have been verified. An OAuth connection check alone does not submit tracking.

Official documentation:

- [PayPal Orders v2 Add Tracking API](https://developer.paypal.com/api/tracking/track-orders/use/)
- [PayPal Supported Carriers](https://developer.paypal.com/track-orders/carriers/)

## Important limitations

ParcelProof AI is a hackathon prototype, not an official PayPal product.

- Shipment evidence checks use deterministic rules and text-pattern heuristics. Packing-photo observations use Gemini Vision, with an optional OpenAI Vision fallback.
- Vision-model outputs can be wrong and require human review.
- A photograph cannot prove the contents of a sealed package.
- The hosted demo uses one shared password, not individual merchant accounts or role-based access control; reviewer labels are still self-entered demo labels, not verified identities.
- Text entered by a merchant is not independent proof from a carrier.
- Evidence-quality results are advisory and do not predict dispute outcomes or guarantee Seller Protection.
- The primary MVP outcome is packing-error prevention and traceability. PayPal's India Seller Protection terms list claims that the item sent was not what was ordered ("Significantly Not As Described") as ineligible for Seller Protection; ParcelProof is not a claim-adjudication tool. See [PayPal India Seller Protection](https://www.paypal.com/in/legalhub/paypal/seller-protection).
- Sample shipment records are for demonstration and testing.
- PayPal Sandbox authentication does not prove that a real Sandbox tracking update has succeeded. A deliberate tracking test remains necessary.

## Project structure

```text
ParcelProof-AI/
├── .github/workflows/ci.yml
├── backend/
│   ├── app/
│   ├── data/sample_orders.json
│   ├── migrations/
│   ├── tests/
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── public/
│   ├── src/
│   ├── package.json
│   └── package-lock.json
├── docs/
│   ├── MERCHANT-USER-MANUAL.md
│   ├── RELEASE-GATE.md
│   └── DEMO-SCRIPT.md
├── Dockerfile
├── render.yaml
├── .dockerignore
├── .gitignore
├── LICENSE
└── README.md
```

## License

MIT. See [LICENSE](LICENSE).
