-- Keep buyer-facing shop copy separate from private packing-verification details.
-- Existing description values remain intact and continue to feed paid-order manifests
-- and AI inspection prompts. This column is used by the checkout storefront.
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS store_description TEXT NOT NULL DEFAULT '';

UPDATE products
SET store_description = CASE sku
    WHEN 'MUG-CER-001' THEN 'Stoneware coffee mug with a glazed finish.'
    WHEN 'TOTE-COT-002' THEN 'Reusable cotton canvas tote bag for everyday use.'
    WHEN 'NOTE-A5-003' THEN 'Hardcover ruled notebook with 160 pages.'
    ELSE COALESCE(NULLIF(BTRIM(name), ''), 'Product')
END
WHERE COALESCE(BTRIM(store_description), '') = '';
