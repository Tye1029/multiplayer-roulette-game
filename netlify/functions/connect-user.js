const { initBlobs, recordConnect, getRecordBalance, resolveSiteUser } = require("./_data");

const TORN_API_BASE = "https://api.torn.com";

exports.handler = async (event) => {
  initBlobs(event);

  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };
  if (event.httpMethod !== "POST") return json(headers, 405, { ok: false, error: "Use POST." });

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(headers, 400, { ok: false, error: "Invalid JSON body." });
  }

  const visitorKey = String(body.visitorKey || "").trim();
  if (!/^[A-Za-z0-9]{8,64}$/.test(visitorKey)) {
    return json(headers, 400, { ok: false, error: "Invalid Torn API key format." });
  }

  try {
    const visitorProfile = await tornFetch(`/user/?selections=profile&key=${encodeURIComponent(visitorKey)}&comment=xans-connect`);
    const visitor = extractUser(visitorProfile);

    if (!visitor.id) {
      return json(headers, 400, { ok: false, error: "Could not verify the Torn user ID from that API key." });
    }

    console.log(`[connect-user] Verified saved key for ${visitor.name} [${visitor.id}]`);

    const siteUser = await resolveSiteUser(visitor, body.visitorId);
    const record = await recordConnect(siteUser, "save-key", { lastWithdrawal: body.lastWithdrawal });

    const serverBalance = getRecordBalance(record);

    return json(headers, 200, {
      ok: true,
      user: visitor,
      serverBalance,
      record: publicRecord(record, serverBalance),
      siteUserId: record.userId
    });
  } catch (error) {
    console.error("[connect-user] Error:", error.message || error);
    return json(headers, 500, { ok: false, error: error.message || "Torn API key verification failed." });
  }
};

function json(headers, statusCode, payload) {
  return { statusCode, headers, body: JSON.stringify(payload) };
}

async function tornFetch(path) {
  const response = await fetch(`${TORN_API_BASE}${path}`, {
    headers: { "User-Agent": "CowBoyCookie-Xan-Scratch/1.4" }
  });

  const text = await response.text();
  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error(`Torn returned a non-JSON response (${response.status}).`); }

  if (!response.ok) throw new Error(`Torn API HTTP ${response.status}.`);
  if (data.error) {
    const code = data.error.code ? ` ${data.error.code}` : "";
    throw new Error(`Torn API error${code}: ${data.error.error || "Unknown error"}`);
  }
  return data;
}

function extractUser(profile) {
  const id = profile.player_id || profile.user_id || profile.id || profile.profile?.player_id || profile.profile?.user_id || profile.profile?.id || profile.user?.id || profile.user?.player_id || null;
  const name = profile.name || profile.player_name || profile.profile?.name || profile.user?.name || "Unknown";
  return { id: id ? Number(id) : null, name };
}

function publicRecord(record, serverBalance = null) {
  const balance = Number.isFinite(Number(serverBalance)) ? Number(serverBalance) : getRecordBalance(record);
  return {
    userId: record.userId,
    name: record.name,
    firstConnectedAt: record.firstConnectedAt,
    lastConnectedAt: record.lastConnectedAt,
    lastCheckedAt: record.lastCheckedAt,
    lastBetAt: record.lastBetAt,
    connectCount: record.connectCount,
    checkCount: record.checkCount,
    betCount: record.betCount,
    totalXansDetected: record.totalXansDetected,
    totalTicketsDeposited: record.totalTicketsDeposited || 0,
    ticketsPerXan: record.ticketsPerXan || 1000,
    balanceUnit: record.balanceUnit || "tickets",
    currentBalance: balance,
    serverBalance: balance,
    totalWagered: record.totalWagered,
    totalWon: record.totalWon,
    netProfit: record.netProfit
  };
}
