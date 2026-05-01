-- Adds image_url columns to products and services for admin-uploaded R2 images.
ALTER TABLE products ADD COLUMN image_url TEXT;
ALTER TABLE services ADD COLUMN image_url TEXT;
