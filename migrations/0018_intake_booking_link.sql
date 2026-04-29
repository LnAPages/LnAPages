-- 0018_intake_booking_link.sql
-- Issue #85: link an intake to the resulting booking when an admin
-- converts an intake into a booking via the /admin/intakes UI.
--
-- We intentionally use a new booking_id column rather than extending
-- the existing intakes.status CHECK constraint (which D1/SQLite cannot
-- alter in place). A non-null booking_id implies the intake has been
-- converted; the row remains the source of truth for the original lead.

ALTER TABLE intakes ADD COLUMN booking_id INTEGER REFERENCES bookings(id);

CREATE INDEX IF NOT EXISTS idx_intakes_booking_id ON intakes(booking_id);
