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

## Deploy to Render

A single Docker service serves both the built React frontend and FastAPI API from one public URL. The repository includes `Dockerfile` and `render.yaml`; Render reads these through a Blueprint.

1. Sign in to [Render](https://render.com/).
2. Choose **New + → Blueprint** and connect the existing `BasutkarSony/ParcelProof-AI` repository.
3. Review the `parcelproof-ai` service and its paid plan and persistent-disk charges before confirming. Do not approve deployment unless you accept the recurring cost.
4. Enter the PayPal Sandbox Client ID, PayPal Sandbox Secret and Gemini API key when Render prompts for them.
5. After deployment, optionally add `OPENAI_API_KEY` in the service's Environment page to enable automatic vision fallback.
6. Open the Render service URL and confirm `/health` returns `{"status":"ok"}`.

### Hosting and storage

The Blueprint uses the Singapore region and a Starter web service with a 1 GB persistent disk. The disk stores the SQLite database and uploaded inspection photos under `/var/data`, so they survive deploys and restarts.

Render currently lists the Starter web service at approximately **$7/month**, with SSD storage at approximately **$0.25/GB/month**. The 1 GB disk therefore adds roughly $0.25/month. Confirm the amount shown in your Render account before approving the Blueprint. Render's free web services do not support persistent disks and lose local filesystem changes when they restart or redeploy, so the included persistent-storage configuration is deliberately paid.

- [Render Blueprint guide](https://render.com/docs/infrastructure-as-code)
- [Render pricing](https://render.com/pricing)
- [Render persistent disks](https://render.com/docs/disks)

### Deployment environment variables

The Blueprint prompts for these secrets instead of storing them in Git:

- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `GEMINI_API_KEY`
- `PARCELPROOF_DEMO_USERNAME`
- `PARCELPROOF_DEMO_PASSWORD`

The deployed app requires HTTP Basic Authentication. Choose a demo username and a strong, unique password during the Render setup, then share the access details only with intended judges/testers. The `/health` endpoint remains public for Render health checks. Local development leaves demo authentication disabled unless credentials are configured.


Optional:

- `OPENAI_API_KEY` — enables fallback when Gemini is unavailable.
- `OPENAI_VISION_MODEL` — defaults to `gpt-4o-mini`.

The Blueprint automatically sets `FRONTEND_URL` from Render's public service URL and keeps `PAYPAL_TRACKING_SUBMISSION_ENABLED=false`. Public app pages, buyer/order APIs, and persisted evidence photos are protected by the shared demo password.

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

- Evidence analysis uses deterministic rules and text-pattern heuristics; it is not generative AI inference.
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
