// Client feedback on Current Work items (thumbs up/down + comments).
// Persisted in Netlify Blobs, store "client-feedback".
//
// Per-client key (client number) schema:
//   {
//     reactions: { [itemId]: { vote: "up"|"down", at, label } },  // current state
//     rating:    { stars: 1-5, at } | null,                        // current satisfaction
//     itemComments: { [itemId]: [ { text, at } ] },                // client's sent comments (persistent, shown back to them)
//     messages:  [ { id, from: "client"|"team", text, at } ],      // Message Meg thread (persistent)
//     events:    [ { id, kind: "vote"|"comment"|"message"|"rating",
//                    itemId, itemLabel, vote?, stars?, text?, at } ] // uncleared alerts
//   }
// Index key "_index": { [client]: unclearedEventCount } — lets the admin
// bell poll without listing every blob.
// Index key "_ratings": { [client]: { stars, at } } — persistent satisfaction
// per client for the admin tiles (survives alert clearing).
//
// GET  ?client=NNNNNN   → { reactions, rating, events } (public — dashboards)
// GET  ?admin=1         → { clients: { num: { count, events } }, ratings }
// POST ?client=NNNNNN   → { action:"vote", itemId, itemLabel, vote:"up"|"down"|null }
//                       → { action:"comment", itemId, itemLabel, text }
//                       → { action:"message", text }              // Message Meg (client)
//                       → { action:"rating", stars, text? }       // How are we doing?
// POST                  → { action:"reply", client, text }        // team reply to thread
//                       → { action:"clearMessages", client }      // wipe Message Meg thread
//                       → { action:"clear", client, eventId }
//                       → { action:"clearClient", client }
//                       → { action:"clearAll" }

import { getStore } from "@netlify/blobs";

const STORE_NAME = "client-feedback";
const INDEX_KEY = "_index";
const RATINGS_KEY = "_ratings";
const MAX_EVENTS = 200;
const MAX_MESSAGES = 300;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-cache, no-store, must-revalidate",
};

function store() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

function emptyFeedback() {
  return { reactions: {}, rating: null, itemComments: {}, messages: [], events: [] };
}

function newEventId() {
  return "ev-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
}

async function readClient(s, client) {
  const raw = (await s.get(client, { type: "json" })) || null;
  if (!raw || typeof raw !== "object") return emptyFeedback();
  if (!raw.reactions || typeof raw.reactions !== "object") raw.reactions = {};
  if (!raw.rating || typeof raw.rating !== "object" || !raw.rating.stars) raw.rating = null;
  if (!raw.itemComments || typeof raw.itemComments !== "object") raw.itemComments = {};
  if (!Array.isArray(raw.messages)) raw.messages = [];
  if (!Array.isArray(raw.events)) raw.events = [];
  return raw;
}

async function readIndex(s) {
  return (await s.get(INDEX_KEY, { type: "json" })) || {};
}

async function writeClient(s, client, data) {
  if (data.events.length > MAX_EVENTS) data.events = data.events.slice(-MAX_EVENTS);
  if (data.messages.length > MAX_MESSAGES) data.messages = data.messages.slice(-MAX_MESSAGES);
  await s.setJSON(client, data);
  try {
    const idx = await readIndex(s);
    if (data.events.length > 0) idx[client] = data.events.length;
    else delete idx[client];
    await s.setJSON(INDEX_KEY, idx);
  } catch (_) {}
}

function badRequest(msg) {
  return Response.json({ error: msg }, { status: 400, headers: corsHeaders });
}

