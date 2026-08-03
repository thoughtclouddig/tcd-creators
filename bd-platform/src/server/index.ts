import "dotenv/config";
import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
  allLatestAudits,
  getCreator,
  getCrm,
  latestOpportunityScore,
  latestProposal,
  latestSnapshot,
  listCreators,
  listFollowUps,
  listOutreach,
  listPipeline,
  recentPipelineRuns,
} from "../db/repo.js";
import { db } from "../db/client.js";
import { runCreatorPipeline } from "../pipeline/runCreatorPipeline.js";
import type { AuditAgent, CreatorSeed } from "../types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));

const AGENT_LABELS: Record<AuditAgent, string> = {
  website: "Website",
  ownership: "Audience Ownership",
  merch: "Merchandise",
  monetization: "Monetization",
  community: "Community",
  ai_opportunity: "AI Opportunity",
  topfan: "TopFan Fit",
};

// ---------- Home ----------

app.get("/", (_req, res) => {
  const creators = listCreators();
  const today = new Date().toISOString().slice(0, 10);
  const discoveredToday = creators.filter((c) => c.discovered_at?.startsWith(today)).length;

  const scored = creators
    .map((c) => ({ creator: c, score: latestOpportunityScore(c.id) }))
    .filter((x) => x.score);

  const topOpportunities = scored
    .sort((a, b) => b.score.overall_score - a.score.overall_score)
    .slice(0, 10)
    .map((x) => ({ ...x.creator, ...x.score }));

  const highPriority = scored.filter((x) => x.score.priority === "High").length;

  const proposals = db
    .prepare(`SELECT * FROM proposals ORDER BY created_at DESC LIMIT 8`)
    .all() as any[];

  const pipelineRows = listPipeline();
  const pipelineValueK = Math.round(
    pipelineRows.reduce((sum, r) => sum + (r.opportunity_value_usd || 0), 0) / 1000
  );

  res.render("home", {
    stats: {
      totalCreators: creators.length,
      discoveredToday,
      highPriority,
      proposalsGenerated: proposals.length,
      pipelineValueK,
      activeInPipeline: pipelineRows.length,
    },
    topOpportunities,
    recentReports: proposals,
    recentCreators: creators.slice(0, 8),
  });
});

// ---------- Pipeline / CRM ----------

app.get("/pipeline", (_req, res) => {
  const rows = listPipeline().map((r) => ({
    ...r,
    followUpCount: listFollowUps(r.id).length,
  }));
  const runs = recentPipelineRuns(20);
  res.render("pipeline", { rows, runs });
});

// ---------- Discover ----------

app.get("/discover", (_req, res) => {
  res.render("discover", { queued: null });
});

app.post("/discover", (req, res) => {
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

  res.render("discover", { queued: seed.name });
});

// ---------- Creator detail ----------

app.get("/creators/:id", (req, res) => {
  const id = Number(req.params.id);
  const creator = getCreator(id);
  if (!creator) {
    res.status(404).send("Creator not found");
    return;
  }

  const score = latestOpportunityScore(id);
  const snapshot = latestSnapshot(id);
  const proposal = latestProposal(id);
  const crm = getCrm(id);

  const audits = allLatestAudits(id).map((a) => ({
    agent: a.agent,
    label: AGENT_LABELS[a.agent as AuditAgent] ?? a.agent,
    score: a.score,
    grade: a.grade,
    summary: a.summary,
    findings: JSON.parse(a.findings_json || "[]"),
  }));

  const outreach = listOutreach(id);
  const followUps = listFollowUps(id);

  res.render("creator", {
    creator,
    score,
    snapshot,
    proposal,
    crm,
    audits,
    outreach,
    followUps,
  });
});

app.get("/creators/:id/proposal", (req, res) => {
  const id = Number(req.params.id);
  const proposal = latestProposal(id);
  if (!proposal?.html_path || !fs.existsSync(proposal.html_path)) {
    res.status(404).send("No proposal generated for this creator yet.");
    return;
  }
  res.sendFile(path.resolve(proposal.html_path));
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`ThoughtCloud Digital BD dashboard running at http://localhost:${PORT}`);
});
