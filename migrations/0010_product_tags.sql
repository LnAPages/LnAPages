CREATE TABLE IF NOT EXISTS product_tags (
  product_id INTEGER NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (product_id, tag),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_product_tags_tag ON product_tags(tag);
