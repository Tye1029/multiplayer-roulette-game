const { initBlobs, getUserRecord, saveUserRecord, recoverPreviousWithdrawal, getRecordBalance, resolveSiteUser } = require("./_data");

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

  try {
    const visitorProfile = await tornFetch(`/user/?selections=profile&key=${encodeURIComponent(visitorKey)}&comment=xans-balance`);
    const visitor = extractUser(visitorProfile);

    if (!visitor.id) {
      return json(headers, 400, { ok: false, error: "Could not verify the Torn user ID from that API key." });
    }

    const siteUser = await resolveSiteUser(visitor, body.visitorId);
    let record = await getUserRecord(siteUser.id);
    if (record && body.lastWithdrawal) {
      const recovery = recoverPreviousWithdrawal(record, { lastWithdrawal: body.lastWithdrawal });
      if (recovery.recovered) {
        record = await saveUserRecord(recovery.record);
      }
    }
    const serverBalance = getRecordBalance(record);
    const lastWithdrawalState = withdrawalLedgerState(record, body.lastWithdrawal);
    const lastWithdrawalConfirmed = lastWithdrawalState.confirmed;
    // Do not automatically restore stale active tickets on normal balance sync.
    // Old builds could leave activeTickets behind after reveal, which blocked new buys.
    // A caller may explicitly request recovery, but ordinary Save Key / Check Balance
    // should only return the current financial balance.
    const allowActiveTicket = body.allowActiveTicket === true || body.recoverActive === true;
    const completedIds = new Set(Array.isArray(record?.completedTicketIds) ? record.completedTicketIds.map(String) : []);
    const activeTickets = allowActiveTicket && record && record.activeTickets && typeof record.activeTickets === "object" ? Object.values(record.activeTickets) : [];
    const activeTicket = activeTickets
      .filter((ticket) => ticket && ticket.status === "active" && Array.isArray(ticket.prizes) && !completedIds.has(String(ticket.ticketId || "")))
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))[0] || null;

    return json(headers, 200, {
      ok: true,
      user: visitor,
      serverBalance,
      activeTicket,
      lastWithdrawalConfirmed,
      lastWithdrawalHasNewerEntries: lastWithdrawalState.hasNewerEntries,
      siteUserId: record?.userId || siteUser.id,
      record: record ? {
        userId: record.userId,
        name: record.name,
        currentBalance: serverBalance,
        totalXansDetected: record.totalXansDetected || 0,
        totalTicketsDeposited: record.totalTicketsDeposited || 0,
        ticketsPerXan: record.ticketsPerXan || 1000,
        balanceUnit: record.balanceUnit || "tickets",
        totalWagered: record.totalWagered || 0,
        totalWon: record.totalWon || 0,
        totalWithdrawRequested: record.totalWithdrawRequested || 0,
        withdrawalCount: record.withdrawalCount || 0,
        totalAdminAdded: record.totalAdminAdded || 0,
        totalAdminRemoved: record.totalAdminRemoved || 0
      } : null
    });
  } catch (error) {
    console.error("[get-balance] Error:", error.message || error);
    return json(headers, 500, { ok: false, error: error.message || "Unable to get server balance." });
  }
};


function withdrawalLedgerState(record, lastWithdrawal) {
  const withdrawalId = String(lastWithdrawal?.withdrawalId || "").replace(/[^0-9A-Za-z_-]/g, "").slice(0, 100);
  if (!record || !withdrawalId) return { confirmed: false, hasNewerEntries: false };

  const ledgerId = `withdraw:${withdrawalId}`;
  const ledger = Array.isArray(record.financialLedger) ? record.financialLedger : [];
  const index = ledger.findIndex((entry) => String(entry?.id || "") === ledgerId);
  const recentConfirmed = hasWithdrawal(record, withdrawalId);
  return {
    confirmed: index >= 0 || recentConfirmed,
    hasNewerEntries: index >= 0 && ledger.slice(index + 1).some((entry) => String(entry?.id || "") !== ledgerId)
  };
}

function hasWithdrawal(record, withdrawalId) {
  const id = String(withdrawalId || "");
  if (!id || !record) return false;
  const ledgerId = `withdraw:${id}`;
  const ledgerHit = Array.isArray(record.financialLedger) && record.financialLedger.some((entry) => String(entry?.id || "") === ledgerId);
  const withdrawalHit = Array.isArray(record.recentWithdrawals) && record.recentWithdrawals.some((w) => String(w?.withdrawalId || "") === id);
  return ledgerHit || withdrawalHit;
}

function json(headers, statusCode, payload) {
  return { statusCode, headers, body: JSON.stringify(payload) };
}

async function tornFetch(path) {
  const response = await fetch(`${TORN_API_BASE}${path}`, {
    headers: { "User-Agent": "CowBoyCookie-Xan-Scratch/1.6" }
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
