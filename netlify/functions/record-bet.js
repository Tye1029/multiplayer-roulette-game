const { initBlobs, recordBet } = require("./_data");

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
  try { body = JSON.parse(event.body || "{}"); }
  catch { return json(headers, 400, { ok: false, error: "Invalid JSON body." }); }

  const visitorKey = String(body.visitorKey || "").trim();
  if (!/^[A-Za-z0-9]{8,64}$/.test(visitorKey)) {
    return json(headers, 400, { ok: false, error: "Invalid Torn API key format." });
  }

  const ticketCost = Math.max(0, Math.floor(Number(body.ticketCost || 0)));
  const winAmount = Math.max(0, Math.floor(Number(body.winAmount || 0)));
  const ticketId = String(body.ticketId || "").slice(0, 80);
  const prizes = Array.isArray(body.prizes) ? body.prizes : [];

  if (!ticketCost) {
    return json(headers, 400, { ok: false, error: "Missing ticket cost." });
  }

  try {
    const visitorProfile = await tornFetch(`/user/?selections=profile&key=${encodeURIComponent(visitorKey)}&comment=xans-bet`);
    const visitor = extractUser(visitorProfile);

    if (!visitor.id) {
      return json(headers, 400, { ok: false, error: "Could not verify the Torn user ID from that API key." });
    }

    const { record, bet } = await recordBet(visitor, { ticketCost, winAmount, ticketId, prizes });

    console.log(`[record-bet] ${visitor.name} [${visitor.id}] cost=${ticketCost} won=${winAmount} net=${bet.net} balance=${record.currentBalance}`);

    return json(headers, 200, {
      ok: true,
      user: visitor,
      bet,
      serverBalance: record.currentBalance,
      record: {
        userId: record.userId,
        name: record.name,
        currentBalance: record.currentBalance,
        betCount: record.betCount,
        totalWagered: record.totalWagered,
        totalWon: record.totalWon,
        netProfit: record.netProfit,
        totalXansDetected: record.totalXansDetected,
        totalTicketsDeposited: record.totalTicketsDeposited || 0,
        ticketsPerXan: record.ticketsPerXan || 1000,
        balanceUnit: record.balanceUnit || "tickets"
      }
    });
  } catch (error) {
    console.error("[record-bet] Error:", error.message || error);
    return json(headers, 500, { ok: false, error: error.message || "Unable to record bet." });
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
