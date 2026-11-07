-- Reusable one-time product identity references for the packing inspector.
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS barcode_gtin TEXT;
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS reference_image_path TEXT;
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS reference_image_mime_type TEXT;
