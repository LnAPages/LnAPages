-- 0021_service_talents.sql
-- Add service_talents join table so each service can belong to multiple talent categories.
-- Also adds price_unit column to items for per-service pricing display (e.g. "per unit", "per session").

-- Join table: one service can map to many talent slugs
CREATE TABLE IF NOT EXISTS service_talents (
  service_id INTEGER NOT NULL,
  talent_slug TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (service_id, talent_slug),
  FOREIGN KEY (service_id) REFERENCES items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_service_talents_slug ON service_talents(talent_slug, sort_order);

-- Add price_unit column to items (e.g. 'unit', 'syringe', 'session', 'area', 'drip', 'shot')
ALTER TABLE items ADD COLUMN price_unit TEXT;

-- Seed service_talents from existing category column, mapping old slug variants to canonical talent slugs
INSERT OR IGNORE INTO service_talents (service_id, talent_slug, sort_order)
SELECT
  id,
  CASE category
    WHEN 'injectables'     THEN 'injectables'
    WHEN 'laser-and-light' THEN 'laser-light'
    WHEN 'laser-light'     THEN 'laser-light'
    WHEN 'facials'         THEN 'facials'
    WHEN 'skin-treatments' THEN 'skin-treatments'
    WHEN 'wellness'        THEN 'wellness'
    ELSE NULL
  END,
  0
FROM items
WHERE type IN ('service','bundle')
  AND category IN ('injectables','laser-and-light','laser-light','facials','skin-treatments','wellness');

-- Seed price_unit for the standard med-spa services
UPDATE items SET price_unit = 'unit'    WHERE slug = 'botox-dysport'      AND type = 'service';
UPDATE items SET price_unit = 'syringe' WHERE slug = 'dermal-filler'      AND type = 'service';
UPDATE items SET price_unit = 'session' WHERE slug = 'ipl-photofacial'    AND type = 'service';
UPDATE items SET price_unit = 'area'    WHERE slug = 'laser-hair-removal'  AND type = 'service';
UPDATE items SET price_unit = 'session' WHERE slug = 'hydrafacial'         AND type = 'service';
UPDATE items SET price_unit = 'session' WHERE slug = 'chemical-peel'       AND type = 'service';
UPDATE items SET price_unit = 'session' WHERE slug = 'microneedling-prp'   AND type = 'service';
UPDATE items SET price_unit = 'session' WHERE slug = 'dermaplaning'        AND type = 'service';
UPDATE items SET price_unit = 'drip'    WHERE slug = 'iv-vitamin-drip'     AND type = 'service';
UPDATE items SET price_unit = 'shot'    WHERE slug = 'b12-lipo-shot'       AND type = 'service';
