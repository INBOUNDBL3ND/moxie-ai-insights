# Build Notes — Admin Control Panel + Current Work section

Build date: 2026-04-10
Branch: `sandbox`
Shipped to: `https://sandbox--moxie-ai-insights.netlify.app`

## What was built

1. **Two new Netlify Functions (v2 `.mjs`)**
   - `netlify/functions/client-content.mjs` — GET/POST per-client JSON
     (pills override + Current Work rows), persisted in Netlify Blobs
     store `client-content`, keyed by client number.
   - `netlify/functions/client-media.mjs` — GET/POST/DELETE for binary
     media (images + videos), persisted in Netlify Blobs store
     `client-media`, keyed by random hex ID. Content-Type preserved
     via blob metadata so `GET ?id=…` returns a proper image/video
     response the browser can render directly.

2. **Public renderer `js/client-content.js`**
   - Runs on every client dashboard page via a `<script src>` tag
     injected into all 250 client HTML files (index + monthly reports).
   - Detects client number from URL path.
   - Fetches `client-content?client=NNNNNN`. If a pills override
     exists it replaces the `.services-grid` contents. If there are
     `currentWork` rows it builds a new "Current Work" section
     and inserts it (after `.reports-grid` on index pages, before
     `.report-footer` on monthly reports).
   - Silent no-op when there's no content for a client (page
     renders exactly as before).
   - Self-contained styles (injected `<style id="cw-styles">`) so
     `css/moxie.css` didn't need to change.

3. **Admin edit UI in `admin/index.html`**
   - Small pencil button in the top-right of each client tile.
     Click stops propagation so the tile's dashboard link isn't
     followed.
   - Clicking opens a modal with two sections:
     - **Your Active Marketing Services** — text-input list, add / remove / rename.
     - **Current Work** — row editor (image/video upload, note textarea,
       link URL, button label, move up / move down / delete).
   - On open, the modal loads the saved content from
     `client-content`. If the client has no pills override yet, the
     editor is *seeded* from the current HTML-baked pills by fetching
     `/clients/NNNNNN/index.html` and parsing out `<span class="service-pill">`
     entries, so the admin starts with the existing state and edits from there.
   - Save POSTs JSON back to `client-content`. Media upload POSTs
     multipart/form-data to `client-media` and stores the returned
     `id` in the row.
   - Reuses the existing admin gate (PIN `080317`) — no new auth.

## Judgment calls I made (no user asked)

1. **Data model** — a single JSON blob per client with `{ pills, currentWork[] }`.
   Could have split into separate blobs (one for pills, one for rows) but that
   doubles the read/write cost for no benefit; they're always edited together.

2. **Pills override vs replacement** — Pills stay hardcoded in the HTML as the
   default. The blob override is optional — if empty/null, the HTML pills render.
   This means you don't have to edit every client just to keep the existing
   pills working. The admin editor *seeds* itself from the HTML so changes are
   additive, not destructive.

3. **Media storage** — Netlify Blobs (separate `client-media` store) rather
   than base64 in the content JSON. Cleaner for real-size images, and the
   `getWithMetadata` pattern lets us serve the right Content-Type from the
   function.

4. **Max upload size** — 10 MB per file, enforced in `client-media.mjs`. Netlify
   functions have a body size limit around 6 MB for JSON responses, but
   multipart upload + blob storage avoids that; 10 MB feels right for ad creative.

5. **Section title** — Used **"Current Work"** per Todd's first suggested name.
   Kept the h2 `section-label` styling consistent with other sections.

6. **Insertion point on monthly reports** — Inserted *before* `.report-footer`
   (so it sits between opportunity and footer). On index pages, inserted *after*
   `.reports-grid` (explicit ask). Script prefers reports-grid if present, falls
   back to report-footer otherwise.

7. **Row delete UX** — A `confirm()` prompt on delete (matches the tone of
   other destructive actions in the admin), no confirm on move or uncheck.

8. **Video display** — `<video controls muted playsinline>`. `muted` is needed
   for iOS to allow inline play without user interaction; `controls` gives them
   a way to hear audio if needed.

9. **Cache-busting on admin fetch** — `?cb=Date.now()` on the admin-side GET
   of client-content so edits taken from another tab show up immediately.
   Public render uses the same cache-bust to avoid stale reads.

10. **Mobile layout** — 16:10 aspect ratio cards, single-column at <560px.
    Edit modal is max 720px wide with scrollable body so it works on phones too.

## Things that are NOT done (flagged for later if needed)

- **Reordering via drag-and-drop** — used simple ↑ / ↓ arrow buttons.
  Drag-and-drop would be nicer UX but needs a library or ~100 lines of
  DOM code; arrows work fine for a small number of rows.
- **Image cropping / resizing on upload** — uploads are stored as-is.
  Large hero images render fine due to `object-fit: cover`.
- **Deleted media cleanup** — if you remove a row or replace its media,
  the old blob entry in `client-media` is orphaned. Not a problem at
  this scale, but a periodic cleanup job could be added later.
- **Per-page overrides** — pills override applies to the index *and* every
  monthly report for that client. There's no way to have different pills
  on different months via this UI (which matches current design anyway).
- **Admin audit log** — no "who edited what when". Can be added by
  stamping `updatedAt` + a user identifier in the blob if needed.

## Test data currently in the sandbox store

The sandbox store has 2 test clients populated so you can see the feature
end-to-end right now:

- **2601002 Jeff Baker & Sons Landscaping** — pills override set, 2 Current
  Work rows with real images (Facebook header + Inbound Blend logo) and
  link buttons. The 4th pill "Featured Service" was added as an override
  demo so you can see the override in action.
- **2010001 Epoxy Stone** — 1 Current Work row with the Inbound Blend logo
  and a link to epoxystone.com.

Both are easy to clear by opening the pencil and deleting the rows, or via
the API:
```bash
curl -X POST https://sandbox--moxie-ai-insights.netlify.app/.netlify/functions/client-content?client=2601002 -H 'Content-Type: application/json' -d '{}'
```

## File inventory

**New:**
- `netlify/functions/client-content.mjs`
- `netlify/functions/client-media.mjs`
- `js/client-content.js`
- `BUILD_NOTES.md` (this file)

**Modified:**
- `admin/index.html` — pencil button, modal, edit CSS, JS handlers
- `clients/**/*.html` — 250 files, one-line script tag insertion

**Unchanged but relevant:**
- `package.json` — `@netlify/blobs` was already there from the invite-state fix
- `js/gate.js` — admin users bypass the client password gate automatically
- `js/moxie-chat.js` — untouched, still loads before client-content.js
