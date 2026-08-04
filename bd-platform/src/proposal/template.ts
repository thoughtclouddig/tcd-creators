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
          `<div class="price-row"><span class="tier">${escapeHtml(c.label)}</span><span class="amt">${c.score10.toFixed(1)} / 10</span></div>`
      )
      .join("\n    ")}
  </div>
  <div class="founder-callout">
    <span class="kicker">TopFan Fit</span>
    <p class="fq">${d.topfanFitScore} / 100 — estimated opportunity ${escapeHtml(d.estimatedRevenueOpportunity)}.</p>
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
<text x="160" y="70" font-family="Georgia,serif" font-size="52">ThoughtCloud Digital</text>
</g>
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
.price-row .tier{font-family:var(--serif);font-size:1.3rem;font-weight:400}
.price-row .amt{font-family:var(--mono);font-size:.85rem;font-weight:500;color:var(--accent-deep);letter-spacing:.06em;text-transform:uppercase}
.founder-callout{margin-top:40px;padding:34px 36px;background:var(--paper-2);border-left:3px solid var(--accent);border-radius:0 6px 6px 0}
@media(max-width:680px){.founder-callout{padding:24px 22px}}
.founder-callout .fq{font-family:var(--serif);font-size:1.4rem;line-height:1.28;font-weight:400}
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
