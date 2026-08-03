# ThoughtCloud Digital — Proposal Design System

A reusable design language for premium strategic-vision proposals (board decks, creator/media pitches, client repositioning docs). Built for single-scroll HTML artifacts that read like Apple × McKinsey × Linear × Stripe — not agency slideware.

Reference builds: *Where Faith Takes Flight* (CAA), *Building the Future of Real Baron*.

---

## 1. Principles

- **Restraint is the whole strategy.** No gradients, no rounded SaaS cards, no stock photography clichés, no clip art. Every visual choice should read as confidence, not decoration.
- **One accent color, used sparingly.** It marks emphasis (italics in headlines, numerals, active nav state) — it is never a background flood.
- **Serif for ideas, mono for data.** Display/editorial type (headlines, pull quotes) is serif. Structural/labeling type (kickers, nav, numbers, prices) is monospace-leaning sans. Body copy is a plain humanist sans.
- **Section = unit of argument.** Each `<section>` makes exactly one claim, stated in the `h2`, then supported by one component below it. Don't stack unrelated ideas in one section.
- **Every page should feel intentional.** If a section doesn't change the reader's mind about something, cut it.

---

## 2. Design Tokens

```css
:root{
  --paper:#F2F4F8;       /* page background */
  --paper-2:#E8ECF3;     /* card / recessed background */
  --paper-3:#DCE2EC;     /* rarely used, deeper recess */
  --ink:#141B26;         /* primary text */
  --ink-soft:#48515F;    /* body copy */
  --ink-faint:#808996;   /* captions, placeholders, dividers-adjacent */
  --accent:#0563EB;      /* the one accent color */
  --accent-deep:#0445AE; /* accent hover / price emphasis */
  --line:#D7DEE9;        /* hairline borders throughout */
  --slate:#182434;       /* dark band / "after" panel background */

  --serif:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;
  --sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  --mono:'Inter',-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;

  --sec-pad:108px;   /* section vertical padding, desktop */
  --sec-pad-m:64px;  /* section vertical padding, mobile */
  --head-gap:60px;   /* space between sechead and body */
  --col-gap:56px;    /* gap in two-column grids */
}
```

**On brand-specific palettes:** when a proposal's subject has its own visual identity worth referencing (e.g. CAA's brass/altitude palette for aviation), add a one-off `.swatches` section presenting *their* colors — but the proposal's own chrome (paper, ink, accent, line, slate) never changes. The system is the constant; the subject's palette is content, shown, not adopted.

---

## 3. Type Scale

| Use | Family | Notes |
|---|---|---|
| Cover H1 | serif | `clamp(3rem,8.4vw,6.6rem)`, weight 400, `letter-spacing:-.02em`. Italic span in `--accent` for the emotional word. |
| Section H2 | serif | `clamp(1.9rem,4.3vw,3rem)`, weight 400, `text-wrap:balance`. |
| Kicker (eyebrow) | mono | `.72rem`, `letter-spacing:.2em`, uppercase, `--accent` color. Format: `"01 — Section Name"`. |
| Lead quote / pull quote | serif | `clamp(1.5rem,3vw,2.15rem)`, `line-height:1.28`, max-width `25ch`. Italic span in accent for the turn of phrase. |
| Body / prose | sans | `1.06rem`, color `--ink-soft`, max-width `62ch`. `<strong>` switches to `--ink` + weight 600 — use for the one sentence per paragraph that should land hardest. |
| Nav / labels / prices | mono | `.7–.85rem`, wide letter-spacing, uppercase where structural. |

Never introduce a fourth typeface. Never use the serif for body copy — it reads as a wedding invitation, not a strategy doc.

---

## 4. Layout Shell

- `.wrap` — `max-width:1080px`, centered, `44px` side padding (`24px` under 680px). Every section's content sits inside one.
- `section` — hairline `border-top`, `108px` vertical padding (`64px` mobile), `scroll-margin-top` for anchor nav.
- `.sechead` — kicker + h2, `60px` bottom margin, always the first thing in a section.
- `#topnav` — fixed, blurred glass, hidden until the reader scrolls past ~60% of viewport height, then slides in. Contains the wordmark + a horizontally-scrollable link row with scroll-spy active state.
- `#progress` — 3px fixed top bar, accent color, width tracks scroll position.
- `.reveal` — every top-level section fades/slides up on first intersection (`translateY(26px)→0`, `.8s`). Respects `prefers-reduced-motion`.

---

## 5. Component Kit

Use these as the *only* visual vocabulary. If a new proposal seems to need a new component, check this list twice before inventing one — most content fits one of these.

### Cover
Full-viewport-height header. Brand mark + meta top-right, big serif H1 with one italicized accent word mid-center, one-sentence lede, closing line ("who this is for") + scroll cue bottom.

### Table of Contents
Two-column list of numbered anchor links directly under the cover, before section 01. Sets reader expectations for length and shows this is a structured document, not a wall of text.

### `.band` — the thesis statement
Full-bleed `--slate` dark panel breaking the light rhythm once, usually early (03–04). Holds the single most important idea in the whole proposal as a large serif pull-quote, one supporting paragraph. Use once per proposal, maximum twice — its power is scarcity.

### `.ba` — before / after (or avoid / instead)
Two-column bordered panel: light "today / avoid" column, dark `--slate` "future / instead" column. The strongest way to make a contrast argument (current state vs. vision, generic approach vs. recommended approach) without a single chart.

### `.stack` — feature/pillar grid
2-column grid of bordered cards, each with a mono numeral, serif h3, sans supporting line. Use for: vision pillars, ownership channels, outcome categories — any list of 4–8 parallel ideas.

