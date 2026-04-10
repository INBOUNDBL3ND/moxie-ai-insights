// Upload + serve binary media (images/videos) used in the
// client-dashboard "Current Work" section. Stored in its own
// Netlify Blobs store so the JSON content blob stays small.
//
// GET  /.netlify/functions/client-media?id=MEDIAID
//   Returns the raw binary with the stored Content-Type header.
//
// POST /.netlify/functions/client-media
//   multipart/form-data with a "file" field + optional "client" field.
//   Returns { id, mediaType } where id is the blob key to store in
//   client-content's currentWork row.
//
// No auth on POST — matches the same security model as invites.mjs
// (access is gated by the admin password which protects the admin
// page). Content is size-limited at 10 MB per upload.

import { getStore } from "@netlify/blobs";

const STORE_NAME = "client-media";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function store() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

function randomId() {
  // No crypto.randomUUID in older runtimes; build a 128-bit hex string.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function guessMediaType(contentType) {
  if (!contentType) return "image";
  if (contentType.startsWith("video/")) return "video";
  return "image";
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("", { status: 200, headers: corsHeaders });
  }

  const s = store();
  const url = new URL(req.url);

  if (req.method === "GET") {
    const id = url.searchParams.get("id");
    if (!id || !/^[a-f0-9]+$/i.test(id)) {
      return Response.json(
        { error: "Missing or invalid ?id=" },
        { status: 400, headers: corsHeaders }
      );
    }
    const result = await s.getWithMetadata(id, { type: "arrayBuffer" });
    if (!result || !result.data) {
      return Response.json(
        { error: "Not found" },
        { status: 404, headers: corsHeaders }
      );
    }
    const { data, metadata } = result;
    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": (metadata && metadata.contentType) || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  if (req.method === "POST") {
    try {
      const form = await req.formData();
      const file = form.get("file");
      if (!file || typeof file === "string") {
        return Response.json(
          { error: "Missing 'file' field (multipart/form-data)" },
          { status: 400, headers: corsHeaders }
        );
      }
      if (file.size > MAX_BYTES) {
        return Response.json(
          { error: `File too large (max ${MAX_BYTES} bytes, got ${file.size})` },
          { status: 413, headers: corsHeaders }
        );
      }
      const contentType = file.type || "application/octet-stream";
      const id = randomId();
      const buf = await file.arrayBuffer();
      await s.set(id, buf, { metadata: { contentType, size: file.size } });
      return Response.json(
        { id, mediaType: guessMediaType(contentType), contentType, size: file.size },
        { headers: corsHeaders }
      );
    } catch (err) {
      return Response.json(
        { error: err.message, stack: err.stack },
        { status: 500, headers: corsHeaders }
      );
    }
  }

  if (req.method === "DELETE") {
    const id = url.searchParams.get("id");
    if (!id || !/^[a-f0-9]+$/i.test(id)) {
      return Response.json(
        { error: "Missing or invalid ?id=" },
        { status: 400, headers: corsHeaders }
      );
    }
    await s.delete(id);
    return Response.json({ ok: true }, { headers: corsHeaders });
  }

  return Response.json(
    { error: "Method not allowed" },
    { status: 405, headers: corsHeaders }
  );
};
