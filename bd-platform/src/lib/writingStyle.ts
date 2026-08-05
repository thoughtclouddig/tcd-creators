// Shared "sounds like a real person, not an AI or a marketer" checklist for every agent that
// writes outreach copy (Agent 12, Agent 14). Centralized so a newly-discovered offender (e.g.
// "flag") gets banned everywhere at once instead of being patched into one prompt and missed
// in another -- which is exactly how "flag" slipped through the first time.
//
// Organized by CATEGORY rather than a flat word list on purpose: banning individual words is a
// losing game (the model just finds a synonym in the same category). Naming the category gives
// the model a test it can apply to words we haven't thought of yet.

export const BANNED_JARGON_CATEGORIES = `
- Business/consulting jargon: leverage, unlock, elevate, dive in, deep dive, game-changer,
  synergy, ecosystem, journey, empower, seamless, streamline, robust, holistic, actionable,
  bandwidth, circle back, touch base, low-hanging fruit, move the needle, north star,
  best-in-class, cutting-edge, value-add, win-win, at scale
- Analyst/insight jargon: pattern, trend, strategy, angle, lean into, contrast, retention,
  insight, data point, signal, flag / flagging, surface (as a verb, "this surfaces..."), unpack,
  double down, key takeaway
- Corporate warmth / false enthusiasm: passionate, thrilled, excited, "love what you're doing",
  huge fan, absolutely, incredible, amazing, fantastic, genuinely (as a filler intensifier)
- Hedge / filler phrases: "just wanted to", "quick question", "no pressure but", "just curious",
  "I could be wrong but", "feel free to"
- LinkedIn-influencer voice: "here's the thing", "let's be honest", "real talk", "hot take",
  "unpopular opinion"
- If a word or phrase would fit naturally in a LinkedIn post, a consulting deck, or a marketing
  email, it is banned -- even if it is not on this list. Test every word against that category,
  not just this list.
`.trim();

export const SENTENCE_STYLE_RULES = `
- No sentence over about 15 words. A longer thought is two short sentences, never one long one
  stitched together with commas or dashes. One idea per sentence.
- No exclamation points.
- No em-dash used as a crutch for every other clause.
- No triplets or parallel "X, Y, and Z" lists -- that rhythm reads as written, not typed.
`.trim();

// These are honesty rules, not style rules, and take priority over everything else here -- a
// message that sounds perfectly human but claims work that was never done is worse than one
// that sounds robotic. A real violation seen in production: "Brian, the Thune clip and your
// longer Kamala video are pulling attention differently than you'd expect. Mapped out why.
// Want to see the plan?" -- compares two pieces of content, invents a performance claim with no
// data behind it, and claims comparative analysis was done. None of that happened.
export const INTEGRITY_RULES = `
- Reference exactly ONE piece of the creator's content. Never mention, name, or allude to a
  second video/post/episode in the same message, even in passing. If the draft references two,
  cut it down to the single strongest one.
- Never claim or imply anything about performance, views, engagement, attention, or how content
  "does" relative to other content -- phrases like "pulling attention differently than expected",
  "outperforming", "doing better/worse than" are fabrications. No performance data was given, so
  no performance claim can be true. Delete any sentence that makes one.
- Never claim analytical or comparative work was done that wasn't -- "mapped out why", "figured
  out what's driving that", "did a deep dive on your numbers" are all false. The only real thing
  that happened is: watched one piece of content, had one specific reaction to what it said,
  wrote that reaction down. Nothing else may be claimed.
- The offer at the end is always about sending over "what I wrote" / "the notes" (the actual
  written reaction to the one piece of content) -- never "the plan," a strategy, or a proposal.
  If a message ends with "want to see the plan" or similar, that is describing something that
  does not exist yet and must be rewritten to reference the notes instead.
`.trim();

// Prose instructions alone kept failing in production (the model would follow most rules and
// still slip in "plan" or a content comparison). This is a deterministic backstop: a literal
// word/phrase scan run on the model's actual output after it's generated, not another prompt
// asking it to please not do the thing. Every entry here is a term that has ACTUALLY appeared
// in a real generated message despite being explicitly banned in the prompt.
const HARD_BANNED_TERMS = [
  "plan", "pattern", "strategy", "flag", "flagging", "lane", "contrast", "retention", "angle",
  "leverage", "unlock", "elevate", "synergy", "ecosystem", "outperform", "outperforming",
  "trend", "trending", "insight", "signal", "data point", "key takeaway", "double down",
];

// Comparison phrasing that implies "vs. your other content" without necessarily naming a second
// title -- "most of your street stuff doesn't" never says a second video's name but is still a
// forbidden comparison to the rest of the creator's catalog.
const COMPARISON_PHRASE_PATTERNS = [
  /\bmost of your\b/i,
  /\bunlike your\b/i,
  /\bcompared to your\b/i,
  /\bdifferent (from|than) (the|your)\b/i,
  /\byour (other|usual|typical)\b/i,
  /\bthe other (video|episode|clip|post)/i,
  /\bworth building (around|on)\b/i,
];

export interface StyleViolation {
  field: string;
  term: string;
}

/** Deterministic post-generation check -- returns every hard violation found, field by field. */
export function scanForViolations(
  fields: Record<string, string>
): StyleViolation[] {
  const violations: StyleViolation[] = [];
  for (const [field, text] of Object.entries(fields)) {
    if (!text) continue;
    for (const term of HARD_BANNED_TERMS) {
      const re = new RegExp(`\\b${term.replace(/\s+/g, "\\s+")}\\b`, "i");
      if (re.test(text)) violations.push({ field, term });
    }
    for (const pattern of COMPARISON_PHRASE_PATTERNS) {
      const match = text.match(pattern);
      if (match) violations.push({ field, term: match[0] });
    }
  }
  return violations;
}
