-- Repair drift: deployed DBs created before migrations/0011 was edited
-- to include updated_at need this column added explicitly.
-- Note: CURRENT_TIMESTAMP is not allowed as a default in ALTER TABLE ADD COLUMN
-- in SQLite, so a sentinel literal is used instead. Existing rows predate
-- time-tracking; new writes from the application will supply datetime('now').

ALTER TABLE admin_panel_permissions
  ADD COLUMN updated_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00';
