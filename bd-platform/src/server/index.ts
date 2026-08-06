import "dotenv/config";
import crypto from "node:crypto";
import express, { type NextFunction, type Request, type RequestHandler, type Response } from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
  allLatestAudits,
  clearDiscoverySweepHistory,
  finishDiscoverySweep,
  getCreator,
  getCrm,
  getFollowUpById,
  getOutreachById,
  latestGmailToken,
  latestOpportunityScore,
  latestProposal,
  latestRelationshipTrigger,
  latestSnapshot,
  listCreators,
  listFollowUps,
  listOutreach,
  listPipeline,
  listUnauditedCreators,
  markFollowUpSent,
  markOutreachSent,
  recentDiscoverySweeps,
  recentPipelineRuns,
  setBusinessEmail,
  startDiscoverySweep,
  updateCrm,
} from "../db/repo.js";
import { pool } from "../db/client.js";
import { runCreatorPipeline, runFullAuditPipeline } from "../pipeline/runCreatorPipeline.js";
import { runDiscoverySweep, DEFAULT_ICP_QUERIES } from "../agents/discoverySweep.js";
import { runProposalGenerator } from "../agents/proposal.js";
import { runOutreachWriter } from "../agents/outreach.js";
import { runFollowUpScheduler } from "../agents/followUp.js";
import { CRM_STATUS_LABELS, CRM_STATUSES, STAGE_CLOSE_PROBABILITY } from "../lib/crmStages.js";
import { getAuthUrl, handleOAuthCallback, isGoogleConfigured, sendEmail } from "../lib/gmail.js";
import type { AuditAgent, CreatorSeed } from "../types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Replit's proxy terminates TLS and forwards over plain HTTP, setting X-Forwarded-Proto:
// https. Without trust proxy, req.protocol ignores that header and always reads "http" here --
// which broke the Google OAuth redirect_uri (computed as http://... while Google Cloud Console
// has https://... registered, a mismatch Google rejects outright).
app.set("trust proxy", 1);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// pg returns TIMESTAMPTZ/DATE columns as JS Date objects, not strings. Interpolating those
// directly into a template calls Date.prototype.toString(), which prints the full verbose
// "Tue Aug 04 2026 14:51:18 GMT+0000 (Coordinated Universal Time)" form everywhere a date
// appears. app.locals makes these callable from every EJS template without passing them
// through each individual res.render() call.
app.locals.fmtDate = (value: Date | string | null | undefined): string => {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};
app.locals.fmtDateOnly = (value: Date | string | null | undefined): string => {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
app.locals.fmtNum = (value: number | string | null | undefined): string => {
  if (value == null || value === "") return "—";
  const n = Number(value);
  return Number.isNaN(n) ? String(value) : n.toLocaleString("en-US");
};

// ---------- Auth ----------
// Simple HTTP Basic Auth — sufficient for a single-operator internal tool. Required in every
// environment: without DASHBOARD_USERNAME/PASSWORD set, the app refuses to boot rather than
// silently serving business data (audits, outreach drafts, CRM) with no protection.
if (!process.env.DASHBOARD_USERNAME || !process.env.DASHBOARD_PASSWORD) {
  throw new Error(
    "DASHBOARD_USERNAME and DASHBOARD_PASSWORD must be set (Replit Secrets, or .env locally) " +
      "— the dashboard holds real prospect/business data and must not run unprotected."
  );
}

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

app.use((req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (header?.startsWith("Basic ")) {
    const [user, pass] = Buffer.from(header.slice(6), "base64").toString().split(":");
    if (
      timingSafeEqual(user ?? "", process.env.DASHBOARD_USERNAME!) &&
      timingSafeEqual(pass ?? "", process.env.DASHBOARD_PASSWORD!)
    ) {
      next();
      return;
    }
  }
  res.set("WWW-Authenticate", 'Basic realm="ThoughtCloud Digital"');
  res.status(401).send("Authentication required.");
});

app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Gmail connection status on every page, without threading it through each res.render() call —
// res.locals is merged into the view automatically, same pattern as the app.locals helpers below.
app.use(async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const token = await latestGmailToken();
    res.locals.gmailConnected = !!token?.refresh_token;
    res.locals.gmailEmail = token?.email ?? null;
  } catch {
    res.locals.gmailConnected = false;
    res.locals.gmailEmail = null;
  }
  next();
});

