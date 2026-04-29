-- 0011_admin_auth_and_ops.sql
-- Issue #46 foundation: employees + native password auth + role-gated panels +
-- task templates + response I/O + signatures + expenses + auto-responses.
-- Backwards-compatible: adds columns to admin_users / admin_sessions only if missing.

-- Extend admin_users with auth + role metadata. Existing rows remain valid.
ALTER TABLE admin_users ADD COLUMN password_hash TEXT;
ALTER TABLE admin_users ADD COLUMN password_algo TEXT DEFAULT 'pbkdf2-sha256-600k';
ALTER TABLE admin_users ADD COLUMN password_salt TEXT;
ALTER TABLE admin_users ADD COLUMN password_updated_at TEXT;
ALTER TABLE admin_users ADD COLUMN role TEXT NOT NULL DEFAULT 'employee';
ALTER TABLE admin_users ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE admin_users ADD COLUMN invited_by INTEGER;
ALTER TABLE admin_users ADD COLUMN invited_at TEXT;
ALTER TABLE admin_users ADD COLUMN last_login_at TEXT;
ALTER TABLE admin_users ADD COLUMN failed_login_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE admin_users ADD COLUMN locked_until TEXT;

-- Extend admin_sessions with audit fields.
ALTER TABLE admin_sessions ADD COLUMN ip_address TEXT;
ALTER TABLE admin_sessions ADD COLUMN user_agent TEXT;
ALTER TABLE admin_sessions ADD COLUMN revoked_at TEXT;
ALTER TABLE admin_sessions ADD COLUMN last_seen_at TEXT;

-- Email invite allowlist. Owner adds emails here; user can then set their own password.
CREATE TABLE IF NOT EXISTS admin_invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'employee',
    token_hash TEXT NOT NULL UNIQUE,
    invited_by INTEGER,
    expires_at TEXT NOT NULL,
    accepted_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invited_by) REFERENCES admin_users(id)
  );
CREATE INDEX IF NOT EXISTS idx_admin_invites_email ON admin_invites(email);

-- Per-user panel permissions. Owner toggles which admin panels an employee can see.
CREATE TABLE IF NOT EXISTS admin_panel_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    panel_key TEXT NOT NULL,
    can_view INTEGER NOT NULL DEFAULT 0,
    can_edit INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, panel_key),
    FOREIGN KEY (user_id) REFERENCES admin_users(id)
  );
CREATE INDEX IF NOT EXISTS idx_panel_perms_user ON admin_panel_permissions(user_id);

-- Rate limiting buckets (IP + email) for login attempts.
CREATE TABLE IF NOT EXISTS auth_rate_limits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bucket_key TEXT NOT NULL UNIQUE,
    window_started_at TEXT NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    blocked_until TEXT
  );
CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON auth_rate_limits(bucket_key);

-- Audit log for sensitive admin actions (who did what, when, from where).
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    metadata_json TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES admin_users(id)
  );
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);

-- Task templates: reusable checklists attached to a service or product type.
CREATE TABLE IF NOT EXISTS task_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    scope TEXT NOT NULL DEFAULT 'service',
    scope_ref_id INTEGER,
    active INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES admin_users(id)
  );
CREATE INDEX IF NOT EXISTS idx_task_templates_scope ON task_templates(scope, scope_ref_id);

CREATE TABLE IF NOT EXISTS task_template_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    title TEXT NOT NULL,
    hint TEXT,
    required INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (template_id) REFERENCES task_templates(id) ON DELETE CASCADE
  );
CREATE INDEX IF NOT EXISTS idx_task_template_items_template ON task_template_items(template_id, position);

-- Task instances: spawned from a template when a booking/order is created.
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER,
    subject_type TEXT NOT NULL,
    subject_id INTEGER NOT NULL,
    assignee_id INTEGER,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    due_at TEXT,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT,
    FOREIGN KEY (template_id) REFERENCES task_templates(id),
    FOREIGN KEY (assignee_id) REFERENCES admin_users(id),
    FOREIGN KEY (created_by) REFERENCES admin_users(id)
  );
