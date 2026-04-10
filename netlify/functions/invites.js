// Tracks which clients have been invited to their dashboard.
// Persisted in Netlify Blobs so state survives cold starts and is shared
// across all function instances.

const { getStore } = require("@netlify/blobs");

const STORE_NAME = "admin-state";
const KEY = "invites";

async function loadState(store) {
  const data = await store.get(KEY, { type: "json" });
  return data || {};
}

async function saveState(store, state) {
  await store.setJSON(KEY, state);
}

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const store = getStore(STORE_NAME);

  if (event.httpMethod === "GET") {
    const invited = await loadState(store);
    return { statusCode: 200, headers, body: JSON.stringify(invited) };
  }

  if (event.httpMethod === "POST") {
    try {
      const body = JSON.parse(event.body);
      const num = body.client;
      const invited = await loadState(store);

      if (body.invited) {
        invited[num] = true;
      } else {
        delete invited[num];
      }

      await saveState(store, invited);

      return { statusCode: 200, headers, body: JSON.stringify(invited) };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
};
