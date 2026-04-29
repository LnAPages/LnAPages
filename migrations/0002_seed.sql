INSERT INTO services (slug, name, description, duration_minutes, price_cents, active, sort_order, created_at, updated_at)
VALUES
  ('portrait-basic', 'Portrait Basic', 'Single set portrait session', 60, 19900, 1, 1, datetime('now'), datetime('now')),
  ('video-reel', 'Video Reel', 'Short-form marketing reel production', 120, 49900, 1, 2, datetime('now'), datetime('now')),
  ('podcast-pack', 'Podcast Package', 'Podcast audio + video studio session', 180, 69900, 1, 3, datetime('now'), datetime('now'));

INSERT INTO notification_prefs (id, admin_email, admin_phone, channel, notify_on_booking, notify_on_payment, notify_on_intake, updated_at)
VALUES (1, 'admin@fnlstage.com', '+10000000000', 'email', 1, 1, 1, datetime('now'));
