-- ThoughtCloud Digital BD Platform — schema (PostgreSQL)
-- Agents communicate exclusively through these tables.

CREATE TABLE IF NOT EXISTS creators (
  id                  SERIAL PRIMARY KEY,
  name                TEXT NOT NULL,
  brand               TEXT,
  website             TEXT,
  youtube_channel_id  TEXT,
  youtube_handle      TEXT,
  spotify_show_id     TEXT,
  substack_url        TEXT,
  x_handle            TEXT,
  business_email      TEXT,   -- from the channel's public "About" page; entered manually, not scraped
  platform_links_json TEXT DEFAULT '{}',
  topics_json         TEXT DEFAULT '[]',
  political_alignment TEXT,              -- descriptive only, never pejorative
  followers           INTEGER,
  subscribers         INTEGER,
  avg_views           INTEGER,
  growth_pct          REAL,
  source              TEXT DEFAULT 'manual',   -- manual | youtube | spotify | substack | referral
  discovered_at       TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audience_snapshots (
  id                          SERIAL PRIMARY KEY,
  creator_id                  INTEGER NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  captured_at                 TIMESTAMPTZ DEFAULT now(),
  subscribers                 INTEGER,
  avg_views                   INTEGER,
  posting_frequency_per_week  REAL,
  engagement_rate              REAL,        -- (likes+comments)/views, 0-1
  estimated_monthly_views      INTEGER,
  momentum_score                REAL,        -- 0-100
  revenue_signal_notes          TEXT
);

-- Generic audit table shared by Agents 3-9 (one row per agent run per creator)
CREATE TABLE IF NOT EXISTS audits (
  id                    SERIAL PRIMARY KEY,
  creator_id            INTEGER NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  agent                 TEXT NOT NULL,     -- website | ownership | merch | monetization | community | ai_opportunity | topfan
  created_at            TIMESTAMPTZ DEFAULT now(),
  grade                 TEXT,              -- A-F, only used by website auditor category grades (stored in raw_json)
  score                 REAL,              -- 0-100 (or 0-10 depending on agent; see raw_json.scale)
  summary               TEXT,
  findings_json          TEXT DEFAULT '[]',
  recommendations_json    TEXT DEFAULT '[]',
  estimated_value_usd      INTEGER,        -- revenue left on table / opportunity value, where applicable
  raw_json                 TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS opportunity_scores (
  id                              SERIAL PRIMARY KEY,
  creator_id                      INTEGER NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  created_at                      TIMESTAMPTZ DEFAULT now(),
  overall_score                   REAL NOT NULL,   -- 0-100
  priority                        TEXT NOT NULL,   -- High | Medium | Low
  topfan_fit_score                 REAL,
  estimated_revenue_opportunity     TEXT,           -- human-readable range, e.g. "$150k-$400k/yr"
  breakdown_json                    TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS proposals (
  id                     SERIAL PRIMARY KEY,
  creator_id             INTEGER NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  created_at              TIMESTAMPTZ DEFAULT now(),
  title                   TEXT,
  html_content             TEXT,   -- source of truth, served directly -- the deployment's
  markdown_content          TEXT,  -- local disk is ephemeral and does not survive a redeploy
  html_path               TEXT,    -- best-effort local file copy, for local dev convenience only
  markdown_path            TEXT,
  pdf_path                 TEXT,
  opportunity_score_id      INTEGER REFERENCES opportunity_scores(id)
);

CREATE TABLE IF NOT EXISTS outreach (
  id            SERIAL PRIMARY KEY,
  creator_id    INTEGER NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ DEFAULT now(),
  channel        TEXT NOT NULL,   -- email | linkedin | x_dm
  subject        TEXT,
  body           TEXT NOT NULL,
  based_on_json  TEXT DEFAULT '[]',  -- specific artifacts referenced (video title, tweet, etc.)
  status         TEXT DEFAULT 'draft'  -- draft | approved | sent
);

CREATE TABLE IF NOT EXISTS crm (
  id                       SERIAL PRIMARY KEY,
  creator_id               INTEGER NOT NULL UNIQUE REFERENCES creators(id) ON DELETE CASCADE,
  status                    TEXT DEFAULT 'new',  -- new | drafts_ready | contacted | replied | meeting_booked | proposal_sent | negotiating | won | lost
  -- "contacted" and everything after it is a human marking that they actually reached out --
  -- nothing in this system sends anything automatically.
  meetings_json              TEXT DEFAULT '[]',
  emails_sent                 INTEGER DEFAULT 0,
  replies                     INTEGER DEFAULT 0,
  proposal_sent_at             TIMESTAMPTZ,
  notes                        TEXT,
  opportunity_value_usd         INTEGER,
  close_probability_pct          REAL,
  updated_at                     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS follow_ups (
  id             SERIAL PRIMARY KEY,
  creator_id     INTEGER NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  day_offset      INTEGER NOT NULL,   -- 7 | 21 | 60
  scheduled_date   DATE NOT NULL,
  channel          TEXT DEFAULT 'email',
  body             TEXT NOT NULL,
  status           TEXT DEFAULT 'scheduled',  -- scheduled | sent | skipped
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pipeline_runs (
  id            SERIAL PRIMARY KEY,
  creator_id     INTEGER NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  started_at      TIMESTAMPTZ DEFAULT now(),
  finished_at      TIMESTAMPTZ,
  status           TEXT DEFAULT 'running', -- running | completed | failed
  log_json         TEXT DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS discovery_sweeps (
  id                SERIAL PRIMARY KEY,
  started_at         TIMESTAMPTZ DEFAULT now(),
  finished_at         TIMESTAMPTZ,
  status              TEXT DEFAULT 'running', -- running | completed | failed
  queries_json         TEXT DEFAULT '[]',
  channels_found        INTEGER,
  already_known          INTEGER,
  out_of_range            INTEGER,
  new_candidate_names       TEXT DEFAULT '[]',
  warnings_json             TEXT DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_audits_creator ON audits(creator_id, agent);
CREATE INDEX IF NOT EXISTS idx_snapshots_creator ON audience_snapshots(creator_id, captured_at);
CREATE INDEX IF NOT EXISTS idx_outreach_creator ON outreach(creator_id);
CREATE INDEX IF NOT EXISTS idx_followups_creator ON follow_ups(creator_id, scheduled_date);

-- ---------- Migrations ----------
-- ensureSchema() re-runs this whole file on every boot (every statement above is
-- CREATE ... IF NOT EXISTS, so it's a no-op against an already-current table). A column added
-- to a CREATE TABLE block above only affects brand-new tables — an already-deployed table
-- needs its own ALTER TABLE ... IF NOT EXISTS line here to actually pick up the change.

ALTER TABLE creators ADD COLUMN IF NOT EXISTS business_email TEXT;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS html_content TEXT;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS markdown_content TEXT;
