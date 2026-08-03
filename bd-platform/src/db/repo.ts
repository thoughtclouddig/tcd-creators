import { query } from "./client.js";
import type {
  AuditAgent,
  AuditResult,
  Creator,
  CreatorSeed,
  OpportunityBreakdown,
} from "../types.js";

// ---------- Creators ----------

export async function upsertCreator(seed: CreatorSeed): Promise<Creator> {
  const existing = (
    await query(`SELECT * FROM creators WHERE name = $1`, [seed.name])
  ).rows[0] as Creator | undefined;

  if (existing) {
    await query(
      `UPDATE creators SET brand=$1, website=$2, youtube_channel_id=$3, youtube_handle=$4,
       spotify_show_id=$5, substack_url=$6, x_handle=$7, topics_json=$8, political_alignment=$9,
       updated_at=now() WHERE id=$10`,
      [
        seed.brand ?? existing.brand,
        seed.website ?? existing.website,
        seed.youtube_channel_id ?? existing.youtube_channel_id,
        seed.youtube_handle ?? existing.youtube_handle,
        seed.spotify_show_id ?? existing.spotify_show_id,
        seed.substack_url ?? existing.substack_url,
        seed.x_handle ?? existing.x_handle,
        JSON.stringify(seed.topics ?? JSON.parse(existing.topics_json || "[]")),
        seed.political_alignment ?? existing.political_alignment,
        existing.id,
      ]
    );
    return (await getCreator(existing.id))!;
  }

  const inserted = await query(
    `INSERT INTO creators
      (name, brand, website, youtube_channel_id, youtube_handle, spotify_show_id,
       substack_url, x_handle, topics_json, political_alignment, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
    [
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
      "manual",
    ]
  );
  return (await getCreator(Number(inserted.rows[0].id)))!;
}

export async function getCreator(id: number): Promise<Creator | undefined> {
  return (await query(`SELECT * FROM creators WHERE id = $1`, [id])).rows[0] as
    | Creator
    | undefined;
}

export async function getCreatorByName(name: string): Promise<Creator | undefined> {
  return (await query(`SELECT * FROM creators WHERE name = $1`, [name])).rows[0] as
    | Creator
    | undefined;
}

export async function listCreators(): Promise<Creator[]> {
  return (await query(`SELECT * FROM creators ORDER BY discovered_at DESC`))
    .rows as Creator[];
}

export async function updateCreatorAudienceFields(
  id: number,
  fields: {
    followers?: number;
    subscribers?: number;
    avg_views?: number;
    growth_pct?: number;
    source?: string;
  }
) {
  await query(
    `UPDATE creators SET
       followers = COALESCE($1, followers),
       subscribers = COALESCE($2, subscribers),
       avg_views = COALESCE($3, avg_views),
       growth_pct = COALESCE($4, growth_pct),
       source = COALESCE($5, source),
       updated_at = now()
     WHERE id = $6`,
    [
      fields.followers ?? null,
      fields.subscribers ?? null,
      fields.avg_views ?? null,
      fields.growth_pct ?? null,
      fields.source ?? null,
      id,
    ]
  );
}

// ---------- Audience snapshots ----------

export async function insertAudienceSnapshot(
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
  await query(
    `INSERT INTO audience_snapshots
      (creator_id, subscribers, avg_views, posting_frequency_per_week,
       engagement_rate, estimated_monthly_views, momentum_score, revenue_signal_notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      creatorId,
      snap.subscribers ?? null,
      snap.avg_views ?? null,
      snap.posting_frequency_per_week ?? null,
      snap.engagement_rate ?? null,
      snap.estimated_monthly_views ?? null,
      snap.momentum_score ?? null,
      snap.revenue_signal_notes ?? null,
    ]
  );
}

export async function latestSnapshot(creatorId: number) {
  return (
    await query(
      `SELECT * FROM audience_snapshots WHERE creator_id = $1 ORDER BY captured_at DESC LIMIT 1`,
      [creatorId]
    )
  ).rows[0] as any;
}

