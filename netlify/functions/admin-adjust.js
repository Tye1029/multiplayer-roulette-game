const { initBlobs, recordAdminAdjustment } = require("./_data");

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
  if (!adminPassword) {
    return json(headers, 500, {
      ok: false,
      error: "Missing admin password environment variable. Add ADMIN_PASSWORD with Functions or All scope, then redeploy."
    });
  }

  const supplied = getPassword(event);
  if (!supplied || supplied !== adminPassword) {
    return json(headers, 401, { ok: false, error: "Wrong admin password." });
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return json(headers, 400, { ok: false, error: "Invalid JSON body." }); }

  const userId = String(body.userId || "").replace(/[^0-9a-zA-Z_-]/g, "");
  const action = String(body.action || "increase").toLowerCase() === "decrease" ? "decrease" : "increase";
  const amount = Math.floor(Number(body.amount || 0));
  const reason = String(body.reason || "Admin balance adjustment").trim().slice(0, 240);

  if (!userId) return json(headers, 400, { ok: false, error: "Select a user first." });
  if (!Number.isFinite(amount) || amount <= 0) return json(headers, 400, { ok: false, error: "Enter an amount of at least 1 Ticket." });

  try {
    const { record, adjustment } = await recordAdminAdjustment(userId, { action, amount, reason, adminLabel: "admin" });
    console.log(`[admin-adjust] ${action} amount=${amount} user=${record.name} [${record.userId}] balance=${adjustment.balanceBefore}->${adjustment.balanceAfter} reason=${reason}`);

    return json(headers, 200, {
      ok: true,
      user: {
        userId: record.userId,
        name: record.name,
        currentBalance: record.currentBalance,
        totalAdminAdded: record.totalAdminAdded,
        totalAdminRemoved: record.totalAdminRemoved,
        adminAdjustmentCount: record.adminAdjustmentCount
      },
      adjustment
    });
  } catch (error) {
    console.error("[admin-adjust] Error:", error.message || error);
    return json(headers, 500, { ok: false, error: error.message || "Unable to adjust balance." });
  }
};

function getPassword(event) {
  const headers = event.headers || {};
  return headers["x-admin-password"] || headers["X-Admin-Password"] || "";
}

function json(headers, statusCode, payload) {
  return { statusCode, headers, body: JSON.stringify(payload) };
}
