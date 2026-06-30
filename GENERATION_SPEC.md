# June 2026 MOXIE Report Generation Spec

You are generating monthly client dashboard reports. For each assigned client you will WRITE two files:
1. `clients/<NUM>/june-2026.html` (new report)
2. Update `clients/<NUM>/index.html` (prepend a June card)

Then return a per-client manifest (format at bottom). Work precisely; these are client-facing.

## Per-client data sources (read these)
- `data/june_inputs.json[<NUM>]` → `{name, status, audience, pills, has_june_paid, paid_spend, contextNotes}`
- `data/june_perf.json[<NUM>]` → `{name, has_june_paid, paid_spend, sessions, rows:[{platform,budget,spend,impr,reach,clicks,ctr}]}` (June metrics). **`sessions`** = June website sessions (use this for the "Website Sessions" stat and the Website Traffic card; the Website-Traffic `rows` entry has impr=0, do NOT use it for sessions).
- `data/forward_look_overrides.json` → `forward_look` (use forward-look card instead of a reco) and `scope` (hard framing constraints)
- `clients/<NUM>/may-2026.html` → prior report. Carry forward ONLY recurring services; copy template structure.
- **Slack**: load `mcp__claude_ai_Slack__slack_search_channels` + `slack_read_channel` via ToolSearch. Find the channel (`slack_search_channels` query = the 7-digit `<NUM>`), then `slack_read_channel` with `oldest`/`latest` bounding **June 1–30 2026** (oldest ts `1780272000`, latest ts `1782950399`). Read June activity ONLY. **June 2026 epoch bounds: oldest=`1780272000` latest=`1782950399`** (June 1 00:00 UTC – June 30 23:59 UTC 2026). Do NOT use 1748736000/1751343999 — those are June 2025.