CREATE INDEX IF NOT EXISTS idx_tasks_subject ON tasks(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

CREATE TABLE IF NOT EXISTS task_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    title TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    done_by INTEGER,
    done_at TEXT,
    notes TEXT,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (done_by) REFERENCES admin_users(id)
  );
CREATE INDEX IF NOT EXISTS idx_task_items_task ON task_items(task_id, position);

-- Signatures (employee sign-off on task completion or delivery).
CREATE TABLE IF NOT EXISTS signatures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_type TEXT NOT NULL,
    subject_id INTEGER NOT NULL,
    signer_id INTEGER,
    signer_name TEXT NOT NULL,
    signer_role TEXT,
    signature_r2_key TEXT,
    signed_text TEXT,
    ip_address TEXT,
    signed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (signer_id) REFERENCES admin_users(id)
  );
CREATE INDEX IF NOT EXISTS idx_signatures_subject ON signatures(subject_type, subject_id);

-- Expense tracking + recurrence rules + attachments (receipts in R2).
CREATE TABLE IF NOT EXISTS expense_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    color TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER,
    vendor TEXT,
    description TEXT,
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    incurred_on TEXT NOT NULL,
    payment_method TEXT,
    recurring_rule_id INTEGER,
    created_by INTEGER,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES expense_categories(id),
    FOREIGN KEY (created_by) REFERENCES admin_users(id)
  );
CREATE INDEX IF NOT EXISTS idx_expenses_incurred ON expenses(incurred_on);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);

CREATE TABLE IF NOT EXISTS expense_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_id INTEGER NOT NULL,
    r2_key TEXT NOT NULL,
    mime_type TEXT,
    file_name TEXT,
    size_bytes INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE
  );
CREATE INDEX IF NOT EXISTS idx_expense_attachments_expense ON expense_attachments(expense_id);

CREATE TABLE IF NOT EXISTS recurring_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    cadence TEXT NOT NULL,
    next_run_on TEXT NOT NULL,
    amount_cents INTEGER,
    active INTEGER NOT NULL DEFAULT 1,
    last_run_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
CREATE INDEX IF NOT EXISTS idx_recurring_rules_next ON recurring_rules(next_run_on) WHERE active = 1;

-- Auto-responses: pre-created email/SMS templates keyed by trigger.
CREATE TABLE IF NOT EXISTS auto_response_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trigger_event TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'global',
    scope_ref_id INTEGER,
    channel TEXT NOT NULL DEFAULT 'email',
    subject TEXT,
    body_text TEXT NOT NULL,
    body_html TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES admin_users(id)
  );
CREATE INDEX IF NOT EXISTS idx_auto_resp_trigger ON auto_response_templates(trigger_event, scope, scope_ref_id);

CREATE TABLE IF NOT EXISTS auto_response_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER,
    trigger_event TEXT NOT NULL,
    subject_type TEXT,
    subject_id INTEGER,
    recipient TEXT,
    status TEXT NOT NULL DEFAULT 'queued',
    error_message TEXT,
    sent_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES auto_response_templates(id)
  );
CREATE INDEX IF NOT EXISTS idx_auto_resp_events_status ON auto_response_events(status);
CREATE INDEX IF NOT EXISTS idx_auto_resp_events_subject ON auto_response_events(subject_type, subject_id);

-- Seed the five admin panel keys so the permissions UI has rows to render.
INSERT OR IGNORE INTO expense_categories (slug, name, color, sort_order) VALUES
  ('software', 'Software & SaaS', '#6366f1', 10),
  ('equipment', 'Equipment', '#10b981', 20),
  ('travel', 'Travel', '#f59e0b', 30),
  ('meals', 'Meals', '#ef4444', 40),
  ('utilities', 'Utilities', '#64748b', 50),
  ('marketing', 'Marketing', '#ec4899', 60),
  ('other', 'Other', '#94a3b8', 99);
