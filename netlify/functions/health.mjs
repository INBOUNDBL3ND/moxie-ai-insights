// Tracks which client health warnings have been dismissed.
// Persisted in Netlify Blobs so state survives cold starts and is
// shared across all function instances.
//
// Uses Netlify Functions v2 format so the Blobs context is
// auto-injected even for direct CLI deploys.

import { getStore } from "@netlify/blobs";

const STORE_NAME = "admin-state";
const KEY = "dismissed-health";

function store() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("", { status: 200, headers: corsHeaders });
  }

  const s = store();

  if (req.method === "GET") {
    const dismissed = (await s.get(KEY, { type: "json" })) || {};
    return Response.json(dismissed, { headers: corsHeaders });
  }

  if (req.method === "POST") {
    try {
      const body = await req.json();
      const num = body.client;
      const dismissed = (await s.get(KEY, { type: "json" })) || {};

      if (body.clear) {
        dismissed[num] = true;
      } else {
        delete dismissed[num];
      }

      await s.setJSON(KEY, dismissed);

      return Response.json(dismissed, { headers: corsHeaders });
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
