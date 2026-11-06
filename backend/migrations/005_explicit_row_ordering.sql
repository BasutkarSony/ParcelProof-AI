-- Make item/photo/review ordering explicit across SQLite and PostgreSQL.
-- IF NOT EXISTS makes this safe for both already-provisioned and fresh databases.
ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS item_position INTEGER NOT NULL DEFAULT 0;

ALTER TABLE manifest_items
    ADD COLUMN IF NOT EXISTS item_position INTEGER NOT NULL DEFAULT 0;

ALTER TABLE inspection_reviews
    ADD COLUMN IF NOT EXISTS review_position INTEGER NOT NULL DEFAULT 0;

ALTER TABLE inspection_photos
    ADD COLUMN IF NOT EXISTS photo_position INTEGER NOT NULL DEFAULT 0;
