ALTER TABLE gallery_items ADD COLUMN kind TEXT NOT NULL DEFAULT 'image';
UPDATE gallery_items
SET kind = CASE
  WHEN substr(lower(r2_key), -4) IN ('.mp4', '.mov')
    OR substr(lower(r2_key), -5) = '.webm'
  THEN 'video'
  ELSE 'image'
END;
CREATE INDEX IF NOT EXISTS idx_gallery_items_kind ON gallery_items(kind);
