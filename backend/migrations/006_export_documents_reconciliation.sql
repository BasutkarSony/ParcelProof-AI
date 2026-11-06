-- Private export documents and persisted reconciliation runs.
CREATE TABLE IF NOT EXISTS shipment_documents (
    id TEXT PRIMARY KEY,
    shipment_order_id TEXT NOT NULL REFERENCES shipments(order_id) ON DELETE CASCADE,
    document_type TEXT NOT NULL CHECK (document_type IN ('COMMERCIAL_INVOICE', 'PACKING_LIST')),
    document_status TEXT NOT NULL DEFAULT 'STORED',
    extraction_status TEXT NOT NULL DEFAULT 'NOT_STARTED',
    original_filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    extracted_data TEXT,
    confirmed_data TEXT,
    extraction_provider TEXT,
    extraction_error TEXT,
    reviewer_label TEXT,
    confirmed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shipment_documents_shipment
    ON shipment_documents(shipment_order_id, created_at);

CREATE TABLE IF NOT EXISTS reconciliation_runs (
    id TEXT PRIMARY KEY,
    shipment_order_id TEXT NOT NULL REFERENCES shipments(order_id) ON DELETE CASCADE,
    order_id TEXT NOT NULL REFERENCES orders(id),
    manifest_id TEXT NOT NULL REFERENCES shipment_manifests(id),
    document_id TEXT REFERENCES shipment_documents(id),
    overall_status TEXT NOT NULL,
    engine_version TEXT NOT NULL,
    result TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reconciliation_runs_shipment
    ON reconciliation_runs(shipment_order_id, created_at);

ALTER TABLE shipment_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE shipment_documents FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE reconciliation_runs FROM PUBLIC, anon, authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('shipment-documents', 'shipment-documents', false, 10485760,
        ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = false, file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
