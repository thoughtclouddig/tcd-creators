import { db } from "./client.js";
import type {
  AuditAgent,
  AuditResult,
  Creator,
  CreatorSeed,
  OpportunityBreakdown,
} from "../types.js";

// ---------- Creators ----------

export function upsertCreator(seed: CreatorSeed): Creator {
  const existing = db
    .prepare(`SELECT * FROM creators WHERE name = ?`)
    .get(seed.name) as Creator | undefined;

  if (existing) {
    db.prepare(
      `UPDATE creators SET brand=?, website=?, youtube_channel_id=?, youtube_handle=?,
       spotify_show_id=?, substack_url=?, x_handle=?, topics_json=?, political_alignment=?,
       updated_at=datetime('now') WHERE id=?`
    ).run(
      seed.brand ?? existing.brand,
      seed.website ?? existing.website,
      seed.youtube_channel_id ?? existing.youtube_channel_id,
      seed.youtube_handle ?? existing.youtube_handle,
      seed.spotify_show_id ?? existing.spotify_show_id,
      seed.substack_url ?? existing.substack_url,
      seed.x_handle ?? existing.x_handle,
      JSON.stringify(seed.topics ?? JSON.parse(existing.topics_json || "[]")),
      seed.political_alignment ?? existing.political_alignment,
      existing.id
    );
    return getCreator(existing.id)!;
  }

  const info = db
    .prepare(
      `INSERT INTO creators
        (name, brand, website, youtube_channel_id, youtube_handle, spotify_show_id,
         substack_url, x_handle, topics_json, political_alignment, source)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      seed.name,
      seed.brand ?? null,
      seed.website ?? null,
      seed.youtube_channel_id ?? null,
      seed.youtube_handle ?? null,
      seed.spotify_show_id ?? null,
      seed.substack_url ?? null,
      seed.x_handle ?? null,
      JSON.stringify(seed.topics ?? []),
      seed.political_alignment ?? null,
      "manual"
    );
  return getCreator(Number(info.lastInsertRowid))!;
}

export function getCreator(id: number): Creator | undefined {
  return db.prepare(`SELECT * FROM creators WHERE id = ?`).get(id) as
    | Creator
    | undefined;
}

export function getCreatorByName(name: string): Creator | undefined {
  return db.prepare(`SELECT * FROM creators WHERE name = ?`).get(name) as
    | Creator
    | undefined;
}

export function listCreators(): Creator[] {
  return db
    .prepare(`SELECT * FROM creators ORDER BY discovered_at DESC`)
    .all() as Creator[];
}

export function updateCreatorAudienceFields(
  id: number,
  fields: {
    followers?: number;
    subscribers?: number;
    avg_views?: number;
    growth_pct?: number;
    source?: string;
  }
) {
  db.prepare(
    `UPDATE creators SET
       followers = COALESCE(?, followers),
       subscribers = COALESCE(?, subscribers),
       avg_views = COALESCE(?, avg_views),
       growth_pct = COALESCE(?, growth_pct),
       source = COALESCE(?, source),
       updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    fields.followers ?? null,
    fields.subscribers ?? null,
    fields.avg_views ?? null,
    fields.growth_pct ?? null,
    fields.source ?? null,
    id
  );
}

// ---------- Audience snapshots ----------

export function insertAudienceSnapshot(
  creatorId: number,
  snap: {
    subscribers?: number;
    avg_views?: number;
    posting_frequency_per_week?: number;
    engagement_rate?: number;
    estimated_monthly_views?: number;
    momentum_score?: number;
    revenue_signal_notes?: string;
  }
) {
  db.prepare(
    `INSERT INTO audience_snapshots
      (creator_id, subscribers, avg_views, posting_frequency_per_week,
       engagement_rate, estimated_monthly_views, momentum_score, revenue_signal_notes)
     VALUES (?,?,?,?,?,?,?,?)`
  ).run(
    creatorId,
    snap.subscribers ?? null,
    snap.avg_views ?? null,
    snap.posting_frequency_per_week ?? null,
    snap.engagement_rate ?? null,
    snap.estimated_monthly_views ?? null,
    snap.momentum_score ?? null,
    snap.revenue_signal_notes ?? null
  );
}

