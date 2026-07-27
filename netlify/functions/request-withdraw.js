const { initBlobs, recordWithdrawal, resolveSiteUser } = require("./_data");

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

  const amount = Math.floor(Number(body.amount || 0));
  if (!Number.isFinite(amount) || amount <= 0) {
    return json(headers, 400, { ok: false, error: "Enter a withdrawal amount of at least 1,000 Tickets." });
  }
  if (amount % 1000 !== 0) {
    return json(headers, 400, { ok: false, error: "Withdrawals must be in 1,000 Ticket increments." });
  }

  try {
    const visitorProfile = await tornFetch(`/user/?selections=profile&key=${encodeURIComponent(visitorKey)}&comment=xans-withdraw`);
    const visitor = extractUser(visitorProfile);

    if (!visitor.id) {
      return json(headers, 400, { ok: false, error: "Could not verify the Torn user ID from that API key." });
    }

    const siteUser = await resolveSiteUser(visitor, body.visitorId);
    const withdrawalId = String(body.withdrawalId || "").trim();
    const { record, withdrawal } = await recordWithdrawal(siteUser, { amount, withdrawalId, lastWithdrawal: body.lastWithdrawal, note: "User requested withdrawal from site balance" });

    console.log(`[request-withdraw] ${visitor.name} [${visitor.id}] requestedTickets=${amount} balance=${withdrawal.balanceBefore}->${withdrawal.balanceAfter}`);

    return json(headers, 200, {
      ok: true,
      user: visitor,
      withdrawal,
      serverBalance: record.currentBalance,
      siteUserId: record.userId,
      message: `Withdrawal request submitted for ${amount.toLocaleString()} Tickets. You will receive the matching Xanax within 24 hours.`
    });
  } catch (error) {
    console.error("[request-withdraw] Error:", error.message || error);
    const msg = error.message || "Unable to submit withdrawal request.";
    const status = /balance|withdrawal amount|save\/check|not found|invalid/i.test(msg) ? 400 : 500;
    return json(headers, status, { ok: false, error: msg });
  }
};

function json(headers, statusCode, payload) {
  return { statusCode, headers, body: JSON.stringify(payload) };
}

async function tornFetch(path) {
  const response = await fetch(`${TORN_API_BASE}${path}`, {
    headers: { "User-Agent": "CowBoyCookie-Xan-Scratch/1.5" }
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
