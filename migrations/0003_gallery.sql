-- Gallery: tags and tag join table

CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
  );

CREATE TABLE IF NOT EXISTS gallery_tags (
    gallery_item_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (gallery_item_id, tag_id),
    FOREIGN KEY (gallery_item_id) REFERENCES gallery_items(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
  );

CREATE INDEX IF NOT EXISTS idx_gallery_tags_tag ON gallery_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_gallery_tags_item ON gallery_tags(gallery_item_id);
