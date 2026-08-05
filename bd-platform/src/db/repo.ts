import { ensureSchema, pool } from "./client.js";
import type {
  AuditAgent,
  AuditResult,
  Creator,
  CreatorSeed,
  OpportunityBreakdown,
} from "../types.js";

async function query<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
  await ensureSchema();
  const res = await pool.query(text, params);
  return res.rows as T[];
}

async function one<T = any>(text: string, params: unknown[] = []): Promise<T | undefined> {
  const rows = await query<T>(text, params);
  return rows[0];
}

// ---------- Creators ----------

export async function upsertCreator(seed: CreatorSeed): Promise<Creator> {
  const existing = await getCreatorByName(seed.name);

  if (existing) {
    await query(
      `UPDATE creators SET brand=COALESCE($1,brand), website=COALESCE($2,website),
       youtube_channel_id=COALESCE($3,youtube_channel_id), youtube_handle=COALESCE($4,youtube_handle),
       spotify_show_id=COALESCE($5,spotify_show_id), substack_url=COALESCE($6,substack_url),
       x_handle=COALESCE($7,x_handle), topics_json=COALESCE($8,topics_json),
       political_alignment=COALESCE($9,political_alignment), updated_at=now()
       WHERE id=$10`,
      [
        seed.brand ?? null,
        seed.website ?? null,
        seed.youtube_channel_id ?? null,
        seed.youtube_handle ?? null,
        seed.spotify_show_id ?? null,
        seed.substack_url ?? null,
        seed.x_handle ?? null,
        seed.topics ? JSON.stringify(seed.topics) : null,
        seed.political_alignment ?? null,
        existing.id,
      ]
    );
    return (await getCreator(existing.id))!;
  }

  const row = await one<{ id: number }>(
    `INSERT INTO creators
      (name, brand, website, youtube_channel_id, youtube_handle, spotify_show_id,
       substack_url, x_handle, topics_json, political_alignment, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id`,
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
  return (await getCreator(row!.id))!;
}

export async function getCreator(id: number): Promise<Creator | undefined> {
  return one<Creator>(`SELECT * FROM creators WHERE id = $1`, [id]);
}

export async function getCreatorByName(name: string): Promise<Creator | undefined> {
  return one<Creator>(`SELECT * FROM creators WHERE name = $1`, [name]);
}

export async function listCreators(): Promise<Creator[]> {
  return query<Creator>(`SELECT * FROM creators ORDER BY discovered_at DESC`);
}

export async function getCreatorByYoutubeChannelId(
  channelId: string
): Promise<Creator | undefined> {
  return one<Creator>(`SELECT * FROM creators WHERE youtube_channel_id = $1`, [channelId]);
}

/** Creators with no opportunity_scores row yet — discovered but not yet fully audited. */
export async function listUnauditedCreators(): Promise<Creator[]> {
  return query<Creator>(
    `SELECT c.* FROM creators c
     LEFT JOIN opportunity_scores os ON os.creator_id = c.id
     WHERE os.id IS NULL
     ORDER BY c.discovered_at DESC`
  );
}

export async function setYoutubeChannelId(id: number, channelId: string): Promise<void> {
  await query(
    `UPDATE creators SET youtube_channel_id = $1, updated_at = now() WHERE id = $2`,
    [channelId, id]
  );
}

export async function setBusinessEmail(id: number, email: string): Promise<void> {
  await query(
    `UPDATE creators SET business_email = $1, updated_at = now() WHERE id = $2`,
    [email, id]
  );
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
): Promise<void> {
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
): Promise<void> {
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

export async function latestSnapshot(creatorId: number): Promise<any> {
  return one(
    `SELECT * FROM audience_snapshots WHERE creator_id = $1 ORDER BY captured_at DESC LIMIT 1`,
    [creatorId]
  );
}

export async function snapshotHistory(creatorId: number): Promise<any[]> {
  return query(
    `SELECT * FROM audience_snapshots WHERE creator_id = $1 ORDER BY captured_at ASC`,
    [creatorId]
  );
}

// ---------- Audits ----------

export async function saveAudit(creatorId: number, result: AuditResult): Promise<void> {
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

export async function latestAudit(creatorId: number, agent: AuditAgent): Promise<any> {
  return one(
    `SELECT * FROM audits WHERE creator_id = $1 AND agent = $2 ORDER BY created_at DESC LIMIT 1`,
    [creatorId, agent]
  );
}

export async function allLatestAudits(creatorId: number): Promise<any[]> {
  return query(
    `SELECT a.* FROM audits a
     INNER JOIN (
       SELECT agent, MAX(created_at) AS max_created
       FROM audits WHERE creator_id = $1 GROUP BY agent
     ) latest ON a.agent = latest.agent AND a.created_at = latest.max_created
     WHERE a.creator_id = $1`,
    [creatorId]
  );
}

// ---------- Opportunity score ----------

export async function saveOpportunityScore(
  creatorId: number,
  overall: number,
  priority: "High" | "Medium" | "Low",
  topfanFit: number,
  estimatedRevenue: string,
  breakdown: OpportunityBreakdown
): Promise<number> {
  const row = await one<{ id: number }>(
    `INSERT INTO opportunity_scores
      (creator_id, overall_score, priority, topfan_fit_score, estimated_revenue_opportunity, breakdown_json)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id`,
    [creatorId, overall, priority, topfanFit, estimatedRevenue, JSON.stringify(breakdown)]
  );
  return row!.id;
}

export async function latestOpportunityScore(creatorId: number): Promise<any> {
  return one(
    `SELECT * FROM opportunity_scores WHERE creator_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [creatorId]
  );
}

// ---------- Proposals ----------

export async function saveProposal(
  creatorId: number,
  opportunityScoreId: number | null,
  fields: {
    title: string;
    html_content: string;
    markdown_content: string;
    html_path?: string;
    markdown_path?: string;
    pdf_path?: string;
  }
): Promise<number> {
  const row = await one<{ id: number }>(
    `INSERT INTO proposals
      (creator_id, opportunity_score_id, title, html_content, markdown_content, html_path, markdown_path, pdf_path)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id`,
    [
      creatorId,
      opportunityScoreId,
      fields.title,
      fields.html_content,
      fields.markdown_content,
      fields.html_path ?? null,
      fields.markdown_path ?? null,
      fields.pdf_path ?? null,
    ]
  );
  return row!.id;
}

export async function latestProposal(creatorId: number): Promise<any> {
  return one(
    `SELECT * FROM proposals WHERE creator_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [creatorId]
  );
}

// ---------- Outreach ----------

export async function saveOutreach(
  creatorId: number,
  channel: "email" | "linkedin" | "x_dm",
  body: string,
  opts: { subject?: string; basedOn?: string[] } = {}
): Promise<void> {
  await query(
    `INSERT INTO outreach (creator_id, channel, subject, body, based_on_json)
     VALUES ($1,$2,$3,$4,$5)`,
    [creatorId, channel, opts.subject ?? null, body, JSON.stringify(opts.basedOn ?? [])]
  );
}

export async function listOutreach(creatorId: number): Promise<any[]> {
  return query(`SELECT * FROM outreach WHERE creator_id = $1 ORDER BY created_at DESC`, [
    creatorId,
  ]);
}

// ---------- CRM ----------

export async function ensureCrmRow(creatorId: number): Promise<any> {
  const existing = await one(`SELECT * FROM crm WHERE creator_id = $1`, [creatorId]);
  if (existing) return existing;
  await query(`INSERT INTO crm (creator_id) VALUES ($1) ON CONFLICT (creator_id) DO NOTHING`, [
    creatorId,
  ]);
  return one(`SELECT * FROM crm WHERE creator_id = $1`, [creatorId]);
}

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
): Promise<void> {
  await ensureCrmRow(creatorId);
  const cols = Object.keys(fields);
  if (cols.length === 0) return;
  const setClause = cols.map((c, i) => `${c} = $${i + 1}`).join(", ");
  await query(
    `UPDATE crm SET ${setClause}, updated_at = now() WHERE creator_id = $${cols.length + 1}`,
    [...cols.map((c) => (fields as any)[c]), creatorId]
  );
}

export async function getCrm(creatorId: number): Promise<any> {
  return one(`SELECT * FROM crm WHERE creator_id = $1`, [creatorId]);
}

export async function listPipeline(): Promise<any[]> {
  return query(
    `SELECT c.*, cr.status as crm_status, cr.opportunity_value_usd, cr.close_probability_pct
     FROM crm cr JOIN creators c ON c.id = cr.creator_id
     ORDER BY cr.updated_at DESC`
  );
}

// ---------- Follow-ups ----------

export async function saveFollowUp(
  creatorId: number,
  dayOffset: 7 | 21 | 60,
  scheduledDate: string,
  body: string,
  channel = "email"
): Promise<void> {
  await query(
    `INSERT INTO follow_ups (creator_id, day_offset, scheduled_date, channel, body)
     VALUES ($1,$2,$3,$4,$5)`,
    [creatorId, dayOffset, scheduledDate, channel, body]
  );
}

export async function listFollowUps(creatorId: number): Promise<any[]> {
  return query(
    `SELECT * FROM follow_ups WHERE creator_id = $1 ORDER BY scheduled_date ASC`,
    [creatorId]
  );
}

export async function dueFollowUps(): Promise<any[]> {
  return query(
    `SELECT f.*, c.name as creator_name FROM follow_ups f
     JOIN creators c ON c.id = f.creator_id
     WHERE f.status = 'scheduled' AND f.scheduled_date <= CURRENT_DATE
     ORDER BY f.scheduled_date ASC`
  );
}

// ---------- Pipeline runs ----------

export async function startPipelineRun(creatorId: number): Promise<number> {
  const row = await one<{ id: number }>(
    `INSERT INTO pipeline_runs (creator_id) VALUES ($1) RETURNING id`,
    [creatorId]
  );
  return row!.id;
}

export async function logPipelineStep(runId: number, message: string): Promise<void> {
  const row = await one<{ log_json: string }>(
    `SELECT log_json FROM pipeline_runs WHERE id = $1`,
    [runId]
  );
  const log = JSON.parse(row?.log_json || "[]");
  log.push({ at: new Date().toISOString(), message });
  await query(`UPDATE pipeline_runs SET log_json = $1 WHERE id = $2`, [
    JSON.stringify(log),
    runId,
  ]);
}

export async function finishPipelineRun(
  runId: number,
  status: "completed" | "failed"
): Promise<void> {
  await query(`UPDATE pipeline_runs SET status = $1, finished_at = now() WHERE id = $2`, [
    status,
    runId,
  ]);
}

export async function recentPipelineRuns(limit = 20): Promise<any[]> {
  return query(
    `SELECT pr.*, c.name as creator_name FROM pipeline_runs pr
     JOIN creators c ON c.id = pr.creator_id
     ORDER BY pr.started_at DESC LIMIT $1`,
    [limit]
  );
}

// ---------- Discovery sweeps ----------

export async function startDiscoverySweep(queries: string[]): Promise<number> {
  const row = await one<{ id: number }>(
    `INSERT INTO discovery_sweeps (queries_json) VALUES ($1) RETURNING id`,
    [JSON.stringify(queries)]
  );
  return row!.id;
}

export async function finishDiscoverySweep(
  sweepId: number,
  status: "completed" | "failed",
  fields: {
    channels_found?: number;
    already_known?: number;
    out_of_range?: number;
    new_candidate_names?: string[];
    warnings?: string[];
  }
): Promise<void> {
  await query(
    `UPDATE discovery_sweeps SET
       status = $1, finished_at = now(),
       channels_found = $2, already_known = $3, out_of_range = $4,
       new_candidate_names = $5, warnings_json = $6
     WHERE id = $7`,
    [
      status,
      fields.channels_found ?? null,
      fields.already_known ?? null,
      fields.out_of_range ?? null,
      JSON.stringify(fields.new_candidate_names ?? []),
      JSON.stringify(fields.warnings ?? []),
      sweepId,
    ]
  );
}

export async function recentDiscoverySweeps(limit = 10): Promise<any[]> {
  return query(
    `SELECT * FROM discovery_sweeps ORDER BY started_at DESC LIMIT $1`,
    [limit]
  );
}

export async function clearDiscoverySweepHistory(): Promise<void> {
  await query(`DELETE FROM discovery_sweeps`);
}

// ---------- Relationship triggers ----------

export async function saveRelationshipTrigger(
  creatorId: number,
  fields: {
    triggerFound: boolean;
    triggerLabel?: string;
    evidence?: string;
    angle: string;
    whyNow?: string;
  }
): Promise<void> {
  await query(
    `INSERT INTO relationship_triggers (creator_id, trigger_found, trigger_label, evidence, angle, why_now)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      creatorId,
      fields.triggerFound,
      fields.triggerLabel ?? null,
      fields.evidence ?? null,
      fields.angle,
      fields.whyNow ?? null,
    ]
  );
}

export async function latestRelationshipTrigger(creatorId: number): Promise<any> {
  return one(
    `SELECT * FROM relationship_triggers WHERE creator_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [creatorId]
  );
}
