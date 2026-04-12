// Returns the lightweight meta-index for admin card icons.
// Reads the "meta-index" key from the admin-state blob store.

import { getStore } from "@netlify/blobs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-cache, no-store, must-revalidate",
};

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("", { status: 200, headers: corsHeaders });
  }
  if (req.method === "GET") {
    const store = getStore({ name: "admin-state", consistency: "strong" });
    const idx = (await store.get("meta-index", { type: "json" })) || {};
    return Response.json(idx, { headers: corsHeaders });
  }
  return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
};
