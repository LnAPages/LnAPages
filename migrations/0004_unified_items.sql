-- 0004_unified_items.sql
-- Forward-only migration: unify services + products into a single items table.
-- Rebuild bookings (item_id NOT NULL) and intakes (item_id nullable) to reference items.
-- Seed FNL STAGE real catalog if no prior services exist.
--
-- SAFETY: Run a D1 export before applying this in production.
--   wrangler d1 export <DB_NAME> --output=backup-pre-0004.sql
--
-- This migration preserves existing service rows by copying them into items
-- with type='service' and has_page=1 (matches current behavior where every
-- service is its own page).

PRAGMA defer_foreign_keys = ON;

-- 1. Capture whether services table was empty (controls seed insert at the end).
--    We do this by seeding only when NOT EXISTS (SELECT 1 FROM services LIMIT 1).
--    The seed INSERT uses a WHERE NOT EXISTS guard so re-running is safe-ish.

-- 2. Create the unified items table.
CREATE TABLE IF NOT EXISTS items (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  type              TEXT    NOT NULL CHECK (type IN ('service','product')),
  slug              TEXT    NOT NULL,
  name              TEXT    NOT NULL,
  description       TEXT,
  billing_mode      TEXT    NOT NULL DEFAULT 'one_time'
                             CHECK (billing_mode IN ('one_time','hourly','monthly_retainer')),
  duration_minutes  INTEGER,
  price_cents       INTEGER NOT NULL DEFAULT 0,
  deposit_cents     INTEGER NOT NULL DEFAULT 0,
  addon_of_item_id  INTEGER REFERENCES items(id) ON DELETE SET NULL,
  stripe_price_id   TEXT,
  active            INTEGER NOT NULL DEFAULT 1,
  has_page          INTEGER NOT NULL DEFAULT 0,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_items_slug         ON items(slug);
CREATE        INDEX IF NOT EXISTS idx_items_type_active  ON items(type, active);
CREATE        INDEX IF NOT EXISTS idx_items_addon_of     ON items(addon_of_item_id);

-- 3. Copy existing services into items (preserve ids).
--    Existing services schema (0001_init.sql):
--      id, slug, name, description, duration_minutes, price_cents,
--      stripe_price_id, active, sort_order, created_at, updated_at
INSERT INTO items (
  id, type, slug, name, description,
  billing_mode, duration_minutes, price_cents, deposit_cents,
  addon_of_item_id, stripe_price_id, active, has_page, sort_order,
  created_at, updated_at
)
SELECT
  s.id,
  'service'        AS type,
  s.slug,
  s.name,
  s.description,
  'one_time'       AS billing_mode,
  s.duration_minutes,
  COALESCE(s.price_cents, 0),
  0                AS deposit_cents,
  NULL             AS addon_of_item_id,
  s.stripe_price_id,
  COALESCE(s.active, 1),
  1                AS has_page,
  COALESCE(s.sort_order, 0),
  COALESCE(s.created_at, datetime('now')),
  COALESCE(s.updated_at, datetime('now'))
FROM services s
WHERE NOT EXISTS (SELECT 1 FROM items i WHERE i.id = s.id);

-- 4. Rebuild bookings with item_id NOT NULL + new columns.
--    Existing bookings schema (0001_init.sql):
--      id, service_id, customer_name, customer_email, customer_phone,
--      start_time, end_time, status, stripe_session_id, notes,
--      created_at, updated_at
CREATE TABLE IF NOT EXISTS bookings_new (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id            INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  customer_name      TEXT    NOT NULL,
  customer_email     TEXT    NOT NULL,
  customer_phone     TEXT,
  start_time         TEXT    NOT NULL,
  end_time           TEXT,
  hours_requested    REAL,
  addon_item_ids     TEXT    NOT NULL DEFAULT '[]',
  deposit_paid       INTEGER NOT NULL DEFAULT 0,
  status             TEXT    NOT NULL DEFAULT 'pending',
  stripe_session_id  TEXT,
  notes              TEXT,
  created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO bookings_new (
  id, item_id, customer_name, customer_email, customer_phone,
  start_time, end_time, hours_requested, addon_item_ids, deposit_paid,
  status, stripe_session_id, notes, created_at, updated_at
)
SELECT
  b.id,
  b.service_id            AS item_id,
  b.customer_name,
  b.customer_email,
  b.customer_phone,
  b.start_time,
  b.end_time,
  NULL                    AS hours_requested,
  '[]'                    AS addon_item_ids,
  0                       AS deposit_paid,
  COALESCE(b.status, 'pending'),
  b.stripe_session_id,
  b.notes,
  COALESCE(b.created_at, datetime('now')),
  COALESCE(b.updated_at, datetime('now'))
FROM bookings b;

DROP TABLE bookings;
ALTER TABLE bookings_new RENAME TO bookings;

CREATE INDEX IF NOT EXISTS idx_bookings_item_id ON bookings(item_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status  ON bookings(status);

-- 5. Rebuild intakes with nullable item_id.
--    Existing intakes schema (0002_intakes.sql):
--      id, name, email, phone, project_type, budget, timeline,
--      message, status, created_at, updated_at
CREATE TABLE IF NOT EXISTS intakes_new (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id       INTEGER REFERENCES items(id) ON DELETE SET NULL,
  name          TEXT    NOT NULL,
  email         TEXT    NOT NULL,
  phone         TEXT,
  project_type  TEXT,
  budget        TEXT,
  timeline      TEXT,
  message       TEXT,
  status        TEXT    NOT NULL DEFAULT 'new',
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO intakes_new (
  id, item_id, name, email, phone, project_type, budget, timeline,
  message, status, created_at, updated_at
)
SELECT
  i.id,
  NULL           AS item_id,
  i.name,
  i.email,
  i.phone,
  i.project_type,
  i.budget,
  i.timeline,
  i.message,
  COALESCE(i.status, 'new'),
  COALESCE(i.created_at, datetime('now')),
  COALESCE(i.updated_at, datetime('now'))
FROM intakes i;

DROP TABLE intakes;
ALTER TABLE intakes_new RENAME TO intakes;

CREATE INDEX IF NOT EXISTS idx_intakes_item_id ON intakes(item_id);
CREATE INDEX IF NOT EXISTS idx_intakes_status  ON intakes(status);

-- 6. Drop the old services table (it has been fully migrated into items).
DROP TABLE services;

-- 7. Seed FNL STAGE real catalog — only if items is empty after the copy above.
--    (Fresh deploys with no prior services get the starter catalog; existing
--     deploys keep their data and can add these manually from the admin.)
INSERT INTO items (
  type, slug, name, description,
  billing_mode, duration_minutes, price_cents, deposit_cents,
  addon_of_item_id, active, has_page, sort_order
)
SELECT * FROM (
  SELECT 'service' AS type, 'podcast-film'      AS slug, 'Podcast Film'             AS name, 'Multi-cam podcast filming, per hour.'                          AS description, 'hourly'            AS billing_mode, 60   AS duration_minutes, 30000 AS price_cents, 0     AS deposit_cents, NULL AS addon_of_item_id, 1 AS active, 1 AS has_page, 10 AS sort_order
  UNION ALL SELECT 'service', 'podcast-edit',       'Podcast Edit',            'Podcast post-production and edit, per hour.',                   'hourly',            60,  20000, 0,     NULL, 1, 1, 20
  UNION ALL SELECT 'service', 'podcast-retainer',   'Monthly Podcast Retainer','Recurring monthly podcast production retainer.',                'monthly_retainer',  NULL,120000,0,     NULL, 1, 1, 30
  UNION ALL SELECT 'service', 'wedding-3hr',        'Wedding Coverage — 3 Hour','3 hours of wedding coverage. Pre-deposit required to book.',   'one_time',          180, 40000, 10000, NULL, 1, 1, 40
  UNION ALL SELECT 'service', 'wedding-6hr',        'Wedding Coverage — 6 Hour','6 hours of wedding coverage. Pre-deposit required to book.',   'one_time',          360, 70000, 15000, NULL, 1, 1, 50
  UNION ALL SELECT 'service', 'wedding-8hr',        'Wedding Coverage — 8 Hour','8 hours of wedding coverage. Pre-deposit required to book.',   'one_time',          480, 90000, 20000, NULL, 1, 1, 60
  UNION ALL SELECT 'product', 'speed-delivery',     'Speed Delivery',          'Rush turnaround add-on for faster delivery of final files.',    'one_time',          NULL,20000, 0,     NULL, 1, 0, 70
) seed
WHERE NOT EXISTS (SELECT 1 FROM items LIMIT 1);

PRAGMA defer_foreign_keys = OFF;
