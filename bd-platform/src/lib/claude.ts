import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function hasClaudeKey(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

function getClient(): Anthropic {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Add it to your .env (or Replit Secrets) — required for audit/scoring/writing agents."
      );
    }
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

/**
 * Forces Claude to return a single JSON object matching `schema` by making the
 * schema a required tool call. Every audit/scoring/writing agent goes through this
 * so results are structured, storable, and never depend on parsing prose.
 */
export async function structuredCall<T>(opts: {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  toolName?: string;
  maxTokens?: number;
}): Promise<T> {
  const anthropic = getClient();
  const toolName = opts.toolName || "emit_result";

  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 2000,
    system: opts.system,
    tools: [
      {
        name: toolName,
        description: "Return the structured result. Always call this exactly once.",
        input_schema: opts.schema as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: toolName },
    messages: [{ role: "user", content: opts.prompt }],
  });

  const toolUse = res.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
  );
  if (!toolUse) {
    throw new Error("Claude did not return a tool_use block");
  }
  return toolUse.input as T;
}

/** Plain-text generation for prose (outreach copy, proposal narrative lines). */
export async function textCall(opts: {
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<string> {
  const anthropic = getClient();
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 1200,
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
  });
  const block = res.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  return block?.text?.trim() ?? "";
}