export async function snapshotHistory(creatorId: number) {
  return (
    await query(
      `SELECT * FROM audience_snapshots WHERE creator_id = $1 ORDER BY captured_at ASC`,
      [creatorId]
    )
  ).rows as any[];
}

// ---------- Audits ----------

export async function saveAudit(creatorId: number, result: AuditResult) {
  await query(
    `INSERT INTO audits
      (creator_id, agent, grade, score, summary, findings_json, recommendations_json,
       estimated_value_usd, raw_json)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      creatorId,
      result.agent,
      result.grade ?? null,
      result.score,
      result.summary,
      JSON.stringify(result.findings),
      JSON.stringify(result.recommendations),
      result.estimated_value_usd ?? null,
      JSON.stringify(result.raw ?? {}),
    ]
  );
}

export async function latestAudit(creatorId: number, agent: AuditAgent) {
  return (
    await query(
      `SELECT * FROM audits WHERE creator_id = $1 AND agent = $2 ORDER BY created_at DESC LIMIT 1`,
      [creatorId, agent]
    )
  ).rows[0] as any;
}

export async function allLatestAudits(creatorId: number) {
  return (
    await query(
      `SELECT DISTINCT ON (agent) * FROM audits
       WHERE creator_id = $1
       ORDER BY agent, created_at DESC`,
      [creatorId]
    )
  ).rows as any[];
}

// ---------- Opportunity score ----------

export async function saveOpportunityScore(
  creatorId: number,
  overall: number,
  priority: "High" | "Medium" | "Low",
  topfanFit: number,
  estimatedRevenue: string,
  breakdown: OpportunityBreakdown
) {
  await query(
    `INSERT INTO opportunity_scores
      (creator_id, overall_score, priority, topfan_fit_score, estimated_revenue_opportunity, breakdown_json)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [creatorId, overall, priority, topfanFit, estimatedRevenue, JSON.stringify(breakdown)]
  );
}

