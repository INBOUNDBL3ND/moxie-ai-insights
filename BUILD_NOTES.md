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

### Design Decisions
- All new CSS reuses existing CSS variables (--blue, --border, --text, etc.)
- Input/select/button styling matches the production modal patterns exactly
- Project cards use a collapsible pattern for managing multiple projects
- Status filter is AND-ed with existing service/ad-platform stat filters and search
- editState expanded to include all new fields; saveContent sends full payload
