ALTER TABLE items ADD COLUMN category TEXT;

UPDATE items
SET category = 'photography'
WHERE type IN ('service', 'bundle')
  AND slug IN ('wedding-3hr', 'wedding-6hr', 'wedding-8hr');
