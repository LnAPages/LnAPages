-- 0017_contacts.sql
-- Introduce Contact as master CRM record (issue: feat(crm): introduce Contacts).

CREATE TABLE IF NOT EXISTS contacts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL,
  email           TEXT,
  email_lower     TEXT,          -- lowercase dedup key
  phone           TEXT,
  phone_e164      TEXT,          -- E.164-normalised dedup key
  source          TEXT    NOT NULL DEFAULT 'manual',  -- 'intake' | 'booking' | 'manual'
  stage           TEXT    NOT NULL DEFAULT 'new_lead',
    -- 'new_lead' | 'qualified' | 'proposal' | 'booked' | 'in_production'
    -- | 'delivered' | 'past_client' | 'lost'
  tags_json       TEXT    NOT NULL DEFAULT '[]',      -- JSON string[]
  notes           TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  last_activity_at TEXT   NOT NULL DEFAULT (datetime('now'))
);

-- Unique constraints for dedup (partial – only where the column is NOT NULL).
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_email_lower
  ON contacts(email_lower) WHERE email_lower IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_phone_e164
  ON contacts(phone_e164) WHERE phone_e164 IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_stage          ON contacts(stage);
CREATE INDEX IF NOT EXISTS idx_contacts_last_activity  ON contacts(last_activity_at DESC);

-- FK columns on existing ops tables.
ALTER TABLE bookings ADD COLUMN contact_id INTEGER REFERENCES contacts(id);
ALTER TABLE intakes  ADD COLUMN contact_id INTEGER REFERENCES contacts(id);

CREATE INDEX IF NOT EXISTS idx_bookings_contact ON bookings(contact_id);
CREATE INDEX IF NOT EXISTS idx_intakes_contact  ON intakes(contact_id);

-- invoices table may not exist in all envs; guard with a noop approach.
-- We use a separate migration fragment so failures on missing tables don't block the rest.
-- If invoices table exists, the FK column is added by the next statement.
-- (Cloudflare D1 doesn't support conditional ALTER TABLE; omit here and handle in app code.)
