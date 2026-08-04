/**
 * Agent 11 support — renders the TCD proposal design system (same component kit used in the
 * CAA and Real Baron hand-built proposals: paper/ink/accent tokens, .band, .ba, .stack,
 * .price-list, .founder-callout, .client-wall, .tl, .letter) but populated programmatically
 * from real audit data instead of being hand-written per creator.
 */

export interface ProposalCategoryScore {
  label: string;
  score10: number; // 0-10 for display, matching the REPORT FORMAT spec
}

export interface ProposalRecommendation {
  title: string;
  detail: string;
  estimated_impact?: string;
}

export interface ProposalData {
  creatorName: string;
  brand: string | null;
  preparedDate: string; // e.g. "August 2026"
  overallScore: number; // 0-100
  priority: "High" | "Medium" | "Low";
  topfanFitScore: number;
  estimatedRevenueOpportunity: string;
  executiveSummary: string; // 2-3 paragraph narrative
  closingLetter: string; // 2-3 paragraph narrative, addressed "To {name},"
  categoryScores: ProposalCategoryScore[]; // Audience, Website, Ownership, Community, Merch, AI, Monetization
  agentSummaries: { label: string; summary: string }[]; // one per audit agent, in report order
  topRecommendations: ProposalRecommendation[];
  clients: { name: string; tag: string }[];
}

const CATEGORY_TOOLTIPS: Record<string, string> = {
  Audience: "Audience size, growth momentum, and engagement combined — the core signal of whether this is an audience worth building around.",
  Website: "How well the current site works as a headquarters: architecture, SEO, messaging, and overall user experience.",
  "Audience Ownership": "How much of the relationship is owned outright (email, SMS, app, member database) versus rented from a platform that could change the rules tomorrow.",
  Community: "Whether the audience has a real place to gather and talk to each other, not just watch — and how alive that space actually is.",
  Merchandise: "Store presence, product range, and revenue currently left on the table from an audience that would buy.",
  "AI Opportunity": "How much untapped leverage exists in turning every episode into a full content system automatically — transcripts, search, clips, newsletters.",
};

function tierWithTooltip(label: string): string {
  const tip = CATEGORY_TOOLTIPS[label];
  if (!tip) return `<span class="tier">${escapeHtml(label)}</span>`;
  return `<span class="tier tier-tip"><span class="tier-label">${escapeHtml(label)}</span><span class="info-dot" tabindex="0">?<span class="tip">${escapeHtml(tip)}</span></span></span>`;
}

