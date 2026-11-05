-- Keep shipment, payment, manifest, and inspection records private.
-- The backend connects with the database owner/service role and remains able
-- to perform application operations. No anon/authenticated client policies are
-- created: public browser access must go through the authenticated API.
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE manifest_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE packing_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
