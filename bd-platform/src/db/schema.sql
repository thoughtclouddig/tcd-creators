-- ThoughtCloud Digital BD Platform — schema
-- SQLite. Agents communicate exclusively through these tables.

CREATE TABLE IF NOT EXISTS creators (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  name                TEXT NOT NULL,
  brand               TEXT,
  website             TEXT,
  youtube_channel_id  TEXT,
  youtube_handle      TEXT,
  spotify_show_id     TEXT,
  substack_url        TEXT,
  x_handle            TEXT,
  platform_links_json TEXT DEFAULT '{}',
  topics_json         TEXT DEFAULT '[]',
  political_alignment TEXT,              -- descriptive only, never pejorative
  followers           INTEGER,
  subscribers         INTEGER,
  avg_views           INTEGER,
  growth_pct          REAL,
  source              TEXT DEFAULT 'manual',   -- manual | youtube | spotify | substack | referral
  discovered_at       TEXT DEFAULT (datetime('now')),
  updated_at          TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audience_snapshots (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_id               INTEGER NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  captured_at               TEXT DEFAULT (datetime('now')),
  subscribers               INTEGER,
  avg_views                 INTEGER,
  posting_frequency_per_week REAL,
  engagement_rate            REAL,        -- (likes+comments)/views, 0-1
  estimated_monthly_views    INTEGER,
  momentum_score             REAL,        -- 0-100
  revenue_signal_notes       TEXT
);

-- Generic audit table shared by Agents 3-9 (one row per agent run per creator)
CREATE TABLE IF NOT EXISTS audits (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_id       INTEGER NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  agent            TEXT NOT NULL,     -- website | ownership | merch | monetization | community | ai_opportunity | topfan
  created_at       TEXT DEFAULT (datetime('now')),
  grade            TEXT,              -- A-F, only used by website auditor category grades (stored in raw_json)
  score             REAL,              -- 0-100 (or 0-10 depending on agent; see raw_json.scale)
  summary           TEXT,
  findings_json      TEXT DEFAULT '[]',
  recommendations_json TEXT DEFAULT '[]',
  estimated_value_usd  INTEGER,        -- revenue left on table / opportunity value, where applicable
  raw_json           TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS opportunity_scores (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_id                 INTEGER NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  created_at                  TEXT DEFAULT (datetime('now')),
  overall_score                REAL NOT NULL,   -- 0-100
  priority                     TEXT NOT NULL,   -- High | Medium | Low
  topfan_fit_score              REAL,
  estimated_revenue_opportunity TEXT,           -- human-readable range, e.g. "$150k-$400k/yr"
  breakdown_json                TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS proposals (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_id     INTEGER NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  created_at      TEXT DEFAULT (datetime('now')),
  title           TEXT,
  html_path       TEXT,
  markdown_path   TEXT,
  pdf_path        TEXT,
  opportunity_score_id INTEGER REFERENCES opportunity_scores(id)
);

CREATE TABLE IF NOT EXISTS outreach (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_id    INTEGER NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  created_at     TEXT DEFAULT (datetime('now')),
  channel        TEXT NOT NULL,   -- email | linkedin | x_dm
  subject        TEXT,
  body           TEXT NOT NULL,
  based_on_json  TEXT DEFAULT '[]',  -- specific artifacts referenced (video title, tweet, etc.)
  status         TEXT DEFAULT 'draft'  -- draft | approved | sent
);

CREATE TABLE IF NOT EXISTS crm (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_id            INTEGER NOT NULL UNIQUE REFERENCES creators(id) ON DELETE CASCADE,
  status                 TEXT DEFAULT 'new',  -- new | contacted | replied | meeting_booked | proposal_sent | negotiating | won | lost
  meetings_json           TEXT DEFAULT '[]',
  emails_sent              INTEGER DEFAULT 0,
  replies                  INTEGER DEFAULT 0,
  proposal_sent_at         TEXT,
  notes                    TEXT,
  opportunity_value_usd     INTEGER,
  close_probability_pct     REAL,
  updated_at                TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS follow_ups (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_id     INTEGER NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  day_offset      INTEGER NOT NULL,   -- 7 | 21 | 60
  scheduled_date   TEXT NOT NULL,
  channel          TEXT DEFAULT 'email',
  body             TEXT NOT NULL,
  status           TEXT DEFAULT 'scheduled',  -- scheduled | sent | skipped
  created_at        TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pipeline_runs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_id     INTEGER NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  started_at      TEXT DEFAULT (datetime('now')),
  finished_at      TEXT,
  status           TEXT DEFAULT 'running', -- running | completed | failed
  log_json         TEXT DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_audits_creator ON audits(creator_id, agent);
CREATE INDEX IF NOT EXISTS idx_snapshots_creator ON audience_snapshots(creator_id, captured_at);
CREATE INDEX IF NOT EXISTS idx_outreach_creator ON outreach(creator_id);
CREATE INDEX IF NOT EXISTS idx_followups_creator ON follow_ups(creator_id, scheduled_date);