## Hard gates (validate.py enforces all of these — 0 failures required)
1. **PAID vs ORGANIC** (the #1 rule): The Analysis may use paid/advertising framing ONLY if `has_june_paid` is true (or scope override allows). If `has_june_paid` is false → ORGANIC: never write "paid side/channels/media/mix", "ad spend", "campaigns", "retargeting/remarketing", "impressions/clicks/CTR", "advertising", "boosted", or name an ad platform in the Analysis. Organic clients talk about: the website, hosting, SEO, organic social content, email, the audience, the brand, readiness. (The MOXIE Recommends card MAY name a paid service — that's a recommendation, allowed.)
2. **MOXIE Recommends gate**: A service may appear in "Add X" ONLY if it is (a) NOT in the client's pills, (b) NOT a platform row in `june_perf`, (c) NOT declined in June Slack. If none fits, OR the client is in `forward_look` overrides → use the forward-look card (h4 title + p), no "Add X". Never recommend something we already run.
3. **Voice — banned**: NO em-dash (— or &mdash;) anywhere in the Analysis or Recommends prose (the `<title>` and breadcrumb legitimately use `&mdash;` — leave those). NO "your" referring to client assets (use "the"). Banned filler: "paid presence", "we've got a sharp eye", "we'll keep building", "rock solid", "humming", "behind the scenes". Do NOT open with the company name as a template frame ("It's been a strong month for X").
4. **Word bands** (Analysis only): full-service 150–220w; hosting-only 100–140w; kickoff/new ~120–165w.
5. **Unique opener AND closer**: the first sentence and last sentence of the Analysis must be distinctive — do not reuse stock sentences. (Cross-report dedup is checked centrally; just write genuinely varied openers/closers.)
6. **Audience vocab**: B2C → households, people, families, shoppers, the community, buyers, foot traffic, repeat customers. B2B → decision-makers, buyers, the right teams, operations leaders, procurement, companies, accounts, pipeline quality, RFP readiness. Never use household/shopper/family for B2B. "Both" → blend. Unset → neutral ("the right audiences/people").

## Activity log ("What We Did This Month")
Only JUNE activities from Slack. One-time items (meetings, builds, specific fixes) appear once, in June only — do NOT repeat May's one-time items. Recurring service lines (Social Media Posts, Email Newsletter, Website Management, SEO, Ads management, Hosting/maintenance) may appear each month. If June Slack is thin, list the recurring services that apply per the pills.

## Analysis voice
Warm, confident, specific — a senior marketer's personal note, not a stat dump. Positives only (never mention a dip). Plain words, varied cadence. Tie the month's work to where the program is heading. Use Slack specifics where available (named work, real deliverables).

## TEMPLATE A — paid client (has_june_paid true)
Use the full template: Analysis → Performance Overview (Ad Impressions = sum of ad-platform impressions; Ad Clicks = sum of ad clicks; Website Sessions = the `sessions` field) → Platform Breakdown (one card per ad platform with June metrics from june_perf, plus a Website Traffic card) → What We Did → Active Services pills → MOXIE Recommends. Copy the exact HTML structure from the client's `may-2026.html`, swap month to June, replace numbers with June metrics, rewrite Analysis/Activity/Recommends.

Platform card icons (reuse from May): FB #1877F2, GS(Google Search) #4285F4, GD(Google Display) #34A853, PM(P-Max) #FBBC05, SH(Shopping) #34A853, RM(Remarketing) #DF6229, LI(LinkedIn) #0A66C2, MS(Microsoft) #00A4EF, YT(YouTube) #FF0000, GF(GeoFencing) #6B7280, DB(Digital Billboards) #6B7280, WT(Website Traffic) #27AE60.

## TEMPLATE B — organic / hosting (has_june_paid false)
NO Performance Overview ad section. Platform Breakdown = service-status cards only (e.g. "Hosting Only" status Active). If `sessions` > 0 you MAY add a single Website Traffic card (WT #27AE60) showing Sessions = `sessions` — organic, not paid. Never show ad impressions/clicks for organic clients. Hosting-only clients: cap analysis 100–140w, stay in lane (uptime/performance/security/maintenance/readiness). Organic-service clients (SEO, organic social, email, web mgmt): talk about that work organically. Then What We Did → pills → MOXIE Recommends (real "Add X" of a paid/growth service they don't have, OR forward-look).

## Exact head + shell (every report)
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><CLIENT NAME> &mdash; June 2026 | MOXIE AI Insights</title>
  <link rel="stylesheet" href="/css/moxie.css">
  <script src="/js/gate.js" defer></script>
</head>
<body>
  <div class="container">
    <div class="report-header">
      <img src="/assets/moxie-mascot-xs.png" alt="MOXIE" style="width:200px;height:200px;">
      <div class="report-month">June 2026</div>
      <div class="client-name"><CLIENT NAME></div>
    </div>
    <div class="breadcrumb"><a href="/">Home</a> &rsaquo; <a href="/clients/<NUM>/"><CLIENT NAME></a> &rsaquo; June 2026</div>

    <div class="moxie-analysis-label"><img src="/assets/moxie-mascot-xs.png" alt="MOXIE">MOXIE's Analysis</div>
    <div class="summary-card">
      <p><ANALYSIS></p>
    </div>
    <!-- [Performance Overview + Platform Breakdown for paid; Platform Breakdown only for organic] -->
    <h2 class="section-label">What We Did This Month</h2>
<div class="activity-list">
      <ul>
        <li><span class="activity-icon">&#9679;</span><ITEM></li>
      </ul>
    </div>
    <h2 class="section-label">Your Active Marketing Services</h2>
<div class="services-grid">
      <span class="service-pill"><PILL></span>
    </div>
    <div class="moxie-analysis-label"><img src="/assets/moxie-mascot-xs.png" alt="MOXIE">MOXIE Recommends</div>
<div class="opportunity-card">
      <h4>Add <SERVICE></h4>
      <p><ONE SENTENCE WHY></p>
    </div>
    <div class="report-footer">
      <span class="powered-by">Powered by:</span>
      <a href="https://inboundblend.com" target="_blank" rel="noopener noreferrer"><img src="/assets/inbound-blend-logo.png" alt="Inbound Blend" class="footer-logo"></a>
      MOXIE AI Insights
    </div>
  </div>
  <script src="/js/moxie-chat.js" defer></script>
  <script src="/js/client-content.js" defer></script>
</body>
</html>
```
Forward-look variant replaces the opportunity-card with:
```html
<div class="opportunity-card">
      <h4><FORWARD-LOOK TITLE></h4>
      <p><FORWARD-LOOK SENTENCE, no service pitch></p>
    </div>
```

## index.html update
Prepend this card immediately after `<div class="reports-grid">` (so June is first):
```html
            <div class="report-card">
        <div class="month">June</div>
        <div class="year-badge">2026</div>
        <a href='/clients/<NUM>/june-2026'>View Report &rarr;</a>
      </div>
```

## Pills
Use the client's `pills` from june_inputs.json verbatim as the Active Services pills. (Exception: Epoxy 2010001 scope override — see overrides; still list contracted pills but body stays website-only.)

## Return manifest (one line per client)
`<NUM> | <paid|organic|hosting|kickoff> | wc=<analysis word count> | reco="<recommends h4>" | opener="<first 8 words>" | closer="<last 8 words>"`
Also report any client with NO June Slack activity, any decline you found, and any offboarding/handoff signal (frame positively, no churn language).