### `.steps` — numbered process
Vertical list, large serif numeral left, h3 + supporting paragraph right. Use for a *sequential* journey (e.g. "Discover → Join → Find your people → Go deeper"), not a flat feature list — that's `.stack`.

### `.tl` — timeline
Vertical line with dot markers, mono "day/phase" label, serif h3, supporting paragraph. Use for roadmaps, phased rollouts, or any strictly ordered sequence with named stages.

### `.price-list` / `.price-row`
Row-based list: serif tier name (+ small sans description) left, mono amount/label right, hairline divider between rows. Use for membership tiers, scorecards (name + score), pricing, or any "label: value" list that deserves weight.

### `.founder-callout`
Recessed `--paper-2` panel with a left accent border, kicker + large serif pull-quote + optional supporting sans line. Use to land the *one sentence* a section should be remembered by — every major section should have zero or one of these, never two.

### `.comp-card`
Bordered `--paper-2` card: kicker, serif h3, then a `label : value` list (reuses `.price-row`-style rows but inside a card). Use for "what we provide / what you provide" splits, or a single structured offer.

### `.role-cols`
Two-column asymmetric grid (1.1fr / .9fr): a `.tasklist` (arrow-bulleted list) on the left, a `.comp-card` on the right. Use for governance/roles splits or any "we do X, you do Y" pairing.

### `.chips`
Wrapped row of pill-shaped mono tags. Use for flat enumerations that don't need individual explanation — site nav structure, content pillars, partnership channels. **Do not use for past-client names** — see `.client-wall` below; a name that establishes credibility needs to read as a name, not a tag.

### `.client-wall` — client / creator list
Full-width row list, hairline-divided: large serif name left (`clamp(1.6rem,3.4vw,2.5rem)`), short mono descriptor right (role/category, not a testimonial). Accent-colors and nudges right on hover. Use for "who we've worked with" — it's the credibility section, so it should have the same typographic weight as a section headline, not be buried as small pill chips. Collapses to stacked name-over-tag under 680px.

```html
<div class="client-wall">
  <div class="client-row"><span class="cw-name">Name</span><span class="cw-tag">One-line category</span></div>
  ...
</div>
```

### `.letter`
Recessed `--paper-2` panel styled as a personal letter: salutation, prose, one large serif `.pitch-line` (the emotional thesis, restated once more), sign-off. Always the second-to-last section, right before the footer. This is where the proposal stops being structural and becomes direct address.

### Footer
Wordmark + right-aligned mono meta line (proposal type, prepared-for, date). No CTA button — a proposal closes, it doesn't convert.

---

## 6. Section Anatomy (the repeatable pattern)

Every numbered section follows the same shape:

1. `.sechead` — kicker (`"0N — Section Name"`) + one-sentence h2 that states the section's claim as a complete thought, not a topic label.
2. **One** primary component from §5 that proves the claim.
3. Optionally, one `.founder-callout` to land the section's single most important line.

Two content patterns recur inside step 2:

- **`.two-col` argument** — `.prose` (2 short paragraphs) on the left, a `.lead-quote` on the right that reframes the same idea in one memorable line. Use when the section is making a *persuasive* point.
- **Structured list** — `.stack` / `.price-list` / `.tl` / `.chips`. Use when the section is *enumerating* something (features, tiers, phases, channels).

Don't mix more than one structured-list component in a single section — pick the one that fits the content's actual shape (parallel items → stack, sequential items → steps/timeline, label:value pairs → price-list).

---

## 7. Voice

- Second person when addressing the client directly in prose ("you've built the audience"), third person / name when describing them structurally ("Real Baron's audience is...").
- Reframe weaknesses as **unbuilt opportunity**, never as failure. Never write a sentence that could be read as a criticism of work already done.
- One idea per sentence. Prefer the em dash and the colon over subordinate clauses.
- Every major section should be reducible to one sentence a board member could repeat in a hallway. If it isn't, cut copy until it is.
- No agency buzzwords: never "grow your brand," "unlock synergies," "take it to the next level," "best-in-class," "cutting-edge." If a phrase would work on a generic marketing agency's homepage, delete it.

---

## 8. Build Checklist (new proposal)

- [ ] Copy this file's CSS block verbatim — don't restyle from scratch.
- [ ] Cover: one H1 with exactly one italicized accent word, one-sentence lede, one-sentence "who this is for."
- [ ] TOC lists every numbered section, two columns.
- [ ] Exactly one `.band` moment carrying the thesis.
- [ ] Each section: kicker + single-claim h2 + one component + optional one `.founder-callout`.
- [ ] Closing `.letter` restates the thesis once more, personally, before the footer.
- [ ] No invented numbers/metrics unless explicitly provided or clearly labeled illustrative.
- [ ] No stock-photo clichés if photography is added — editorial, specific, real.
- [ ] Scroll-spy nav ids (`s01`, `s02`, …) match TOC hrefs and section ids exactly.
- [ ] Test at mobile width — `.two-col`, `.ba`, `.stack`, `.role-cols` all collapse to one column under 680–780px.

---

## 9. Known Reference Builds

| Proposal | Client | Notable adaptations |
|---|---|---|
| *Where Faith Takes Flight* | Catholic Aviation Association | Added `.swatches` for CAA-specific brand palette (brass/altitude); included TAM/SAM/SOM sizing in §12 and a priced Investment section in §13. |
| *Building the Future of Real Baron* | Real Baron (podcast) | Reused `.price-list` as a plain scorecard (label + score, no dollar amounts); repurposed `.tl` for the AI content pipeline instead of a calendar roadmap; no pricing section included. |

When starting a new proposal, read both before writing — they show the system flexing to very different subject matter without changing its bones.
