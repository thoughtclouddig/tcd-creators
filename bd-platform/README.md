# ThoughtCloud Digital — BD Platform (Phase 1)

An autonomous business-development platform for ThoughtCloud Digital: 14 single-responsibility
agents that discover a creator, audit their business across 7 dimensions, score the opportunity,
generate a premium executive proposal, and draft personalized outreach — all reading and writing
through one SQLite database.

This is **Phase 1**: a proven, working pipeline for one creator at a time, triggered manually
(CLI or dashboard form). Phase 2 is turning that into a daily autonomous scan across many
creators — see "What's next" below.

## Architecture

Agents never call each other directly. Each one reads what it needs from the DB and writes its
own result back (`src/types.ts` is the shared contract). `src/pipeline/runCreatorPipeline.ts` is
the only thing that knows the run order:

1. **Discovery** (`agents/discovery.ts`) — seed a creator, enrich with real YouTube/Spotify/Substack data
2. **Audience Intelligence** (`agents/audienceIntelligence.ts`) — momentum, engagement, posting cadence
3. **Website Auditor** (`agents/websiteAuditor.ts`) — live site fetch + cheerio signals + Claude grading (A-F, 15 categories)
4. **Ownership** (`agents/ownership.ts`) — email/SMS/push/app/CRM, platform dependency
5. **Merchandise** (`agents/merch.ts`) — store, pricing, launch strategy, revenue left on the table
6. **Monetization** (`agents/monetization.ts`) — sponsors, affiliates, membership, courses, etc.
7. **Community** (`agents/community.ts`) — Discord/Locals/forums/livestreams
8. **AI Opportunity** (`agents/aiOpportunity.ts`) — episode automation, knowledge base, time saved
9. **TopFan Fit** (`agents/topfan.ts`) — runs after 4/5/7, explains fit in terms of real gaps found
10. **Opportunity Scoring** (`agents/scoring.ts`) — deterministic weighted formula → 0-100 + priority
11. **Executive Proposal** (`agents/proposal.ts` + `proposal/template.ts`) — same design system as the hand-built CAA/Real Baron proposals, populated from real audit data → HTML + Markdown
12. **Outreach Writer** (`agents/outreach.ts`) — email/LinkedIn/X DM, grounded in real site/video specifics
13. **CRM** (`agents/crm.ts`) — seeds status/opportunity value/close probability
14. **Follow-up Scheduler** (`agents/followUp.ts`) — unique 7/21/60-day drafts, generated up front

## Setup

```bash
cd bd-platform
npm install
cp .env.example .env
# fill in ANTHROPIC_API_KEY (required) and YOUTUBE_API_KEY (optional but recommended)
```

**Run the pipeline for one creator:**

```bash
npm run pipeline -- --name "Real Baron" --website "https://realbaron.com" \
  --youtube-handle realbaronpodcast --topics "politics,commentary" \
  --political-alignment "populist-right commentary"
```

**Run the dashboard:**

```bash
npm run dashboard
# open http://localhost:3000
```

You can also seed a creator and kick off the pipeline from the dashboard's **Discover** page —
it runs in the background; refresh **Pipeline** to watch progress.

## Deploying on Replit

Import this repo (or the `bd-platform` folder) into a new Repl. `.replit` is already configured
to `npm install && npm run dashboard`. Add `ANTHROPIC_API_KEY` (and optionally `YOUTUBE_API_KEY`,
`SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`) in **Secrets**. The SQLite file lives at
`./data/tcd.db` inside the Repl's persistent filesystem — no external DB needed for Phase 1.

## Cost note

Each full pipeline run makes ~13 Claude calls (7 audits + narrative + outreach + 3 follow-ups).
At current Sonnet pricing that's roughly a few cents to ~$0.10 per creator depending on site
content length — cheap per-creator, but put a daily cap on creator count once this runs on a
schedule rather than manually.

## What's next (Phase 2 — not built yet)

- **True autonomous discovery**: the brief asks for continuous scanning across YouTube, Rumble,
  Spotify, Apple Podcasts, X, Substack, Locals, Patreon, and conference/news mentions. Of those,
  only YouTube, Spotify, and Substack have real, ToS-compliant APIs for this use case — that's
  what Agent 1 uses today. X, Rumble, Locals, and Patreon don't have public discovery APIs; scraping
  them at scale violates their terms of service. Recommend: a curated intake list (manual or via a
  lightweight submission form) for those platforms rather than automated scraping, or a paid
  data-provider integration if this becomes a priority.
- **Scheduling**: wire `runCreatorPipeline` into a daily cron job (Replit's scheduled deployments,
  or `node-cron` if self-hosting) that pulls from a queue of newly-discovered/curated creators,
  capped at N/day to control API spend.
- **PDF export**: proposals currently export HTML + Markdown only. Wire up a headless-browser
  print-to-PDF step (e.g. `puppeteer`) if a literal PDF file is needed — kept out of Phase 1 to
  avoid the Chromium download weighing down the Replit environment.
- **CRM status transitions**: currently seeded but not editable from the dashboard (status,
  meetings, notes). Add simple POST routes/forms on the creator detail page.
- **Screenshots** for the website audit (the brief asks for them) — would need Playwright/Puppeteer,
  same tradeoff as PDF export above.
