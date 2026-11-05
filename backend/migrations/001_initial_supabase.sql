-- ParcelProof AI: initial PostgreSQL schema for Supabase.
-- Mirrors the current SQLite store schema. IDs remain TEXT to preserve the
-- application's existing UUID/string identifiers. Safe to run more than once.

CREATE TABLE IF NOT EXISTS products (
    sku TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    price_cents INTEGER NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    fragile INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    paypal_order_id TEXT UNIQUE,
    paypal_capture_id TEXT UNIQUE,
    payment_status TEXT NOT NULL DEFAULT 'CREATED',
    currency TEXT NOT NULL DEFAULT 'USD',
    total_cents INTEGER NOT NULL DEFAULT 0,
    buyer_name TEXT NOT NULL DEFAULT '',
    shipping_address TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_sku TEXT NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price_cents INTEGER NOT NULL,
    line_total_cents INTEGER NOT NULL,
    fragile INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_orders_paypal_order_id ON orders(paypal_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_paypal_capture_id ON orders(paypal_capture_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

CREATE TABLE IF NOT EXISTS shipment_manifests (
    id TEXT PRIMARY KEY,
    shipment_order_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    notes TEXT,
    manifest_hash TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shipment_manifests_order_id
    ON shipment_manifests(shipment_order_id);

CREATE TABLE IF NOT EXISTS manifest_items (
    id TEXT PRIMARY KEY,
    manifest_id TEXT NOT NULL REFERENCES shipment_manifests(id) ON DELETE CASCADE,
    sku TEXT,
    description TEXT NOT NULL,
    expected_qty INTEGER NOT NULL,
    unit_value_cents INTEGER,
    fragile INTEGER NOT NULL DEFAULT 0,
    source_order_item_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_manifest_items_manifest_id ON manifest_items(manifest_id);
CREATE INDEX IF NOT EXISTS idx_manifest_items_source_order_item
    ON manifest_items(source_order_item_id);

CREATE TABLE IF NOT EXISTS packing_inspections (
    id TEXT PRIMARY KEY,
    manifest_id TEXT NOT NULL REFERENCES shipment_manifests(id),
    inspection_status TEXT NOT NULL DEFAULT 'PENDING_HUMAN_REVIEW',
    photo_count INTEGER NOT NULL DEFAULT 0,
    model_used TEXT,
    ai_result TEXT,
    manifest_hash_at_inspection TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_packing_inspections_manifest_id
    ON packing_inspections(manifest_id);

CREATE TABLE IF NOT EXISTS inspection_reviews (
    id TEXT PRIMARY KEY,
    inspection_id TEXT NOT NULL REFERENCES packing_inspections(id),
    decision TEXT NOT NULL,
    reviewer_label TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inspection_reviews_inspection_id
    ON inspection_reviews(inspection_id);

CREATE TABLE IF NOT EXISTS inspection_photos (
    id TEXT PRIMARY KEY,
    inspection_id TEXT NOT NULL REFERENCES packing_inspections(id) ON DELETE CASCADE,
    sha256 TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inspection_photos_inspection_id
    ON inspection_photos(inspection_id);

CREATE TABLE IF NOT EXISTS shipments (
    id TEXT PRIMARY KEY,
    order_id TEXT UNIQUE NOT NULL,
    checkout_order_id TEXT UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    paypal_order_id TEXT NOT NULL,
    paypal_capture_id TEXT UNIQUE NOT NULL,
    tracking_number TEXT NOT NULL DEFAULT '',
    carrier TEXT NOT NULL DEFAULT 'OTHER',
    carrier_name_other TEXT NOT NULL DEFAULT 'UNASSIGNED',
    status TEXT NOT NULL DEFAULT 'ON_HOLD',
    shipped_date TEXT,
    delivered_date TEXT,
    transaction_date TEXT,
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    shipping_address TEXT NOT NULL DEFAULT '',
    buyer_name TEXT NOT NULL DEFAULT '',
    evidence_text TEXT NOT NULL DEFAULT '',
    signature_obtained INTEGER NOT NULL DEFAULT 0,
    tracking_submission_status TEXT NOT NULL DEFAULT 'NOT_SUBMITTED',
    paypal_tracking_submitted_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shipments_checkout_order_id ON shipments(checkout_order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_paypal_capture_id ON shipments(paypal_capture_id);

-- Seed only the three current demo catalogue products. Never overwrite edits.
INSERT INTO products (sku, name, description, price_cents, is_active, fragile)
VALUES
    ('MUG-CER-001', 'Ceramic Coffee Mug', 'Stoneware coffee mug with a glazed finish.', 1800, 1, 1),
    ('TOTE-COT-002', 'Cotton Canvas Tote Bag', 'Reusable everyday tote made from durable cotton canvas.', 1400, 1, 0),
    ('NOTE-A5-003', 'A5 Hardcover Notebook', 'Hardcover ruled notebook with 160 pages.', 1250, 1, 0)
ON CONFLICT (sku) DO NOTHING;