function redirectUriFor(req: Request): string {
  return process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get("host")}/auth/google/callback`;
}

// Async route handlers reject on error rather than throwing synchronously — Express 4 won't
// route that to error middleware on its own, so every async handler is wrapped to forward it.
function ah(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    fn(req, res).catch(next);
  };
}

const AGENT_LABELS: Record<AuditAgent, string> = {
  website: "Website",
  ownership: "Audience Ownership",
  merch: "Merchandise",
  monetization: "Monetization",
  community: "Community",
  ai_opportunity: "AI Opportunity",
  topfan: "TopFan Fit",
};

function toDateOnly(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  return d.toISOString().slice(0, 10);
}

// Claude's tool-use schema is a strong hint to the model, not a guarantee -- an audit's
// findings/recommendations JSON occasionally comes back as something other than an array
// (a single object, a string, etc). Parsing that into a template that immediately calls
// .slice()/.forEach() on it crashes the whole page. Coerce to [] instead of trusting the shape.
function safeJsonArray(raw: string | null | undefined): any[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ---------- Home ----------

app.get(
  "/",
  ah(async (_req, res) => {
    const creators = await listCreators();
    const today = new Date().toISOString().slice(0, 10);
    // pg returns TIMESTAMPTZ columns as Date objects, not strings — normalize before comparing.
    const discoveredToday = creators.filter(
      (c) => c.discovered_at && toDateOnly(c.discovered_at) === today
    ).length;

    // Only creators with an actual opportunity_scores row AND every one of the 7 audit agents
    // completed belong in Top Opportunities. Scoring runs even if some agents failed (a Claude
    // call errored, e.g.) using a 50-default for the missing ones, so a score existing alone
    // doesn't guarantee a real audit backs it — check the audit count too, not just the score.
    const REQUIRED_AUDIT_COUNT = 7;
    const scored = (
      await Promise.all(
        creators.map(async (c) => ({
          creator: c,
          score: await latestOpportunityScore(c.id),
          auditCount: (await allLatestAudits(c.id)).length,
        }))
      )
    ).filter((x) => x.score && x.auditCount >= REQUIRED_AUDIT_COUNT);

    // NEVER spread creator + score together (`{...x.creator, ...x.score}`) -- opportunity_scores
    // has its own `id` primary key column, and spreading it after the creator silently
    // overwrites the creator's id with the score row's id. Every link on this page pointed at
    // whatever creator happened to share that unrelated numeric id. Explicit fields only.
    const topOpportunities = scored
      .sort((a, b) => b.score.overall_score - a.score.overall_score)
      .slice(0, 10)
      .map((x) => ({
        id: x.creator.id,
        name: x.creator.name,
        overall_score: x.score.overall_score,
        priority: x.score.priority,
        topfan_fit_score: x.score.topfan_fit_score,
        estimated_revenue_opportunity: x.score.estimated_revenue_opportunity,
      }));

    const highPriority = scored.filter((x) => x.score.priority === "High").length;

    const proposalCount = (
      await pool.query(`SELECT COUNT(*)::int AS count FROM proposals`)
    ).rows[0].count;

    const pipelineRows = await listPipeline();
    const pipelineValueK = Math.round(
      pipelineRows.reduce((sum, r) => sum + (r.opportunity_value_usd || 0), 0) / 1000
    );

    const unaudited = await Promise.all(
      (await listUnauditedCreators()).slice(0, 10).map(async (c) => ({
        ...c,
        momentum_score: (await latestSnapshot(c.id))?.momentum_score ?? null,
      }))
    );

    res.render("home", {
      stats: {
        totalCreators: creators.length,
        discoveredToday,
        highPriority,
        proposalsGenerated: proposalCount,
        pipelineValueK,
        activeInPipeline: pipelineRows.length,
        needsAudit: unaudited.length,
      },
      topOpportunities,
      unaudited,
    });
  })
);

// ---------- Gmail connect ----------

app.get(
  "/auth/google",
  ah(async (req, res) => {
    if (!isGoogleConfigured()) {
      res
        .status(500)
        .send("Gmail isn't configured — set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET first.");
      return;
    }
    res.redirect(getAuthUrl(redirectUriFor(req)));
  })
);

app.get(
  "/auth/google/callback",
  ah(async (req, res) => {
    const code = req.query.code as string | undefined;
    if (!code) {
      res.status(400).send("Missing authorization code.");
      return;
    }
    await handleOAuthCallback(code, redirectUriFor(req));
    res.redirect("/");
  })
);

// ---------- Pipeline / CRM ----------

app.locals.crmStatusLabel = (status: string): string => CRM_STATUS_LABELS[status] ?? status;

app.get(
  "/pipeline",
  ah(async (_req, res) => {
    const pipelineRows = await listPipeline();
    const rows = await Promise.all(
      pipelineRows.map(async (r) => ({
        ...r,
        followUpCount: (await listFollowUps(r.id)).length,
      }))
    );
    const runs = await recentPipelineRuns(20);
    const statusColumns = CRM_STATUSES.map((key) => ({ key, label: CRM_STATUS_LABELS[key] }));
    res.render("pipeline", { rows, runs, statusColumns });
  })
);

app.post(
  "/creators/:id/crm-status",
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const status = (req.body as Record<string, string>).status;
    if (!CRM_STATUSES.includes(status)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }
    const closeProbabilityPct = STAGE_CLOSE_PROBABILITY[status];
    await updateCrm(id, { status, close_probability_pct: closeProbabilityPct });
    res.json({ ok: true, close_probability_pct: closeProbabilityPct });
  })
);

// ---------- Discover ----------

// Runs the sweep against an already-created sweep row and records the result. Shared by the
// manual POST route (which pre-creates the row synchronously so it's visible on render) and
// the daily auto-retry scheduler below (which creates and runs in one step).
async function executeSweepAndFinish(sweepId: number, queries: string[]): Promise<void> {
  try {
    const outcome = await runDiscoverySweep({ queries });
    await finishDiscoverySweep(sweepId, "completed", {
      channels_found: outcome.channelsFound,
      already_known: outcome.alreadyKnown,
      out_of_range: outcome.outOfRange,
      new_candidate_names: outcome.newCandidates.map((c) => c.creator.name),
      warnings: outcome.warnings,
    });
  } catch (err: any) {
    await finishDiscoverySweep(sweepId, "failed", { warnings: [String(err?.message ?? err)] });
  }
}

async function runTrackedSweep(queries: string[]): Promise<void> {
  const sweepId = await startDiscoverySweep(queries);
  await executeSweepAndFinish(sweepId, queries);
}

function pacificDateString(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// YouTube's search quota resets at midnight Pacific. Rather than making the user remember to
// come back and re-click, check hourly whether a sweep has run yet for today's Pacific date --
// if not, run one automatically. This also means a quota-exhausted sweep naturally gets retried
// the next day without anyone having to do anything.
let lastAutoSweepPacificDate: string | null = null;
async function maybeRunDailyAutoSweep(): Promise<void> {
  const today = pacificDateString(new Date());
  if (lastAutoSweepPacificDate === today) return;
  const [latest] = await recentDiscoverySweeps(1);
  if (latest && pacificDateString(new Date(latest.started_at)) === today) {
    lastAutoSweepPacificDate = today;
    return;
  }
  lastAutoSweepPacificDate = today;
  console.log(`Auto-running daily discovery sweep for ${today} (Pacific)`);
  await runTrackedSweep(DEFAULT_ICP_QUERIES);
}
setInterval(() => {
  maybeRunDailyAutoSweep().catch((err) => console.error("Auto sweep check failed:", err));
}, 60 * 60 * 1000);
setTimeout(() => {
  maybeRunDailyAutoSweep().catch((err) => console.error("Auto sweep check failed:", err));
}, 30 * 1000);

app.post(
  "/discover/sweeps/clear",
  ah(async (_req, res) => {
    await clearDiscoverySweepHistory();
    res.redirect("/discover");
  })
);

app.get(
  "/discover",
  ah(async (_req, res) => {
    const sweeps = await recentDiscoverySweeps(5);
    const quotaExhaustedToday =
      sweeps[0]?.status === "completed" &&
      pacificDateString(new Date(sweeps[0].started_at)) === pacificDateString(new Date()) &&
      JSON.parse(sweeps[0].warnings_json || "[]").some((w: string) => /quota/i.test(w));
    res.render("discover", {
      queued: null,
      sweepQueued: false,
      defaultQueries: DEFAULT_ICP_QUERIES,
      sweeps,
      quotaExhaustedToday,
    });
  })
);

app.post(
  "/discover/sweep",
  ah(async (req, res) => {
    const body = req.body as Record<string, string>;
    const queries = body.queries
      ? body.queries.split("\n").map((q) => q.trim()).filter(Boolean)
      : DEFAULT_ICP_QUERIES;

    const sweepId = await startDiscoverySweep(queries);
    // Fire and forget — a sweep across several queries plus per-candidate stats lookups takes
    // a while, but unlike the full audit pipeline it's cheap (YouTube API only, no Claude).
    // The sweep row (created synchronously above) is what makes progress visible on the
    // Discover page instead of only a server console log nobody watching can see.
    executeSweepAndFinish(sweepId, queries).catch((err) =>
      console.error("Sweep execution failed:", err)
    );

    const sweeps = await recentDiscoverySweeps(5);
    res.render("discover", {
      queued: null,
      sweepQueued: true,
      defaultQueries: DEFAULT_ICP_QUERIES,
      sweeps,
      quotaExhaustedToday: false,
    });
  })
);

app.post(
  "/creators/:id/audit",
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const creator = await getCreator(id);
    if (!creator) {
      res.status(404).send("Creator not found");
      return;
    }
    // Fire and forget, same as full discovery — this is the expensive, Claude-driven path
    // a human triggers deliberately for a candidate the sweep surfaced.
    runFullAuditPipeline(id).catch((err) => {
      console.error(`Full audit failed for creator ${id}:`, err);
    });
    res.redirect(`/creators/${id}?auditQueued=1`);
  })
);

app.post(
  "/creators/:id/regenerate-proposal",
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const creator = await getCreator(id);
    if (!creator) {
      res.status(404).send("Creator not found");
      return;
    }
    const score = await latestOpportunityScore(id);
    if (!score) {
      res.status(400).send("No opportunity score yet — run the full audit first.");
      return;
    }
    // Re-renders the proposal from already-computed audit/score data. Only re-writes the two
    // short narrative passages (executive summary, closing letter) via Claude -- the audits,
    // scoring, and everything else are reused as-is, so this is fast and cheap compared to
    // the full pipeline. Synchronous (not fire-and-forget) since it only takes a few seconds.
    await runProposalGenerator(id);
    res.redirect(`/creators/${id}`);
  })
);

app.post(
  "/creators/:id/regenerate-outreach",
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const creator = await getCreator(id);
    if (!creator) {
      res.status(404).send("Creator not found");
      return;
    }
    // Synchronous -- 1 outreach call + 3 follow-up calls, a few seconds, not the full pipeline.
    const outcome = await runOutreachWriter(id);
    await runFollowUpScheduler(id, outcome.emailBody);
    res.redirect(`/creators/${id}`);
  })
);

// A send only ever fires from an explicit click on a specific already-generated draft — never
// from a schedule or an agent decision. bumpCrmOnSend only advances the CRM stage forward from
// "new"/"drafts_ready"; it never overwrites a stage a human has already progressed further
// (replied, meeting_booked, ...), since a send here doesn't mean anything changed for a creator
// who's already mid-conversation.
const PRE_CONTACT_STATUSES = ["new", "drafts_ready"];
async function bumpCrmOnSend(creatorId: number) {
  const crm = await getCrm(creatorId);
  const fields: Partial<{ status: string; emails_sent: number; close_probability_pct: number }> = {
    emails_sent: (crm?.emails_sent ?? 0) + 1,
  };
  if (!crm || PRE_CONTACT_STATUSES.includes(crm.status)) {
    fields.status = "contacted";
    fields.close_probability_pct = STAGE_CLOSE_PROBABILITY.contacted;
  }
  await updateCrm(creatorId, fields);
}

app.post(
  "/creators/:id/outreach/:outreachId/send",
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const outreachId = Number(req.params.outreachId);
    const creator = await getCreator(id);
    const draft = await getOutreachById(outreachId);
    if (!creator || !draft || draft.creator_id !== id) {
      res.status(404).send("Draft not found");
      return;
    }
    if (draft.channel !== "email") {
      res.status(400).send("Only the email draft can be sent from here — LinkedIn and X are copy-only.");
      return;
    }
    if (!creator.business_email) {
      res.status(400).send("Add a business email for this creator before sending.");
      return;
    }
    await sendEmail({
      to: creator.business_email,
      subject: draft.subject || creator.name,
      body: draft.body,
      fromName: "Andy",
    });
    await markOutreachSent(outreachId);
    await bumpCrmOnSend(id);
    res.redirect(`/creators/${id}`);
  })
);

app.post(
  "/creators/:id/followups/:followUpId/send",
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const followUpId = Number(req.params.followUpId);
    const creator = await getCreator(id);
    const followUp = await getFollowUpById(followUpId);
    if (!creator || !followUp || followUp.creator_id !== id) {
      res.status(404).send("Follow-up not found");
      return;
    }
    if (!creator.business_email) {
      res.status(400).send("Add a business email for this creator before sending.");
      return;
    }
    await sendEmail({
      to: creator.business_email,
      subject: `Following up`,
      body: followUp.body,
      fromName: "Andy",
    });
    await markFollowUpSent(followUpId);
    await bumpCrmOnSend(id);
    res.redirect(`/creators/${id}`);
  })
);

app.post(
  "/creators/:id/business-email",
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const creator = await getCreator(id);
    if (!creator) {
      res.status(404).send("Creator not found");
      return;
    }
    const email = ((req.body as Record<string, string>).business_email || "").trim();
    await setBusinessEmail(id, email);
    res.redirect(`/creators/${id}`);
  })
);

app.post(
  "/discover",
  ah(async (req, res) => {
    const body = req.body as Record<string, string>;
    if (!body.name) {
      res.status(400).send("Name is required");
      return;
    }

    const seed: CreatorSeed = {
      name: body.name,
      brand: body.brand || undefined,
      website: body.website || undefined,
      youtube_handle: body.youtube_handle || undefined,
      youtube_channel_id: body.youtube_channel_id || undefined,
      substack_url: body.substack_url || undefined,
      x_handle: body.x_handle || undefined,
      topics: body.topics ? body.topics.split(",").map((t) => t.trim()) : undefined,
      political_alignment: body.political_alignment || undefined,
    };

    // Fire and forget — the pipeline takes minutes (many Claude calls). The dashboard's
    // pipeline_runs log is the source of truth for progress; we don't block the request on it.
    runCreatorPipeline(seed).catch((err) => {
      console.error(`Pipeline failed for ${seed.name}:`, err);
    });

    const sweeps = await recentDiscoverySweeps(5);
    res.render("discover", {
      queued: seed.name,
      sweepQueued: false,
      defaultQueries: DEFAULT_ICP_QUERIES,
      sweeps,
    });
  })
);

// ---------- Creator detail ----------

app.get(
  "/creators/:id",
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const creator = await getCreator(id);
    if (!creator) {
      res.status(404).send("Creator not found");
      return;
    }

    const [score, snapshot, proposal, crm, rawAudits, outreach, followUps, trigger] = await Promise.all([
      latestOpportunityScore(id),
      latestSnapshot(id),
      latestProposal(id),
      getCrm(id),
      allLatestAudits(id),
      listOutreach(id),
      listFollowUps(id),
      latestRelationshipTrigger(id),
    ]);

    const audits = rawAudits.map((a) => ({
      agent: a.agent,
      label: AGENT_LABELS[a.agent as AuditAgent] ?? a.agent,
      score: a.score,
      grade: a.grade,
      summary: a.summary,
      findings: safeJsonArray(a.findings_json),
    }));

    res.render("creator", {
      creator,
      score,
      snapshot,
      proposal,
      crm,
      audits,
      outreach,
      followUps,
      trigger,
      auditQueued: req.query.auditQueued === "1",
    });
  })
);

app.get(
  "/creators/:id/proposal",
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const proposal = await latestProposal(id);
    // html_content in the database is the source of truth -- local disk (html_path) is a
    // best-effort convenience for local dev only and does not survive a redeploy.
    if (!proposal?.html_content) {
      res.status(404).send("No proposal generated for this creator yet.");
      return;
    }
    res.type("html").send(proposal.html_content);
  })
);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Dashboard route error:", err);
  // This dashboard is already behind login and single-operator — showing the real error here
  // (instead of a generic message forcing a trip to server logs) is a deliberate, temporary
  // debugging aid, not a public-facing information leak.
  const e = err as { message?: string; stack?: string };
  res
    .status(500)
    .type("text/plain")
    .send(
      `Something went wrong loading this page.\n\n${e?.message ?? String(err)}\n\n${e?.stack ?? ""}`
    );
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`ThoughtCloud Digital BD dashboard running at http://localhost:${PORT}`);
});
