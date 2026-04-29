-- 0012_blog.sql
-- Issue #47 foundation: optional blog wall with rich-text body, revisions,
-- tags, and media attachments. Public /blog reads published rows.

CREATE TABLE IF NOT EXISTS blog_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    excerpt TEXT,
    body_html TEXT NOT NULL DEFAULT '',
    body_mdx TEXT,
    cover_r2_key TEXT,
    cover_focal_x REAL,
    cover_focal_y REAL,
    status TEXT NOT NULL DEFAULT 'draft',
    published_at TEXT,
    author_id INTEGER,
    reading_minutes INTEGER,
    view_count INTEGER NOT NULL DEFAULT 0,
    seo_title TEXT,
    seo_description TEXT,
    og_image_r2_key TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES admin_users(id)
  );
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);

-- Revision history for undo / diffing.
CREATE TABLE IF NOT EXISTS blog_revisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    author_id INTEGER,
    title TEXT NOT NULL,
    body_html TEXT NOT NULL,
    body_mdx TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES admin_users(id)
  );
CREATE INDEX IF NOT EXISTS idx_blog_revisions_post ON blog_revisions(post_id, created_at DESC);

-- Tags + many-to-many join.
CREATE TABLE IF NOT EXISTS blog_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

CREATE TABLE IF NOT EXISTS blog_post_tags (
    post_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (post_id, tag_id),
    FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES blog_tags(id) ON DELETE CASCADE
  );

-- Inline media uploaded via the editor (images / embeds).
CREATE TABLE IF NOT EXISTS blog_media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER,
    r2_key TEXT NOT NULL,
    mime_type TEXT,
    width INTEGER,
    height INTEGER,
    alt_text TEXT,
    caption TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE SET NULL
  );
CREATE INDEX IF NOT EXISTS idx_blog_media_post ON blog_media(post_id);

-- Hyperlink buttons that can be embedded in posts.
CREATE TABLE IF NOT EXISTS blog_cta_buttons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    label TEXT NOT NULL,
    href TEXT NOT NULL,
    variant TEXT NOT NULL DEFAULT 'primary',
    open_in_new_tab INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE
  );
CREATE INDEX IF NOT EXISTS idx_blog_cta_post ON blog_cta_buttons(post_id, position);
