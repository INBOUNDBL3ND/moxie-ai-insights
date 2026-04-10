// Tracks which client health warnings have been dismissed.
// Persisted in Netlify Blobs so state survives cold starts and is shared
// across all function instances.

const { getStore } = require("@netlify/blobs");

const STORE_NAME = "admin-state";
const KEY = "dismissed-health";

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
    const dismissed = await loadState(store);
    return { statusCode: 200, headers, body: JSON.stringify(dismissed) };
  }

  if (event.httpMethod === "POST") {
    try {
      const body = JSON.parse(event.body);
      const num = body.client;
      const dismissed = await loadState(store);

      if (body.clear) {
        dismissed[num] = true;
      } else {
        delete dismissed[num];
      }

      await saveState(store, dismissed);

      return { statusCode: 200, headers, body: JSON.stringify(dismissed) };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
};
