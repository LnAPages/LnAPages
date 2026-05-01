-- Repair drift: deployed DBs created before migrations/0011 was edited
-- to include updated_at need this column added explicitly.

ALTER TABLE admin_panel_permissions
  ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP;
