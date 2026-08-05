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
  "scaling", "scale beyond", "powerful platform",
  // exact PROHIBITED_PHRASES from the outreach spec -- checked verbatim, not just described
  "hope you're doing well", "hope this finds you well", "i came across your profile",
  "i came across", "i noticed", "thought i'd connect", "wanted to reach out", "touch base",
  "circle back", "scale your business", "unlock revenue", "take things to the next level",
  "take it to the next level", "leverage your audience", "quick call", "quick chat",
  "game changing", "game changer", "end-to-end", "best-in-class", "following up", "checking in",
  "just bumping this", "thought i'd follow up",
  // generic hedge filler -- not endorsed by any worked example, still banned
  "no pitch", "just curious", "just a question", "figured it was worth", "worth a quick note",
];

// The exact list from the outreach spec, kept as its own export so prompts can show it verbatim
// (some entries overlap with the categorized list above -- both exist because the model responds
// better to an explicit list AND a category test; redundancy here is intentional, not a bug).
export const PROHIBITED_PHRASES = `
Hope you're doing well · Hope this finds you well · Wanted to reach out · Touch base ·
Circle back · Following up · Checking in · Quick call · Quick chat · Scale your business ·
Unlock revenue · Take it to the next level · Leverage · Synergy · Game changer · End-to-end ·
Powerful platform · I noticed · I came across · Thought I'd connect · Just bumping this
`.trim();

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

const PERMISSION_CLOSE_PATTERN =
  /\b(worth (it|sending|a look)|interested\?|want (it|them|to see it|the notes|what i (wrote|found|put together))|send (it|them|what i (found|wrote)) over|happy to send)\b/i;
const TRIPLET_PATTERN = /\b[\w-]+,\s*[\w-]+,?\s+(and|or)\s+[\w-]+\b/i;

/** ~4+ significant (4+ letter) words from a title, used to detect if it's referenced in a message. */
function titleFingerprint(title: string): string[] {
  return title
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length >= 4)
    .slice(0, 4);
}

/**
 * Deterministic post-generation check -- returns every hard violation found, field by field.
 * `titles` is the same recent-video-titles list the writer was given; passing it lets this
 * catch multi-content-reference violations (two titles quoted in one message), which no banned
 * phrase list can catch since referencing a second real title isn't itself a banned word.
 */
export function scanForViolations(
  fields: Record<string, string>,
  titles: string[] = []
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

    // Multiple content pieces referenced -- count how many of the given titles have most of
    // their significant words present in this field.
    if (titles.length > 1) {
      const lower = text.toLowerCase();
      const titlesReferenced = titles.filter((title) => {
        const fp = titleFingerprint(title);
        if (fp.length === 0) return false;
        const hits = fp.filter((w) => lower.includes(w)).length;
        return hits >= Math.min(2, fp.length);
      });
      if (titlesReferenced.length >= 2) {
        violations.push({
          field,
          term: `multiple content pieces referenced (${titlesReferenced.length} titles detected)`,
        });
      }
    }

    // Sentence length -- split on sentence boundaries, flag anything over ~16 words.
    const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    for (const sentence of sentences) {
      const wordCount = sentence.trim().split(/\s+/).filter(Boolean).length;
      if (wordCount > 16) {
        violations.push({ field, term: `run-on sentence (${wordCount} words): "${sentence.trim().slice(0, 60)}..."` });
      }
    }

    // Em-dash used as a crutch -- 2+ in one message, or 2+ within a single sentence bracketing
    // a list, both read as written/formal rather than typed.
    const emDashCount = (text.match(/—/g) || []).length;
    if (emDashCount >= 2) {
      violations.push({ field, term: `em-dash overused (${emDashCount} instances)` });
    }

    // Triplet / parallel "X, Y, and Z" list.
    if (TRIPLET_PATTERN.test(text)) {
      violations.push({ field, term: "triplet list (X, Y, and Z rhythm)" });
    }

    // Missing permission close -- only meaningful for the longer fields with room for a real
    // closing question (email/linkedin); x_dm is short enough this can be too strict.
    if ((field === "email_body" || field === "linkedin_message") && !PERMISSION_CLOSE_PATTERN.test(text)) {
      violations.push({ field, term: "missing permission-close question (e.g. \"worth sending over?\")" });
    }
  }
  return violations;
}

// ---------- Message framework ----------

export const MESSAGE_FRAMEWORK = `
1. One honest opening (one sentence). Disarm immediately instead of pretending this isn't
   outreach. E.g. "This is a business email." / "I'll be upfront -- this is a pitch." Never
   claim a personal relationship that isn't verifiably true (no "my wife and I are fans" unless
   that were literally known to be true, which it never is here).
2. Why THIS creator (one sentence). Mention exactly ONE real thing -- one episode, one
   investigation, one interview -- and then MOVE ON. Do not summarize it, do not explain why it
   was good, do not prove research happened. "I've been following your recent Iran coverage."
   Done. Nothing more. Naming a second piece of content, or elaborating on the first, both fail
   this step.
3. One business observation (one sentence, at most two). NOT a reaction to video content --
   an honest observation about the business behind the audience, grounded in the real evidence
   given below. E.g. "The audience has outgrown the business behind it." / "The website still
   feels like a companion to YouTube." Never give more than one observation. Never perform a
   website audit or list several gaps.
4. Credibility (optional, ONE sentence, only if genuinely relevant -- never force it in). If
   used: "I've worked behind the scenes with Salty Cracker, Jeffrey Prather, Andy Ngo, and True
   the Vote." Never list your resume.
5. Permission (one sentence, one question). Never ask for a meeting, a call, or time on the
   calendar. Ask permission to send something instead: "I put together a few ideas specifically
   for you. Worth sending over?" / "I'd be happy to share it."
`.trim();

// Step 1's opener, rotated -- only themes that are always true or always safe to say, never a
// creator-specific claim we have no way to verify (e.g. never claim personal familiarity with
// their work that we don't actually have).
export const HONEST_OPENING_THEMES = `
- "This is a business email." (plain, disarming, always true)
- "I'll be upfront -- this is a pitch." (same idea, different phrasing)
`.trim();

export const QUALITY_SCORE_CATEGORIES = [
  "personalization",
  "specificity",
  "authenticity",
  "curiosity",
  "respect",
  "sales_pressure", // inverted: 10 = zero pressure, 1 = hard sell
  "human_voice",
] as const;