// ── Slack notification (best-effort, never blocks the client) ──────
// Posts Message Meg messages and card comments to the client's own
// Slack channel (meta.slackChannel in the client-content blob), or
// SLACK_FALLBACK_CHANNEL when the client has none set.
// Requires env var SLACK_BOT_TOKEN (bot scope: chat:write; invite the
// bot to private channels).
async function notifySlack(client, kind, payload, origin) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return;

  let channel = "";
  try {
    const cc = getStore({ name: "client-content", consistency: "strong" });
    const data = (await cc.get(client, { type: "json" })) || {};
    channel = String((data.meta && data.meta.slackChannel) || "").trim();
  } catch (_) {}
  if (!channel) channel = String(process.env.SLACK_FALLBACK_CHANNEL || "").trim();
  if (!channel) return;

  // Accept a #name, bare name, channel ID, or a Slack channel URL
  const urlMatch = channel.match(/archives\/([A-Z0-9]+)/i);
  if (urlMatch) channel = urlMatch[1];
  else if (!/^[CGD][A-Z0-9]{6,}$/.test(channel)) channel = "#" + channel.replace(/^#/, "");

  let name = "Client " + client;
  try {
    const r = await fetch(origin + "/data/clients.json");
    if (r.ok) {
      const j = await r.json();
      if (j[client] && j[client].name) name = j[client].name;
    }
  } catch (_) {}

  const quoted = String(payload.text || "").split("\n").map((l) => "> " + l).join("\n");
  let text;
  if (kind === "comment") {
    text = `💬 *New portal comment* from *${name}* (#${client})\n${quoted}\n_On:_ ${payload.itemLabel || "a Current Work item"}`;
  } else {
    text = `✉️ *New Message Meg* from *${name}* (#${client})\n${quoted}`;
  }
  text += `\n<${origin}/admin/|Open Admin Dashboard →>`;

  try {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ channel, text, unfurl_links: false, unfurl_media: false }),
    });
    const out = await res.json();
    if (!out.ok) console.log("Slack notify failed for", client, ":", out.error);
  } catch (e) {
    console.log("Slack notify error for", client, ":", e.message);
  }
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("", { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const s = store();

  if (req.method === "GET") {
    if (url.searchParams.get("admin") === "1") {
      const idx = await readIndex(s);
      const clients = {};
      await Promise.all(
        Object.keys(idx).map(async (num) => {
          try {
            const data = await readClient(s, num);
            if (data.events.length > 0) {
              clients[num] = { count: data.events.length, events: data.events };
            }
          } catch (_) {}
        })
      );
      let ratings = {};
      try {
        ratings = (await s.get(RATINGS_KEY, { type: "json" })) || {};
      } catch (_) {}
      return Response.json({ clients, ratings }, { headers: corsHeaders });
    }

    const client = url.searchParams.get("client");
    if (!client || !/^\d+$/.test(client)) {
      return badRequest("Missing or invalid ?client=NNNNNN param");
    }
    const data = await readClient(s, client);
    return Response.json(data, { headers: corsHeaders });
  }

  if (req.method === "POST") {
    let body;
    try {
      body = await req.json();
    } catch (_) {
      return badRequest("Invalid JSON body");
    }
    const action = String(body.action || "");

    // ── Admin clears ────────────────────────────────────────────────
    if (action === "clearAll") {
      const idx = await readIndex(s);
      await Promise.all(
        Object.keys(idx).map(async (num) => {
          try {
            const d = await readClient(s, num);
            d.events = [];
            await s.setJSON(num, d);
          } catch (_) {}
        })
      );
      await s.setJSON(INDEX_KEY, {});
      return Response.json({ ok: true }, { headers: corsHeaders });
    }

    if (action === "clearMessages") {
      const client = String(body.client || "");
      if (!/^\d+$/.test(client)) return badRequest("Invalid client");
      const d = await readClient(s, client);
      d.messages = [];
      await writeClient(s, client, d);
      return Response.json({ ok: true }, { headers: corsHeaders });
    }

    if (action === "reply") {
      const client = String(body.client || "");
      if (!/^\d+$/.test(client)) return badRequest("Invalid client");
      const text = String(body.text || "").trim().slice(0, 2000);
      if (!text) return badRequest("Empty reply");
      const d = await readClient(s, client);
      const msg = { id: newEventId(), from: "team", text, at: new Date().toISOString() };
      d.messages.push(msg);
      await writeClient(s, client, d);
      return Response.json({ ok: true, message: msg }, { headers: corsHeaders });
    }

    if (action === "clear" || action === "clearClient") {
      const client = String(body.client || "");
      if (!/^\d+$/.test(client)) return badRequest("Invalid client");
      const d = await readClient(s, client);
      if (action === "clearClient") {
        d.events = [];
      } else {
        const evId = String(body.eventId || "");
        d.events = d.events.filter((e) => e.id !== evId);
      }
      await writeClient(s, client, d);
      return Response.json({ ok: true, count: d.events.length }, { headers: corsHeaders });
    }

    // ── Client-side vote / comment ─────────────────────────────────
    const client = url.searchParams.get("client");
    if (!client || !/^\d+$/.test(client)) {
      return badRequest("Missing or invalid ?client=NNNNNN param");
    }
    const itemId = String(body.itemId || "").slice(0, 120);
    const itemLabel = String(body.itemLabel || "").slice(0, 300);

    const d = await readClient(s, client);
    const now = new Date().toISOString();

    if (action === "message") {
      const text = String(body.text || "").trim().slice(0, 2000);
      if (!text) return badRequest("Empty message");
      const msg = { id: newEventId(), from: "client", text, at: now };
      d.messages.push(msg);
      d.events.push({ id: newEventId(), kind: "message", itemId: "", itemLabel: "Message for Meg", text, at: now });
      await writeClient(s, client, d);
      await notifySlack(client, "message", { text }, url.origin);
      return Response.json({ ok: true, message: msg }, { headers: corsHeaders });
    }

    if (action === "rating") {
      const stars = parseInt(body.stars, 10);
      if (!(stars >= 1 && stars <= 5)) return badRequest("Invalid stars");
      const text = String(body.text || "").trim().slice(0, 2000);
      d.rating = { stars, at: now };
      // A new rating replaces any previous uncleared rating alert
      d.events = d.events.filter((e) => e.kind !== "rating");
      d.events.push({ id: newEventId(), kind: "rating", itemId: "", itemLabel: "Satisfaction rating", stars, text, at: now });
      await writeClient(s, client, d);
      try {
        const ratings = (await s.get(RATINGS_KEY, { type: "json" })) || {};
        ratings[client] = { stars, at: now };
        await s.setJSON(RATINGS_KEY, ratings);
      } catch (_) {}
      return Response.json({ ok: true }, { headers: corsHeaders });
    }

    if (!itemId) return badRequest("Missing itemId");

    if (action === "vote") {
      const vote = body.vote === "up" || body.vote === "down" ? body.vote : null;
      // A re-vote replaces the previous uncleared vote alert for the same item
      d.events = d.events.filter((e) => !(e.kind === "vote" && e.itemId === itemId));
      if (vote) {
        d.reactions[itemId] = { vote, at: now, label: itemLabel };
        d.events.push({ id: newEventId(), kind: "vote", itemId, itemLabel, vote, at: now });
      } else {
        delete d.reactions[itemId];
      }
      await writeClient(s, client, d);
      return Response.json({ ok: true, reactions: d.reactions }, { headers: corsHeaders });
    }

    if (action === "comment") {
      const text = String(body.text || "").trim().slice(0, 2000);
      if (!text) return badRequest("Empty comment");
      d.events.push({ id: newEventId(), kind: "comment", itemId, itemLabel, text, at: now });
      // Persistent copy shown back to the client under the card
      if (!Array.isArray(d.itemComments[itemId])) d.itemComments[itemId] = [];
      d.itemComments[itemId].push({ text, at: now });
      if (d.itemComments[itemId].length > 50) d.itemComments[itemId] = d.itemComments[itemId].slice(-50);
      await writeClient(s, client, d);
      await notifySlack(client, "comment", { text, itemLabel }, url.origin);
      return Response.json({ ok: true }, { headers: corsHeaders });
    }

    return badRequest("Unknown action");
  }

  return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
};
