# ParcelProof AI

### PayPal-connected order fulfilment and shipment evidence

**From a verified Sandbox payment to a reviewed packing record.**

ParcelProof AI is a merchant fulfilment workspace that links PayPal Sandbox checkout to the exact purchased items, a finalized packing manifest, AI-assisted photo observations, a human review decision, and a guarded PayPal tracking workflow.

Built for the **PayPal AI Hackathon 2026**.

![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)
![React](https://img.shields.io/badge/React-Vite-61DAFB?logo=react&logoColor=black)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white)
![PayPal](https://img.shields.io/badge/Payments-PayPal%20Sandbox-003087?logo=paypal&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

## The problem

For small online merchants, payment details, product lists, packing checks and shipment tracking can sit in separate tools. When a buyer reports a missing or incorrect item, the merchant may have to reconstruct what was purchased, packed and shipped.

**ParcelProof AI connects those steps to one paid order and shipment record.**

## What it does

| Capability | What it provides |
|---|---|
| Buyer checkout | A small storefront for physical merchandise with recipient and delivery details. |
| PayPal payment | PayPal Sandbox Orders v2 checkout with server-priced item lines and verified capture. |
| Order-derived manifest | Creates a packing manifest from the exact items and quantities in the paid order. |
| Packing inspection | Gemini Vision first, with one bounded retry and an optional OpenAI Vision fallback. |
| Evidence record | Stores photo hashes and the finalized manifest fingerprint with each inspection. |
| Human review | Records an explicit merchant decision separately from model observations. |
| PayPal tracking | Prepares and submits a tracking update to the matching Orders v2 order and capture after all required checks. |

## Workflow

1. Buyer selects merchandise, enters recipient details and approves a PayPal Sandbox payment.
2. Backend verifies the completed PayPal capture, amount, currency and order linkage.
3. ParcelProof creates a persistent shipment and a draft manifest from the purchased items.
4. Merchant reviews and finalizes the manifest; its contents are fingerprinted.
5. Merchant uploads up to five packing photographs.
6. Gemini Vision inspects the photos. After a temporary Gemini outage, an optional OpenAI Vision fallback can run using all uploaded photos.
7. The model returns structured observations and uncertainty. It never approves or rejects a shipment.
8. A merchant reviews the evidence and records APPROVED, REJECTED or NEEDS_CORRECTION.
9. PayPal tracking submission remains blocked until the stored payment, finalized manifest and latest human approval satisfy the backend checks.

## AI and evidence safeguards

- Gemini is the primary vision provider.
- A single short retry is attempted for common temporary Gemini service errors.
- If Gemini remains unavailable, the backend uses OpenAI Vision when `OPENAI_API_KEY` is configured.
- Both providers use the same manifest prompt and server-side response validation.
- The fallback receives every uploaded photo, up to the existing five-photo limit.
- Provider and model names are recorded with each inspection.
- Every inspection remains pending human review until a merchant decision is recorded.
- The app distinguishes what is visible in photos from what is not visible. A sealed parcel's contents cannot be verified from its exterior.
- Deterministic shipment checks use rules and text-pattern heuristics. They are advisory, not a PayPal eligibility decision.

Neither vision model is guaranteed to be error-free or independently auditable. ParcelProof AI does not guarantee PayPal Seller Protection. PayPal makes its own decisions.

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

As of 6 November 2026, the existing Render Free service deploys `main` only after repository checks pass. See [docs/QA-STATUS.md](docs/QA-STATUS.md) for the latest verified commit, CI run and Render deployment. At the last verification, backend unit tests, PostgreSQL integration tests, frontend tests/lint/build and the Docker image build all passed; Render application logs showed repeated `/health` HTTP 200 responses.

A real PayPal Sandbox checkout was completed through the hosted app. The backend verified/captured the payment and created one persisted order, one linked shipment and one finalized order-derived manifest in Supabase. The current Supabase snapshot contains 1 order, 1 shipment and 1 finalized manifest, but **0 packing inspections, 0 inspection photos and 0 human-review decisions**.

The deployed app has not yet completed a successful live Gemini packing-photo inspection. A previous attempt returned temporary Gemini 503/429 errors. The code now preserves uploaded photo evidence and records a non-approvable `AI_FAILED` attempt on provider failure; this recovery behavior passes automated regression tests, but the same failure/retrieval path still needs a fresh hosted verification. The optional `OPENAI_API_KEY` fallback is not configured.

PayPal OAuth was verified in Sandbox and displayed the tracking write gate as locked. No PayPal tracking write has been performed; `PAYPAL_TRACKING_SUBMISSION_ENABLED=false` remains the intended setting. The prototype does not currently fetch carrier events, so merchant-entered tracking or delivery notes are not independently carrier-verified.

The deterministic shipment analyzer now reports operational record completeness only. It does not calculate Seller Protection eligibility. PayPal makes its own eligibility decision under the applicable country, account, transaction and claim rules.

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
