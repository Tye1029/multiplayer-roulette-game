const { initBlobs, multiplayerAdminCancelAllGames, duelAdminCancelAllGames, duelCleanupLegacyGames } = require("./_data");

exports.handler = async (event) => {
  initBlobs(event);

  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Password",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };
  if (event.httpMethod !== "POST") return json(headers, 405, { ok: false, error: "Use POST." });

  const adminPassword = process.env.ADMIN_PASSWORD || process.env.ADMIN_PASS || process.env.ADMIN_KEY;
  if (!adminPassword) return json(headers, 500, { ok: false, error: "Missing ADMIN_PASSWORD environment variable." });

  const supplied = getPassword(event);
  if (!supplied || supplied !== adminPassword) return json(headers, 401, { ok: false, error: "Wrong admin password." });

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return json(headers, 400, { ok: false, error: "Invalid JSON body." }); }

  try {
    const action = String(body.action || "").toLowerCase();
    if (action === "cleanup-legacy-duels") {
      const result = await duelCleanupLegacyGames();
      return json(headers, 200, { ok: true, action, ...result });
    }
    if (action !== "cancel-all") return json(headers, 400, { ok: false, error: "Unknown multiplayer admin action." });

    const [multiplayer, arcade] = await Promise.all([
      multiplayerAdminCancelAllGames({
        reason: "Admin reset cancelled all current multiplayer games.",
        deleteGames: true
      }),
      duelAdminCancelAllGames({
        reason: "Admin reset cancelled all current multiplayer arcade games.",
        deleteGames: true
      })
    ]);

    return json(headers, 200, {
      ok: true,
      multiplayer,
      arcade,
      cancelledCount: Number(multiplayer.cancelledCount || 0) + Number(arcade.cancelledCount || 0),
      deletedCount: Number(multiplayer.deletedCount || 0) + Number(arcade.deletedCount || 0),
      refundedTickets: Number(multiplayer.refundedTickets || 0) + Number(arcade.refundedTickets || 0),
      clearedPointerCount: Number(arcade.clearedPointerCount || 0)
    });
  } catch (error) {
    console.error("[admin-multiplayer] Error:", error.message || error);
    return json(headers, 500, { ok: false, error: error.message || "Unable to update multiplayer games." });
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
