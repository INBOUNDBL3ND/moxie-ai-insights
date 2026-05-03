// Per-client editable content. Persisted in Netlify Blobs.
// GET is public (client dashboards fetch override content).
// POST from admin page (gated by admin password).
//
// Schema (v2 — projects array replaces websiteBuild):
//   {
//     status: "active" | "nco" | "paused",          // admin-only
//     logoMediaId: string | null,                    // custom logo for dashboard
//     pills: ["SEO", ...] | null,                    // optional pill override
//     currentWork: [
//       { type: "content", id, mediaId, mediaType, note, linkUrl, linkLabel }
//       { type: "heading", id, label }
//     ],
//     projects: [
//       { id, name, enabled, steps:[{label,status,note}], previewUrl, markupUrl, teamNotes }
//     ],
//     meta: { slackChannel, dropboxLink, legacyReportingLink, notes, hidePlatformBreakdown, audienceType }
//   }

import { getStore } from "@netlify/blobs";

const STORE_NAME = "client-content";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-cache, no-store, must-revalidate",
};

function store() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

function emptyContent() {
  return {
    status: "active",
    logoMediaId: null,
    pills: null,
    currentWork: [],
    projects: [],
    meta: { slackChannel: "", dropboxLink: "", legacyReportingLink: "", notes: "", hidePlatformBreakdown: false, audienceType: "" },
  };
}

// ── Migration: upgrade old schemas on read ─────────────────────────
function migrateContent(data) {
  if (!data || typeof data !== "object") return emptyContent();

  // websiteBuild → projects (one-time migration)
  if (data.websiteBuild && !data.projects) {
    const wb = data.websiteBuild;
    if (wb.enabled || (Array.isArray(wb.steps) && wb.steps.length > 0)) {
      data.projects = [{
        id: "migrated-wb-" + Date.now(),
        name: "Website Build",
        enabled: Boolean(wb.enabled),
        steps: Array.isArray(wb.steps) ? wb.steps : [],
        previewUrl: String(wb.previewUrl || ""),
        markupUrl: String(wb.markupUrl || ""),
        teamNotes: String(wb.teamNotes || ""),
      }];
    } else {
      data.projects = [];
    }
    delete data.websiteBuild;
  }
  if (!Array.isArray(data.projects)) data.projects = [];

  // status default
  if (!data.status || !VALID_CLIENT_STATUS.has(data.status)) data.status = "active";

  // logoMediaId default
  if (data.logoMediaId === undefined) data.logoMediaId = null;

  // currentWork type default
  if (Array.isArray(data.currentWork)) {
    data.currentWork = data.currentWork.map((item) => {
      if (!item) return null;
      if (!item.type) item.type = "content";
      return item;
    }).filter(Boolean);
  } else {
    data.currentWork = [];
  }

  if (!data.meta || typeof data.meta !== "object") {
    data.meta = emptyContent().meta;
  }

  if (data.pills === undefined) data.pills = null;

  return data;
}

// ── Validators ─────────────────────────────────────────────────────
const VALID_STEP_STATUS = new Set(["not_started", "in_progress", "complete"]);
const VALID_CLIENT_STATUS = new Set(["active", "nco", "paused"]);

