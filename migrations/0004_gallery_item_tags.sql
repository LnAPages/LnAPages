CREATE TABLE IF NOT EXISTS gallery_item_tags (
  gallery_item_id INTEGER NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (gallery_item_id, tag),
  FOREIGN KEY (gallery_item_id) REFERENCES gallery_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_gallery_item_tags_tag ON gallery_item_tags(tag);

INSERT OR IGNORE INTO gallery_item_tags (gallery_item_id, tag)
SELECT id, trim(category)
FROM gallery_items
WHERE category IS NOT NULL AND trim(category) <> '';
