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
