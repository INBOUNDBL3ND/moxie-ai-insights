// Tracks which clients have been invited to their dashboard
// Uses in-memory state that persists across warm invocations

let invited = {};

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
    return { statusCode: 200, headers, body: JSON.stringify(invited) };
  }

  if (event.httpMethod === "POST") {
    try {
      const body = JSON.parse(event.body);
      const num = body.client;

      if (body.invited) {
        invited[num] = true;
      } else {
        delete invited[num];
      }

      return { statusCode: 200, headers, body: JSON.stringify(invited) };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
};
