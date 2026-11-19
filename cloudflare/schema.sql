PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS cms_admins (
  github_user_id TEXT PRIMARY KEY,
  github_login TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS cms_drafts (
  id TEXT PRIMARY KEY,
  collection TEXT NOT NULL CHECK (collection IN ('transmissions','human-archive','signals')),
  record_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(collection, record_id)
);
CREATE INDEX IF NOT EXISTS idx_cms_drafts_collection ON cms_drafts(collection, updated_at DESC);

CREATE TABLE IF NOT EXISTS signals_submissions (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  medium TEXT NOT NULL CHECK (medium IN ('text','photograph','music','video')),
  body TEXT NOT NULL DEFAULT '',
  byline TEXT NOT NULL DEFAULT '',
  rights_confirmed INTEGER NOT NULL CHECK (rights_confirmed IN (0,1)),
  media_key TEXT,
  media_name TEXT,
  media_mime_type TEXT,
  media_size INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  submitted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  reviewed_at TEXT,
  reviewed_by TEXT,
  review_note TEXT,
  submitter_ip_hash TEXT
);
CREATE INDEX IF NOT EXISTS idx_signals_status_submitted ON signals_submissions(status, submitted_at DESC);

CREATE TABLE IF NOT EXISTS cms_favorites (
  record_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cms_media_assets (
  object_key TEXT PRIMARY KEY,
  collection TEXT NOT NULL CHECK (collection IN ('transmissions','human-archive','signals')),
  record_id TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  visibility TEXT NOT NULL CHECK (visibility IN ('private','public')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_cms_media_record ON cms_media_assets(collection, record_id);

CREATE TABLE IF NOT EXISTS cms_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_cms_audit_created ON cms_audit_log(created_at DESC);

CREATE TABLE IF NOT EXISTS cms_rate_limits (
  bucket TEXT PRIMARY KEY,
  window_started_at INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cms_sessions (
  session_hash TEXT PRIMARY KEY,
  github_user_id TEXT NOT NULL,
  github_login TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_cms_sessions_expiry ON cms_sessions(expires_at);

CREATE TABLE IF NOT EXISTS cms_oauth_states (
  state_hash TEXT PRIMARY KEY,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cms_oauth_expiry ON cms_oauth_states(expires_at);
