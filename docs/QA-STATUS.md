# QA Status — 4 November 2026

This is the result of checking the supplied `ParcelProof-AI-final.zip` in the available execution environment. It is not a claim that the deployed application has passed its release gate.

## Backend

Command:

```bash
cd backend
python -m unittest discover -s tests -v
```

Result: **218 tests discovered; 214 passed; 4 errored before exercising their assertions** because `google.genai` is not installed in this environment. The four affected tests cover Gemini 503 cleanup/error mapping and the optional OpenAI fallback photo set. Installing `google-genai` was attempted, but package installation could not reach the package index because DNS/network access is unavailable here. The repository's `backend/requirements.txt` does include `google-genai`; rerun the full suite after installing the requirements in CI or a network-enabled environment.

## Frontend

`npm ci` was attempted from `frontend/`. It did not complete before the execution timeout, and the environment has no populated npm cache or network access to fetch the packages. Therefore frontend tests, Oxlint and the production Vite build have **not been verified in this environment**. The GitHub Actions workflow pins Node.js 22.22.2 to meet the Node engine requirements declared by the locked frontend dependencies. Run the workflow in GitHub Actions and treat its result as the authoritative frontend check.

## Other environment limits

Docker is not installed in this execution environment, so the deployment image was not built here. No live PayPal Sandbox checkout, hosted deployment, persistent-disk restart, or Gemini API call was performed as part of this source audit.

## Source changes in this QA pass

- Repaired the visible mojibake text in `frontend/src/main.jsx`.
- Changed the sidebar monogram from the old `S` to `P` for ParcelProof AI.
- Pinned CI's Node version to 22.22.2.
- Added the merchant user manual, release gate, and short demo script.

No repository was created, pushed, deployed or connected to PayPal during this pass. The PayPal tracking write gate remains disabled by default.