export function renderProposalHtml(d: ProposalData): string {
  const title = `Building the Future of ${escapeHtml(d.creatorName)}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — ThoughtCloud Digital</title>
<style>
${BASE_CSS}
</style>
</head>
<body>
${WORDMARK_SVG}
<nav id="topnav">
  <div class="nav-inner wrap">
    <a href="#top" class="nav-logo" aria-label="ThoughtCloud Digital">
      <svg class="logo-mark logo-mark--nav" viewBox="0 0 885 107" role="img" aria-label="ThoughtCloud Digital"><use href="#tcd-wordmark"></use></svg>
    </a>
    <div class="nav-links" id="navlinks">
      <a href="#s01"><span class="n">01</span><span>Summary</span></a>
      <a href="#s02"><span class="n">02</span><span>Opportunity</span></a>
      <a href="#s03"><span class="n">03</span><span>Findings</span></a>
      <a href="#s04"><span class="n">04</span><span>Roadmap</span></a>
      <a href="#s05"><span class="n">05</span><span>Recommendations</span></a>
      <a href="#s06"><span class="n">06</span><span>About&nbsp;Us</span></a>
    </div>
  </div>
</nav>

<header class="cover wrap" id="top">
  <div class="cover-top">
    <svg class="logo-mark logo-mark--cover" viewBox="0 0 885 107" role="img" aria-label="ThoughtCloud Digital"><use href="#tcd-wordmark"></use></svg>
    <div class="cover-meta">
      Strategic Vision Proposal<br>
      Opportunity Score ${d.overallScore} / 100 · ${escapeHtml(d.priority)} Priority<br>
      Prepared for ${escapeHtml(d.creatorName)}
    </div>
  </div>
  <div class="cover-mid">
    <div class="kicker">A Strategic Vision Proposal</div>
    <h1>Building the<br>future of <em>${escapeHtml(d.creatorName)}.</em></h1>
    <p class="lede">${escapeHtml(d.executiveSummary.split("\n")[0] ?? "")}</p>
  </div>
  <div class="cover-bottom">
    <p class="who">Prepared by <strong>ThoughtCloud Digital</strong> — ${escapeHtml(d.preparedDate)}</p>
    <div class="scrollcue">Read the proposal <span></span></div>
  </div>
</header>

<section class="wrap toc reveal">
  <div class="kicker" style="margin-bottom:26px">Contents</div>
  <div class="toc-grid">
    <a href="#s01"><span class="toc-n">01</span>Executive Summary</a>
    <a href="#s04"><span class="toc-n">04</span>Roadmap</a>
    <a href="#s02"><span class="toc-n">02</span>Opportunity Score</a>
    <a href="#s05"><span class="toc-n">05</span>Recommendations</a>
    <a href="#s03"><span class="toc-n">03</span>Findings</a>
    <a href="#s06"><span class="toc-n">06</span>About ThoughtCloud Digital</a>
  </div>
</section>

<section class="wrap reveal" id="s01">
  <div class="sechead">
    <div class="kicker">01 — Executive Summary</div>
    <h2>You've built the audience. Now build the media company.</h2>
  </div>
  <div class="prose">
    ${paragraphs(d.executiveSummary)}
  </div>
</section>

<section class="wrap reveal" id="s02">
  <div class="sechead">
    <div class="kicker">02 — Opportunity Score</div>
    <h2>${d.overallScore} / 100 — ${escapeHtml(d.priority)} priority.</h2>
  </div>
  <div class="price-list">
    ${d.categoryScores
      .map(
        (c) =>
          `<div class="price-row">${tierWithTooltip(c.label)}<span class="amt">${c.score10.toFixed(1)} / 10</span></div>`
      )
      .join("\n    ")}
  </div>
  <div class="founder-callout">
    <span class="kicker tier-tip" style="display:inline-flex;align-items:center;gap:8px">TopFan Fit<span class="info-dot" tabindex="0">?<span class="tip" style="text-transform:none;letter-spacing:normal">How much this creator's specific situation — audience size, engagement, and the ownership/community gaps found above — would benefit from a branded app, membership, and premium content platform.</span></span></span>
    <p class="fq">${d.topfanFitScore} / 100 — estimated opportunity ${escapeHtml(d.estimatedRevenueOpportunity)}.</p>
  </div>
</section>

<section class="wrap reveal">
  <div class="cta">
    <span class="kicker">Let's Talk</span>
    <p>Want to walk through where the biggest leverage is for ${escapeHtml(d.creatorName)}?</p>
    <div class="reply-note">Just reply to this email — happy to talk it through.</div>
  </div>
</section>

<section class="band wrap">
  <div class="kicker reveal">The Governing Idea</div>
  <p class="big reveal">Platforms build audiences.<br>Owned platforms build <em>businesses.</em></p>
  <p class="reveal">Every major platform is exceptional at introducing ${escapeHtml(d.creatorName)} to new people. None of them are built to let ${escapeHtml(d.creatorName)} keep those people. This proposal is the architecture for owning that relationship.</p>
</section>

<section class="wrap reveal" id="s03">
  <div class="sechead">
    <div class="kicker">03 — Findings</div>
    <h2>What we found, category by category.</h2>
  </div>
  <div class="stack">
    ${d.agentSummaries
      .map(
        (a, i) =>
          `<div class="stack-item"><span class="si-num">${String(i + 1).padStart(2, "0")}</span><h3>${escapeHtml(a.label)}</h3><p>${escapeHtml(a.summary)}</p></div>`
      )
      .join("\n    ")}
  </div>
</section>

<section class="wrap reveal" id="s04">
  <div class="sechead">
    <div class="kicker">04 — Roadmap</div>
    <h2>Four phases, built in order.</h2>
  </div>
  <div class="tl">
    <div class="tl-item"><div class="day">Phase 1 · Discovery</div><h3>Strategy &amp; architecture</h3><p>Platform strategy, technical architecture, membership model, merch strategy, and AI planning.</p></div>
    <div class="tl-item"><div class="day">Phase 2 · Platform</div><h3>Design &amp; build</h3><p>Website and app design, brand system, membership and commerce build-out.</p></div>
    <div class="tl-item"><div class="day">Phase 3 · Launch</div><h3>Migration &amp; go-live</h3><p>Content migration, member onboarding, community and email activation.</p></div>
    <div class="tl-item"><div class="day">Phase 4 · Growth</div><h3>Marketing &amp; optimization</h3><p>Automation, ongoing merch drops, membership growth, analytics-driven optimization.</p></div>
  </div>
</section>

<section class="wrap reveal">
  <div class="cta">
    <span class="kicker">Let's Talk</span>
    <p>Curious what Phase 1 would actually look like for ${escapeHtml(d.creatorName)}?</p>
    <div class="reply-note">Reply to this email and let's talk specifics.</div>
  </div>
</section>

<section class="wrap reveal" id="s05">
  <div class="sechead">
    <div class="kicker">05 — Recommendations</div>
    <h2>Where to start.</h2>
  </div>
  <div class="role-cols">
    <div>
      <ul class="tasklist">
        ${d.topRecommendations
          .map(
            (r) =>
              `<li><strong>${escapeHtml(r.title)}.</strong> ${escapeHtml(r.detail)}</li>`
          )
          .join("\n        ")}
      </ul>
    </div>
    <div class="comp-card">
      <span class="kicker">Expected Outcomes</span>
      <h3>What this builds toward.</h3>
      <ul>
        <li><span>Audience ownership</span><span style="text-align:right">Stronger</span></li>
        <li><span>Recurring revenue</span><span style="text-align:right">Higher</span></li>
        <li><span>Sponsor value</span><span style="text-align:right">Greater</span></li>
        <li><span>Search visibility</span><span style="text-align:right">Improved</span></li>
        <li><span>Platform independence</span><span style="text-align:right">Long-term</span></li>
      </ul>
    </div>
  </div>
</section>

<section class="wrap reveal" id="s06">
  <div class="sechead">
    <div class="kicker">06 — About ThoughtCloud Digital</div>
    <h2>Behind the scenes, on purpose.</h2>
  </div>
  <div class="prose" style="margin-bottom:6px">
    <p>ThoughtCloud Digital works behind the scenes with independent creators to build the infrastructure that supports what they've already built with their audience.</p>
  </div>
  <div class="client-wall">
    ${d.clients
      .map(
        (c) =>
          `<div class="client-row"><span class="cw-name">${escapeHtml(c.name)}</span><span class="cw-tag">${escapeHtml(c.tag)}</span></div>`
      )
      .join("\n    ")}
  </div>
</section>

<section class="wrap reveal">
  <div class="letter">
    <div class="salut">To ${escapeHtml(firstName(d.creatorName))},</div>
    ${paragraphs(d.closingLetter)}
    <p>Reply to this email whenever you'd like to talk it through — no pressure, just an open door.</p>
    <div class="sign">
      Prepared for ${escapeHtml(d.creatorName)}<br>
      <b>ThoughtCloud Digital</b> — Building the Business Behind the Audience
    </div>
  </div>
</section>

<footer class="wrap">
  <svg class="logo-mark logo-mark--footer" viewBox="0 0 885 107" role="img" aria-label="ThoughtCloud Digital"><use href="#tcd-wordmark"></use></svg>
  <div class="f-meta">
    Strategic Vision Proposal — Opportunity Score ${d.overallScore}/100<br>
    Prepared for ${escapeHtml(d.creatorName)} · ${escapeHtml(d.preparedDate)}
  </div>
</footer>

<script>
  const prog=document.getElementById('progress');
  const nav=document.getElementById('topnav');
  addEventListener('scroll',()=>{
    const h=document.documentElement;
    prog.style.width=(h.scrollTop)/(h.scrollHeight-h.clientHeight)*100+'%';
    nav.classList.toggle('show', h.scrollTop > window.innerHeight*0.6);
  });
  const io=new IntersectionObserver((es)=>{
    es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});
  },{threshold:.12});
  document.querySelectorAll('.reveal').forEach(el=>io.observe(el));
</script>
</body>
</html>
`;
}