export async function latestOpportunityScore(creatorId: number) {
  return (
    await query(
      `SELECT * FROM opportunity_scores WHERE creator_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [creatorId]
    )
  ).rows[0] as any;
}

// ---------- Proposals ----------

export async function saveProposal(
  creatorId: number,
  opportunityScoreId: number | null,
  fields: { title: string; html_path?: string; markdown_path?: string; pdf_path?: string }
): Promise<number> {
  const inserted = await query(
    `INSERT INTO proposals (creator_id, opportunity_score_id, title, html_path, markdown_path, pdf_path)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [
      creatorId,
      opportunityScoreId,
      fields.title,
      fields.html_path ?? null,
      fields.markdown_path ?? null,
      fields.pdf_path ?? null,
    ]
  );
  return Number(inserted.rows[0].id);
}

export async function latestProposal(creatorId: number) {
  return (
    await query(
      `SELECT * FROM proposals WHERE creator_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [creatorId]
    )
  ).rows[0] as any;
}

// ---------- Outreach ----------

export async function saveOutreach(
  creatorId: number,
  channel: "email" | "linkedin" | "x_dm",
  body: string,
  opts: { subject?: string; basedOn?: string[] } = {}
) {
  await query(
    `INSERT INTO outreach (creator_id, channel, subject, body, based_on_json)
     VALUES ($1,$2,$3,$4,$5)`,
    [creatorId, channel, opts.subject ?? null, body, JSON.stringify(opts.basedOn ?? [])]
  );
}

export async function listOutreach(creatorId: number) {
  return (
    await query(`SELECT * FROM outreach WHERE creator_id = $1 ORDER BY created_at DESC`, [
      creatorId,
    ])
  ).rows as any[];
}

// ---------- CRM ----------

export async function ensureCrmRow(creatorId: number) {
  const existing = (
    await query(`SELECT * FROM crm WHERE creator_id = $1`, [creatorId])
  ).rows[0];
  if (existing) return existing;
  await query(`INSERT INTO crm (creator_id) VALUES ($1) ON CONFLICT (creator_id) DO NOTHING`, [
    creatorId,
  ]);
  return (await query(`SELECT * FROM crm WHERE creator_id = $1`, [creatorId])).rows[0];
}

const CRM_COLUMNS = new Set([
  "status",
  "notes",
  "opportunity_value_usd",
  "close_probability_pct",
  "proposal_sent_at",
  "emails_sent",
  "replies",
]);

export async function updateCrm(
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
  await ensureCrmRow(creatorId);
  const cols = Object.keys(fields).filter((c) => CRM_COLUMNS.has(c));
  if (cols.length === 0) return;
  const setClause = cols.map((c, i) => `${c} = $${i + 1}`).join(", ");
  await query(
    `UPDATE crm SET ${setClause}, updated_at = now() WHERE creator_id = $${cols.length + 1}`,
    [...cols.map((c) => (fields as any)[c]), creatorId]
  );
}

export async function getCrm(creatorId: number) {
  return (await query(`SELECT * FROM crm WHERE creator_id = $1`, [creatorId])).rows[0] as any;
}

export async function listPipeline() {
  return (
    await query(
      `SELECT c.*, cr.status as crm_status, cr.opportunity_value_usd, cr.close_probability_pct
       FROM crm cr JOIN creators c ON c.id = cr.creator_id
       ORDER BY cr.updated_at DESC`
    )
  ).rows as any[];
}

// ---------- Follow-ups ----------

export async function saveFollowUp(
  creatorId: number,
  dayOffset: 7 | 21 | 60,
  scheduledDate: string,
  body: string,
  channel = "email"
) {
  await query(
    `INSERT INTO follow_ups (creator_id, day_offset, scheduled_date, channel, body)
     VALUES ($1,$2,$3,$4,$5)`,
    [creatorId, dayOffset, scheduledDate, channel, body]
  );
}

export async function listFollowUps(creatorId: number) {
  return (
    await query(
      `SELECT * FROM follow_ups WHERE creator_id = $1 ORDER BY scheduled_date ASC`,
      [creatorId]
    )
  ).rows as any[];
}

export async function dueFollowUps() {
  return (
    await query(
      `SELECT f.*, c.name as creator_name FROM follow_ups f
       JOIN creators c ON c.id = f.creator_id
       WHERE f.status = 'scheduled' AND f.scheduled_date::date <= CURRENT_DATE
       ORDER BY f.scheduled_date ASC`
    )
  ).rows as any[];
}

// ---------- Pipeline runs ----------

export async function startPipelineRun(creatorId: number): Promise<number> {
  const inserted = await query(
    `INSERT INTO pipeline_runs (creator_id) VALUES ($1) RETURNING id`,
    [creatorId]
  );
  return Number(inserted.rows[0].id);
}

export async function logPipelineStep(runId: number, message: string) {
  const row = (
    await query(`SELECT log_json FROM pipeline_runs WHERE id = $1`, [runId])
  ).rows[0] as { log_json: string } | undefined;
  const log = JSON.parse(row?.log_json || "[]");
  log.push({ at: new Date().toISOString(), message });
  await query(`UPDATE pipeline_runs SET log_json = $1 WHERE id = $2`, [
    JSON.stringify(log),
    runId,
  ]);
}

export async function finishPipelineRun(runId: number, status: "completed" | "failed") {
  await query(`UPDATE pipeline_runs SET status = $1, finished_at = now() WHERE id = $2`, [
    status,
    runId,
  ]);
}

export async function recentPipelineRuns(limit = 20) {
  return (
    await query(
      `SELECT pr.*, c.name as creator_name FROM pipeline_runs pr
       JOIN creators c ON c.id = pr.creator_id
       ORDER BY pr.started_at DESC LIMIT $1`,
      [limit]
    )
  ).rows as any[];
}
