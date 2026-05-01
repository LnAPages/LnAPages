-- 0020_expenses_recurring.sql
-- §6: Add recurring-monthly columns to the expenses table.
-- A recurring template has is_recurring=1, recurring_interval_days, next_occurrence_at.
-- Auto-generated children carry parent_expense_id pointing back to the template.

ALTER TABLE expenses ADD COLUMN is_recurring INTEGER NOT NULL DEFAULT 0;
ALTER TABLE expenses ADD COLUMN recurring_interval_days INTEGER;
ALTER TABLE expenses ADD COLUMN next_occurrence_at TEXT;
ALTER TABLE expenses ADD COLUMN parent_expense_id INTEGER REFERENCES expenses(id);

CREATE INDEX IF NOT EXISTS idx_expenses_recurring ON expenses(is_recurring, next_occurrence_at)
  WHERE is_recurring = 1;
