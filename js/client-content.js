/* client-content.js — public renderer for per-client editable content.
 *
 * Runs on every client dashboard page (index.html + monthly reports).
 * Fetches /.netlify/functions/client-content?client=NNNNNN and:
 *   - Overrides the "Your Active Marketing Services" pills if the
 *     admin has saved an override
 *   - Injects one or more project tracker sections (when enabled)
 *   - Injects a "Current Work" section containing rows from the admin,
 *     with optional heading labels (and rich-text subheadings) that
 *     group content cards
 *   - Adds a thumbs up/down + comment feedback bar to each content card
 *     (persisted via /.netlify/functions/feedback, alerts the admin)
 *   - Replaces MOXIE mascot images with the client logo when provided
 *
 * Insertion order (top to bottom):
 *   [Project trackers...], [Current Work]
 *
 * Insertion point:
 *   - Dashboard index (has .reports-grid):   after  .reports-grid
 *   - Monthly report (has .report-footer):   before .report-footer
 *
 * Silent no-op when there's no content for this client.
 */
(function () {
  'use strict';

  // Extract client number from URL path: /clients/NNNNNN/... or /clients/NNNNNN
  var m = window.location.pathname.match(/\/clients\/(\d+)(?:\/|$)/);
  if (!m) return;
  var clientNum = m[1];

  // ─────────────────── styles ───────────────────
  function injectStyles() {
    if (document.getElementById('cw-styles')) return;
    var css = [
      /* Current Work section */
      '.current-work-section{margin-top:32px;}',
      '.current-work-section h2.section-label{margin-bottom:16px;}',
      '.current-work-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px;}',
      '.cw-card{background:var(--white,#fff);border:1px solid var(--border,#E5E7EB);border-radius:var(--radius,12px);overflow:hidden;display:flex;flex-direction:column;transition:box-shadow .2s,transform .2s;}',
      '.cw-card:hover{box-shadow:0 6px 20px rgba(29,128,222,0.12);transform:translateY(-2px);}',
      '.cw-media{width:100%;aspect-ratio:16/10;background:#F1F5F9;overflow:hidden;display:flex;align-items:center;justify-content:center;position:relative;}',
      '.cw-media img,.cw-media video{width:100%;height:100%;object-fit:contain;display:block;background:#F1F5F9;}',
      '.cw-media-empty{color:#94A3B8;font-size:0.8rem;font-weight:600;letter-spacing:1px;text-transform:uppercase;}',
      '.cw-media.cw-clickable{cursor:zoom-in;}',
      '.cw-media .cw-expand-icon{position:absolute;top:8px;right:8px;width:28px;height:28px;border-radius:6px;background:rgba(0,0,0,0.55);color:#fff;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .15s;pointer-events:none;}',
      '.cw-media.cw-clickable:hover .cw-expand-icon{opacity:1;}',
      /* Lightbox */
      '.cw-lightbox{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,0.85);display:none;align-items:center;justify-content:center;padding:40px 60px;}',
      '.cw-lightbox.open{display:flex;}',
      '.cw-lightbox-stage{position:relative;max-width:90vw;max-height:90vh;display:flex;flex-direction:column;align-items:center;gap:12px;}',
      '.cw-lightbox-media{max-width:90vw;max-height:78vh;display:flex;align-items:center;justify-content:center;transition:opacity .12s;}',
      '.cw-lightbox-media img,.cw-lightbox-media video{max-width:90vw;max-height:78vh;object-fit:contain;display:block;border-radius:8px;box-shadow:0 10px 40px rgba(0,0,0,0.5);transition:opacity .2s;}',
      '.cw-lightbox-caption{color:#fff;font-family:Barlow,sans-serif;font-size:0.9rem;text-align:center;max-width:90vw;line-height:1.4;padding:0 20px;}',
      '.cw-lightbox-caption .cw-lb-heading{display:block;font-family:"Barlow Condensed",sans-serif;font-size:0.75rem;text-transform:uppercase;letter-spacing:1.5px;color:#60a5fa;font-weight:700;margin-bottom:4px;}',
      '.cw-lightbox-close{position:absolute;top:16px;right:20px;width:44px;height:44px;border-radius:50%;background:rgba(0,0,0,0.5);color:#fff;border:none;font-size:28px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:2;transition:background .15s;}',
      '.cw-lightbox-close:hover{background:rgba(255,255,255,0.2);}',
      '.cw-lightbox-arrow{position:absolute;top:50%;transform:translateY(-50%);width:52px;height:52px;border-radius:50%;background:rgba(0,0,0,0.5);color:#fff;border:none;font-size:32px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:2;font-family:serif;transition:background .15s;}',
      '.cw-lightbox-arrow:hover{background:rgba(255,255,255,0.2);}',
      '.cw-lightbox-arrow.prev{left:16px;}',
      '.cw-lightbox-arrow.next{right:16px;}',
      '.cw-lightbox-arrow[disabled]{opacity:0.25;cursor:default;}',
      '.cw-lightbox-counter{position:absolute;bottom:16px;left:50%;transform:translateX(-50%);color:#fff;font-family:Barlow,sans-serif;font-size:0.85rem;background:rgba(0,0,0,0.55);padding:5px 12px;border-radius:20px;z-index:2;}',
      '@media (max-width:600px){.cw-lightbox{padding:20px 8px;}.cw-lightbox-arrow{width:40px;height:40px;font-size:24px;}.cw-lightbox-arrow.prev{left:4px;}.cw-lightbox-arrow.next{right:4px;}}',
      '.cw-body{padding:14px 16px 16px;display:flex;flex-direction:column;gap:10px;flex:1;}',
      '.cw-note{font-family:var(--font,Barlow,sans-serif);font-size:0.92rem;color:var(--text,#1A1A2E);line-height:1.45;flex:1;}',
      '.cw-cta{display:inline-block;background:var(--blue,#1D80DE);color:#fff !important;padding:8px 16px;border-radius:var(--radius-sm,8px);font-family:var(--font,Barlow,sans-serif);font-weight:600;font-size:0.85rem;text-decoration:none !important;text-align:center;transition:background .15s;align-self:flex-start;}',
      '.cw-cta:hover{background:#1668B8;}',
      '@media (max-width:560px){.current-work-grid{grid-template-columns:1fr;}}',

      /* Current Work heading labels */
      '.cw-heading{font-family:"Barlow Condensed",sans-serif;font-size:1.15rem;font-weight:700;color:var(--text,#1A1A2E);border-left:4px solid var(--blue,#1D80DE);padding-left:12px;margin:28px 0 14px;}',
      '.cw-heading:first-child{margin-top:0;}',

      /* Rich-text subheadings (indented under a heading) */
      '.cw-subheading{font-family:var(--font,Barlow,sans-serif);font-size:0.95rem;color:#4B5563;margin:-4px 0 16px 16px;padding-left:12px;border-left:3px solid #DBEAFE;line-height:1.55;max-width:820px;}',
      '.cw-subheading p{margin:0 0 8px;}',
      '.cw-subheading p:last-child{margin-bottom:0;}',
      '.cw-subheading ul,.cw-subheading ol{margin:6px 0;padding-left:20px;}',
      '.cw-subheading a{color:var(--blue,#1D80DE);}',

      /* Card feedback bar (thumbs + comment) */
      '.cw-feedback{display:flex;align-items:center;gap:8px;padding-top:10px;border-top:1px solid #EEF2F6;}',
      '.cw-fb-btn{width:36px;height:30px;border-radius:7px;border:1.5px solid #E5E7EB;background:#fff;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;color:#9CA3AF;transition:all .15s;padding:0;}',
      '.cw-fb-btn svg{pointer-events:none;}',
      '.cw-fb-btn:hover{border-color:#9CA3AF;color:#6B7280;transform:translateY(-1px);}',
      '.cw-fb-btn.cw-fb-up.active{background:#27AE60;border-color:#27AE60;color:#fff;}',
      '.cw-fb-btn.cw-fb-down.active{background:#E74C3C;border-color:#E74C3C;color:#fff;}',
      '.cw-fb-comment-toggle{margin-left:auto;background:none;border:none;color:var(--blue,#1D80DE);font-family:var(--font,Barlow,sans-serif);font-size:0.8rem;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:5px;padding:4px 6px;border-radius:6px;}',
      '.cw-fb-comment-toggle:hover{background:rgba(29,128,222,0.08);}',
      '.cw-fb-form{display:none;flex-direction:column;gap:8px;margin-top:2px;}',
      '.cw-fb-form.open{display:flex;}',
      '.cw-fb-form textarea{width:100%;box-sizing:border-box;min-height:64px;padding:9px 11px;border:1.5px solid #E5E7EB;border-radius:8px;font-family:var(--font,Barlow,sans-serif);font-size:0.85rem;resize:vertical;color:var(--text,#1A1A2E);}',
      '.cw-fb-form textarea:focus{outline:none;border-color:var(--blue,#1D80DE);}',
      '.cw-fb-form-row{display:flex;align-items:center;gap:10px;}',
      '.cw-fb-send{background:var(--blue,#1D80DE);color:#fff;border:none;border-radius:7px;padding:8px 16px;font-weight:700;font-size:0.8rem;cursor:pointer;font-family:var(--font,Barlow,sans-serif);}',
      '.cw-fb-send:hover{background:#1668B8;}',
      '.cw-fb-send:disabled{opacity:.6;cursor:default;}',
      '.cw-fb-status{font-size:0.78rem;color:#27AE60;font-weight:600;font-family:var(--font,Barlow,sans-serif);}',

      /* Message Meg modal */
      '.mm-modal{position:fixed;inset:0;z-index:100001;background:rgba(10,20,40,0.55);display:none;align-items:center;justify-content:center;padding:20px;}',
      '.mm-modal.open{display:flex;}',
      '.mm-box{background:#fff;border-radius:14px;max-width:460px;width:100%;padding:22px 24px;box-shadow:0 30px 80px rgba(0,0,0,0.25);font-family:var(--font,Barlow,sans-serif);}',
      '.mm-box h3{margin:0 0 4px;font-family:"Barlow Condensed",sans-serif;font-size:1.35rem;color:var(--text,#1A1A2E);}',
      '.mm-box p{margin:0 0 12px;font-size:0.85rem;color:#6B7280;}',
      '.mm-box textarea{width:100%;box-sizing:border-box;min-height:110px;padding:10px 12px;border:1.5px solid #E5E7EB;border-radius:8px;font-family:inherit;font-size:0.9rem;resize:vertical;color:var(--text,#1A1A2E);}',
      '.mm-box textarea:focus{outline:none;border-color:var(--blue,#1D80DE);}',
      '.mm-row{display:flex;align-items:center;gap:10px;margin-top:12px;flex-wrap:wrap;}',
      '.mm-cancel{background:#fff;border:1.5px solid #E5E7EB;border-radius:8px;padding:9px 16px;font-weight:600;cursor:pointer;font-family:inherit;color:var(--text,#1A1A2E);}',
      '.mm-send{background:#DF6229;color:#fff;border:none;border-radius:8px;padding:9px 18px;font-weight:700;cursor:pointer;font-family:inherit;}',
      '.mm-send:hover{background:#C4531F;}',
      '.mm-send:disabled{opacity:.6;cursor:default;}',
      '.mm-status{font-size:0.78rem;font-weight:600;color:#27AE60;}',
      '.mm-thread{max-height:240px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;margin-bottom:12px;padding:2px;}',
      '.mm-msg{max-width:85%;padding:8px 12px;border-radius:12px;font-size:0.85rem;line-height:1.45;word-break:break-word;white-space:pre-wrap;}',
      '.mm-msg.client{align-self:flex-end;background:#DF6229;color:#fff;border-bottom-right-radius:4px;}',
      '.mm-msg.team{align-self:flex-start;background:#F1F5F9;color:#1A1A2E;border-bottom-left-radius:4px;}',
      '.mm-msg .mm-when{display:block;font-size:0.65rem;opacity:0.7;margin-top:3px;}',
      '.mm-msg .mm-who{display:block;font-size:0.65rem;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;opacity:0.8;}',
      '.mm-thread-empty{text-align:center;color:#9CA3AF;font-size:0.82rem;padding:10px 0;}',

      /* Satisfaction rating card */
      '.csat-section{margin-top:32px;background:linear-gradient(135deg,#F8FAFF 0%,#FFF7F2 100%);border:1px solid rgba(29,128,222,0.15);border-radius:14px;padding:22px 24px;display:flex;align-items:center;gap:20px;flex-wrap:wrap;}',
      '.csat-text h3{margin:0 0 3px;font-family:"Barlow Condensed",sans-serif;font-size:1.3rem;color:var(--text,#1A1A2E);text-transform:uppercase;letter-spacing:0.5px;}',
      '.csat-text p{margin:0;font-size:0.85rem;color:#6B7280;font-family:var(--font,Barlow,sans-serif);}',
      '.csat-stars{display:flex;gap:6px;margin-left:auto;}',
      '.csat-star{background:none;border:none;cursor:pointer;padding:2px;color:#D1D5DB;transition:transform .12s,color .12s;line-height:0;}',
      '.csat-star:hover{transform:scale(1.18);}',
      '.csat-star.lit{color:#F5B301;}',
      '.csat-thanks{flex-basis:100%;display:none;font-size:0.85rem;font-weight:700;color:#27AE60;font-family:var(--font,Barlow,sans-serif);}',
      '.csat-thanks.show{display:block;}',
      '.csat-followup{flex-basis:100%;display:none;flex-direction:column;gap:8px;}',
      '.csat-followup.open{display:flex;}',
      '.csat-followup textarea{width:100%;box-sizing:border-box;min-height:70px;padding:9px 11px;border:1.5px solid #E5E7EB;border-radius:8px;font-family:var(--font,Barlow,sans-serif);font-size:0.85rem;resize:vertical;color:var(--text,#1A1A2E);}',
      '.csat-followup textarea:focus{outline:none;border-color:var(--blue,#1D80DE);}',
      '@media (max-width:640px){.csat-stars{margin-left:0;}}',
      '.csat-section.csat-pulse{animation:csat-glow 1.5s ease 2;}',
      '@keyframes csat-glow{0%,100%{box-shadow:0 0 0 0 rgba(245,179,1,0);}50%{box-shadow:0 0 0 6px rgba(245,179,1,0.35);}}',

      /* Website Build / Project tracker section */
      '.website-build-section{position:relative;margin-top:32px;padding:26px 24px 24px;background:linear-gradient(140deg,#fbfcfe 0%,#eff6ff 60%,#fff7ed 100%);border-radius:16px;border:1px solid rgba(29,128,222,0.14);overflow:hidden;}',
      '.website-build-section::before{content:"";position:absolute;top:0;left:0;right:0;height:5px;background:linear-gradient(90deg,#27AE60 0%,#1D80DE 50%,#DF6229 100%);}',
      '.wb-header{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:4px;flex-wrap:wrap;}',
      '.wb-title{font-family:"Barlow Condensed",sans-serif;font-weight:800;font-size:1.5rem;margin:0;color:var(--text,#1A1A2E);text-transform:uppercase;letter-spacing:0.8px;}',
      '.wb-progress-text{font-family:"Barlow",sans-serif;font-size:0.8rem;color:var(--text-muted,#6B7280);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;}',
      '.wb-subtitle{color:var(--text-muted,#6B7280);font-size:0.9rem;margin-bottom:28px;font-family:"Barlow",sans-serif;}',

      /* Tracker */
      '.wb-tracker-wrap{overflow-x:auto;padding:0 4px 8px;margin:0 -4px 20px;scrollbar-width:thin;}',
      '.wb-tracker{position:relative;min-width:720px;padding:16px 0 4px;}',
      '.wb-line{position:absolute;top:32px;left:calc(50% / var(--wb-n));right:calc(50% / var(--wb-n));height:4px;background:#E5E7EB;border-radius:3px;overflow:hidden;}',
      '.wb-line-fill{height:100%;background:linear-gradient(90deg,#27AE60 0%,#1D80DE 100%);border-radius:3px;transition:width .8s cubic-bezier(.65,0,.35,1);width:0%;}',
      '.wb-steps{display:flex;position:relative;}',
      '.wb-step{flex:1 0 0;min-width:0;text-align:center;padding:0 2px;position:relative;}',
      '.wb-dot{width:34px;height:34px;border-radius:50%;background:#fff;border:3px solid #E5E7EB;margin:0 auto 10px;display:flex;align-items:center;justify-content:center;font-family:"Barlow",sans-serif;font-size:0.85rem;font-weight:700;color:#9CA3AF;transition:all .3s;position:relative;z-index:2;}',
      '.wb-step.wb-complete .wb-dot{background:#27AE60;border-color:#27AE60;color:#fff;box-shadow:0 4px 12px rgba(39,174,96,0.25);}',
      '.wb-step.wb-in_progress .wb-dot{background:#DF6229;border-color:#DF6229;color:#fff;animation:wb-pulse 2.2s infinite;box-shadow:0 0 0 0 rgba(223,98,41,0.55);}',
      '.wb-step.wb-in_progress .wb-dot::before{content:"";position:absolute;inset:-6px;border-radius:50%;border:2px solid #DF6229;opacity:0.35;animation:wb-ripple 2.2s infinite;}',
      '@keyframes wb-pulse{0%{box-shadow:0 0 0 0 rgba(223,98,41,0.55);}60%{box-shadow:0 0 0 12px rgba(223,98,41,0);}100%{box-shadow:0 0 0 0 rgba(223,98,41,0);}}',
      '@keyframes wb-ripple{0%{transform:scale(1);opacity:0.5;}70%{transform:scale(1.4);opacity:0;}100%{transform:scale(1);opacity:0;}}',
      '.wb-label{font-family:"Barlow",sans-serif;font-size:0.73rem;color:#6B7280;line-height:1.25;font-weight:500;display:block;padding:0 2px;word-break:break-word;}',
      '.wb-step.wb-complete .wb-label,.wb-step.wb-in_progress .wb-label{color:#1A1A2E;font-weight:700;}',

      /* Tooltip for step notes */
      '.wb-step[data-note]{cursor:help;}',
      '.wb-step[data-note] .wb-tooltip{position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);background:#1A1A2E;color:#fff;font-size:0.72rem;padding:7px 11px;border-radius:6px;white-space:nowrap;max-width:220px;opacity:0;pointer-events:none;transition:opacity .15s;z-index:20;box-shadow:0 6px 18px rgba(0,0,0,0.22);}',
      '.wb-step[data-note] .wb-tooltip::after{content:"";position:absolute;top:100%;left:50%;transform:translateX(-50%);border:5px solid transparent;border-top-color:#1A1A2E;}',
      '.wb-step[data-note]:hover .wb-tooltip{opacity:1;}',

      /* Action buttons */
      '.wb-actions{display:flex;gap:12px;margin-top:8px;flex-wrap:wrap;}',
      '.wb-btn{display:inline-flex;align-items:center;gap:8px;padding:11px 20px;border-radius:9px;font-family:"Barlow",sans-serif;font-weight:700;font-size:0.9rem;text-decoration:none !important;transition:all .15s;border:2px solid transparent;}',
      '.wb-btn svg{flex-shrink:0;}',
      '.wb-btn-primary{background:#1D80DE;color:#fff !important;border-color:#1D80DE;}',
      '.wb-btn-primary:hover{background:#1668B8;border-color:#1668B8;transform:translateY(-1px);box-shadow:0 6px 16px rgba(29,128,222,0.28);}',
      '.wb-btn-secondary{background:#fff;color:#DF6229 !important;border-color:#DF6229;}',
      '.wb-btn-secondary:hover{background:#DF6229;color:#fff !important;transform:translateY(-1px);box-shadow:0 6px 16px rgba(223,98,41,0.28);}',

      /* Team notes */
      '.wb-notes{margin-top:20px;padding:18px 20px;background:#fffbeb;border:1px solid #fde68a;border-left:4px solid #f59e0b;border-radius:10px;font-family:"Barlow",sans-serif;color:#1A1A2E;font-size:0.93rem;line-height:1.55;white-space:pre-wrap;position:relative;}',
      '.wb-notes-label{display:block;font-size:0.68rem;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#92400e;margin-bottom:6px;}',

      '@media (max-width:600px){.wb-tracker{min-width:640px;}.wb-title{font-size:1.25rem;}.website-build-section{padding:22px 18px 20px;}}',
    ].join('');
    var style = document.createElement('style');
    style.id = 'cw-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function mediaUrl(mediaId) {
    return '/.netlify/functions/client-media?id=' + encodeURIComponent(mediaId);
  }

  // ─────────────────── Dropbox button (header injection) ───────────────────
  // Static dashboards have the Meet w/ Meg button hard-coded in HTML.
  // Inject a Dropbox button next to it when meta.dropboxLink is set so the
  // toggle works without regenerating the static page. Dynamic dashboards
  // already render the button server-side; this guards against double-injection.
  function applyDropboxButton(dropboxLink) {
    if (!dropboxLink || !/\S/.test(dropboxLink)) return;
    var headerStack = document.querySelector('.dashboard-header > div[style*="position:absolute"]');
    if (!headerStack) return;
    // Skip if a Dropbox button is already present (e.g. dynamic dashboard)
    var existing = headerStack.querySelector('a[data-dropbox-btn]');
    if (existing) return;
    var anchors = headerStack.querySelectorAll('a');
    for (var i = 0; i < anchors.length; i++) {
      if (/dropbox\.com/i.test(anchors[i].getAttribute('href') || '')) return;
    }
    var btn = document.createElement('a');
    btn.setAttribute('data-dropbox-btn', '1');
    btn.href = dropboxLink;
    btn.target = '_blank';
    btn.rel = 'noopener';
    btn.style.cssText = 'background:#fff;color:#1D80DE;padding:12px 22px;border-radius:10px;font-size:1rem;font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:10px;width:100%;justify-content:center;box-sizing:border-box;border:2px solid #1D80DE;';
    btn.innerHTML = '<svg width="32" height="32" viewBox="0 0 43 40" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.5 0L0 8.1l8.7 7 12.8-8.1L12.5 0zM0 22.1l12.5 8.1 9-7-12.8-8.1L0 22.1zM21.5 23.2l9 7 12.5-8.1-8.7-7-12.8 8.1zM43 8.1L30.5 0l-9 7 12.8 8.1L43 8.1zM21.5 25l-9 7.1-3.5-2.3v2.6l12.5 7.5 12.5-7.5v-2.6l-3.5 2.3-9-7.1z" fill="#1D80DE"/></svg> Dropbox';
    headerStack.appendChild(btn);
  }

  // ─────────────────── Platform Breakdown toggle (per-client hide) ───────────
  // For clients not on social/ads, hide the Platform Breakdown section in
  // monthly reports. Keeps the section's markup intact so the toggle is
  // reversible — flip meta.hidePlatformBreakdown back to false and it
  // returns. Matches the section heading text rather than relying on a
  // class so it works across legacy and new report HTML.
  function applyPlatformBreakdownToggle(hide) {
    if (!hide) return;
    var headings = document.querySelectorAll('h2.section-label');
    for (var i = 0; i < headings.length; i++) {
      var h = headings[i];
      if (/^\s*Platform Breakdown\s*$/i.test(h.textContent || '')) {
        h.style.display = 'none';
        var sib = h.nextElementSibling;
        if (sib && sib.classList.contains('platforms-grid')) {
          sib.style.display = 'none';
        }
      }
    }
  }

  // ─────────────────── pills override ───────────────────
  function applyPillsOverride(pills) {
    if (!Array.isArray(pills) || pills.length === 0) return;
    var grid = document.querySelector('.services-grid');
    if (!grid) return;
    grid.innerHTML = pills
      .map(function (p) {
        return '<span class="service-pill">' + escapeHtml(p) + '</span>';
      })
      .join('\n      ');
  }

  // ─────────────────── client logo replacement ───────────────────
  // ONLY replaces the mascot in the dashboard-header branding area
  // and in report-header branding. Does NOT touch MOXIE's Analysis,
  // MOXIE Recommends, or the Ask MOXIE chat button.
  function applyClientLogo(logoMediaId) {
    if (!logoMediaId) return;
    var logoSrc = '/.netlify/functions/client-media?id=' + encodeURIComponent(logoMediaId);
    // Target only the hero mascot (dashboard index pages)
    var heroImg = document.querySelector('.dashboard-hero .hero-mascot');
    if (heroImg) {
      heroImg.src = logoSrc;
      heroImg.style.objectFit = 'contain';
    }
    // Target only the report-header mascot (monthly report pages)
    var reportHeader = document.querySelector('.report-header');
    if (reportHeader) {
      var headerImgs = reportHeader.querySelectorAll('img');
      for (var i = 0; i < headerImgs.length; i++) {
        if (headerImgs[i].src && headerImgs[i].src.indexOf('moxie-mascot') !== -1) {
          headerImgs[i].src = logoSrc;
          headerImgs[i].style.objectFit = 'contain';
        }
      }
    }
  }

  // ─────────────────── Project tracker (generic) ───────────────────
  function buildProjectNode(proj, projectName) {
    if (!proj || !proj.enabled) return null;
    var steps = Array.isArray(proj.steps) ? proj.steps : [];
    if (steps.length === 0) return null;

    var n = steps.length;

    // Find the last non-"not_started" step — fill extends to its dot center.
    var progressIdx = -1;
    var completeCount = 0;
    for (var i = 0; i < n; i++) {
      var st = steps[i] && steps[i].status;
      if (st === 'complete') {
        completeCount++;
        progressIdx = i;
      } else if (st === 'in_progress') {
        progressIdx = i;
      }
    }
    var progressFraction = progressIdx < 0 ? 0 : progressIdx / Math.max(1, n - 1);
    var fillPercent = (progressFraction * 100).toFixed(2);
    var progressPct = Math.round((completeCount / n) * 100);

    var eyeSvg = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
    var markupSvg = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
    var checkSvg = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

    var stepsHtml = '';
    for (var j = 0; j < n; j++) {
      var s = steps[j] || {};
      var status = (s.status === 'complete' || s.status === 'in_progress') ? s.status : 'not_started';
      var label = s.label || ('Step ' + (j + 1));
      var note = s.note || '';
      var dotInner;
      if (status === 'complete') dotInner = checkSvg;
      else if (status === 'in_progress') dotInner = '';
      else dotInner = String(j + 1);

      var tooltip = note ? '<span class="wb-tooltip">' + escapeHtml(note) + '</span>' : '';
      stepsHtml += '<div class="wb-step wb-' + status + '"' + (note ? ' data-note="1"' : '') + '>' +
        '<div class="wb-dot">' + dotInner + '</div>' +
        '<div class="wb-label">' + escapeHtml(label) + '</div>' +
        tooltip +
        '</div>';
    }

    var headerHtml = '<div class="wb-header">' +
      '<h2 class="wb-title">' + escapeHtml(projectName) + '</h2>' +
      '<div class="wb-progress-text">' + progressPct + '% Complete</div>' +
      '</div>' +
      '<div class="wb-subtitle">Here is where your project stands right now. Hover any step with a note for details.</div>';

    var trackerHtml = '<div class="wb-tracker-wrap"><div class="wb-tracker" style="--wb-n:' + n + '">' +
      '<div class="wb-line"><div class="wb-line-fill" style="width:' + fillPercent + '%"></div></div>' +
      '<div class="wb-steps">' + stepsHtml + '</div>' +
      '</div></div>';

    var actionsHtml = '';
    var hasPreview = proj.previewUrl && /\S/.test(proj.previewUrl);
    var hasMarkup = proj.markupUrl && /\S/.test(proj.markupUrl);
    if (hasPreview || hasMarkup) {
      actionsHtml = '<div class="wb-actions">';
      if (hasPreview) {
        actionsHtml += '<a class="wb-btn wb-btn-primary" href="' + escapeHtml(proj.previewUrl) + '" target="_blank" rel="noopener noreferrer">' + eyeSvg + ' Preview Site</a>';
      }
      if (hasMarkup) {
        actionsHtml += '<a class="wb-btn wb-btn-secondary" href="' + escapeHtml(proj.markupUrl) + '" target="_blank" rel="noopener noreferrer">' + markupSvg + ' Share Feedback</a>';
      }
      actionsHtml += '</div>';
    }

    var notesHtml = '';
    if (proj.teamNotes && /\S/.test(proj.teamNotes)) {
      notesHtml = '<div class="wb-notes">' +
        '<span class="wb-notes-label">Notes from the Team</span>' +
        escapeHtml(proj.teamNotes) +
        '</div>';
    }

    var section = document.createElement('div');
    section.className = 'website-build-section';
    section.innerHTML = headerHtml + trackerHtml + actionsHtml + notesHtml;
    return section;
  }

  // ─────────────────── Build project nodes from data ───────────────────
  function buildProjectNodes(data) {
    var nodes = [];

    // New schema: data.projects array
    if (Array.isArray(data.projects)) {
      for (var i = 0; i < data.projects.length; i++) {
        var proj = data.projects[i];
        if (proj && proj.enabled) {
          var node = buildProjectNode(proj, proj.name || 'Project');
          if (node) nodes.push(node);
        }
      }
      return nodes;
    }

    // Legacy schema: single data.websiteBuild object
    if (data.websiteBuild) {
      var legacyNode = buildProjectNode(data.websiteBuild, 'Website Build Progress');
      if (legacyNode) nodes.push(legacyNode);
    }

    return nodes;
  }

  // ─────────────────── Current Work section ───────────────────
  // Lightbox state (populated during render)
  var lightboxItems = []; // [{ src, type, note, heading }]
  var lightboxIdx = 0;

  // Feedback state — current reactions for this client, loaded in init()
  var feedbackReactions = {}; // { [itemId]: { vote: 'up'|'down' } }

  function postFeedback(payload) {
    return fetch('/.netlify/functions/feedback?client=' + clientNum, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  var FB_UP_SVG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M2 20h2V10H2v10zm20-9a2 2 0 0 0-2-2h-6.31l.95-4.57.03-.32a1.5 1.5 0 0 0-.44-1.06L13.17 2 7.59 7.59C7.22 7.95 7 8.45 7 9v10a2 2 0 0 0 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>';
  var FB_DOWN_SVG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M22 4h-2v10h2V4zM2 13a2 2 0 0 0 2 2h6.31l-.95 4.57-.03.32c0 .4.17.77.44 1.06L10.83 22l5.58-5.59c.37-.36.59-.86.59-1.41V5a2 2 0 0 0-2-2H6c-.83 0-1.54.5-1.84 1.22L1.14 11.27c-.09.23-.14.47-.14.73v2z"/></svg>';
  var FB_CHAT_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';

  // Thumbs + comment bar appended to each content card body.
  function buildFeedbackBar(row, label) {
    var bar = document.createElement('div');
    bar.className = 'cw-feedback';

    var upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.className = 'cw-fb-btn cw-fb-up';
    upBtn.title = 'I like this';
    upBtn.innerHTML = FB_UP_SVG;

    var downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.className = 'cw-fb-btn cw-fb-down';
    downBtn.title = 'Not for me';
    downBtn.innerHTML = FB_DOWN_SVG;

    function paintVotes() {
      var v = feedbackReactions[row.id] && feedbackReactions[row.id].vote;
      upBtn.classList.toggle('active', v === 'up');
      downBtn.classList.toggle('active', v === 'down');
    }

    function castVote(vote) {
      var cur = feedbackReactions[row.id] && feedbackReactions[row.id].vote;
      var next = cur === vote ? null : vote; // clicking the active thumb un-votes
      if (next) feedbackReactions[row.id] = { vote: next };
      else delete feedbackReactions[row.id];
      paintVotes();
      postFeedback({ action: 'vote', itemId: row.id, itemLabel: label, vote: next })
        .catch(function () {});
    }

    upBtn.addEventListener('click', function () { castVote('up'); });
    downBtn.addEventListener('click', function () { castVote('down'); });

    var commentBtn = document.createElement('button');
    commentBtn.type = 'button';
    commentBtn.className = 'cw-fb-comment-toggle';
    commentBtn.innerHTML = FB_CHAT_SVG + ' Comment';

    var form = document.createElement('div');
    form.className = 'cw-fb-form';
    var ta = document.createElement('textarea');
    ta.placeholder = 'Tell us what you think about this one…';
    var formRow = document.createElement('div');
    formRow.className = 'cw-fb-form-row';
    var sendBtn = document.createElement('button');
    sendBtn.type = 'button';
    sendBtn.className = 'cw-fb-send';
    sendBtn.textContent = 'Send to the Team';
    var statusEl = document.createElement('span');
    statusEl.className = 'cw-fb-status';
    formRow.appendChild(sendBtn);
    formRow.appendChild(statusEl);
    form.appendChild(ta);
    form.appendChild(formRow);

    commentBtn.addEventListener('click', function () {
      form.classList.toggle('open');
      if (form.classList.contains('open')) ta.focus();
    });

    sendBtn.addEventListener('click', function () {
      var text = ta.value.replace(/^\s+|\s+$/g, '');
      if (!text) { ta.focus(); return; }
      sendBtn.disabled = true;
      statusEl.style.color = '';
      statusEl.textContent = 'Sending…';
      postFeedback({ action: 'comment', itemId: row.id, itemLabel: label, text: text })
        .then(function (r) { if (!r.ok) throw new Error('send failed'); })
        .then(function () {
          sendBtn.disabled = false;
          ta.value = '';
          statusEl.textContent = 'Thanks! Sent to the team ✓';
          setTimeout(function () {
            statusEl.textContent = '';
            form.classList.remove('open');
          }, 2500);
        })
        .catch(function () {
          sendBtn.disabled = false;
          statusEl.style.color = '#E74C3C';
          statusEl.textContent = 'Could not send — please try again';
        });
    });

    paintVotes();
    bar.appendChild(upBtn);
    bar.appendChild(downBtn);
    bar.appendChild(commentBtn);
    return { bar: bar, form: form };
  }

  // ─────────────────── Message Meg (header button + modal) ───────────────────
  var mmModal = null;
  var feedbackMessages = []; // persistent thread, loaded in init()

  function fmtWhen(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    try {
      return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch (e) {
      return d.toLocaleDateString();
    }
  }

  function markThreadSeen() {
    try { localStorage.setItem('moxie_mm_seen_' + clientNum, String(feedbackMessages.length)); } catch (e) {}
  }

  // Red dot on the Message Meg button when the last message is an unseen team reply
  function updateMegBadge() {
    var btn = document.querySelector('[data-message-meg]');
    if (!btn) return;
    var dot = btn.querySelector('.mm-dot');
    var seen = 0;
    try { seen = parseInt(localStorage.getItem('moxie_mm_seen_' + clientNum) || '0', 10) || 0; } catch (e) {}
    var last = feedbackMessages[feedbackMessages.length - 1];
    var unseen = feedbackMessages.length > seen && last && last.from === 'team';
    if (unseen && !dot) {
      dot = document.createElement('span');
      dot.className = 'mm-dot';
      dot.style.cssText = 'width:10px;height:10px;border-radius:50%;background:#E74C3C;display:inline-block;flex-shrink:0;';
      btn.appendChild(dot);
    } else if (!unseen && dot) {
      dot.remove();
    }
  }

  function renderMegThread() {
    if (!mmModal) return;
    var thread = mmModal.querySelector('.mm-thread');
    if (!thread) return;
    if (!feedbackMessages.length) {
      thread.innerHTML = '<div class="mm-thread-empty">No messages yet — say hello!</div>';
      return;
    }
    thread.innerHTML = feedbackMessages.map(function (m) {
      var who = m.from === 'team' ? '<span class="mm-who">Meg &amp; the Team</span>' : '';
      return '<div class="mm-msg ' + (m.from === 'team' ? 'team' : 'client') + '">' + who +
        escapeHtml(m.text) +
        (m.at ? '<span class="mm-when">' + escapeHtml(fmtWhen(m.at)) + '</span>' : '') +
        '</div>';
    }).join('');
    thread.scrollTop = thread.scrollHeight;
  }

  function closeMessageMeg() {
    if (!mmModal) return;
    mmModal.classList.remove('open');
    var st = mmModal.querySelector('.mm-status');
    if (st) st.textContent = '';
  }

  function openMessageMeg() {
    if (!mmModal) {
      mmModal = document.createElement('div');
      mmModal.className = 'mm-modal';
      mmModal.innerHTML =
        '<div class="mm-box">' +
          '<h3>' + FB_CHAT_SVG + ' Message Meg</h3>' +
          '<p>Send a quick note to the team — it goes straight to us and we’ll follow up.</p>' +
          '<div class="mm-thread"></div>' +
          '<textarea placeholder="What can we help with?"></textarea>' +
          '<div class="mm-row">' +
            '<button type="button" class="mm-cancel">Close</button>' +
            '<button type="button" class="mm-send">Send Message</button>' +
            '<span class="mm-status"></span>' +
          '</div>' +
        '</div>';
      document.body.appendChild(mmModal);
      mmModal.addEventListener('click', function (e) {
        if (e.target === mmModal) closeMessageMeg();
      });
      mmModal.querySelector('.mm-cancel').addEventListener('click', closeMessageMeg);
      var sendBtn = mmModal.querySelector('.mm-send');
      sendBtn.addEventListener('click', function () {
        var ta = mmModal.querySelector('textarea');
        var status = mmModal.querySelector('.mm-status');
        var text = ta.value.replace(/^\s+|\s+$/g, '');
        if (!text) { ta.focus(); return; }
        sendBtn.disabled = true;
        status.style.color = '';
        status.textContent = 'Sending…';
        postFeedback({ action: 'message', text: text })
          .then(function (r) { if (!r.ok) throw new Error('send failed'); })
          .then(function () {
            sendBtn.disabled = false;
            ta.value = '';
            status.textContent = 'Sent! Meg will follow up soon ✓';
            feedbackMessages.push({ from: 'client', text: text, at: new Date().toISOString() });
            markThreadSeen();
            renderMegThread();
            setTimeout(function () { status.textContent = ''; }, 2500);
          })
          .catch(function () {
            sendBtn.disabled = false;
            status.style.color = '#E74C3C';
            status.textContent = 'Could not send — please try again';
          });
      });
    }
    renderMegThread();
    markThreadSeen();
    updateMegBadge();
    mmModal.classList.add('open');
    mmModal.querySelector('textarea').focus();
  }

  // Injects a "Message Meg" button into the dashboard header button stack
  // (same stack as Meet w/ Meg / Dropbox — dashboard index pages only).
  function applyMessageMegButton() {
    var headerStack = document.querySelector('.dashboard-header > div[style*="position:absolute"]');
    if (!headerStack) return;
    if (headerStack.querySelector('[data-message-meg]')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-message-meg', '1');
    btn.style.cssText = 'background:#fff;color:#DF6229;padding:12px 22px;border-radius:10px;font-size:1rem;font-weight:600;font-family:Barlow,sans-serif;display:inline-flex;align-items:center;gap:10px;width:100%;justify-content:center;box-sizing:border-box;border:2px solid #DF6229;cursor:pointer;';
    btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> Message Meg';
    btn.addEventListener('click', openMessageMeg);
    headerStack.appendChild(btn);
  }

  // ─────────────────── Satisfaction rating ("How are we doing?") ───────────────────
  var CSAT_STAR_SVG = '<svg width="27" height="27" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>';

  function buildRatingNode(rating) {
    // Dashboard index only — monthly reports stay clean
    if (!document.querySelector('.reports-grid')) return null;
    var selected = (rating && rating.stars) || 0;

    var section = document.createElement('div');
    section.className = 'csat-section';

    var textDiv = document.createElement('div');
    textDiv.className = 'csat-text';
    textDiv.innerHTML = '<h3>How Are We Doing?</h3><p>Tap a star to rate your experience with our team — it goes straight to us.</p>';
    section.appendChild(textDiv);

    var starsWrap = document.createElement('div');
    starsWrap.className = 'csat-stars';
    var starBtns = [];

    var thanks = document.createElement('div');
    thanks.className = 'csat-thanks';

    var followup = document.createElement('div');
    followup.className = 'csat-followup';
    var fuTa = document.createElement('textarea');
    var fuRow = document.createElement('div');
    fuRow.className = 'cw-fb-form-row';
    var fuSend = document.createElement('button');
    fuSend.type = 'button';
    fuSend.className = 'cw-fb-send';
    fuSend.textContent = 'Send';
    var fuStatus = document.createElement('span');
    fuStatus.className = 'cw-fb-status';
    fuRow.appendChild(fuSend);
    fuRow.appendChild(fuStatus);
    followup.appendChild(fuTa);
    followup.appendChild(fuRow);

    function paint(n) {
      for (var i = 0; i < 5; i++) starBtns[i].classList.toggle('lit', i < n);
    }

    for (var i = 0; i < 5; i++) {
      (function (idx) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'csat-star';
        b.title = (idx + 1) + ' out of 5';
        b.innerHTML = CSAT_STAR_SVG;
        b.addEventListener('mouseenter', function () { paint(idx + 1); });
        b.addEventListener('click', function () {
          selected = idx + 1;
          paint(selected);
          thanks.textContent = 'Thanks — your rating has been shared with the team ✓';
          thanks.classList.add('show');
          fuTa.placeholder = selected <= 3
            ? 'Sorry we’re not hitting the mark — what could we do better?'
            : 'Anything you’d like us to know? (optional)';
          followup.classList.add('open');
          fuStatus.textContent = '';
          postFeedback({ action: 'rating', stars: selected }).catch(function () {});
        });
        starBtns.push(b);
        starsWrap.appendChild(b);
      })(i);
    }
    starsWrap.addEventListener('mouseleave', function () { paint(selected); });
    paint(selected);

    fuSend.addEventListener('click', function () {
      var text = fuTa.value.replace(/^\s+|\s+$/g, '');
      if (!text) { fuTa.focus(); return; }
      fuSend.disabled = true;
      fuStatus.style.color = '';
      fuStatus.textContent = 'Sending…';
      postFeedback({ action: 'rating', stars: selected, text: text })
        .then(function (r) { if (!r.ok) throw new Error('send failed'); })
        .then(function () {
          fuSend.disabled = false;
          fuTa.value = '';
          fuStatus.textContent = 'Sent — thank you! ✓';
          setTimeout(function () { followup.classList.remove('open'); }, 2500);
        })
        .catch(function () {
          fuSend.disabled = false;
          fuStatus.style.color = '#E74C3C';
          fuStatus.textContent = 'Could not send — please try again';
        });
    });

    section.appendChild(starsWrap);
    section.appendChild(thanks);
    section.appendChild(followup);
    return section;
  }

  // Header button that scrolls to (and briefly highlights) the rating card
  function applyRatingButton() {
    var headerStack = document.querySelector('.dashboard-header > div[style*="position:absolute"]');
    if (!headerStack) return;
    if (headerStack.querySelector('[data-csat-btn]')) return;
    if (!document.querySelector('.csat-section')) return; // card not on this page
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-csat-btn', '1');
    btn.style.cssText = 'background:#fff;color:#1A1A2E;padding:12px 22px;border-radius:10px;font-size:1rem;font-weight:600;font-family:Barlow,sans-serif;display:inline-flex;align-items:center;gap:10px;width:100%;justify-content:center;box-sizing:border-box;border:2px solid #F5B301;cursor:pointer;';
    btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="#F5B301"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg> How Are We Doing?';
    btn.addEventListener('click', function () {
      var card = document.querySelector('.csat-section');
      if (!card) return;
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.classList.remove('csat-pulse');
      void card.offsetWidth; // restart the animation on repeat clicks
      card.classList.add('csat-pulse');
      setTimeout(function () { card.classList.remove('csat-pulse'); }, 3200);
    });
    headerStack.appendChild(btn);
  }

  function buildContentCard(row, lightboxContext) {
    var card = document.createElement('div');
    card.className = 'cw-card';

    var media = document.createElement('div');
    media.className = 'cw-media';
    if (row.mediaId) {
      if (row.mediaType === 'video') {
        var v = document.createElement('video');
        v.src = mediaUrl(row.mediaId);
        v.controls = true;
        v.playsInline = true;
        v.muted = true;
        media.appendChild(v);
      } else {
        var img = document.createElement('img');
        img.src = mediaUrl(row.mediaId);
        img.alt = row.note || 'Current work';
        img.loading = 'lazy';
        media.appendChild(img);
        // Register this image in the lightbox list and make the thumb clickable
        var itemIdx = lightboxItems.length;
        lightboxItems.push({
          src: mediaUrl(row.mediaId),
          type: 'image',
          note: row.note || '',
          heading: (lightboxContext && lightboxContext.currentHeading) || ''
        });
        media.classList.add('cw-clickable');
        var expandIcon = document.createElement('div');
        expandIcon.className = 'cw-expand-icon';
        expandIcon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
        media.appendChild(expandIcon);
        media.addEventListener('click', function () { openLightbox(itemIdx); });
      }
    } else {
      var placeholder = document.createElement('div');
      placeholder.className = 'cw-media-empty';
      placeholder.textContent = 'No media';
      media.appendChild(placeholder);
    }
    card.appendChild(media);

    var body = document.createElement('div');
    body.className = 'cw-body';
    if (row.note) {
      var note = document.createElement('div');
      note.className = 'cw-note';
      note.textContent = row.note;
      body.appendChild(note);
    }
    if (row.linkUrl) {
      var a = document.createElement('a');
      a.className = 'cw-cta';
      a.href = row.linkUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = row.linkLabel || 'View';
      body.appendChild(a);
    }

    // Feedback bar — only for saved rows (they always carry an id)
    if (row.id) {
      var label = String(row.note || (lightboxContext && lightboxContext.currentHeading) || 'Creative item').slice(0, 140);
      var fb = buildFeedbackBar(row, label);
      body.appendChild(fb.bar);
      body.appendChild(fb.form);
    }
    card.appendChild(body);

    return card;
  }

  function buildCurrentWorkNode(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return null;

    // Reset lightbox list for this render
    lightboxItems = [];
    var ctx = { currentHeading: '' };

    var section = document.createElement('div');
    section.className = 'current-work-section';

    var heading = document.createElement('h2');
    heading.className = 'section-label';
    heading.textContent = 'Current Work';
    section.appendChild(heading);

    // Check whether any item has type "heading" or "subheading"
    var hasHeadings = false;
    for (var k = 0; k < rows.length; k++) {
      if (rows[k].type === 'heading' || rows[k].type === 'subheading') { hasHeadings = true; break; }
    }

    if (!hasHeadings) {
      // No headings — single grid, same as original behavior
      var grid = document.createElement('div');
      grid.className = 'current-work-grid';
      for (var i = 0; i < rows.length; i++) {
        grid.appendChild(buildContentCard(rows[i], ctx));
      }
      section.appendChild(grid);
    } else {
      // Alternate between heading elements and grid groups
      var container = document.createElement('div');
      var currentGrid = null;

      for (var j = 0; j < rows.length; j++) {
        var row = rows[j];
        var itemType = row.type || 'content';

        if (itemType === 'heading') {
          // Close any open grid
          if (currentGrid) {
            container.appendChild(currentGrid);
            currentGrid = null;
          }
          var headingText = row.note || row.label || '';
          ctx.currentHeading = headingText;
          var h3 = document.createElement('h3');
          h3.className = 'cw-heading';
          h3.textContent = headingText;
          container.appendChild(h3);
        } else if (itemType === 'subheading') {
          // Rich-text subheading — indented block, closes any open grid.
          // HTML is sanitized server-side on save (admin-authored only).
          if (currentGrid) {
            container.appendChild(currentGrid);
            currentGrid = null;
          }
          var sub = document.createElement('div');
          sub.className = 'cw-subheading';
          sub.innerHTML = row.html || '';
          container.appendChild(sub);
        } else {
          // Content card — add to current grid, create one if needed
          if (!currentGrid) {
            currentGrid = document.createElement('div');
            currentGrid.className = 'current-work-grid';
          }
          currentGrid.appendChild(buildContentCard(row, ctx));
        }
      }
      // Flush final grid
      if (currentGrid) {
        container.appendChild(currentGrid);
      }
      section.appendChild(container);
    }

    return section;
  }

  // ─────────────────── insertion ───────────────────
  function insertSections(nodes) {
    var toInsert = nodes.filter(Boolean);
    if (toInsert.length === 0) return;

    var fragment = document.createDocumentFragment();
    toInsert.forEach(function (n) { fragment.appendChild(n); });

    var reportsGrid = document.querySelector('.reports-grid');
    if (reportsGrid && reportsGrid.parentNode) {
      reportsGrid.parentNode.insertBefore(fragment, reportsGrid.nextSibling);
      return;
    }
    var footer = document.querySelector('.report-footer');
    if (footer && footer.parentNode) {
      footer.parentNode.insertBefore(fragment, footer);
      return;
    }
    var container = document.querySelector('.container');
    if (container) container.appendChild(fragment);
  }

  // ─────────────────── Lightbox ───────────────────
  var lightboxEl = null;
  var lightboxMediaEl = null;
  var lightboxCaptionEl = null;
  var lightboxCounterEl = null;
  var lightboxPrevBtn = null;
  var lightboxNextBtn = null;
  var lightboxTouchStartX = null;

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function buildLightbox() {
    if (lightboxEl) return;
    lightboxEl = document.createElement('div');
    lightboxEl.className = 'cw-lightbox';
    lightboxEl.innerHTML =
      '<button class="cw-lightbox-close" aria-label="Close">&times;</button>' +
      '<button class="cw-lightbox-arrow prev" aria-label="Previous">&#8249;</button>' +
      '<button class="cw-lightbox-arrow next" aria-label="Next">&#8250;</button>' +
      '<div class="cw-lightbox-stage">' +
        '<div class="cw-lightbox-media"></div>' +
        '<div class="cw-lightbox-caption"></div>' +
      '</div>' +
      '<div class="cw-lightbox-counter"></div>';
    document.body.appendChild(lightboxEl);

    lightboxMediaEl = lightboxEl.querySelector('.cw-lightbox-media');
    lightboxCaptionEl = lightboxEl.querySelector('.cw-lightbox-caption');
    lightboxCounterEl = lightboxEl.querySelector('.cw-lightbox-counter');
    lightboxPrevBtn = lightboxEl.querySelector('.cw-lightbox-arrow.prev');
    lightboxNextBtn = lightboxEl.querySelector('.cw-lightbox-arrow.next');

    // Click backdrop to close (but not the stage)
    lightboxEl.addEventListener('click', function (e) {
      if (e.target === lightboxEl) closeLightbox();
    });
    lightboxEl.querySelector('.cw-lightbox-close').addEventListener('click', closeLightbox);
    lightboxPrevBtn.addEventListener('click', function (e) { e.stopPropagation(); navLightbox(-1); });
    lightboxNextBtn.addEventListener('click', function (e) { e.stopPropagation(); navLightbox(1); });

    // Keyboard
    document.addEventListener('keydown', function (e) {
      if (!lightboxEl.classList.contains('open')) return;
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') navLightbox(-1);
      else if (e.key === 'ArrowRight') navLightbox(1);
    });

    // Touch swipe
    lightboxEl.addEventListener('touchstart', function (e) {
      lightboxTouchStartX = e.touches[0].clientX;
    }, { passive: true });
    lightboxEl.addEventListener('touchend', function (e) {
      if (lightboxTouchStartX === null) return;
      var dx = e.changedTouches[0].clientX - lightboxTouchStartX;
      lightboxTouchStartX = null;
      if (Math.abs(dx) > 50) {
        navLightbox(dx < 0 ? 1 : -1);
      }
    });
  }

  function openLightbox(idx) {
    if (!lightboxItems.length) return;
    buildLightbox();
    lightboxIdx = Math.max(0, Math.min(idx || 0, lightboxItems.length - 1));
    renderLightbox();
    lightboxEl.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    if (!lightboxEl) return;
    lightboxEl.classList.remove('open');
    document.body.style.overflow = '';
    // Pause any playing video
    var vid = lightboxMediaEl.querySelector('video');
    if (vid) try { vid.pause(); } catch (e) {}
  }

  function navLightbox(dir) {
    var next = lightboxIdx + dir;
    if (next < 0 || next >= lightboxItems.length) return;
    lightboxIdx = next;
    renderLightbox();
  }

  function renderLightbox() {
    var item = lightboxItems[lightboxIdx];
    if (!item) return;
    // Swap media with a quick fade
    lightboxMediaEl.style.opacity = '0';
    setTimeout(function () {
      lightboxMediaEl.innerHTML = '<img src="' + escapeHtml(item.src) + '" alt="' + escapeHtml(item.note) + '">';
      lightboxMediaEl.style.opacity = '1';
    }, 120);

    var cap = '';
    if (item.heading) cap += '<span class="cw-lb-heading">' + escapeHtml(item.heading) + '</span>';
    if (item.note) cap += escapeHtml(item.note);
    lightboxCaptionEl.innerHTML = cap;
    lightboxCaptionEl.style.display = cap ? '' : 'none';

    if (lightboxItems.length > 1) {
      lightboxCounterEl.textContent = (lightboxIdx + 1) + ' / ' + lightboxItems.length;
      lightboxCounterEl.style.display = '';
      lightboxPrevBtn.style.display = '';
      lightboxNextBtn.style.display = '';
      lightboxPrevBtn.disabled = lightboxIdx === 0;
      lightboxNextBtn.disabled = lightboxIdx === lightboxItems.length - 1;
    } else {
      lightboxCounterEl.style.display = 'none';
      lightboxPrevBtn.style.display = 'none';
      lightboxNextBtn.style.display = 'none';
    }
  }

  // ─────────────────── init ───────────────────
  function init() {
    injectStyles();
    var contentP = fetch('/.netlify/functions/client-content?client=' + clientNum + '&cb=' + Date.now())
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
    var feedbackP = fetch('/.netlify/functions/feedback?client=' + clientNum + '&cb=' + Date.now())
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
    Promise.all([contentP, feedbackP])
      .then(function (results) {
        var data = results[0];
        var fb = results[1];
        if (fb && fb.reactions && typeof fb.reactions === 'object') {
          feedbackReactions = fb.reactions;
        }
        if (fb && Array.isArray(fb.messages)) {
          feedbackMessages = fb.messages;
        }
        // These render even when there's no admin-saved content yet
        applyMessageMegButton();
        updateMegBadge();
        var ratingNode = buildRatingNode(fb && fb.rating);
        if (!data) {
          insertSections([ratingNode]);
          applyRatingButton();
          return;
        }
        applyPillsOverride(data.pills);
        applyClientLogo(data.logoMediaId);
        var meta = data.meta || {};
        applyDropboxButton(meta.dropboxLink);
        applyPlatformBreakdownToggle(meta.hidePlatformBreakdown);
        // Order: Project trackers (if any), then Current Work, then the rating card
        var projectNodes = buildProjectNodes(data);
        var currentWorkNode = buildCurrentWorkNode(data.currentWork);
        insertSections(projectNodes.concat([currentWorkNode, ratingNode]));
        applyRatingButton(); // after the card exists in the DOM
      })
      .catch(function () {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
