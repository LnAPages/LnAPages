-- 0014_commerce_pipeline.sql
-- Issue #49 foundation: multi-line orders, billing + shipping, invoices,
-- agreements snapshot, digital downloads, email notifications log.
-- Products.kind already supports digital/apparel/3d/shipped; we add
-- fulfillment_type for clarity (digital / shipment / pickup) and physical attrs.

-- Extend products with fulfillment metadata.
ALTER TABLE products ADD COLUMN fulfillment_type TEXT NOT NULL DEFAULT 'digital';
ALTER TABLE products ADD COLUMN weight_grams INTEGER;
ALTER TABLE products ADD COLUMN length_mm INTEGER;
ALTER TABLE products ADD COLUMN width_mm INTEGER;
ALTER TABLE products ADD COLUMN height_mm INTEGER;
ALTER TABLE products ADD COLUMN requires_shipping INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN pickup_instructions TEXT;
ALTER TABLE products ADD COLUMN digital_file_r2_key TEXT;
ALTER TABLE products ADD COLUMN digital_file_size_bytes INTEGER;
ALTER TABLE products ADD COLUMN download_limit INTEGER NOT NULL DEFAULT 5;
ALTER TABLE products ADD COLUMN download_expiry_hours INTEGER NOT NULL DEFAULT 168;
ALTER TABLE products ADD COLUMN tax_code TEXT;
ALTER TABLE products ADD COLUMN inventory_count INTEGER;
ALTER TABLE products ADD COLUMN agreement_id INTEGER;

-- Product variants (size / color / finish).
CREATE TABLE IF NOT EXISTS product_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    sku TEXT UNIQUE,
    name TEXT NOT NULL,
    price_cents INTEGER,
    weight_grams INTEGER,
    inventory_count INTEGER,
    active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id);

-- Customer agreements / terms (e.g. licensing, usage terms, release forms).
CREATE TABLE IF NOT EXISTS agreements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    body_html TEXT NOT NULL,
    body_markdown TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    active INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES admin_users(id)
  );
CREATE INDEX IF NOT EXISTS idx_agreements_slug ON agreements(slug);

-- Multi-line orders (supersedes the single-product orders row for new sales).
-- Legacy orders table remains untouched.
CREATE TABLE IF NOT EXISTS shop_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT NOT NULL UNIQUE,
    customer_email TEXT NOT NULL,
    customer_name TEXT,
    customer_phone TEXT,
    billing_line1 TEXT,
    billing_line2 TEXT,
    billing_city TEXT,
    billing_region TEXT,
    billing_postal TEXT,
    billing_country TEXT,
    shipping_same_as_billing INTEGER NOT NULL DEFAULT 1,
    shipping_line1 TEXT,
    shipping_line2 TEXT,
    shipping_city TEXT,
    shipping_region TEXT,
    shipping_postal TEXT,
    shipping_country TEXT,
    shipping_method TEXT,
    shipping_cost_cents INTEGER NOT NULL DEFAULT 0,
    subtotal_cents INTEGER NOT NULL DEFAULT 0,
    tax_cents INTEGER NOT NULL DEFAULT 0,
    discount_cents INTEGER NOT NULL DEFAULT 0,
    total_cents INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    payment_provider TEXT NOT NULL DEFAULT 'stripe',
    payment_session_id TEXT,
    payment_intent_id TEXT,
    payment_status TEXT NOT NULL DEFAULT 'pending',
    fulfillment_status TEXT NOT NULL DEFAULT 'unfulfilled',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paid_at TEXT,
    fulfilled_at TEXT,
    cancelled_at TEXT
  );
CREATE INDEX IF NOT EXISTS idx_shop_orders_email ON shop_orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_shop_orders_payment_status ON shop_orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_shop_orders_fulfillment ON shop_orders(fulfillment_status);
CREATE INDEX IF NOT EXISTS idx_shop_orders_number ON shop_orders(order_number);

