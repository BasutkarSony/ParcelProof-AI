# QA status — 11 November 2026

This is a snapshot of the hosted hackathon demo and the latest verified application behavior. It is not a production-readiness declaration.

## Canonical project

- Repository: https://github.com/BasutkarSony/ParcelProof-AI
- Branch: main
- License: MIT (LICENSE is present).
- Hosted demo: https://parcelproof-ai-058h.onrender.com
- Hosting: Render Free web service, Singapore.
- Database and evidence storage: Supabase Postgres and private Storage.

The older ShipProof-AI repository is a historical project snapshot. ParcelProof-AI is the repository connected to the live Render service and current CI.

## Latest verified application revision

- Application commit: 1840a1b763870e3443c701503d455238d9f55e9e.
- GitHub Actions run: [43075205082](https://github.com/BasutkarSony/ParcelProof-AI/actions/runs/43075205082).
- CI result: success.

| Check | Result |
|---|---|
| Backend unit tests | Passed |
| PostgreSQL persistence integration | Passed |
| Frontend tests, lint and production build | Passed |
| Docker image build | Passed |

## Hosted deployment and access

- Render deployment: dep-dbqavhaf0oos73f2fcp0, status LIVE.
- Render health check: /health returned HTTP 200.
- App root: GET / returned HTTP 200 after the Basic Auth gate was disabled.
- PARCELPROOF_DEMO_AUTH_REQUIRED=false.
- The hosted demo opens at a branded sign-in screen. The browser does not show a Basic Auth popup.
- Shared demo username: `merchant.demo`.
- Shared demo password: `PackSafe#2026`.
- Successful sign-in creates a 12-hour HttpOnly session cookie. Merchant APIs require this session.

The demo is public and uses synthetic data. It does not provide individual merchant accounts or tenant separation. Do not enter real customer, address or payment information.

The service is on Render Free. It can sleep after inactivity and may need time to wake on the next visit.

## Current hosted AI configuration

- Provider: Gemini.
- Model observed on the latest successful run: gemini-3.5-flash-lite.
- Per-attempt timeout configured: 30 seconds.
- One bounded retry for retryable temporary provider errors.
- Groq is not used by the hosted demo.
- No OpenAI fallback is configured.

The latest successful inspection screen showed one photo evaluated and 9.1 seconds of server processing (photo storage 1.1s, catalogue reference load 0.8s, vision model 7.2s). This is one observed run, not an SLA or average.

## Supabase snapshot

Direct row-count query on 11 November 2026:

| Table | Rows |
|---|---:|
| orders | 2 |
| shipments | 2 |
| shipment_manifests | 2 |
| packing_inspections | 7 |
| inspection_photos | 10 |
| inspection_reviews | 3 |

These are demonstration records. The inspection count includes earlier failed attempts; it does not mean all seven AI calls succeeded.

## Verified PayPal-to-review path

- A PayPal Sandbox payment was approved and captured.
- The backend verified the PayPal order/capture, amount and currency.
- The paid order generated a linked shipment and order-derived manifest.
- The manifest was finalized and its SHA-256 fingerprint was saved.
- Packing photo evidence was saved with SHA-256 metadata.
- A Gemini 3.5 Flash Lite inspection completed and was stored.
- The merchant recorded a separate NEEDS_CORRECTION decision.
- The shipment remained on hold.

Latest inspection:
- ID: d25a02c1-7468-49c0-9a52-47bd4c2f7e2b.
- Model: gemini-3.5-flash-lite.
- Photo count: 1.
- AI result: MATCH for the visible mug and quantity.
- Human decision: NEEDS_CORRECTION because the exact catalogue design/variant was not verified.

This is an important limitation as well as a useful demonstration: the AI identified a mug and quantity but did not reliably resolve the design difference. The merchant's visual review prevented the AI result from becoming an automatic approval.

Earlier AI provider failures remain in the inspection history as non-approvable attempts; their photo records were retained.

## Product catalogue

The live catalogue has three demonstration products. The buyer-facing shop description is now stored separately from the private product-verification description. All three records have a saved reference image. The checkout API returns buyer-safe product copy; the merchant product setup uses the separate identity-profile endpoint.

## PayPal and logistics limitations

- PayPal integration is Sandbox, not production.
- PayPal tracking writes remain disabled: PAYPAL_TRACKING_SUBMISSION_ENABLED=false.
- No carrier event feed is connected.
- Merchant-entered tracking information is not independent proof of dispatch or delivery.
- ParcelProof does not calculate or guarantee PayPal Seller Protection eligibility.

## Hackathon submission status

The official rules require a working application, a public repository with an open-source licence, a text description, tools disclosure, a working demo URL or complete run instructions, and a public YouTube video under three minutes.

| Deliverable | Status |
|---|---|
| Public GitHub repository | Available |
| MIT licence | Present |
| Hosted demo URL | Available; direct app access |
| PayPal Sandbox integration | Demonstrated |
| Gemini inspection | Demonstrated |
| Separate human correction decision | Demonstrated |
| Current README and judge instructions | Updated in this submission-preparation pass |
| Devpost text fields | Draft prepared in docs/DEVPOST-SUBMISSION.md |
| YouTube video under 3 minutes | Not yet recorded/uploaded |
| Final Devpost submission receipt | Must be checked by the entrant |

## Remaining honest limitations

1. The latest correction request is recorded, but a corrected replacement photo and subsequent re-inspection have not yet been demonstrated.
2. The AI can miss product design/variant differences; human review is essential.
3. There is no carrier event integration.
4. PayPal tracking writes are disabled.
5. The app has one shared demo account, not individual merchant accounts or role-based access.
6. No measured reduction in packing errors, returns or support cost has been collected.
7. A complete public-repository secret-history scan has not been independently recorded in this snapshot.

**Release position:** suitable to present as a working hackathon prototype with the above limitations disclosed. Not production-ready.
