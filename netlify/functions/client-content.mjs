// Per-client editable content (pills override + Current Work rows).
// Persisted in Netlify Blobs. GET is public (used by client dashboards
// to fetch override content). POST is expected to come from the admin
// page which is already gated by the admin password — no extra auth
// needed, same security model as invites.mjs / health.mjs.
//
// Schema:
//   {
//     pills: ["SEO", "Website Management", ...]         // optional override
//     currentWork: [
//       {
//         id:         string   (uuid),
//         mediaId:    string   (blob key in client-media store),
//         mediaType:  "image" | "video",
//         note:       string,
//         linkUrl:    string,
//         linkLabel:  string
//       }
//     ]
//   }
//
// URL shape:
//   GET  /.netlify/functions/client-content?client=NNNNNN
//   POST /.netlify/functions/client-content?client=NNNNNN   body: JSON content

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
  return { pills: null, currentWork: [] };
}

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
    const data = (await s.get(client, { type: "json" })) || emptyContent();
    return Response.json(data, { headers: corsHeaders });
  }

  if (req.method === "POST") {
    try {
      const body = await req.json();
      const out = emptyContent();
      if (Array.isArray(body.pills)) {
        out.pills = body.pills
          .map((p) => (typeof p === "string" ? p.trim() : ""))
          .filter(Boolean);
        if (out.pills.length === 0) out.pills = null;
      }
      if (Array.isArray(body.currentWork)) {
        out.currentWork = body.currentWork
          .filter((r) => r && typeof r === "object")
          .map((r, i) => ({
            id: String(r.id || `row-${Date.now()}-${i}`),
            mediaId: r.mediaId ? String(r.mediaId) : "",
            mediaType: r.mediaType === "video" ? "video" : "image",
            note: String(r.note || ""),
            linkUrl: String(r.linkUrl || ""),
            linkLabel: String(r.linkLabel || ""),
          }));
      }
      await s.setJSON(client, out);
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
