# ParcelProof AI — Devpost submission notes

Use this document as the source for the Devpost form. The Devpost management page requires the account owner's sign-in, so paste the content into the existing submission yourself.

## Project

**Project name:** ParcelProof AI

**Tagline:** Check the pack against what the buyer paid for.

**Short description:** ParcelProof links a PayPal-paid order to its packing list, compares a pre-seal photo with the declared products and saved identity references, and records the merchant’s final decision.

## Project description

For a small online merchant, a successful payment does not guarantee that the right product or quantity will be packed. Picking and packing can happen away from the original order record, and a wrong variant or missing item may only be noticed after dispatch.

ParcelProof AI focuses on one practical moment: checking the visible contents against the paid order before the parcel is sealed.

A buyer completes checkout through PayPal Sandbox. The backend verifies the completed PayPal order and capture, including amount and currency. The paid order lines become the source for a shipment and packing manifest. The merchant confirms the product names and quantities, then finalizes the manifest to create a SHA-256 fingerprint.

Before sealing, the merchant uploads a packing photo. Google Gemini Vision compares the visible evidence with the finalized manifest and the merchant’s saved product identity description and reference image. The AI returns structured observations; it does not approve or reject the shipment. New match results are treated conservatively: the model must explicitly assess identity as consistent, identify at least two visible matching features and report the expected quantity. Unsupported identity claims are downgraded to uncertain.

The merchant reviews the original photo beside the saved catalogue reference and makes the decision. They can approve, reject, or request a correction with an explanation. In the verified hosted example, the merchant requests a correction, the decision and note are recorded, and the shipment remains on hold. The submission demonstrates this human correction decision; it does not yet demonstrate a corrected replacement photo followed by a successful re-inspection. Earlier inspection records and merchant decisions remain in the history.

ParcelProof keeps an application-level evidence trail linking the PayPal capture reference, declared order contents, manifest fingerprint, stored packing-photo digests, AI observation and separate human decision. The merchant can also re-check a saved packing photo: the application retrieves the stored bytes, recomputes the SHA-256 digest and file size, and compares them with the upload-time record. It reports whether the stored file still matches, differs or is unavailable. This verifies stored-byte integrity relative to the upload record; it does not establish the photo's source or capture time, and it does not prove what is inside a sealed parcel. This is not a blockchain.

## Why PayPal is central

PayPal is the source of the paid checkout order, not just an unrelated payment button. ParcelProof verifies the PayPal Sandbox capture and uses the original purchased line items and quantities as the packing manifest. Without that verified paid order, the application has no order-derived packing list to compare with the photograph.

## Tools and how they are used

- **PayPal Developer Platform — Orders v2 Sandbox:** buyer checkout, order approval and capture. The backend verifies the captured amount and currency before creating the shipment.
- **Google Gemini Vision:** multimodal comparison of the packing photo, finalized manifest and saved product identity context. AI output remains advisory and requires merchant review.
- **Python and FastAPI:** PayPal verification, order-to-manifest creation, photo validation, Gemini inspection, stored-photo integrity verification, evidence records and human-review endpoints.
- **React and Vite:** merchant Orders, Packing Station, inspection review and product catalogue screens.
- **Supabase Postgres and private Storage:** hosted records and private evidence files.
- **Render:** hosted demo deployment.

## Demo and source

**Hosted demo:** https://parcelproof-ai-058h.onrender.com

**Public repository:** https://github.com/BasutkarSony/ParcelProof-AI

**Demo walkthrough:** docs/DEMO-SCRIPT.md

**License:** MIT (LICENSE at the repository root).

## Judge testing instructions

The hosted demo uses synthetic data and PayPal Sandbox. Do not enter real customer or payment information.

- Open the hosted demo and sign in with the shared demo account:
  - Username: `merchant.demo`
  - Password: `PackSafe#2026`
- Open **Orders**, select an existing paid demonstration order, and inspect its purchased products and quantities.
- Continue to the manifest and Packing Station; review the saved inspection and merchant decision.
- In inspection review, select **Verify saved photo** to recompute the stored photo hash and size against the upload-time record.
- The existing saved mug example demonstrates that a merchant can request correction even when the AI observation says MATCH.
- The **Test checkout** tool is separate. A fresh checkout requires a PayPal Sandbox buyer account; do not use a live PayPal account.
- The Render Free service may need to wake after inactivity.

Local setup and test commands are in README.md.

## Limitations to disclose

- PayPal processing is Sandbox, not production payments.
- AI compares visible features; it cannot prove an exact SKU from visual similarity alone or see inside a sealed parcel.
- A merchant makes the final decision.
- The hosted demo uses one shared merchant login, not individual merchant accounts or tenant isolation.
- Carrier event feeds and independent proof of dispatch/delivery are not implemented.
- PayPal tracking writes are disabled in the hosted demo.
- The prototype does not calculate Seller Protection eligibility or guarantee a dispute outcome.
- No measured reduction in packing errors, returns or support costs has been collected. The small-merchant target profile is a product hypothesis, not validated interview evidence.

## Video

**YouTube URL:** PASTE THE PUBLIC YOUTUBE VIDEO URL AFTER UPLOADING.

The video must be publicly visible and under three minutes. Use the real hosted app, show the working order-to-packing flow, and avoid copyrighted music or unlicensed third-party material.

## Final checks before clicking Submit

- Confirm the Devpost project title is **ParcelProof AI**.
- Confirm its repository field points to https://github.com/BasutkarSony/ParcelProof-AI.
- Confirm the live demo URL and judge login instructions work.
- List the PayPal and AI tools and explain their actual use.
- Upload the under-three-minute YouTube video and paste its public URL.
- Complete every required Devpost field and click the final **Submit** action before the deadline. Saving a draft is not the same as submitting it.
