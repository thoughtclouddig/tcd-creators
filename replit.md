# ThoughtCloud Digital — BD Platform

An autonomous business-development platform: 14 AI agents that discover a creator, audit their business across 7 dimensions, score the opportunity, generate an executive proposal, and draft personalized outreach — all backed by Replit's built-in PostgreSQL database.

## How to run

The workflow `Start application` starts the Express dashboard on port 5000:

```
cd bd-platform && npm install --include=dev && PORT=5000 ./node_modules/.bin/tsx src/server/index.ts
```

Open the preview to see the dashboard. From there you can go to **Discover** to seed a creator and kick off the full pipeline, or watch progress on the **Pipeline** page.

To run the pipeline from the CLI instead:

```bash
cd bd-platform
npm run pipeline -- --name "Creator Name" --website "https://example.com" \
  --youtube-handle handlename --topics "topic1,topic2"
```

## Required secrets

| Secret | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ Yes | Drives all 13 Claude calls per pipeline run (audits, proposal, outreach) |
| `YOUTUBE_API_KEY` | Optional | Real YouTube stats in Agent 1/2; falls back to manual seed values without it |
| `SPOTIFY_CLIENT_ID` | Optional | Spotify show lookup in Agent 1 |
| `SPOTIFY_CLIENT_SECRET` | Optional | Spotify show lookup in Agent 1 |

## Data

Replit's built-in PostgreSQL database (connection via `DATABASE_URL`, provided automatically in both development and production). The schema in `bd-platform/src/db/schema.sql` is applied idempotently at startup by `initDb()` (called from `src/server/index.ts` and `src/pipeline/cli.ts`). Data persists across republishes — this was the reason for migrating off SQLite (August 2026).

## Notes on the environment

- `NODE_ENV=production` is set globally in `.replit` — always use `npm install --include=dev` to get devDependencies. (`tsx` itself is a regular dependency since production runs it directly.)
- All DB access goes through `bd-platform/src/db/repo.ts` (async, `pg` Pool). Route handlers and agents must `await` repo calls.

## Stack

- **Runtime**: Node.js + TypeScript (`tsx` for dev)
- **Framework**: Express + EJS templates
- **AI**: Anthropic Claude (`@anthropic-ai/sdk`)
- **DB**: PostgreSQL (Replit built-in) via `pg`
- **External APIs**: YouTube Data API v3, Spotify (client-credentials), RSS/web scraping

## User preferences

- Keep existing project structure — do not restructure or migrate the stack.
- `NODE_ENV=production` is set globally in `.replit`; always use `npm install --include=dev` to ensure `tsx` and other devDependencies are installed.
