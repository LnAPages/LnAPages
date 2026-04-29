-- 0005_bookings_stripe.sql
-- Add Stripe payment tracking columns to bookings (forward-only).
-- Depends on 0004_unified_items.sql.

PRAGMA defer_foreign_keys = ON;

-- Amount charged for this booking (full price or deposit, captured at checkout creation).
ALTER TABLE bookings ADD COLUMN amount_cents         INTEGER NOT NULL DEFAULT 0;

-- If this charge is a deposit-only flow, the deposit amount. 0 otherwise.
ALTER TABLE bookings ADD COLUMN deposit_amount_cents INTEGER NOT NULL DEFAULT 0;

-- Stripe PaymentIntent id (resolved via webhook after checkout.session.completed).
ALTER TABLE bookings ADD COLUMN stripe_payment_intent TEXT;

-- Whether this booking has been paid in full (1) vs deposit-only (0).
-- Updated by /api/payments/webhook on checkout.session.completed.
ALTER TABLE bookings ADD COLUMN paid_in_full         INTEGER NOT NULL DEFAULT 0;

-- Timestamp of successful payment (set by webhook).
ALTER TABLE bookings ADD COLUMN paid_at              TEXT;

CREATE INDEX IF NOT EXISTS idx_bookings_stripe_session_id  ON bookings(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_bookings_stripe_pi          ON bookings(stripe_payment_intent);