export function latestSnapshot(creatorId: number) {
  return db
    .prepare(
      `SELECT * FROM audience_snapshots WHERE creator_id = ? ORDER BY captured_at DESC LIMIT 1`
    )
    .get(creatorId) as any;
}

export function snapshotHistory(creatorId: number) {
  return db
    .prepare(
      `SELECT * FROM audience_snapshots WHERE creator_id = ? ORDER BY captured_at ASC`
    )
    .all(creatorId) as any[];
}

// ---------- Audits ----------

export function saveAudit(creatorId: number, result: AuditResult) {
  db.prepare(
    `INSERT INTO audits
      (creator_id, agent, grade, score, summary, findings_json, recommendations_json,
       estimated_value_usd, raw_json)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(
    creatorId,
    result.agent,
    result.grade ?? null,
    result.score,
    result.summary,
    JSON.stringify(result.findings),
    JSON.stringify(result.recommendations),
    result.estimated_value_usd ?? null,
    JSON.stringify(result.raw ?? {})
  );
}

export function latestAudit(creatorId: number, agent: AuditAgent) {
  return db
    .prepare(
      `SELECT * FROM audits WHERE creator_id = ? AND agent = ? ORDER BY created_at DESC LIMIT 1`
    )
    .get(creatorId, agent) as any;
}

export function allLatestAudits(creatorId: number) {
  return db
    .prepare(
      `SELECT a.* FROM audits a
       INNER JOIN (
         SELECT agent, MAX(created_at) AS max_created
         FROM audits WHERE creator_id = ? GROUP BY agent
       ) latest ON a.agent = latest.agent AND a.created_at = latest.max_created
       WHERE a.creator_id = ?`
    )
    .all(creatorId, creatorId) as any[];
}

// ---------- Opportunity score ----------

export function saveOpportunityScore(
  creatorId: number,
  overall: number,
  priority: "High" | "Medium" | "Low",
  topfanFit: number,
  estimatedRevenue: string,
  breakdown: OpportunityBreakdown
) {
  db.prepare(
    `INSERT INTO opportunity_scores
      (creator_id, overall_score, priority, topfan_fit_score, estimated_revenue_opportunity, breakdown_json)
     VALUES (?,?,?,?,?,?)`
  ).run(
    creatorId,
    overall,
    priority,
    topfanFit,
    estimatedRevenue,
    JSON.stringify(breakdown)
  );
}

export function latestOpportunityScore(creatorId: number) {
  return db
    .prepare(
      `SELECT * FROM opportunity_scores WHERE creator_id = ? ORDER BY created_at DESC LIMIT 1`
    )
    .get(creatorId) as any;
}

// ---------- Proposals ----------

export function saveProposal(
  creatorId: number,
  opportunityScoreId: number | null,
  fields: { title: string; html_path?: string; markdown_path?: string; pdf_path?: string }
) {
  const info = db
    .prepare(
      `INSERT INTO proposals (creator_id, opportunity_score_id, title, html_path, markdown_path, pdf_path)
       VALUES (?,?,?,?,?,?)`
    )
    .run(
      creatorId,
      opportunityScoreId,
      fields.title,
      fields.html_path ?? null,
      fields.markdown_path ?? null,
      fields.pdf_path ?? null
    );
  return Number(info.lastInsertRowid);
}

export function latestProposal(creatorId: number) {
  return db
    .prepare(
      `SELECT * FROM proposals WHERE creator_id = ? ORDER BY created_at DESC LIMIT 1`
    )
    .get(creatorId) as any;
}

// ---------- Outreach ----------

export function saveOutreach(
  creatorId: number,
  channel: "email" | "linkedin" | "x_dm",
  body: string,
  opts: { subject?: string; basedOn?: string[] } = {}
) {
  db.prepare(
    `INSERT INTO outreach (creator_id, channel, subject, body, based_on_json)
     VALUES (?,?,?,?,?)`
  ).run(
    creatorId,
    channel,
    opts.subject ?? null,
    body,
    JSON.stringify(opts.basedOn ?? [])
  );
}

export function listOutreach(creatorId: number) {
  return db
    .prepare(`SELECT * FROM outreach WHERE creator_id = ? ORDER BY created_at DESC`)
    .all(creatorId) as any[];
}

// ---------- CRM ----------

export function ensureCrmRow(creatorId: number) {
  const existing = db
    .prepare(`SELECT * FROM crm WHERE creator_id = ?`)
    .get(creatorId);
  if (existing) return existing;
  db.prepare(`INSERT INTO crm (creator_id) VALUES (?)`).run(creatorId);
  return db.prepare(`SELECT * FROM crm WHERE creator_id = ?`).get(creatorId);
}

export function updateCrm(
  creatorId: number,
  fields: Partial<{
    status: string;
    notes: string;
    opportunity_value_usd: number;
    close_probability_pct: number;
    proposal_sent_at: string;
    emails_sent: number;
    replies: number;
  }>
) {
  ensureCrmRow(creatorId);
  const cols = Object.keys(fields);
  if (cols.length === 0) return;
  const setClause = cols.map((c) => `${c} = ?`).join(", ");
  db.prepare(
    `UPDATE crm SET ${setClause}, updated_at = datetime('now') WHERE creator_id = ?`
  ).run(...cols.map((c) => (fields as any)[c]), creatorId);
}

export function getCrm(creatorId: number) {
  return db.prepare(`SELECT * FROM crm WHERE creator_id = ?`).get(creatorId) as any;
}

export function listPipeline() {
  return db
    .prepare(
      `SELECT c.*, cr.status as crm_status, cr.opportunity_value_usd, cr.close_probability_pct
       FROM crm cr JOIN creators c ON c.id = cr.creator_id
       ORDER BY cr.updated_at DESC`
    )
    .all() as any[];
}

// ---------- Follow-ups ----------

export function saveFollowUp(
  creatorId: number,
  dayOffset: 7 | 21 | 60,
  scheduledDate: string,
  body: string,
  channel = "email"
) {
  db.prepare(
    `INSERT INTO follow_ups (creator_id, day_offset, scheduled_date, channel, body)
     VALUES (?,?,?,?,?)`
  ).run(creatorId, dayOffset, scheduledDate, channel, body);
}

export function listFollowUps(creatorId: number) {
  return db
    .prepare(
      `SELECT * FROM follow_ups WHERE creator_id = ? ORDER BY scheduled_date ASC`
    )
    .all(creatorId) as any[];
}

export function dueFollowUps() {
  return db
    .prepare(
      `SELECT f.*, c.name as creator_name FROM follow_ups f
       JOIN creators c ON c.id = f.creator_id
       WHERE f.status = 'scheduled' AND date(f.scheduled_date) <= date('now')
       ORDER BY f.scheduled_date ASC`
    )
    .all() as any[];
}

// ---------- Pipeline runs ----------

export function startPipelineRun(creatorId: number): number {
  const info = db
    .prepare(`INSERT INTO pipeline_runs (creator_id) VALUES (?)`)
    .run(creatorId);
  return Number(info.lastInsertRowid);
}

export function logPipelineStep(runId: number, message: string) {
  const row = db
    .prepare(`SELECT log_json FROM pipeline_runs WHERE id = ?`)
    .get(runId) as { log_json: string };
  const log = JSON.parse(row.log_json || "[]");
  log.push({ at: new Date().toISOString(), message });
  db.prepare(`UPDATE pipeline_runs SET log_json = ? WHERE id = ?`).run(
    JSON.stringify(log),
    runId
  );
}

export function finishPipelineRun(runId: number, status: "completed" | "failed") {
  db.prepare(
    `UPDATE pipeline_runs SET status = ?, finished_at = datetime('now') WHERE id = ?`
  ).run(status, runId);
}

export function recentPipelineRuns(limit = 20) {
  return db
    .prepare(
      `SELECT pr.*, c.name as creator_name FROM pipeline_runs pr
       JOIN creators c ON c.id = pr.creator_id
       ORDER BY pr.started_at DESC LIMIT ?`
    )
    .all(limit) as any[];
}
