// Shared tool-call schemas passed to Claude's structured-output layer (see lib/claude.ts).
// Every audit agent returns this shape; only the prompt and extra context differ.

export const AUDIT_RESULT_SCHEMA = {
  type: "object",
  properties: {
    score: {
      type: "number",
      description: "0-100 score for this dimension. Be honest and specific — do not default to the middle.",
    },
    summary: {
      type: "string",
      description: "1-2 SHORT sentences, plain text only -- no markdown (no **bold**, no bullets), no HTML tags. Executive summary of this audit, framed as opportunity, never as criticism.",
    },
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string", description: "Plain text, no markdown or HTML." },
          detail: { type: "string", description: "Plain text, no markdown or HTML." },
        },
        required: ["label", "detail"],
      },
      description: "3-6 specific, concrete observations grounded in the evidence provided. Reference real details, never generic statements.",
    },
    recommendations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "Plain text, no markdown or HTML." },
          detail: { type: "string", description: "Plain text, no markdown or HTML." },
          estimated_impact: { type: "string" },
        },
        required: ["title", "detail"],
      },
      description: "2-5 specific, actionable recommendations.",
    },
    estimated_value_usd: {
      type: "number",
      description: "Optional — annual dollar value of the opportunity, only if the prompt asks for one and there's a reasonable basis for the estimate.",
    },
  },
  required: ["score", "summary", "findings", "recommendations"],
} as const;

export const WEBSITE_AUDIT_SCHEMA = {
  type: "object",
  properties: {
    overall_score: { type: "number", description: "0-100" },
    summary: {
      type: "string",
      description: "1-2 SHORT sentences, plain text only -- no markdown, no HTML tags.",
    },
    category_grades: {
      type: "object",
      description: "Letter grade A-F for each category, plus one sentence of reasoning.",
      properties: {
        brand: gradeField(),
        speed: gradeField(),
        navigation: gradeField(),
        messaging: gradeField(),
        homepage: gradeField(),
        seo: gradeField(),
        email_capture: gradeField(),
        sponsors: gradeField(),
        search: gradeField(),
        architecture: gradeField(),
        accessibility: gradeField(),
        community: gradeField(),
        membership: gradeField(),
        calls_to_action: gradeField(),
        overall_ux: gradeField(),
      },
      required: [
        "brand", "speed", "navigation", "messaging", "homepage", "seo",
        "email_capture", "sponsors", "search", "architecture", "accessibility",
        "community", "membership", "calls_to_action", "overall_ux",
      ],
    },
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: { label: { type: "string" }, detail: { type: "string" } },
        required: ["label", "detail"],
      },
    },
    recommendations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          estimated_impact: { type: "string" },
        },
        required: ["title", "detail"],
      },
    },
  },
  required: ["overall_score", "summary", "category_grades", "findings", "recommendations"],
} as const;

function gradeField() {
  return {
    type: "object",
    properties: {
      grade: { type: "string", enum: ["A", "B", "C", "D", "F"] },
      reasoning: { type: "string" },
    },
    required: ["grade", "reasoning"],
  };
}

export const OUTREACH_SCHEMA = {
  type: "object",
  properties: {
    email_subject: {
      type: "string",
      description: "Lowercase-feeling, plain, specific -- like a real subject line a person typed, not a marketing headline. Under 6 words.",
    },
    email_body: {
      type: "string",
      description: "Under 70 words. Must read like a real person typed it in two minutes, not AI or a marketer -- see the system prompt's full list of banned patterns. Ends with exactly one question inviting them to see the plan.",
    },
    linkedin_message: {
      type: "string",
      description: "Under 40 words. Same voice rules as email_body, shorter.",
    },
    x_dm: {
      type: "string",
      description: "Under 25 words. Same voice rules as email_body, terse.",
    },
    specific_references: {
      type: "array",
      items: { type: "string" },
      description: "The concrete, specific things about this creator that were referenced (a video title, a tweet, a site detail) — proof this wasn't a template.",
    },
  },
  required: ["email_subject", "email_body", "linkedin_message", "x_dm", "specific_references"],
} as const;
