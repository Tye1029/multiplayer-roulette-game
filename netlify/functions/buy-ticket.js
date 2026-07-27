const { initBlobs, issueTicket, resolveSiteUser } = require("./_data");

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
  const ticketId = String(body.ticketId || "").slice(0, 100);
  const clientExpectedBalance = Math.max(0, Math.floor(Number(body.clientBalance ?? body.expectedBalance ?? 0)));

  try {
    const visitorProfile = await tornFetch(`/user/?selections=profile&key=${encodeURIComponent(visitorKey)}&comment=xans-buy-ticket`);
    const visitor = extractUser(visitorProfile);

    if (!visitor.id) {
      return json(headers, 400, { ok: false, error: "Could not verify the Torn user ID from that API key." });
    }

    const siteUser = await resolveSiteUser(visitor, body.visitorId);
    const { record, ticket, duplicate, recovered, recoveredPrevious, activeExists, completed } = await issueTicket(siteUser, {
      ticketCost,
      ticketId,
      clientExpectedBalance,
      lastCompletedTicketId: body.lastCompletedTicketId,
      lastCompletedTicketToken: body.lastCompletedTicketToken,
      lastCompletedServerBalance: body.lastCompletedServerBalance,
      lastWithdrawal: body.lastWithdrawal,
      doubleOrNothing: body.doubleOrNothing
    });

    console.log(`[buy-ticket] ${visitor.name} [${visitor.id}] cost=${ticket.ticketCost} ticket=${ticket.ticketId} balance=${record.currentBalance}${duplicate ? " duplicate" : ""}${activeExists ? " active-exists" : ""}${recovered ? " recovered-active" : ""}`);

    return json(headers, 200, {
      ok: true,
      user: visitor,
      ticket,
      duplicate: !!duplicate,
      activeExists: !!activeExists,
      completed: !!completed,
      recovered: !!recovered,
      recoveredPrevious: !!recoveredPrevious,
      serverBalance: record.currentBalance,
      siteUserId: record.userId,
      firstTicketBonus: ticket.oddsSource === "first_bonus"
    });
  } catch (error) {
    console.error("[buy-ticket] Error:", error.message || error);
    return json(headers, 500, { ok: false, error: error.message || "Unable to buy ticket." });
  }
};

function json(headers, statusCode, payload) {
  return { statusCode, headers, body: JSON.stringify(payload) };
}

async function tornFetch(path) {
  const response = await fetch(`${TORN_API_BASE}${path}`, {
    headers: { "User-Agent": "CowBoyCookie-Xan-Scratch/2.0" }
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
