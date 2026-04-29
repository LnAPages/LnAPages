-- 0013_theme_and_fx.sql
-- Issue #48 + #50 foundation: extended theme presets, cinema FX toggles,
-- font pairings, per-word/per-context FX instances, and color-palette extracts.

-- Theme presets with full cohesion schema (palette, fonts, shapes, shadows,
-- motion, scene FX, icons, cursor, mascot, sfx).
CREATE TABLE IF NOT EXISTS theme_presets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'custom',
    palette_json TEXT NOT NULL DEFAULT '{}',
    fonts_json TEXT NOT NULL DEFAULT '{}',
    shapes_json TEXT NOT NULL DEFAULT '{}',
    shadows_json TEXT NOT NULL DEFAULT '{}',
    motion_json TEXT NOT NULL DEFAULT '{}',
    scene_fx_json TEXT NOT NULL DEFAULT '{}',
    icons_json TEXT NOT NULL DEFAULT '{}',
    cursor_json TEXT NOT NULL DEFAULT '{}',
    mascot_json TEXT NOT NULL DEFAULT '{}',
    sfx_json TEXT NOT NULL DEFAULT '{}',
    preview_r2_key TEXT,
    is_built_in INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES admin_users(id)
  );
CREATE INDEX IF NOT EXISTS idx_theme_presets_category ON theme_presets(category);

-- Currently-applied theme pointer (only one row, id=1). Useful for admin preview toggles.
CREATE TABLE IF NOT EXISTS theme_state (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    active_preset_id INTEGER,
    draft_preset_id INTEGER,
    overrides_json TEXT NOT NULL DEFAULT '{}',
    updated_by INTEGER,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (active_preset_id) REFERENCES theme_presets(id),
    FOREIGN KEY (draft_preset_id) REFERENCES theme_presets(id),
    FOREIGN KEY (updated_by) REFERENCES admin_users(id)
  );
INSERT OR IGNORE INTO theme_state (id, overrides_json) VALUES (1, '{}');

-- Font pair catalogue (Google Fonts + locally hosted). Admin picks a pair.
CREATE TABLE IF NOT EXISTS font_pairs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    heading_family TEXT NOT NULL,
    heading_weight INTEGER NOT NULL DEFAULT 700,
    body_family TEXT NOT NULL,
    body_weight INTEGER NOT NULL DEFAULT 400,
    mono_family TEXT,
    source TEXT NOT NULL DEFAULT 'google',
    source_url TEXT,
    license TEXT,
    vibe_tags TEXT NOT NULL DEFAULT '[]',
    sort_order INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1
  );
CREATE INDEX IF NOT EXISTS idx_font_pairs_active ON font_pairs(active, sort_order);

-- Cinema FX catalog: registry of every available effect (diopter, VR glitch, CRT,
-- chromatic aberration, voxel, dot-grid, bokeh, holo iridescence, etc.).
CREATE TABLE IF NOT EXISTS fx_effects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    family TEXT NOT NULL,
    description TEXT,
    params_schema_json TEXT NOT NULL DEFAULT '{}',
    default_params_json TEXT NOT NULL DEFAULT '{}',
    respects_reduced_motion INTEGER NOT NULL DEFAULT 1,
    performance_cost TEXT NOT NULL DEFAULT 'low',
    sort_order INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1
  );
CREATE INDEX IF NOT EXISTS idx_fx_effects_family ON fx_effects(family);

-- FX instances: an effect applied to a specific target (page section, word range,
-- service card, hero, etc.). Multiple can stack on the same target via z_order.
CREATE TABLE IF NOT EXISTS fx_instances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    effect_id INTEGER NOT NULL,
    target_type TEXT NOT NULL,
    target_ref TEXT NOT NULL,
    params_json TEXT NOT NULL DEFAULT '{}',
    z_order INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (effect_id) REFERENCES fx_effects(id) ON DELETE CASCADE
  );
CREATE INDEX IF NOT EXISTS idx_fx_instances_target ON fx_instances(target_type, target_ref, z_order);

-- Color palettes extracted from uploaded inspiration images.
CREATE TABLE IF NOT EXISTS palette_extracts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_r2_key TEXT,
    source_url TEXT,
    swatches_json TEXT NOT NULL,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES admin_users(id)
  );

