const { initBlobs, listUserRecords } = require("./_data");

// Bump this when redeploying after env variable changes so Netlify refreshes the function bundle.
const ADMIN_FUNCTION_VERSION = "2026-07-08-admin-adjust-1";

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
  if (!adminPassword) {
    console.error(`[admin-users] Missing admin password env var. Function version: ${ADMIN_FUNCTION_VERSION}`);
    return json(headers, 500, {
      ok: false,
      error: "Missing admin password environment variable. Add ADMIN_PASSWORD with Functions or All scope, then trigger a new deploy. Also accepted: ADMIN_PASS or ADMIN_KEY."
    });
  }

  const supplied = getPassword(event);
  if (!supplied || supplied !== adminPassword) {
    return json(headers, 401, { ok: false, error: "Wrong admin password." });
  }

  try {
    const users = await listUserRecords();
    console.log(`[admin-users] Admin loaded ${users.length} connected users.`);
    return json(headers, 200, {
      ok: true,
      count: users.length,
      users: users.map(publicRecord)
    });
  } catch (error) {
    console.error("[admin-users] Error:", error.message || error);
    return json(headers, 500, { ok: false, error: error.message || "Unable to load admin users." });
  }
};

function getPassword(event) {
  const headers = event.headers || {};
  const headerValue = headers["x-admin-password"] || headers["X-Admin-Password"];
  if (headerValue) return String(headerValue);

  try {
    const params = new URLSearchParams(event.rawQuery || "");
    return params.get("password") || "";
  } catch {
    return "";
  }
}

function publicRecord(record) {
  return {
    userId: record.userId,
    name: record.name,
    linkedTornUsers: Array.isArray(record.linkedTornUsers) ? record.linkedTornUsers : [],
    firstConnectedAt: record.firstConnectedAt,
    lastConnectedAt: record.lastConnectedAt,
    lastCheckedAt: record.lastCheckedAt,
    lastBetAt: record.lastBetAt,
    lastAdminAdjustmentAt: record.lastAdminAdjustmentAt,
    lastWithdrawalAt: record.lastWithdrawalAt,
    firstTicketBonusUsedAt: record.firstTicketBonusUsedAt || null,
    firstTicketBonusTicketId: record.firstTicketBonusTicketId || null,
    connectCount: record.connectCount,
    checkCount: record.checkCount,
    betCount: record.betCount,
    adminAdjustmentCount: record.adminAdjustmentCount,
    withdrawalCount: record.withdrawalCount,
    totalXansDetected: record.totalXansDetected,
    totalTicketsDeposited: record.totalTicketsDeposited || 0,
    ticketsPerXan: record.ticketsPerXan || 1000,
    balanceUnit: record.balanceUnit || "tickets",
    currentBalance: record.currentBalance,
    totalWagered: record.totalWagered,
    totalWon: record.totalWon,
    totalAdminAdded: record.totalAdminAdded,
    totalAdminRemoved: record.totalAdminRemoved,
    totalWithdrawRequested: record.totalWithdrawRequested,
    netProfit: record.netProfit,
    claimedLogCount: Array.isArray(record.claimedLogIds) ? record.claimedLogIds.length : 0,
    ledgerStartedAt: record.ledgerStartedAt,
    balanceBaseline: record.balanceBaseline,
    ledgerCount: Array.isArray(record.financialLedger) ? record.financialLedger.length : 0,
    financialLedger: Array.isArray(record.financialLedger) ? record.financialLedger.slice(-150).reverse() : [],
    activeTickets: record.activeTickets && typeof record.activeTickets === 'object' ? Object.values(record.activeTickets) : [],
    issuedTicketCount: Array.isArray(record.issuedTicketIds) ? record.issuedTicketIds.length : 0,
    completedTicketCount: Array.isArray(record.completedTicketIds) ? record.completedTicketIds.length : 0,
    recentBets: Array.isArray(record.recentBets) ? record.recentBets.slice(-100).reverse() : [],
    recentAdjustments: Array.isArray(record.recentAdjustments) ? record.recentAdjustments.slice(-100).reverse() : [],
    recentWithdrawals: Array.isArray(record.recentWithdrawals) ? record.recentWithdrawals.slice(-100).reverse() : [],
    recentEvents: Array.isArray(record.recentEvents) ? record.recentEvents.slice(-60).reverse() : []
  };
}

function json(headers, statusCode, payload) {
  return { statusCode, headers, body: JSON.stringify(payload) };
}
