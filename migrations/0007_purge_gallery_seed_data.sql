DELETE FROM gallery_item_tags;
DELETE FROM gallery_tags;
DELETE FROM gallery_items;
DELETE FROM tags;
DELETE FROM sqlite_sequence WHERE name IN ('gallery_items', 'tags');
