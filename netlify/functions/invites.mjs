// Tracks which clients have been invited to their dashboard.
// Persisted in Netlify Blobs so state survives cold starts and is
// shared across all function instances.
//
// Uses Netlify Functions v2 format so the Blobs context is
// auto-injected even for direct CLI deploys.

import { getStore } from "@netlify/blobs";

const STORE_NAME = "admin-state";
const KEY = "invites";

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
    const invited = (await s.get(KEY, { type: "json" })) || {};
    return Response.json(invited, { headers: corsHeaders });
  }

  if (req.method === "POST") {
    try {
      const body = await req.json();
      const num = body.client;
      const invited = (await s.get(KEY, { type: "json" })) || {};

      if (body.invited) {
        invited[num] = true;
      } else {
        delete invited[num];
      }

      await s.setJSON(KEY, invited);

      return Response.json(invited, { headers: corsHeaders });
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
