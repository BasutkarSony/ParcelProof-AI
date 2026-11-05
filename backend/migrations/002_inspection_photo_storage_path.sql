-- Persist the Supabase Storage object key for each inspection photo.
-- Safe for existing installations and repeatable.
ALTER TABLE inspection_photos
    ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- Existing rows are intentionally left NULL. The application must not
-- pretend old local-disk photos have been uploaded to Supabase.
