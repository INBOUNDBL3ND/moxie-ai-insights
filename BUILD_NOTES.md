# BUILD_NOTES.md

## Permanent Rules

**The production site is the design bible.** When adding new UI to admin/index.html, first inspect the existing HTML in the file to find the CSS classes and patterns already in use. Reuse them. Never create new CSS classes when existing ones would work. Never use raw browser-default form elements — every input, button, select, and textarea must use the existing styled classes.

**DESIGN STANDARD:** The live production site (https://portal.inboundblend.com) is the canonical reference for all UI/UX decisions. Every new feature must match the production site's look, feel, and interaction patterns. When adding new functionality, start by copying the production HTML/CSS/JS for the nearest existing component, then extend it. Never rebuild UI components from scratch.

---

## Build Log — 2026-04-12: Clean Reset + Feature Rebuild

### Phase 1: Reset admin/index.html to production state
- Overwrote admin/index.html with the known-good version from commit `1ec193f`
- Backend files preserved: `client-content.mjs` (v2 schema with status, projects, logo, headings), `create-client.mjs`, `client-page.js` (edge function), `meta-index.mjs`
- `js/client-content.js` preserved: has rendering logic for headings, projects, logo replacement
- `css/moxie.css` was NOT modified in any post-1ec193f commit — clean

### Feature A: Client Status Dropdown
- Added to Client Info section of edit modal
- Status select: Active / NCO / Paused using `.edit-select` class
- Status badges on grid tiles (colored pills using `.tile-status`)
- Filter buttons above grid: All / Active / NCO / Paused
- Status persists via client-content function (status field)
- Status loaded from meta-index on page load for badge rendering

### Feature B: Current Work Headings
- Added "+ Add Heading" button next to "+ Add Row" in CW section
- Heading items render as `.heading-editor` rows with blue border accent
- Uses `type: 'heading'` items in currentWork array
- Backend already supports heading type in client-content.mjs

### Feature C: Projects (multi-project support)
- Projects section added to edit modal
- Each project: name, toggle (ON/OFF), steps editor, preview URL, markup URL, team notes
- Steps: label + status dropdown (Not Started / In Progress / Complete) + reorder + delete
- Collapsible project cards using `.project-card` pattern
- Add Project / Delete Project controls
- Uses `projects[]` array in client-content schema

### Feature D: Client Logo Upload
- Added to Client Info section using `.logo-upload-area` pattern
- Upload preview thumbnail (64x64) in `.logo-preview`
- Remove Logo button
- Logo replaces mascot in .branding div on dashboards (handled by js/client-content.js)

### Feature E: Add New Client
- "+ Add Client" button on admin page using `.add-client-btn`
- Modal with: Client Name, Client Number (7 digits), Slack Channel, Dropbox Link, Legacy Reporting Link, Notes
- Calls create-client function
- New client tile added to grid immediately with pencil icon
- Toast notification on success

## Build Log — 2026-04-12 (pm): Image Lightbox + Active Default + Live Status

### Change 1: Current Work image lightbox + carousel (js/client-content.js)
- Thumbnails: `object-fit: cover` → `object-fit: contain` so full image is visible (no cropping)
- Thumbnails are clickable (cursor: zoom-in) with an expand-icon overlay on hover
- Single lightbox DOM injected lazily on first open (reused afterwards)
- Features: full-screen backdrop (rgba 0,0,0,.85), close button (top-right), carousel arrows, keyboard (Esc/←/→), touch swipe
- Counter (`2 / 5`), caption shows heading + note in white text
- z-index 100000 (above Ask MOXIE chat)
- Body scroll locked while lightbox open; video auto-pauses on close

### Change 2: Default filter = Active (admin/index.html)
- `activeStatusFilter` initialized to `'active'` (was `'all'`)
- Active filter-button marked `.active` by default
- Clients without saved status default to `'active'` via the existing `clientStatuses[num] || 'active'` fallback, so the filter still shows all "unassigned" clients

### Change 3: Live status updates (admin/index.html)
- **Immediate**: `saveContent` updates tile badge + `data-status`, re-runs `applyFilter()` (so a card changed to Paused while viewing Active disappears), shows toast "Status updated to X"
- **Cross-session polling**: `pollClientStatuses()` fetches `/.netlify/functions/meta-index` every 30s, diffs against `clientStatuses`, updates changed badges, re-applies filter, shows toast "N client status(es) changed"
- Also polls on tab `visibilitychange` → visible for fast catch-up
- Lightweight: reuses existing meta-index endpoint (no new function needed — meta-index already returns per-client status)

### Design Decisions
- All new CSS reuses existing CSS variables (--blue, --border, --text, etc.)
- Input/select/button styling matches the production modal patterns exactly
- Project cards use a collapsible pattern for managing multiple projects
- Status filter is AND-ed with existing service/ad-platform stat filters and search
- editState expanded to include all new fields; saveContent sends full payload
