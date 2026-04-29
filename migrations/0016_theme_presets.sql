-- 0016_theme_presets.sql
-- Issue #50 Part A: Theme cohesion presets stored in D1 for admin discovery
-- Holds the canonical set of named brand presets (id + label + vibe + theme JSON).
-- Seeded via POST /api/admin/theme/seed-presets.

CREATE TABLE IF NOT EXISTS theme_presets (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  vibe_description TEXT NOT NULL DEFAULT '',
  theme_json TEXT NOT NULL,
  is_builtin INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000),
  updated_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000)
);

CREATE INDEX IF NOT EXISTS idx_theme_presets_updated_at ON theme_presets(updated_at);