CREATE TABLE IF NOT EXISTS shop_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER,
    variant_id INTEGER,
    product_name_snapshot TEXT NOT NULL,
    variant_name_snapshot TEXT,
    unit_price_cents INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    line_total_cents INTEGER NOT NULL,
    fulfillment_type TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES shop_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (variant_id) REFERENCES product_variants(id)
  );
CREATE INDEX IF NOT EXISTS idx_shop_order_items_order ON shop_order_items(order_id);

-- Agreement snapshots per order (text captured at purchase time so later edits
-- don't invalidate the signed agreement).
CREATE TABLE IF NOT EXISTS order_agreements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    agreement_id INTEGER,
    title_snapshot TEXT NOT NULL,
    body_snapshot_html TEXT NOT NULL,
    accepted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    accepted_ip TEXT,
    FOREIGN KEY (order_id) REFERENCES shop_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (agreement_id) REFERENCES agreements(id)
  );
CREATE INDEX IF NOT EXISTS idx_order_agreements_order ON order_agreements(order_id);

-- Shipments + tracking.
CREATE TABLE IF NOT EXISTS shipments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    carrier TEXT,
    service TEXT,
    tracking_number TEXT,
    tracking_url TEXT,
    label_r2_key TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    shipped_at TEXT,
    delivered_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES shop_orders(id) ON DELETE CASCADE
  );
CREATE INDEX IF NOT EXISTS idx_shipments_order ON shipments(order_id);

-- Digital download tokens with expiry + use counting.
CREATE TABLE IF NOT EXISTS download_grants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_item_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    r2_key TEXT NOT NULL,
    filename TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    max_uses INTEGER NOT NULL DEFAULT 5,
    used_count INTEGER NOT NULL DEFAULT 0,
    last_used_at TEXT,
    last_ip TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_item_id) REFERENCES shop_order_items(id) ON DELETE CASCADE
  );
CREATE INDEX IF NOT EXISTS idx_download_grants_token ON download_grants(token);
CREATE INDEX IF NOT EXISTS idx_download_grants_order_item ON download_grants(order_item_id);

-- Shop invoices (separate from booking-linked 'invoices' table which predates this).
CREATE TABLE IF NOT EXISTS shop_invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    invoice_number TEXT NOT NULL UNIQUE,
    pdf_r2_key TEXT,
    total_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    due_at TEXT,
    paid_at TEXT,
    status TEXT NOT NULL DEFAULT 'issued',
    FOREIGN KEY (order_id) REFERENCES shop_orders(id) ON DELETE CASCADE
  );
CREATE INDEX IF NOT EXISTS idx_shop_invoices_order ON shop_invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_shop_invoices_number ON shop_invoices(invoice_number);

-- Transactional email log (notifications sent to customer + owner).
CREATE TABLE IF NOT EXISTS email_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    subject_type TEXT,
    subject_id INTEGER,
    from_address TEXT,
    to_address TEXT NOT NULL,
    cc TEXT,
    bcc TEXT,
    subject TEXT NOT NULL,
    body_text TEXT,
    body_html TEXT,
    provider TEXT NOT NULL DEFAULT 'resend',
    provider_message_id TEXT,
    status TEXT NOT NULL DEFAULT 'queued',
    error_message TEXT,
    sent_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
CREATE INDEX IF NOT EXISTS idx_email_log_subject ON email_log(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_email_log_status ON email_log(status);
CREATE INDEX IF NOT EXISTS idx_email_log_to ON email_log(to_address);

-- Discount codes (simple, optional).
CREATE TABLE IF NOT EXISTS discount_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL DEFAULT 'percent',
    value INTEGER NOT NULL,
    min_subtotal_cents INTEGER NOT NULL DEFAULT 0,
    max_redemptions INTEGER,
    redemption_count INTEGER NOT NULL DEFAULT 0,
    starts_at TEXT,
    ends_at TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
CREATE INDEX IF NOT EXISTS idx_discount_codes_active ON discount_codes(active);
