-- 0019_medspa_services.sql
-- Replace placeholder photography services with correct Lift & Align Med Spa treatments.
-- Services are stored in the `items` table (type='service') after migration 0004_unified_items.

-- Remove old placeholder services
DELETE FROM items WHERE type IN ('service','bundle') AND slug IN (
    'portrait-basic','video-reel','podcast-pack',
    'wedding-3hr','wedding-6hr','wedding-8hr'
  );

-- Insert 10 Lift & Align Med Spa treatments
INSERT INTO items (slug, name, description, type, price_cents, duration_minutes, active, sort_order, category, created_at, updated_at) VALUES
  ('botox-dysport',       'Botox / Dysport',       'Smooth dynamic lines on the forehead, glabella, and crow''s feet.',                 'service', 1300,  30,  1, 1,  'injectables',       datetime('now'), datetime('now')),
  ('dermal-filler',       'Dermal Filler',          'Hyaluronic acid filler for lip volume, cheeks, and jawline definition.',             'service', 72500, 60,  1, 2,  'injectables',       datetime('now'), datetime('now')),
  ('ipl-photofacial',     'IPL Photofacial',        'Reverse sun damage, redness, and brown spots in one session.',                      'service', 42500, 45,  1, 3,  'laser-and-light',   datetime('now'), datetime('now')),
  ('laser-hair-removal',  'Laser Hair Removal',     'Permanent hair reduction for face, body, and bikini areas.',                        'service', 17500, 30,  1, 4,  'laser-and-light',   datetime('now'), datetime('now')),
  ('hydrafacial',         'HydraFacial',            'Cleanse, exfoliate, extract, and hydrate — no downtime.',                           'service', 22500, 60,  1, 5,  'facials',           datetime('now'), datetime('now')),
  ('chemical-peel',       'Chemical Peel',          'Custom-blended peel for tone, texture, and clarity.',                               'service', 18500, 45,  1, 6,  'facials',           datetime('now'), datetime('now')),
  ('microneedling-prp',   'Microneedling + PRP',    'Collagen induction with platelet-rich plasma for the ultimate glow.',               'service', 65000, 75,  1, 7,  'skin-treatments',   datetime('now'), datetime('now')),
  ('dermaplaning',        'Dermaplaning',           'Manual exfoliation that removes peach fuzz and dead skin.',                         'service', 9500,  30,  1, 8,  'skin-treatments',   datetime('now'), datetime('now')),
  ('iv-vitamin-drip',     'IV Vitamin Drip',        'Immunity, hydration, and recovery infusions.',                                      'service', 17500, 45,  1, 9,  'wellness',          datetime('now'), datetime('now')),
  ('b12-lipo-shot',       'B12 / Lipo Shot',        'Quick injection for energy, mood, and metabolism support.',                         'service', 3500,  10,  1, 10, 'wellness',          datetime('now'), datetime('now'))
ON CONFLICT(slug) DO UPDATE SET
  name            = excluded.name,
  description     = excluded.description,
  price_cents     = excluded.price_cents,
  duration_minutes = excluded.duration_minutes,
  category        = excluded.category,
  active          = excluded.active,
  updated_at      = datetime('now');