export function renderProposalMarkdown(d: ProposalData): string {
  return `# Building the Future of ${d.creatorName}

Prepared by ThoughtCloud Digital — ${d.preparedDate}

## Executive Summary

${d.executiveSummary}

## Opportunity Score

**${d.overallScore} / 100 — ${d.priority} priority**

${d.categoryScores.map((c) => `- ${c.label}: ${c.score10.toFixed(1)} / 10`).join("\n")}

TopFan Fit: ${d.topfanFitScore} / 100
Estimated Opportunity: ${d.estimatedRevenueOpportunity}

## Findings

${d.agentSummaries.map((a) => `### ${a.label}\n\n${a.summary}`).join("\n\n")}

## Roadmap

1. **Discovery** — Platform strategy, architecture, membership model, merch strategy, AI planning.
2. **Platform** — Website and app design, brand system, membership and commerce build-out.
3. **Launch** — Migration, member onboarding, community and email activation.
4. **Growth** — Automation, merch drops, membership growth, analytics.

## Recommendations

${d.topRecommendations.map((r) => `- **${r.title}** — ${r.detail}`).join("\n")}

## About ThoughtCloud Digital

${d.clients.map((c) => `- ${c.name} — ${c.tag}`).join("\n")}

---

To ${firstName(d.creatorName)},

${d.closingLetter}

Prepared for ${d.creatorName}
ThoughtCloud Digital — Building the Business Behind the Audience
`;
}

function paragraphs(text: string): string {
  return text
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("\n    ");
}

function firstName(name: string): string {
  return name.split(" ")[0] ?? name;
}

function escapeHtml(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const WORDMARK_SVG = `<svg style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">
<symbol id="tcd-wordmark" viewBox="0 0 885 107">
<path fill="#0563EB" d="M137.1,77.35c-1.79,4.66-5,9.85-8.67,13.15c-9.16,8.21-21.22,11.05-33.12,8.45c-1.59-0.35-4.64-1-6.21-2.13c-7.98-5.76-13.24-14.26-17.47-22.25l-15.7-27.61c-1.79-3.14-1.97-6.46,0.62-8.75c2.19-1.93,6.87-2.6,8.67,0.44l22.72,38.4c2.62,4.43,6.46,8.22,11.4,9.66c8.02,2.33,15.82-0.82,21.07-6.05c6.94-6.91,8.25-16.95,3.59-25.82c-4.47-8.52-14.42-13.5-24.41-11.27c-3.55,0.79-6.94-1.1-7.82-4.65C88.25,24.5,74.73,15.48,60.7,17.7c-13.98,2.21-24.42,14.23-23.32,29.23c0.28,3.75-1.64,6.02-4.86,7.31c-0.28,0.11-0.58,0.16-0.88,0.13c-8.68-0.7-16.68,6.23-17.82,15.06C12.6,78.8,19.19,87.9,29.18,88.95c0.07,0.01,0.14,0.01,0.2,0.01l19.31,0.05c1.41,0,2.31-1.51,1.62-2.74l-9.85-17.81c-0.68-1.23,0.23-2.96,0.92-4.29c0.2-0.38,0.52-0.68,0.91-0.85l4.4-1.9c2.45-0.9,5,1.68,6.15,3.71l15.62,27.67c1.13,1.99,0.71,4.45-0.22,5.98c-0.78,1.3-2.55,2.69-4.61,2.71l-32.4,0.32c-0.08,0-0.15,0-0.23-0.01l-8.18-0.95c-2.85-0.33-4.3-1.71-6.38-2.93C6.39,92.04,0.78,81.33,1.38,70.06c0.69-12.96,9.44-23.9,22.37-27.28c0.67-0.18,1.19-0.71,1.35-1.39l2.79-12.42c0.02-0.11,0.06-0.22,0.1-0.32c2.61-6.2,7.46-11.92,12.83-15.93c2.77-2.07,5.99-3.78,9.08-4.97C70.19-0.07,93,8.94,101.63,29.44c0.29,0.7,0.98,1.15,1.74,1.14c14.26-0.15,26.61,7.73,32.8,20.36c0.73,1.49,0.71,1.31,1.62,4.09c0.09,0.27,0.33,0.77,0.39,1.05C139.77,63.18,139.68,70.62,137.1,77.35z"/>
<g fill="#182434">
<path d="M177,86.71c-3.58,0-6.4-0.87-8.45-2.61s-3.08-4.87-3.08-9.4V53.13h-6.8v-5.61h6.8l0.87-9.4h5.77v9.4h11.54v5.61H172.1V74.7c0,2.48,0.5,4.15,1.5,5.02c1,0.87,2.77,1.3,5.29,1.3h4.11v5.69H177z"/>
<path d="M190.12,86.71V29.82h6.64v24.42c1.32-2.42,3.19-4.31,5.61-5.65c2.42-1.34,5.06-2.02,7.9-2.02c4.53,0,8.16,1.41,10.9,4.23c2.74,2.82,4.11,7.15,4.11,13v22.91h-6.56v-22.2c0-8.16-3.29-12.25-9.88-12.25c-3.42,0-6.3,1.22-8.61,3.67c-2.32,2.45-3.48,5.94-3.48,10.47v20.31H190.12z"/>
<path d="M251.2,87.66c-3.69,0-7.01-0.84-9.96-2.53c-2.95-1.69-5.28-4.07-6.99-7.15c-1.71-3.08-2.57-6.7-2.57-10.86c0-4.16,0.87-7.78,2.61-10.86c1.74-3.08,4.1-5.46,7.07-7.15c2.98-1.69,6.31-2.53,10-2.53c3.69,0,7.01,0.84,9.96,2.53c2.95,1.69,5.28,4.07,6.99,7.15c1.71,3.08,2.57,6.7,2.57,10.86c0,4.16-0.87,7.78-2.61,10.86s-4.1,5.47-7.07,7.15C258.21,86.81,254.88,87.66,251.2,87.66z M251.2,81.97c2.26,0,4.37-0.55,6.32-1.66c1.95-1.11,3.53-2.77,4.74-4.98c1.21-2.21,1.82-4.95,1.82-8.22c0-3.27-0.59-6-1.78-8.22c-1.19-2.21-2.75-3.87-4.7-4.98c-1.95-1.11-4.03-1.66-6.24-1.66c-2.27,0-4.37,0.55-6.32,1.66c-1.95,1.11-3.53,2.77-4.74,4.98c-1.21,2.21-1.82,4.95-1.82,8.22c0,3.27,0.6,6.01,1.82,8.22c1.21,2.21,2.78,3.87,4.7,4.98C246.91,81.42,248.98,81.97,251.2,81.97z"/>
<path d="M292.44,87.66c-4.64,0-8.32-1.41-11.06-4.23c-2.74-2.82-4.11-7.15-4.11-13V47.52h6.64v22.2c0,8.17,3.34,12.25,10.03,12.25c3.42,0,6.25-1.23,8.49-3.67c2.24-2.45,3.36-5.94,3.36-10.47V47.52h6.64v39.19h-6.01l-0.47-7.03c-1.21,2.48-3.02,4.42-5.41,5.85C298.14,86.95,295.44,87.66,292.44,87.66z"/>
<path d="M336.85,74.38c-2.21,0-4.24-0.29-6.08-0.87l-3.95,3.71c0.58,0.42,1.3,0.78,2.17,1.07c0.87,0.29,2.12,0.55,3.75,0.79c1.63,0.24,3.92,0.49,6.87,0.75c5.27,0.37,9.03,1.58,11.3,3.63c2.26,2.05,3.4,4.74,3.4,8.06c0,2.26-0.62,4.42-1.86,6.48c-1.24,2.05-3.13,3.74-5.69,5.06c-2.56,1.32-5.83,1.98-9.84,1.98c-3.53,0-6.66-0.46-9.4-1.38c-2.74-0.92-4.87-2.32-6.4-4.19c-1.53-1.87-2.29-4.23-2.29-7.07c0-1.48,0.4-3.07,1.19-4.78c0.79-1.71,2.26-3.33,4.42-4.86c-1.16-0.47-2.15-0.99-2.96-1.54c-0.82-0.55-1.57-1.17-2.25-1.86v-1.82l6.72-6.64c-3.11-2.63-4.66-6.11-4.66-10.43c0-2.58,0.6-4.92,1.82-7.03c1.21-2.11,2.98-3.78,5.29-5.02c2.32-1.24,5.14-1.86,8.45-1.86c2.26,0,4.32,0.32,6.16,0.95h14.46v4.98l-7.35,0.32c1.53,2.21,2.29,4.77,2.29,7.66c0,2.58-0.62,4.93-1.86,7.03c-1.24,2.11-3,3.78-5.29,5.02C342.97,73.77,340.16,74.38,336.85,74.38z M325.31,91.77c0,2.63,1.11,4.6,3.32,5.89c2.21,1.29,4.98,1.94,8.3,1.94c3.27,0,5.89-0.71,7.86-2.13s2.96-3.32,2.96-5.69c0-1.69-0.69-3.15-2.05-4.39c-1.37-1.24-3.9-1.96-7.59-2.17c-2.9-0.21-5.4-0.47-7.51-0.79c-2.16,1.16-3.58,2.41-4.27,3.75C325.65,89.52,325.31,90.71,325.31,91.77z M336.85,68.93c2.79,0,5.02-0.72,6.68-2.17c1.66-1.45,2.49-3.54,2.49-6.28c0-2.69-0.83-4.75-2.49-6.2c-1.66-1.45-3.89-2.17-6.68-2.17c-2.84,0-5.1,0.72-6.76,2.17c-1.66,1.45-2.49,3.52-2.49,6.2c0,2.74,0.83,4.83,2.49,6.28C331.75,68.21,334,68.93,336.85,68.93z"/>
<path d="M363,86.71V29.82h6.64v24.42c1.32-2.42,3.19-4.31,5.61-5.65c2.42-1.34,5.06-2.02,7.9-2.02c4.53,0,8.17,1.41,10.9,4.23c2.74,2.82,4.11,7.15,4.11,13v22.91h-6.56v-22.2c0-8.16-3.29-12.25-9.88-12.25c-3.42,0-6.29,1.22-8.61,3.67c-2.32,2.45-3.48,5.94-3.48,10.47v20.31H363z"/>
<path d="M421.71,86.71c-3.58,0-6.4-0.87-8.45-2.61s-3.08-4.87-3.08-9.4V53.13h-6.79v-5.61h6.79l0.87-9.4h5.77v9.4h11.54v5.61h-11.54V74.7c0,2.48,0.5,4.15,1.5,5.02c1,0.87,2.77,1.3,5.29,1.3h4.11v5.69H421.71z"/>
<path d="M451.73,87.66c-3.74,0-7.1-0.86-10.08-2.57c-2.98-1.71-5.32-4.11-7.03-7.19s-2.57-6.68-2.57-10.79s0.86-7.7,2.57-10.79s4.06-5.48,7.03-7.19c2.98-1.71,6.33-2.57,10.08-2.57c4.63,0,8.55,1.21,11.73,3.63c3.19,2.42,5.2,5.66,6.04,9.72h-6.8c-0.53-2.42-1.82-4.31-3.87-5.65c-2.05-1.34-4.45-2.01-7.19-2.01c-2.21,0-4.29,0.55-6.24,1.66c-1.95,1.11-3.53,2.77-4.74,4.98c-1.21,2.21-1.82,4.95-1.82,8.22c0,3.27,0.61,6.01,1.82,8.22c1.21,2.21,2.79,3.89,4.74,5.02c1.95,1.13,4.03,1.7,6.24,1.7c2.74,0,5.14-0.67,7.19-2.01c2.05-1.34,3.34-3.25,3.87-5.73h6.8c-0.79,3.95-2.79,7.16-6.01,9.64C460.29,86.42,456.37,87.66,451.73,87.66z"/>
<path d="M476.78,86.71V29.82h6.64v56.89H476.78z"/>
<path d="M510.2,87.66c-3.69,0-7.01-0.84-9.96-2.53c-2.95-1.69-5.28-4.07-6.99-7.15s-2.57-6.7-2.57-10.86c0-4.16,0.87-7.78,2.61-10.86c1.74-3.08,4.09-5.46,7.07-7.15c2.98-1.69,6.31-2.53,10-2.53c3.69,0,7,0.84,9.96,2.53c2.95,1.69,5.28,4.07,6.99,7.15c1.71,3.08,2.57,6.7,2.57,10.86c0,4.16-0.87,7.78-2.61,10.86s-4.1,5.47-7.07,7.15C517.22,86.81,513.89,87.66,510.2,87.66z M510.2,81.97c2.26,0,4.37-0.55,6.32-1.66c1.95-1.11,3.53-2.77,4.74-4.98s1.82-4.95,1.82-8.22c0-3.27-0.59-6-1.78-8.22c-1.19-2.21-2.75-3.87-4.7-4.98c-1.95-1.11-4.03-1.66-6.24-1.66c-2.27,0-4.37,0.55-6.32,1.66c-1.95,1.11-3.53,2.77-4.74,4.98c-1.21,2.21-1.82,4.95-1.82,8.22c0,3.27,0.61,6.01,1.82,8.22c1.21,2.21,2.78,3.87,4.7,4.98C505.92,81.42,507.99,81.97,510.2,81.97z"/>
<path d="M551.45,87.66c-4.64,0-8.32-1.41-11.06-4.23c-2.74-2.82-4.11-7.15-4.11-13V47.52h6.64v22.2c0,8.17,3.34,12.25,10.04,12.25c3.42,0,6.25-1.23,8.49-3.67c2.24-2.45,3.36-5.94,3.36-10.47V47.52h6.64v39.19h-6l-0.47-7.03c-1.21,2.48-3.02,4.42-5.41,5.85C557.15,86.95,554.45,87.66,551.45,87.66z"/>
<path d="M598.14,87.66c-3.9,0-7.31-0.9-10.23-2.69s-5.19-4.24-6.79-7.35c-1.61-3.11-2.41-6.64-2.41-10.59s0.82-7.47,2.45-10.55c1.63-3.08,3.9-5.5,6.79-7.27c2.9-1.76,6.32-2.65,10.27-2.65c3.21,0,6.06,0.66,8.53,1.98c2.48,1.32,4.4,3.16,5.77,5.53V29.82h6.64v56.89h-6l-0.63-6.48c-1.26,1.9-3.08,3.61-5.45,5.14C604.7,86.89,601.72,87.66,598.14,87.66z M598.85,81.89c2.63,0,4.96-0.62,6.99-1.86c2.03-1.24,3.61-2.96,4.74-5.18s1.7-4.79,1.7-7.74c0-2.95-0.57-5.53-1.7-7.74s-2.71-3.94-4.74-5.18c-2.03-1.24-4.36-1.86-6.99-1.86c-2.58,0-4.89,0.62-6.91,1.86c-2.03,1.24-3.61,2.96-4.74,5.18c-1.13,2.21-1.7,4.79-1.7,7.74c0,2.95,0.57,5.53,1.7,7.74c1.13,2.21,2.71,3.94,4.74,5.18C593.97,81.27,596.27,81.89,598.85,81.89z"/>
<path d="M664.75,87.66c-3.9,0-7.31-0.9-10.23-2.69s-5.19-4.24-6.79-7.35c-1.61-3.11-2.41-6.64-2.41-10.59s0.82-7.47,2.45-10.55c1.63-3.08,3.9-5.5,6.79-7.27c2.9-1.76,6.32-2.65,10.27-2.65c3.21,0,6.06,0.66,8.53,1.98c2.48,1.32,4.4,3.16,5.77,5.53V29.82h6.64v56.89h-6l-0.63-6.48c-1.26,1.9-3.08,3.61-5.45,5.14C671.31,86.89,668.33,87.66,664.75,87.66z M665.46,81.89c2.63,0,4.96-0.62,6.99-1.86c2.03-1.24,3.61-2.96,4.74-5.18s1.7-4.79,1.7-7.74c0-2.95-0.57-5.53-1.7-7.74s-2.71-3.94-4.74-5.18c-2.03-1.24-4.36-1.86-6.99-1.86c-2.58,0-4.89,0.62-6.91,1.86c-2.03,1.24-3.61,2.96-4.74,5.18c-1.13,2.21-1.7,4.79-1.7,7.74c0,2.95,0.57,5.53,1.7,7.74c1.13,2.21,2.71,3.94,4.74,5.18C660.58,81.27,662.88,81.89,665.46,81.89z"/>
<path d="M698.65,38.83c-1.32,0-2.41-0.43-3.28-1.3c-0.87-0.87-1.3-1.96-1.3-3.28c0-1.26,0.43-2.32,1.3-3.16c0.87-0.84,1.96-1.26,3.28-1.26c1.26,0,2.34,0.42,3.24,1.26c0.89,0.84,1.34,1.9,1.34,3.16c0,1.32-0.45,2.41-1.34,3.28C700.99,38.39,699.91,38.83,698.65,38.83z M695.33,86.71V47.52h6.64v39.19H695.33z"/>
<path d="M727.01,74.38c-2.21,0-4.24-0.29-6.08-0.87l-3.95,3.71c0.58,0.42,1.3,0.78,2.17,1.07c0.87,0.29,2.12,0.55,3.75,0.79c1.63,0.24,3.92,0.49,6.87,0.75c5.27,0.37,9.03,1.58,11.3,3.63c2.26,2.05,3.4,4.74,3.4,8.06c0,2.26-0.62,4.42-1.86,6.48c-1.24,2.05-3.13,3.74-5.69,5.06c-2.56,1.32-5.83,1.98-9.84,1.98c-3.53,0-6.66-0.46-9.4-1.38c-2.74-0.92-4.87-2.32-6.4-4.19c-1.53-1.87-2.29-4.23-2.29-7.07c0-1.48,0.39-3.07,1.18-4.78c0.79-1.71,2.26-3.33,4.42-4.86c-1.16-0.47-2.15-0.99-2.96-1.54c-0.82-0.55-1.57-1.17-2.25-1.86v-1.82l6.72-6.64c-3.11-2.63-4.66-6.11-4.66-10.43c0-2.58,0.6-4.92,1.82-7.03c1.21-2.11,2.98-3.78,5.29-5.02c2.32-1.24,5.14-1.86,8.45-1.86c2.26,0,4.32,0.32,6.16,0.95h14.46v4.98l-7.35,0.32c1.53,2.21,2.29,4.77,2.29,7.66c0,2.58-0.62,4.93-1.86,7.03c-1.24,2.11-3,3.78-5.29,5.02C733.14,73.77,730.33,74.38,727.01,74.38z M715.48,91.77c0,2.63,1.11,4.6,3.32,5.89c2.21,1.29,4.98,1.94,8.3,1.94c3.27,0,5.89-0.71,7.86-2.13s2.96-3.32,2.96-5.69c0-1.69-0.68-3.15-2.05-4.39c-1.37-1.24-3.9-1.96-7.58-2.17c-2.9-0.21-5.4-0.47-7.51-0.79c-2.16,1.16-3.58,2.41-4.27,3.75S715.48,90.71,715.48,91.77z M727.01,68.93c2.79,0,5.02-0.72,6.68-2.17c1.66-1.45,2.49-3.54,2.49-6.28c0-2.69-0.83-4.75-2.49-6.2c-1.66-1.45-3.88-2.17-6.68-2.17c-2.84,0-5.1,0.72-6.75,2.17c-1.66,1.45-2.49,3.52-2.49,6.2c0,2.74,0.83,4.83,2.49,6.28C721.92,68.21,724.17,68.93,727.01,68.93z"/>
<path d="M757.2,38.83c-1.32,0-2.41-0.43-3.28-1.3c-0.87-0.87-1.3-1.96-1.3-3.28c0-1.26,0.43-2.32,1.3-3.16c0.87-0.84,1.96-1.26,3.28-1.26c1.26,0,2.34,0.42,3.24,1.26c0.89,0.84,1.34,1.9,1.34,3.16c0,1.32-0.45,2.41-1.34,3.28C759.54,38.39,758.46,38.83,757.2,38.83z M753.88,86.71V47.52h6.64v39.19H753.88z"/>
<path d="M785.56,86.71c-3.58,0-6.4-0.87-8.45-2.61s-3.08-4.87-3.08-9.4V53.13h-6.79v-5.61h6.79l0.87-9.4h5.77v9.4h11.54v5.61h-11.54V74.7c0,2.48,0.5,4.15,1.5,5.02c1,0.87,2.77,1.3,5.29,1.3h4.11v5.69H785.56z"/>
<path d="M811.72,87.66c-3.27,0-5.98-0.55-8.14-1.66c-2.16-1.11-3.77-2.58-4.82-4.42c-1.05-1.84-1.58-3.84-1.58-6.01c0-4,1.53-7.08,4.58-9.24c3.05-2.16,7.22-3.24,12.48-3.24h10.59v-0.47c0-3.42-0.9-6.02-2.69-7.78c-1.79-1.76-4.19-2.65-7.19-2.65c-2.58,0-4.81,0.65-6.68,1.94c-1.87,1.29-3.04,3.17-3.52,5.65h-6.79c0.26-2.84,1.22-5.24,2.88-7.19c1.66-1.95,3.73-3.44,6.2-4.46c2.48-1.03,5.11-1.54,7.9-1.54c5.48,0,9.6,1.46,12.37,4.39c2.77,2.92,4.15,6.81,4.15,11.65v24.1h-5.93l-0.4-7.03c-1.11,2.21-2.73,4.1-4.86,5.65S815.3,87.66,811.72,87.66z M812.74,82.05c2.53,0,4.7-0.66,6.52-1.98c1.82-1.32,3.2-3.03,4.15-5.14c0.95-2.11,1.42-4.32,1.42-6.64v-0.08H814.8c-3.9,0-6.65,0.67-8.26,2.01c-1.61,1.34-2.41,3.02-2.41,5.02c0,2.05,0.75,3.7,2.25,4.94C807.88,81.43,810,82.05,812.74,82.05z"/>
<path d="M839.45,86.71V29.82h6.64v56.89H839.45z"/>
</g>
<text transform="matrix(1 0 0 1 853 44)" fill="#0563EB" font-family="ui-monospace,'SF Mono',Menlo,monospace" font-size="18px">T</text>
<text transform="matrix(1 0 0 1 862.6299 44)" fill="#0563EB" font-family="ui-monospace,'SF Mono',Menlo,monospace" font-size="18px">M</text>
</symbol>
</svg>
<div id="progress"></div>`;

// Same token/component CSS as the hand-built CAA / Real Baron proposals — see
// TCD-Proposal-Design-System.md. Kept in one string here so every generated proposal
// stays pixel-identical to that spec without a build step.
const BASE_CSS = `
:root{
  --paper:#F2F4F8;--paper-2:#E8ECF3;--paper-3:#DCE2EC;--ink:#141B26;--ink-soft:#48515F;--ink-faint:#808996;
  --accent:#0563EB;--accent-deep:#0445AE;--line:#D7DEE9;--slate:#182434;
  --serif:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;
  --sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  --mono:'Inter',-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  --sec-pad:108px;--sec-pad-m:64px;--head-gap:60px;--col-gap:56px;
}
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{background:var(--paper);color:var(--ink);font-family:var(--sans);line-height:1.6;-webkit-font-smoothing:antialiased;overflow-x:hidden}
#progress{position:fixed;top:0;left:0;height:3px;width:0;background:var(--accent);z-index:100}
#topnav{position:fixed;top:0;left:0;right:0;z-index:90;background:rgba(242,244,248,.82);backdrop-filter:blur(14px);border-bottom:1px solid var(--line);transform:translateY(-101%);transition:transform .45s cubic-bezier(.2,.7,.2,1)}
#topnav.show{transform:none}
.nav-inner{display:flex;align-items:center;justify-content:space-between;gap:28px;height:60px}
.nav-logo{display:flex;text-decoration:none}
.logo-mark--nav{height:28px}.logo-mark--cover{height:42px}.logo-mark--footer{height:32px;opacity:.85}
.nav-links{display:flex;gap:22px;overflow-x:auto;white-space:nowrap;scrollbar-width:none}
.nav-links a{font-family:var(--mono);font-size:.72rem;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-faint);text-decoration:none}
.nav-links a .n{color:var(--accent);opacity:.55}
.wrap{max-width:1080px;margin:0 auto;padding-left:44px;padding-right:44px;position:relative;z-index:2}
@media(max-width:680px){.wrap{padding-left:24px;padding-right:24px}}
h1,h2,h3{font-family:var(--serif);font-weight:400;line-height:1.05;letter-spacing:-.01em}
.kicker{font-family:'Inter',var(--sans);font-size:.72rem;font-weight:500;letter-spacing:.2em;text-transform:uppercase;color:var(--accent)}
em{font-style:italic}
.cover{min-height:96vh;display:flex;flex-direction:column;justify-content:space-between;padding-top:54px;padding-bottom:72px}
.cover-top{display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:24px}
.cover-meta{font-family:var(--mono);font-size:.74rem;letter-spacing:.08em;color:var(--ink-soft);text-align:right;line-height:2}
.cover-mid{margin:88px 0}
.cover h1{font-size:clamp(3rem,8.4vw,6.6rem);font-weight:400;letter-spacing:-.02em;margin:.34em 0 .5em;text-wrap:balance}
.cover h1 em{font-style:italic;color:var(--accent)}
.cover .lede{font-size:clamp(1.15rem,2.1vw,1.5rem);max-width:36ch;color:var(--ink-soft);line-height:1.45}
.cover-bottom{display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:28px}
.cover-bottom .who{max-width:48ch;font-size:1.02rem;color:var(--ink-soft)}
.scrollcue{font-family:var(--mono);font-size:.7rem;letter-spacing:.2em;text-transform:uppercase;color:var(--ink-faint);display:flex;align-items:center;gap:10px}
.scrollcue span{display:inline-block;width:34px;height:1px;background:var(--ink-faint)}
section{padding-top:var(--sec-pad);padding-bottom:var(--sec-pad);border-top:1px solid var(--line);scroll-margin-top:72px}
@media(max-width:680px){section{padding-top:var(--sec-pad-m);padding-bottom:var(--sec-pad-m)}}
.toc{padding-top:52px;padding-bottom:52px;border-top:1px solid var(--line)}
.toc-grid{display:grid;grid-template-columns:1fr 1fr;column-gap:48px}
@media(max-width:680px){.toc-grid{grid-template-columns:1fr}}
.toc-grid a{display:flex;align-items:baseline;gap:14px;padding:13px 0;border-bottom:1px solid var(--line);color:var(--ink-soft);text-decoration:none;font-size:.98rem;transition:color .2s}
.toc-grid a:hover{color:var(--ink)}
.toc-grid a:hover .toc-n{color:var(--accent-deep)}
.toc-n{font-family:'Inter',var(--sans);font-size:.78rem;letter-spacing:.06em;color:var(--accent);flex-shrink:0;width:22px}
.sechead{margin-bottom:var(--head-gap)}
.sechead h2{font-size:clamp(1.9rem,4.3vw,3rem);font-weight:400;text-wrap:balance}
.sechead .kicker{display:block;margin-bottom:18px}
.prose p{font-size:1.06rem;color:var(--ink-soft);max-width:62ch;margin-bottom:1.15em}
.prose p strong{color:var(--ink);font-weight:600}
.band{background:var(--slate);color:var(--paper);border:none}
.band .kicker{color:#5C9BFF}
.band .big{font-family:var(--serif);font-size:clamp(1.7rem,4.6vw,3.3rem);font-weight:400;line-height:1.16;letter-spacing:-.02em;margin-top:22px;text-wrap:balance}
.band .big em{color:#5C9BFF;font-style:italic}
.band p{color:#AEB7C6;max-width:56ch;margin-top:30px;font-size:1.06rem}
.stack{display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:var(--line);border:1px solid var(--line);border-radius:6px;overflow:hidden}
@media(max-width:680px){.stack{grid-template-columns:1fr}}
.stack-item{background:var(--paper);padding:32px 30px}
@media(max-width:680px){.stack-item{padding:26px 24px}}
.stack-item .si-num{font-family:var(--mono);font-size:.78rem;color:var(--accent);letter-spacing:.06em;display:block;margin-bottom:16px}
.stack-item h3{font-size:1.25rem;font-weight:400;margin-bottom:11px}
.stack-item p{font-size:.95rem;color:var(--ink-soft);line-height:1.55}
.price-list{border-top:1px solid var(--line)}
.price-row{display:flex;justify-content:space-between;align-items:baseline;gap:24px;padding:22px 4px;border-bottom:1px solid var(--line)}
.price-row .tier{font-family:var(--serif);font-size:1.3rem;font-weight:400;display:inline-flex;align-items:center;gap:9px}
.price-row .amt{font-family:var(--mono);font-size:.85rem;font-weight:500;color:var(--accent-deep);letter-spacing:.06em;text-transform:uppercase;flex-shrink:0}
.tier-tip{position:relative}
.info-dot{width:16px;height:16px;border-radius:50%;border:1px solid var(--ink-faint);color:var(--ink-faint);font-family:var(--sans);font-size:.68rem;line-height:1;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;cursor:help;transition:border-color .15s,color .15s}
.tier-tip:hover .info-dot,.info-dot:focus{border-color:var(--accent);color:var(--accent);outline:none}
.info-dot .tip{position:absolute;left:0;bottom:calc(100% + 10px);width:min(280px,80vw);background:var(--slate);color:var(--paper);font-family:var(--sans);font-size:.82rem;font-weight:400;line-height:1.45;letter-spacing:normal;text-transform:none;padding:13px 15px;border-radius:6px;opacity:0;transform:translateY(4px);pointer-events:none;transition:opacity .15s,transform .15s;z-index:5}
.info-dot .tip::after{content:"";position:absolute;top:100%;left:14px;border:6px solid transparent;border-top-color:var(--slate)}
.tier-tip:hover .tip,.info-dot:focus .tip{opacity:1;transform:translateY(0)}
@media(max-width:680px){.info-dot .tip{left:-14px}}
.founder-callout{margin-top:40px;padding:34px 36px;background:var(--paper-2);border-left:3px solid var(--accent);border-radius:0 6px 6px 0}
@media(max-width:680px){.founder-callout{padding:24px 22px}}
.founder-callout .fq{font-family:var(--serif);font-size:1.4rem;line-height:1.28;font-weight:400}
.cta{text-align:center;padding:clamp(48px,7vw,72px) 24px;background:var(--slate);border-radius:10px}
.cta .kicker{display:block;margin-bottom:16px;color:#5C9BFF}
.cta p{font-family:var(--serif);font-size:clamp(1.5rem,3.2vw,2rem);font-weight:400;color:var(--paper);max-width:34ch;margin:0 auto;line-height:1.25}
.cta .reply-note{display:inline-block;margin-top:26px;font-family:var(--mono);font-size:.8rem;letter-spacing:.06em;text-transform:uppercase;color:var(--slate);background:var(--paper);padding:14px 26px;border-radius:100px}
.tl{position:relative}
.tl::before{content:"";position:absolute;left:7px;top:8px;bottom:8px;width:1px;background:var(--line)}
.tl-item{position:relative;padding:0 0 34px 44px}
.tl-item::before{content:"";position:absolute;left:0;top:6px;width:15px;height:15px;border-radius:50%;background:var(--paper);border:2px solid var(--accent)}
.tl-item .day{font-family:var(--mono);font-size:.74rem;letter-spacing:.12em;text-transform:uppercase;color:var(--accent-deep);margin-bottom:6px}
.tl-item h3{font-size:1.18rem;font-weight:400;margin-bottom:7px}
.tl-item p{font-size:.95rem;color:var(--ink-soft);max-width:58ch}
.role-cols{display:grid;grid-template-columns:1.1fr .9fr;gap:var(--col-gap);align-items:start}
@media(max-width:780px){.role-cols{grid-template-columns:1fr;gap:38px}}
.tasklist{list-style:none}
.tasklist li{padding:14px 0 14px 28px;position:relative;border-bottom:1px solid var(--line);font-size:.99rem;color:var(--ink-soft)}
.tasklist li::before{content:"\\2192";position:absolute;left:0;color:var(--accent);font-family:var(--mono)}
.comp-card{background:var(--paper-2);border:1px solid var(--line);border-radius:8px;padding:34px}
@media(max-width:680px){.comp-card{padding:24px}}
.comp-card h3{font-size:1.4rem;font-weight:400;margin-bottom:10px}
.comp-card ul{list-style:none;margin-top:22px}
.comp-card li{font-size:.95rem;color:var(--ink-soft);padding:11px 0;border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}
.comp-card li span:first-child{color:var(--ink);font-weight:500;white-space:nowrap}
.client-wall{border-top:1px solid var(--line);margin-top:44px}
.client-row{display:flex;justify-content:space-between;align-items:baseline;gap:24px;padding:32px 2px;border-bottom:1px solid var(--line)}
.client-row .cw-name{font-family:var(--serif);font-size:clamp(1.6rem,3.4vw,2.5rem);font-weight:400;letter-spacing:-.01em}
.client-row .cw-tag{font-family:var(--mono);font-size:.76rem;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-faint);white-space:nowrap}
@media(max-width:680px){.client-row{flex-direction:column;align-items:flex-start;gap:8px}}
.letter{background:var(--paper-2);border:1px solid var(--line);border-radius:8px;padding:clamp(36px,5vw,68px)}
.letter .salut{font-family:var(--serif);font-size:1.7rem;font-weight:400;margin-bottom:26px}
.letter p{font-size:1.06rem;color:var(--ink-soft);max-width:60ch;margin-bottom:1.15em}
.sign{margin-top:34px;font-family:var(--mono);font-size:.8rem;letter-spacing:.06em;color:var(--ink-soft);line-height:1.9}
footer{padding:54px 0;border-top:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:18px}
footer .f-meta{font-family:var(--mono);font-size:.74rem;letter-spacing:.06em;color:var(--ink-faint);text-align:right}
.reveal{opacity:0;transform:translateY(26px);transition:opacity .8s cubic-bezier(.2,.7,.2,1),transform .8s cubic-bezier(.2,.7,.2,1)}
.reveal.in{opacity:1;transform:none}
@media(prefers-reduced-motion:reduce){.reveal{opacity:1;transform:none;transition:none}}
`;