function sanitizeProject(p) {
  if (!p || typeof p !== "object") return null;
  const steps = Array.isArray(p.steps)
    ? p.steps.filter((s) => s && typeof s === "object").map((s) => ({
        label: String(s.label || "").slice(0, 120),
        status: VALID_STEP_STATUS.has(s.status) ? s.status : "not_started",
        note: String(s.note || "").slice(0, 500),
      }))
    : [];
  return {
    id: String(p.id || `proj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
    name: String(p.name || "Untitled Project").slice(0, 200),
    enabled: Boolean(p.enabled),
    steps,
    previewUrl: String(p.previewUrl || "").slice(0, 500),
    markupUrl: String(p.markupUrl || "").slice(0, 500),
    teamNotes: String(p.teamNotes || "").slice(0, 2000),
  };
}

const VALID_AUDIENCE_TYPES = new Set(["", "B2C", "B2B", "Both"]);

function sanitizeMeta(m) {
  if (!m || typeof m !== "object") return emptyContent().meta;
  const audience = String(m.audienceType || "").trim();
  return {
    slackChannel: String(m.slackChannel || "").slice(0, 200),
    dropboxLink: String(m.dropboxLink || "").slice(0, 500),
    legacyReportingLink: String(m.legacyReportingLink || "").slice(0, 500),
    notes: String(m.notes || "").slice(0, 2000),
    hidePlatformBreakdown: Boolean(m.hidePlatformBreakdown),
    audienceType: VALID_AUDIENCE_TYPES.has(audience) ? audience : "",
  };
}

function sanitizeCurrentWorkItem(r, i) {
  if (!r || typeof r !== "object") return null;
  if (r.type === "heading") {
    return {
      type: "heading",
      id: String(r.id || `h-${Date.now()}-${i}`),
      label: String(r.label || "").slice(0, 200),
    };
  }
  return {
    type: "content",
    id: String(r.id || `row-${Date.now()}-${i}`),
    mediaId: r.mediaId ? String(r.mediaId) : "",
    mediaType: r.mediaType === "video" ? "video" : "image",
    note: String(r.note || ""),
    linkUrl: String(r.linkUrl || ""),
    linkLabel: String(r.linkLabel || ""),
  };
}

// ── Meta-index updater ─────────────────────────────────────────────
async function updateMetaIndex(client, content) {
  const idx = getStore({ name: "admin-state", consistency: "strong" });
  const raw = (await idx.get("meta-index", { type: "json" })) || {};
  const has = (v) => typeof v === "string" && /\S/.test(v);
  const meta = content.meta || {};
  const entry = {
    status: content.status || "active",
    slack: has(meta.slackChannel),
    dropbox: has(meta.dropboxLink),
    legacy: has(meta.legacyReportingLink),
    hasLogo: Boolean(content.logoMediaId),
    audienceType: typeof meta.audienceType === "string" ? meta.audienceType : "",
  };
  raw[client] = entry;
  await idx.setJSON("meta-index", raw);
}

// ── Handler ────────────────────────────────────────────────────────
export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("", { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const client = url.searchParams.get("client");
  if (!client || !/^\d+$/.test(client)) {
    return Response.json(
      { error: "Missing or invalid ?client=NNNNNN param" },
      { status: 400, headers: corsHeaders }
    );
  }

  const s = store();

  if (req.method === "GET") {
    const raw = (await s.get(client, { type: "json" })) || null;
    const data = raw ? migrateContent(raw) : emptyContent();
    return Response.json(data, { headers: corsHeaders });
  }

  if (req.method === "POST") {
    try {
      const body = await req.json();
      const out = emptyContent();

      // status
      if (body.status && VALID_CLIENT_STATUS.has(body.status)) {
        out.status = body.status;
      } else {
        out.status = body.status || "active";
        if (!VALID_CLIENT_STATUS.has(out.status)) out.status = "active";
      }

      // logoMediaId
      out.logoMediaId = body.logoMediaId ? String(body.logoMediaId) : null;

      // pills
      if (Array.isArray(body.pills)) {
        out.pills = body.pills.map((p) => (typeof p === "string" ? p.trim() : "")).filter(Boolean);
        if (out.pills.length === 0) out.pills = null;
      }

      // currentWork (with type support)
      if (Array.isArray(body.currentWork)) {
        out.currentWork = body.currentWork
          .map((r, i) => sanitizeCurrentWorkItem(r, i))
          .filter(Boolean);
      }

      // projects
      if (Array.isArray(body.projects)) {
        out.projects = body.projects.map(sanitizeProject).filter(Boolean);
      }

      // meta
      if (body.meta !== undefined) {
        out.meta = sanitizeMeta(body.meta);
      }

      await s.setJSON(client, out);
      try { await updateMetaIndex(client, out); } catch (_) {}
      return Response.json(out, { headers: corsHeaders });
    } catch (err) {
      return Response.json(
        { error: err.message },
        { status: 500, headers: corsHeaders }
      );
    }
  }

  return Response.json(
    { error: "Method not allowed" },
    { status: 405, headers: corsHeaders }
  );
};
