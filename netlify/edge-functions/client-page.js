// Edge Function: serves dynamically-generated client dashboard HTML
// for clients that don't have a static HTML file.
//
// How it works:
//   1. Netlify tries to serve the static file for /clients/:num/
//   2. If the file exists, context.next() returns 200 — we pass it through
//   3. If 404 (new client, no static file), we check the client registry
//      blob and generate the dashboard HTML from a template
//
// This is an Edge Function (not a regular function) because Edge Functions
// can call context.next() to check whether a static file exists, which
// regular functions cannot do.

import { getStore } from "@netlify/blobs";

export default async function(req, context) {
  // Let Netlify try to serve the static file first
  const res = await context.next();
  if (res.status !== 404) return res;

  // Parse path: /clients/NNNNNNN/ or /clients/NNNNNNN
  const url = new URL(req.url);
  const m = url.pathname.match(/^\/clients\/(\d{7})\/?$/);
  if (!m) return res; // not a 7-digit client path — return the 404

  const num = m[1];

  // Look up client in the registry
  const store = getStore({ name: "client-registry", consistency: "strong" });
  const reg = (await store.get("clients", { type: "json" })) || {};
  const client = reg[num];
  if (!client) return res; // not in registry — return the 404

  // Best-effort: pull optional per-client meta from the client-content blob
  let dropboxLink = "";
  try {
    const contentStore = getStore({ name: "client-content", consistency: "strong" });
    const content = await contentStore.get(num, { type: "json" });
    if (content?.meta?.dropboxLink) dropboxLink = String(content.meta.dropboxLink);
  } catch (_) {}

  const escaped = escapeHtml(client.name);
  const html = buildDashboardHtml(num, escaped, dropboxLink);
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}

export const config = {
  path: "/clients/*",
};

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildDashboardHtml(num, name, dropboxLink) {
  const dropboxBtn = dropboxLink
    ? `<a href="${escapeHtml(dropboxLink)}" target="_blank" rel="noopener" style="background:#fff;color:#1D80DE;padding:12px 22px;border-radius:10px;font-size:1rem;font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:10px;width:100%;justify-content:center;box-sizing:border-box;border:2px solid #1D80DE;"><svg width="32" height="32" viewBox="0 0 43 40" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.5 0L0 8.1l8.7 7 12.8-8.1L12.5 0zM0 22.1l12.5 8.1 9-7-12.8-8.1L0 22.1zM21.5 23.2l9 7 12.5-8.1-8.7-7-12.8 8.1zM43 8.1L30.5 0l-9 7 12.8 8.1L43 8.1zM21.5 25l-9 7.1-3.5-2.3v2.6l12.5 7.5 12.5-7.5v-2.6l-3.5 2.3-9-7.1z" fill="#1D80DE"/></svg> Dropbox</a>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name} | MOXIE AI Insights</title>
  <link rel="stylesheet" href="/css/moxie.css">
  <script src="/js/gate.js" defer></script>
</head>
<body>
  <div class="container">
    <div class="dashboard-header" style="position:relative;">
      <div style="position:absolute;top:16px;right:0;display:flex;flex-direction:column;gap:8px;align-items:flex-end;"><a href="https://calendly.com/walkermeg" target="_blank" rel="noopener noreferrer" style="background:#fff;color:#1D80DE;padding:12px 22px;border-radius:10px;font-size:1rem;font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:10px;width:100%;justify-content:center;box-sizing:border-box;border:2px solid #1D80DE;"><img src="/assets/meg-headshot.png" alt="Meg" style="width:32px;height:32px;border-radius:50%;"> Meet w/ Meg</a>${dropboxBtn}</div>
      <div class="dashboard-hero">
        <img src="/assets/moxie-mascot-xs.png" alt="MOXIE" class="hero-mascot">
      </div>
      <div class="brand">MOXIE AI Insights</div>
      <div class="client-name">${name}</div>
      <a href="/" class="back-link">&larr; Back to Home</a>
    </div>

    <div style="text-align:center;margin-bottom:8px;">
      <button onclick="document.getElementById('video-lightbox').style.display='flex';document.getElementById('explainer-video').play();" style="background:none;border:1.5px solid #1D80DE;color:#1D80DE;padding:6px 16px;border-radius:6px;font-size:0.8rem;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-family:'Barlow',sans-serif;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="#1D80DE"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        How it works in 60 seconds
      </button>
    </div>

    <h2 class="section-label" style="margin-top:24px;">Your Active Marketing Services</h2>
    <div class="services-grid">
      <span class="service-pill" style="color:var(--text-muted);border:1px dashed var(--border);background:transparent;">Services will appear here</span>
    </div>

    <h2 class="section-label" style="margin-top:24px;">Your Monthly Reports</h2>
    <div class="reports-grid">
      <p style="color:var(--text-muted);font-size:0.9rem;text-align:center;padding:24px 0;">Your monthly reports will appear here once generated.</p>
    </div>

    <div class="report-footer">
      <span class="powered-by">Powered by:</span>
      <a href="https://inboundblend.com" target="_blank" rel="noopener noreferrer"><img src="/assets/inbound-blend-logo.png" alt="Inbound Blend" class="footer-logo"></a>
      MOXIE AI Insights
    </div>
  </div>
  <script src="/js/moxie-chat.js" defer></script>
  <script src="/js/client-content.js" defer></script>

  <!-- Video Lightbox -->
  <div id="video-lightbox" onclick="this.style.display='none';this.querySelector('video').pause();" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:10000;align-items:center;justify-content:center;cursor:pointer;">
    <div onclick="event.stopPropagation()" style="position:relative;width:90%;max-width:900px;border-radius:12px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.5);cursor:default;">
      <button onclick="document.getElementById('video-lightbox').style.display='none';document.getElementById('video-lightbox').querySelector('video').pause();" style="position:absolute;top:10px;right:14px;background:rgba(0,0,0,0.5);border:none;color:white;font-size:24px;cursor:pointer;z-index:1;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;">&times;</button>
      <video id="explainer-video" controls style="width:100%;display:block;" src="/assets/moxie-explainer-60s.mp4"></video>
    </div>
  </div>
</body>
</html>`;
}
