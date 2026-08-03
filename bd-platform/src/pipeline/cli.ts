/**
 * Run the full 14-agent pipeline for one creator from the command line.
 *
 * Usage:
 *   npm run pipeline -- --name "Real Baron" --website "https://realbaron.com" \
 *     --youtube-handle realbaronpodcast --topics "politics,commentary"
 *
 * Loads .env automatically. ANTHROPIC_API_KEY is required — nearly every agent past
 * discovery depends on it, so the CLI fails fast with a clear message rather than running
 * a pipeline that will just log fourteen warnings.
 */
import "dotenv/config";
import { hasClaudeKey } from "../lib/claude.js";
import { runCreatorPipeline } from "./runCreatorPipeline.js";
import type { CreatorSeed } from "../types.js";

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      out[key] = value;
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.name) {
    console.error(
      'Missing --name. Example:\n  npm run pipeline -- --name "Real Baron" --website "https://realbaron.com" --youtube-handle realbaronpodcast'
    );
    process.exit(1);
  }

  if (!hasClaudeKey()) {
    console.error(
      "ANTHROPIC_API_KEY is not set. Add it to .env (or Replit Secrets) — Agents 3-14 all depend on it.\n" +
        "Copy .env.example to .env and fill it in, then re-run."
    );
    process.exit(1);
  }

  const seed: CreatorSeed = {
    name: args.name,
    brand: args.brand,
    website: args.website,
    youtube_channel_id: args["youtube-channel"],
    youtube_handle: args["youtube-handle"],
    spotify_show_id: args["spotify-show"],
    substack_url: args.substack,
    x_handle: args["x-handle"],
    topics: args.topics ? args.topics.split(",").map((t) => t.trim()) : undefined,
    political_alignment: args["political-alignment"],
  };

  console.log(`Running full pipeline for ${seed.name}...\n`);
  const result = await runCreatorPipeline(seed);

  console.log(`\nStatus: ${result.status}`);
  if (result.proposalPath) console.log(`Proposal: ${result.proposalPath}`);
  if (result.warnings.length) {
    console.log(`\nWarnings (${result.warnings.length}):`);
    result.warnings.forEach((w) => console.log(`  - ${w}`));
  }
  console.log(`\nOpen the dashboard (npm run dashboard) to review creator #${result.creatorId}.`);
}

main().catch((err) => {
  console.error("Pipeline crashed:", err);
  process.exit(1);
});
