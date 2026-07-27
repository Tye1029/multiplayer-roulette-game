const { initBlobs, getOddsSettings, setDefaultOddsProfile, setUserOddsProfile, clearUserOddsProfile, setGameOddsSettings, publicOddsSettings, sanitizeOddsProfile } = require("./_data");

exports.handler = async (event) => {
  initBlobs(event);

  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Password",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };

  const adminPassword = process.env.ADMIN_PASSWORD || process.env.ADMIN_PASS || process.env.ADMIN_KEY;
  if (!adminPassword) return json(headers, 500, { ok: false, error: "Missing ADMIN_PASSWORD environment variable." });
  const supplied = getPassword(event);
  if (!supplied || supplied !== adminPassword) return json(headers, 401, { ok: false, error: "Wrong admin password." });

  try {
    if (event.httpMethod === "GET") {
      const settings = await getOddsSettings();
      return json(headers, 200, { ok: true, settings: publicOddsSettings(settings) });
    }

    if (event.httpMethod !== "POST") return json(headers, 405, { ok: false, error: "Use GET or POST." });

    let body;
    try { body = JSON.parse(event.body || "{}"); }
    catch { return json(headers, 400, { ok: false, error: "Invalid JSON body." }); }

    const action = String(body.action || "").toLowerCase();
    let settings;
    if (action === "set-global") {
      settings = await setDefaultOddsProfile(body.profile, "admin");
    } else if (action === "set-user") {
      settings = await setUserOddsProfile(body.userId, body.profile, "admin");
    } else if (action === "clear-user") {
      settings = await clearUserOddsProfile(body.userId, "admin");
    } else if (action === "set-game-odds") {
      settings = await setGameOddsSettings(body.gameOdds || {}, "admin");
    } else if (action === "validate") {
      return json(headers, 200, { ok: true, profile: sanitizeOddsProfile(body.profile) });
    } else {
      return json(headers, 400, { ok: false, error: "Unknown odds action." });
    }

    return json(headers, 200, { ok: true, settings: publicOddsSettings(settings) });
  } catch (error) {
    console.error("[admin-odds] Error:", error.message || error);
    return json(headers, 500, { ok: false, error: error.message || "Unable to update odds." });
  }
};

function getPassword(event) {
  const headers = event.headers || {};
  const headerValue = headers["x-admin-password"] || headers["X-Admin-Password"];
  if (headerValue) return String(headerValue);
  try { return new URLSearchParams(event.rawQuery || "").get("password") || ""; }
  catch { return ""; }
}

function json(headers, statusCode, payload) {
  return { statusCode, headers, body: JSON.stringify(payload) };
}