-- Carousel settings (per-context: hero, shop, service-card, gallery).
CREATE TABLE IF NOT EXISTS carousel_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    context_key TEXT NOT NULL UNIQUE,
    image_count INTEGER NOT NULL DEFAULT 6,
    interval_ms INTEGER NOT NULL DEFAULT 4500,
    transition TEXT NOT NULL DEFAULT 'fade',
    category_filter TEXT,
    customer_can_pick_category INTEGER NOT NULL DEFAULT 0,
    shuffle INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
INSERT OR IGNORE INTO carousel_configs (context_key, image_count) VALUES
  ('home_hero', 6),
  ('shop_hero', 4),
  ('service_card_bg', 5);

-- Seed the built-in FX catalog so the admin UI has effects to toggle the day
-- Copilot lands the renderer.
INSERT OR IGNORE INTO fx_effects (slug, name, family, description, default_params_json, performance_cost, sort_order) VALUES
  ('diopter-lens', 'Diopter lens', 'optical', 'Radial blur focus ring, pulls focus like a DP rack focus.', '{"radius":0.35,"strength":8}', 'medium', 10),
  ('bokeh-dust', 'Bokeh dust', 'optical', 'Floating out-of-focus highlights across the background.', '{"count":24,"speed":0.2}', 'low', 20),
  ('chromatic-aberration', 'Chromatic aberration', 'optical', 'RGB channel split for analog lens feel.', '{"offset":1.5}', 'low', 30),
  ('anamorphic-flare', 'Anamorphic flare', 'optical', 'Horizontal teal streak over bright pixels.', '{"intensity":0.6}', 'low', 40),
  ('vr-glitch', 'VR glitch', 'digital', 'Scanline tearing, displacement slices, RGB offset.', '{"amplitude":6,"frequency":0.15}', 'medium', 50),
  ('crt-scanlines', 'CRT scanlines', 'digital', 'Horizontal scanlines with phosphor bleed.', '{"density":2,"bleed":0.35}', 'low', 60),
  ('voxel-pixelate', 'Voxel pixelate', 'digital', 'Blocky pixelation with depth shading.', '{"size":8}', 'low', 70),
  ('dot-grid', 'Dot grid', 'digital', 'Halftone dot matrix overlay.', '{"size":6,"contrast":0.7}', 'low', 80),
  ('holo-iridescence', 'Holo iridescence', 'surface', 'Rainbow oil-slick shimmer on hover.', '{"spread":0.7}', 'medium', 90),
  ('paper-grain', 'Paper grain', 'surface', 'Subtle paper texture overlay.', '{"opacity":0.08}', 'low', 100),
  ('risograph', 'Risograph', 'print', 'Two-ink misregistration and noise.', '{"spread":2}', 'low', 110),
  ('gradient-text', 'Gradient text', 'typography', 'Per-word or per-letter gradient fill.', '{"angle":120}', 'low', 120),
  ('word-glitch', 'Word glitch', 'typography', 'Text data-mosh on hover.', '{"intensity":0.5}', 'low', 130);

-- Seed a handful of font pair presets.
INSERT OR IGNORE INTO font_pairs (slug, display_name, heading_family, body_family, vibe_tags, sort_order) VALUES
  ('editorial-classic', 'Editorial classic', 'Playfair Display', 'Inter', '["editorial","serious"]', 10),
  ('cinema-brutal', 'Cinema brutal', 'Space Grotesk', 'IBM Plex Sans', '["cinematic","modern"]', 20),
  ('kawaii-soft', 'Kawaii soft', 'Fredoka', 'Nunito', '["cute","friendly"]', 30),
  ('zine-riso', 'Zine riso', 'Redaction', 'DM Mono', '["zine","print"]', 40),
  ('y2k-dream', 'Y2K dream', 'Bungee', 'VT323', '["y2k","retro"]', 50),
  ('arcade-pixel', 'Arcade pixel', 'Press Start 2P', 'Space Mono', '["retro","arcade"]', 60),
  ('scrapbook-paper', 'Scrapbook paper', 'Caveat', 'Quicksand', '["cute","craft"]', 70);
