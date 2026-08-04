import "dotenv/config";
import crypto from "node:crypto";
import express, { type NextFunction, type Request, type RequestHandler, type Response } from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
  allLatestAudits,
  finishDiscoverySweep,
  getCreator,
  getCrm,
  latestOpportunityScore,
  latestProposal,
  latestSnapshot,
  listCreators,
  listFollowUps,
  listOutreach,
  listPipeline,
  listUnauditedCreators,
  recentDiscoverySweeps,
  recentPipelineRuns,
  setBusinessEmail,
  startDiscoverySweep,
} from "../db/repo.js";
import { pool } from "../db/client.js";
import { runCreatorPipeline, runFullAuditPipeline } from "../pipeline/runCreatorPipeline.js";
import { runDiscoverySweep, DEFAULT_ICP_QUERIES } from "../agents/discoverySweep.js";
import type { AuditAgent, CreatorSeed } from "../types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

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

    const scored = (
      await Promise.all(
        creators.map(async (c) => ({ creator: c, score: await latestOpportunityScore(c.id) }))
      )
    ).filter((x) => x.score);

    const topOpportunities = scored
      .sort((a, b) => b.score.overall_score - a.score.overall_score)
      .slice(0, 10)
      .map((x) => ({ ...x.creator, ...x.score }));

    const highPriority = scored.filter((x) => x.score.priority === "High").length;

    const proposals = (
      await pool.query(`SELECT * FROM proposals ORDER BY created_at DESC LIMIT 8`)
    ).rows;

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
        proposalsGenerated: proposals.length,
        pipelineValueK,
        activeInPipeline: pipelineRows.length,
        needsAudit: unaudited.length,
      },
      topOpportunities,
      recentReports: proposals,
      recentCreators: creators.slice(0, 8),
      unaudited,
    });
  })
);

// ---------- Pipeline / CRM ----------

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
    res.render("pipeline", { rows, runs });
  })
);

// ---------- Discover ----------

app.get(
  "/discover",
  ah(async (_req, res) => {
    const sweeps = await recentDiscoverySweeps(5);
    res.render("discover", {
      queued: null,
      sweepQueued: false,
      defaultQueries: DEFAULT_ICP_QUERIES,
      sweeps,
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
    // The sweep run row is what makes progress visible on the Discover page instead of only
    // a server console log nobody watching the deployed app can see.
    runDiscoverySweep({ queries }).then(
      (outcome) =>
        finishDiscoverySweep(sweepId, "completed", {
          channels_found: outcome.channelsFound,
          already_known: outcome.alreadyKnown,
          out_of_range: outcome.outOfRange,
          new_candidate_names: outcome.newCandidates.map((c) => c.creator.name),
          warnings: outcome.warnings,
        }),
      (err) =>
        finishDiscoverySweep(sweepId, "failed", { warnings: [String(err?.message ?? err)] })
    );

    const sweeps = await recentDiscoverySweeps(5);
    res.render("discover", {
      queued: null,
      sweepQueued: true,
      defaultQueries: DEFAULT_ICP_QUERIES,
      sweeps,
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

    const [score, snapshot, proposal, crm, rawAudits, outreach, followUps] = await Promise.all([
      latestOpportunityScore(id),
      latestSnapshot(id),
      latestProposal(id),
      getCrm(id),
      allLatestAudits(id),
      listOutreach(id),
      listFollowUps(id),
    ]);

    const audits = rawAudits.map((a) => ({
      agent: a.agent,
      label: AGENT_LABELS[a.agent as AuditAgent] ?? a.agent,
      score: a.score,
      grade: a.grade,
      summary: a.summary,
      findings: JSON.parse(a.findings_json || "[]"),
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
      auditQueued: req.query.auditQueued === "1",
    });
  })
);

app.get(
  "/creators/:id/proposal",
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const proposal = await latestProposal(id);
    if (!proposal?.html_path || !fs.existsSync(proposal.html_path)) {
      res.status(404).send("No proposal generated for this creator yet.");
      return;
    }
    res.sendFile(path.resolve(proposal.html_path));
  })
);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Dashboard route error:", err);
  res.status(500).send("Something went wrong loading this page — check the server logs.");
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`ThoughtCloud Digital BD dashboard running at http://localhost:${PORT}`);
});
