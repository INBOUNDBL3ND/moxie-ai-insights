/* client-content.js — public renderer for per-client editable content.
 *
 * Runs on every client dashboard page (index.html + monthly reports).
 * Fetches /.netlify/functions/client-content?client=NNNNNN and:
 *   - Overrides the "Your Active Marketing Services" pills if the
 *     admin has saved an override
 *   - Injects a "Current Work" section containing rows from the admin
 *
 * Insertion points:
 *   - Dashboard index (has .reports-grid):   inserted AFTER .reports-grid
 *   - Monthly report (has .report-footer):   inserted BEFORE .report-footer
 *
 * No-ops if there's no content for this client (silent — page renders
 * exactly as before).
 */
(function () {
  'use strict';

  // Extract client number from URL path: /clients/NNNNNN/... or /clients/NNNNNN
  var m = window.location.pathname.match(/\/clients\/(\d+)(?:\/|$)/);
  if (!m) return;
  var clientNum = m[1];

  // Inject scoped CSS once
  function injectStyles() {
    if (document.getElementById('cw-styles')) return;
    var css = [
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

  function renderCurrentWork(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return;

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

    // Find insertion point
    var reportsGrid = document.querySelector('.reports-grid');
    var footer = document.querySelector('.report-footer');
    if (reportsGrid && reportsGrid.parentNode) {
      reportsGrid.parentNode.insertBefore(section, reportsGrid.nextSibling);
    } else if (footer && footer.parentNode) {
      footer.parentNode.insertBefore(section, footer);
    } else {
      // Fallback — append to container
      var container = document.querySelector('.container');
      if (container) container.appendChild(section);
    }
  }

  function init() {
    injectStyles();
    fetch('/.netlify/functions/client-content?client=' + clientNum + '&cb=' + Date.now())
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data) return;
        applyPillsOverride(data.pills);
        renderCurrentWork(data.currentWork);
      })
      .catch(function () {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
