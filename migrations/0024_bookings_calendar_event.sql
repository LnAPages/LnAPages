ALTER TABLE bookings ADD COLUMN google_event_id TEXT;
ALTER TABLE bookings ADD COLUMN google_calendar_sync_status TEXT
  CHECK (google_calendar_sync_status IN ('pending','synced','failed')) DEFAULT 'pending';
ALTER TABLE bookings ADD COLUMN google_calendar_sync_error TEXT;
ALTER TABLE bookings ADD COLUMN google_calendar_synced_at TEXT;
CREATE INDEX IF NOT EXISTS idx_bookings_calendar_sync
  ON bookings(google_calendar_sync_status);
