// Simple KV store using Netlify's environment
// Uses a global variable that persists across warm invocations
// and falls back gracefully on cold starts

let dismissed = {};

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

  if (event.httpMethod === "GET") {
    return { statusCode: 200, headers, body: JSON.stringify(dismissed) };
  }

  if (event.httpMethod === "POST") {
    try {
      const body = JSON.parse(event.body);
      const num = body.client;

      if (body.clear) {
        dismissed[num] = true;
      } else {
        delete dismissed[num];
      }

      return { statusCode: 200, headers, body: JSON.stringify(dismissed) };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
};
