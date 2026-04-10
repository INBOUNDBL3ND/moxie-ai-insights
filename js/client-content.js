/* client-content.js — public renderer for per-client editable content.
 *
 * Runs on every client dashboard page (index.html + monthly reports).
 * Fetches /.netlify/functions/client-content?client=NNNNNN and:
 *   - Overrides the "Your Active Marketing Services" pills if the
 *     admin has saved an override
 *   - Injects a "Website Build Progress" tracker section (when
 *     websiteBuild.enabled is true)
 *   - Injects a "Current Work" section containing rows from the admin
 *
 * Insertion order (top to bottom):
 *   [Website Build Progress], [Current Work]
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
      '.cw-media{width:100%;aspect-ratio:16/10;background:#F1F5F9;overflow:hidden;display:flex;align-items:center;justify-content:center;}',
      '.cw-media img,.cw-media video{width:100%;height:100%;object-fit:cover;display:block;}',
      '.cw-media-empty{color:#94A3B8;font-size:0.8rem;font-weight:600;letter-spacing:1px;text-transform:uppercase;}',
      '.cw-body{padding:14px 16px 16px;display:flex;flex-direction:column;gap:10px;flex:1;}',
      '.cw-note{font-family:var(--font,Barlow,sans-serif);font-size:0.92rem;color:var(--text,#1A1A2E);line-height:1.45;flex:1;}',
      '.cw-cta{display:inline-block;background:var(--blue,#1D80DE);color:#fff !important;padding:8px 16px;border-radius:var(--radius-sm,8px);font-family:var(--font,Barlow,sans-serif);font-weight:600;font-size:0.85rem;text-decoration:none !important;text-align:center;transition:background .15s;align-self:flex-start;}',
      '.cw-cta:hover{background:#1668B8;}',
      '@media (max-width:560px){.current-work-grid{grid-template-columns:1fr;}}',

      /* Website Build section */
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

  // ─────────────────── Website Build tracker ───────────────────
  function buildWebsiteBuildNode(wb) {
    if (!wb || !wb.enabled) return null;
    var steps = Array.isArray(wb.steps) ? wb.steps : [];
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
      '<h2 class="wb-title">Website Build Progress</h2>' +
      '<div class="wb-progress-text">' + progressPct + '% Complete</div>' +
      '</div>' +
      '<div class="wb-subtitle">Here is where your project stands right now. Hover any step with a note for details.</div>';

    var trackerHtml = '<div class="wb-tracker-wrap"><div class="wb-tracker" style="--wb-n:' + n + '">' +
      '<div class="wb-line"><div class="wb-line-fill" style="width:' + fillPercent + '%"></div></div>' +
      '<div class="wb-steps">' + stepsHtml + '</div>' +
      '</div></div>';

    var actionsHtml = '';
    var hasPreview = wb.previewUrl && /\S/.test(wb.previewUrl);
    var hasMarkup = wb.markupUrl && /\S/.test(wb.markupUrl);
    if (hasPreview || hasMarkup) {
      actionsHtml = '<div class="wb-actions">';
      if (hasPreview) {
        actionsHtml += '<a class="wb-btn wb-btn-primary" href="' + escapeHtml(wb.previewUrl) + '" target="_blank" rel="noopener noreferrer">' + eyeSvg + ' Preview Site</a>';
      }
      if (hasMarkup) {
        actionsHtml += '<a class="wb-btn wb-btn-secondary" href="' + escapeHtml(wb.markupUrl) + '" target="_blank" rel="noopener noreferrer">' + markupSvg + ' Share Feedback</a>';
      }
      actionsHtml += '</div>';
    }

    var notesHtml = '';
    if (wb.teamNotes && /\S/.test(wb.teamNotes)) {
      notesHtml = '<div class="wb-notes">' +
        '<span class="wb-notes-label">Notes from the Team</span>' +
        escapeHtml(wb.teamNotes) +
        '</div>';
    }

    var section = document.createElement('div');
    section.className = 'website-build-section';
    section.innerHTML = headerHtml + trackerHtml + actionsHtml + notesHtml;
    return section;
  }

  // ─────────────────── Current Work section ───────────────────
  function buildCurrentWorkNode(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return null;

    var section = document.createElement('div');
    section.className = 'current-work-section';

    var heading = document.createElement('h2');
    heading.className = 'section-label';
    heading.textContent = 'Current Work';
    section.appendChild(heading);

    var grid = document.createElement('div');
    grid.className = 'current-work-grid';

    rows.forEach(function (row) {
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
      card.appendChild(body);

      grid.appendChild(card);
    });
    section.appendChild(grid);
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

  // ─────────────────── init ───────────────────
  function init() {
    injectStyles();
    fetch('/.netlify/functions/client-content?client=' + clientNum + '&cb=' + Date.now())
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data) return;
        applyPillsOverride(data.pills);
        // Order: Website Build (if enabled), then Current Work
        insertSections([
          buildWebsiteBuildNode(data.websiteBuild),
          buildCurrentWorkNode(data.currentWork),
        ]);
      })
      .catch(function () {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
