// Create a new client: validates input, adds to client registry blob,
// initialises the client-content blob with empty content + metadata.
//
// GET  → returns the full registry (merged view for the admin page)
// POST → creates a new client
//
// The client's dashboard page is served dynamically by client-page.mjs
// (via a netlify.toml redirect) — no static file generation needed.

import { getStore } from "@netlify/blobs";

const CONTENT_STORE = "client-content";
const REGISTRY_STORE = "client-registry";
const REG_KEY = "clients";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-cache, no-store, must-revalidate",
};

function registry() {
  return getStore({ name: REGISTRY_STORE, consistency: "strong" });
}
function content() {
  return getStore({ name: CONTENT_STORE, consistency: "strong" });
}
function metaIdx() {
  return getStore({ name: "admin-state", consistency: "strong" });
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("", { status: 200, headers: corsHeaders });
  }

  if (req.method === "GET") {
    const reg = (await registry().get(REG_KEY, { type: "json" })) || {};
    return Response.json(reg, { headers: corsHeaders });
  }

  if (req.method === "POST") {
    try {
      const body = await req.json();
      const name = String(body.name || "").trim();
      const number = String(body.number || "").trim();
      const force = body.force === true;

      if (!name) {
        return Response.json(
          { error: "Client name is required" },
          { status: 400, headers: corsHeaders }
        );
      }
      if (!/^\d{7}$/.test(number)) {
        return Response.json(
          { error: "Client number must be exactly 7 digits" },
          { status: 400, headers: corsHeaders }
        );
      }

      // Check for duplicate — look in both the registry and the
      // static clients.json (proxied by the admin page, but the
      // function can read the deployed static file).
      const reg = (await registry().get(REG_KEY, { type: "json" })) || {};
      if (reg[number] && !force) {
        return Response.json(
          {
            error: `Client number ${number} already exists in the registry`,
            existingName: reg[number].name,
            canForce: true,
          },
          { status: 409, headers: corsHeaders }
        );
      }

      // Also check static clients.json — static clients are real (have committed folders), never force-overwrite
      try {
        const url = new URL(req.url);
        const staticRes = await fetch(`${url.origin}/data/clients.json`);
        if (staticRes.ok) {
          const staticClients = await staticRes.json();
          if (staticClients[number]) {
            return Response.json(
              { error: `Client number ${number} already exists (static client)` },
              { status: 409, headers: corsHeaders }
            );
          }
        }
      } catch (_) {} // best-effort — if this fetch fails, proceed anyway

      // Save to registry
      reg[number] = { name };
      await registry().setJSON(REG_KEY, reg);

      // Initialise client-content blob with empty content + metadata
      const m = body.meta || {};
      const meta = {
        slackChannel:        String(m.slackChannel        ?? body.slackChannel        ?? "").trim().slice(0, 200),
        dropboxLink:         String(m.dropboxLink         ?? body.dropboxLink         ?? "").trim().slice(0, 500),
        legacyReportingLink: String(m.legacyReportingLink ?? body.legacyReportingLink ?? "").trim().slice(0, 500),
        notes:               String(m.notes               ?? body.notes               ?? "").trim().slice(0, 2000),
      };

      const contentData = {
        pills: null,
        currentWork: [],
        websiteBuild: {
          enabled: false,
          steps: [],
          previewUrl: "",
          markupUrl: "",
          teamNotes: "",
        },
        meta,
      };
      await content().setJSON(number, contentData);

      // Update the meta-index for admin card icons
      const has = (v) => typeof v === "string" && /\S/.test(v);
      if (has(meta.slackChannel) || has(meta.dropboxLink) || has(meta.legacyReportingLink)) {
        try {
          const idx = (await metaIdx().get("meta-index", { type: "json" })) || {};
          idx[number] = {
            slack: has(meta.slackChannel),
            dropbox: has(meta.dropboxLink),
            legacy: has(meta.legacyReportingLink),
          };
          await metaIdx().setJSON("meta-index", idx);
        } catch (_) {}
      }

      return Response.json(
        {
          ok: true,
          number,
          name,
          dashboardUrl: `/clients/${number}/`,
        },
        { status: 201, headers: corsHeaders }
      );
    } catch (err) {
      return Response.json(
        { error: err.message },
        { status: 500, headers: corsHeaders }
      );
    }
  }

  if (req.method === "DELETE") {
    try {
      const url = new URL(req.url);
      const number = String(url.searchParams.get("number") || "").trim();
      if (!/^\d{7}$/.test(number)) {
        return Response.json(
          { error: "Client number must be exactly 7 digits" },
          { status: 400, headers: corsHeaders }
        );
      }

      // Refuse to delete static clients (those with committed folders/static data)
      try {
        const staticRes = await fetch(`${url.origin}/data/clients.json`);
        if (staticRes.ok) {
          const staticClients = await staticRes.json();
          if (staticClients[number]) {
            return Response.json(
              { error: `Cannot delete static client ${number}` },
              { status: 409, headers: corsHeaders }
            );
          }
        }
      } catch (_) {}

      const reg = (await registry().get(REG_KEY, { type: "json" })) || {};
      const existed = !!reg[number];
      if (reg[number]) {
        delete reg[number];
        await registry().setJSON(REG_KEY, reg);
      }
      try { await content().delete(number); } catch (_) {}
      try {
        const idx = (await metaIdx().get("meta-index", { type: "json" })) || {};
        if (idx[number]) {
          delete idx[number];
          await metaIdx().setJSON("meta-index", idx);
        }
      } catch (_) {}

      return Response.json(
        { ok: true, number, existed },
        { status: 200, headers: corsHeaders }
      );
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
