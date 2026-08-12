const { getStore, connectLambda } = require("@netlify/blobs");
const drawDatabase = require("./_draw-database");
const fishingDatabase = require("./_fishing-database");
const crypto = require("crypto");
const { createMountainRaceIntegration } = require("./mountain-race/integration");

const STORE_NAME = "torn-xan-users";
const ODDS_SETTINGS_KEY = "settings/odds.json";
const DEFAULT_GAME_ODDS = {
  multiplayer: { houseCutPercent: 3.3 },
  runner: {
    baseWinChance: 72,
    minWinChance: 12,
    chanceDropPerStep: 5.5,
    chanceDropPerMultiplier: 2.4,
    startMultiplier: 1,
    baseMultiplierIncrease: 0.22,
    multiplierGrowth: 1.18,
    maxMultiplier: 35,
    block2ChancePenalty: 13,
    block3ChancePenalty: 28,
    // Bundle boosts are applied on top of the total value of the blocks skipped,
    // so 2 or 3 blocks at once pays more than taking the same blocks individually.
    block2MultiplierBoost: 1.18,
    block3MultiplierBoost: 1.42
  },
  horse: {
    houseEdgePercent: 12,
    minWager: 1000,
    maxWager: 50000
  }
};
const USER_PREFIX = "user/";
const VISITOR_LINK_PREFIX = "visitor-link/";
const TORN_LINK_PREFIX = "torn-link/";
const MP_GAME_PREFIX = "mp-game/";
const MAX_CLAIMED_LOG_IDS = 2500;
const MAX_EVENTS = 180;
const MAX_BETS = 250;
const MAX_ADJUSTMENTS = 180;
const MAX_WITHDRAWALS = 260;
const MAX_ACTIVE_TICKETS = 3;
const MAX_TICKET_IDS = 1800;
const MAX_LEDGER = 3000;
const TICKETS_PER_XAN = 1000;
const BALANCE_UNIT = "tickets";

const VALID_TICKET_COSTS = [1000, 5000, 10000, 25000];

const DEFAULT_ODDS_PROFILE = {
  name: "House Edge 85% RTP",
  description: "Balanced default: players win/refund sometimes, while the house keeps about a 15% statistical edge over many tickets.",
  tiers: [
    { key: "lose", label: "Lose", multiplier: 0, probability: 72.85 },
    { key: "refund", label: "Refund", multiplier: 1, probability: 10 },
    { key: "small_2x", label: "Small Win", multiplier: 2, probability: 9 },
    { key: "nice_3x", label: "Nice Win", multiplier: 3, probability: 4 },
    { key: "good_5x", label: "Good Win", multiplier: 5, probability: 2.5 },
    { key: "big_10x", label: "Big Win", multiplier: 10, probability: 1 },
    { key: "huge_25x", label: "Huge Win", multiplier: 25, probability: 0.5 },
    { key: "rare_50x", label: "Rare Win", multiplier: 50, probability: 0.1 },
    { key: "jackpot_100x", label: "Jackpot", multiplier: 100, probability: 0.05 }
  ]
};

const FIRST_TICKET_ODDS_PROFILE = {
  name: "First Game Bonus - Guaranteed Small Profit",
  description: "One-time new-user starter ticket: guaranteed 2x payout on the first ticket only, then normal site odds apply.",
  tiers: [
    { key: "first_game_2x", label: "First Game Small Win", multiplier: 2, probability: 100 }
  ]
};

const FIRST_DOUBLE_LOSS_ODDS_PROFILE = {
  name: "First Game Double or Nothing - Forced Miss",
  description: "If a brand-new user's guaranteed first-game win is risked on Double or Nothing, the Double or Nothing card always misses so the starter bonus cannot be multiplied.",
  tiers: [
    { key: "first_double_loss", label: "First Game Double Miss", multiplier: 0, probability: 100 }
  ]
};

const ODDS_PRESETS = {
  conservative_80: {
    name: "Conservative 80% RTP",
    description: "Stronger house edge, still has occasional wins.",
    tiers: [
      { key: "lose", label: "Lose", multiplier: 0, probability: 74.5 },
      { key: "refund", label: "Refund", multiplier: 1, probability: 10 },
      { key: "small_2x", label: "Small Win", multiplier: 2, probability: 8 },
      { key: "nice_3x", label: "Nice Win", multiplier: 3, probability: 4 },
      { key: "good_5x", label: "Good Win", multiplier: 5, probability: 2 },
      { key: "big_10x", label: "Big Win", multiplier: 10, probability: 1 },
      { key: "huge_25x", label: "Huge Win", multiplier: 25, probability: 0.35 },
      { key: "rare_50x", label: "Rare Win", multiplier: 50, probability: 0.1 },
      { key: "jackpot_100x", label: "Jackpot", multiplier: 100, probability: 0.05 }
    ]
  },
  balanced_85: DEFAULT_ODDS_PROFILE,
  generous_88: {
    name: "Generous 88% RTP",
    description: "More player-friendly, still a statistical house edge over many tickets.",
    tiers: [
      { key: "lose", label: "Lose", multiplier: 0, probability: 71.95 },
      { key: "refund", label: "Refund", multiplier: 1, probability: 10 },
      { key: "small_2x", label: "Small Win", multiplier: 2, probability: 9 },
      { key: "nice_3x", label: "Nice Win", multiplier: 3, probability: 4 },
      { key: "good_5x", label: "Good Win", multiplier: 5, probability: 3 },
      { key: "big_10x", label: "Big Win", multiplier: 10, probability: 1.2 },
      { key: "huge_25x", label: "Huge Win", multiplier: 25, probability: 0.65 },
      { key: "rare_50x", label: "Rare Win", multiplier: 50, probability: 0.15 },
      { key: "jackpot_100x", label: "Jackpot", multiplier: 100, probability: 0.05 }
    ]
  },
  frequent_small_wins_90: {
    name: "Frequent Small Wins 90% RTP",
    description: "Higher hit rate with more small/partial wins. The house still keeps about a 10% long-run edge.",
    tiers: [
      { key: "lose", label: "Lose", multiplier: 0, probability: 34.55 },
      { key: "tiny_25", label: "Tiny Win", multiplier: 0.25, probability: 10 },
      { key: "half_back", label: "Half Back", multiplier: 0.5, probability: 15 },
      { key: "refund", label: "Refund", multiplier: 1, probability: 19.25 },
      { key: "small_profit", label: "Small Profit", multiplier: 2, probability: 15 },
      { key: "nice_3x", label: "Nice Win", multiplier: 3, probability: 4 },
      { key: "good_5x", label: "Good Win", multiplier: 5, probability: 1.6 },
      { key: "big_10x", label: "Big Win", multiplier: 10, probability: 0.4 },
      { key: "huge_25x", label: "Huge Win", multiplier: 25, probability: 0.15 },
      { key: "rare_50x", label: "Rare Win", multiplier: 50, probability: 0.04 },
      { key: "jackpot_100x", label: "Jackpot", multiplier: 100, probability: 0.01 }
    ]
  },
  player_friendly_92: {
    name: "Player Friendly 92% RTP",
    description: "Better player odds with more frequent positive reveals and about an 8% long-run house edge.",
    tiers: [
      { key: "lose", label: "Lose", multiplier: 0, probability: 46.4 },
      { key: "half_back", label: "Half Back", multiplier: 0.5, probability: 15 },
      { key: "refund", label: "Refund", multiplier: 1, probability: 14.5 },
      { key: "small_1_5x", label: "Small Win", multiplier: 1.5, probability: 15 },
      { key: "profit_2_5x", label: "Profit Win", multiplier: 2.5, probability: 6.1 },
      { key: "good_5x", label: "Good Win", multiplier: 5, probability: 2 },
      { key: "big_10x", label: "Big Win", multiplier: 10, probability: 0.6 },
      { key: "huge_25x", label: "Huge Win", multiplier: 25, probability: 0.25 },
      { key: "rare_50x", label: "Rare Win", multiplier: 50, probability: 0.1 },
      { key: "jackpot_100x", label: "Jackpot", multiplier: 100, probability: 0.05 }
    ]
  },
  very_player_friendly_95: {
    name: "Very Player Friendly 95% RTP",
    description: "High player-return profile with more hits. This keeps only about a 5% long-run house edge.",
    tiers: [
      { key: "lose", label: "Lose", multiplier: 0, probability: 41 },
      { key: "half_back", label: "Half Back", multiplier: 0.5, probability: 12 },
      { key: "refund", label: "Refund", multiplier: 1, probability: 19 },
      { key: "small_1_5x", label: "Small Win", multiplier: 1.5, probability: 15 },
      { key: "small_2x", label: "Small Profit", multiplier: 2, probability: 8 },
      { key: "nice_3x", label: "Nice Win", multiplier: 3, probability: 3 },
      { key: "good_5x", label: "Good Win", multiplier: 5, probability: 1.2 },
      { key: "big_10x", label: "Big Win", multiplier: 10, probability: 0.5 },
      { key: "huge_25x", label: "Huge Win", multiplier: 25, probability: 0.2 },
      { key: "rare_50x", label: "Rare Win", multiplier: 50, probability: 0.07 },
      { key: "jackpot_100x", label: "Jackpot", multiplier: 100, probability: 0.03 }
    ]
  },
  extreme_high_win_97: {
    name: "Extreme High Win Chance 97% RTP",
    description: "Very high hit rate for promos or testing. The house edge is very small at about 3% long term.",
    tiers: [
      { key: "lose", label: "Lose", multiplier: 0, probability: 30.75 },
      { key: "tiny_25", label: "Tiny Win", multiplier: 0.25, probability: 5 },
      { key: "half_back", label: "Half Back", multiplier: 0.5, probability: 10 },
      { key: "refund", label: "Refund", multiplier: 1, probability: 24.25 },
      { key: "small_1_5x", label: "Small Win", multiplier: 1.5, probability: 18 },
      { key: "small_2x", label: "Small Profit", multiplier: 2, probability: 8 },
      { key: "nice_3x", label: "Nice Win", multiplier: 3, probability: 2.5 },
      { key: "good_5x", label: "Good Win", multiplier: 5, probability: 0.9 },
      { key: "big_10x", label: "Big Win", multiplier: 10, probability: 0.4 },
      { key: "huge_25x", label: "Huge Win", multiplier: 25, probability: 0.14 },
      { key: "rare_50x", label: "Rare Win", multiplier: 50, probability: 0.04 },
      { key: "jackpot_100x", label: "Jackpot", multiplier: 100, probability: 0.02 }
    ]
  }
};

function initBlobs(event) {
  if (event && typeof connectLambda === "function") connectLambda(event);
}

function nowIso() { return new Date().toISOString(); }
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function toNumber(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function int(value, fallback = 0) { return Math.max(0, Math.floor(toNumber(value, fallback))); }
function signedInt(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? Math.floor(n) : fallback; }
function ticketsFromXans(value) { return int(value, 0) * TICKETS_PER_XAN; }
function formatTickets(value) { const n = int(value, 0); return `${n.toLocaleString()} ${n === 1 ? "Ticket" : "Tickets"}`; }
function formatXanaxEquivalent(value) { const tickets = int(value, 0); const xans = Math.floor(tickets / TICKETS_PER_XAN); return `${xans.toLocaleString()} ${xans === 1 ? "Xanax" : "Xanax"}`; }
function isTicketUnitObject(obj = {}) { return obj && typeof obj === "object" && (obj.balanceUnit === BALANCE_UNIT || obj.unit === BALANCE_UNIT); }
function scaleMoneyValue(value) { return signedInt(value, 0) * TICKETS_PER_XAN; }
function scalePositiveMoneyValue(value) { return int(value, 0) * TICKETS_PER_XAN; }
function scaleMoneyFields(obj, fields = []) {
  if (!obj || typeof obj !== "object") return obj;
  const out = { ...obj };
  for (const field of fields) {
    if (out[field] !== undefined && out[field] !== null) out[field] = scalePositiveMoneyValue(out[field]);
  }
  return out;
}
function scaleSignedMoneyFields(obj, fields = []) {
  if (!obj || typeof obj !== "object") return obj;
  const out = { ...obj };
  for (const field of fields) {
    if (out[field] !== undefined && out[field] !== null) out[field] = scaleMoneyValue(out[field]);
  }
  return out;
}
function migrateDoubleInfoToTickets(info) {
  if (!info || typeof info !== "object") return info;
  return scaleMoneyFields(info, ["previousWinAmount", "currentWinAmount", "winAmount", "previousTicketCost", "ticketCost"]);
}
function migrateTicketLikeToTickets(ticket) {
  if (!ticket || typeof ticket !== "object") return ticket;
  const out = scaleMoneyFields(ticket, ["ticketCost", "winAmount", "baseWinAmount", "doubleBonus", "doubleLossAmount", "balanceBefore", "balanceAfterCost", "balanceAfter"]);
  if (Array.isArray(out.prizes)) out.prizes = out.prizes.map(scalePositiveMoneyValue);
  out.doubleOrNothing = migrateDoubleInfoToTickets(out.doubleOrNothing);
  return out;
}
function migrateBetToTickets(bet) {
  if (!bet || typeof bet !== "object") return bet;
  let out = migrateTicketLikeToTickets(bet);
  out = scaleSignedMoneyFields(out, ["net"]);
  return out;
}
function migrateLedgerEntryToTickets(entry) {
  if (!entry || typeof entry !== "object") return entry;
  let out = scaleMoneyFields(entry, ["amount"]);
  out = scaleSignedMoneyFields(out, ["delta"]);
  if (out.meta && typeof out.meta === "object") {
    out.meta = scaleMoneyFields(out.meta, ["pot", "houseCut", "payout", "wager"]);
  }
  return out;
}
function migrateAdjustmentToTickets(adj) {
  if (!adj || typeof adj !== "object") return adj;
  let out = scaleMoneyFields(adj, ["amount", "balanceBefore", "balanceAfter"]);
  out = scaleSignedMoneyFields(out, ["delta"]);
  return out;
}
function migrateWithdrawalToTickets(w) {
  return scaleMoneyFields(w, ["amount", "balanceBefore", "balanceAfter"]);
}
function migrateEventToTickets(event) {
  if (!event || typeof event !== "object") return event;
  let out = scaleMoneyFields(event, ["amount", "ticketCost", "winAmount", "baseWinAmount", "doubleBonus", "doubleLossAmount", "balanceBefore", "balanceAfter", "payout", "houseCut", "pot", "wager"]);
  out = scaleSignedMoneyFields(out, ["delta", "net"]);
  if (typeof out.message === "string") out.message = out.message.replace(/\bXans?\b/g, "Tickets");
  return out;
}
function migrateRecordToTickets(record) {
  if (!record || typeof record !== "object" || isTicketUnitObject(record)) return record || {};
  const out = {
    ...record,
    balanceUnit: BALANCE_UNIT,
    ticketsPerXan: TICKETS_PER_XAN,
    migratedToTicketsAt: record.migratedToTicketsAt || nowIso()
  };
  for (const field of ["balanceBaseline", "currentBalance", "totalWagered", "totalWon", "totalAdminAdded", "totalAdminRemoved", "totalWithdrawRequested"]) {
    if (out[field] !== undefined && out[field] !== null) out[field] = scalePositiveMoneyValue(out[field]);
  }
  if (out.netProfit !== undefined && out.netProfit !== null) out.netProfit = scaleMoneyValue(out.netProfit);
  out.totalTicketsDeposited = out.totalTicketsDeposited !== undefined ? int(out.totalTicketsDeposited, 0) : ticketsFromXans(out.totalXansDetected || 0);
  if (Array.isArray(out.financialLedger)) out.financialLedger = out.financialLedger.map(migrateLedgerEntryToTickets);
  if (Array.isArray(out.recentBets)) out.recentBets = out.recentBets.map(migrateBetToTickets);
  if (Array.isArray(out.recentAdjustments)) out.recentAdjustments = out.recentAdjustments.map(migrateAdjustmentToTickets);
  if (Array.isArray(out.recentWithdrawals)) out.recentWithdrawals = out.recentWithdrawals.map(migrateWithdrawalToTickets);
  if (out.activeTickets && typeof out.activeTickets === "object") {
    out.activeTickets = Object.fromEntries(Object.entries(out.activeTickets).map(([id, ticket]) => [id, migrateTicketLikeToTickets(ticket)]));
  }
  if (Array.isArray(out.recentEvents)) out.recentEvents = out.recentEvents.map(migrateEventToTickets);
  return out;
}
function migrateMpGameToTickets(game) {
  if (!game || typeof game !== "object") return game || {};
  if (isTicketUnitObject(game)) return game;

  // Multiplayer was converted from Xanax units to Ticket units.
  // Fresh in-memory games are already created from Ticket inputs, so do NOT
  // multiply values like 1,000 by 1,000 again. Only older stored games with
  // tiny Xanax-sized wagers are scaled.
  const rawAmounts = ["wager", "pot", "houseCut", "payout"]
    .map(field => Number(game[field]))
    .filter(Number.isFinite);
  const largestAmount = rawAmounts.length ? Math.max(...rawAmounts.map(n => Math.abs(n))) : 0;
  const looksAlreadyTickets = largestAmount >= TICKETS_PER_XAN;

  return {
    ...(looksAlreadyTickets ? game : scaleMoneyFields(game, ["wager", "pot", "houseCut", "payout"])),
    balanceUnit: BALANCE_UNIT,
    ticketsPerXan: TICKETS_PER_XAN,
    migratedToTicketsAt: game.migratedToTicketsAt || (looksAlreadyTickets ? null : nowIso())
  };
}
function cleanUserId(userId) { return String(userId || "unknown").replace(/[^0-9a-zA-Z_-]/g, ""); }
function userKey(userId) { return `${USER_PREFIX}${cleanUserId(userId)}.json`; }
function cleanVisitorId(visitorId) { return String(visitorId || "").replace(/[^0-9a-zA-Z_-]/g, "").slice(0, 120); }
function visitorLinkKey(visitorId) { return `${VISITOR_LINK_PREFIX}${cleanVisitorId(visitorId)}.json`; }
function tornUserLinkKey(tornUserId) { return `${TORN_LINK_PREFIX}${cleanUserId(tornUserId)}.json`; }

function getUsersStore() {
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID || "";
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_TOKEN || "";
  if (siteID && token) return getStore({ name: STORE_NAME, siteID, token });
  return getStore(STORE_NAME);
}

async function getVisitorLink(visitorId) {
  const id = cleanVisitorId(visitorId);
  if (!id) return null;
  try {
    const link = await getUsersStore().get(visitorLinkKey(id), { type: "json" });
    if (!link || !link.userId) return null;
    return {
      visitorId: id,
      userId: cleanUserId(link.userId),
      firstLinkedAt: link.firstLinkedAt || null,
      lastSeenAt: link.lastSeenAt || null,
      linkedTornUsers: Array.isArray(link.linkedTornUsers) ? link.linkedTornUsers.slice(-20) : []
    };
  } catch {
    return null;
  }
}

function sanitizeLinkedTornUser(entry = {}) {
  const id = cleanUserId(entry.id || entry.tornId || entry.userId);
  if (!id) return null;
  return {
    id,
    name: String(entry.name || entry.tornName || "Unknown").slice(0, 80),
    firstSeenAt: entry.firstSeenAt || entry.firstLinkedAt || entry.at || null,
    lastSeenAt: entry.lastSeenAt || entry.at || null
  };
}

function mergeLinkedTornUsers(existing = [], next = [], limit = 30) {
  const map = new Map();
  for (const raw of [...(Array.isArray(existing) ? existing : []), ...(Array.isArray(next) ? next : [])]) {
    const item = sanitizeLinkedTornUser(raw);
    if (!item) continue;
    const prior = map.get(item.id);
    map.set(item.id, {
      id: item.id,
      name: item.name || prior?.name || "Unknown",
      firstSeenAt: prior?.firstSeenAt || item.firstSeenAt || null,
      lastSeenAt: item.lastSeenAt || prior?.lastSeenAt || null
    });
  }
  return [...map.values()].slice(-limit);
}

function linkedTornEntryFromUser(user = {}, at = nowIso()) {
  const id = cleanUserId(user.tornId || user.id);
  if (!id) return null;
  return {
    id,
    name: user.tornName || user.name || "Unknown",
    firstSeenAt: at,
    lastSeenAt: at
  };
}

async function getTornUserLink(tornUserId) {
  const id = cleanUserId(tornUserId);
  if (!id) return null;
  try {
    const link = await getUsersStore().get(tornUserLinkKey(id), { type: "json" });
    if (!link || !link.userId) return null;
    return {
      tornUserId: id,
      userId: cleanUserId(link.userId),
      name: link.name ? String(link.name).slice(0, 80) : "Unknown",
      firstLinkedAt: link.firstLinkedAt || null,
      lastSeenAt: link.lastSeenAt || null,
      linkedByVisitorId: cleanVisitorId(link.linkedByVisitorId || "") || null
    };
  } catch {
    return null;
  }
}

async function saveTornUserLink(tornUserId, userId, tornUser = {}, visitorId = "") {
  const tornId = cleanUserId(tornUserId);
  const linkedUserId = cleanUserId(userId);
  if (!tornId || !linkedUserId) return null;
  const existing = await getTornUserLink(tornId);
  const at = nowIso();
  const link = {
    tornUserId: tornId,
    userId: linkedUserId,
    name: tornUser?.name ? String(tornUser.name).slice(0, 80) : existing?.name || "Unknown",
    firstLinkedAt: existing?.firstLinkedAt || at,
    lastSeenAt: at,
    linkedByVisitorId: cleanVisitorId(visitorId || existing?.linkedByVisitorId || "") || null
  };
  await getUsersStore().setJSON(tornUserLinkKey(tornId), link);
  return link;
}

async function saveVisitorLink(visitorId, userId, tornUser = {}) {
  const id = cleanVisitorId(visitorId);
  const linkedUserId = cleanUserId(userId);
  if (!id || !linkedUserId) return null;
  const existing = await getVisitorLink(id);
  const at = nowIso();
  const tornId = tornUser?.id ? String(tornUser.id) : "";
  const tornName = tornUser?.name ? String(tornUser.name).slice(0, 80) : "Unknown";
  const aliases = Array.isArray(existing?.linkedTornUsers) ? existing.linkedTornUsers : [];
  const nextAliases = tornId
    ? uniqueByKey([...aliases, { id: tornId, name: tornName, at }], (entry) => entry?.id, 20)
    : aliases.slice(-20);
  const link = {
    visitorId: id,
    userId: linkedUserId,
    firstLinkedAt: existing?.firstLinkedAt || at,
    lastSeenAt: at,
    linkedTornUsers: nextAliases
  };
  await getUsersStore().setJSON(visitorLinkKey(id), link);
  return link;
}

async function resolveSiteUser(tornUser, visitorId = "") {
  const tornId = cleanUserId(tornUser?.id);
  const cleanVisitor = cleanVisitorId(visitorId);
  if (!tornId) return { id: tornUser?.id, name: tornUser?.name || "Unknown" };

  if (cleanVisitor) {
    const existingLink = await getVisitorLink(cleanVisitor);
    if (existingLink?.userId) {
      const linkedRecord = await getUserRecord(existingLink.userId);
      if (linkedRecord?.userId) {
        await saveVisitorLink(cleanVisitor, linkedRecord.userId, tornUser);
        await saveTornUserLink(tornId, linkedRecord.userId, tornUser, cleanVisitor);
        return {
          id: linkedRecord.userId,
          name: tornUser?.name || linkedRecord.name || "Unknown",
          tornId: tornUser?.id || tornId,
          tornName: tornUser?.name || linkedRecord.name || "Unknown",
          visitorId: cleanVisitor,
          linkedFromVisitor: true
        };
      }
    }
  }

  const tornLink = await getTornUserLink(tornId);
  if (tornLink?.userId) {
    const linkedRecord = await getUserRecord(tornLink.userId);
    if (linkedRecord?.userId) {
      if (cleanVisitor) await saveVisitorLink(cleanVisitor, linkedRecord.userId, tornUser);
      await saveTornUserLink(tornId, linkedRecord.userId, tornUser, cleanVisitor);
      return {
        id: linkedRecord.userId,
        name: tornUser?.name || linkedRecord.name || "Unknown",
        tornId: tornUser?.id || tornId,
        tornName: tornUser?.name || tornLink.name || linkedRecord.name || "Unknown",
        visitorId: cleanVisitor || null,
        linkedFromTornAlias: true
      };
    }
  }

  if (cleanVisitor) await saveVisitorLink(cleanVisitor, tornId, tornUser);
  await saveTornUserLink(tornId, tornId, tornUser, cleanVisitor);

  return {
    id: tornUser?.id,
    name: tornUser?.name || "Unknown",
    tornId: tornUser?.id,
    tornName: tornUser?.name || "Unknown",
    visitorId: cleanVisitor || null,
    linkedFromVisitor: false
  };
}



function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function sanitizeOddsTier(tier, index = 0) {
  const key = String(tier?.key || tier?.label || `tier_${index}`).replace(/[^0-9A-Za-z_-]/g, "_").slice(0, 60) || `tier_${index}`;
  const label = String(tier?.label || key).slice(0, 80);
  const multiplier = Math.max(0, Number(tier?.multiplier ?? 0));
  const probability = Math.max(0, Number(tier?.probability ?? tier?.chance ?? 0));
  return { key, label, multiplier: Number(multiplier.toFixed(4)), probability: Number(probability.toFixed(6)) };
}

function oddsProfileStats(profile) {
  const tiers = Array.isArray(profile?.tiers) ? profile.tiers.map(sanitizeOddsTier) : [];
  const totalProbability = tiers.reduce((sum, tier) => sum + tier.probability, 0);
  const expectedMultiplier = totalProbability > 0
    ? tiers.reduce((sum, tier) => sum + (tier.probability / totalProbability) * tier.multiplier, 0)
    : 0;
  const winChance = totalProbability > 0
    ? tiers.filter(tier => tier.multiplier > 0).reduce((sum, tier) => sum + (tier.probability / totalProbability) * 100, 0)
    : 0;
  const rtp = expectedMultiplier * 100;
  return {
    totalProbability: Number(totalProbability.toFixed(6)),
    expectedMultiplier: Number(expectedMultiplier.toFixed(6)),
    rtp: Number(rtp.toFixed(3)),
    houseEdge: Number((100 - rtp).toFixed(3)),
    winChance: Number(winChance.toFixed(3))
  };
}

function sanitizeOddsProfile(profile, fallback = DEFAULT_ODDS_PROFILE) {
  const source = profile && typeof profile === "object" ? profile : fallback;
  let tiers = Array.isArray(source.tiers) ? source.tiers.map(sanitizeOddsTier).filter(tier => tier.probability > 0) : [];
  if (!tiers.length) tiers = cloneJson(fallback.tiers).map(sanitizeOddsTier);
  // Limit how wild the admin form can get so a typo cannot make the game impossible to settle.
  tiers = tiers.slice(0, 18).map((tier, index) => sanitizeOddsTier(tier, index));
  const sanitized = {
    name: String(source.name || fallback.name || "Custom Odds").slice(0, 100),
    description: String(source.description || fallback.description || "").slice(0, 240),
    tiers
  };
  sanitized.stats = oddsProfileStats(sanitized);
  return sanitized;
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function sanitizeGameOddsSettings(gameOdds = {}) {
  const source = gameOdds && typeof gameOdds === "object" ? gameOdds : {};
  const runnerSource = source.runner && typeof source.runner === "object" ? source.runner : {};
  const mpSource = source.multiplayer && typeof source.multiplayer === "object" ? source.multiplayer : {};
  const runnerDefault = DEFAULT_GAME_ODDS.runner;
  return {
    multiplayer: {
      houseCutPercent: Number(clampNumber(mpSource.houseCutPercent, 0, 25, DEFAULT_GAME_ODDS.multiplayer.houseCutPercent).toFixed(3))
    },
    runner: {
      baseWinChance: Number(clampNumber(runnerSource.baseWinChance, 1, 98, runnerDefault.baseWinChance).toFixed(3)),
      minWinChance: Number(clampNumber(runnerSource.minWinChance, 1, 95, runnerDefault.minWinChance).toFixed(3)),
      chanceDropPerStep: Number(clampNumber(runnerSource.chanceDropPerStep, 0, 35, runnerDefault.chanceDropPerStep).toFixed(3)),
      chanceDropPerMultiplier: Number(clampNumber(runnerSource.chanceDropPerMultiplier, 0, 35, runnerDefault.chanceDropPerMultiplier).toFixed(3)),
      startMultiplier: Number(clampNumber(runnerSource.startMultiplier, 1, 3, runnerDefault.startMultiplier).toFixed(3)),
      baseMultiplierIncrease: Number(clampNumber(runnerSource.baseMultiplierIncrease, 0.01, 5, runnerDefault.baseMultiplierIncrease).toFixed(3)),
      multiplierGrowth: Number(clampNumber(runnerSource.multiplierGrowth, 1, 3, runnerDefault.multiplierGrowth).toFixed(3)),
      maxMultiplier: Number(clampNumber(runnerSource.maxMultiplier, 1.01, 1000, runnerDefault.maxMultiplier).toFixed(3)),
      block2ChancePenalty: Number(clampNumber(runnerSource.block2ChancePenalty, 0, 90, runnerDefault.block2ChancePenalty).toFixed(3)),
      block3ChancePenalty: Number(clampNumber(runnerSource.block3ChancePenalty, 0, 95, runnerDefault.block3ChancePenalty).toFixed(3)),
      block2MultiplierBoost: Number(clampNumber(runnerSource.block2MultiplierBoost, 1, 20, runnerDefault.block2MultiplierBoost).toFixed(3)),
      block3MultiplierBoost: Number(clampNumber(runnerSource.block3MultiplierBoost, 1, 35, runnerDefault.block3MultiplierBoost).toFixed(3))
    }
  };
}

function sanitizeOddsSettings(settings = {}) {
  const rawUserProfiles = settings.userProfiles && typeof settings.userProfiles === "object" && !Array.isArray(settings.userProfiles) ? settings.userProfiles : {};
  const userProfiles = {};
  for (const [userId, profile] of Object.entries(rawUserProfiles)) {
    const cleanId = cleanUserId(userId);
    if (!cleanId) continue;
    userProfiles[cleanId] = sanitizeOddsProfile(profile, DEFAULT_ODDS_PROFILE);
  }
  const defaultProfile = sanitizeOddsProfile(settings.defaultProfile || DEFAULT_ODDS_PROFILE, DEFAULT_ODDS_PROFILE);
  const gameOdds = sanitizeGameOddsSettings(settings.gameOdds || DEFAULT_GAME_ODDS);
  return {
    updatedAt: settings.updatedAt || null,
    updatedBy: String(settings.updatedBy || "admin").slice(0, 80),
    defaultProfile,
    userProfiles,
    gameOdds
  };
}

async function getOddsSettings() {
  const store = getUsersStore();
  try {
    const settings = await store.get(ODDS_SETTINGS_KEY, { type: "json" });
    return sanitizeOddsSettings(settings || { defaultProfile: DEFAULT_ODDS_PROFILE, userProfiles: {} });
  } catch {
    return sanitizeOddsSettings({ defaultProfile: DEFAULT_ODDS_PROFILE, userProfiles: {} });
  }
}

async function saveOddsSettings(settings) {
  const clean = sanitizeOddsSettings({ ...(settings || {}), updatedAt: nowIso() });
  await getUsersStore().setJSON(ODDS_SETTINGS_KEY, clean);
  return clean;
}

async function setDefaultOddsProfile(profile, adminLabel = "admin") {
  const current = await getOddsSettings();
  return saveOddsSettings({ ...current, updatedBy: adminLabel, defaultProfile: sanitizeOddsProfile(profile, DEFAULT_ODDS_PROFILE) });
}

async function setUserOddsProfile(userId, profile, adminLabel = "admin") {
  const current = await getOddsSettings();
  const cleanId = cleanUserId(userId);
  if (!cleanId) throw new Error("Select a valid user for a user-specific odds override.");
  const userProfiles = { ...(current.userProfiles || {}), [cleanId]: sanitizeOddsProfile(profile, current.defaultProfile) };
  return saveOddsSettings({ ...current, updatedBy: adminLabel, userProfiles });
}

async function clearUserOddsProfile(userId, adminLabel = "admin") {
  const current = await getOddsSettings();
  const cleanId = cleanUserId(userId);
  const userProfiles = { ...(current.userProfiles || {}) };
  delete userProfiles[cleanId];
  return saveOddsSettings({ ...current, updatedBy: adminLabel, userProfiles });
}


async function setGameOddsSettings(gameOdds, adminLabel = "admin") {
  const current = await getOddsSettings();
  return saveOddsSettings({ ...current, updatedBy: adminLabel, gameOdds: sanitizeGameOddsSettings(gameOdds || {}) });
}

async function getGameOddsSettings() {
  const settings = await getOddsSettings();
  return sanitizeGameOddsSettings(settings.gameOdds || DEFAULT_GAME_ODDS);
}

async function getResolvedOddsForUser(userId) {
  const settings = await getOddsSettings();
  const cleanId = cleanUserId(userId);
  const override = cleanId ? settings.userProfiles?.[cleanId] : null;
  const profile = override ? sanitizeOddsProfile(override, settings.defaultProfile) : sanitizeOddsProfile(settings.defaultProfile, DEFAULT_ODDS_PROFILE);
  return { profile, source: override ? "user" : "global", userId: cleanId, settings };
}

function publicOddsSettings(settings) {
  const clean = sanitizeOddsSettings(settings || {});
  return {
    ...clean,
    presets: Object.fromEntries(Object.entries(ODDS_PRESETS).map(([key, profile]) => [key, sanitizeOddsProfile(profile, DEFAULT_ODDS_PROFILE)]))
  };
}

async function getUserRecord(userId) {
  if (!userId) return null;
  try {
    const record = await getUsersStore().get(userKey(userId), { type: "json" });
    return record ? sanitizeRecord(record) : null;
  } catch {
    return null;
  }
}

async function saveUserRecord(record) {
  let sanitized = sanitizeRecord(record || {});
  const store = getUsersStore();

  // Merge with the latest stored record before saving. This reduces lost updates
  // when a user reveals a winning ticket and immediately buys again while Netlify
  // Blobs is still catching up. The incoming record still controls activeTickets,
  // so completed tickets can be cleared correctly.
  try {
    const latest = await store.get(userKey(sanitized.userId), { type: "json" });
    if (latest && String(latest.userId) === String(sanitized.userId)) {
      sanitized = mergeRecordsForSave(latest, sanitized);
    }
  } catch {}

  await store.setJSON(userKey(sanitized.userId), sanitized);
  return sanitized;
}

function uniqueByKey(items, keyFn, limit) {
  const map = new Map();
  for (const item of (Array.isArray(items) ? items : [])) {
    const key = keyFn(item);
    if (!key) continue;
    map.set(String(key), item);
  }
  return [...map.values()].slice(-limit);
}

function mergeRecordsForSave(existingRaw, incomingRaw) {
  const existing = sanitizeRecord(existingRaw || {});
  const incoming = sanitizeRecord(incomingRaw || {});
  const merged = {
    ...existing,
    ...incoming,
    firstConnectedAt: existing.firstConnectedAt || incoming.firstConnectedAt || null,
    firstTicketBonusUsedAt: existing.firstTicketBonusUsedAt || incoming.firstTicketBonusUsedAt || null,
    firstTicketBonusTicketId: existing.firstTicketBonusTicketId || incoming.firstTicketBonusTicketId || null,
    claimedLogIds: [...new Set([...(existing.claimedLogIds || []), ...(incoming.claimedLogIds || [])])].slice(-MAX_CLAIMED_LOG_IDS),
    issuedTicketIds: [...new Set([...(existing.issuedTicketIds || []), ...(incoming.issuedTicketIds || [])])].slice(-MAX_TICKET_IDS),
    completedTicketIds: [...new Set([...(existing.completedTicketIds || []), ...(incoming.completedTicketIds || [])])].slice(-MAX_TICKET_IDS),
    linkedTornUsers: mergeLinkedTornUsers(existing.linkedTornUsers, incoming.linkedTornUsers),
    financialLedger: uniqueByKey([...(existing.financialLedger || []), ...(incoming.financialLedger || [])], (entry) => entry?.id, MAX_LEDGER),
    recentBets: uniqueByKey([...(existing.recentBets || []), ...(incoming.recentBets || [])], (bet) => bet?.ticketId || `${bet?.at}:${bet?.ticketCost}:${bet?.winAmount}`, MAX_BETS),
    recentAdjustments: uniqueByKey([...(existing.recentAdjustments || []), ...(incoming.recentAdjustments || [])], (adj) => adj?.adjustmentId || `${adj?.at}:${adj?.amount}:${adj?.action}`, MAX_ADJUSTMENTS),
    recentWithdrawals: uniqueByKey([...(existing.recentWithdrawals || []), ...(incoming.recentWithdrawals || [])], (w) => w?.withdrawalId || `${w?.at}:${w?.amount}`, MAX_WITHDRAWALS),
    fishingRecord: Number(incoming.fishingRecord?.size || 0) >= Number(existing.fishingRecord?.size || 0) ? incoming.fishingRecord : existing.fishingRecord,
    fishingLogbook: mergeFishingLogbooks(existing.fishingLogbook, incoming.fishingLogbook),
    recentEvents: [...(existing.recentEvents || []), ...(incoming.recentEvents || [])].slice(-MAX_EVENTS),
    // Do not merge old active tickets back in. Incoming decides whether a ticket
    // is active or whether completion cleared it.
    activeTickets: incoming.activeTickets || {}
  };
  return sanitizeRecord(merged);
}

async function listUserRecords() {
  const store = getUsersStore();
  const result = await store.list({ prefix: USER_PREFIX });
  const records = [];
  for (const blob of (result?.blobs || [])) {
    try {
      const record = await store.get(blob.key, { type: "json" });
      if (record && record.userId) records.push(sanitizeRecord(record));
    } catch {}
  }
  records.sort((a, b) => String(b.lastWithdrawalAt || b.lastBetAt || b.lastCheckedAt || b.lastConnectedAt || b.firstConnectedAt || "").localeCompare(String(a.lastWithdrawalAt || a.lastBetAt || a.lastCheckedAt || a.lastConnectedAt || a.firstConnectedAt || "")));
  return records;
}

function legacyAggregateBalance(record) {
  if (!record) return 0;
  const baseline = int(record.balanceBaseline, 0);
  const detected = isTicketUnitObject(record) ? int(record.totalTicketsDeposited, ticketsFromXans(record.totalXansDetected || 0)) : int(record.totalXansDetected, 0);
  const won = int(record.totalWon, 0);
  const wagered = int(record.totalWagered, 0);
  const adminAdded = int(record.totalAdminAdded, 0);
  const adminRemoved = int(record.totalAdminRemoved, 0);
  const withdrawn = int(record.totalWithdrawRequested, 0);
  return Math.max(0, Math.floor(baseline + detected + won + adminAdded - wagered - adminRemoved - withdrawn));
}

function hasLedger(record) {
  return !!(record && (record.ledgerStartedAt || Array.isArray(record.financialLedger)));
}

function calculateLedgerBalance(record) {
  if (!record) return 0;
  if (!hasLedger(record)) return legacyAggregateBalance(record);
  const baseline = int(record.balanceBaseline, 0);
  const ledger = Array.isArray(record.financialLedger) ? record.financialLedger.map(sanitizeLedgerEntry) : [];
  const delta = ledger.reduce((sum, entry) => sum + signedInt(entry.delta, 0), 0);
  return Math.max(0, Math.floor(baseline + delta));
}

function getRecordBalance(record) {
  if (!record) return 0;
  return calculateLedgerBalance(record);
}

function prepareLedgerRecord(record) {
  const clean = sanitizeRecord(record || {});
  if (clean.ledgerStartedAt) return clean;

  // One-time migration: freeze the old aggregate/current balance as a baseline, then
  // every future deposit, ticket cost, ticket win, withdrawal, or admin edit becomes
  // its own immutable ledger entry. This prevents old cached currentBalance fields
  // from restoring money after a bet or withdrawal.
  const baseline = Number.isFinite(Number(record?.currentBalance))
    ? int(record.currentBalance, 0)
    : legacyAggregateBalance(clean);

  return sanitizeRecord({
    ...clean,
    ledgerStartedAt: nowIso(),
    balanceBaseline: baseline,
    financialLedger: [],
    currentBalance: baseline
  });
}

function ledgerEntryIdExists(record, id) {
  const target = String(id || "");
  if (!target) return false;
  return Array.isArray(record?.financialLedger) && record.financialLedger.some((entry) => String(entry?.id || "") === target);
}

function addLedgerEntry(record, entry) {
  const clean = prepareLedgerRecord(record);
  const normalized = sanitizeLedgerEntry({ ...entry, at: entry.at || nowIso() });
  if (!normalized.id) normalized.id = `${normalized.type || "entry"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  if (ledgerEntryIdExists(clean, normalized.id)) return { record: clean, entry: normalized, added: false };
  const nextLedger = [...(clean.financialLedger || []), normalized].map(sanitizeLedgerEntry).slice(-MAX_LEDGER);
  const next = sanitizeRecord({ ...clean, financialLedger: nextLedger });
  return { record: next, entry: normalized, added: true };
}

function addManyLedgerEntries(record, entries) {
  let next = prepareLedgerRecord(record);
  const added = [];
  for (const entry of entries || []) {
    const result = addLedgerEntry(next, entry);
    next = result.record;
    if (result.added) added.push(result.entry);
  }
  return { record: next, added };
}

function makeLedgerEntry({ id, type, delta, amount, at, ticketId, reason, meta }) {
  return sanitizeLedgerEntry({ id, type, delta, amount, at: at || nowIso(), ticketId, reason, meta });
}

function sanitizeLedgerEntry(entry) {
  return {
    id: String(entry?.id || "").replace(/[^0-9A-Za-z_:.|-]/g, "").slice(0, 160),
    type: String(entry?.type || "ledger").replace(/[^0-9A-Za-z_-]/g, "").slice(0, 60),
    delta: signedInt(entry?.delta, 0),
    amount: int(entry?.amount, Math.abs(signedInt(entry?.delta, 0))),
    at: entry?.at || null,
    ticketId: entry?.ticketId ? String(entry.ticketId).slice(0, 100) : null,
    reason: entry?.reason ? String(entry.reason).slice(0, 240) : null,
    meta: entry?.meta && typeof entry.meta === "object" ? JSON.parse(JSON.stringify(entry.meta)).valueOf() : {}
  };
}


function normalizeWithdrawalRecovery(details = {}) {
  const source = details.lastWithdrawal && typeof details.lastWithdrawal === "object" ? details.lastWithdrawal : details;
  const withdrawalId = String(source.withdrawalId || source.lastWithdrawalId || "").replace(/[^0-9A-Za-z_-]/g, "").slice(0, 100);
  const amount = int(source.amount ?? source.withdrawalAmount ?? source.lastWithdrawalAmount, 0);
  const at = source.at || source.withdrawalAt || source.lastWithdrawalAt || nowIso();
  if (!withdrawalId || amount <= 0) return null;
  return { withdrawalId, amount, at };
}

function recoverPreviousWithdrawal(record, details = {}) {
  let existing = prepareLedgerRecord(record);
  const recovery = normalizeWithdrawalRecovery(details);
  if (!recovery) return { record: existing, recovered: false };

  const ledgerId = `withdraw:${recovery.withdrawalId}`;
  const existingWithdrawal = Array.isArray(existing.recentWithdrawals)
    ? existing.recentWithdrawals.find((w) => String(w.withdrawalId || "") === recovery.withdrawalId)
    : null;

  if (ledgerEntryIdExists(existing, ledgerId) && existingWithdrawal) {
    return { record: existing, recovered: false };
  }

  const balanceBefore = getRecordBalance(existing);
  const ledgerResult = addLedgerEntry(existing, makeLedgerEntry({
    id: ledgerId,
    type: "withdrawal",
    delta: -recovery.amount,
    amount: recovery.amount,
    at: recovery.at,
    reason: "Recovered confirmed withdrawal so stale saves cannot restore balance"
  }));

  const afterLedger = ledgerResult.record;
  const balanceAfter = getRecordBalance(afterLedger);
  const withdrawal = sanitizeWithdrawal({
    type: "withdrawal",
    withdrawalId: recovery.withdrawalId,
    at: recovery.at,
    amount: recovery.amount,
    status: "pending",
    note: "Recovered confirmed user withdrawal",
    balanceBefore,
    balanceAfter
  });

  const recordAfterRecovery = sanitizeRecord({
    ...afterLedger,
    lastWithdrawalAt: afterLedger.lastWithdrawalAt || recovery.at,
    withdrawalCount: int(afterLedger.withdrawalCount, 0) + (existingWithdrawal ? 0 : 1),
    totalWithdrawRequested: int(afterLedger.totalWithdrawRequested, 0) + (ledgerResult.added ? recovery.amount : 0),
    recentWithdrawals: existingWithdrawal ? afterLedger.recentWithdrawals : addWithdrawal(afterLedger.recentWithdrawals || [], withdrawal),
    recentEvents: addEvent(afterLedger.recentEvents || [], {
      ...withdrawal,
      type: "recovered_withdrawal",
      message: `Recovered withdrawal ${recovery.withdrawalId} for ${formatTickets(recovery.amount)}. Balance: ${formatTickets(balanceBefore)} → ${formatTickets(balanceAfter)}.`
    })
  });

  return { record: recordAfterRecovery, recovered: true };
}


async function recordConnect(user, source = "save-key", details = {}) {
  const existingRaw = await getUserRecord(user.id);
  const at = nowIso();
  if (existingRaw && existingRaw.userId) {
    const withdrawalRecovery = recoverPreviousWithdrawal(prepareLedgerRecord(existingRaw), details);
    const existing = withdrawalRecovery.record;
    const balanceNow = getRecordBalance(existing);
    const record = sanitizeRecord({
      ...existing,
      name: user.name || existing.name || "Unknown",
      linkedTornUsers: mergeLinkedTornUsers(existing.linkedTornUsers, [linkedTornEntryFromUser(user, at)]),
      lastConnectedAt: at,
      connectCount: int(existing.connectCount, 0) + 1,
      recentEvents: addEvent(existing.recentEvents || [], {
        type: "connect",
        source,
        at,
        balanceAfter: balanceNow,
        message: `${user.name || existing.name || "Unknown"} [${existing.userId}] saved and verified a Torn API key. Balance unchanged: ${formatTickets(balanceNow)}.`
      })
    });
    const savedRecord = await saveUserRecord(record);
    return savedRecord;
  }

  const record = sanitizeRecord({
    userId: String(user.id),
    name: user.name || "Unknown",
    linkedTornUsers: mergeLinkedTornUsers([], [linkedTornEntryFromUser(user, at)]),
    firstConnectedAt: at,
    lastConnectedAt: at,
    ledgerStartedAt: at,
    balanceUnit: BALANCE_UNIT,
    ticketsPerXan: TICKETS_PER_XAN,
    balanceBaseline: 0,
    financialLedger: [],
    connectCount: 1,
    checkCount: 0,
    betCount: 0,
    totalXansDetected: 0,
    totalTicketsDeposited: 0,
    totalWagered: 0,
    totalWon: 0,
    currentBalance: 0,
    claimedLogIds: [],
    recentBets: [],
    recentEvents: addEvent([], {
      type: "connect",
      source,
      at,
      message: `${user.name || "Unknown"} [${user.id}] saved and verified a Torn API key.`
    })
  });
  const savedRecord = await saveUserRecord(record);
  return savedRecord;
}

async function recordCheck(user, details = {}) {
  const initialRecord = prepareLedgerRecord((await getUserRecord(user.id)) || { userId: String(user.id), name: user.name || "Unknown" });
  const withdrawalRecovery = recoverPreviousWithdrawal(initialRecord, details);
  const existing = withdrawalRecovery.record;
  const at = nowIso();
  const previousIds = Array.isArray(existing.claimedLogIds) ? existing.claimedLogIds.map(String) : [];
  const newIds = Array.isArray(details.newLogIds) ? details.newLogIds.map(String) : [];
  const combinedIds = [...new Set(previousIds.concat(newIds))].slice(-MAX_CLAIMED_LOG_IDS);
  const addedXans = int(details.addedXans, 0);
  const addedTickets = ticketsFromXans(addedXans);
  const balanceBefore = getRecordBalance(existing);

  let record = sanitizeRecord({
    ...existing,
    userId: String(user.id),
    name: user.name || existing.name || "Unknown",
    linkedTornUsers: mergeLinkedTornUsers(existing.linkedTornUsers, [linkedTornEntryFromUser(user, at)]),
    firstConnectedAt: existing.firstConnectedAt || at,
    lastConnectedAt: existing.lastConnectedAt || at,
    lastCheckedAt: at,
    checkCount: int(existing.checkCount, 0) + 1,
    totalXansDetected: int(existing.totalXansDetected, 0) + addedXans,
    totalTicketsDeposited: int(existing.totalTicketsDeposited, ticketsFromXans(existing.totalXansDetected || 0)) + addedTickets,
    claimedLogIds: combinedIds
  });

  if (addedTickets > 0) {
    const depositId = `deposit:${newIds.length ? newIds.join("|") : `${user.id}:${at}`}`;
    record = addLedgerEntry(record, makeLedgerEntry({
      id: depositId,
      type: "deposit",
      delta: addedTickets,
      amount: addedTickets,
      at,
      reason: "Detected Xanax sent to CowBoyCookie and converted to Tickets",
      meta: { newLogIds: newIds, addedXans, addedTickets, ticketsPerXan: TICKETS_PER_XAN }
    })).record;
  }

  const balanceAfter = getRecordBalance(record);
  record = sanitizeRecord({
    ...record,
    recentEvents: addEvent(record.recentEvents || [], {
      type: "check",
      at,
      addedTickets,
      newLogCount: newIds.length,
      checkedFrom: details.checkedFrom || null,
      checkedAtUnix: details.checkedAt || null,
      balanceBefore,
      balanceAfter,
      message: addedXans > 0
        ? `${user.name || "Unknown"} [${user.id}] checked and received ${addedXans} Xanax = ${formatTickets(addedTickets)}. Balance: ${formatTickets(balanceBefore)} → ${formatTickets(balanceAfter)}.`
        : `${user.name || "Unknown"} [${user.id}] checked with no new Xanax. Balance: ${formatTickets(balanceAfter)}.`
    })
  });

  const savedRecord = await saveUserRecord(record);
  return savedRecord;
}

function makeServerTicketNumbers(price, profile = DEFAULT_ODDS_PROFILE) {
  if (!VALID_TICKET_COSTS.includes(Number(price))) throw new Error("Invalid ticket price.");
  const oddsProfile = sanitizeOddsProfile(profile, DEFAULT_ODDS_PROFILE);
  const tiers = oddsProfile.tiers;
  const total = tiers.reduce((sum, tier) => sum + tier.probability, 0);
  let roll = Math.random() * (total || 100);
  let selected = tiers[0] || sanitizeOddsTier({ multiplier: 0, probability: 100 });
  for (const tier of tiers) {
    roll -= tier.probability;
    if (roll <= 0) { selected = tier; break; }
  }

  const targetPayout = selected.multiplier > 0 ? Math.max(1, Math.floor(Number(price) * selected.multiplier)) : 0;
  const payouts = possiblePayoutsForPrice(price, oddsProfile);
  const prizes = [];

  if (targetPayout > 0) {
    prizes.push(targetPayout, targetPayout, targetPayout);
    fillNonWinningSpots(prizes, payouts, targetPayout);
  } else {
    fillNonWinningSpots(prizes, payouts, 0);
  }

  return shuffleServer(prizes);
}

function possiblePayoutsForPrice(price, profile = DEFAULT_ODDS_PROFILE) {
  const base = sanitizeOddsProfile(profile, DEFAULT_ODDS_PROFILE).tiers
    .filter(tier => tier.multiplier > 0)
    .map(tier => Math.max(1, Math.floor(Number(price) * tier.multiplier)));
  return [...new Set([0, ...base])].sort((a, b) => a - b);
}

function fillNonWinningSpots(prizes, payouts, protectedPayout = 0) {
  const choices = Array.isArray(payouts) && payouts.length ? payouts : [0];
  let guard = 0;
  while (prizes.length < 9 && guard < 2000) {
    guard++;
    const candidate = choices[Math.floor(Math.random() * choices.length)] || 0;
    const count = prizes.filter(v => v === candidate).length;
    if (candidate > 0) {
      if (candidate === protectedPayout && count >= 3) continue;
      if (candidate !== protectedPayout && count >= 2) continue;
    }
    prizes.push(candidate);
  }
  while (prizes.length < 9) prizes.push(0);
}

function shuffleServer(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function countTicketWin(prizes) {
  const counts = {};
  for (const value of (prizes || [])) counts[value] = (counts[value] || 0) + 1;
  const wins = Object.entries(counts).filter(([amount, count]) => Number(amount) > 0 && count >= 3).map(([amount]) => Number(amount));
  return wins.length ? Math.max(...wins) : 0;
}

function ticketSecret() {
  return process.env.TICKET_SIGNING_SECRET || process.env.TORN_OWNER_API_KEY || process.env.ADMIN_PASSWORD || "change-this-ticket-secret-in-netlify";
}

function signTicketPayload(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", ticketSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyTicketToken(token) {
  const raw = String(token || "");
  const [body, sig] = raw.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", ticketSecret()).update(body).digest("base64url");
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch { return null; }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload || typeof payload !== "object") return null;
    if (!payload.ticketId || !payload.userId || !Array.isArray(payload.prizes)) return null;
    return payload;
  } catch { return null; }
}

function sanitizeActiveTickets(activeTickets) {
  const source = activeTickets && typeof activeTickets === "object" && !Array.isArray(activeTickets) ? activeTickets : {};
  const entries = Object.entries(source)
    .map(([id, ticket]) => sanitizeActiveTicket({ ...(ticket || {}), ticketId: ticket?.ticketId || id }))
    .filter((ticket) => ticket.ticketId && ticket.status === "active")
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, MAX_ACTIVE_TICKETS);
  return Object.fromEntries(entries.map((ticket) => [ticket.ticketId, ticket]));
}

function getOpenActiveTickets(record) {
  const completedIds = new Set(Array.isArray(record?.completedTicketIds) ? record.completedTicketIds.map(String) : []);
  const activeTickets = sanitizeActiveTickets(record?.activeTickets || {});
  return Object.fromEntries(Object.entries(activeTickets).filter(([ticketId, ticket]) => {
    if (!ticket || ticket.status !== "active") return false;
    if (completedIds.has(String(ticketId)) || completedIds.has(String(ticket.ticketId || ""))) return false;
    return Array.isArray(ticket.prizes) && ticket.prizes.length > 0;
  }));
}



function sanitizeDoubleOrNothing(info) {
  if (!info || typeof info !== "object") return null;
  const previousWinAmount = int(info.previousWinAmount || info.currentWinAmount || info.winAmount, 0);
  const sourceTicketId = String(info.sourceTicketId || info.previousTicketId || "").replace(/[^0-9A-Za-z_-]/g, "").slice(0, 100);
  const previousTicketCost = int(info.previousTicketCost || info.ticketCost, 0);
  if (!sourceTicketId || previousWinAmount <= 0) return null;
  return {
    active: true,
    sourceTicketId,
    previousWinAmount,
    previousTicketCost,
    multiplier: 2,
    firstGameBonusRisk: info.firstGameBonusRisk === true || info.forceLose === true
  };
}

function getDoubleOrNothingRequest(existing, details = {}, ticketCost = 0) {
  const raw = details.doubleOrNothing && typeof details.doubleOrNothing === "object" ? details.doubleOrNothing : null;
  if (!raw || raw.active !== true) return null;
  const sourceTicketId = String(raw.sourceTicketId || "").replace(/[^0-9A-Za-z_-]/g, "").slice(0, 100);
  if (!sourceTicketId) throw new Error("Double or Nothing needs a previous winning ticket.");
  const sourceBet = findRecentBetByTicketId(existing, sourceTicketId);
  if (!sourceBet || int(sourceBet.winAmount, 0) <= 0) throw new Error("Double or Nothing is only available after a winning ticket.");
  if (int(sourceBet.ticketCost, 0) !== int(ticketCost, 0)) throw new Error("Double or Nothing must use the same ticket price as the previous winning card.");
  const firstGameBonusRisk = String(sourceBet.oddsSource || "") === "first_bonus" || String(existing.firstTicketBonusTicketId || "") === sourceTicketId;
  return sanitizeDoubleOrNothing({
    sourceTicketId,
    previousWinAmount: sourceBet.winAmount,
    previousTicketCost: sourceBet.ticketCost,
    firstGameBonusRisk
  });
}

function sanitizeActiveTicket(ticket) {
  const ticketCost = int(ticket.ticketCost, 0);
  const prizes = Array.isArray(ticket.prizes) ? ticket.prizes.map((v) => int(v, 0)).slice(0, 12) : [];
  const winAmount = int(ticket.winAmount, countTicketWin(prizes));
  const status = String(ticket.status || "active").toLowerCase() === "completed" ? "completed" : "active";
  return {
    ticketId: String(ticket.ticketId || "").replace(/[^0-9A-Za-z_-]/g, "").slice(0, 100),
    ticketToken: String(ticket.ticketToken || "").slice(0, 2000),
    createdAt: ticket.createdAt || null,
    completedAt: ticket.completedAt || null,
    ticketCost,
    prizes,
    status,
    winAmount,
    baseWinAmount: int(ticket.baseWinAmount, winAmount),
    doubleBonus: int(ticket.doubleBonus, 0),
    doubleLossAmount: int(ticket.doubleLossAmount, 0),
    doubleOrNothing: sanitizeDoubleOrNothing(ticket.doubleOrNothing),
    oddsName: ticket.oddsName ? String(ticket.oddsName).slice(0, 100) : null,
    oddsSource: ticket.oddsSource ? String(ticket.oddsSource).slice(0, 20) : null,
    oddsRtp: Number.isFinite(Number(ticket.oddsRtp)) ? Number(Number(ticket.oddsRtp).toFixed(3)) : null,
    balanceBefore: int(ticket.balanceBefore, 0),
    balanceAfterCost: int(ticket.balanceAfterCost, 0),
    balanceAfter: int(ticket.balanceAfter, 0)
  };
}

function findRecentBetByTicketId(record, ticketId) {
  const id = String(ticketId || "");
  if (!id || !Array.isArray(record?.recentBets)) return null;
  const found = [...record.recentBets].reverse().find((bet) => String(bet?.ticketId || "") === id);
  return found ? sanitizeBet(found) : null;
}

function ticketFromBet(bet) {
  const clean = sanitizeBet(bet || {});
  return sanitizeActiveTicket({
    ticketId: clean.ticketId,
    ticketToken: clean.ticketToken || "",
    createdAt: clean.createdAt || clean.at,
    completedAt: clean.at,
    ticketCost: clean.ticketCost,
    prizes: clean.prizes,
    status: "completed",
    winAmount: clean.winAmount,
    baseWinAmount: clean.baseWinAmount,
    doubleBonus: clean.doubleBonus,
    doubleLossAmount: clean.doubleLossAmount,
    doubleOrNothing: clean.doubleOrNothing,
    oddsName: clean.oddsName,
    oddsSource: clean.oddsSource,
    oddsRtp: clean.oddsRtp,
    balanceBefore: clean.balanceBefore,
    balanceAfterCost: Math.max(0, clean.balanceBefore - clean.ticketCost),
    balanceAfter: clean.balanceAfter
  });
}


function recoverPreviousCompletedTicket(record, details = {}) {
  let existing = prepareLedgerRecord(record);
  const previousTicketId = String(details.lastCompletedTicketId || "").replace(/[^0-9A-Za-z_-]/g, "").slice(0, 100);
  const previousToken = String(details.lastCompletedTicketToken || "");
  if (!previousTicketId || !previousToken) return { record: existing, recovered: false };

  const payload = verifyTicketToken(previousToken);
  if (!payload || String(payload.userId) !== String(existing.userId) || String(payload.ticketId) !== previousTicketId) {
    return { record: existing, recovered: false };
  }

  const ticketCost = int(payload.ticketCost, 0);
  const prizes = Array.isArray(payload.prizes) ? payload.prizes.map((v) => int(v, 0)).slice(0, 12) : [];
  const baseWinAmount = countTicketWin(prizes);
  const doubleOrNothing = sanitizeDoubleOrNothing(payload.doubleOrNothing);
  const doubleBonus = baseWinAmount > 0 && doubleOrNothing ? doubleOrNothing.previousWinAmount + baseWinAmount : 0; // Adds previous win again + next win again, so both are doubled.
  const doubleLossAmount = baseWinAmount <= 0 && doubleOrNothing ? doubleOrNothing.previousWinAmount : 0;
  const winAmount = baseWinAmount + doubleBonus;
  const buyEntryId = `ticket-buy:${previousTicketId}`;
  const winEntryId = `ticket-win:${previousTicketId}`;
  const doubleEntryId = `ticket-double-bonus:${previousTicketId}`;
  const doubleLossEntryId = `ticket-double-loss:${previousTicketId}`;
  const at = nowIso();
  const entries = [];

  if (!ledgerEntryIdExists(existing, buyEntryId)) {
    entries.push(makeLedgerEntry({
      id: buyEntryId,
      type: "ticket_buy",
      delta: -ticketCost,
      amount: ticketCost,
      at: payload.createdAt || at,
      ticketId: previousTicketId,
      reason: `Recovered missing buy ledger for ${ticketCost} Ticket`
    }));
  }

  if (baseWinAmount > 0 && !ledgerEntryIdExists(existing, winEntryId)) {
    entries.push(makeLedgerEntry({
      id: winEntryId,
      type: "ticket_win",
      delta: baseWinAmount,
      amount: baseWinAmount,
      at,
      ticketId: previousTicketId,
      reason: `Recovered missing win ledger for ${formatTickets(baseWinAmount)}`
    }));
  }

  if (doubleBonus > 0 && !ledgerEntryIdExists(existing, doubleEntryId)) {
    entries.push(makeLedgerEntry({
      id: doubleEntryId,
      type: "ticket_double_bonus",
      delta: doubleBonus,
      amount: doubleBonus,
      at,
      ticketId: previousTicketId,
      reason: `Recovered Double or Nothing bonus ${formatTickets(doubleBonus)}`
    }));
  }

  if (doubleLossAmount > 0 && !ledgerEntryIdExists(existing, doubleLossEntryId)) {
    entries.push(makeLedgerEntry({
      id: doubleLossEntryId,
      type: "ticket_double_loss",
      delta: -doubleLossAmount,
      amount: doubleLossAmount,
      at,
      ticketId: previousTicketId,
      reason: `Recovered Double or Nothing loss of original win ${formatTickets(doubleLossAmount)}`
    }));
  }

  if (!entries.length) return { record: existing, recovered: false };

  const ledgerResult = addManyLedgerEntries(existing, entries);
  const afterLedger = ledgerResult.record;
  const balanceAfter = getRecordBalance(afterLedger);
  const previousBet = findRecentBetByTicketId(afterLedger, previousTicketId);
  const balanceAfterCost = Math.max(0, int(payload.balanceBefore, balanceAfter + ticketCost - winAmount) - ticketCost);

  const bet = sanitizeBet({
    type: "bet",
    ticketId: previousTicketId,
    ticketToken: previousToken,
    createdAt: payload.createdAt || null,
    at,
    ticketCost,
    winAmount,
    baseWinAmount,
    doubleBonus,
    doubleLossAmount,
    doubleOrNothing,
    net: winAmount - ticketCost - doubleLossAmount,
    outcome: winAmount > 0 ? "win" : "loss",
    balanceBefore: balanceAfterCost,
    balanceAfter,
    prizes
  });

  const recovered = sanitizeRecord({
    ...afterLedger,
    totalWagered: int(afterLedger.totalWagered, 0) + (ledgerResult.added.some((entry) => entry.id === buyEntryId) ? ticketCost : 0),
    totalWon: int(afterLedger.totalWon, 0) + (ledgerResult.added.some((entry) => entry.id === winEntryId) ? baseWinAmount : 0) + (ledgerResult.added.some((entry) => entry.id === doubleEntryId) ? doubleBonus : 0),
    betCount: previousBet ? int(afterLedger.betCount, 0) : int(afterLedger.betCount, 0) + 1,
    activeTickets: {},
    completedTicketIds: [...new Set([...(afterLedger.completedTicketIds || []).map(String), previousTicketId])].slice(-MAX_TICKET_IDS),
    recentBets: previousBet ? afterLedger.recentBets : addBet(afterLedger.recentBets || [], bet),
    recentEvents: addEvent(afterLedger.recentEvents || [], {
      ...bet,
      type: "recovered_ticket",
      message: doubleBonus > 0
        ? `Recovered completed Double or Nothing ticket ledger before next purchase. Ticket ${previousTicketId}: cost ${ticketCost}, base win ${baseWinAmount}, bonus ${doubleBonus}. Balance: ${balanceAfter}.`
        : (doubleLossAmount > 0
          ? `Recovered completed Double or Nothing loss before next purchase. Ticket ${previousTicketId}: cost ${ticketCost}, forfeited original win ${doubleLossAmount}. Balance: ${balanceAfter}.`
          : `Recovered completed ticket ledger before next purchase. Ticket ${previousTicketId}: cost ${ticketCost}, won ${winAmount}. Balance: ${balanceAfter}.`)
    })
  });

  return { record: recovered, recovered: true };
}

function hasPlayedAnyTicket(record) {
  if (!record) return false;
  if (record.firstTicketBonusUsedAt || record.firstTicketBonusTicketId) return true;
  if (int(record.betCount, 0) > 0) return true;
  if (Array.isArray(record.recentBets) && record.recentBets.length > 0) return true;
  if (Array.isArray(record.completedTicketIds) && record.completedTicketIds.length > 0) return true;
  if (Array.isArray(record.issuedTicketIds) && record.issuedTicketIds.length > 0) return true;
  const activeTickets = getOpenActiveTickets(record);
  return Object.keys(activeTickets).length > 0;
}

function shouldUseFirstTicketBonus(record, details = {}) {
  if (details.doubleOrNothing && details.doubleOrNothing.active === true) return false;
  return !hasPlayedAnyTicket(record);
}

async function issueTicket(user, details = {}) {
  let existingRaw = await getUserRecord(user.id);
  if (!existingRaw || !existingRaw.userId) throw new Error(`User [${user.id}] was not found. Save/check your key first.`);
  let existing = prepareLedgerRecord(existingRaw);
  const withdrawalRecovery = recoverPreviousWithdrawal(existing, details);
  existing = withdrawalRecovery.record;
  const recovery = recoverPreviousCompletedTicket(existing, details);
  existing = recovery.record;
  const ticketCost = int(details.ticketCost, 0);
  const clientExpectedBalance = int(details.clientExpectedBalance ?? details.clientBalance ?? 0, 0);

  // Netlify Blobs can be a little stale immediately after a ticket win.
  // If the browser just received a higher confirmed server balance, wait briefly
  // for the stored record to catch up before selling the next ticket. This keeps
  // the next buy from overwriting/ignoring the just-finished win.
  if (clientExpectedBalance > getRecordBalance(existing)) {
    for (let attempt = 0; attempt < 20 && clientExpectedBalance > getRecordBalance(existing); attempt++) {
      await sleep(250);
      const retryRaw = await getUserRecord(user.id);
      if (retryRaw && retryRaw.userId) existing = prepareLedgerRecord(retryRaw);
    }
  }
  if (!VALID_TICKET_COSTS.includes(ticketCost)) throw new Error("Invalid ticket price. Use 1,000, 5,000, 10,000, or 25,000 Tickets.");

  const ticketId = String(details.ticketId || `${existing.userId}-ticket-${Date.now()}`).replace(/[^0-9A-Za-z_-]/g, "").slice(0, 100);
  if (!ticketId) throw new Error("Missing ticket ID.");

  // Idempotency for the exact same browser buy request.
  // If the browser retries the same ticketId, return the same ticket.
  const previousBet = findRecentBetByTicketId(existing, ticketId);
  if (previousBet) return { record: existing, ticket: ticketFromBet(previousBet), duplicate: true, completed: true };

  const activeTickets = getOpenActiveTickets(existing);
  if (activeTickets[ticketId]) return { record: existing, ticket: activeTickets[ticketId], duplicate: true, activeExists: true };

  const existingActiveTicket = Object.values(activeTickets)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))[0] || null;
  if (existingActiveTicket) {
    return { record: existing, ticket: existingActiveTicket, duplicate: true, activeExists: true };
  }

  // If another tab/page already has an unrevealed active ticket, the server returns
  // that existing ticket instead of selling a new one. This keeps one active ticket
  // per user across multiple pages and prevents double-spending/different reveals.
  const balanceBefore = getRecordBalance(existing);
  if (balanceBefore < ticketCost) {
    if (clientExpectedBalance >= ticketCost && clientExpectedBalance > balanceBefore) {
      throw new Error(`Balance is still syncing on the server. It sees ${formatTickets(balanceBefore)}, but your latest confirmed balance was ${formatTickets(clientExpectedBalance)}. Try again in a second.`);
    }
    throw new Error(`Server balance is only ${formatTickets(balanceBefore)}, not enough for a ${formatTickets(ticketCost)} ticket.`);
  }

  const at = nowIso();
  const doubleOrNothing = getDoubleOrNothingRequest(existing, details, ticketCost);
  const useFirstTicketBonus = shouldUseFirstTicketBonus(existing, details);
  const resolvedOdds = useFirstTicketBonus
    ? { profile: sanitizeOddsProfile(FIRST_TICKET_ODDS_PROFILE, DEFAULT_ODDS_PROFILE), source: "first_bonus" }
    : (doubleOrNothing?.firstGameBonusRisk
      ? { profile: sanitizeOddsProfile(FIRST_DOUBLE_LOSS_ODDS_PROFILE, DEFAULT_ODDS_PROFILE), source: "first_double_loss" }
      : await getResolvedOddsForUser(existing.userId));
  const prizes = makeServerTicketNumbers(ticketCost, resolvedOdds.profile);
  const winAmount = countTicketWin(prizes);
  const payload = { v: 5, userId: String(existing.userId), ticketId, ticketCost, prizes, winAmount, doubleOrNothing, oddsName: resolvedOdds.profile.name, oddsSource: resolvedOdds.source, oddsRtp: resolvedOdds.profile.stats?.rtp, createdAt: at, balanceBefore };
  const ticketToken = signTicketPayload(payload);

  const debitResult = addLedgerEntry(existing, makeLedgerEntry({
    id: `ticket-buy:${ticketId}`,
    type: "ticket_buy",
    delta: -ticketCost,
    amount: ticketCost,
    at,
    ticketId,
    reason: `Bought ${formatTickets(ticketCost)} ticket`
  }));
  const afterDebit = debitResult.record;
  const balanceAfterCost = getRecordBalance(afterDebit);

  const ticket = sanitizeActiveTicket({
    ...payload,
    ticketToken,
    status: "active",
    balanceBefore,
    balanceAfterCost,
    balanceAfter: balanceAfterCost
  });

  // Keep only this active ticket. This clears stale old active-ticket blockers.
  const record = sanitizeRecord({
    ...afterDebit,
    name: user.name || afterDebit.name || "Unknown",
    lastBetAt: at,
    firstTicketBonusUsedAt: useFirstTicketBonus ? at : afterDebit.firstTicketBonusUsedAt || null,
    firstTicketBonusTicketId: useFirstTicketBonus ? ticketId : afterDebit.firstTicketBonusTicketId || null,
    totalWagered: int(afterDebit.totalWagered, 0) + (debitResult.added ? ticketCost : 0),
    issuedTicketIds: [...new Set([...(afterDebit.issuedTicketIds || []).map(String), ticketId])].slice(-MAX_TICKET_IDS),
    activeTickets: { [ticketId]: ticket },
    currentBalance: balanceAfterCost,
    recentEvents: addEvent(afterDebit.recentEvents || [], {
      type: "ticket_issued",
      ticketId,
      at,
      ticketCost,
      balanceBefore,
      balanceAfter: balanceAfterCost,
      oddsName: resolvedOdds.profile.name,
      oddsSource: resolvedOdds.source,
      oddsRtp: resolvedOdds.profile.stats?.rtp,
      message: useFirstTicketBonus
        ? `${afterDebit.name || user.name || "Unknown"} [${afterDebit.userId}] bought their first ticket with the guaranteed starter win active. Balance: ${balanceBefore} → ${balanceAfterCost}.`
        : (doubleOrNothing
          ? (doubleOrNothing.firstGameBonusRisk
            ? `${afterDebit.name || user.name || "Unknown"} [${afterDebit.userId}] bought a Double or Nothing ${ticketCost} Ticket from their starter win. It is locked to miss. Balance: ${balanceBefore} → ${balanceAfterCost}.`
            : `${afterDebit.name || user.name || "Unknown"} [${afterDebit.userId}] bought a Double or Nothing ${ticketCost} Ticket. Balance: ${balanceBefore} → ${balanceAfterCost}.`)
          : `${afterDebit.name || user.name || "Unknown"} [${afterDebit.userId}] bought a ${ticketCost} Ticket. Balance: ${balanceBefore} → ${balanceAfterCost}.`)
    })
  });
  const savedRecord = await saveUserRecord(record);
  const savedBalance = getRecordBalance(savedRecord);
  return { record: savedRecord, ticket: sanitizeActiveTicket({ ...ticket, balanceAfterCost: savedBalance, balanceAfter: savedBalance }), recoveredPrevious: !!recovery.recovered };
}

async function completeTicket(user, details = {}) {
  const existingRaw = await getUserRecord(user.id);
  if (!existingRaw || !existingRaw.userId) throw new Error(`User [${user.id}] was not found. Save/check your key first.`);
  let existing = recoverPreviousWithdrawal(prepareLedgerRecord(existingRaw), details).record;
  const ticketId = String(details.ticketId || "").replace(/[^0-9A-Za-z_-]/g, "").slice(0, 100);
  if (!ticketId) throw new Error("Missing ticket ID.");

  // Idempotent reveal/finalize: if this ticket is already in bet history,
  // return the same result without changing balance.
  const previousBet = findRecentBetByTicketId(existing, ticketId);
  if (previousBet) return { record: existing, ticket: ticketFromBet(previousBet), bet: previousBet, duplicate: true };

  const activeTickets = getOpenActiveTickets(existing);
  let ticket = activeTickets[ticketId] || null;
  let tokenPayload = null;

  if (!ticket) {
    tokenPayload = verifyTicketToken(details.ticketToken || details.token || "");
    if (!tokenPayload || String(tokenPayload.userId) !== String(existing.userId) || String(tokenPayload.ticketId) !== ticketId) {
      throw new Error("That ticket was not found or its token is invalid. Buy a new ticket after syncing your balance.");
    }
    ticket = sanitizeActiveTicket({
      ticketId: tokenPayload.ticketId,
      ticketToken: String(details.ticketToken || details.token || ""),
      createdAt: tokenPayload.createdAt,
      ticketCost: tokenPayload.ticketCost,
      prizes: tokenPayload.prizes,
      status: "active",
      winAmount: tokenPayload.winAmount,
      doubleOrNothing: tokenPayload.doubleOrNothing || null,
      balanceBefore: tokenPayload.balanceBefore || 0,
      balanceAfterCost: Math.max(0, int(tokenPayload.balanceBefore, 0) - int(tokenPayload.ticketCost, 0))
    });
  }

  const at = nowIso();
  const baseWinAmount = countTicketWin(ticket.prizes);
  const doubleOrNothing = sanitizeDoubleOrNothing(ticket.doubleOrNothing);
  const doubleBonus = baseWinAmount > 0 && doubleOrNothing ? doubleOrNothing.previousWinAmount + baseWinAmount : 0; // Adds previous win again + next win again, so both are doubled.
  const doubleLossAmount = baseWinAmount <= 0 && doubleOrNothing ? doubleOrNothing.previousWinAmount : 0;
  const winAmount = baseWinAmount + doubleBonus;
  const buyEntryId = `ticket-buy:${ticketId}`;
  const winEntryId = `ticket-win:${ticketId}`;
  const doubleEntryId = `ticket-double-bonus:${ticketId}`;
  const doubleLossEntryId = `ticket-double-loss:${ticketId}`;

  // Make finalize safe even if a previous buy save was briefly invisible.
  const ledgerEntries = [];
  if (!ledgerEntryIdExists(existing, buyEntryId)) {
    ledgerEntries.push(makeLedgerEntry({
      id: buyEntryId,
      type: "ticket_buy",
      delta: -ticket.ticketCost,
      amount: ticket.ticketCost,
      at: ticket.createdAt || at,
      ticketId,
      reason: doubleOrNothing ? `Bought Double or Nothing ${formatTickets(ticket.ticketCost)} ticket` : `Bought ${ticket.ticketCost} Ticket`
    }));
  }
  if (baseWinAmount > 0 && !ledgerEntryIdExists(existing, winEntryId)) {
    ledgerEntries.push(makeLedgerEntry({
      id: winEntryId,
      type: "ticket_win",
      delta: baseWinAmount,
      amount: baseWinAmount,
      at,
      ticketId,
      reason: `Won ${formatTickets(baseWinAmount)} on ticket`
    }));
  }
  if (doubleBonus > 0 && !ledgerEntryIdExists(existing, doubleEntryId)) {
    ledgerEntries.push(makeLedgerEntry({
      id: doubleEntryId,
      type: "ticket_double_bonus",
      delta: doubleBonus,
      amount: doubleBonus,
      at,
      ticketId,
      reason: `Double or Nothing bonus doubles previous win ${doubleOrNothing.previousWinAmount} and next win ${baseWinAmount}`
    }));
  }

  if (doubleLossAmount > 0 && !ledgerEntryIdExists(existing, doubleLossEntryId)) {
    ledgerEntries.push(makeLedgerEntry({
      id: doubleLossEntryId,
      type: "ticket_double_loss",
      delta: -doubleLossAmount,
      amount: doubleLossAmount,
      at,
      ticketId,
      reason: `Double or Nothing lost original win ${formatTickets(doubleLossAmount)}`
    }));
  }

  const balanceAfterCost = Number.isFinite(Number(ticket.balanceAfterCost))
    ? int(ticket.balanceAfterCost, 0)
    : Math.max(0, int(ticket.balanceBefore, getRecordBalance(existing)) - int(ticket.ticketCost, 0));

  const ledgerResult = addManyLedgerEntries(existing, ledgerEntries);
  const afterLedger = ledgerResult.record;
  const balanceAfter = getRecordBalance(afterLedger);

  const didAddBuy = ledgerEntries.some((entry) => entry.id === buyEntryId) && ledgerResult.added.some((entry) => entry.id === buyEntryId);
  const didAddWin = ledgerEntries.some((entry) => entry.id === winEntryId) && ledgerResult.added.some((entry) => entry.id === winEntryId);
  const didAddDouble = ledgerEntries.some((entry) => entry.id === doubleEntryId) && ledgerResult.added.some((entry) => entry.id === doubleEntryId);
  const didAddDoubleLoss = ledgerEntries.some((entry) => entry.id === doubleLossEntryId) && ledgerResult.added.some((entry) => entry.id === doubleLossEntryId);

  const bet = sanitizeBet({
    type: "bet",
    ticketId: ticket.ticketId,
    ticketToken: ticket.ticketToken,
    createdAt: ticket.createdAt,
    at,
    ticketCost: ticket.ticketCost,
    baseWinAmount,
    doubleBonus,
    doubleLossAmount,
    doubleOrNothing,
    oddsName: ticket.oddsName || null,
    oddsSource: ticket.oddsSource || null,
    oddsRtp: ticket.oddsRtp || null,
    winAmount,
    net: winAmount - ticket.ticketCost - doubleLossAmount,
    outcome: winAmount > 0 ? "win" : "loss",
    balanceBefore: balanceAfterCost,
    balanceAfter,
    prizes: ticket.prizes
  });

  // Clear ALL active tickets on completion. This removes stale active ticket blockers.
  const record = sanitizeRecord({
    ...afterLedger,
    name: user.name || afterLedger.name || "Unknown",
    lastBetAt: at,
    betCount: int(afterLedger.betCount, 0) + 1,
    totalWagered: int(afterLedger.totalWagered, 0) + (didAddBuy ? ticket.ticketCost : 0),
    totalWon: int(afterLedger.totalWon, 0) + (didAddWin ? baseWinAmount : 0) + (didAddDouble ? doubleBonus : 0),
    netProfit: toNumber(afterLedger.netProfit, 0) + (winAmount - ticket.ticketCost - (didAddDoubleLoss ? doubleLossAmount : 0)),
    currentBalance: balanceAfter,
    activeTickets: {},
    issuedTicketIds: [...new Set([...(afterLedger.issuedTicketIds || []).map(String), ticketId])].slice(-MAX_TICKET_IDS),
    completedTicketIds: [...new Set([...(afterLedger.completedTicketIds || []).map(String), ticketId])].slice(-MAX_TICKET_IDS),
    recentBets: addBet(afterLedger.recentBets || [], bet),
    recentEvents: addEvent(afterLedger.recentEvents || [], {
      ...bet,
      type: "bet",
      message: winAmount > 0
        ? (doubleBonus > 0
          ? `${afterLedger.name || user.name || "Unknown"} [${afterLedger.userId}] hit Double or Nothing on a ${ticket.ticketCost} Ticket. Card win ${baseWinAmount}, bonus ${doubleBonus}. Balance: ${balanceAfterCost} → ${balanceAfter}.`
          : `${afterLedger.name || user.name || "Unknown"} [${afterLedger.userId}] completed a ${ticket.ticketCost} Ticket and won ${winAmount} Tickets. Balance: ${balanceAfterCost} → ${balanceAfter}.`)
        : (doubleLossAmount > 0
          ? `${afterLedger.name || user.name || "Unknown"} [${afterLedger.userId}] lost Double or Nothing on a ${ticket.ticketCost} Ticket and forfeited original win ${doubleLossAmount}. Balance: ${balanceAfter} Tickets.`
          : `${afterLedger.name || user.name || "Unknown"} [${afterLedger.userId}] completed a ${ticket.ticketCost} Ticket and lost. Balance: ${balanceAfter} Tickets.`)
    })
  });
  const savedRecord = await saveUserRecord(record);
  const savedBalance = getRecordBalance(savedRecord);
  const savedBet = sanitizeBet({ ...bet, balanceAfter: savedBalance });
  return { record: savedRecord, ticket: ticketFromBet(savedBet), bet: savedBet };
}

async function recordBet(user, details = {}) {
  // Legacy endpoint: record a full bet in one step. Kept for compatibility.
  const existingRaw = await getUserRecord(user.id);
  if (!existingRaw || !existingRaw.userId) throw new Error(`User [${user.id}] was not found. Save/check your key first.`);
  let existing = prepareLedgerRecord(existingRaw);
  const at = nowIso();
  const ticketCost = int(details.ticketCost, 0);
  const winAmount = int(details.winAmount, 0);
  if (ticketCost <= 0) throw new Error("Invalid ticket cost.");
  const balanceBefore = getRecordBalance(existing);
  if (balanceBefore < ticketCost) throw new Error(`Server balance is only ${formatTickets(balanceBefore)}, not enough to record a ${formatTickets(ticketCost)} bet.`);
  const ticketId = String(details.ticketId || `${user.id}-${Date.now()}`).slice(0, 80);
  const prizes = Array.isArray(details.prizes) ? details.prizes.map((v) => int(v, 0)).slice(0, 12) : [];

  let afterLedger = addManyLedgerEntries(existing, [
    makeLedgerEntry({ id: `ticket-buy:${ticketId}`, type: "ticket_buy", delta: -ticketCost, amount: ticketCost, at, ticketId }),
    ...(winAmount > 0 ? [makeLedgerEntry({ id: `ticket-win:${ticketId}`, type: "ticket_win", delta: winAmount, amount: winAmount, at, ticketId })] : [])
  ]).record;
  const balanceAfter = getRecordBalance(afterLedger);

  const bet = sanitizeBet({ type: "bet", ticketId, at, ticketCost, winAmount, net: winAmount - ticketCost, balanceBefore, balanceAfter, prizes });
  const record = sanitizeRecord({
    ...afterLedger,
    name: user.name || afterLedger.name || "Unknown",
    lastBetAt: at,
    betCount: int(afterLedger.betCount, 0) + 1,
    totalWagered: int(afterLedger.totalWagered, 0) + ticketCost,
    totalWon: int(afterLedger.totalWon, 0) + winAmount,
    recentBets: addBet(afterLedger.recentBets || [], bet),
    recentEvents: addEvent(afterLedger.recentEvents || [], { ...bet, message: `${afterLedger.name || user.name || "Unknown"} [${afterLedger.userId}] bet ${ticketCost} and won ${winAmount}. Balance: ${balanceBefore} → ${balanceAfter}.` })
  });
  const savedRecord = await saveUserRecord(record);
  return { record: savedRecord, bet };
}

async function recordAdminAdjustment(userId, details = {}) {
  const existingRaw = await getUserRecord(userId);
  if (!existingRaw || !existingRaw.userId) throw new Error(`User [${userId}] was not found.`);
  let existing = prepareLedgerRecord(existingRaw);
  const at = nowIso();
  const action = String(details.action || "increase").toLowerCase() === "decrease" ? "decrease" : "increase";
  const amount = int(details.amount, 0);
  const reason = String(details.reason || "Admin adjustment").slice(0, 240);
  if (amount <= 0) throw new Error("Adjustment amount must be at least 1 Ticket.");
  const balanceBefore = getRecordBalance(existing);
  const delta = action === "decrease" ? -amount : amount;
  if (balanceBefore + delta < 0) throw new Error(`Cannot decrease ${formatTickets(amount)} because ${existing.name || "that user"} only has ${formatTickets(balanceBefore)}.`);
  const adjustmentId = String(details.adjustmentId || `${existing.userId}-adjust-${Date.now()}`).slice(0, 100);

  const ledgerResult = addLedgerEntry(existing, makeLedgerEntry({
    id: `admin-adjust:${adjustmentId}`,
    type: "admin_adjustment",
    delta,
    amount,
    at,
    reason
  }));
  const afterLedger = ledgerResult.record;
  const balanceAfter = getRecordBalance(afterLedger);

  const adjustment = sanitizeAdjustment({
    type: "admin_adjustment",
    adjustmentId,
    at,
    action,
    amount,
    delta,
    reason,
    adminLabel: String(details.adminLabel || "admin").slice(0, 80),
    balanceBefore,
    balanceAfter
  });
  const record = sanitizeRecord({
    ...afterLedger,
    lastAdminAdjustmentAt: at,
    adminAdjustmentCount: int(afterLedger.adminAdjustmentCount, 0) + 1,
    totalAdminAdded: int(afterLedger.totalAdminAdded, 0) + (delta > 0 ? amount : 0),
    totalAdminRemoved: int(afterLedger.totalAdminRemoved, 0) + (delta < 0 ? amount : 0),
    recentAdjustments: addAdjustment(afterLedger.recentAdjustments || [], adjustment),
    recentEvents: addEvent(afterLedger.recentEvents || [], { ...adjustment, message: delta > 0 ? `Admin added ${amount} Tickets to ${existing.name} [${existing.userId}]. Balance: ${balanceBefore} → ${balanceAfter}. Reason: ${reason}` : `Admin removed ${amount} Tickets from ${existing.name} [${existing.userId}]. Balance: ${balanceBefore} → ${balanceAfter}. Reason: ${reason}` })
  });
  const savedRecord = await saveUserRecord(record);
  const savedBalance = getRecordBalance(savedRecord);
  const savedAdjustment = sanitizeAdjustment({ ...adjustment, balanceAfter: savedBalance });
  return { record: savedRecord, adjustment: savedAdjustment };
}

async function recordWithdrawal(user, details = {}) {
  const existingRaw = await getUserRecord(user.id);
  if (!existingRaw || !existingRaw.userId) throw new Error(`User [${user.id}] was not found. Save/check your key first.`);
  let existing = recoverPreviousWithdrawal(prepareLedgerRecord(existingRaw), details).record;

  const activeTickets = getOpenActiveTickets(existing);
  if (Object.keys(activeTickets).length > 0) {
    throw new Error("Reveal your current ticket before requesting a withdrawal.");
  }
  if (existing.activeRunnerGame && existing.activeRunnerGame.status === "active") {
    throw new Error("Cash out or finish your Street Runner game before requesting a withdrawal.");
  }

  const at = nowIso();
  const amount = int(details.amount, 0);
  if (amount <= 0) throw new Error("Withdrawal amount must be at least 1,000 Tickets.");
  if (amount % TICKETS_PER_XAN !== 0) throw new Error("Withdrawals must be in 1,000 Ticket increments.");
  const balanceBefore = getRecordBalance(existing);
  if (balanceBefore < amount) throw new Error(`Server balance is only ${formatTickets(balanceBefore)}, so you cannot withdraw ${formatTickets(amount)}.`);
  const withdrawalId = String(details.withdrawalId || `${existing.userId}-withdraw-${Date.now()}`).slice(0, 100);
  const existingWithdrawal = Array.isArray(existing.recentWithdrawals) ? existing.recentWithdrawals.find((w) => String(w.withdrawalId || "") === withdrawalId) : null;
  if (existingWithdrawal) return { record: existing, withdrawal: sanitizeWithdrawal(existingWithdrawal), duplicate: true };

  const ledgerResult = addLedgerEntry(existing, makeLedgerEntry({
    id: `withdraw:${withdrawalId}`,
    type: "withdrawal",
    delta: -amount,
    amount,
    at,
    reason: "User withdrawal request"
  }));
  const afterLedger = ledgerResult.record;
  const balanceAfter = getRecordBalance(afterLedger);

  const withdrawal = sanitizeWithdrawal({ type: "withdrawal", withdrawalId, at, amount, status: "pending", note: String(details.note || "User withdrawal request").slice(0, 240), balanceBefore, balanceAfter });
  const record = sanitizeRecord({
    ...afterLedger,
    name: user.name || afterLedger.name || "Unknown",
    lastWithdrawalAt: at,
    withdrawalCount: int(afterLedger.withdrawalCount, 0) + 1,
    totalWithdrawRequested: int(afterLedger.totalWithdrawRequested, 0) + amount,
    recentWithdrawals: addWithdrawal(afterLedger.recentWithdrawals || [], withdrawal),
    recentEvents: addEvent(afterLedger.recentEvents || [], { ...withdrawal, message: `${afterLedger.name || user.name || "Unknown"} [${afterLedger.userId}] requested a withdrawal of ${amount} Tickets. Balance: ${balanceBefore} → ${balanceAfter}.` })
  });
  const savedRecord = await saveUserRecord(record);
  const savedBalance = getRecordBalance(savedRecord);
  const savedWithdrawal = sanitizeWithdrawal({ ...withdrawal, balanceAfter: savedBalance });
  return { record: savedRecord, withdrawal: savedWithdrawal };
}

function addEvent(events, event) { return [...(Array.isArray(events) ? events : []), event].slice(-MAX_EVENTS); }
function addBet(bets, bet) { return [...(Array.isArray(bets) ? bets : []), bet].slice(-MAX_BETS); }
function addAdjustment(adjustments, adjustment) { return [...(Array.isArray(adjustments) ? adjustments : []), adjustment].slice(-MAX_ADJUSTMENTS); }
function addWithdrawal(withdrawals, withdrawal) { return [...(Array.isArray(withdrawals) ? withdrawals : []), withdrawal].slice(-MAX_WITHDRAWALS); }

function fishingSpeciesKey(value) {
  return String(value || "fish").toLowerCase().replace(/^(golden|albino|midnight|crystal|emerald)\s+/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "fish";
}
function sanitizeFishingLogbook(value) {
  const raw = value && typeof value === "object" ? value : {};
  const speciesRaw = raw.species && typeof raw.species === "object" ? raw.species : {};
  const species = {};
  for (const [key, entryRaw] of Object.entries(speciesRaw).slice(0, 80)) {
    const entry = entryRaw && typeof entryRaw === "object" ? entryRaw : {};
    const cleanKey = fishingSpeciesKey(key || entry.name);
    const bestSize = Number(entry.bestSize || 0);
    species[cleanKey] = {
      name: String(entry.name || key || "Fish").slice(0, 100),
      bestSize: Number.isFinite(bestSize) && bestSize > 0 ? Number(bestSize.toFixed(2)) : 0,
      count: Math.max(0, int(entry.count, 0)),
      rareCount: Math.max(0, int(entry.rareCount, 0)),
      bestVariant: String(entry.bestVariant || "standard").slice(0, 40),
      caughtAt: entry.caughtAt || null
    };
  }
  return {
    species,
    totalCaught: Math.max(0, int(raw.totalCaught, 0)),
    totalWins: Math.max(0, int(raw.totalWins, 0)),
    rareCaught: Math.max(0, int(raw.rareCaught, 0))
  };
}
function mergeFishingLogbooks(aRaw, bRaw) {
  const a = sanitizeFishingLogbook(aRaw), b = sanitizeFishingLogbook(bRaw);
  const species = { ...a.species };
  for (const [key, incoming] of Object.entries(b.species)) {
    const prior = species[key];
    if (!prior) species[key] = incoming;
    else species[key] = {
      ...(Number(incoming.bestSize || 0) >= Number(prior.bestSize || 0) ? prior : incoming),
      ...(Number(incoming.bestSize || 0) >= Number(prior.bestSize || 0) ? incoming : prior),
      count: Math.max(Number(prior.count || 0), Number(incoming.count || 0)),
      rareCount: Math.max(Number(prior.rareCount || 0), Number(incoming.rareCount || 0))
    };
  }
  return sanitizeFishingLogbook({
    species,
    totalCaught: Math.max(a.totalCaught, b.totalCaught),
    totalWins: Math.max(a.totalWins, b.totalWins),
    rareCaught: Math.max(a.rareCaught, b.rareCaught)
  });
}

function sanitizeFishingRecord(value) {
  const record = value && typeof value === "object" ? value : {};
  const size = Number(record.size || 0);
  return {
    size: Number.isFinite(size) && size > 0 ? Number(size.toFixed(2)) : 0,
    name: String(record.name || "").slice(0, 100),
    gameId: String(record.gameId || "").slice(0, 120),
    caughtAt: record.caughtAt || null,
    previousSize: Number.isFinite(Number(record.previousSize)) ? Number(Number(record.previousSize).toFixed(2)) : 0,
    wasNewRecord: Boolean(record.wasNewRecord)
  };
}

function sanitizeRecord(record) {
  record = migrateRecordToTickets(record || {});
  const totalWagered = int(record.totalWagered, 0);
  const totalWon = int(record.totalWon, 0);
  const sanitized = {
    userId: String(record.userId || "unknown"),
    name: String(record.name || "Unknown").slice(0, 80),
    linkedTornUsers: mergeLinkedTornUsers(record.linkedTornUsers, []),
    firstConnectedAt: record.firstConnectedAt || null,
    lastConnectedAt: record.lastConnectedAt || null,
    lastCheckedAt: record.lastCheckedAt || null,
    lastBetAt: record.lastBetAt || null,
    lastAdminAdjustmentAt: record.lastAdminAdjustmentAt || null,
    lastWithdrawalAt: record.lastWithdrawalAt || null,
    firstTicketBonusUsedAt: record.firstTicketBonusUsedAt || null,
    firstTicketBonusTicketId: record.firstTicketBonusTicketId ? String(record.firstTicketBonusTicketId).slice(0, 100) : null,
    ledgerStartedAt: record.ledgerStartedAt || null,
    connectCount: int(record.connectCount, 0),
    checkCount: int(record.checkCount, 0),
    betCount: int(record.betCount, 0),
    adminAdjustmentCount: int(record.adminAdjustmentCount, 0),
    withdrawalCount: int(record.withdrawalCount, 0),
    balanceUnit: BALANCE_UNIT,
    ticketsPerXan: TICKETS_PER_XAN,
    migratedToTicketsAt: record.migratedToTicketsAt || null,
    balanceBaseline: int(record.balanceBaseline, 0),
    totalXansDetected: int(record.totalXansDetected, 0),
    totalTicketsDeposited: int(record.totalTicketsDeposited, ticketsFromXans(record.totalXansDetected || 0)),
    totalWagered,
    totalWon,
    totalAdminAdded: int(record.totalAdminAdded, 0),
    totalAdminRemoved: int(record.totalAdminRemoved, 0),
    totalWithdrawRequested: int(record.totalWithdrawRequested, 0),
    netProfit: Math.floor(toNumber(record.netProfit, totalWon - totalWagered)),
    claimedLogIds: Array.isArray(record.claimedLogIds) ? record.claimedLogIds.map(String).slice(-MAX_CLAIMED_LOG_IDS) : [],
    issuedTicketIds: Array.isArray(record.issuedTicketIds) ? record.issuedTicketIds.map(String).slice(-MAX_TICKET_IDS) : [],
    completedTicketIds: Array.isArray(record.completedTicketIds) ? record.completedTicketIds.map(String).slice(-MAX_TICKET_IDS) : [],
    financialLedger: Array.isArray(record.financialLedger) ? record.financialLedger.map(sanitizeLedgerEntry).slice(-MAX_LEDGER) : [],
    recentBets: Array.isArray(record.recentBets) ? record.recentBets.map(sanitizeBet).slice(-MAX_BETS) : [],
    recentAdjustments: Array.isArray(record.recentAdjustments) ? record.recentAdjustments.map(sanitizeAdjustment).slice(-MAX_ADJUSTMENTS) : [],
    recentWithdrawals: Array.isArray(record.recentWithdrawals) ? record.recentWithdrawals.map(sanitizeWithdrawal).slice(-MAX_WITHDRAWALS) : [],
    activeTickets: sanitizeActiveTickets(record.activeTickets),
    activeRunnerGame: sanitizeRunnerGame(record.activeRunnerGame),
    recentRunnerGames: Array.isArray(record.recentRunnerGames) ? record.recentRunnerGames.map(sanitizeRunnerGame).filter(Boolean).slice(-80) : [],
    fishingRecord: sanitizeFishingRecord(record.fishingRecord),
    fishingLogbook: sanitizeFishingLogbook(record.fishingLogbook),
    fishingLogbookLastGameId: String(record.fishingLogbookLastGameId || "").slice(0, 120),
    recentEvents: Array.isArray(record.recentEvents) ? record.recentEvents.slice(-MAX_EVENTS) : []
  };
  sanitized.currentBalance = calculateLedgerBalance(sanitized);
  return sanitized;
}

function sanitizeBet(bet) {
  const ticketCost = int(bet.ticketCost, 0);
  const winAmount = int(bet.winAmount, 0);
  const baseWinAmount = int(bet.baseWinAmount, winAmount);
  const doubleBonus = int(bet.doubleBonus, Math.max(0, winAmount - baseWinAmount));
  const doubleLossAmount = int(bet.doubleLossAmount, 0);
  return {
    type: "bet",
    ticketId: String(bet.ticketId || "").slice(0, 100),
    ticketToken: String(bet.ticketToken || "").slice(0, 2000),
    createdAt: bet.createdAt || null,
    at: bet.at || null,
    ticketCost,
    winAmount,
    baseWinAmount,
    doubleBonus,
    doubleLossAmount,
    doubleOrNothing: sanitizeDoubleOrNothing(bet.doubleOrNothing),
    oddsName: bet.oddsName ? String(bet.oddsName).slice(0, 100) : null,
    oddsSource: bet.oddsSource ? String(bet.oddsSource).slice(0, 20) : null,
    oddsRtp: Number.isFinite(Number(bet.oddsRtp)) ? Number(Number(bet.oddsRtp).toFixed(3)) : null,
    net: Math.floor(toNumber(bet.net, winAmount - ticketCost - doubleLossAmount)),
    outcome: winAmount > 0 ? "win" : "loss",
    balanceBefore: int(bet.balanceBefore, 0),
    balanceAfter: int(bet.balanceAfter, 0),
    prizes: Array.isArray(bet.prizes) ? bet.prizes.map((v) => int(v, 0)).slice(0, 12) : []
  };
}

function sanitizeAdjustment(adjustment) {
  const amount = int(adjustment.amount, 0);
  const action = String(adjustment.action || (Number(adjustment.delta) < 0 ? "decrease" : "increase")).toLowerCase() === "decrease" ? "decrease" : "increase";
  const delta = action === "decrease" ? -amount : amount;
  return { type: "admin_adjustment", adjustmentId: String(adjustment.adjustmentId || "").slice(0, 100), at: adjustment.at || null, action, amount, delta, reason: String(adjustment.reason || "").slice(0, 240), adminLabel: String(adjustment.adminLabel || "admin").slice(0, 80), balanceBefore: int(adjustment.balanceBefore, 0), balanceAfter: int(adjustment.balanceAfter, 0) };
}

function sanitizeWithdrawal(withdrawal) {
  const amount = int(withdrawal.amount, 0);
  const rawStatus = String(withdrawal.status || "pending").toLowerCase();
  const status = ["pending", "paid", "cancelled"].includes(rawStatus) ? rawStatus : "pending";
  return { type: "withdrawal", withdrawalId: String(withdrawal.withdrawalId || "").slice(0, 100), at: withdrawal.at || null, amount, status, note: String(withdrawal.note || "").slice(0, 240), balanceBefore: int(withdrawal.balanceBefore, 0), balanceAfter: int(withdrawal.balanceAfter, 0) };
}


// ---------------- Top-down Street Runner betting game ----------------
const RUNNER_VALID_WAGER_MIN = 1000;
const RUNNER_VALID_WAGER_MAX = 2500000;
const RUNNER_DEATHS = [
  { key: "dogs", title: "Wild Dogs", message: "A pack of stray dogs storms out of an alley and knocks the runner down." },
  { key: "dogs", title: "Loose Guard Dog", message: "Somebody forgot to lock the fence and their angry guard dog chose you as cardio." },
  { key: "dogs", title: "Tiny Dog, Big Problem", message: "A tiny dog with maximum confidence bites your ankle and ruins the whole escape." },
  { key: "dogs", title: "Poodle With Issues", message: "A poodle in a sweater decided today was personal." },

  { key: "gang", title: "Gang Ambush", message: "A gang blocks the street and jumps the runner at the corner." },
  { key: "gang", title: "Wrong Alley", message: "You cut through the wrong alley and every dude in matching jackets turned around at once." },
  { key: "gang", title: "Clown Debt Collected", message: "A clown you owe money to finally caught up to you!" },
  { key: "gang", title: "Bad Time To Sprint", message: "You sprinted directly through a street dice game and nobody appreciated the interruption." },
  { key: "gang", title: "Mascot Revenge", message: "A guy in a pizza mascot suit tackled you for reasons nobody fully understands." },

  { key: "manhole", title: "Open Manhole", message: "The runner cuts the corner too fast and drops through an open manhole." },
  { key: "manhole", title: "Sewer Shortcut Failed", message: "You found the sewer entrance. Unfortunately, it was vertical and very immediate." },
  { key: "manhole", title: "Suspicious Steam", message: "You followed a cloud of sewer steam and instantly regretted every decision that led here." },
  { key: "manhole", title: "City Infrastructure", message: "The sidewalk opened like a trapdoor. The city refuses to comment." },

  { key: "car", title: "Hit By A Car", message: "A speeding car blasts through the intersection and ends the run." },
  { key: "car", title: "No Turn Signal", message: "A beat-up sedan made the most illegal turn possible and clipped you clean off the road." },
  { key: "car", title: "Getaway Driver", message: "Somebody else's getaway driver used you as a speed bump." },
  { key: "car", title: "Taxi From Hell", message: "A taxi swerves out of nowhere like it had a personal grudge." },
  { key: "car", title: "Self-Driving Disaster", message: "A self-driving car saw one pedestrian and chose chaos." },
  { key: "car", title: "Shopping Cart Traffic", message: "A runaway shopping cart hit you with the confidence of a compact car." },

  { key: "criminals", title: "Cornered", message: "Criminals pour out from both sides and trap the runner in the street." },
  { key: "criminals", title: "Everybody Saw You", message: "Every sketchy person on the block somehow recognized you at the same time." },
  { key: "criminals", title: "Wrong Hat", message: "Someone accused you of wearing their lucky hat. You were not wearing a hat." },
  { key: "criminals", title: "Bad Apology", message: "You yelled sorry while sprinting away. They did not accept." },

  { key: "debris", title: "Collapsing Fire Escape", message: "A rusty fire escape breaks loose and crashes down into the path." },
  { key: "debris", title: "Bad Building Maintenance", message: "A loose air conditioner drops from a window and ends the sprint with terrible timing." },
  { key: "debris", title: "Mystery Brick", message: "A brick appears from above. Nobody knows why. Nobody is helping." },
  { key: "debris", title: "Falling Couch", message: "Somebody tried moving a couch through a third-floor window. You were the landing zone." },
  { key: "debris", title: "Satellite Dish", message: "A satellite dish finally gave up on cable and chose violence." },

  { key: "biker", title: "Biker Rush", message: "A biker tears through the alley and clips the runner hard." },
  { key: "biker", title: "Sidewalk Biker", message: "A biker decided traffic laws were optional and the sidewalk was a highway." },
  { key: "biker", title: "Scooter Menace", message: "A rental scooter with no rider still somehow found you." },
  { key: "biker", title: "Wheelie Mistake", message: "A biker popped a wheelie directly into your escape plan." },

  { key: "drone", title: "Police Drone", message: "A busted patrol drone sparks overhead and drops into the runner's path." },
  { key: "drone", title: "Drone Malfunction", message: "A cheap police drone mistook you for a wanted refrigerator and dive-bombed you." },
  { key: "drone", title: "Delivery Drone", message: "A delivery drone dropped soup on your head and the run never recovered." },
  { key: "drone", title: "Suspicious Buzzing", message: "You looked up at the buzzing noise. Rookie mistake." },

  { key: "trap", title: "Street Trap", message: "A hidden street trap snaps up from the cracked pavement." },
  { key: "trap", title: "Suspicious Pothole", message: "That pothole was not a pothole. It was a whole situation." },
  { key: "trap", title: "Banana Peel Classic", message: "You slipped on a banana peel like this was an old cartoon." },
  { key: "trap", title: "Wet Floor Sign", message: "You ignored the wet floor sign on the sidewalk. Somehow, it was right." },
  { key: "trap", title: "Invisible Rake", message: "A rake appeared exactly where a rake should never be." },

  { key: "shooter", title: "Warning Shot", message: "A rooftop criminal fires a warning shot and the runner goes down in the panic." },
  { key: "shooter", title: "Rooftop Menace", message: "Someone on a rooftop decides your run needed sound effects." },
  { key: "shooter", title: "Bottle Rocket Guy", message: "A guy with bottle rockets and zero supervision ruined your route." },
  { key: "shooter", title: "Confetti Cannon", message: "A party cannon went off at the worst possible time. Festive, but fatal to the run." },

  { key: "fire", title: "Dumpster Fire", message: "A burning dumpster tips over and blocks the escape route." },
  { key: "fire", title: "Hot Garbage", message: "You tried to run past a dumpster fire and learned the dumpster was faster." },
  { key: "fire", title: "Spicy Street Taco", message: "A street taco was so spicy your whole escape route became a medical event." },
  { key: "fire", title: "Birthday Candles", message: "A suspicious amount of birthday candles lit up in the alley. Nobody was celebrating you." },

  { key: "glass", title: "Broken Glass", message: "A shattered storefront sends glass across the sidewalk and ends the sprint." },
  { key: "glass", title: "Window Display Disaster", message: "A shop window explodes into the sidewalk like the city wanted one last cheap shot." },
  { key: "glass", title: "Mirror Maze", message: "You ran into a mirror someone left on the sidewalk and lost to your own reflection." },
  { key: "glass", title: "Fish Tank Incident", message: "A fish tank fell out of a window. The fish looked surprised too." },

  { key: "trap", title: "Bee Allergy", message: "You got stung by a bee. Guess you're allergic?" },
  { key: "fire", title: "Bomb Factory Pie", message: "A homeless guy gave you a pie that he got at the bomb factory." },
  { key: "trap", title: "Haunted Pigeon", message: "A pigeon made eye contact for too long and you forgot how to run." },
  { key: "dogs", title: "Possum Bluff", message: "A possum played dead so convincingly that you tripped while apologizing to it." },
  { key: "trap", title: "Loose Shoelace", message: "Your shoelace came undone at the exact moment confidence was highest." },
  { key: "debris", title: "Falling Piano", message: "A piano fell from above because apparently this street follows cartoon law." },
  { key: "car", title: "Ice Cream Truck", message: "An ice cream truck cut the corner too fast. The jingle kept playing." },
  { key: "gang", title: "Mime Trouble", message: "A mime trapped you in an invisible box. Honestly, embarrassing." },
  { key: "trap", title: "Suspicious Hot Dog", message: "You accepted a free hot dog from a man who whispered, 'good luck.' It was not good luck." },
  { key: "drone", title: "Wrong Package", message: "A drone delivered a bowling ball to your exact location." },
  { key: "debris", title: "Angry Mailbox", message: "A mailbox door snapped open and caught you right in the dramatic sprint pose." },
  { key: "glass", title: "Glitter Spill", message: "You slipped on a pile of glitter and became impossible to take seriously." },
  { key: "fire", title: "Toaster Cart", message: "A street vendor's toaster cart burst into flames and blocked the whole lane." },
  { key: "criminals", title: "Grandma's Purse", message: "An old lady swung a purse with professional accuracy." },
  { key: "trap", title: "Mystery Button", message: "You pressed a big red button on a wall. That one is on you." },
  { key: "biker", title: "Unicycle Man", message: "A man on a unicycle yelled 'watch this' and you should have watched from farther away." },
  { key: "debris", title: "Cursed Vending Machine", message: "A vending machine finally dropped the snack and then dropped itself." },
  { key: "dogs", title: "Dog Walker Disaster", message: "Six dogs went six directions and the leash math defeated you." },
  { key: "trap", title: "Fake Tunnel", message: "You ran into a painted tunnel on a wall. Classic mistake." },
  { key: "drone", title: "Robot Vacuum", message: "A robot vacuum escaped an apartment and chose the sidewalk as its hunting ground." },
  { key: "gang", title: "Street Magician", message: "A street magician asked you to pick a card. You picked the ambulance." },
  { key: "car", title: "Parking Meter", message: "You dodged the car but lost the argument with the parking meter." },
  { key: "fire", title: "Soup Volcano", message: "A soup cart erupted like a tiny volcano. The city inspector has questions." },
  { key: "trap", title: "Emotional Damage", message: "A stranger shouted 'you run weird' and your confidence instantly collapsed." }
];

function sanitizeRunnerGame(game = null) {
  if (!game || typeof game !== "object") return null;
  const gameId = String(game.gameId || "").replace(/[^0-9A-Za-z_-]/g, "").slice(0, 100);
  if (!gameId) return null;
  const statusRaw = String(game.status || "active").toLowerCase();
  const status = ["active", "lost", "cashed"].includes(statusRaw) ? statusRaw : "active";
  const wager = int(game.wager, 0);
  const multiplier = Math.max(1, Number(game.multiplier || 1));
  const steps = Math.max(0, int(game.steps, 0));
  const payout = int(game.payout, 0);
  return {
    gameId,
    status,
    wager,
    multiplier: Number(multiplier.toFixed(3)),
    steps,
    payout,
    startedAt: game.startedAt || null,
    updatedAt: game.updatedAt || null,
    endedAt: game.endedAt || null,
    lastDirection: game.lastDirection ? String(game.lastDirection).slice(0, 12) : null,
    lastChance: Number.isFinite(Number(game.lastChance)) ? Number(Number(game.lastChance).toFixed(3)) : null,
    death: game.death && typeof game.death === "object" ? {
      key: String(game.death.key || "").slice(0, 40),
      title: String(game.death.title || "Run Ended").slice(0, 80),
      message: String(game.death.message || "The run ended.").slice(0, 180)
    } : null,
    history: Array.isArray(game.history) ? game.history.slice(-80).map(item => ({
      step: int(item.step, 0),
      direction: String(item.direction || "").slice(0, 20),
      blocks: Math.max(1, Math.min(3, int(item.blocks, 1))),
      result: String(item.result || "").slice(0, 20),
      chance: Number.isFinite(Number(item.chance)) ? Number(Number(item.chance).toFixed(3)) : null,
      multiplier: Number.isFinite(Number(item.multiplier)) ? Number(Number(item.multiplier).toFixed(3)) : null,
      multiplierBefore: Number.isFinite(Number(item.multiplierBefore)) ? Number(Number(item.multiplierBefore).toFixed(3)) : null,
      multiplierGain: Number.isFinite(Number(item.multiplierGain)) ? Number(Number(item.multiplierGain).toFixed(3)) : null,
      multiplierAfter: Number.isFinite(Number(item.multiplierAfter)) ? Number(Number(item.multiplierAfter).toFixed(3)) : null,
      at: item.at || null
    })) : []
  };
}

function runnerBlockCount(value) {
  const raw = String(value ?? "1").toLowerCase().replace(/[^0-9]/g, "");
  const blocks = int(raw || value, 1);
  return Math.max(1, Math.min(3, blocks));
}

function runnerBlockPenalty(blocks, cfg) {
  if (blocks >= 3) return cfg.block3ChancePenalty;
  if (blocks >= 2) return cfg.block2ChancePenalty;
  return 0;
}

function runnerBlockBoost(blocks, cfg) {
  if (blocks >= 3) return cfg.block3MultiplierBoost;
  if (blocks >= 2) return cfg.block2MultiplierBoost;
  return 1;
}

function runnerGameWithChance(game, config) {
  const clean = sanitizeRunnerGame(game);
  if (!clean) return null;
  if (clean.status === "active") {
    clean.options = [1, 2, 3].map(blocks => runnerOptionStats(clean, config, blocks));
    clean.nextChance = clean.options[0]?.chance ?? runnerWinChance(clean, config, 1);
  }
  return clean;
}

function runnerSingleBlockChanceAt(state, cfg) {
  const raw = cfg.baseWinChance
    - (Math.max(0, int(state.steps, 0)) * cfg.chanceDropPerStep)
    - (Math.max(0, Number(state.multiplier || cfg.startMultiplier) - 1) * cfg.chanceDropPerMultiplier);
  return Math.max(cfg.minWinChance, Math.min(98, raw));
}

function runnerBaseNextMultiplier(game, config, blocks = 1) {
  const cfg = sanitizeGameOddsSettings({ runner: config }).runner;
  const cleanBlocks = runnerBlockCount(blocks);
  const startStep = Math.max(0, int(game.steps, 0));
  let nextMultiplier = Number(game.multiplier || cfg.startMultiplier);
  for (let i = 0; i < cleanBlocks; i += 1) {
    const stepGain = cfg.baseMultiplierIncrease * Math.pow(cfg.multiplierGrowth, startStep + i);
    nextMultiplier += stepGain;
  }
  return Number(Math.min(cfg.maxMultiplier, Math.max(cfg.startMultiplier, nextMultiplier)).toFixed(3));
}

function runnerWinChance(game, config, blocks = 1) {
  const cfg = sanitizeGameOddsSettings({ runner: config }).runner;
  const cleanBlocks = runnerBlockCount(blocks);
  const currentSteps = Math.max(0, int(game.steps, 0));
  const currentMultiplier = Number(game.multiplier || cfg.startMultiplier);

  // Fresh odds system:
  // - Success gets lower the farther you already are.
  // - Success gets lower as the multiplier gets higher.
  // - Choosing 2 or 3 blocks at once is riskier than taking them individually.
  const base = Math.max(5, Math.min(98, Number(cfg.baseWinChance || 82)));
  const distanceDrop = currentSteps * Math.max(0.2, Number(cfg.chanceDropPerStep || 2.1));
  const multiplierDrop = Math.max(0, currentMultiplier - cfg.startMultiplier) * Math.max(0.1, Number(cfg.chanceDropPerMultiplier || 1.25));
  const blockPenaltyMap = { 1: 0, 2: 18, 3: 36 };
  const bundledRisk = blockPenaltyMap[cleanBlocks] || 0;

  const adjusted = base - distanceDrop - multiplierDrop - bundledRisk;
  return Number(Math.max(cfg.minWinChance, Math.min(98, adjusted)).toFixed(3));
}

function runnerMultiplierGain(game, config, blocks = 1) {
  const cfg = sanitizeGameOddsSettings({ runner: config }).runner;
  const cleanBlocks = runnerBlockCount(blocks);
  const currentMultiplier = Number(game?.multiplier || cfg.startMultiplier || 1);
  const currentSteps = Math.max(0, int(game?.steps, 0));
  const maxMultiplier = Number(cfg.maxMultiplier || 50);

  // Progressive additive gains:
  // Base values keep 2/3 blocks better than taking single blocks individually.
  // Progress boost makes every button gain more the farther the player gets.
  const baseGains = { 1: 0.22, 2: 0.62, 3: 2.00 };
  const progressBoost = 1 + currentSteps * 0.14 + Math.max(0, currentMultiplier - 1) * 0.035;
  const rawGain = Number(baseGains[cleanBlocks] || baseGains[1]) * progressBoost;
  const cappedGain = Math.max(0, Math.min(rawGain, maxMultiplier - currentMultiplier));
  return Number(cappedGain.toFixed(3));
}

function runnerNextMultiplier(game, config, blocks = 1) {
  const cfg = sanitizeGameOddsSettings({ runner: config }).runner;
  const current = Number(game?.multiplier || cfg.startMultiplier || 1);
  const gain = runnerMultiplierGain(game, cfg, blocks);
  return Number(Math.min(Number(cfg.maxMultiplier || 50), Math.max(Number(cfg.startMultiplier || 1), current + gain)).toFixed(3));
}

function runnerOptionStats(game, config, blocks = 1) {
  const cfg = sanitizeGameOddsSettings({ runner: config }).runner;
  const cleanBlocks = runnerBlockCount(blocks);
  const currentMultiplier = Number(game?.multiplier || cfg.startMultiplier || 1);
  const multiplierGain = runnerMultiplierGain(game, cfg, cleanBlocks);
  const nextMultiplier = Number(Math.min(Number(cfg.maxMultiplier || 50), Math.max(Number(cfg.startMultiplier || 1), currentMultiplier + multiplierGain)).toFixed(3));
  return {
    blocks: cleanBlocks,
    chance: runnerWinChance(game, config, cleanBlocks),
    currentMultiplier: Number(currentMultiplier.toFixed(3)),
    multiplier: nextMultiplier,
    multiplierGain: Number(multiplierGain.toFixed(3))
  };
}

function randomRunnerDeath() {
  return RUNNER_DEATHS[Math.floor(Math.random() * RUNNER_DEATHS.length)] || RUNNER_DEATHS[0];
}

async function runnerGetGame(user) {
  const raw = await getUserRecord(user.id);
  if (!raw || !raw.userId) throw new Error(`User [${user.id}] was not found. Save/check your key first.`);
  const cfg = (await getGameOddsSettings()).runner;
  const record = prepareLedgerRecord(raw);
  return { record, game: runnerGameWithChance(record.activeRunnerGame, cfg), runnerOdds: cfg };
}

async function runnerStartGame(user, details = {}) {
  const existingRaw = await getUserRecord(user.id);
  if (!existingRaw || !existingRaw.userId) throw new Error(`User [${user.id}] was not found. Save/check your key first.`);
  let existing = recoverPreviousWithdrawal(prepareLedgerRecord(existingRaw), details).record;
  if (existing.activeRunnerGame && existing.activeRunnerGame.status === "active") {
    const cfg = (await getGameOddsSettings()).runner;
    return { record: existing, game: runnerGameWithChance(existing.activeRunnerGame, cfg), alreadyActive: true, runnerOdds: cfg };
  }
  const wager = int(details.wager, 0);
  if (wager < RUNNER_VALID_WAGER_MIN) throw new Error("Street Runner wager must be at least 1,000 Tickets.");
  if (wager > RUNNER_VALID_WAGER_MAX) throw new Error(`Street Runner wager cannot be more than ${formatTickets(RUNNER_VALID_WAGER_MAX)}.`);
  const balanceBefore = getRecordBalance(existing);
  if (balanceBefore < wager) throw new Error(`Server balance is only ${formatTickets(balanceBefore)}, not enough for a ${formatTickets(wager)} Street Runner bet.`);
  const cfg = (await getGameOddsSettings()).runner;
  const at = nowIso();
  const gameId = `runner-${cleanUserId(user.id)}-${Date.now()}-${crypto.randomBytes(5).toString("hex")}`.slice(0, 100);
  const ledgerResult = addLedgerEntry(existing, makeLedgerEntry({
    id: `runner:${gameId}:bet`,
    type: "runner_bet",
    delta: -wager,
    amount: wager,
    at,
    ticketId: gameId,
    reason: "Street Runner bet placed"
  }));
  const afterLedger = ledgerResult.record;
  const balanceAfter = getRecordBalance(afterLedger);
  const game = sanitizeRunnerGame({
    gameId,
    status: "active",
    wager,
    multiplier: cfg.startMultiplier,
    steps: 0,
    payout: 0,
    startedAt: at,
    updatedAt: at,
    history: []
  });
  const record = sanitizeRecord({
    ...afterLedger,
    name: user.name || afterLedger.name || "Unknown",
    activeRunnerGame: game,
    betCount: int(afterLedger.betCount, 0) + 1,
    totalWagered: int(afterLedger.totalWagered, 0) + wager,
    lastBetAt: at,
    recentEvents: addEvent(afterLedger.recentEvents || [], {
      type: "runner_start",
      at,
      gameId,
      wager,
      balanceBefore,
      balanceAfter,
      message: `${afterLedger.name || user.name || "Unknown"} [${afterLedger.userId}] started Street Runner for ${formatTickets(wager)}. Balance: ${formatTickets(balanceBefore)} → ${formatTickets(balanceAfter)}.`
    })
  });
  const savedRecord = await saveUserRecord(record);
  return { record: savedRecord, game: runnerGameWithChance(game, cfg), runnerOdds: cfg };
}

async function runnerChooseDirection(user, details = {}) {
  const existingRaw = await getUserRecord(user.id);
  if (!existingRaw || !existingRaw.userId) throw new Error(`User [${user.id}] was not found. Save/check your key first.`);
  let existing = recoverPreviousWithdrawal(prepareLedgerRecord(existingRaw), details).record;
  let game = sanitizeRunnerGame(existing.activeRunnerGame);
  if (!game || game.status !== "active") throw new Error("Start a Street Runner game first.");
  const blocks = runnerBlockCount(details.blocks ?? details.direction ?? 1);
  const direction = `${blocks} block${blocks === 1 ? "" : "s"}`;
  const cfg = (await getGameOddsSettings()).runner;
  const at = nowIso();
  const optionBeforeRoll = runnerOptionStats(game, cfg, blocks);
  const chance = optionBeforeRoll.chance;
  const currentMultiplier = Number(game.multiplier || cfg.startMultiplier);
  const multiplierGain = Number(optionBeforeRoll.multiplierGain || 0);
  const nextMultiplier = Number(Math.min(cfg.maxMultiplier, Math.max(cfg.startMultiplier, currentMultiplier + multiplierGain)).toFixed(3));
  const roll = Math.random() * 100;
  const won = roll < chance;
  const nextStepCount = Math.max(0, int(game.steps, 0)) + blocks;
  const historyItem = {
    step: nextStepCount,
    direction,
    blocks,
    chance,
    result: won ? "safe" : "lost",
    multiplier: currentMultiplier,
    multiplierBefore: currentMultiplier,
    multiplierGain,
    multiplierAfter: won ? nextMultiplier : currentMultiplier,
    at
  };

  if (won) {
    game = sanitizeRunnerGame({
      ...game,
      status: "active",
      steps: nextStepCount,
      multiplier: nextMultiplier,
      updatedAt: at,
      lastDirection: direction,
      lastChance: chance,
      history: [...(game.history || []), { ...historyItem, multiplier: nextMultiplier }]
    });
    const record = sanitizeRecord({
      ...existing,
      activeRunnerGame: game,
      recentEvents: addEvent(existing.recentEvents || [], {
        type: "runner_safe",
        at,
        gameId: game.gameId,
        direction,
        chance,
        multiplier: nextMultiplier,
        message: `${existing.name || user.name || "Unknown"} [${existing.userId}] survived ${blocks} Street Runner block${blocks === 1 ? "" : "s"}. Multiplier is now ${nextMultiplier}x.`
      })
    });
    const savedRecord = await saveUserRecord(record);
    return {
      record: savedRecord,
      game: runnerGameWithChance(game, cfg),
      result: "safe",
      chance,
      roll: Number(roll.toFixed(3)),
      previousMultiplier: currentMultiplier,
      multiplierGain,
      nextMultiplier
    };
  }

  const death = randomRunnerDeath();
  game = sanitizeRunnerGame({
    ...game,
    status: "lost",
    updatedAt: at,
    endedAt: at,
    lastDirection: direction,
    lastChance: chance,
    death,
    history: [...(game.history || []), historyItem]
  });
  const bet = sanitizeBet({
    type: "bet",
    ticketId: game.gameId,
    at,
    ticketCost: game.wager,
    winAmount: 0,
    net: -game.wager,
    balanceBefore: getRecordBalance(existing) + game.wager,
    balanceAfter: getRecordBalance(existing),
    prizes: []
  });
  const record = sanitizeRecord({
    ...existing,
    activeRunnerGame: null,
    recentRunnerGames: addEvent(existing.recentRunnerGames || [], game),
    recentBets: addBet(existing.recentBets || [], bet),
    recentEvents: addEvent(existing.recentEvents || [], {
      type: "runner_lost",
      at,
      gameId: game.gameId,
      direction,
      chance,
      death: death.key,
      balanceAfter: getRecordBalance(existing),
      message: `${existing.name || user.name || "Unknown"} [${existing.userId}] lost Street Runner after ${game.steps} safe turn(s): ${death.title}.`
    })
  });
  const savedRecord = await saveUserRecord(record);
  return {
    record: savedRecord,
    game,
    result: "lost",
    chance,
    roll: Number(roll.toFixed(3)),
    death,
    previousMultiplier: currentMultiplier,
    multiplierGain,
    nextMultiplier: currentMultiplier
  };
}

async function runnerCashOut(user, details = {}) {
  const existingRaw = await getUserRecord(user.id);
  if (!existingRaw || !existingRaw.userId) throw new Error(`User [${user.id}] was not found. Save/check your key first.`);
  let existing = recoverPreviousWithdrawal(prepareLedgerRecord(existingRaw), details).record;
  let game = sanitizeRunnerGame(existing.activeRunnerGame);
  if (!game || game.status !== "active") throw new Error("No active Street Runner game to cash out.");
  if (game.steps <= 0) throw new Error("Reach at least one new cross section before cashing out.");
  const at = nowIso();
  const payout = Math.max(0, Math.floor(game.wager * Number(game.multiplier || 1)));
  const balanceBefore = getRecordBalance(existing);
  const ledgerResult = addLedgerEntry(existing, makeLedgerEntry({
    id: `runner:${game.gameId}:cashout`,
    type: "runner_cashout",
    delta: payout,
    amount: payout,
    at,
    ticketId: game.gameId,
    reason: `Street Runner cashed out at ${game.multiplier}x`
  }));
  const afterLedger = ledgerResult.record;
  const balanceAfter = getRecordBalance(afterLedger);
  game = sanitizeRunnerGame({ ...game, status: "cashed", payout, updatedAt: at, endedAt: at });
  const bet = sanitizeBet({
    type: "bet",
    ticketId: game.gameId,
    at,
    ticketCost: game.wager,
    winAmount: payout,
    net: payout - game.wager,
    balanceBefore: balanceBefore + game.wager,
    balanceAfter,
    prizes: [payout]
  });
  const record = sanitizeRecord({
    ...afterLedger,
    name: user.name || afterLedger.name || "Unknown",
    activeRunnerGame: null,
    recentRunnerGames: addEvent(afterLedger.recentRunnerGames || [], game),
    recentBets: addBet(afterLedger.recentBets || [], bet),
    totalWon: int(afterLedger.totalWon, 0) + payout,
    recentEvents: addEvent(afterLedger.recentEvents || [], {
      type: "runner_cashout",
      at,
      gameId: game.gameId,
      payout,
      multiplier: game.multiplier,
      balanceBefore,
      balanceAfter,
      message: `${afterLedger.name || user.name || "Unknown"} [${afterLedger.userId}] cashed out Street Runner for ${formatTickets(payout)} at ${game.multiplier}x. Balance: ${formatTickets(balanceBefore)} → ${formatTickets(balanceAfter)}.`
    })
  });
  const savedRecord = await saveUserRecord(record);
  return { record: savedRecord, game, result: "cashed", payout };
}


// ---------------- Multiplayer head-to-head scratcher ----------------
const MP_VALID_WAGER_MIN = 1000;
const MP_HOUSE_EDGE = 0.033;
const MP_TURN_CHOICE_MS = 0; // turn-order buttons stay available until the coin-flip winner chooses
const MP_TURN_MS = 5 * 60 * 1000;
const MP_MAX_GAMES = 500;
const MP_DATA_VERSION = "tickets-turn-timer-reset-20260720-v2";


function mpGameKey(gameId) {
  return `${MP_GAME_PREFIX}${String(gameId || "").replace(/[^0-9A-Za-z_-]/g, "").slice(0, 120)}.json`;
}

function mpCleanId(value) {
  return String(value || "").replace(/[^0-9A-Za-z_-]/g, "").slice(0, 120);
}

function mpPublicPlayer(player = {}) {
  const userId = cleanUserId(player.userId || player.id);
  const name = String(player.name || "Unknown").slice(0, 80);
  const isRemoteBot = Boolean(player.isRemoteBot) || userId.startsWith("remote-bot-");
  const isNpc = Boolean(player.isNpc) || userId.startsWith("npc-") || isRemoteBot;
  return {
    userId,
    name,
    tornId: player.tornId ? cleanUserId(player.tornId) : null,
    avatarUrl: player.avatarUrl ? String(player.avatarUrl).slice(0, 500) : null,
    profileInitial: isNpc ? "N" : (Boolean(player.isTestPlayer) ? "T" : (name.trim().charAt(0).toUpperCase() || "?")),
    isNpc,
    isRemoteBot,
    isTestPlayer: Boolean(player.isTestPlayer),
    controlledBy: player.controlledBy ? cleanUserId(player.controlledBy) : null
  };
}

function mpSanitizeGame(game = {}) {
  game = migrateMpGameToTickets(game || {});
  const gameId = mpCleanId(game.gameId || game.id);
  const wager = int(game.wager, 0);
  const creator = mpPublicPlayer(game.creator || {});
  const joiner = game.joiner ? mpPublicPlayer(game.joiner) : null;
  const statusRaw = String(game.status || "waiting").toLowerCase();
  const status = ["waiting", "coin", "turn_choice", "playing", "complete", "cancelled"].includes(statusRaw) ? statusRaw : "waiting";
  const revealed = Array.isArray(game.revealed) ? game.revealed.map((cell, idx) => ({
    index: Math.max(0, Math.min(8, int(cell?.index, idx))),
    by: cell?.by ? cleanUserId(cell.by) : null,
    byName: cell?.byName ? String(cell.byName).slice(0, 80) : null,
    result: cell?.result === "win" ? "win" : "lose",
    at: cell?.at || null
  })).filter(cell => cell.index >= 0 && cell.index <= 8).slice(0, 9) : [];
  const board = Array.isArray(game.board)
    ? game.board.map(v => String(v).toLowerCase() === "win" ? "win" : "lose").slice(0, 9)
    : [];
  const winCounts = game.winCounts && typeof game.winCounts === "object" ? {
    [creator.userId]: int(game.winCounts[creator.userId], 0),
    ...(joiner ? { [joiner.userId]: int(game.winCounts[joiner.userId], 0) } : {})
  } : {};
  return {
    gameId,
    status,
    wager,
    mpDataVersion: game.mpDataVersion ? String(game.mpDataVersion).slice(0, 80) : null,
    balanceUnit: BALANCE_UNIT,
    ticketsPerXan: TICKETS_PER_XAN,
    npcTest: Boolean(game.npcTest) || Boolean(joiner?.isNpc),
    pot: int(game.pot, wager * (joiner ? 2 : 1)),
    houseEdgePercent: 3.3,
    houseCut: int(game.houseCut, 0),
    payout: int(game.payout, 0),
    createdAt: game.createdAt || null,
    updatedAt: game.updatedAt || null,
    creator,
    joiner,
    creatorChoice: ["heads", "tails"].includes(String(game.creatorChoice || "").toLowerCase()) ? String(game.creatorChoice).toLowerCase() : null,
    coinResult: ["heads", "tails"].includes(String(game.coinResult || "").toLowerCase()) ? String(game.coinResult).toLowerCase() : null,
    coinFlippedAt: game.coinFlippedAt || null,
    coinWinnerUserId: game.coinWinnerUserId ? cleanUserId(game.coinWinnerUserId) : null,
    turnChoiceDeadlineAt: game.turnChoiceDeadlineAt || null,
    turnDeadlineAt: game.turnDeadlineAt || null,
    turnStartedAt: game.turnStartedAt || null,
    turnChooserUserId: game.turnChooserUserId ? cleanUserId(game.turnChooserUserId) : null,
    turnOrder: Array.isArray(game.turnOrder) ? game.turnOrder.map(cleanUserId).filter(Boolean).slice(0, 2) : [],
    currentTurnUserId: game.currentTurnUserId ? cleanUserId(game.currentTurnUserId) : null,
    winnerUserId: game.winnerUserId ? cleanUserId(game.winnerUserId) : null,
    loserUserId: game.loserUserId ? cleanUserId(game.loserUserId) : null,
    completionReason: game.completionReason ? String(game.completionReason).slice(0, 80) : null,
    timeoutForfeitUserId: game.timeoutForfeitUserId ? cleanUserId(game.timeoutForfeitUserId) : null,
    cancelledAt: game.cancelledAt || null,
    cancelRefundedAt: game.cancelRefundedAt || null,
    cancelRefundUserId: game.cancelRefundUserId ? cleanUserId(game.cancelRefundUserId) : null,
    cancelRefundLedgerId: game.cancelRefundLedgerId ? String(game.cancelRefundLedgerId).slice(0, 160) : null,
    board,
    revealed,
    winCounts,
    lastMoveAt: game.lastMoveAt || null,
    ledgerIds: game.ledgerIds && typeof game.ledgerIds === "object" ? game.ledgerIds : {},
    rematch: game.rematch && typeof game.rematch === "object" ? game.rematch : null,
    rematchGameId: mpCleanId(game.rematchGameId || "")
  };
}

function mpPublicGame(game = {}, viewerUserId = "") {
  const clean = mpSanitizeGame(game);
  const viewer = cleanUserId(viewerUserId);
  const hiddenBoard = Array.from({ length: 9 }, (_, index) => {
    const hit = clean.revealed.find(cell => cell.index === index);
    return hit ? { index, revealed: true, result: hit.result, by: hit.by, byName: hit.byName, at: hit.at } : { index, revealed: false };
  });
  return {
    ...clean,
    board: clean.status === "complete" ? clean.board : undefined,
    cells: hiddenBoard,
    isCreator: viewer && clean.creator.userId === viewer,
    isJoiner: viewer && clean.joiner?.userId === viewer,
    isPlayer: viewer && (clean.creator.userId === viewer || clean.joiner?.userId === viewer),
    isMyTurn: viewer && clean.currentTurnUserId === viewer,
    isNpcGame: Boolean(clean.npcTest) || Boolean(clean.creator?.isNpc) || Boolean(clean.joiner?.isNpc),
    isNpcTurn: Boolean(clean.currentTurnUserId && (clean.creator?.userId === clean.currentTurnUserId ? clean.creator?.isNpc : clean.joiner?.userId === clean.currentTurnUserId ? clean.joiner?.isNpc : String(clean.currentTurnUserId).startsWith("npc-"))),
    canJoin: clean.status === "waiting" && viewer && clean.creator.userId !== viewer,
    canCancel: clean.status === "waiting" && viewer && clean.creator.userId === viewer && !clean.joiner,
    canPickCoin: clean.status === "coin" && viewer && clean.creator.userId === viewer && !clean.creatorChoice,
    canChooseTurn: clean.status === "turn_choice" && viewer && clean.coinWinnerUserId === viewer,
    secondsToChoose: clean.turnChoiceDeadlineAt ? Math.max(0, Math.ceil((Date.parse(clean.turnChoiceDeadlineAt) - Date.now()) / 1000)) : 0,
    secondsToTurn: clean.turnDeadlineAt ? Math.max(0, Math.ceil((Date.parse(clean.turnDeadlineAt) - Date.now()) / 1000)) : 0
  };
}

async function mpGetGameRaw(gameId) {
  const id = mpCleanId(gameId);
  if (!id) return null;
  try {
    const game = await getUsersStore().get(mpGameKey(id), { type: "json" });
    return game ? mpSanitizeGame(game) : null;
  } catch {
    return null;
  }
}

async function mpSaveGame(game) {
  const clean = mpSanitizeGame({ ...game, mpDataVersion: MP_DATA_VERSION, updatedAt: nowIso() });
  await getUsersStore().setJSON(mpGameKey(clean.gameId), clean);
  return clean;
}

async function mpRefundFreshStartEscrow(game, player, role, at) {
  const userId = cleanUserId(player?.userId);
  if (!userId || player?.isNpc || String(userId).startsWith("npc-")) return null;
  const wager = int(game.wager, 0);
  if (wager <= 0) return null;
  let record = await getUserRecord(userId);
  record = prepareLedgerRecord(record || { userId, name: player?.name || "Unknown", ledgerStartedAt: at, balanceBaseline: 0, financialLedger: [] });
  const balanceBefore = getRecordBalance(record);
  const ledgerId = `mp:${game.gameId}:${role}-fresh-start-refund:${MP_DATA_VERSION}`;
  const ledgerResult = addLedgerEntry(record, makeLedgerEntry({
    id: ledgerId,
    type: "multiplayer_fresh_start_refund",
    delta: wager,
    amount: wager,
    at,
    reason: `Fresh start removed multiplayer game ${game.gameId}`,
    meta: { gameId: game.gameId, role, resetVersion: MP_DATA_VERSION }
  }));
  if (!ledgerResult.added) return record;
  return await saveUserRecord(sanitizeRecord({
    ...ledgerResult.record,
    name: player?.name || ledgerResult.record.name || "Unknown",
    recentEvents: addEvent(ledgerResult.record.recentEvents || [], {
      type: "multiplayer_fresh_start_refund",
      at,
      gameId: game.gameId,
      amount: wager,
      balanceBefore,
      balanceAfter: getRecordBalance(ledgerResult.record),
      message: `Fresh start removed multiplayer game ${game.gameId}. ${formatTickets(wager)} was returned.`
    })
  }));
}


async function mpRefundMultiplayerEscrow(game, player, role, at, options = {}) {
  const userId = cleanUserId(player?.userId);
  if (!userId || player?.isNpc || String(userId).startsWith("npc-")) return { record: null, refunded: 0 };
  const wager = int(game.wager, 0);
  if (wager <= 0) return { record: null, refunded: 0 };
  let record = await getUserRecord(userId);
  record = prepareLedgerRecord(record || { userId, name: player?.name || "Unknown", ledgerStartedAt: at, balanceBaseline: 0, financialLedger: [] });
  const balanceBefore = getRecordBalance(record);
  const suffix = String(options.suffix || "refund").replace(/[^0-9A-Za-z_-]/g, "").slice(0, 60) || "refund";
  const ledgerId = `mp:${game.gameId}:${role}-${suffix}`;
  const ledgerResult = addLedgerEntry(record, makeLedgerEntry({
    id: ledgerId,
    type: options.ledgerType || "multiplayer_cancel_refund",
    delta: wager,
    amount: wager,
    at,
    reason: options.reason || `Multiplayer game ${game.gameId} was cancelled`,
    meta: { gameId: game.gameId, role, ...(options.meta || {}) }
  }));
  if (!ledgerResult.added) return { record, refunded: 0 };
  const saved = await saveUserRecord(sanitizeRecord({
    ...ledgerResult.record,
    name: player?.name || ledgerResult.record.name || "Unknown",
    recentEvents: addEvent(ledgerResult.record.recentEvents || [], {
      type: options.eventType || "multiplayer_cancel_refund",
      at,
      gameId: game.gameId,
      amount: wager,
      balanceBefore,
      balanceAfter: getRecordBalance(ledgerResult.record),
      message: options.message || `${player?.name || "Unknown"} was refunded ${formatTickets(wager)} from multiplayer game ${game.gameId}.`
    })
  }));
  return { record: saved, refunded: wager };
}

async function mpClearLegacyGamesForFreshStart() {
  const store = getUsersStore();
  const result = await store.list({ prefix: MP_GAME_PREFIX });
  for (const blob of (result?.blobs || [])) {
    try {
      const raw = await store.get(blob.key, { type: "json" });
      if (!raw || !raw.gameId) continue;
      if (String(raw.mpDataVersion || "") === MP_DATA_VERSION) continue;
      const game = mpSanitizeGame(raw);
      if (!["waiting", "coin", "turn_choice", "playing"].includes(game.status)) continue;
      const at = nowIso();
      await mpRefundFreshStartEscrow(game, game.creator, "creator", at);
      if (game.joiner && !game.joiner.isNpc) await mpRefundFreshStartEscrow(game, game.joiner, "joiner", at);
      await mpSaveGame({
        ...game,
        status: "cancelled",
        cancelledAt: at,
        pot: 0,
        payout: 0,
        houseCut: 0,
        currentTurnUserId: null,
        freshStartClearedAt: at,
        freshStartVersion: MP_DATA_VERSION
      });
    } catch (error) {
      console.error("[multiplayer fresh start cleanup]", error.message || error);
    }
  }
}

function mpShuffleBoard() {
  const board = ["win", "win", "win", "win", "win", "lose", "lose", "lose", "lose"];
  for (let i = board.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [board[i], board[j]] = [board[j], board[i]];
  }
  return board;
}

function mpIsActiveCreatedGame(game = {}, creatorUserId = "") {
  const creatorId = cleanUserId(creatorUserId);
  const clean = mpSanitizeGame(game);
  return Boolean(creatorId && clean.creator.userId === creatorId && ["waiting", "coin", "turn_choice", "playing"].includes(clean.status));
}

async function mpFindActiveCreatedGame(creatorUserId = "") {
  const creatorId = cleanUserId(creatorUserId);
  if (!creatorId) return null;
  const store = getUsersStore();
  const result = await store.list({ prefix: MP_GAME_PREFIX });
  for (const blob of (result?.blobs || [])) {
    try {
      let game = await store.get(blob.key, { type: "json" });
      if (!game || !game.gameId) continue;
      game = await mpAutoStartIfNeeded(game);
      if (mpIsActiveCreatedGame(game, creatorId)) return mpSanitizeGame(game);
    } catch {}
  }
  return null;
}

function mpRealGamePayout(pot, houseCutPercent = MP_HOUSE_EDGE * 100) {
  const cleanPot = Math.max(0, int(pot, 0));
  if (cleanPot <= 0) return { payout: 0, houseCut: 0 };
  const edge = clampNumber(houseCutPercent, 0, 25, MP_HOUSE_EDGE * 100) / 100;
  const houseCut = edge <= 0 ? 0 : Math.max(1, Math.min(cleanPot, Math.ceil(cleanPot * edge)));
  return { payout: Math.max(0, cleanPot - houseCut), houseCut };
}

function mpOtherPlayerId(game, userId) {
  const id = cleanUserId(userId);
  const creatorId = cleanUserId(game.creator?.userId);
  const joinerId = cleanUserId(game.joiner?.userId);
  return id === creatorId ? joinerId : creatorId;
}


async function mpCompleteGameWithWinner(game, winnerUserId, viewerUserId = "", at = nowIso(), options = {}) {
  const clean = mpSanitizeGame(game);
  const winnerId = cleanUserId(winnerUserId);
  const winnerPlayer = clean.creator.userId === winnerId ? clean.creator : clean.joiner?.userId === winnerId ? clean.joiner : null;
  if (!winnerPlayer) throw new Error("Could not determine the multiplayer winner.");
  const isNpcWinner = Boolean(winnerPlayer.isNpc) || winnerId.startsWith("npc-");
  const userName = winnerPlayer.name || "Unknown";
  const pot = clean.npcTest ? int(clean.pot, clean.wager) : int(clean.pot, int(clean.wager, 0) * 2);
  const gameOdds = await getGameOddsSettings();
  const payoutParts = clean.npcTest ? { payout: Math.max(0, pot), houseCut: 0 } : mpRealGamePayout(pot, gameOdds.multiplayer.houseCutPercent);
  const payout = isNpcWinner ? 0 : payoutParts.payout;
  const houseCut = isNpcWinner ? Math.max(0, pot) : payoutParts.houseCut;
  const loserUserId = mpOtherPlayerId(clean, winnerId);
  let savedWinner = null;
  let ledgerId = null;

  if (!isNpcWinner && payout > 0) {
    let winnerRecord = await getUserRecord(winnerId);
    winnerRecord = prepareLedgerRecord(winnerRecord || { userId: winnerId, name: userName, ledgerStartedAt: at, balanceBaseline: 0, financialLedger: [] });
    const balanceBefore = getRecordBalance(winnerRecord);
    ledgerId = `mp:${clean.gameId}:winner-payout`;
    const ledgerResult = addLedgerEntry(winnerRecord, makeLedgerEntry({
      id: ledgerId,
      type: clean.npcTest ? "multiplayer_npc_test_refund" : "multiplayer_payout",
      delta: payout,
      amount: payout,
      at,
      reason: clean.npcTest ? `Won NPC test game ${clean.gameId}` : `Won multiplayer game ${clean.gameId}`,
      meta: { gameId: clean.gameId, pot, houseCut, payout, npcTest: Boolean(clean.npcTest), completionReason: options.completionReason || "win_count" }
    }));
    savedWinner = await saveUserRecord(sanitizeRecord({
      ...ledgerResult.record,
      lastBetAt: at,
      totalWon: int(ledgerResult.record.totalWon, 0) + payout,
      netProfit: int(ledgerResult.record.totalWon, 0) + payout - int(ledgerResult.record.totalWagered, 0),
      recentEvents: addEvent(ledgerResult.record.recentEvents || [], {
        type: clean.npcTest ? "multiplayer_npc_test_win" : "multiplayer_win",
        at,
        gameId: clean.gameId,
        pot,
        payout,
        houseCut,
        completionReason: options.completionReason || "win_count",
        timeoutForfeitUserId: options.timeoutForfeitUserId || null,
        balanceBefore,
        balanceAfter: getRecordBalance(ledgerResult.record),
        message: options.message || (clean.npcTest
          ? `${userName} won NPC test game ${clean.gameId} and got ${formatTickets(payout)} back.`
          : `${userName} won multiplayer game ${clean.gameId} and received ${formatTickets(payout)}.`)
      })
    }));
  }

  const savedGame = await mpSaveGame({
    ...clean,
    status: "complete",
    winnerUserId: winnerId,
    loserUserId,
    pot,
    payout,
    houseCut,
    currentTurnUserId: null,
    turnDeadlineAt: null,
    lastMoveAt: at,
    completionReason: options.completionReason || "win_count",
    timeoutForfeitUserId: options.timeoutForfeitUserId || null,
    ledgerIds: { ...(clean.ledgerIds || {}), ...(ledgerId ? { payout: ledgerId } : {}) }
  });
  const record = savedWinner || (viewerUserId ? await getUserRecord(viewerUserId) : null);
  return { savedGame, record };
}


async function mpStartGameFromTurnChoice(game, chooserUserId, orderChoice = "first") {
  const chooser = cleanUserId(chooserUserId);
  const other = mpOtherPlayerId(game, chooser);
  if (!chooser || !other || other === chooser) throw new Error("Could not find the opponent for turn order.");
  const goSecond = String(orderChoice || "first").toLowerCase() === "second";
  const at = nowIso();
  const turnOrder = goSecond ? [other, chooser] : [chooser, other];
  return await mpSaveGame({
    ...game,
    status: "playing",
    board: mpShuffleBoard(),
    turnChooserUserId: chooser,
    turnOrderChoice: goSecond ? "second" : "first",
    firstTurnUserId: turnOrder[0],
    secondTurnUserId: turnOrder[1],
    turnOrder,
    currentTurnUserId: turnOrder[0],
    winCounts: { [game.creator.userId]: 0, [game.joiner.userId]: 0 },
    revealed: [],
    turnStartedAt: at,
    turnDeadlineAt: new Date(Date.now() + MP_TURN_MS).toISOString(),
    lastMoveAt: at
  });
}

async function mpAutoStartIfNeeded(game) {
  let clean = mpSanitizeGame(game);

  // Human coin-flip winners must click Go First or Go Second. If the temporary NPC
  // wins the coin flip, it auto-decides shortly after the flip animation finishes.
  if (clean.status === "turn_choice" && clean.coinWinnerUserId && clean.joiner) {
    const winnerIsNpc = (clean.creator?.userId === clean.coinWinnerUserId && clean.creator?.isNpc) || (clean.joiner?.userId === clean.coinWinnerUserId && clean.joiner?.isNpc) || String(clean.coinWinnerUserId).startsWith("npc-");
    const flippedAt = Date.parse(clean.coinFlippedAt || "");
    if (winnerIsNpc && (!Number.isFinite(flippedAt) || Date.now() - flippedAt > 3300)) {
      const npcChoice = Math.random() < 0.5 ? "first" : "second";
      clean = await mpStartGameFromTurnChoice(clean, clean.coinWinnerUserId, npcChoice);
    }
  }

  if (clean.status === "playing" && clean.turnDeadlineAt && clean.currentTurnUserId && clean.joiner) {
    const due = Date.parse(clean.turnDeadlineAt);
    if (Number.isFinite(due) && Date.now() > due) {
      const timedOutUserId = clean.currentTurnUserId;
      const winnerId = mpOtherPlayerId(clean, timedOutUserId);
      if (winnerId) {
        const at = nowIso();
        const winnerName = clean.creator.userId === winnerId ? clean.creator.name : clean.joiner?.userId === winnerId ? clean.joiner.name : "Opponent";
        const loserName = clean.creator.userId === timedOutUserId ? clean.creator.name : clean.joiner?.userId === timedOutUserId ? clean.joiner.name : "Opponent";
        const completed = await mpCompleteGameWithWinner(clean, winnerId, "", at, {
          completionReason: "turn_timeout",
          timeoutForfeitUserId: timedOutUserId,
          message: `${winnerName || "Opponent"} won multiplayer game ${clean.gameId} because ${loserName || "the other player"} did not take their turn in time.`
        });
        clean = completed.savedGame;
      }
    }
  }

  return clean;
}

async function multiplayerListGames(viewerUserId = "") {
  await mpClearLegacyGamesForFreshStart();
  const store = getUsersStore();
  const result = await store.list({ prefix: MP_GAME_PREFIX });
  const games = [];
  for (const blob of (result?.blobs || [])) {
    try {
      let game = await store.get(blob.key, { type: "json" });
      if (!game || !game.gameId) continue;
      game = await mpAutoStartIfNeeded(game);
      const publicGame = mpPublicGame(game, viewerUserId);
      if (["waiting", "coin", "turn_choice", "playing"].includes(publicGame.status) || publicGame.isPlayer) {
        games.push(publicGame);
      }
    } catch {}
  }
  games.sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
  return games.slice(0, MP_MAX_GAMES);
}

async function multiplayerGetGame(gameId, viewerUserId = "") {
  let game = await mpGetGameRaw(gameId);
  if (!game) throw new Error("That multiplayer game was not found.");
  game = await mpAutoStartIfNeeded(game);
  return mpPublicGame(game, viewerUserId);
}

async function multiplayerCreateGame(user, details = {}) {
  await mpClearLegacyGamesForFreshStart();
  const wager = int(details.wager, 0);
  if (wager < MP_VALID_WAGER_MIN || wager % TICKETS_PER_XAN !== 0) throw new Error("Choose a wager of at least 1,000 Tickets in 1,000 Ticket increments.");
  const existingActive = await mpFindActiveCreatedGame(user.id);
  if (existingActive) throw new Error("You already have an active multiplayer game. Cancel it or finish it before creating another one.");
  let record = await getUserRecord(user.id);
  record = prepareLedgerRecord(record || { userId: String(user.id), name: user.name || "Unknown", ledgerStartedAt: nowIso(), balanceBaseline: 0, financialLedger: [] });
  const balanceBefore = getRecordBalance(record);
  if (balanceBefore < wager) throw new Error(`You need ${wager} Tickets to create this game.`);
  const at = nowIso();
  const gameId = `mp-${Date.now()}-${crypto.randomBytes(5).toString("hex")}`;
  const ledgerId = `mp:${gameId}:creator-escrow`;
  const ledgerResult = addLedgerEntry(record, makeLedgerEntry({
    id: ledgerId,
    type: "multiplayer_escrow",
    delta: -wager,
    amount: wager,
    at,
    reason: `Created multiplayer game ${gameId}`,
    meta: { gameId, role: "creator" }
  }));
  const afterRecord = sanitizeRecord({
    ...ledgerResult.record,
    name: user.name || ledgerResult.record.name || "Unknown",
    lastBetAt: at,
    totalWagered: int(ledgerResult.record.totalWagered, 0) + wager,
    recentEvents: addEvent(ledgerResult.record.recentEvents || [], {
      type: "multiplayer_create",
      at,
      gameId,
      amount: wager,
      balanceBefore,
      balanceAfter: getRecordBalance(ledgerResult.record),
      message: `${user.name || "Unknown"} created a multiplayer game for ${formatTickets(wager)}.`
    })
  });
  const saved = await saveUserRecord(afterRecord);
  const game = await mpSaveGame({
    gameId,
    status: "waiting",
    wager,
    pot: wager,
    createdAt: at,
    updatedAt: at,
    creator: mpPublicPlayer({ userId: saved.userId, name: user.name || saved.name || "Unknown", tornId: user.tornId || user.id, avatarUrl: user.avatarUrl }),
    joiner: null,
    revealed: [],
    board: [],
    ledgerIds: { creator: ledgerId }
  });
  return { game: mpPublicGame(game, saved.userId), record: saved };
}

async function multiplayerCancelGame(user, gameId) {
  let game = await mpGetGameRaw(gameId);
  if (!game) throw new Error("That multiplayer game was not found.");
  game = await mpAutoStartIfNeeded(game);
  const userId = cleanUserId(user.id);
  if (game.creator.userId !== userId) throw new Error("Only the player who created this game can cancel it.");

  const existingRecord = await getUserRecord(userId);

  if (game.status === "cancelled") {
    return { game: mpPublicGame(game, userId), record: existingRecord, alreadyCancelled: true, refunded: false };
  }
  if (game.status !== "waiting" || game.joiner) throw new Error("This game can only be cancelled before another player joins.");

  const wager = int(game.wager, 0);
  const at = nowIso();
  const ledgerId = `mp:${game.gameId}:creator-cancel-refund`;

  // Mark the game cancelled before touching the balance. This prevents repeated
  // cancel clicks or duplicate browser tabs from showing the game as cancelable.
  game = await mpSaveGame({
    ...game,
    status: "cancelled",
    cancelledAt: at,
    cancelRefundUserId: userId,
    cancelRefundLedgerId: ledgerId,
    pot: 0,
    payout: 0,
    houseCut: 0,
    currentTurnUserId: null,
    ledgerIds: { ...(game.ledgerIds || {}), cancelRefund: ledgerId }
  });

  let record = prepareLedgerRecord(existingRecord || { userId, name: user.name || "Unknown", ledgerStartedAt: at, balanceBaseline: 0, financialLedger: [] });

  // The deterministic ledger ID makes the refund one-time per game even if the
  // user clicks cancel again later.
  if (ledgerEntryIdExists(record, ledgerId)) {
    return { game: mpPublicGame(game, userId), record, alreadyCancelled: true, refunded: false };
  }

  const balanceBefore = getRecordBalance(record);
  const ledgerResult = addLedgerEntry(record, makeLedgerEntry({
    id: ledgerId,
    type: "multiplayer_cancel_refund",
    delta: wager,
    amount: wager,
    at,
    reason: `Cancelled multiplayer game ${game.gameId}`,
    meta: { gameId: game.gameId, role: "creator", oneTimeRefund: true }
  }));

  if (!ledgerResult.added) {
    return { game: mpPublicGame(game, userId), record: ledgerResult.record, alreadyCancelled: true, refunded: false };
  }

  const saved = await saveUserRecord(sanitizeRecord({
    ...ledgerResult.record,
    name: user.name || ledgerResult.record.name || "Unknown",
    recentEvents: addEvent(ledgerResult.record.recentEvents || [], {
      type: "multiplayer_cancel",
      at,
      gameId: game.gameId,
      amount: wager,
      balanceBefore,
      balanceAfter: getRecordBalance(ledgerResult.record),
      message: `${user.name || "Unknown"} cancelled multiplayer game ${game.gameId} and got ${formatTickets(wager)} back.`
    })
  }));

  game = await mpSaveGame({
    ...game,
    cancelRefundedAt: at,
    cancelRefundUserId: userId,
    cancelRefundLedgerId: ledgerId
  });

  return { game: mpPublicGame(game, saved.userId), record: saved, alreadyCancelled: false, refunded: true };
}

async function multiplayerJoinGame(user, gameId) {
  let game = await mpGetGameRaw(gameId);
  if (!game) throw new Error("That multiplayer game was not found.");
  game = await mpAutoStartIfNeeded(game);
  if (game.status !== "waiting") throw new Error("That game is no longer joinable.");
  if (game.creator.userId === cleanUserId(user.id)) throw new Error("You cannot join your own game.");
  const wager = int(game.wager, 0);
  let record = await getUserRecord(user.id);
  record = prepareLedgerRecord(record || { userId: String(user.id), name: user.name || "Unknown", ledgerStartedAt: nowIso(), balanceBaseline: 0, financialLedger: [] });
  const balanceBefore = getRecordBalance(record);
  if (balanceBefore < wager) throw new Error(`You need ${wager} Tickets to join this game.`);
  const at = nowIso();
  const ledgerId = `mp:${game.gameId}:joiner-escrow`;
  const ledgerResult = addLedgerEntry(record, makeLedgerEntry({
    id: ledgerId,
    type: "multiplayer_escrow",
    delta: -wager,
    amount: wager,
    at,
    reason: `Joined multiplayer game ${game.gameId}`,
    meta: { gameId: game.gameId, role: "joiner" }
  }));
  const afterRecord = sanitizeRecord({
    ...ledgerResult.record,
    name: user.name || ledgerResult.record.name || "Unknown",
    lastBetAt: at,
    totalWagered: int(ledgerResult.record.totalWagered, 0) + wager,
    recentEvents: addEvent(ledgerResult.record.recentEvents || [], {
      type: "multiplayer_join",
      at,
      gameId: game.gameId,
      amount: wager,
      balanceBefore,
      balanceAfter: getRecordBalance(ledgerResult.record),
      message: `${user.name || "Unknown"} joined multiplayer game ${game.gameId} for ${formatTickets(wager)}.`
    })
  });
  const saved = await saveUserRecord(afterRecord);
  game = await mpSaveGame({
    ...game,
    status: "coin",
    pot: wager * 2,
    joiner: mpPublicPlayer({ userId: saved.userId, name: user.name || saved.name || "Unknown", tornId: user.tornId || user.id, avatarUrl: user.avatarUrl }),
    ledgerIds: { ...(game.ledgerIds || {}), joiner: ledgerId }
  });
  return { game: mpPublicGame(game, saved.userId), record: saved };
}

async function multiplayerAddNpc(user, gameId) {
  let game = await mpGetGameRaw(gameId);
  if (!game) throw new Error("Create a multiplayer game before adding the NPC opponent.");
  game = await mpAutoStartIfNeeded(game);
  if (game.status !== "waiting") throw new Error("NPC opponent can only be added before a real player joins.");
  if (game.creator.userId !== cleanUserId(user.id)) throw new Error("Only the player who created the game can add the NPC opponent.");
  const npcId = `npc-${game.gameId}`;
  game = await mpSaveGame({
    ...game,
    status: "coin",
    npcTest: true,
    // The NPC is a testing opponent and does not deposit real Tickets. The pot is
    // kept to the creator's escrow so this test button cannot mint free balance.
    pot: int(game.wager, 0),
    joiner: mpPublicPlayer({ userId: npcId, name: "NPC Opponent", isNpc: true }),
    ledgerIds: { ...(game.ledgerIds || {}), npc: `mp:${game.gameId}:npc-test` }
  });
  const record = await getUserRecord(user.id);
  return { game: mpPublicGame(game, user.id), record };
}

async function multiplayerChooseCoin(user, gameId, choice) {
  let game = await mpGetGameRaw(gameId);
  if (!game) throw new Error("That multiplayer game was not found.");
  if (game.status !== "coin") throw new Error("This game is not waiting for a coin pick.");
  if (game.creator.userId !== cleanUserId(user.id)) throw new Error("Only the player who created the game can pick heads or tails.");
  if (!game.joiner) throw new Error("Waiting for another player to join.");
  const cleanChoice = String(choice || "").toLowerCase() === "tails" ? "tails" : "heads";
  const coinResult = Math.random() < 0.5 ? "heads" : "tails";
  const creatorWon = coinResult === cleanChoice;
  const coinWinnerUserId = creatorWon ? game.creator.userId : game.joiner.userId;
  const at = nowIso();
  game = await mpSaveGame({
    ...game,
    status: "turn_choice",
    creatorChoice: cleanChoice,
    coinResult,
    coinFlippedAt: at,
    coinWinnerUserId,
    turnChoiceDeadlineAt: null,
    updatedAt: at
  });
  return { game: mpPublicGame(game, user.id) };
}

async function multiplayerChooseTurn(user, gameId, orderChoice) {
  let game = await mpGetGameRaw(gameId);
  if (!game) throw new Error("That multiplayer game was not found.");
  game = await mpAutoStartIfNeeded(game);
  if (game.status !== "turn_choice") throw new Error("This game is not waiting for turn order.");
  if (game.coinWinnerUserId !== cleanUserId(user.id)) throw new Error("Only the coin flip winner can choose first or second.");
  game = await mpStartGameFromTurnChoice(game, user.id, orderChoice);
  return { game: mpPublicGame(game, user.id) };
}

async function mpApplyPick(game, actor = {}, pickedIndex = 0, viewerUserId = "") {
  const userId = cleanUserId(actor.userId || actor.id);
  const userName = String(actor.name || "Unknown");
  const isNpcActor = Boolean(actor.isNpc) || userId.startsWith("npc-");
  if (game.status !== "playing") throw new Error("This game is not currently playing.");
  if (![game.creator.userId, game.joiner?.userId].includes(userId)) throw new Error("That player is not in this game.");
  if (game.currentTurnUserId !== userId) throw new Error("It is not that player's turn yet.");
  const slot = Math.max(0, Math.min(8, int(pickedIndex, -1)));
  if (slot < 0 || slot > 8) throw new Error("Pick a valid slot.");
  if (game.revealed.some(cell => cell.index === slot)) throw new Error("That slot is already revealed.");
  const result = game.board[slot] === "win" ? "win" : "lose";
  const at = nowIso();
  const winCounts = { ...(game.winCounts || {}) };
  winCounts[game.creator.userId] = int(winCounts[game.creator.userId], 0);
  winCounts[game.joiner.userId] = int(winCounts[game.joiner.userId], 0);
  if (result === "win") winCounts[userId] = int(winCounts[userId], 0) + 1;
  const revealed = [...game.revealed, { index: slot, by: userId, byName: userName, result, at }];

  if (winCounts[userId] >= 3) {
    const completed = await mpCompleteGameWithWinner({
      ...game,
      revealed,
      winCounts
    }, userId, viewerUserId || userId, at, { completionReason: "win_count" });
    return { game: mpPublicGame(completed.savedGame, viewerUserId || userId), record: completed.record };
  }

  const other = mpOtherPlayerId(game, userId);
  game = await mpSaveGame({
    ...game,
    revealed,
    winCounts,
    currentTurnUserId: other,
    turnStartedAt: at,
    turnDeadlineAt: new Date(Date.now() + MP_TURN_MS).toISOString(),
    lastMoveAt: at
  });
  const record = viewerUserId ? await getUserRecord(viewerUserId) : await getUserRecord(userId);
  return { game: mpPublicGame(game, viewerUserId || userId), record };
}

async function multiplayerPickSlot(user, gameId, index) {
  let game = await mpGetGameRaw(gameId);
  if (!game) throw new Error("That multiplayer game was not found.");
  game = await mpAutoStartIfNeeded(game);
  const userId = cleanUserId(user.id);
  if (game.status !== "playing") throw new Error("This game is not currently playing.");
  if (![game.creator.userId, game.joiner?.userId].includes(userId)) throw new Error("You are not a player in this game.");
  if (game.currentTurnUserId !== userId) throw new Error("It is not your turn yet.");
  return await mpApplyPick(game, { userId, name: user.name || "Unknown", isNpc: false }, index, userId);
}

async function multiplayerNpcPick(user, gameId) {
  let game = await mpGetGameRaw(gameId);
  if (!game) throw new Error("That multiplayer game was not found.");
  game = await mpAutoStartIfNeeded(game);
  const humanId = cleanUserId(user.id);
  if (!game.npcTest) throw new Error("This is not an NPC test game.");
  if (![game.creator.userId, game.joiner?.userId].includes(humanId)) throw new Error("You are not a player in this NPC test game.");
  const npcPlayer = game.creator?.isNpc ? game.creator : game.joiner?.isNpc ? game.joiner : null;
  if (!npcPlayer) throw new Error("NPC opponent was not found in this game.");
  if (game.currentTurnUserId !== npcPlayer.userId) throw new Error("It is not the NPC's turn yet.");
  const openSlots = Array.from({ length: 9 }, (_, index) => index).filter(index => !game.revealed.some(cell => cell.index === index));
  if (!openSlots.length) throw new Error("No slots are left to reveal.");
  const index = openSlots[Math.floor(Math.random() * openSlots.length)];
  return await mpApplyPick(game, { userId: npcPlayer.userId, name: npcPlayer.name || "NPC Opponent", isNpc: true }, index, humanId);
}

async function multiplayerAdminCancelAllGames(options = {}) {
  const store = getUsersStore();
  const result = await store.list({ prefix: MP_GAME_PREFIX });
  const at = nowIso();
  let cancelledCount = 0;
  let deletedCount = 0;
  let refundedTickets = 0;
  const affectedGames = [];

  for (const blob of (result?.blobs || [])) {
    try {
      let raw = await store.get(blob.key, { type: "json" });
      if (!raw || !raw.gameId) continue;
      let game = await mpAutoStartIfNeeded(raw);
      if (!["waiting", "coin", "turn_choice", "playing"].includes(game.status)) continue;

      const creatorRefund = await mpRefundMultiplayerEscrow(game, game.creator, "creator", at, {
        suffix: "admin-test-cancel-refund",
        ledgerType: "multiplayer_admin_cancel_refund",
        eventType: "multiplayer_admin_cancel_refund",
        reason: options.reason || `Admin test cancelled multiplayer game ${game.gameId}`,
        message: `Admin test cancelled multiplayer game ${game.gameId}. ${formatTickets(game.wager)} was returned.`
      });
      refundedTickets += creatorRefund.refunded || 0;

      if (game.joiner && !game.joiner.isNpc) {
        const joinerRefund = await mpRefundMultiplayerEscrow(game, game.joiner, "joiner", at, {
          suffix: "admin-test-cancel-refund",
          ledgerType: "multiplayer_admin_cancel_refund",
          eventType: "multiplayer_admin_cancel_refund",
          reason: options.reason || `Admin test cancelled multiplayer game ${game.gameId}`,
          message: `Admin test cancelled multiplayer game ${game.gameId}. ${formatTickets(game.wager)} was returned.`
        });
        refundedTickets += joinerRefund.refunded || 0;
      }

      const cancelledGame = await mpSaveGame({
        ...game,
        status: "cancelled",
        cancelledAt: at,
        pot: 0,
        payout: 0,
        houseCut: 0,
        currentTurnUserId: null,
        turnDeadlineAt: null,
        adminTestCancelledAt: at
      });
      cancelledCount += 1;
      affectedGames.push(cancelledGame.gameId);

      if (typeof store.delete === "function" && options.deleteGames !== false) {
        await store.delete(blob.key);
        deletedCount += 1;
      }
    } catch (error) {
      console.error("[multiplayer admin cancel all]", error.message || error);
    }
  }

  return { cancelledCount, deletedCount, refundedTickets, affectedGames };
}



async function duelAdminCancelAllGames(options = {}) {
  const store = getUsersStore();
  const listed = await store.list({ prefix: DUEL_GAME_PREFIX });
  const at = nowIso();
  let scannedCount = 0;
  let cancelledCount = 0;
  let deletedCount = 0;
  let refundedTickets = 0;
  let clearedPointerCount = 0;
  const affectedGames = [];

  for (const entry of (listed?.blobs || [])) {
    try {
      const raw = await store.get(entry.key, { type: "json" });
      if (!raw) continue;
      scannedCount += 1;
      const game = duelSanitizeGame(raw);
      if (!duelIsActiveStatus(game.status)) continue;

      if (game.creator?.userId && int(game.wager, 0) > 0) {
        const before = await getUserRecord(game.creator.userId);
        const beforeBalance = before ? getRecordBalance(before) : 0;
        const after = await duelPayPlayer(
          game.creator,
          int(game.wager, 0),
          game,
          "duel_admin_cancel_refund",
          options.reason || `Admin cancelled ${DUEL_MODES[game.mode] || "multiplayer arcade"} ${game.gameId}. ${formatTickets(game.wager)} returned.`
        );
        if (after) refundedTickets += Math.max(0, getRecordBalance(after) - beforeBalance);
      }

      if (game.joiner?.userId && !game.joiner?.isNpc && !game.joiner?.isTestPlayer && int(game.wager, 0) > 0) {
        const before = await getUserRecord(game.joiner.userId);
        const beforeBalance = before ? getRecordBalance(before) : 0;
        const after = await duelPayPlayer(
          game.joiner,
          int(game.wager, 0),
          game,
          "duel_admin_cancel_refund",
          options.reason || `Admin cancelled ${DUEL_MODES[game.mode] || "multiplayer arcade"} ${game.gameId}. ${formatTickets(game.wager)} returned.`
        );
        if (after) refundedTickets += Math.max(0, getRecordBalance(after) - beforeBalance);
      }

      const cancelled = await duelSaveGame({
        ...game,
        status: "cancelled",
        completedAt: at,
        result: { mode: game.mode, cancelled: true, text: options.reason || "Admin cancelled all current multiplayer arcade games." },
        pot: 0,
        payout: 0,
        houseCut: 0,
        adminCancelledAt: at
      });
      cancelledCount += 1;
      affectedGames.push(cancelled.gameId);

      if (typeof store.delete === "function" && options.deleteGames !== false) {
        await store.delete(entry.key);
        deletedCount += 1;
      }
    } catch (error) {
      console.error("[duel admin cancel all]", error.message || error);
    }
  }

  // Sweep every active pointer as a final recovery measure. Active pointers are only
  // caches and will be rebuilt automatically for any future valid game.
  try {
    const pointers = await store.list({ prefix: DUEL_ACTIVE_PREFIX });
    if (typeof store.delete === "function") {
      for (const pointer of (pointers?.blobs || [])) {
        try { await store.delete(pointer.key); clearedPointerCount += 1; } catch {}
      }
    }
  } catch (error) {
    console.error("[duel admin pointer sweep]", error.message || error);
  }

  return { scannedCount, cancelledCount, deletedCount, refundedTickets, clearedPointerCount, affectedGames };
}

// ---------------- Multiplayer Basketball ----------------
const BB_GAME_PREFIX = "bb-game/";
const BB_MAX_GAMES = 500;
const BB_MATCH_MS = 30 * 1000;
const BB_COUNTDOWN_MS = 3500;

function bbGameKey(gameId) {
  return `${BB_GAME_PREFIX}${String(gameId || "").replace(/[^0-9A-Za-z_-]/g, "").slice(0, 120)}.json`;
}

function bbCleanId(value) {
  return String(value || "").replace(/[^0-9A-Za-z_-]/g, "").slice(0, 120);
}

function bbPublicPlayer(player = {}) {
  return mpPublicPlayer(player);
}

function bbInitialStats() {
  return { score: 0, multiplier: 1, made: 0, missed: 0, streak: 0, bestStreak: 0, lastShotAt: null, lastShotMade: null, lastShotSwish: false };
}

function bbSanitizeStats(stats = {}) {
  return {
    score: Number.isFinite(Number(stats.score)) ? Number(Number(stats.score).toFixed(1)) : 0,
    multiplier: Number.isFinite(Number(stats.multiplier)) ? Number(Math.max(0, Number(stats.multiplier)).toFixed(1)) : 1,
    made: int(stats.made, 0),
    missed: int(stats.missed, 0),
    streak: int(stats.streak, 0),
    bestStreak: int(stats.bestStreak, 0),
    lastShotAt: stats.lastShotAt || null,
    lastShotMade: typeof stats.lastShotMade === "boolean" ? stats.lastShotMade : null,
    lastShotSwish: Boolean(stats.lastShotSwish)
  };
}

function bbSanitizeGame(game = {}) {
  game = migrateMpGameToTickets(game || {});
  const gameId = bbCleanId(game.gameId || game.id);
  const wager = int(game.wager, 0);
  const creator = bbPublicPlayer(game.creator || {});
  const joiner = game.joiner ? bbPublicPlayer(game.joiner) : null;
  const statusRaw = String(game.status || "waiting").toLowerCase();
  const status = ["waiting", "ready", "countdown", "playing", "complete", "cancelled"].includes(statusRaw) ? statusRaw : "waiting";
  const ready = game.ready && typeof game.ready === "object" ? game.ready : {};
  const statsRaw = game.stats && typeof game.stats === "object" ? game.stats : {};
  const stats = {};
  if (creator.userId) stats[creator.userId] = bbSanitizeStats(statsRaw[creator.userId] || bbInitialStats());
  if (joiner?.userId) stats[joiner.userId] = bbSanitizeStats(statsRaw[joiner.userId] || bbInitialStats());
  return {
    gameId,
    status,
    balanceUnit: BALANCE_UNIT,
    ticketsPerXan: TICKETS_PER_XAN,
    wager,
    pot: int(game.pot, wager * (joiner ? 2 : 1)),
    payout: int(game.payout, 0),
    houseCut: int(game.houseCut, 0),
    createdAt: game.createdAt || null,
    updatedAt: game.updatedAt || null,
    cancelledAt: game.cancelledAt || null,
    completedAt: game.completedAt || null,
    countdownStartedAt: game.countdownStartedAt || null,
    startAt: game.startAt || null,
    endAt: game.endAt || null,
    winnerUserId: game.winnerUserId ? cleanUserId(game.winnerUserId) : null,
    loserUserId: game.loserUserId ? cleanUserId(game.loserUserId) : null,
    tie: Boolean(game.tie),
    creator,
    joiner,
    ready: {
      ...(creator.userId ? { [creator.userId]: Boolean(ready[creator.userId]) } : {}),
      ...(joiner?.userId ? { [joiner.userId]: Boolean(ready[joiner.userId]) } : {})
    },
    stats,
    ledgerIds: game.ledgerIds && typeof game.ledgerIds === "object" ? game.ledgerIds : {},
    rematch: game.rematch && typeof game.rematch === "object" ? game.rematch : null,
    rematchGameId: mpCleanId(game.rematchGameId || "")
  };
}

function bbPublicGame(game = {}, viewerUserId = "") {
  const clean = bbSanitizeGame(game);
  const viewer = cleanUserId(viewerUserId);
  const now = Date.now();
  const startMs = clean.startAt ? Date.parse(clean.startAt) : 0;
  const endMs = clean.endAt ? Date.parse(clean.endAt) : 0;
  return {
    ...clean,
    isCreator: viewer && clean.creator.userId === viewer,
    isJoiner: viewer && clean.joiner?.userId === viewer,
    isPlayer: viewer && (clean.creator.userId === viewer || clean.joiner?.userId === viewer),
    canJoin: clean.status === "waiting" && viewer && clean.creator.userId !== viewer,
    canCancel: clean.status === "waiting" && viewer && clean.creator.userId === viewer && !clean.joiner,
    canReady: ["ready", "countdown"].includes(clean.status) && viewer && (clean.creator.userId === viewer || clean.joiner?.userId === viewer),
    secondsToStart: startMs ? Math.max(0, Math.ceil((startMs - now) / 1000)) : 0,
    secondsLeft: endMs ? Math.max(0, Math.ceil((endMs - now) / 1000)) : 30
  };
}

async function bbGetGameRaw(gameId) {
  const id = bbCleanId(gameId);
  if (!id) return null;
  try {
    const game = await getUsersStore().get(bbGameKey(id), { type: "json" });
    return game ? bbSanitizeGame(game) : null;
  } catch {
    return null;
  }
}

async function bbSaveGame(game) {
  const clean = bbSanitizeGame({ ...game, updatedAt: nowIso() });
  await getUsersStore().setJSON(bbGameKey(clean.gameId), clean);
  return clean;
}

async function bbAutoCompleteIfNeeded(game) {
  let clean = bbSanitizeGame(game);
  if (clean.status === "countdown" && clean.startAt && Date.now() >= Date.parse(clean.startAt)) {
    clean = await bbSaveGame({ ...clean, status: "playing" });
  }
  if (clean.status === "playing" && clean.endAt && Date.now() >= Date.parse(clean.endAt)) {
    clean = (await bbCompleteGame(clean)).savedGame;
  }
  return clean;
}

async function basketballListGames(viewerUserId = "") {
  const store = getUsersStore();
  const result = await store.list({ prefix: BB_GAME_PREFIX });
  const games = [];
  for (const blob of (result?.blobs || [])) {
    try {
      let game = await store.get(blob.key, { type: "json" });
      if (!game || !game.gameId) continue;
      game = await bbAutoCompleteIfNeeded(game);
      game = await bbNpcAutoShootIfNeeded(game);
      const publicGame = bbPublicGame(game, viewerUserId);
      if (["waiting", "ready", "countdown", "playing"].includes(publicGame.status) || publicGame.isPlayer) games.push(publicGame);
    } catch {}
  }
  games.sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
  return games.slice(0, BB_MAX_GAMES);
}

async function bbNpcAutoShootIfNeeded(game) {
  let clean = bbSanitizeGame(game);
  if (clean.status !== "playing" || !clean.joiner?.isNpc) return clean;
  const npcId = clean.joiner.userId;
  const nowMs = Date.now();
  const stats = { ...(clean.stats || {}) };
  const current = bbSanitizeStats(stats[npcId] || bbInitialStats());
  const last = current.lastShotAt ? Date.parse(current.lastShotAt) : 0;
  if (Number.isFinite(last) && nowMs - last < 760) return clean;
  const difficulty = Math.max(1, Math.floor(Number(current.multiplier || 1)));
  const makeChance = Math.max(0.18, Math.min(0.72, 0.66 - (difficulty - 1) * 0.08));
  const made = Math.random() < makeChance;
  if (made) {
    current.score = Number((current.score + current.multiplier).toFixed(1));
    current.multiplier = Number((current.multiplier + 0.1).toFixed(1));
    current.made += 1;
    current.streak += 1;
    current.bestStreak = Math.max(current.bestStreak, current.streak);
  } else {
    current.multiplier = 0;
    current.missed += 1;
    current.streak = 0;
  }
  current.lastShotAt = nowIso();
  current.lastShotMade = made;
  current.lastShotSwish = made && Math.random() < 0.35;
  stats[npcId] = current;
  return await bbSaveGame({ ...clean, stats });
}

async function basketballGetGame(gameId, viewerUserId = "") {
  let game = await bbGetGameRaw(gameId);
  if (!game) throw new Error("That basketball game was not found.");
  game = await bbAutoCompleteIfNeeded(game);
  game = await bbNpcAutoShootIfNeeded(game);
  return bbPublicGame(game, viewerUserId);
}

async function basketballCreateGame(user, details = {}) {
  const wager = int(details.wager, 0);
  if (wager < MP_VALID_WAGER_MIN || wager % TICKETS_PER_XAN !== 0) throw new Error("Choose a wager of at least 1,000 Tickets in 1,000 Ticket increments.");
  let record = await getUserRecord(user.id);
  record = prepareLedgerRecord(record || { userId: String(user.id), name: user.name || "Unknown", ledgerStartedAt: nowIso(), balanceBaseline: 0, financialLedger: [] });
  const balanceBefore = getRecordBalance(record);
  if (balanceBefore < wager) throw new Error(`You need ${formatTickets(wager)} to create this game.`);
  const at = nowIso();
  const gameId = `bb-${Date.now()}-${crypto.randomBytes(5).toString("hex")}`;
  const ledgerId = `bb:${gameId}:creator-escrow`;
  const ledgerResult = addLedgerEntry(record, makeLedgerEntry({
    id: ledgerId, type: "basketball_escrow", delta: -wager, amount: wager, at,
    reason: `Created basketball game ${gameId}`, meta: { gameId, role: "creator" }
  }));
  const saved = await saveUserRecord(sanitizeRecord({
    ...ledgerResult.record,
    name: user.name || ledgerResult.record.name || "Unknown",
    lastBetAt: at,
    totalWagered: int(ledgerResult.record.totalWagered, 0) + wager,
    recentEvents: addEvent(ledgerResult.record.recentEvents || [], {
      type: "basketball_create", at, gameId, amount: wager, balanceBefore,
      balanceAfter: getRecordBalance(ledgerResult.record),
      message: `${user.name || "Unknown"} created a basketball game for ${formatTickets(wager)}.`
    })
  }));
  const creator = bbPublicPlayer({ userId: saved.userId, name: user.name || saved.name || "Unknown", tornId: user.tornId || user.id, avatarUrl: user.avatarUrl });
  const game = await bbSaveGame({
    gameId, status: "waiting", wager, pot: wager, createdAt: at, updatedAt: at,
    creator, joiner: null, ready: { [creator.userId]: false }, stats: { [creator.userId]: bbInitialStats() },
    ledgerIds: { creator: ledgerId }
  });
  return { game: bbPublicGame(game, saved.userId), record: saved };
}

async function basketballCancelGame(user, gameId) {
  let game = await bbGetGameRaw(gameId);
  if (!game) throw new Error("That basketball game was not found.");
  game = await bbAutoCompleteIfNeeded(game);
  const userId = cleanUserId(user.id);
  if (game.creator.userId !== userId) throw new Error("Only the player who created this game can cancel it.");
  if (game.status === "cancelled") return { game: bbPublicGame(game, userId), record: await getUserRecord(userId), refunded: false };
  if (game.status !== "waiting" || game.joiner) throw new Error("This game can only be cancelled before another player joins.");
  const at = nowIso();
  const ledgerId = `bb:${game.gameId}:creator-cancel-refund`;
  let record = await getUserRecord(userId);
  record = prepareLedgerRecord(record || { userId, name: user.name || "Unknown", ledgerStartedAt: at, balanceBaseline: 0, financialLedger: [] });
  if (ledgerEntryIdExists(record, ledgerId)) {
    game = await bbSaveGame({ ...game, status: "cancelled", cancelledAt: at, pot: 0 });
    return { game: bbPublicGame(game, userId), record, refunded: false };
  }
  const balanceBefore = getRecordBalance(record);
  const ledgerResult = addLedgerEntry(record, makeLedgerEntry({
    id: ledgerId, type: "basketball_cancel_refund", delta: game.wager, amount: game.wager, at,
    reason: `Cancelled basketball game ${game.gameId}`, meta: { gameId: game.gameId, role: "creator" }
  }));
  const saved = await saveUserRecord(sanitizeRecord({
    ...ledgerResult.record,
    name: user.name || ledgerResult.record.name || "Unknown",
    recentEvents: addEvent(ledgerResult.record.recentEvents || [], {
      type: "basketball_cancel", at, gameId: game.gameId, amount: game.wager, balanceBefore,
      balanceAfter: getRecordBalance(ledgerResult.record),
      message: `${user.name || "Unknown"} cancelled basketball game ${game.gameId} and got ${formatTickets(game.wager)} back.`
    })
  }));
  game = await bbSaveGame({ ...game, status: "cancelled", cancelledAt: at, pot: 0, ledgerIds: { ...(game.ledgerIds || {}), cancelRefund: ledgerId } });
  return { game: bbPublicGame(game, saved.userId), record: saved, refunded: true };
}

async function basketballJoinGame(user, gameId) {
  let game = await bbGetGameRaw(gameId);
  if (!game) throw new Error("That basketball game was not found.");
  game = await bbAutoCompleteIfNeeded(game);
  if (game.status !== "waiting") throw new Error("That basketball game is no longer joinable.");
  if (game.creator.userId === cleanUserId(user.id)) throw new Error("You cannot join your own game.");
  const wager = int(game.wager, 0);
  let record = await getUserRecord(user.id);
  record = prepareLedgerRecord(record || { userId: String(user.id), name: user.name || "Unknown", ledgerStartedAt: nowIso(), balanceBaseline: 0, financialLedger: [] });
  const balanceBefore = getRecordBalance(record);
  if (balanceBefore < wager) throw new Error(`You need ${formatTickets(wager)} to join this game.`);
  const at = nowIso();
  const ledgerId = `bb:${game.gameId}:joiner-escrow`;
  const ledgerResult = addLedgerEntry(record, makeLedgerEntry({
    id: ledgerId, type: "basketball_escrow", delta: -wager, amount: wager, at,
    reason: `Joined basketball game ${game.gameId}`, meta: { gameId: game.gameId, role: "joiner" }
  }));
  const saved = await saveUserRecord(sanitizeRecord({
    ...ledgerResult.record,
    name: user.name || ledgerResult.record.name || "Unknown",
    lastBetAt: at,
    totalWagered: int(ledgerResult.record.totalWagered, 0) + wager,
    recentEvents: addEvent(ledgerResult.record.recentEvents || [], {
      type: "basketball_join", at, gameId: game.gameId, amount: wager, balanceBefore,
      balanceAfter: getRecordBalance(ledgerResult.record),
      message: `${user.name || "Unknown"} joined basketball game ${game.gameId} for ${formatTickets(wager)}.`
    })
  }));
  const joiner = bbPublicPlayer({ userId: saved.userId, name: user.name || saved.name || "Unknown", tornId: user.tornId || user.id, avatarUrl: user.avatarUrl });
  game = await bbSaveGame({
    ...game, status: "ready", pot: wager * 2, joiner,
    ready: { [game.creator.userId]: false, [joiner.userId]: false },
    stats: { [game.creator.userId]: bbInitialStats(), [joiner.userId]: bbInitialStats() },
    ledgerIds: { ...(game.ledgerIds || {}), joiner: ledgerId }
  });
  return { game: bbPublicGame(game, saved.userId), record: saved };
}

async function basketballAddNpc(user, gameId) {
  let game = await bbGetGameRaw(gameId);
  if (!game) throw new Error("Create a basketball game before adding the NPC opponent.");
  game = await bbAutoCompleteIfNeeded(game);
  if (game.status !== "waiting") throw new Error("NPC opponent can only be added before a real player joins.");
  if (game.creator.userId !== cleanUserId(user.id)) throw new Error("Only the player who created the game can add the NPC opponent.");
  const npcId = `npc-bb-${game.gameId}`;
  const npc = bbPublicPlayer({ userId: npcId, name: "NPC Opponent", isNpc: true });
  game = await bbSaveGame({
    ...game,
    status: "ready",
    npcTest: true,
    // NPC is a testing opponent and does not deposit real Tickets.
    // Pot stays as the creator escrow so testing cannot mint extra balance.
    pot: int(game.wager, 0),
    joiner: npc,
    ready: { [game.creator.userId]: false, [npc.userId]: false },
    stats: { [game.creator.userId]: bbInitialStats(), [npc.userId]: bbInitialStats() },
    ledgerIds: { ...(game.ledgerIds || {}), npc: `bb:${game.gameId}:npc-test` }
  });
  const record = await getUserRecord(user.id);
  return { game: bbPublicGame(game, user.id), record };
}

async function basketballReady(user, gameId) {
  let game = await bbGetGameRaw(gameId);
  if (!game) throw new Error("That basketball game was not found.");
  game = await bbAutoCompleteIfNeeded(game);
  const userId = cleanUserId(user.id);
  if (!game.joiner) throw new Error("Waiting for another player to join.");
  if (![game.creator.userId, game.joiner.userId].includes(userId)) throw new Error("You are not in this basketball game.");
  if (!["ready", "countdown"].includes(game.status)) throw new Error("This game is not waiting for ready checks.");
  const ready = { ...(game.ready || {}), [userId]: true };
  if (game.joiner?.isNpc || String(game.joiner?.userId || "").startsWith("npc-")) ready[game.joiner.userId] = true;
  const bothReady = ready[game.creator.userId] && ready[game.joiner.userId];
  const at = nowIso();
  if (bothReady) {
    const startTime = new Date(Date.now() + BB_COUNTDOWN_MS).toISOString();
    const endTime = new Date(Date.now() + BB_COUNTDOWN_MS + BB_MATCH_MS).toISOString();
    game = await bbSaveGame({ ...game, status: "countdown", ready, countdownStartedAt: at, startAt: startTime, endAt: endTime });
  } else {
    game = await bbSaveGame({ ...game, status: "ready", ready });
  }
  return { game: bbPublicGame(game, userId), record: await getUserRecord(userId) };
}

async function basketballShot(user, gameId, details = {}) {
  let game = await bbGetGameRaw(gameId);
  if (!game) throw new Error("That basketball game was not found.");
  game = await bbAutoCompleteIfNeeded(game);
  const userId = cleanUserId(user.id);
  if (![game.creator.userId, game.joiner?.userId].includes(userId)) throw new Error("You are not in this basketball game.");
  if (game.status !== "playing") throw new Error("The basketball match is not live.");
  if (Date.now() > Date.parse(game.endAt || "")) {
    const complete = await bbCompleteGame(game);
    return { game: bbPublicGame(complete.savedGame, userId), record: await getUserRecord(userId) };
  }
  const made = Boolean(details.made);
  const stats = { ...(game.stats || {}) };
  const current = bbSanitizeStats(stats[userId] || bbInitialStats());
  if (made) {
    const points = current.multiplier;
    current.score = Number((current.score + points).toFixed(1));
    current.multiplier = Number((current.multiplier + 0.1).toFixed(1));
    current.made += 1;
    current.streak += 1;
    current.bestStreak = Math.max(current.bestStreak, current.streak);
  } else {
    current.multiplier = 0;
    current.missed += 1;
    current.streak = 0;
  }
  current.lastShotAt = nowIso();
  current.lastShotMade = made;
  current.lastShotSwish = Boolean(details.swish);
  stats[userId] = current;
  game = await bbSaveGame({ ...game, stats });
  return { game: bbPublicGame(game, userId), record: await getUserRecord(userId), shot: { made, stats: current } };
}

async function bbCompleteGame(game) {
  const clean = bbSanitizeGame(game);
  if (clean.status === "complete") return { savedGame: clean, record: null };
  const creatorScore = Number(clean.stats[clean.creator.userId]?.score || 0);
  const joinerScore = Number(clean.stats[clean.joiner?.userId]?.score || 0);
  const tie = Math.abs(creatorScore - joinerScore) < 0.0001;
  const winnerId = tie ? null : (creatorScore > joinerScore ? clean.creator.userId : clean.joiner.userId);
  const loserId = tie ? null : (winnerId === clean.creator.userId ? clean.joiner.userId : clean.creator.userId);
  const at = nowIso();
  const gameOdds = await getGameOddsSettings();
  const pot = clean.npcTest ? int(clean.pot, clean.wager) : int(clean.pot, clean.wager * 2);
  const payoutParts = tie ? { payout: clean.wager, houseCut: 0 } : (clean.npcTest ? { payout: pot, houseCut: 0 } : mpRealGamePayout(pot, gameOdds.multiplayer.houseCutPercent));
  let savedRecord = null;
  const ledgerIds = { ...(clean.ledgerIds || {}) };
  async function payPlayer(player, amount, type, reason) {
    if (!player?.userId || amount <= 0) return null;
    let record = await getUserRecord(player.userId);
    record = prepareLedgerRecord(record || { userId: player.userId, name: player.name || "Unknown", ledgerStartedAt: at, balanceBaseline: 0, financialLedger: [] });
    const ledgerId = `bb:${clean.gameId}:${type}:${player.userId}`;
    if (ledgerEntryIdExists(record, ledgerId)) return record;
    const ledgerResult = addLedgerEntry(record, makeLedgerEntry({
      id: ledgerId, type, delta: amount, amount, at, reason,
      meta: { gameId: clean.gameId, payout: amount, basketball: true }
    }));
    const saved = await saveUserRecord(sanitizeRecord({
      ...ledgerResult.record,
      name: player.name || ledgerResult.record.name || "Unknown",
      totalWon: int(ledgerResult.record.totalWon, 0) + amount,
      recentEvents: addEvent(ledgerResult.record.recentEvents || [], {
        type, at, gameId: clean.gameId, amount, balanceAfter: getRecordBalance(ledgerResult.record),
        message: reason
      })
    }));
    ledgerIds[`${type}-${player.userId}`] = ledgerId;
    return saved;
  }
  if (tie) {
    savedRecord = await payPlayer(clean.creator, clean.wager, "basketball_tie_refund", `Basketball game ${clean.gameId} tied. ${formatTickets(clean.wager)} was returned.`);
    await payPlayer(clean.joiner, clean.wager, "basketball_tie_refund", `Basketball game ${clean.gameId} tied. ${formatTickets(clean.wager)} was returned.`);
  } else {
    const winner = clean.creator.userId === winnerId ? clean.creator : clean.joiner;
    savedRecord = await payPlayer(winner, payoutParts.payout, "basketball_payout", `${winner.name || "Winner"} won basketball game ${clean.gameId} and received ${formatTickets(payoutParts.payout)}.`);
  }
  const savedGame = await bbSaveGame({
    ...clean, status: "complete", completedAt: at, winnerUserId: winnerId, loserUserId: loserId, tie,
    payout: tie ? clean.wager : payoutParts.payout, houseCut: payoutParts.houseCut, ledgerIds
  });
  return { savedGame, record: savedRecord };
}

async function basketballFinish(user, gameId) {
  let game = await bbGetGameRaw(gameId);
  if (!game) throw new Error("That basketball game was not found.");
  const completed = await bbCompleteGame(game);
  return { game: bbPublicGame(completed.savedGame, user.id), record: completed.record || await getUserRecord(user.id) };
}

// ---------------- Horse Track Betting ----------------
const HORSE_NAMES = [
  "Midnight Xan", "Lucky Comet", "Neon Bandit", "Cookie Dash", "Gold Rail", "Dusty Rocket",
  "Torn Thunder", "Last Stretch", "Velvet Hoof", "Fast Ledger", "Stable King", "Final Furlong"
];

const HORSE_COLORS = ["#7a3e1b", "#3f2417", "#b06a2d", "#e4dcc7", "#5c3622", "#251611"];
const HORSE_SILKS = ["#ff3f6a", "#33c9ff", "#ffd76a", "#8b5cff", "#4be27a", "#ff8d32"];
const HORSE_WEIGHTS = [31, 23, 17, 13, 9, 7];

function horseRaceCard(seed = Date.now()) {
  const names = [...HORSE_NAMES].sort(() => Math.random() - 0.5).slice(0, 6);
  const totalWeight = HORSE_WEIGHTS.reduce((a, b) => a + b, 0);
  const houseEdge = Number(DEFAULT_GAME_ODDS.horse?.houseEdgePercent || 12) / 100;
  const rtp = Math.max(0.70, Math.min(0.97, 1 - houseEdge));
  return names.map((name, index) => {
    const weight = HORSE_WEIGHTS[index] || 8;
    const probability = weight / totalWeight;
    const odds = Number(Math.max(1.35, Math.min(12, (rtp / probability))).toFixed(2));
    return {
      id: index + 1,
      lane: index + 1,
      name,
      odds,
      probability: Number(probability.toFixed(4)),
      color: HORSE_COLORS[index % HORSE_COLORS.length],
      silk: HORSE_SILKS[index % HORSE_SILKS.length],
      form: `${["A", "B", "C"][Math.min(2, Math.floor(index / 2))]} • ${["Fast Break", "Late Kick", "Rail Speed", "Wide Closer", "Dirt Pro", "Longshot"][index]}`
    };
  });
}

function horsePickWinner(runners) {
  const total = runners.reduce((sum, horse) => sum + Number(horse.probability || 0), 0) || 1;
  let roll = Math.random() * total;
  for (const horse of runners) {
    roll -= Number(horse.probability || 0);
    if (roll <= 0) return horse;
  }
  return runners[runners.length - 1];
}

function horseBuildFinishOrder(runners, winner) {
  const rest = runners.filter(horse => horse.id !== winner.id)
    .map(horse => ({ horse, score: Math.random() * 100 + Number(horse.probability || 0) * 60 }))
    .sort((a, b) => b.score - a.score)
    .map(item => item.horse);
  return [winner, ...rest].map((horse, index) => ({ ...horse, place: index + 1 }));
}

function horseBuildFrames(finishOrder, selectedHorseId) {
  const finishRank = {};
  finishOrder.forEach(horse => { finishRank[horse.id] = horse.place; });
  return finishOrder
    .map(horse => ({
      id: horse.id,
      lane: horse.lane,
      name: horse.name,
      place: horse.place,
      selected: horse.id === selectedHorseId,
      // finalPct is lane-relative: 100 means the horse nose reaches the finish line.
      // Lower places finish visibly behind the winner so the animation matches the result board.
      finishPct: Number((horse.place === 1 ? 100 : Math.max(70, 100 - (horse.place - 1) * 6.25)).toFixed(2)),
      burstAt: Number((0.18 + Math.random() * 0.52).toFixed(3)),
      wobble: Number((Math.random() * 4 + 1.4).toFixed(2))
    }))
    .sort((a, b) => a.lane - b.lane);
}

async function horseGetCard(user) {
  const record = await getUserRecord(user.id);
  if (!record || !record.userId) throw new Error(`User [${user.id}] was not found. Save/check your key first.`);
  return { record: prepareLedgerRecord(record), card: horseRaceCard() };
}

async function horseStartRace(user, details = {}) {
  const existingRaw = await getUserRecord(user.id);
  if (!existingRaw || !existingRaw.userId) throw new Error(`User [${user.id}] was not found. Save/check your key first.`);
  let existing = recoverPreviousWithdrawal(prepareLedgerRecord(existingRaw), details).record;
  const gameOdds = await getGameOddsSettings();
  const minWager = int(gameOdds.horse?.minWager, 1000) || 1000;
  const maxWager = int(gameOdds.horse?.maxWager, 50000) || 50000;
  const wager = int(details.wager, 0);
  const selectedHorseId = int(details.horseId, 0);
  if (wager < minWager) throw new Error(`Horse Track wager must be at least ${formatTickets(minWager)}.`);
  if (wager > maxWager) throw new Error(`Horse Track wager cannot be more than ${formatTickets(maxWager)}.`);
  if (wager % TICKETS_PER_XAN !== 0) throw new Error("Horse Track wagers must be in 1,000 Ticket increments.");
  const balanceBefore = getRecordBalance(existing);
  if (balanceBefore < wager) throw new Error(`Server balance is only ${formatTickets(balanceBefore)}, not enough for a ${formatTickets(wager)} horse bet.`);

  const runners = Array.isArray(details.runners) && details.runners.length === 6
    ? details.runners.map((horse, index) => ({
        id: int(horse.id, index + 1),
        lane: index + 1,
        name: String(horse.name || HORSE_NAMES[index] || `Horse ${index + 1}`).slice(0, 40),
        odds: Number.isFinite(Number(horse.odds)) ? Number(Number(horse.odds).toFixed(2)) : 2,
        probability: Number.isFinite(Number(horse.probability)) ? Number(horse.probability) : (HORSE_WEIGHTS[index] || 8) / 100,
        color: String(horse.color || HORSE_COLORS[index % HORSE_COLORS.length]).slice(0, 20),
        silk: String(horse.silk || HORSE_SILKS[index % HORSE_SILKS.length]).slice(0, 20),
        form: String(horse.form || "").slice(0, 80)
      }))
    : horseRaceCard();

  const selected = runners.find(horse => horse.id === selectedHorseId);
  if (!selected) throw new Error("Choose a horse from the odds board before starting the race.");

  const at = nowIso();
  const gameId = `horse-${cleanUserId(user.id)}-${Date.now()}-${crypto.randomBytes(5).toString("hex")}`.slice(0, 100);
  const betLedger = addLedgerEntry(existing, makeLedgerEntry({
    id: `horse:${gameId}:bet`,
    type: "horse_bet",
    delta: -wager,
    amount: wager,
    at,
    ticketId: gameId,
    reason: `Horse Track bet on ${selected.name}`,
    meta: { horseId: selected.id, horseName: selected.name, odds: selected.odds }
  }));

  const winner = horsePickWinner(runners);
  const finishOrder = horseBuildFinishOrder(runners, winner);
  const won = winner.id === selected.id;
  const payout = won ? int(Math.floor(wager * Number(selected.odds || 0)), 0) : 0;

  let afterRecord = betLedger.record;
  if (payout > 0) {
    const payoutLedger = addLedgerEntry(afterRecord, makeLedgerEntry({
      id: `horse:${gameId}:payout`,
      type: "horse_payout",
      delta: payout,
      amount: payout,
      at,
      ticketId: gameId,
      reason: `Horse Track win on ${selected.name}`,
      meta: { horseId: selected.id, horseName: selected.name, odds: selected.odds }
    }));
    afterRecord = payoutLedger.record;
  }

  const balanceAfter = getRecordBalance(afterRecord);
  const game = {
    gameId,
    status: "complete",
    wager,
    selectedHorseId: selected.id,
    selectedHorseName: selected.name,
    selectedOdds: selected.odds,
    winnerHorseId: winner.id,
    winnerHorseName: winner.name,
    won,
    payout,
    startedAt: at,
    completedAt: at,
    runners,
    finishOrder,
    frames: horseBuildFrames(finishOrder, selected.id)
  };

  const saved = await saveUserRecord(sanitizeRecord({
    ...afterRecord,
    name: user.name || afterRecord.name || "Unknown",
    betCount: int(afterRecord.betCount, 0) + 1,
    totalWagered: int(afterRecord.totalWagered, 0) + wager,
    totalWon: int(afterRecord.totalWon, 0) + payout,
    lastBetAt: at,
    lastHorseRace: game,
    recentEvents: addEvent(afterRecord.recentEvents || [], {
      type: won ? "horse_win" : "horse_loss",
      at,
      gameId,
      wager,
      payout,
      balanceBefore,
      balanceAfter,
      message: `${afterRecord.name || user.name || "Unknown"} [${afterRecord.userId}] bet ${formatTickets(wager)} on ${selected.name} at ${selected.odds}x. Winner: ${winner.name}. ${won ? `Payout ${formatTickets(payout)}.` : "Lost."}`
    })
  }));

  return { record: saved, game };
}


// ---------------- Eight Arcade Games ----------------
const ARCADE_GAME_NAMES = {
  plinko: "Plinko",
  mines: "Mines",
  crash: "Crash",
  higherlower: "Higher or Lower",
  wheel: "Wheel Spin",
  dice: "Dice Roll",
  chest: "Treasure Chest",
  soccer: "Soccer Shootout"
};
const ARCADE_MIN_WAGER = 1000;
const ARCADE_MAX_WAGER = 50000;

function arcadeWeightedPick(items = []) {
  const total = items.reduce((sum, item) => sum + Number(item.weight || 0), 0) || 1;
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= Number(item.weight || 0);
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

function arcadeResultFor(game, details = {}) {
  const choice = String(details.choice || "").toLowerCase();
  if (game === "plinko") {
    const slots = [
      { multiplier: 0, label: "Lose", weight: 30, slot: 0 },
      { multiplier: 0.5, label: "0.5x", weight: 20, slot: 1 },
      { multiplier: 1, label: "1x", weight: 18, slot: 2 },
      { multiplier: 1.5, label: "1.5x", weight: 14, slot: 3 },
      { multiplier: 2, label: "2x", weight: 10, slot: 4 },
      { multiplier: 5, label: "5x", weight: 6, slot: 5 },
      { multiplier: 10, label: "10x", weight: 2, slot: 6 }
    ];
    const picked = arcadeWeightedPick(slots);
    return { game, choice, multiplier: picked.multiplier, label: picked.label, slot: picked.slot, path: Array.from({length: 8}, () => Math.random() < 0.5 ? -1 : 1) };
  }
  if (game === "wheel") {
    const slices = [
      { multiplier: 0, label: "Lose", weight: 36, slice: 0 },
      { multiplier: 0.5, label: "0.5x", weight: 18, slice: 1 },
      { multiplier: 1, label: "1x", weight: 16, slice: 2 },
      { multiplier: 2, label: "2x", weight: 13, slice: 3 },
      { multiplier: 3, label: "3x", weight: 9, slice: 4 },
      { multiplier: 5, label: "5x", weight: 5, slice: 5 },
      { multiplier: 10, label: "10x", weight: 2.5, slice: 6 },
      { multiplier: 25, label: "25x", weight: 0.5, slice: 7 }
    ];
    const picked = arcadeWeightedPick(slices);
    return { game, choice, multiplier: picked.multiplier, label: picked.label, slice: picked.slice, spinDegrees: 1440 + (picked.slice * 45) + Math.floor(Math.random() * 26) };
  }
  if (game === "dice") {
    const mode = choice === "over" ? "over" : "under";
    const roll = Math.floor(Math.random() * 100) + 1;
    const won = mode === "under" ? roll < 50 : roll > 51;
    return { game, choice: mode, roll, multiplier: won ? 1.9 : 0, label: won ? "1.9x" : "Lose" };
  }
  if (game === "higherlower") {
    const current = int(details.current, Math.floor(Math.random() * 13) + 1);
    const guess = choice === "lower" ? "lower" : "higher";
    let next = Math.floor(Math.random() * 13) + 1;
    if (next === current) next = Math.min(13, current + 1);
    const won = guess === "higher" ? next > current : next < current;
    return { game, choice: guess, current, next, multiplier: won ? 1.85 : 0, label: won ? "1.85x" : "Lose" };
  }
  if (game === "chest") {
    const chest = Math.max(1, Math.min(6, int(details.chest, 1)));
    const prizes = [
      { multiplier: 0, label: "Empty", weight: 38 },
      { multiplier: 1, label: "Refund", weight: 18 },
      { multiplier: 1.5, label: "1.5x", weight: 18 },
      { multiplier: 2, label: "2x", weight: 13 },
      { multiplier: 4, label: "4x", weight: 8 },
      { multiplier: 8, label: "8x", weight: 4 },
      { multiplier: 15, label: "15x", weight: 1 }
    ];
    const picked = arcadeWeightedPick(prizes);
    const reveal = Array.from({length: 6}, (_, i) => i + 1 === chest ? picked.multiplier : arcadeWeightedPick(prizes).multiplier);
    return { game, choice: String(chest), chest, reveal, multiplier: picked.multiplier, label: picked.label };
  }
  if (game === "soccer") {
    const zones = ["left", "middle", "right"];
    const shot = zones.includes(choice) ? choice : "middle";
    const goalie = zones[Math.floor(Math.random() * zones.length)];
    const won = shot !== goalie;
    return { game, choice: shot, goalie, multiplier: won ? 2 : 0, label: won ? "GOAL 2x" : "SAVED" };
  }
  if (game === "crash") {
    const target = Math.max(1.25, Math.min(10, Number(details.target || 2)));
    const r = Math.random();
    const crashAt = Number(Math.max(1.01, Math.min(25, 0.95 / Math.max(0.04, r))).toFixed(2));
    const won = crashAt >= target;
    return { game, choice: String(target), target, crashAt, multiplier: won ? target : 0, label: won ? `${target.toFixed(2)}x` : `Crashed at ${crashAt.toFixed(2)}x` };
  }
  if (game === "mines") {
    const pick = Math.max(1, Math.min(12, int(details.tile, 1)));
    const mineCount = Math.max(2, Math.min(5, int(details.mines, 3)));
    const mines = new Set();
    while (mines.size < mineCount) mines.add(Math.floor(Math.random() * 12) + 1);
    const hitMine = mines.has(pick);
    const multiplier = hitMine ? 0 : Number((1 + mineCount * 0.32).toFixed(2));
    return { game, choice: String(pick), pick, mines: [...mines], mineCount, multiplier, label: hitMine ? "Mine" : `${multiplier}x` };
  }
  throw new Error("Unknown arcade game.");
}

async function arcadePlayGame(user, details = {}) {
  const existingRaw = await getUserRecord(user.id);
  if (!existingRaw || !existingRaw.userId) throw new Error(`User [${user.id}] was not found. Save/check your key first.`);
  let existing = recoverPreviousWithdrawal(prepareLedgerRecord(existingRaw), details).record;
  const game = String(details.game || "").toLowerCase().replace(/[^a-z]/g, "");
  if (!ARCADE_GAME_NAMES[game]) throw new Error("Choose one of the arcade games first.");
  const wager = int(details.wager, 0);
  if (wager < ARCADE_MIN_WAGER) throw new Error(`Arcade wager must be at least ${formatTickets(ARCADE_MIN_WAGER)}.`);
  if (wager > ARCADE_MAX_WAGER) throw new Error(`Arcade wager cannot be more than ${formatTickets(ARCADE_MAX_WAGER)}.`);
  if (wager % TICKETS_PER_XAN !== 0) throw new Error("Arcade wagers must be in 1,000 Ticket increments.");
  const balanceBefore = getRecordBalance(existing);
  if (balanceBefore < wager) throw new Error(`Server balance is only ${formatTickets(balanceBefore)}, not enough for a ${formatTickets(wager)} arcade bet.`);

  const at = nowIso();
  const gameId = `arcade-${game}-${cleanUserId(user.id)}-${Date.now()}-${crypto.randomBytes(5).toString("hex")}`.slice(0, 110);
  const result = arcadeResultFor(game, details);
  const payout = int(Math.floor(wager * Number(result.multiplier || 0)), 0);

  const betLedger = addLedgerEntry(existing, makeLedgerEntry({
    id: `arcade:${gameId}:bet`,
    type: `arcade_${game}_bet`.slice(0, 60),
    delta: -wager,
    amount: wager,
    at,
    ticketId: gameId,
    reason: `${ARCADE_GAME_NAMES[game]} bet placed`,
    meta: { game, choice: result.choice || "" }
  }));
  let afterRecord = betLedger.record;
  if (payout > 0) {
    const payoutLedger = addLedgerEntry(afterRecord, makeLedgerEntry({
      id: `arcade:${gameId}:payout`,
      type: `arcade_${game}_payout`.slice(0, 60),
      delta: payout,
      amount: payout,
      at,
      ticketId: gameId,
      reason: `${ARCADE_GAME_NAMES[game]} payout`,
      meta: { game, multiplier: result.multiplier, label: result.label }
    }));
    afterRecord = payoutLedger.record;
  }

  const balanceAfter = getRecordBalance(afterRecord);
  const saved = await saveUserRecord(sanitizeRecord({
    ...afterRecord,
    name: user.name || afterRecord.name || "Unknown",
    betCount: int(afterRecord.betCount, 0) + 1,
    totalWagered: int(afterRecord.totalWagered, 0) + wager,
    totalWon: int(afterRecord.totalWon, 0) + payout,
    lastBetAt: at,
    lastArcadeGame: { gameId, game, wager, payout, result, at },
    recentEvents: addEvent(afterRecord.recentEvents || [], {
      type: payout > 0 ? "arcade_win" : "arcade_loss",
      at,
      gameId,
      wager,
      payout,
      balanceBefore,
      balanceAfter,
      message: `${afterRecord.name || user.name || "Unknown"} [${afterRecord.userId}] played ${ARCADE_GAME_NAMES[game]} for ${formatTickets(wager)}. ${payout > 0 ? `Payout ${formatTickets(payout)}.` : "Lost."}`
    })
  }));

  return { record: saved, game: { gameId, game, name: ARCADE_GAME_NAMES[game], wager, payout, result, won: payout > 0, balanceAfter } };
}


// ---------------- Multiplayer Arcade Duels ----------------
// MULTIPLAYER_COHESION_V6
const {
  MULTIPLAYER_CONTRACT_VERSION,
  MODE_NAMES: DUEL_MODES,
  supportsRematch: duelSupportsRematch,
  supportsSyntheticOpponent: duelSupportsSyntheticOpponent,
  countdownMs: duelCountdownMs
} = require("./multiplayer-contract");
const DUEL_GAME_PREFIX = "duel-game/";
const DUEL_ACTIVE_PREFIX = "duel-active/";
const DUEL_SCHEMA_VERSION = 3;
const DUEL_WAITING_TTL_MS = 30 * 60 * 1000;
const DUEL_ACTIVE_TTL_MS = 2 * 60 * 60 * 1000;
const DUEL_VALID_WAGER_MIN = 1000;
const DUEL_VALID_WAGER_MAX = 50000;
function duelGameKey(gameId) { return `${DUEL_GAME_PREFIX}${mpCleanId(gameId)}.json`; }
function duelActiveKey(userId) { return `${DUEL_ACTIVE_PREFIX}${cleanUserId(userId)}.json`; }
function duelIsActiveStatus(status) { return ["waiting","ready","countdown","playing"].includes(String(status||"")); }
function duelIsExpired(game, nowMs = Date.now()) {
  if (!duelIsActiveStatus(game?.status)) return false;
  const stamp = Date.parse(game.updatedAt || game.createdAt || "");
  if (!Number.isFinite(stamp)) return true;
  const ttl = game.status === "waiting" ? DUEL_WAITING_TTL_MS : DUEL_ACTIVE_TTL_MS;
  return nowMs - stamp > ttl;
}
function duelHasValidSchema(game) {
  if (!game || int(game.schemaVersion,0) !== DUEL_SCHEMA_VERSION || !game.gameId || !DUEL_MODES[game.mode]) return false;
  if (!game.creator?.userId || !duelIsActiveStatus(game.status)) return true;
  if (["ready","countdown","playing"].includes(game.status) && !game.joiner?.userId) return false;
  if (game.mode === "fishing" && ["countdown","playing"].includes(game.status)) {
    const st=game.fishingState||{};
    const start=Date.parse(st.startAt||""), end=Date.parse(st.endAt||"");
    if (!st.roundId || !Number.isFinite(start) || !Number.isFinite(end) || end-start !== 60000 || !Array.isArray(st.events) || !st.catches || typeof st.catches!=="object") return false;
  }
  if (game.mode === "safecracker" && ["countdown","playing"].includes(game.status) && !safeCrackerHasValidState(game)) return false;
  if (game.mode === "mountainrace" && ["countdown","playing"].includes(game.status) && !mountainRaceHasValidState(game)) return false;
  return true;
}
async function duelSetActivePointer(userId, game) {
  const id=cleanUserId(userId); if(!id) return;
  const store=getUsersStore();
  if(game && duelIsActiveStatus(game.status)) await store.setJSON(duelActiveKey(id), {schemaVersion:DUEL_SCHEMA_VERSION,gameId:game.gameId,mode:game.mode,updatedAt:nowIso()});
  else if(typeof store.delete === "function") { try { await store.delete(duelActiveKey(id)); } catch {} }
}
async function duelClearPointers(game) {
  await Promise.all([game?.creator?.userId,game?.joiner?.userId].filter(Boolean).map(id=>duelSetActivePointer(id,null)));
}
async function duelFindActiveGameForUser(userId, excludeGameId="", options={}) {
  const viewer=cleanUserId(userId), excluded=mpCleanId(excludeGameId); if(!viewer) return null;
  const store=getUsersStore();
  try {
    const pointer=await store.get(duelActiveKey(viewer),{type:"json",consistency:"strong"});
    if(pointer?.gameId && pointer.schemaVersion===DUEL_SCHEMA_VERSION && mpCleanId(pointer.gameId)!==excluded){
      const g=await duelGetRawStrong(pointer.gameId,2) || await duelGetRaw(pointer.gameId);
      if(g && duelIsActiveStatus(g.status) && !duelIsExpired(g) && duelHasValidSchema(g) && [g.creator?.userId,g.joiner?.userId].map(cleanUserId).includes(viewer)) return g;
      await duelSetActivePointer(viewer,null);
    }
  } catch {}
  // Creating a game uses the authoritative active pointer only. Falling back to
  // a full Blob scan made every create increasingly slow as historical games grew.
  if(options?.scanFallback===false) return null;
  try {
    const listed=await store.list({prefix:DUEL_GAME_PREFIX});
    const entries=Array.isArray(listed?.blobs)?listed.blobs:[];
    const batchSize=8;
    for(let offset=0;offset<entries.length;offset+=batchSize){
      const batch=await Promise.all(entries.slice(offset,offset+batchSize).map(async entry=>{
        try{
          const raw=await store.get(entry.key,{type:"json"});if(!raw)return null;
          const g=duelSanitizeGame(raw);
          if(excluded&&g.gameId===excluded)return null;
          if(!duelIsActiveStatus(g.status)||duelIsExpired(g)||!duelHasValidSchema(g))return null;
          return [g.creator?.userId,g.joiner?.userId].map(cleanUserId).includes(viewer)?g:null;
        }catch{return null}
      }));
      const found=batch.find(Boolean);
      if(found){await duelSetActivePointer(viewer,found);return found}
    }
  } catch {}
  return null;
}


function duelSanitizePlayer(player = {}) {
  return mpPublicPlayer(player);
}

function duelSanitizeGame(game = {}) {
  const mode = String(game.mode || "coin").toLowerCase();
  return {
    schemaVersion: int(game.schemaVersion, 0),
    gameId: mpCleanId(game.gameId || ""),
    mode: DUEL_MODES[mode] ? mode : "coin",
    modeName: DUEL_MODES[mode] || DUEL_MODES.coin,
    status: ["waiting", "ready", "countdown", "playing", "complete", "cancelled"].includes(String(game.status || "")) ? String(game.status) : "waiting",
    wager: int(game.wager, 0),
    pot: int(game.pot, 0),
    createdAt: game.createdAt || nowIso(),
    updatedAt: game.updatedAt || nowIso(),
    completedAt: game.completedAt || null,
    revision: int(game.revision, 0),
    creator: duelSanitizePlayer(game.creator || {}),
    joiner: game.joiner ? duelSanitizePlayer(game.joiner) : null,
    actions: game.actions && typeof game.actions === "object" ? game.actions : {},
    result: game.result && typeof game.result === "object" ? game.result : null,
    winnerUserId: cleanUserId(game.winnerUserId || ""),
    loserUserId: cleanUserId(game.loserUserId || ""),
    tie: Boolean(game.tie),
    payout: int(game.payout, 0),
    houseCut: int(game.houseCut, 0),
    npcTest: Boolean(game.npcTest),
    remoteNetworkTest: Boolean(game.remoteNetworkTest),
    remoteNetworkProfile: ["normal", "mobile", "bad", "stress"].includes(String(game.remoteNetworkProfile || "")) ? String(game.remoteNetworkProfile) : "",
    remoteNetworkConfig: game.remoteNetworkConfig && typeof game.remoteNetworkConfig === "object" ? {
      label: String(game.remoteNetworkConfig.label || "").slice(0, 40),
      minDelayMs: Math.max(100, int(game.remoteNetworkConfig.minDelayMs, 100)),
      maxDelayMs: Math.max(Math.max(100, int(game.remoteNetworkConfig.minDelayMs, 100)), int(game.remoteNetworkConfig.maxDelayMs, 400)),
      stallChance: Math.max(0, Math.min(1, Number(game.remoteNetworkConfig.stallChance) || 0)),
      duplicateChance: Math.max(0, Math.min(1, Number(game.remoteNetworkConfig.duplicateChance) || 0)),
      reconnectChance: Math.max(0, Math.min(1, Number(game.remoteNetworkConfig.reconnectChance) || 0))
    } : null,
    testPlayerMode: Boolean(game.testPlayerMode),
    testControllerUserId: cleanUserId(game.testControllerUserId || ""),
    blackjackState: game.blackjackState && typeof game.blackjackState === "object" ? game.blackjackState : null,
    drawState: game.drawState && typeof game.drawState === "object" ? game.drawState : null,
    fishingState: game.fishingState && typeof game.fishingState === "object" ? game.fishingState : null,
    rouletteState: game.rouletteState && typeof game.rouletteState === "object" ? game.rouletteState : null,
    safecrackerState: game.safecrackerState && typeof game.safecrackerState === "object" ? game.safecrackerState : null,
    mountainraceState: game.mountainraceState && typeof game.mountainraceState === "object" ? game.mountainraceState : null,
    ready: game.ready && typeof game.ready === "object" ? game.ready : {},
    readyWindowStartedAt: game.readyWindowStartedAt || null,
    readyDeadlineAt: game.readyDeadlineAt || null,
    readyWindowId: game.readyWindowId || null,
    npcReadyWindowId: game.npcReadyWindowId || null,
    countdownStartedAt: game.countdownStartedAt || null,
    startAt: game.startAt || null,
    npcReadyAt: game.npcReadyAt || null,
    npcActionAt: game.npcActionAt || null,
    ledgerIds: game.ledgerIds && typeof game.ledgerIds === "object" ? game.ledgerIds : {},
    rematch: game.rematch && typeof game.rematch === "object" ? game.rematch : null,
    rematchGameId: mpCleanId(game.rematchGameId || "")
  };
}

function duelPublicGame(game = {}, viewerUserId = "") {
  const clean = duelSanitizeGame(game);
  const viewer = cleanUserId(viewerUserId);
  const myAction = clean.actions?.[viewer] || null;
  const creatorAction = clean.actions?.[clean.creator?.userId] || null;
  const joinerAction = clean.joiner?.userId ? clean.actions?.[clean.joiner.userId] || null : null;
  const isPlayer = viewer && (clean.creator.userId === viewer || clean.joiner?.userId === viewer);
  const bjState = clean.mode === "blackjack" ? bjPublicTournamentState(clean, viewer) : clean.blackjackState;
  const bjPhase = bjState?.phase || "";
  const myBjHand = bjState?.hands?.[viewer] || null;
  const myBjBet = bjState?.roundBets?.[viewer] || 0;
  const blackjackCanBet = clean.mode === "blackjack" && clean.status === "playing" && isPlayer && bjPhase === "betting" && !myBjBet && int(bjState?.stacks?.[viewer], 0) > 0;
  const blackjackCanPlay = clean.mode === "blackjack" && clean.status === "playing" && isPlayer && bjPhase === "playing" && myBjHand && myBjHand.status === "active";
  const blackjackCanAdvance = clean.mode === "blackjack" && clean.status === "playing" && isPlayer && bjPhase === "round_result";
  const drawState = clean.mode === "draw" ? ((clean.status === "playing" || clean.status === "countdown") ? drawPublicState(clean, viewer) : null) : clean.drawState;
  const fishingState = clean.mode === "fishing" ? fishingPublicState(clean, viewer) : clean.fishingState;
  const rouletteState = clean.mode === "roulette" ? roulettePublicState(clean, viewer) : clean.rouletteState;
  const safecrackerState = clean.mode === "safecracker" ? safeCrackerPublicState(clean, viewer) : clean.safecrackerState;
  const mountainraceState = clean.mode === "mountainrace" ? mountainRacePublicState(clean, viewer) : clean.mountainraceState;
  const drawCanAct = clean.mode === "draw" && clean.status === "playing" && isPlayer && drawState && Date.now() < Date.parse(drawState.endAt || 0);
  const readyDeadlineMs = clean.readyDeadlineAt ? Date.parse(clean.readyDeadlineAt) : 0;
  const startMs = clean.startAt ? Date.parse(clean.startAt) : (drawState?.startAt ? Date.parse(drawState.startAt) : 0);
  const testPlayerId = clean.joiner?.isTestPlayer ? cleanUserId(clean.joiner.userId) : "";
  const canControlTestPlayer = Boolean(testPlayerId && clean.testControllerUserId && [clean.testControllerUserId, testPlayerId].includes(viewer));
  return {
    ...clean,
    // One authoritative clock sample for the complete arcade lifecycle. Clients
    // anchor it once per game phase instead of re-synchronizing on every poll.
    serverNow: new Date().toISOString(),
    blackjackState: bjState,
    drawState,
    fishingState,
    rouletteState,
    safecrackerState,
    mountainraceState,
    actions: clean.status === "complete" ? clean.actions : undefined,
    myAction,
    myBlackjackHand: myBjHand,
    dealerVisibleCards: bjState?.dealer || [],
    creatorReady: ["ready","countdown"].includes(clean.status) ? Boolean(clean.ready?.[clean.creator?.userId]) : (clean.mode === "blackjack" ? bjTournamentPlayerReady(clean, clean.creator?.userId) : Boolean(creatorAction)),
    joinerReady: ["ready","countdown"].includes(clean.status) ? Boolean(clean.ready?.[clean.joiner?.userId]) : (clean.mode === "blackjack" ? bjTournamentPlayerReady(clean, clean.joiner?.userId) : Boolean(joinerAction)),
    isCreator: viewer && clean.creator.userId === viewer,
    isJoiner: viewer && clean.joiner?.userId === viewer,
    isPlayer,
    canControlTestPlayer,
    controlPerspective: testPlayerId && viewer === testPlayerId ? "test" : "human",
    canJoin: clean.status === "waiting" && viewer && clean.creator.userId !== viewer,
    canReady: clean.status === "ready" && isPlayer && !Boolean(clean.ready?.[viewer]),
    readySecondsLeft: readyDeadlineMs ? Math.max(0, Math.ceil((readyDeadlineMs - Date.now()) / 1000)) : 10,
    countdownSeconds: clean.status === "countdown" && startMs ? Math.max(0, Math.ceil((startMs - Date.now()) / 1000)) : 0,
    canCancel: clean.status === "waiting" && viewer && clean.creator.userId === viewer && !clean.joiner,
    canAdvanceRound: blackjackCanAdvance,
    canAct: clean.mode === "blackjack" ? (blackjackCanBet || blackjackCanPlay || blackjackCanAdvance) : clean.mode === "draw" ? drawCanAct : clean.mode === "fishing" ? (clean.status === "playing" && isPlayer && !fishingState?.myCatch) : clean.mode === "roulette" ? rouletteCanAct(clean, viewer) : clean.mode === "safecracker" ? Boolean(safecrackerState?.canSubmit) : clean.mode === "mountainrace" ? Boolean(mountainraceState?.canSubmit) : (clean.status === "playing" && isPlayer && !myAction)
  };
}

async function duelGetRaw(gameId, options = {}) {
  const id = mpCleanId(gameId);
  if (!id) return null;
  try {
    const readOptions = { type: "json" };
    if (options?.consistency === "strong") readOptions.consistency = "strong";
    const raw = await getUsersStore().get(duelGameKey(id), readOptions);
    return raw ? duelSanitizeGame(raw) : null;
  } catch {
    return null;
  }
}

function duelGetStrongStore() {
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID || "";
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_TOKEN || "";
  const options = { name: STORE_NAME, consistency: "strong" };
  if (siteID) options.siteID = siteID;
  if (token) options.token = token;
  return getStore(options);
}

async function duelGetRawStrong(gameId, attempts = 4) {
  const id = mpCleanId(gameId);
  if (!id) return null;
  const total = Math.max(1, Math.min(6, int(attempts, 4)));
  const primaryStore = getUsersStore();
  let explicitStrongStore = null;
  for (let attempt = 0; attempt < total; attempt++) {
    try {
      const raw = await primaryStore.get(duelGameKey(id), { type: "json", consistency: "strong" });
      if (raw) return duelSanitizeGame(raw);
    } catch {}
    try {
      explicitStrongStore ||= duelGetStrongStore();
      const raw = await explicitStrongStore.get(duelGameKey(id), { type: "json", consistency: "strong" });
      if (raw) return duelSanitizeGame(raw);
    } catch {}
    if (attempt + 1 < total) await sleep(Math.min(900, 180 * (attempt + 1)));
  }
  return null;
}

async function duelSaveGame(game) {
  const clean = duelSanitizeGame({ ...game, schemaVersion: DUEL_SCHEMA_VERSION, revision: int(game?.revision, 0) + 1, updatedAt: nowIso() });
  await getUsersStore().setJSON(duelGameKey(clean.gameId), clean);
  if (duelIsActiveStatus(clean.status)) await Promise.all([clean.creator?.userId,clean.joiner?.userId].filter(Boolean).map(id=>duelSetActivePointer(id,clean)));
  else await duelClearPointers(clean);
  return clean;
}

async function duelInvalidateLegacyGame(game, reason="Incompatible multiplayer game state") {
  if(!game || !duelIsActiveStatus(game.status)) return game;
  const at=nowIso();
  if(game.creator?.userId) await duelPayPlayer(game.creator,int(game.wager,0),game,"duel_legacy_refund",`${reason} Your wager was returned.`);
  if(game.joiner?.userId && !game.joiner?.isNpc) await duelPayPlayer(game.joiner,int(game.wager,0),game,"duel_legacy_refund",`${reason} Your wager was returned.`);
  return await duelSaveGame({...game,status:"cancelled",completedAt:at,result:{mode:game.mode,cancelled:true,text:reason},pot:0,payout:0,houseCut:0});
}
async function duelCleanupLegacyGames() {
  const store=getUsersStore(); let scanned=0,cancelled=0,expired=0,invalid=0;
  const listed = await store.list({ prefix: DUEL_GAME_PREFIX });
  for (const entry of (listed?.blobs || [])) {
    try { const raw=await store.get(entry.key,{type:"json"}); if(!raw) continue; scanned++; const g=duelSanitizeGame(raw);
      if(!duelIsActiveStatus(g.status)) continue; const isExpired=duelIsExpired(g), isInvalid=!duelHasValidSchema(g);
      if(isExpired||isInvalid){ await duelInvalidateLegacyGame(g,isExpired?"Abandoned multiplayer game expired.":"Legacy multiplayer game was incompatible with the current server."); cancelled++; if(isExpired)expired++; if(isInvalid)invalid++; }
      else { await Promise.all([g.creator?.userId,g.joiner?.userId].filter(Boolean).map(id=>duelSetActivePointer(id,g))); }
    } catch(e){ console.error("[duel cleanup]",e.message||e); }
  }
  return {scanned,cancelled,expired,invalid,schemaVersion:DUEL_SCHEMA_VERSION};
}

async function duelEnsureSchemaMigration() {
  const store=getUsersStore();
  const key=`duel-migration/schema-v${DUEL_SCHEMA_VERSION}.json`;
  try { const done=await store.get(key,{type:"json"}); if(done?.complete) return done; } catch {}
  const result=await duelCleanupLegacyGames();
  const marker={complete:true,completedAt:nowIso(),...result};
  await store.setJSON(key,marker);
  return marker;
}

async function duelListGames(user) {
  await duelEnsureSchemaMigration();
  const viewer = cleanUserId(user.id);
  const store = getUsersStore();
  const games = [];
  const recordPromise = getUserRecord(viewer);
  try {
    const listed = await store.list({ prefix: DUEL_GAME_PREFIX });
    const entries = Array.isArray(listed?.blobs) ? listed.blobs : [];
    const batchSize = 8;
    for (let offset = 0; offset < entries.length; offset += batchSize) {
      const batch = await Promise.all(entries.slice(offset, offset + batchSize).map(async entry => {
        try {
          const game = await store.get(entry.key, { type: "json" });
          if (!game) return null;
          let clean = duelSanitizeGame(game);
          if (duelIsActiveStatus(clean.status) && (duelIsExpired(clean) || !duelHasValidSchema(clean))) {
            clean = await duelInvalidateLegacyGame(clean, "Expired or incompatible multiplayer game state.");
          }
          if (["ready", "countdown"].includes(clean.status)) {
            const normalized = duelNormalizeReadyState(clean);
            if (JSON.stringify(normalized) !== JSON.stringify(clean)) clean = await duelSaveGame(normalized);
          }
          if (!["waiting", "ready", "countdown", "playing", "complete"].includes(clean.status)) return null;
          const viewerIsPlayer = clean.creator?.userId === viewer || clean.joiner?.userId === viewer;
          if (clean.mode === "draw" && clean.status === "playing" && viewerIsPlayer) {
            try {
              const databaseState = await drawDatabaseState(clean, { runNpc: true });
              clean = { ...clean, drawState: databaseState };
              clean = await drawMaybeCompleteDatabase(clean);
            } catch (error) {
              console.error("[duel list draw hydrate]", error.message || error);
              return null;
            }
          }
          if (clean.mode === "fishing" && clean.status === "playing" && viewerIsPlayer) {
            try {
              const databaseState = await fishingDatabaseState(clean, { runNpc: true });
              clean = { ...clean, fishingState: databaseState };
              clean = await fishingMaybeCompleteDatabase(clean);
            } catch (error) {
              console.error("[duel list fishing hydrate]", error.message || error);
              return null;
            }
          }
          return duelPublicGame(clean, viewer);
        } catch {
          return null;
        }
      }));
      for (const publicGame of batch) if (publicGame) games.push(publicGame);
    }
  } catch {}
  games.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  return { games: games.slice(0, 40), record: await recordPromise };
}

async function duelFindActiveFishingGameForUser(userId, excludeGameId = "") {
  const viewer = cleanUserId(userId);
  const excluded = mpCleanId(excludeGameId);
  if (!viewer) return null;
  const store = getUsersStore();
  try {
    const listed = await store.list({ prefix: DUEL_GAME_PREFIX });
    for (const entry of (listed?.blobs || [])) {
      try {
        const raw = await store.get(entry.key, { type: "json" });
        if (!raw) continue;
        const game = duelSanitizeGame(raw);
        if (game.mode !== "fishing" || !["waiting", "ready", "countdown", "playing"].includes(game.status)) continue;
        if (excluded && mpCleanId(game.gameId) === excluded) continue;
        if (cleanUserId(game.creator?.userId) === viewer || cleanUserId(game.joiner?.userId) === viewer) return game;
      } catch {}
    }
  } catch {}
  return null;
}

function duelClientCreateGameId(mode, value) {
  const candidate=mpCleanId(value||"");
  if(!candidate)return "";
  const pattern=new RegExp(`^duel-${mode}-\\d{10,16}-[a-f0-9]{10,32}$`);
  return pattern.test(candidate)?candidate:"";
}

async function duelCreateGame(user, details = {}) {
  await duelEnsureSchemaMigration();
  const mode = String(details.mode || "coin").toLowerCase();
  if (!DUEL_MODES[mode]) throw new Error("Choose a valid multiplayer arcade game.");
  const wager = int(details.wager, 0);
  if (wager < DUEL_VALID_WAGER_MIN || wager > DUEL_VALID_WAGER_MAX || wager % TICKETS_PER_XAN !== 0) {
    throw new Error("Choose a wager from 1,000 to 50,000 Tickets in 1,000 Ticket increments.");
  }

  const suppliedClientGameId=String(details.clientGameId||"").trim();
  const clientGameId=duelClientCreateGameId(mode,suppliedClientGameId);
  if(suppliedClientGameId&&!clientGameId)throw new Error("The create request ID was invalid. Please try again.");

  if(clientGameId){
    // Never issue an eventually-consistent GET for a proposed new key.
    // A cached 404 can outlive the subsequent write and make Ready/polling
    // report that the successfully-created game does not exist.
    const existing=await duelGetRawStrong(clientGameId,2);
    if(existing){
      const clean=duelSanitizeGame(existing);
      if(cleanUserId(clean.creator?.userId)!==cleanUserId(user.id)||clean.mode!==mode||Number(clean.wager)!==wager){
        throw new Error("That create request ID belongs to a different game.");
      }
      const record=await getUserRecord(user.id);
      return {game:duelPublicGame(clean,user.id),record,recoveredCreate:true};
    }
  }

  let activeGame = await duelFindActiveGameForUser(user.id,"",{scanFallback:false});
  if (activeGame && activeGame.mode !== mode) {
    const syntheticOpponent = [activeGame.creator, activeGame.joiner].find(player => player?.isNpc || player?.isRemoteBot || String(player?.userId || "").startsWith("npc-") || String(player?.userId || "").startsWith("remote-bot-"));
    if (syntheticOpponent) {
      // Switching test modes may safely retire an unfinished synthetic match.
      // Real-player games are never cancelled or hidden automatically.
      await duelAbandonNpcGame(user, activeGame.gameId);
      activeGame = null;
    } else {
      return {
        game: duelPublicGame(activeGame, user.id),
        record: await getUserRecord(user.id),
        activeModeConflict: true,
        requestedMode: mode
      };
    }
  }
  if (activeGame) {
    return {game:duelPublicGame(activeGame,user.id),record:await getUserRecord(user.id),resumedExisting:true};
  }

  let record = await getUserRecord(user.id);
  record = prepareLedgerRecord(record || { userId: String(user.id), name: user.name || "Unknown", ledgerStartedAt: nowIso(), balanceBaseline: 0, financialLedger: [] });
  const balanceBefore = getRecordBalance(record);
  if (balanceBefore < wager) throw new Error(`You need ${formatTickets(wager)} to create this duel.`);
  const at = nowIso();
  const gameId = clientGameId || `duel-${mode}-${Date.now()}-${crypto.randomBytes(5).toString("hex")}`;
  const ledgerId = `duel:${gameId}:creator-escrow`;
  const ledgerResult = addLedgerEntry(record, makeLedgerEntry({
    id: ledgerId,
    type: "duel_escrow",
    delta: -wager,
    amount: wager,
    at,
    reason: `Created ${DUEL_MODES[mode]} ${gameId}`,
    meta: { gameId, mode, role: "creator" }
  }));
  const saved = await saveUserRecord(sanitizeRecord({
    ...ledgerResult.record,
    name: user.name || ledgerResult.record.name || "Unknown",
    lastBetAt: at,
    totalWagered: int(ledgerResult.record.totalWagered, 0) + (ledgerResult.added ? wager : 0),
    recentEvents: ledgerResult.added ? addEvent(ledgerResult.record.recentEvents || [], {
      type: "duel_create",
      at,
      gameId,
      amount: wager,
      balanceBefore,
      balanceAfter: getRecordBalance(ledgerResult.record),
      message: `${user.name || "Unknown"} created ${DUEL_MODES[mode]} for ${formatTickets(wager)}.`
    }) : (ledgerResult.record.recentEvents || [])
  }));
  const game = await duelSaveGame({
    schemaVersion: DUEL_SCHEMA_VERSION,
    gameId,
    mode,
    modeName: DUEL_MODES[mode],
    status: "waiting",
    wager,
    pot: wager,
    createdAt: at,
    updatedAt: at,
    creator: duelSanitizePlayer({ userId: saved.userId, name: user.name || saved.name || "Unknown", tornId: user.tornId || user.id, avatarUrl: user.avatarUrl }),
    joiner: null,
    actions: {},
    ledgerIds: { creator: ledgerId }
  });
  return { game: duelPublicGame(game, saved.userId), record: saved, recoveredCreate:false };
}

async function duelCancelGame(user, gameId) {
  let game = await duelGetRaw(gameId);
  if (!game) throw new Error("That duel was not found.");
  const viewer = cleanUserId(user.id);
  if (game.creator.userId !== viewer || game.status !== "waiting" || game.joiner) throw new Error("Only the creator can cancel a waiting duel.");
  const at = nowIso();
  let record = await getUserRecord(viewer);
  record = prepareLedgerRecord(record || { userId: viewer, name: user.name || "Unknown", ledgerStartedAt: at, balanceBaseline: 0, financialLedger: [] });
  const ledgerId = `duel:${game.gameId}:creator-refund`;
  const ledgerResult = addLedgerEntry(record, makeLedgerEntry({
    id: ledgerId,
    type: "duel_cancel_refund",
    delta: game.wager,
    amount: game.wager,
    at,
    reason: `Cancelled ${DUEL_MODES[game.mode]} ${game.gameId}`,
    meta: { gameId: game.gameId, mode: game.mode }
  }));
  const saved = await saveUserRecord(sanitizeRecord({
    ...ledgerResult.record,
    name: user.name || ledgerResult.record.name || "Unknown",
    recentEvents: addEvent(ledgerResult.record.recentEvents || [], {
      type: "duel_cancel_refund",
      at,
      gameId: game.gameId,
      amount: game.wager,
      balanceAfter: getRecordBalance(ledgerResult.record),
      message: `${DUEL_MODES[game.mode]} cancelled. ${formatTickets(game.wager)} returned.`
    })
  }));
  game = await duelSaveGame({ ...game, status: "cancelled", ledgerIds: { ...(game.ledgerIds || {}), creatorRefund: ledgerId } });
  return { game: duelPublicGame(game, viewer), record: saved, refunded: game.wager };
}


async function duelAbandonNpcGame(user, gameId = "") {
  const viewer = cleanUserId(user.id);
  let game = gameId ? await duelGetRaw(gameId) : await duelFindActiveGameForUser(viewer);
  if (!game) {
    await duelSetActivePointer(viewer, null);
    return { game: null, record: await getUserRecord(viewer), refunded: 0, cleared: true };
  }
  const isPlayer = [game.creator?.userId, game.joiner?.userId].map(cleanUserId).includes(viewer);
  const isNpcGame = Boolean(game.npcTest) || Boolean(game.joiner?.isNpc) || String(game.joiner?.userId || "").startsWith("npc-");
  if (!isPlayer) throw new Error("That game does not belong to you.");
  if (!isNpcGame) throw new Error("Only unfinished NPC games can be cleared with this recovery action.");
  if (!duelIsActiveStatus(game.status)) {
    await duelSetActivePointer(viewer, null);
    return { game: duelPublicGame(game, viewer), record: await getUserRecord(viewer), refunded: 0, cleared: true };
  }
  const creatorIsViewer = cleanUserId(game.creator?.userId) === viewer;
  const refund = creatorIsViewer ? int(game.wager, 0) : 0;
  let record = await getUserRecord(viewer);
  if (refund > 0) {
    record = await duelPayPlayer(game.creator, refund, game, "duel_npc_recovery_refund", `Stuck NPC ${DUEL_MODES[game.mode]} game cleared. ${formatTickets(refund)} returned.`);
  }
  game = await duelSaveGame({
    ...game,
    status: "cancelled",
    completedAt: nowIso(),
    pot: 0,
    payout: 0,
    houseCut: 0,
    result: { mode: game.mode, cancelled: true, recovery: true, text: "Unfinished NPC game cleared." },
    ledgerIds: { ...(game.ledgerIds || {}), recoveryRefund: `duel:${game.gameId}:duel_npc_recovery_refund:${game.creator?.userId}` }
  });
  await duelSetActivePointer(viewer, null);
  return { game: duelPublicGame(game, viewer), record: record || await getUserRecord(viewer), refunded: refund, cleared: true };
}

async function duelJoinGame(user, gameId) {
  await duelEnsureSchemaMigration();
  let game = await duelGetRawStrong(gameId);
  if (!game) throw new Error("That duel was not found.");
  const viewer = cleanUserId(user.id);
  if (game.status !== "waiting") throw new Error("That duel is no longer joinable.");
  if (game.creator.userId === viewer) throw new Error("You cannot join your own duel.");
  const activeGame = await duelFindActiveGameForUser(viewer, game.gameId);
  if (activeGame) throw new Error("Finish or cancel your current multiplayer arcade game before joining another one.");
  const wager = int(game.wager, 0);
  let record = await getUserRecord(viewer);
  record = prepareLedgerRecord(record || { userId: viewer, name: user.name || "Unknown", ledgerStartedAt: nowIso(), balanceBaseline: 0, financialLedger: [] });
  const balanceBefore = getRecordBalance(record);
  if (balanceBefore < wager) throw new Error(`You need ${formatTickets(wager)} to join this duel.`);
  const at = nowIso();
  const ledgerId = `duel:${game.gameId}:joiner-escrow`;
  const ledgerResult = addLedgerEntry(record, makeLedgerEntry({
    id: ledgerId,
    type: "duel_escrow",
    delta: -wager,
    amount: wager,
    at,
    reason: `Joined ${DUEL_MODES[game.mode]} ${game.gameId}`,
    meta: { gameId: game.gameId, mode: game.mode, role: "joiner" }
  }));
  const saved = await saveUserRecord(sanitizeRecord({
    ...ledgerResult.record,
    name: user.name || ledgerResult.record.name || "Unknown",
    lastBetAt: at,
    totalWagered: int(ledgerResult.record.totalWagered, 0) + wager,
    recentEvents: addEvent(ledgerResult.record.recentEvents || [], {
      type: "duel_join",
      at,
      gameId: game.gameId,
      amount: wager,
      balanceBefore,
      balanceAfter: getRecordBalance(ledgerResult.record),
      message: `${user.name || "Unknown"} joined ${DUEL_MODES[game.mode]} for ${formatTickets(wager)}.`
    })
  }));
  const joinedGame = {
    ...game,
    status: "ready",
    pot: wager * 2,
    joiner: duelSanitizePlayer({ userId: saved.userId, name: user.name || saved.name || "Unknown", tornId: user.tornId || user.id, avatarUrl: user.avatarUrl }),
    ready: { [game.creator.userId]: false, [saved.userId]: false },
    readyWindowStartedAt: null,
    readyDeadlineAt: null,
    countdownStartedAt: null,
    startAt: null,
    ledgerIds: { ...(game.ledgerIds || {}), joiner: ledgerId }
  };
  game = await duelSaveGame({
    ...joinedGame,
    blackjackState: null,
    drawState: null,
    fishingState: null
  });
  return { game: duelPublicGame(game, viewer), record: saved };
}

function duelCardValue() {
  return Math.floor(Math.random() * 10) + 2;
}
function duelBlackjackHand() {
  const cards = [duelCardValue(), duelCardValue()];
  if (Math.random() < 0.45) cards.push(duelCardValue());
  const total = cards.reduce((a, b) => a + b, 0);
  return { cards, total, score: total > 21 ? 0 : total };
}
function duelPlinkoDrop() {
  const slots = [
    { mult: 0.5, weight: 20 }, { mult: 1, weight: 24 }, { mult: 1.5, weight: 22 },
    { mult: 2, weight: 15 }, { mult: 3, weight: 10 }, { mult: 5, weight: 6 }, { mult: 10, weight: 3 }
  ];
  return arcadeWeightedPick(slots);
}
function duelMinesScore() {
  const mines = new Set();
  while (mines.size < 3) mines.add(Math.floor(Math.random() * 12) + 1);
  let score = 0;
  const picks = [];
  for (let i = 0; i < 5; i++) {
    const pick = Math.floor(Math.random() * 12) + 1;
    picks.push(pick);
    if (mines.has(pick)) break;
    score++;
  }
  return { score, picks, mines: [...mines] };
}



function bjDrawCard() {
  const ranks = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
  return ranks[Math.floor(Math.random() * ranks.length)];
}
function bjCardValue(card) {
  if (card === "A") return 11;
  if (["K","Q","J"].includes(String(card))) return 10;
  return int(card, 0);
}
function bjHandTotal(cards = []) {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    if (card === "A") aces++;
    total += bjCardValue(card);
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}
function bjIsNatural(cards = []) {
  return Array.isArray(cards) && cards.length === 2 && bjHandTotal(cards) === 21;
}
function bjCleanHand(hand = {}) {
  const cards = Array.isArray(hand.cards) ? hand.cards.map(card => String(card).slice(0, 2)) : [];
  const total = bjHandTotal(cards);
  const status = ["active","stand","bust","blackjack"].includes(String(hand.status || "")) ? String(hand.status) : (total > 21 ? "bust" : bjIsNatural(cards) ? "blackjack" : "active");
  return { cards, total, status, blackjack: bjIsNatural(cards) };
}
function bjPlayerIds(game) {
  return [cleanUserId(game.creator?.userId), cleanUserId(game.joiner?.userId)].filter(Boolean);
}
function bjInitialState(game) {
  const ids = bjPlayerIds(game);
  if (ids.length < 2) return null;
  const existing = game.blackjackState && typeof game.blackjackState === "object" ? game.blackjackState : null;
  if (existing?.tournament && existing?.stacks && existing?.phase) return existing;
  const stacks = {};
  ids.forEach(id => { stacks[id] = 1000; });
  return {
    tournament: true,
    phase: "betting",
    round: 1,
    maxRounds: 3,
    startingStack: 1000,
    stacks,
    roundBets: {},
    hands: {},
    dealer: [],
    dealerTotal: 0,
    roundResults: [],
    message: "Round 1: choose a tournament-chip bet.",
    startedAt: nowIso()
  };
}
function bjPublicTournamentState(game, viewerId = "") {
  const state = bjInitialState(game) || {};
  const viewer = cleanUserId(viewerId);
  const phase = state.phase || "betting";
  const revealOpponent = phase === "round_result" || game.status === "complete";
  const dealer = Array.isArray(state.dealer) ? [...state.dealer] : [];
  const publicDealer = (phase === "playing" && dealer.length > 1) ? [dealer[0], "??"] : dealer;
  const ids = bjPlayerIds(game);
  const hands = {};
  const stacks = {};
  const roundBets = {};
  const activity = {};
  ids.forEach(id => {
    const hand = bjCleanHand(state.hands?.[id] || {});
    const isViewer = id === viewer;
    const hasBet = Boolean(state.roundBets?.[id]);
    if (isViewer || revealOpponent) {
      hands[id] = hand;
      stacks[id] = int(state.stacks?.[id], 0);
      if (hasBet) roundBets[id] = int(state.roundBets?.[id], 0);
    } else {
      hands[id] = { cards: [], total: 0, status: "hidden", hidden: true };
      stacks[id] = null;
      if (phase === "betting") activity[id] = hasBet ? "Bet locked" : "Choosing bet";
      else if (phase === "playing") activity[id] = hand.status === "active" ? "Playing hand" : "Locked in";
      else activity[id] = "Waiting";
    }
  });
  return { ...state, dealer: publicDealer, hands, stacks, roundBets, playerActivity: activity };
}
function bjTournamentPlayerReady(game, playerId) {
  const id = cleanUserId(playerId);
  if (!id) return false;
  const state = game.blackjackState || bjInitialState(game);
  if (!state) return false;
  if (state.phase === "betting") return Boolean(state.roundBets?.[id]);
  if (state.phase === "playing") return Boolean(state.hands?.[id] && state.hands[id].status !== "active");
  if (state.phase === "round_result") return true;
  return false;
}
function bjAutoBetAmount(state, userId) {
  const stack = int(state?.stacks?.[userId], 0);
  if (stack <= 0) return 0;
  if (stack <= 100) return stack;
  if (stack < 500) return Math.min(250, stack);
  return 250;
}
function bjDealTournamentRound(state) {
  const ids = Object.keys(state.stacks || {});
  const hands = {};
  ids.forEach(id => {
    const cards = [bjDrawCard(), bjDrawCard()];
    hands[id] = bjCleanHand({ cards, status: bjIsNatural(cards) ? "blackjack" : "active" });
  });
  const dealer = [bjDrawCard(), bjDrawCard()];
  return { ...state, phase: "playing", hands, dealer, dealerTotal: bjHandTotal(dealer), message: `Round ${state.round}: hit or stand.` };
}
function bjAutoPlayNpcTournament(game, state) {
  const npcId = Boolean(game.joiner?.isNpc) || String(game.joiner?.userId || "").startsWith("npc-") ? cleanUserId(game.joiner?.userId) : "";
  if (!npcId) return state;
  let next = { ...state, stacks: { ...(state.stacks || {}) }, roundBets: { ...(state.roundBets || {}) }, hands: { ...(state.hands || {}) } };
  if (next.phase === "betting" && !next.roundBets[npcId]) {
    next.roundBets[npcId] = bjAutoBetAmount(next, npcId);
    if (bjPlayerIds(game).every(id => next.roundBets[id])) next = bjDealTournamentRound(next);
  }
  if (next.phase === "playing" && next.hands?.[npcId]?.status === "active") {
    let hand = bjCleanHand(next.hands[npcId]);
    while (hand.status === "active" && hand.total < 16) {
      hand.cards.push(bjDrawCard());
      hand = bjCleanHand(hand);
    }
    if (hand.status === "active") hand.status = "stand";
    next.hands[npcId] = hand;
  }
  return next;
}
function bjDealerPlayTournament(state) {
  const dealer = Array.isArray(state.dealer) && state.dealer.length ? [...state.dealer] : [bjDrawCard(), bjDrawCard()];
  let total = bjHandTotal(dealer);
  while (total < 17) {
    dealer.push(bjDrawCard());
    total = bjHandTotal(dealer);
  }
  return { ...state, dealer, dealerTotal: total };
}
function bjRoundDelta(hand, dealerTotal, bet) {
  const wager = Math.max(0, int(bet, 0));
  const cleanHand = bjCleanHand(hand);
  if (wager <= 0) return { delta: 0, label: "No bet" };
  if (cleanHand.status === "bust" || cleanHand.total > 21) return { delta: -wager, label: "Bust" };
  if (cleanHand.blackjack && dealerTotal !== 21) return { delta: wager, label: "Blackjack win" };
  if (dealerTotal > 21) return { delta: wager, label: "Dealer bust" };
  if (cleanHand.total > dealerTotal) return { delta: wager, label: "Beat dealer" };
  if (cleanHand.total === dealerTotal) return { delta: 0, label: "Push" };
  return { delta: -wager, label: "Lost to dealer" };
}
function bjCompleteTournamentRound(game, state) {
  let played = bjDealerPlayTournament(state);
  const ids = bjPlayerIds(game);
  const round = played.round || 1;
  const stacks = { ...(played.stacks || {}) };
  const playerResults = {};
  ids.forEach(id => {
    const bet = int(played.roundBets?.[id], 0);
    const outcome = bjRoundDelta(played.hands?.[id], played.dealerTotal, bet);
    stacks[id] = Math.max(0, int(stacks[id], 0) + outcome.delta);
    playerResults[id] = { bet, delta: outcome.delta, label: outcome.label, hand: bjCleanHand(played.hands?.[id]), stackAfter: stacks[id] };
  });
  const roundResult = {
    round,
    dealer: { cards: played.dealer, total: played.dealerTotal, bust: played.dealerTotal > 21 },
    players: playerResults,
    at: nowIso()
  };
  return {
    ...played,
    phase: "round_result",
    stacks,
    dealerTotal: played.dealerTotal,
    roundResults: [...(played.roundResults || []), roundResult],
    message: `Round ${round} complete. ${round < int(played.maxRounds, 3) ? "Start the next round when ready." : "Tournament complete."}`
  };
}
function bjTournamentWinner(game, state) {
  const ids = bjPlayerIds(game);
  const a = ids[0], b = ids[1];
  const aStack = int(state?.stacks?.[a], 0);
  const bStack = int(state?.stacks?.[b], 0);
  if (aStack === bStack) return { tie: true, winnerRole: "", text: `Both players finished with ${aStack} chips.` };
  return {
    tie: false,
    winnerRole: aStack > bStack ? "creator" : "joiner",
    text: `${aStack > bStack ? game.creator?.name || "Creator" : game.joiner?.name || "Joiner"} finished with more tournament chips.`
  };
}
function bjResolveTournament(game, state) {
  const resolved = bjTournamentWinner(game, state);
  const ids = bjPlayerIds(game);
  const finalRound = (state.roundResults || []).slice(-1)[0] || null;
  return {
    mode: "blackjack",
    tournament: true,
    round: state.round,
    maxRounds: state.maxRounds,
    stacks: state.stacks,
    roundResults: state.roundResults || [],
    dealer: finalRound?.dealer || { cards: state.dealer || [], total: state.dealerTotal || 0 },
    creator: { stack: int(state.stacks?.[ids[0]], 0), last: finalRound?.players?.[ids[0]] || null },
    joiner: { stack: int(state.stacks?.[ids[1]], 0), last: finalRound?.players?.[ids[1]] || null },
    winnerRole: resolved.winnerRole,
    tie: resolved.tie,
    text: resolved.text
  };
}
function bjNextTournamentRound(state) {
  const round = int(state.round, 1) + 1;
  return {
    ...state,
    phase: "betting",
    round,
    roundBets: {},
    hands: {},
    dealer: [],
    dealerTotal: 0,
    message: `Round ${round}: choose a tournament-chip bet.`
  };
}
function bjApplyTournamentAction(game, userId, rawChoice) {
  const clean = duelSanitizeGame(game);
  const viewer = cleanUserId(userId);
  let state = bjInitialState(clean);
  if (!state) throw new Error("Blackjack tournament is not ready.");
  state = bjAutoPlayNpcTournament(clean, state);
  const choice = String(rawChoice || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  if (state.phase === "round_result") {
    if (int(state.round, 1) >= int(state.maxRounds, 3)) return { game: clean, state, complete: true };
    state = bjNextTournamentRound(state);
    state = bjAutoPlayNpcTournament(clean, state);
    return { game: { ...clean, blackjackState: state }, state, complete: false };
  }

  if (state.phase === "betting") {
    if (state.roundBets?.[viewer]) throw new Error("You already placed your bet for this round.");
    const requested = choice.startsWith("bet") ? int(choice.replace("bet", ""), 0) : int(choice, 0);
    const stack = int(state.stacks?.[viewer], 0);
    const bet = Math.max(0, Math.min(stack, requested));
    if (![100, 250, 500].includes(requested) && requested !== stack) throw new Error("Choose a 100, 250, or 500 chip round bet.");
    if (bet <= 0) throw new Error("You do not have tournament chips left to bet.");
    state = { ...state, roundBets: { ...(state.roundBets || {}), [viewer]: bet } };
    state = bjAutoPlayNpcTournament(clean, state);
    if (bjPlayerIds(clean).every(id => state.roundBets?.[id])) state = bjDealTournamentRound(state);
    state = bjAutoPlayNpcTournament(clean, state);
    if (state.phase === "playing" && bjPlayerIds(clean).every(id => state.hands?.[id]?.status !== "active")) {
      state = bjCompleteTournamentRound(clean, state);
    }
    return { game: { ...clean, blackjackState: state }, state, complete: false };
  }

  if (state.phase === "playing") {
    let hand = bjCleanHand(state.hands?.[viewer]);
    if (!hand.cards.length) throw new Error("Your hand was not found.");
    if (hand.status !== "active") throw new Error("Your hand is already finished for this round.");
    if (choice === "hit") {
      hand.cards.push(bjDrawCard());
      hand = bjCleanHand(hand);
    } else if (choice === "stand") {
      hand.status = "stand";
    } else {
      throw new Error("Choose Hit or Stand.");
    }
    state = { ...state, hands: { ...(state.hands || {}), [viewer]: hand } };
    state = bjAutoPlayNpcTournament(clean, state);
    if (bjPlayerIds(clean).every(id => state.hands?.[id]?.status !== "active")) {
      state = bjCompleteTournamentRound(clean, state);
      if (int(state.round, 1) >= int(state.maxRounds, 3)) return { game: { ...clean, blackjackState: state }, state, complete: true };
    }
    return { game: { ...clean, blackjackState: state }, state, complete: false };
  }

  return { game: { ...clean, blackjackState: state }, state, complete: false };
}


function sameGameLogbookGuard(record, gameId) {
  return String(record?.fishingLogbookLastGameId || "") === String(gameId || "");
}

async function duelApplyFishingRecords(game, resolved, at = nowIso()) {
  if (!game || game.mode !== "fishing" || !resolved) return resolved;
  const next = { ...resolved, creator: { ...(resolved.creator || {}) }, joiner: { ...(resolved.joiner || {}) } };
  for (const role of ["creator", "joiner"]) {
    const player = game[role] || {};
    const catchData = next[role]?.catch || null;
    const size = Number(next[role]?.size ?? catchData?.measuredSize ?? catchData?.size ?? 0);
    const isSynthetic = Boolean(player.isNpc || player.isTestPlayer || String(player.userId || "").startsWith("npc-") || String(player.userId || "").startsWith("test-"));
    if (!player.userId || isSynthetic) {
      next[role].record = { currentSize: size > 0 ? size : 0, previousSize: 0, newRecord: false, name: catchData?.name || next[role]?.name || "", caughtAt: at };
      continue;
    }
    let userRecord = await getUserRecord(player.userId);
    userRecord = sanitizeRecord(userRecord || { userId: player.userId, name: player.name || "Unknown" });
    const priorBook = sanitizeFishingLogbook(userRecord.fishingLogbook);
    const speciesKey = fishingSpeciesKey(catchData?.baseName || catchData?.name || "Fish");
    const priorSpecies = priorBook.species[speciesKey] || null;
    const isRare = !["standard", ""].includes(String(catchData?.variant || "standard"));
    const nextSpecies = {
      name: String(catchData?.baseName || catchData?.name || "Fish"),
      bestSize: Math.max(Number(priorSpecies?.bestSize || 0), size),
      count: Number(priorSpecies?.count || 0) + (sameGameLogbookGuard(userRecord, game.gameId) ? 0 : 1),
      rareCount: Number(priorSpecies?.rareCount || 0) + (isRare && !sameGameLogbookGuard(userRecord, game.gameId) ? 1 : 0),
      bestVariant: size >= Number(priorSpecies?.bestSize || 0) ? String(catchData?.variant || "standard") : String(priorSpecies?.bestVariant || "standard"),
      caughtAt: size >= Number(priorSpecies?.bestSize || 0) ? at : priorSpecies?.caughtAt || null
    };
    const alreadyLogged = sameGameLogbookGuard(userRecord, game.gameId);
    const updatedBook = sanitizeFishingLogbook({
      ...priorBook,
      species: { ...priorBook.species, [speciesKey]: nextSpecies },
      totalCaught: priorBook.totalCaught + (alreadyLogged ? 0 : 1),
      totalWins: priorBook.totalWins + (!alreadyLogged && resolved.winnerRole === role ? 1 : 0),
      rareCaught: priorBook.rareCaught + (!alreadyLogged && isRare ? 1 : 0)
    });
    const previous = Number(userRecord.fishingRecord?.size || 0);
    const sameGame = String(userRecord.fishingRecord?.gameId || "") === String(game.gameId || "");
    const newRecord = size > 0 && (sameGame ? Boolean(userRecord.fishingRecord?.wasNewRecord) : size > previous);
    let current = previous;
    let previousForResult = previous;
    if (size > previous) {
      current = size;
      userRecord = await saveUserRecord({
        ...userRecord,
        name: player.name || userRecord.name || "Unknown",
        fishingLogbook: updatedBook,
        fishingLogbookLastGameId: String(game.gameId || ""),
        fishingRecord: {
          size,
          name: catchData?.name || next[role]?.name || "Fish",
          gameId: String(game.gameId || ""),
          caughtAt: at,
          previousSize: previous,
          wasNewRecord: true
        },
        recentEvents: addEvent(userRecord.recentEvents || [], {
          type: "fishing_record",
          at,
          gameId: game.gameId,
          size,
          previousSize: previous,
          fishName: catchData?.name || next[role]?.name || "Fish",
          message: previous > 0 ? `New fishing record: ${size} cm (previous ${previous} cm).` : `First fishing record: ${size} cm.`
        })
      });
    } else if (!alreadyLogged) {
      userRecord = await saveUserRecord({ ...userRecord, name: player.name || userRecord.name || "Unknown", fishingLogbook: updatedBook, fishingLogbookLastGameId: String(game.gameId || "") });
    } else if (sameGame) {
      current = Number(userRecord.fishingRecord?.size || previous);
      previousForResult = Number(userRecord.fishingRecord?.previousSize || 0);
    }
    next[role].record = {
      currentSize: current,
      previousSize: previousForResult,
      newRecord,
      name: String((current === size ? catchData?.name : userRecord.fishingRecord?.name) || ""),
      caughtAt: current === size ? at : userRecord.fishingRecord?.caughtAt || null
    };
    next[role].logbook = updatedBook;
    next[role].newSpecies = !priorSpecies && !alreadyLogged;
    next[role].variant = String(catchData?.variant || "standard");
    next[role].rarity = String(catchData?.rarity || "regular");
  }
  return next;
}

function duelValidateResolvedWinner(game, resolved = {}) {
  const clean = duelSanitizeGame(game);
  const creatorId = cleanUserId(clean.creator?.userId || "");
  const joinerId = cleanUserId(clean.joiner?.userId || "");
  if (!creatorId || !joinerId || creatorId === joinerId) throw new Error("Invalid duel participants while resolving winner.");

  if (Boolean(resolved.tie)) {
    return { ...resolved, tie: true, winnerRole: undefined, winnerUserId: "", loserUserId: "" };
  }

  const role = String(resolved.winnerRole || "");
  if (role !== "creator" && role !== "joiner") throw new Error("Duel result did not identify a valid winner.");
  const winnerUserId = role === "creator" ? creatorId : joinerId;
  const loserUserId = role === "creator" ? joinerId : creatorId;
  if (!winnerUserId || !loserUserId || winnerUserId === loserUserId) throw new Error("Duel winner and loser are inconsistent.");
  return { ...resolved, tie: false, winnerRole: role, winnerUserId, loserUserId };
}

async function duelCompleteWithResolved(game, resolved) {
  const clean = duelSanitizeGame(game);
  const at = String(resolved?.completionAt || clean.completedAt || nowIso());
  resolved = await duelApplyFishingRecords(clean, resolved, at);
  resolved = duelValidateResolvedWinner(clean, resolved);
  const pot = int(clean.pot, clean.wager * 2);
  const npcTest = Boolean(clean.npcTest) || Boolean(clean.joiner?.isNpc) || String(clean.joiner?.userId || "").startsWith("npc-");
  const gameOdds = await getGameOddsSettings();
  const payoutParts = npcTest ? { payout: clean.wager, houseCut: 0 } : mpRealGamePayout(pot, gameOdds.multiplayer.houseCutPercent);
  let winnerUserId = "";
  let loserUserId = "";
  let payout = 0;
  let houseCut = 0;
  if (resolved.tie) {
    await duelPayPlayer(clean.creator, clean.wager, clean, npcTest ? "duel_npc_test_refund" : "duel_tie_refund", `${DUEL_MODES[clean.mode]} tied. ${formatTickets(clean.wager)} returned.`);
    if (!npcTest) await duelPayPlayer(clean.joiner, clean.wager, clean, "duel_tie_refund", `${DUEL_MODES[clean.mode]} tied. ${formatTickets(clean.wager)} returned.`);
    payout = clean.wager;
  } else {
    const winnerPlayer = resolved.winnerRole === "creator" ? clean.creator : clean.joiner;
    const loserPlayer = resolved.winnerRole === "creator" ? clean.joiner : clean.creator;
    winnerUserId = resolved.winnerUserId;
    loserUserId = resolved.loserUserId;
    const npcWinner = Boolean(winnerPlayer?.isNpc) || Boolean(winnerPlayer?.isTestPlayer) || String(winnerPlayer?.userId || "").startsWith("npc-") || String(winnerPlayer?.userId || "").startsWith("test-");
    payout = npcWinner ? 0 : payoutParts.payout;
    houseCut = npcWinner ? Math.max(0, pot) : payoutParts.houseCut;
    if (!npcWinner && payout > 0) await duelPayPlayer(winnerPlayer, payout, clean, npcTest ? "duel_npc_test_payout" : "duel_payout", `${winnerPlayer.name || "Winner"} won ${DUEL_MODES[clean.mode]} and received ${formatTickets(payout)}.`);
  }
  return await duelSaveGame({ ...clean, status: "complete", completedAt: at, result: resolved, tie: Boolean(resolved.tie), winnerUserId, loserUserId, payout, houseCut });
}



function duelCardWarHand() {
  const deck = [2,3,4,5,6,7,8,9,10,11,12,13,14].sort(() => Math.random() - 0.5);
  return deck.slice(0, 5);
}
function duelCardWarPick(choice, hand) {
  const cleanHand = Array.isArray(hand) && hand.length ? hand.map(n => int(n, 0)).filter(Boolean) : duelCardWarHand();
  const picked = int(choice, 0);
  return cleanHand.includes(picked) ? picked : cleanHand[Math.floor(Math.random() * cleanHand.length)];
}
function duelMemoryScore(choice) {
  const strategy = String(choice || "balanced").toLowerCase();
  const base = strategy === "safe" ? 3 : strategy === "risky" ? 1 : 2;
  const swing = strategy === "safe" ? Math.floor(Math.random() * 3) : strategy === "risky" ? Math.floor(Math.random() * 7) : Math.floor(Math.random() * 5);
  const bust = strategy === "risky" && Math.random() < 0.18;
  return { strategy, matches: bust ? 0 : base + swing, bust };
}
function duelSafeCrackerScore(choice) {
  const guess = String(choice || "123").replace(/[^0-9]/g, "").slice(0, 3).padEnd(3, "0");
  const code = String(Math.floor(Math.random() * 900) + 100);
  let exact = 0, close = 0;
  for (let i = 0; i < 3; i++) {
    if (guess[i] === code[i]) exact++;
    else if (code.includes(guess[i])) close++;
  }
  const score = exact * 3 + close;
  return { guess, code, exact, close, score };
}



const DRAW_GAME_LOCKS = globalThis.__DRAW_GAME_LOCKS || (globalThis.__DRAW_GAME_LOCKS = new Map());
async function withDrawGameLock(gameId, work) {
  const key = mpCleanId(gameId);
  const previous = DRAW_GAME_LOCKS.get(key) || Promise.resolve();
  let release;
  const current = new Promise(resolve => { release = resolve; });
  DRAW_GAME_LOCKS.set(key, previous.then(() => current));
  await previous;
  try { return await work(); }
  finally { release(); setTimeout(() => DRAW_GAME_LOCKS.delete(key), 0); }
}

const DRAW_DURATION_MS = 30000;
const DRAW_STANDARD_LIFETIME_MS = 2000;
const DRAW_BOSS_LIFETIME_MS = 5000;
const DRAW_SLOT_MIN_COOLDOWN_MS = 1000;
const DRAW_MAX_VISIBLE = 5;
const DRAW_SCHEDULE_VERSION = 8;
const DRAW_BOSS_SCORE = 3;
const DRAW_ROBBER_VARIANTS = ["bandit","outlaw","gunslinger","desperado","raider","masked"];
const DRAW_CIVILIAN_VARIANTS = ["townsperson","sheriff","shopkeeper","rancher","miner","traveler"];

function drawRandom(seedObj) {
  seedObj.value = (seedObj.value * 1664525 + 1013904223) >>> 0;
  return seedObj.value / 4294967296;
}
function drawEventScoreForPlayer(event, playerId) {
  const id = cleanUserId(playerId);
  if (!id || !event) return 0;
  if (event.kind === "boss") return cleanUserId(event.claimedBy || "") === id ? DRAW_BOSS_SCORE : 0;
  if (cleanUserId(event.claimedBy || "") !== id) return 0;
  const rawScore = Number(event.scoreValue);
  return Number.isFinite(rawScore) ? Math.trunc(rawScore) : (event.type === "civilian" ? -1 : 1);
}
function drawScoresFromEvents(game, events = []) {
  const ids = [cleanUserId(game.creator?.userId), cleanUserId(game.joiner?.userId)].filter(Boolean);
  const scores = Object.fromEntries(ids.map(id => [id, 0]));
  for (const event of Array.isArray(events) ? events : []) {
    for (const id of ids) scores[id] += drawEventScoreForPlayer(event, id);
  }
  return scores;
}
function drawActiveCountAt(events, atMs) {
  return events.reduce((count, event) => count + (event.startMs <= atMs && atMs < event.startMs + event.durationMs ? 1 : 0), 0);
}
function drawCanScheduleEvent(events, startMs, durationMs) {
  const endMs = startMs + durationMs;
  const checkpoints = new Set([startMs]);
  for (const event of events) {
    const eventStart = int(event.startMs, 0);
    const eventEnd = eventStart + int(event.durationMs, 0);
    if (eventEnd <= startMs || eventStart >= endMs) continue;
    checkpoints.add(Math.max(startMs, eventStart));
    if (eventEnd > startMs && eventEnd < endMs) checkpoints.add(eventEnd);
  }
  for (const atMs of checkpoints) {
    if (drawActiveCountAt(events, atMs) + 1 > DRAW_MAX_VISIBLE) return false;
  }
  return true;
}
function drawBuildSchedule(game, startMs) {
  const seed = { value: ((startMs >>> 0) ^ int(game.wager, 0) ^ String(game.gameId || "").length * 2654435761) >>> 0 };
  const events = [];
  const slotAvailableAt = Array(9).fill(0);
  let cursor = 450;
  let eventNumber = 0;
  let wave = 0;
  while (cursor < DRAW_DURATION_MS - 2200) {
    // Around 15% more frequent than the previous schedule, but still irregular.
    cursor += 400 + Math.floor(drawRandom(seed) * 350);
    if (cursor >= DRAW_DURATION_MS - 2100) break;
    const burstSize = 1 + Math.floor(drawRandom(seed) * 3);
    let spawned = 0;
    for (let burst = 0; burst < burstSize && spawned < DRAW_MAX_VISIBLE; burst += 1) {
      const offset = burst === 0 ? 0 : Math.floor(drawRandom(seed) * 170);
      const spawnAt = cursor + offset;
      let candidates = slotAvailableAt.map((at, slot) => ({ at, slot })).filter(x => x.at <= spawnAt);
      if (!candidates.length) continue;
      const slot = candidates[Math.floor(drawRandom(seed) * candidates.length)].slot;
      const durationMs = DRAW_STANDARD_LIFETIME_MS;
      if (spawnAt + durationMs >= DRAW_DURATION_MS) continue;
      if (!drawCanScheduleEvent(events, spawnAt, durationMs)) continue;
      const criminal = drawRandom(seed) < 0.60;
      const variants = criminal ? DRAW_ROBBER_VARIANTS : DRAW_CIVILIAN_VARIANTS;
      const variant = variants[Math.floor(drawRandom(seed) * variants.length)];
      events.push({
        id: `draw-v4-${eventNumber++}`,
        slot,
        type: criminal ? "robber" : "civilian",
        kind: "standard",
        variant,
        scoreValue: criminal ? 1 : -1,
        startMs: spawnAt,
        durationMs,
        startsAt: new Date(startMs + spawnAt).toISOString(),
        endsAt: new Date(startMs + spawnAt + durationMs).toISOString(),
        claimedBy: "",
        claimedName: "",
        at: ""
      });
      // The same slot must stay empty for at least one full second after removal.
      slotAvailableAt[slot] = spawnAt + durationMs + DRAW_SLOT_MIN_COOLDOWN_MS + 180 + Math.floor(drawRandom(seed) * 720);
      spawned += 1;
    }
    wave += 1;
  }
  return events;
}
function drawInitialState(game, explicitStartMs = 0) {
  const existing = game.drawState && typeof game.drawState === "object" ? game.drawState : null;
  if (existing?.scheduleVersion === DRAW_SCHEDULE_VERSION && existing?.roundId && existing?.startAt && existing?.endAt && Array.isArray(existing.events)) {
    return { ...existing, scores: drawScoresFromEvents(game, existing.events), revision: int(existing.revision, 0) };
  }
  const startMs = explicitStartMs || Date.parse(game.startAt || "") || (Date.now() + 4000);
  const events = drawBuildSchedule(game, startMs);
  // The database round ID must be identical on every Function invocation.
  // DRAW state is hydrated from Postgres rather than written back to the Blob
  // game record after every action, so a random ID here would make each poll
  // look like a brand-new round and erase the committed action ledger.
  const stableRoundKey = `${String(game.gameId || "draw")}:${new Date(startMs).toISOString()}`;
  const stableRoundId = `draw-round-${crypto.createHash("sha256").update(stableRoundKey).digest("hex").slice(0, 20)}`;
  return {
    scheduleVersion: DRAW_SCHEDULE_VERSION,
    roundId: stableRoundId,
    startAt: new Date(startMs).toISOString(),
    endAt: new Date(startMs + DRAW_DURATION_MS).toISOString(),
    durationMs: DRAW_DURATION_MS,
    events,
    scores: drawScoresFromEvents(game, events),
    revision: 0,
    nextActionSequence: 1,
    actionLedger: [],
    npcNextActionAt: new Date(startMs + 5000).toISOString(),
    npcAttemptCount: 0,
    message: "Shoot criminals and spare civilians!"
  };
}
function drawPublicState(game, viewerId = "") {
  const clean = duelSanitizeGame(game);
  if (clean.mode !== "draw") return null;
  const state = drawInitialState(clean, Date.parse(clean.startAt || "") || 0);
  const events = (state.events || []).map(event => ({
    ...event,
    hitsBy: event.hitsBy ? { ...event.hitsBy } : undefined,
    completedBy: event.completedBy ? { ...event.completedBy } : undefined,
    lastHitAtBy: undefined
  }));
  return {
    scheduleVersion: DRAW_SCHEDULE_VERSION,
    roundId: state.roundId,
    startAt: state.startAt,
    endAt: state.endAt,
    durationMs: DRAW_DURATION_MS,
    events,
    scores: drawScoresFromEvents(clean, events),
    revision: int(state.revision, 0),
    nextActionSequence: Math.max(1, int(state.nextActionSequence, 1)),
    actionLedger: Array.isArray(state.actionLedger) ? state.actionLedger.slice(-240) : [],
    npcNextActionAt: state.npcNextActionAt || "",
    npcAttemptCount: int(state.npcAttemptCount, 0),
    message: state.message || "Shoot criminals and spare civilians!",
    serverNow: nowIso(),
    viewerUserId: cleanUserId(viewerId || "")
  };
}
function drawIsTargetActive(state, target, atMs = Date.now(), playerId = "") {
  if (!target) return false;
  if (target.claimedBy) return false;
  const starts = Date.parse(target.startsAt || "") || (Date.parse(state.startAt || "") + int(target.startMs, 0));
  const ends = Date.parse(target.endsAt || "") || (starts + int(target.durationMs, target.kind === "boss" ? DRAW_BOSS_LIFETIME_MS : DRAW_STANDARD_LIFETIME_MS));
  return atMs >= starts && atMs < ends && atMs < Date.parse(state.endAt || "");
}
function drawResolve(game, state) {
  const scores = drawScoresFromEvents(game, state.events || []);
  const creatorId = cleanUserId(game.creator?.userId);
  const joinerId = cleanUserId(game.joiner?.userId);
  const creatorRaw = Number(scores[creatorId]);
  const joinerRaw = Number(scores[joinerId]);
  const creatorScore = Number.isFinite(creatorRaw) ? Math.trunc(creatorRaw) : 0;
  const joinerScore = Number.isFinite(joinerRaw) ? Math.trunc(joinerRaw) : 0;
  if (creatorScore === joinerScore) return { mode: "draw", creator: { score: creatorScore }, joiner: { score: joinerScore }, scores, tie: true, text: `DRAW! tied ${creatorScore}-${joinerScore}.` };
  return { mode: "draw", creator: { score: creatorScore }, joiner: { score: joinerScore }, scores, winnerRole: creatorScore > joinerScore ? "creator" : "joiner", tie: false, text: `DRAW! final score ${creatorScore}-${joinerScore}.` };
}
function drawAutoNpc(game) {
  const clean = duelSanitizeGame(game);
  const npcId = clean.joiner?.isNpc || String(clean.joiner?.userId || "").startsWith("npc-") ? cleanUserId(clean.joiner?.userId) : "";
  if (clean.mode !== "draw" || clean.status !== "playing" || !npcId) return clean;
  const state = drawInitialState(clean);
  const now = Date.now();
  const end = Date.parse(state.endAt || "");
  if (now >= end) return { ...clean, drawState: state };
  let nextAt = Date.parse(state.npcNextActionAt || "");
  if (!Number.isFinite(nextAt)) nextAt = Date.parse(state.startAt || "") + 5000;
  if (now < nextAt) return { ...clean, drawState: { ...state, npcNextActionAt: new Date(nextAt).toISOString() } };
  const events = (state.events || []).map(event => ({ ...event }));
  // NPC deliberately ignores bosses and attempts one standard card every 5 seconds.
  const active = events.filter(event => event.kind !== "boss" && drawIsTargetActive({ ...state, events }, event, now));
  let changed = false;
  if (active.length) {
    const target = active[Math.floor(Math.random() * active.length)];
    target.claimedBy = npcId;
    target.claimedName = clean.joiner?.name || "NPC";
    target.at = nowIso();
    changed = true;
  }
  while (nextAt <= now) nextAt += 5000;
  return {
    ...clean,
    drawState: {
      ...state,
      events,
      scores: drawScoresFromEvents(clean, events),
      revision: int(state.revision, 0) + (changed ? 1 : 0),
      npcNextActionAt: new Date(nextAt).toISOString(),
      npcAttemptCount: int(state.npcAttemptCount, 0) + 1,
      lastNpcAt: nowIso()
    }
  };
}
async function drawMaybeComplete(game) {
  let clean = duelSanitizeGame(game);
  if (clean.mode !== "draw" || clean.status !== "playing") return clean;
  clean = drawAutoNpc(clean);
  const state = drawInitialState(clean);
  clean = { ...clean, drawState: state };
  if (Date.now() < Date.parse(state.endAt || "")) return clean;
  return await duelCompleteWithResolved(clean, drawResolve(clean, state));
}
function drawDatabasePlayerIds(game) {
  return [cleanUserId(game?.creator?.userId), cleanUserId(game?.joiner?.userId)].filter(Boolean);
}

async function drawDatabaseState(game, options = {}) {
  const initialState = drawInitialState(game, Date.parse(game.startAt || "") || 0);
  const playerIds = drawDatabasePlayerIds(game);
  const npcId = game?.joiner?.isNpc || String(game?.joiner?.userId || "").startsWith("npc-")
    ? cleanUserId(game.joiner.userId) : "";
  if (options.runNpc && npcId && game.status === "playing") {
    return await drawDatabase.npcAttempt({
      gameId: game.gameId,
      initialState,
      playerIds,
      npcId,
      npcName: game.joiner?.name || "NPC"
    });
  }
  return await drawDatabase.getMatch({ gameId: game.gameId, initialState, playerIds });
}

async function drawMaybeCompleteDatabase(game) {
  if (!game || game.mode !== "draw" || game.status !== "playing") return game;
  const state = game.drawState || drawInitialState(game);
  if (Date.now() < Date.parse(state.endAt || "")) return game;
  return await duelCompleteWithResolved(game, drawResolve(game, state));
}

async function drawTapTargetUnlocked(user, gameId, targetId, clickedAtRaw = "", actionIdRaw = "") {
  let game = await duelGetRaw(gameId);
  if (!game) throw new Error("That DRAW! duel was not found.");
  const viewer = cleanUserId(user.id);
  if (game.mode !== "draw") throw new Error("That is not a DRAW! duel.");
  if (game.status !== "playing") throw new Error("DRAW! is not currently running.");
  const playerIds = drawDatabasePlayerIds(game);
  if (!playerIds.includes(viewer)) throw new Error("You are not in this DRAW! duel.");

  const initialState = drawInitialState(game, Date.parse(game.startAt || "") || 0);
  const id = String(targetId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60);
  const actionId = String(actionIdRaw || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 90)
    || `draw-${viewer}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

  const claimed = await drawDatabase.claimTarget({
    gameId,
    initialState,
    playerIds,
    userId: viewer,
    userName: user.name || "Player",
    targetId: id,
    actionId,
    clickedAt: clickedAtRaw
  });

  game = { ...game, drawState: claimed.state };
  game = await drawMaybeCompleteDatabase(game);
  return {
    game: duelPublicGame(game, viewer),
    drawDelta: claimed.delta,
    bossProgress: claimed.bossProgress,
    actionRecord: claimed.actionRecord,
    databaseAuthoritative: true
  };
}
async function drawTapTarget(user, gameId, targetId, clickedAtRaw = "", actionIdRaw = "") {
  // Postgres SELECT ... FOR UPDATE is the global lock. The in-memory lock is
  // intentionally not used because separate Netlify instances do not share it.
  return drawTapTargetUnlocked(user, gameId, targetId, clickedAtRaw, actionIdRaw);
}

function duelResolve(mode, creatorAction, joinerAction) {
  if (mode === "coin") {
    const coin = Math.random() < 0.5 ? "heads" : "tails";
    const c = String(creatorAction.choice || "heads");
    const j = String(joinerAction.choice || (c === "heads" ? "tails" : "heads"));
    const winner = c === coin ? "creator" : j === coin ? "joiner" : (Math.random() < 0.5 ? "creator" : "joiner");
    return { mode, coin, creator: { choice: c }, joiner: { choice: j }, winnerRole: winner, tie: false, text: `Coin landed ${coin}.` };
  }
  if (mode === "rps") {
    const c = String(creatorAction.choice || "rock");
    const j = String(joinerAction.choice || "rock");
    if (c === j) return { mode, creator: { choice: c }, joiner: { choice: j }, tie: true, text: "Both players picked the same." };
    const beats = { rock: "scissors", paper: "rock", scissors: "paper" };
    const winner = beats[c] === j ? "creator" : "joiner";
    return { mode, creator: { choice: c }, joiner: { choice: j }, winnerRole: winner, tie: false, text: `${c} vs ${j}.` };
  }
  if (mode === "blackjack") {
    const c = duelBlackjackHand();
    const j = duelBlackjackHand();
    if (c.score === j.score) return { mode, creator: c, joiner: j, tie: true, text: `Both scored ${c.score}.` };
    return { mode, creator: c, joiner: j, winnerRole: c.score > j.score ? "creator" : "joiner", tie: false, text: `Closest to 21 wins.` };
  }
  if (mode === "plinko") {
    const c = duelPlinkoDrop();
    const j = duelPlinkoDrop();
    if (Number(c.mult) === Number(j.mult)) return { mode, creator: c, joiner: j, tie: true, text: `Both landed ${c.mult}x.` };
    return { mode, creator: c, joiner: j, winnerRole: Number(c.mult) > Number(j.mult) ? "creator" : "joiner", tie: false, text: `Higher Plinko multiplier wins.` };
  }
  if (mode === "mines") {
    const c = duelMinesScore();
    const j = duelMinesScore();
    if (c.score === j.score) return { mode, creator: c, joiner: j, tie: true, text: `Both scored ${c.score}.` };
    return { mode, creator: c, joiner: j, winnerRole: c.score > j.score ? "creator" : "joiner", tie: false, text: `Most safe tiles wins.` };
  }
  if (mode === "memory") {
    const c = duelMemoryScore(creatorAction.choice);
    const j = duelMemoryScore(joinerAction.choice);
    if (c.matches === j.matches) return { mode, creator: c, joiner: j, tie: true, text: `Both players found ${c.matches} matches.` };
    return { mode, creator: c, joiner: j, winnerRole: c.matches > j.matches ? "creator" : "joiner", tie: false, text: `Most memory matches wins.` };
  }
  if (mode === "safecracker") {
    const c = duelSafeCrackerScore(creatorAction.choice);
    const j = duelSafeCrackerScore(joinerAction.choice);
    if (c.score === j.score) return { mode, creator: c, joiner: j, tie: true, text: `Both crackers scored ${c.score}.` };
    return { mode, creator: c, joiner: j, winnerRole: c.score > j.score ? "creator" : "joiner", tie: false, text: `Best code-cracking score wins.` };
  }
  if (mode === "cardwar") {
    const cHand = Array.isArray(creatorAction.hand) ? creatorAction.hand : duelCardWarHand();
    const jHand = Array.isArray(joinerAction.hand) ? joinerAction.hand : duelCardWarHand();
    const cPick = duelCardWarPick(creatorAction.choice, cHand);
    const jPick = duelCardWarPick(joinerAction.choice, jHand);
    if (cPick === jPick) return { mode, creator: { hand: cHand, pick: cPick }, joiner: { hand: jHand, pick: jPick }, tie: true, text: `Both players used ${cPick}.` };
    return { mode, creator: { hand: cHand, pick: cPick }, joiner: { hand: jHand, pick: jPick }, winnerRole: cPick > jPick ? "creator" : "joiner", tie: false, text: `Highest selected card wins.` };
  }
  throw new Error("Unknown duel mode.");
}

async function duelPayPlayer(player, amount, game, type, reason) {
  if (!player?.userId || amount <= 0) return null;
  const at = nowIso();
  let record = await getUserRecord(player.userId);
  record = prepareLedgerRecord(record || { userId: player.userId, name: player.name || "Unknown", ledgerStartedAt: at, balanceBaseline: 0, financialLedger: [] });
  const ledgerId = `duel:${game.gameId}:${type}:${player.userId}`;
  if (ledgerEntryIdExists(record, ledgerId)) return record;
  const ledgerResult = addLedgerEntry(record, makeLedgerEntry({
    id: ledgerId,
    type,
    delta: amount,
    amount,
    at,
    reason,
    meta: { gameId: game.gameId, mode: game.mode, amount }
  }));
  return await saveUserRecord(sanitizeRecord({
    ...ledgerResult.record,
    name: player.name || ledgerResult.record.name || "Unknown",
    totalWon: int(ledgerResult.record.totalWon, 0) + amount,
    recentEvents: addEvent(ledgerResult.record.recentEvents || [], {
      type,
      at,
      gameId: game.gameId,
      amount,
      balanceAfter: getRecordBalance(ledgerResult.record),
      message: reason
    })
  }));
}

async function duelMaybeComplete(game, viewerId) {
  const clean = duelSanitizeGame(game);
  if (clean.mode === "blackjack") return clean;
  if (clean.mode === "draw") return await drawMaybeComplete(clean);
  if (clean.mode === "fishing") return await fishingMaybeComplete(clean);
  if (clean.mode === "roulette") return await rouletteMaybeComplete(clean);
  if (clean.mode === "safecracker") return await safeCrackerAdvanceAndSave(clean);
  if (clean.mode === "mountainrace") return await mountainRaceAdvanceAndSave(clean);
  if (clean.status !== "playing" || !clean.creator?.userId || !clean.joiner?.userId) return clean;
  const creatorAction = clean.actions?.[clean.creator.userId];
  const joinerAction = clean.actions?.[clean.joiner.userId];
  if (!creatorAction || !joinerAction) return clean;
  const at = nowIso();
  const resolved = duelResolve(clean.mode, creatorAction, joinerAction);
  const pot = int(clean.pot, clean.wager * 2);
  const npcTest = Boolean(clean.npcTest) || Boolean(clean.joiner?.isNpc) || String(clean.joiner?.userId || "").startsWith("npc-");
  const gameOdds = await getGameOddsSettings();
  const payoutParts = npcTest ? { payout: clean.wager, houseCut: 0 } : mpRealGamePayout(pot, gameOdds.multiplayer.houseCutPercent);
  let winnerUserId = "";
  let loserUserId = "";
  let payout = 0;
  let houseCut = 0;
  if (resolved.tie) {
    await duelPayPlayer(clean.creator, clean.wager, clean, npcTest ? "duel_npc_test_refund" : "duel_tie_refund", `${DUEL_MODES[clean.mode]} tied. ${formatTickets(clean.wager)} returned.`);
    if (!npcTest) await duelPayPlayer(clean.joiner, clean.wager, clean, "duel_tie_refund", `${DUEL_MODES[clean.mode]} tied. ${formatTickets(clean.wager)} returned.`);
    payout = clean.wager;
    houseCut = 0;
  } else {
    const winnerPlayer = resolved.winnerRole === "creator" ? clean.creator : clean.joiner;
    const loserPlayer = resolved.winnerRole === "creator" ? clean.joiner : clean.creator;
    winnerUserId = winnerPlayer.userId;
    loserUserId = loserPlayer.userId;
    const npcWinner = Boolean(winnerPlayer?.isNpc) || Boolean(winnerPlayer?.isTestPlayer) || String(winnerPlayer?.userId || "").startsWith("npc-") || String(winnerPlayer?.userId || "").startsWith("test-");
    payout = npcWinner ? 0 : payoutParts.payout;
    houseCut = npcWinner ? Math.max(0, pot) : payoutParts.houseCut;
    if (!npcWinner && payout > 0) {
      await duelPayPlayer(winnerPlayer, payout, clean, npcTest ? "duel_npc_test_payout" : "duel_payout", `${winnerPlayer.name || "Winner"} won ${DUEL_MODES[clean.mode]} and received ${formatTickets(payout)}.`);
    }
  }
  return await duelSaveGame({
    ...clean,
    status: "complete",
    completedAt: at,
    result: resolved,
    tie: Boolean(resolved.tie),
    winnerUserId,
    loserUserId,
    payout,
    houseCut
  });
}


function duelNpcChoice(mode) {
  if (mode === "coin") return Math.random() < 0.5 ? "heads" : "tails";
  if (mode === "rps") return ["rock", "paper", "scissors"][Math.floor(Math.random() * 3)];
  if (mode === "draw") return "play";
  if (mode === "fishing") return "play";
  if (mode === "roulette") return "play";
  if (mode === "blackjack") return "deal";
  if (mode === "plinko") return "drop";
  if (mode === "mines") return "play";
  if (mode === "memory") return ["safe", "balanced", "risky"][Math.floor(Math.random() * 3)];
  if (mode === "safecracker") return String(Math.floor(Math.random() * 900) + 100);
  if (mode === "cardwar") return String(Math.floor(Math.random() * 13) + 2);
  return "play";
}



// SAFE_CRACKER_SERVER_START
const SAFE_CRACKER_ROUND_MS = 75 * 1000;
const SAFE_CRACKER_VERIFY_MS = 650;
const SAFE_CRACKER_STAGES = 3;
const SAFE_CRACKER_LOCKS = globalThis.__SAFE_CRACKER_LOCKS || (globalThis.__SAFE_CRACKER_LOCKS = new Map());

async function withSafeCrackerLock(gameId, task) {
  const key = mpCleanId(gameId);
  const previous = SAFE_CRACKER_LOCKS.get(key) || Promise.resolve();
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const queued = previous.then(() => gate);
  SAFE_CRACKER_LOCKS.set(key, queued);
  await previous;
  try { return await task(); }
  finally {
    release();
    if (SAFE_CRACKER_LOCKS.get(key) === queued) SAFE_CRACKER_LOCKS.delete(key);
  }
}

function safeCrackerPlayerIds(game) {
  return [cleanUserId(game?.creator?.userId), cleanUserId(game?.joiner?.userId)].filter(Boolean);
}

function safeCrackerGenerateCode() {
  const digits = Array.from({ length: 10 }, (_, digit) => digit);
  for (let index = digits.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [digits[index], digits[swap]] = [digits[swap], digits[index]];
  }
  return digits.slice(0, SAFE_CRACKER_STAGES).join('');
}

function safeCrackerInitialPlayer(code) {
  return {
    code,
    stage: 0,
    attempts: [],
    lastResult: null,
    nextGuessAt: null,
    completedAt: null
  };
}

function safeCrackerInitialState(game, startMs = Date.now()) {
  const ids = safeCrackerPlayerIds(game);
  const players = {};
  const usedCodes = new Set();
  for (const id of ids) {
    let code = safeCrackerGenerateCode();
    while (usedCodes.has(code)) code = safeCrackerGenerateCode();
    usedCodes.add(code);
    players[id] = safeCrackerInitialPlayer(code);
  }
  return {
    roundId: 'safe-' + crypto.randomBytes(7).toString('hex'),
    startAt: new Date(startMs).toISOString(),
    endAt: new Date(startMs + SAFE_CRACKER_ROUND_MS).toISOString(),
    revision: 1,
    players,
    winnerUserId: '',
    processedActionIds: [],
    npcActionAt: null
  };
}

function safeCrackerEnsureState(game) {
  const startMs = Date.parse(game?.startAt || '') || Date.now();
  const existing = game?.safecrackerState && typeof game.safecrackerState === 'object' ? game.safecrackerState : null;
  if (!existing?.players || typeof existing.players !== 'object') return safeCrackerInitialState(game, startMs);
  const players = { ...existing.players };
  for (const id of safeCrackerPlayerIds(game)) {
    const current = players[id] && typeof players[id] === 'object' ? players[id] : safeCrackerInitialPlayer(safeCrackerGenerateCode());
    const rawCode = String(current.code || '').replace(/[^0-9]/g, '').slice(0, SAFE_CRACKER_STAGES);
    const code = rawCode.length === SAFE_CRACKER_STAGES ? rawCode : safeCrackerGenerateCode();
    players[id] = {
      code,
      stage: Math.max(0, Math.min(SAFE_CRACKER_STAGES, int(current.stage, 0))),
      attempts: Array.isArray(current.attempts) ? current.attempts.slice(-80) : [],
      lastResult: current.lastResult && typeof current.lastResult === 'object' ? current.lastResult : null,
      nextGuessAt: current.nextGuessAt || null,
      completedAt: current.completedAt || null
    };
  }
  return {
    roundId: String(existing.roundId || ('safe-' + crypto.randomBytes(7).toString('hex'))),
    startAt: existing.startAt || new Date(startMs).toISOString(),
    endAt: existing.endAt || new Date(startMs + SAFE_CRACKER_ROUND_MS).toISOString(),
    revision: Math.max(1, int(existing.revision, 1)),
    players,
    winnerUserId: cleanUserId(existing.winnerUserId || ''),
    processedActionIds: Array.isArray(existing.processedActionIds) ? existing.processedActionIds.map(String).slice(-80) : [],
    npcActionAt: existing.npcActionAt || null
  };
}

function safeCrackerHasValidState(game) {
  const state = game?.safecrackerState;
  if (!state || typeof state !== 'object' || !state.players || typeof state.players !== 'object') return false;
  const start = Date.parse(state.startAt || '');
  const end = Date.parse(state.endAt || '');
  if (!state.roundId || !Number.isFinite(start) || !Number.isFinite(end) || end - start !== SAFE_CRACKER_ROUND_MS) return false;
  return safeCrackerPlayerIds(game).every(id => /^[0-9]{3}$/.test(String(state.players?.[id]?.code || '')));
}

function safeCrackerCircularDistance(first, second) {
  const distance = Math.abs(int(first, 0) - int(second, 0));
  return Math.min(distance, 10 - distance);
}

function safeCrackerTier(distance) {
  if (distance <= 0) return 'green';
  if (distance === 1) return 'yellow';
  if (distance <= 3) return 'orange';
  return 'red';
}

function safeCrackerPublicPlayer(player, includeAttempts) {
  const attempts = Array.isArray(player?.attempts) ? player.attempts : [];
  const lastResult = player?.lastResult && typeof player.lastResult === 'object' ? {
    stage: int(player.lastResult.stage, 0),
    guess: int(player.lastResult.guess, 0),
    tier: String(player.lastResult.tier || ''),
    correct: Boolean(player.lastResult.correct),
    at: player.lastResult.at || null
  } : null;
  return {
    stage: Math.max(0, Math.min(SAFE_CRACKER_STAGES, int(player?.stage, 0))),
    attempts: includeAttempts ? attempts.map(attempt => ({
      stage: int(attempt.stage, 0),
      guess: int(attempt.guess, 0),
      tier: String(attempt.tier || ''),
      correct: Boolean(attempt.correct),
      at: attempt.at || null
    })) : undefined,
    attemptCount: attempts.length,
    lastResult: includeAttempts ? lastResult : undefined,
    lastTier: lastResult?.tier || '',
    completed: Boolean(player?.completedAt) || int(player?.stage, 0) >= SAFE_CRACKER_STAGES,
    completedAt: player?.completedAt || null
  };
}

function safeCrackerPublicState(game, viewerUserId) {
  const state = game?.safecrackerState && typeof game.safecrackerState === 'object' ? safeCrackerEnsureState(game) : null;
  const viewer = cleanUserId(viewerUserId);
  const ids = safeCrackerPlayerIds(game);
  const opponentId = ids.find(id => id !== viewer) || '';
  if (!state) {
    return {
      roundId: '', startAt: game?.startAt || null, endAt: null, revision: 0,
      secondsLeft: 75, canSubmit: false, cooldownMs: 0,
      me: safeCrackerPublicPlayer({}, true), opponent: safeCrackerPublicPlayer({}, false)
    };
  }
  const me = state.players?.[viewer] || {};
  const opponent = state.players?.[opponentId] || {};
  const now = Date.now();
  const nextGuessMs = Date.parse(me.nextGuessAt || '');
  const endMs = Date.parse(state.endAt || '');
  const cooldownMs = Number.isFinite(nextGuessMs) ? Math.max(0, nextGuessMs - now) : 0;
  const complete = String(game?.status || '') === 'complete';
  return {
    roundId: state.roundId,
    startAt: state.startAt,
    endAt: state.endAt,
    revision: int(state.revision, 0),
    secondsLeft: complete ? 0 : Number.isFinite(endMs) ? Math.max(0, Math.ceil((endMs - now) / 1000)) : 75,
    canSubmit: String(game?.status || '') === 'playing' && ids.includes(viewer) && cooldownMs <= 0 && int(me.stage, 0) < SAFE_CRACKER_STAGES,
    cooldownMs,
    stagesTotal: SAFE_CRACKER_STAGES,
    me: safeCrackerPublicPlayer(me, true),
    opponent: safeCrackerPublicPlayer(opponent, false),
    revealedCodes: complete ? { my: String(me.code || ''), opponent: String(opponent.code || '') } : undefined
  };
}

function safeCrackerSummary(game, state, winnerId, tie, reason) {
  const creatorId = cleanUserId(game?.creator?.userId);
  const joinerId = cleanUserId(game?.joiner?.userId);
  const summary = id => ({
    stage: int(state.players?.[id]?.stage, 0),
    attempts: Array.isArray(state.players?.[id]?.attempts) ? state.players[id].attempts.length : 0
  });
  return {
    mode: 'safecracker',
    winnerRole: tie ? '' : winnerId === creatorId ? 'creator' : 'joiner',
    tie: Boolean(tie),
    text: reason || (tie ? 'Neither safe opened before time expired.' : 'First safe opened wins.'),
    creator: summary(creatorId),
    joiner: summary(joinerId)
  };
}

// SAFE_CRACKER_DIRECT_COMPLETION_START
function safeCrackerCompletedPlayerId(game, state) {
  return safeCrackerPlayerIds(game)
    .filter(id => Boolean(state?.players?.[id]?.completedAt) || int(state?.players?.[id]?.stage, 0) >= SAFE_CRACKER_STAGES)
    .sort((a, b) => String(state?.players?.[a]?.completedAt || '').localeCompare(String(state?.players?.[b]?.completedAt || '')))[0] || '';
}

async function safeCrackerComplete(game, state, winnerId = '', reason = '') {
  const gameId = mpCleanId(game?.gameId);
  let latest = null;
  try { latest = await duelGetRawStrong(gameId, 1); } catch {}
  if (!latest) {
    try { latest = await duelGetRaw(gameId); } catch {}
  }
  if (latest?.status === 'complete') return latest;

  const baseGame = latest || game;
  const incomingState = safeCrackerEnsureState({ ...baseGame, safecrackerState: state });
  const storedState = latest?.safecrackerState ? safeCrackerEnsureState(latest) : null;
  const finalBase = storedState && int(storedState.revision, 0) > int(incomingState.revision, 0) ? storedState : incomingState;
  const ids = safeCrackerPlayerIds(baseGame);
  let cleanWinner = cleanUserId(winnerId || finalBase.winnerUserId || '');
  if (!ids.includes(cleanWinner)) cleanWinner = safeCrackerCompletedPlayerId(baseGame, finalBase);
  const tie = !cleanWinner;
  const completionAt = String(
    (cleanWinner && finalBase.players?.[cleanWinner]?.completedAt) ||
    (tie && finalBase.endAt) ||
    baseGame.completedAt ||
    nowIso()
  );
  const finalState = {
    ...finalBase,
    winnerUserId: cleanWinner,
    revision: Math.max(int(finalBase.revision, 0), int(state?.revision, 0)) + 1,
    npcActionAt: null
  };
  const summary = {
    ...safeCrackerSummary(baseGame, finalState, cleanWinner, tie, reason),
    completionAt,
    completionMode: 'direct-v8'
  };

  // The completed object returned here is authoritative for this request. Never
  // replace it with a briefly stale playing snapshot from a follow-up read.
  return await duelCompleteWithResolved(
    { ...baseGame, safecrackerState: finalState, npcActionAt: null, completedAt: completionAt },
    summary
  );
}
// SAFE_CRACKER_DIRECT_COMPLETION_END

function safeCrackerCandidateMatches(candidate, attempt) {
  return safeCrackerTier(safeCrackerCircularDistance(candidate, attempt.guess)) === String(attempt.tier || '');
}

function safeCrackerBotGuess(player) {
  const stage = int(player?.stage, 0);
  const attempts = (Array.isArray(player?.attempts) ? player.attempts : []).filter(attempt => int(attempt.stage, 0) === stage);
  let candidates = Array.from({ length: 10 }, (_, value) => value).filter(candidate => attempts.every(attempt => safeCrackerCandidateMatches(candidate, attempt)));
  if (!candidates.length) candidates = Array.from({ length: 10 }, (_, value) => value);
  const tried = new Set(attempts.map(attempt => int(attempt.guess, 0)));
  const guesses = Array.from({ length: 10 }, (_, value) => value).filter(value => !tried.has(value));
  if (!guesses.length) return candidates[Math.floor(Math.random() * candidates.length)] || 0;
  const ranked = guesses.map(guess => {
    const buckets = new Map();
    for (const candidate of candidates) {
      const tier = safeCrackerTier(safeCrackerCircularDistance(candidate, guess));
      buckets.set(tier, (buckets.get(tier) || 0) + 1);
    }
    return { guess, worst: Math.max(...buckets.values(), 0) };
  }).sort((a, b) => a.worst - b.worst || Math.random() - 0.5);
  return ranked[0]?.guess ?? guesses[0];
}

function safeCrackerBotDelay(game) {
  const network = game?.remoteNetworkConfig && typeof game.remoteNetworkConfig === 'object' ? game.remoteNetworkConfig : null;
  const min = network ? Math.max(100, int(network.minDelayMs, 100)) : 700;
  const max = network ? Math.max(min, int(network.maxDelayMs, min + 500)) : 1550;
  let delay = min + Math.floor(Math.random() * (max - min + 1)) + 420;
  if (network && Math.random() < Number(network.stallChance || 0)) delay += 1800 + Math.floor(Math.random() * 2200);
  return delay;
}

// SAFE_CRACKER_FEEDBACK_LATENCY_V1_START
async function safeCrackerApplyGuess(game, actorId, guess, actionId = '', isBot = false) {
  const id = cleanUserId(actorId);
  const gameId = mpCleanId(game?.gameId);
  const cleanActionId = String(actionId || '').replace(/[^A-Za-z0-9._:-]/g, '').slice(0, 120);
  if (!id || !gameId) throw new Error('Safe Cracker could not identify that action.');
  let fallback = game;
  for (let writeAttempt = 0; writeAttempt < 4; writeAttempt += 1) {
    // safeCrackerAction and the bot preflight already supplied a strong snapshot.
    // Reusing it on the first attempt removes one complete Blob read from every
    // guess while retries still re-read authoritative storage.
    const latest = writeAttempt === 0 && fallback
      ? fallback
      : (await duelGetRawStrong(gameId, 1) || await duelGetRaw(gameId) || fallback);
    if (!latest) throw new Error('That Safe Cracker duel was not found.');
    if (latest.mode !== 'safecracker') throw new Error('That duel is not Safe Cracker.');
    if (latest.status !== 'playing') return latest;
    let state = safeCrackerEnsureState(latest);
    if (cleanActionId && state.processedActionIds.includes(cleanActionId)) return latest;
    const player = { ...(state.players?.[id] || {}) };
    if (!player.code) throw new Error('Safe Cracker could not find that player safe.');
    if (int(player.stage, 0) >= SAFE_CRACKER_STAGES) return latest;
    const now = Date.now();
    const nextGuessMs = Date.parse(player.nextGuessAt || '');
    if (!isBot && Number.isFinite(nextGuessMs) && now < nextGuessMs) return latest;
    const stage = int(player.stage, 0);
    const target = int(String(player.code)[stage], 0);
    const distance = safeCrackerCircularDistance(target, guess);
    const tier = safeCrackerTier(distance);
    const correct = tier === 'green';
    const at = new Date(now).toISOString();
    const result = { stage, guess, distance, tier, correct, at };
    player.attempts = [...(Array.isArray(player.attempts) ? player.attempts : []), result].slice(-80);
    player.lastResult = result;
    player.stage = correct ? Math.min(SAFE_CRACKER_STAGES, stage + 1) : stage;
    player.nextGuessAt = new Date(now + SAFE_CRACKER_VERIFY_MS).toISOString();
    if (player.stage >= SAFE_CRACKER_STAGES) player.completedAt = at;
    const baseStateRevision = int(state.revision, 0);
    const processed = cleanActionId ? [...(state.processedActionIds || []), cleanActionId].slice(-80) : (state.processedActionIds || []);
    state = {
      ...state,
      revision: baseStateRevision + 1,
      players: { ...(state.players || {}), [id]: player },
      processedActionIds: processed,
      npcActionAt: isBot && player.stage < SAFE_CRACKER_STAGES ? new Date(now + safeCrackerBotDelay(latest)).toISOString() : state.npcActionAt
    };
    const candidate = { ...latest, safecrackerState: state };

    // Keep the pre-save completion/revision guard. It prevents a late guess from
    // overwriting an opponent's authoritative win, but uses only one strong
    // attempt instead of the older duplicated read chain.
    const beforeSave = await duelGetRawStrong(gameId, 1) || await duelGetRaw(gameId);
    if (beforeSave) {
      if (beforeSave.status !== 'playing') return beforeSave;
      const beforeState = safeCrackerEnsureState(beforeSave);
      if (cleanActionId && beforeState.processedActionIds.includes(cleanActionId)) return beforeSave;
      if (int(beforeState.revision, 0) > baseStateRevision || int(beforeSave.revision, 0) > int(latest.revision, 0)) {
        fallback = beforeSave;
        continue;
      }
    }

    // Final digits still use the protected immediate-completion path so the bot
    // cannot write after the winning player and reopen the round.
    if (player.stage >= SAFE_CRACKER_STAGES) {
      return await safeCrackerComplete(candidate, state, id, ((latest.creator?.userId === id ? latest.creator?.name : latest.joiner?.name) || 'A player') + ' opened the safe first.');
    }

    const saved = await duelSaveGame(candidate);
    const confirmed = await duelGetRawStrong(gameId, 1) || await duelGetRaw(gameId) || saved;
    const confirmedState = safeCrackerEnsureState(confirmed);
    const kept = cleanActionId
      ? confirmedState.processedActionIds.includes(cleanActionId)
      : String(confirmedState.players?.[id]?.lastResult?.at || '') === at;
    if (kept) return confirmed;
    fallback = confirmed;
  }
  return await duelGetRawStrong(gameId, 1) || await duelGetRaw(gameId) || fallback;
}

async function safeCrackerAdvanceAndSave(game) {
  const gameId = mpCleanId(game?.gameId);
  if (!gameId) return game;

  // Polling normally only observes the bot timer. Do that read outside the
  // mutation lock so an aborted/in-flight GET cannot queue in front of a player
  // pressing Check Number.
  const observed = await duelGetRawStrong(gameId, 1) || await duelGetRaw(gameId) || game;
  if (!observed || observed.status !== 'playing' || observed.mode !== 'safecracker') return observed || game;
  const observedState = safeCrackerEnsureState(observed);
  const observedCompletedPlayerId = safeCrackerCompletedPlayerId(observed, observedState);
  const observedEndMs = Date.parse(observedState.endAt || '');
  const observedNpcPlayer = [observed.creator, observed.joiner].find(player => player?.isNpc || String(player?.userId || '').startsWith('npc-') || String(player?.userId || '').startsWith('remote-bot-'));
  const observedNpcId = cleanUserId(observedNpcPlayer?.userId || '');
  const observedScheduled = Date.parse(observedState.npcActionAt || '');
  const observedNpcDone = !observedNpcId || int(observedState.players?.[observedNpcId]?.stage, 0) >= SAFE_CRACKER_STAGES;
  const needsMutation = Boolean(observedCompletedPlayerId)
    || (Number.isFinite(observedEndMs) && Date.now() >= observedEndMs)
    || (observedNpcDone ? Boolean(observedState.npcActionAt) : !Number.isFinite(observedScheduled) || Date.now() >= observedScheduled);
  if (!needsMutation) return observed;

  return await withSafeCrackerLock(gameId, async () => {
    let latest = await duelGetRawStrong(gameId, 1) || await duelGetRaw(gameId) || observed;
    if (!latest || latest.status !== 'playing' || latest.mode !== 'safecracker') return latest || observed;
    let state = safeCrackerEnsureState(latest);
    const alreadyCompletedPlayerId = safeCrackerCompletedPlayerId(latest, state);
    if (alreadyCompletedPlayerId) {
      const playerName = latest.creator?.userId === alreadyCompletedPlayerId ? latest.creator?.name : latest.joiner?.name;
      return await safeCrackerComplete({ ...latest, safecrackerState: state }, state, alreadyCompletedPlayerId, (playerName || 'A player') + ' opened the safe first.');
    }
    const endMs = Date.parse(state.endAt || '');
    if (Number.isFinite(endMs) && Date.now() >= endMs) {
      return await safeCrackerComplete({ ...latest, safecrackerState: state }, state, '', 'Time expired before either safe opened.');
    }
    const npcPlayer = [latest.creator, latest.joiner].find(player => player?.isNpc || String(player?.userId || '').startsWith('npc-') || String(player?.userId || '').startsWith('remote-bot-'));
    const npcId = cleanUserId(npcPlayer?.userId || '');
    if (!npcId || int(state.players?.[npcId]?.stage, 0) >= SAFE_CRACKER_STAGES) {
      if (state.npcActionAt) {
        state = { ...state, revision: int(state.revision, 0) + 1, npcActionAt: null };
        return await duelSaveGame({ ...latest, safecrackerState: state });
      }
      return latest;
    }
    const scheduled = Date.parse(state.npcActionAt || '');
    if (!Number.isFinite(scheduled)) {
      state = { ...state, revision: int(state.revision, 0) + 1, npcActionAt: new Date(Date.now() + safeCrackerBotDelay(latest)).toISOString() };
      return await duelSaveGame({ ...latest, safecrackerState: state });
    }
    if (Date.now() < scheduled) return latest;
    const guess = safeCrackerBotGuess(state.players[npcId]);
    return await safeCrackerApplyGuess({ ...latest, safecrackerState: state }, npcId, guess, 'bot-' + state.revision + '-' + guess, true);
  });
}

async function safeCrackerAction(user, gameId, rawChoice, details = {}) {
  return await withSafeCrackerLock(gameId, async () => {
    const viewer = cleanUserId(user.id);
    const actionStartedAt = Date.now();
    let game = await duelGetRawStrong(gameId, 1) || await duelGetRaw(gameId);
    if (!game) throw new Error('That Safe Cracker duel was not found.');
    if (game.mode !== 'safecracker') throw new Error('That duel is not Safe Cracker.');
    if (game.status !== 'playing') {
      const response = { game: duelPublicGame(game, viewer), feedbackPath: 'fast-authoritative-v1', feedbackServerMs: Date.now() - actionStartedAt };
      if (game.status === 'complete') response.record = await getUserRecord(viewer);
      else response.skipBalanceLookup = true;
      return response;
    }
    if (!safeCrackerPlayerIds(game).includes(viewer)) throw new Error('You are not in this Safe Cracker duel.');
    let state = safeCrackerEnsureState(game);
    const alreadyCompletedPlayerId = safeCrackerCompletedPlayerId(game, state);
    if (alreadyCompletedPlayerId) {
      const playerName = game.creator?.userId === alreadyCompletedPlayerId ? game.creator?.name : game.joiner?.name;
      game = await safeCrackerComplete({ ...game, safecrackerState: state }, state, alreadyCompletedPlayerId, (playerName || 'A player') + ' opened the safe first.');
      return { game: duelPublicGame(game, viewer), record: await getUserRecord(viewer), repairedCompletion: true, feedbackPath: 'fast-authoritative-v1', feedbackServerMs: Date.now() - actionStartedAt };
    }
    const endMs = Date.parse(state.endAt || '');
    if (Number.isFinite(endMs) && Date.now() >= endMs) {
      game = await safeCrackerComplete({ ...game, safecrackerState: state }, state, '', 'Time expired before either safe opened.');
      return { game: duelPublicGame(game, viewer), record: await getUserRecord(viewer), feedbackPath: 'fast-authoritative-v1', feedbackServerMs: Date.now() - actionStartedAt };
    }
    const actionId = String(details.actionId || '').replace(/[^A-Za-z0-9._:-]/g, '').slice(0, 120);
    if (actionId && state.processedActionIds.includes(actionId)) {
      return {
        game: duelPublicGame({ ...game, safecrackerState: state }, viewer),
        skipBalanceLookup: true,
        ignoredAction: true,
        ignoreReason: 'duplicate',
        feedbackPath: 'fast-authoritative-v1',
        feedbackServerMs: Date.now() - actionStartedAt
      };
    }
    const match = /^safecracker:guess:([0-9])$/.exec(String(rawChoice || '').toLowerCase());
    if (!match) throw new Error('Choose one dial number from 0 to 9.');
    const player = state.players?.[viewer] || {};
    const nextGuessMs = Date.parse(player.nextGuessAt || '');
    if (Number.isFinite(nextGuessMs) && Date.now() < nextGuessMs) {
      return {
        game: duelPublicGame({ ...game, safecrackerState: state }, viewer),
        skipBalanceLookup: true,
        ignoredAction: true,
        ignoreReason: 'verification-cooldown',
        retryAfterMs: Math.max(0, nextGuessMs - Date.now()),
        feedbackPath: 'fast-authoritative-v1',
        feedbackServerMs: Date.now() - actionStartedAt
      };
    }
    game = await safeCrackerApplyGuess({ ...game, safecrackerState: state }, viewer, int(match[1], 0), actionId, false);
    const response = {
      game: duelPublicGame(game, viewer),
      feedbackPath: 'fast-authoritative-v1',
      feedbackServerMs: Date.now() - actionStartedAt
    };
    if (game.status === 'complete') response.record = await getUserRecord(viewer);
    else response.skipBalanceLookup = true;
    return response;
  });
}
// SAFE_CRACKER_FEEDBACK_LATENCY_V1_END

// SAFE_CRACKER_SERVER_END

// MOUNTAIN_RACE_SERVER_START
// MOUNTAIN_RACE_FAST_ACK_V9
async function mountainRaceFastSaveGame(game) {
  const clean = duelSanitizeGame({
    ...game,
    schemaVersion: DUEL_SCHEMA_VERSION,
    revision: int(game?.revision, 0) + 1,
    updatedAt: nowIso()
  });
  await getUsersStore().setJSON(duelGameKey(clean.gameId), clean);
  return clean;
}

const mountainRaceIntegration = createMountainRaceIntegration({
  cleanUserId,
  int,
  mpCleanId,
  getRaw: duelGetRaw,
  getRawStrong: gameId => duelGetRawStrong(gameId, 1),
  saveGame: mountainRaceFastSaveGame,
  publicGame: duelPublicGame,
  completeResolved: duelCompleteWithResolved,
  getUserRecord
});
function mountainRaceInitialState(game, startMs) { return mountainRaceIntegration.initialState(game, startMs); }
function mountainRaceEnsureState(game) { return mountainRaceIntegration.ensureState(game); }
function mountainRaceHasValidState(game) { return mountainRaceIntegration.hasValidState(game); }
function mountainRacePublicState(game, viewerId) { return mountainRaceIntegration.publicState(game, viewerId); }
async function mountainRaceAdvanceAndSave(game) { return await mountainRaceIntegration.advance(game); }
async function mountainRaceAction(user, gameId, rawChoice, details) { return await mountainRaceIntegration.action(user, gameId, rawChoice, details); }
// MOUNTAIN_RACE_SERVER_END

// Shared duel ready lifecycle. This is the only code allowed to move a duel
// from ready -> countdown -> playing. The server owns all timestamps.
const DUEL_READY_WINDOW_MS = 10000;
const DUEL_COUNTDOWN_MS = 5000; // network buffer + smooth 3, 2, 1, GO on both clients
const DUEL_READY_LOCKS = globalThis.__DUEL_READY_LOCKS || (globalThis.__DUEL_READY_LOCKS = new Map());

async function withDuelReadyLock(gameId, task) {
  const key = cleanUserId(gameId);
  const prior = DUEL_READY_LOCKS.get(key) || Promise.resolve();
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const queued = prior.then(() => gate);
  DUEL_READY_LOCKS.set(key, queued);
  await prior;
  try {
    return await task();
  } finally {
    release();
    if (DUEL_READY_LOCKS.get(key) === queued) DUEL_READY_LOCKS.delete(key);
  }
}

function duelPlayerIds(game) {
  return [cleanUserId(game?.creator?.userId), cleanUserId(game?.joiner?.userId)].filter(Boolean);
}

function duelReadyFlags(game) {
  const ready = { ...(game?.ready || {}) };
  for (const id of duelPlayerIds(game)) ready[id] = Boolean(ready[id]);
  return ready;
}

function duelStartCountdown(game, atMs = Date.now()) {
  const effectiveStartMs = atMs + duelCountdownMs(game?.mode);
  let next = {
    ...game,
    status: "countdown",
    ready: duelReadyFlags(game),
    countdownStartedAt: new Date(atMs).toISOString(),
    startAt: new Date(effectiveStartMs).toISOString(),
    readyWindowStartedAt: null,
    readyDeadlineAt: null,
    npcReadyAt: null,
    npcReadyWindowId: null
  };
  // Build fishing once, from the exact GO timestamp. It is then immutable for
  // this game/round and can never be recreated by a client refresh.
  if (next.mode === "fishing") next.fishingState = fishingInitialState(next, effectiveStartMs);
  if (next.mode === "draw") next.drawState = drawInitialState(next, effectiveStartMs);
  if (next.mode === "roulette") next.rouletteState = rouletteInitialState(next, effectiveStartMs);
  if (next.mode === "safecracker") next.safecrackerState = safeCrackerInitialState(next, effectiveStartMs);
  if (next.mode === "mountainrace") next.mountainraceState = mountainRaceInitialState(next, effectiveStartMs);
  return next;
}

function duelNormalizeReadyState(game) {
  if (!game) return game;
  let next = duelSanitizeGame(game);
  if (!["ready", "countdown"].includes(next.status)) return next;
  const now = Date.now();
  const ids = duelPlayerIds(next);
  let ready = duelReadyFlags(next);

  if (next.status === "countdown") {
    const startMs = Date.parse(next.startAt || "");
    if (Number.isFinite(startMs) && now >= startMs) {
      next = { ...next, status: "playing", ready };
      if (next.mode === "fishing" && !fishingHasValidTimeline(next.fishingState || {})) {
        next.fishingState = fishingInitialState(next, startMs);
      }
      if (next.mode === "draw" && !next.drawState) next.drawState = drawInitialState(next, startMs);
      if (next.mode === "roulette" && !next.rouletteState) next.rouletteState = rouletteInitialState(next, startMs);
      if (next.mode === "safecracker" && !safeCrackerHasValidState(next)) next.safecrackerState = safeCrackerInitialState(next, startMs);
      if (next.mode === "mountainrace" && !mountainRaceHasValidState(next)) next.mountainraceState = mountainRaceInitialState(next, startMs);
    }
    return next;
  }

  const deadlineMs = Date.parse(next.readyDeadlineAt || "");
  if (Number.isFinite(deadlineMs) && now >= deadlineMs) {
    ready = Object.fromEntries(ids.map(id => [id, false]));
    return {
      ...next,
      status: "ready",
      ready,
      readyWindowStartedAt: null,
      readyDeadlineAt: null,
      npcReadyAt: null,
      npcReadyWindowId: null,
      countdownStartedAt: null,
      startAt: null,
      fishingState: next.mode === "fishing" ? null : next.fishingState,
      drawState: next.mode === "draw" ? null : next.drawState,
      rouletteState: next.mode === "roulette" ? null : next.rouletteState,
      safecrackerState: next.mode === "safecracker" ? null : next.safecrackerState,
      mountainraceState: next.mode === "mountainrace" ? null : next.mountainraceState
    };
  }

  const npcId = next.joiner?.isNpc || String(next.joiner?.userId || "").startsWith("npc-")
    ? cleanUserId(next.joiner?.userId) : "";
  const npcReadyMs = Date.parse(next.npcReadyAt || "");
  if (npcId && !ready[npcId] && Number.isFinite(npcReadyMs) && now >= npcReadyMs) ready[npcId] = true;

  if (ids.length === 2 && ids.every(id => ready[id])) return duelStartCountdown({ ...next, ready }, now);
  return { ...next, ready };
}

// DRAW uses the same shared ready lifecycle.
function drawNormalizeReadyState(game) {
  return duelNormalizeReadyState(game);
}

function duelControlledActor(game, user, asTestPlayer = false) {
  const ownerId = cleanUserId(user?.id);
  const testPlayer = game?.joiner?.isTestPlayer ? game.joiner : null;
  if (!asTestPlayer) return { id: ownerId, name: user?.name || "Player", ownerId };
  if (!testPlayer || cleanUserId(game.testControllerUserId) !== ownerId) throw new Error("You cannot control this test player.");
  return { id: cleanUserId(testPlayer.userId), name: testPlayer.name || "Test Player", ownerId };
}

async function duelReadyGame(user, gameId, options = {}) {
  return await withDuelReadyLock(gameId, async () => {
    const requestedGameId = mpCleanId(gameId);
    let game = null;
    for (let attempt = 0; attempt < 6 && !game; attempt += 1) {
      game = await duelGetRawStrong(requestedGameId, 1) || await duelGetRaw(requestedGameId);
      if (!game) {
        const active = await duelFindActiveGameForUser(user.id);
        if (active && active.gameId === requestedGameId) game = active;
      }
      if (!game && attempt < 5) await sleep(180 + attempt * 180);
    }
    if (!game) throw new Error("That duel was not found.");
    const actor = duelControlledActor(game, user, Boolean(options.asTestPlayer));
    const viewer = actor.id;
    if (!game.joiner) throw new Error("Waiting for another player to join.");
    if (!duelPlayerIds(game).includes(viewer)) throw new Error("You are not in this duel.");

    game = duelNormalizeReadyState(game);
    // Ready is idempotent. Mobile taps, rerenders, or a delayed response can
    // submit the same Ready gesture after the duel already advanced. Return the
    // authoritative snapshot instead of surfacing a misleading runtime error.
    if (["countdown", "playing", "complete", "cancelled"].includes(game.status)) {
      return { game: duelPublicGame(game, viewer), record: await getUserRecord(user.id) };
    }
    if (game.status !== "ready") throw new Error("This game is not waiting for Ready.");

    const now = Date.now();
    const ids = duelPlayerIds(game);
    let ready = duelReadyFlags(game);
    const existingDeadline = Date.parse(game.readyDeadlineAt || "");
    const alreadyReady = Boolean(ready[viewer]);

    // Idempotent: repeated clicks for the same player/window return the same
    // confirmed state and never restart or extend the ten-second window.
    if (!alreadyReady) {
      if (!Number.isFinite(existingDeadline) || now >= existingDeadline || !Object.values(ready).some(Boolean)) {
        ready = Object.fromEntries(ids.map(id => [id, false]));
        const windowId = `ready-${crypto.randomBytes(6).toString("hex")}`;
        game.readyWindowStartedAt = new Date(now).toISOString();
        game.readyDeadlineAt = new Date(now + DUEL_READY_WINDOW_MS).toISOString();
        game.readyWindowId = windowId;
        game.npcReadyAt = null;
        game.npcReadyWindowId = null;
      }
      ready[viewer] = true;
    }

    const npcId = game.joiner?.isNpc || String(game.joiner?.userId || "").startsWith("npc-")
      ? cleanUserId(game.joiner?.userId) : "";
    const humanId = ids.find(id => id !== npcId) || "";
    const activeWindowId = String(game.readyWindowId || game.readyWindowStartedAt || "");
    if (npcId && viewer === humanId && ready[humanId] && !ready[npcId]) {
      // Synthetic opponents share one Ready contract in every mode. Confirming
      // both flags under this lock prevents delayed bot timers and GET polls
      // from competing to own the countdown transition.
      ready[npcId] = true;
      game.npcReadyAt = null;
      game.npcReadyWindowId = activeWindowId;
    }

    game = duelNormalizeReadyState({ ...game, ready });
    game = await duelSaveGame(game);
    return { game: duelPublicGame(game, viewer), record: await getUserRecord(user.id) };
  });
}

async function duelAddSimpleNpc(user, gameId) {
  const viewer = cleanUserId(user.id);
  let game = await duelGetRawStrong(gameId);
  // A client can briefly hold an older game id after a namespace migration or
  // an eventually-consistent lobby refresh. Resolve the creator's authoritative
  // active duel before failing the NPC request.
  if (!game) {
    const active = await duelFindActiveGameForUser(viewer);
    if (active && cleanUserId(active.creator?.userId) === viewer) game = active;
  }
  if (!game) throw new Error("Create a Russian Roulette duel before adding the NPC.");
  if (game.creator.userId !== viewer) throw new Error("Only the creator can add the NPC.");
  if (!duelSupportsSyntheticOpponent(game.mode)) throw new Error("This game does not support a synthetic opponent.");
  if (game.status !== "waiting" || game.joiner) throw new Error("The NPC can only be added to a waiting duel.");
  const npcId = `npc-${game.mode}-${crypto.randomBytes(4).toString("hex")}`;
  const npcPlayer = duelSanitizePlayer({
    userId: npcId,
    name: game.mode === "draw" ? "Quickdraw Opponent" : game.mode === "roulette" ? "Roulette Opponent" : game.mode === "safecracker" ? "Vault Cracker" : game.mode === "mountainrace" ? "Mountain Bot" : "Fishing Opponent",
    tornId: npcId,
    avatarUrl: "",
    isNpc: true,
    isTestPlayer: false
  });
  game = await duelSaveGame({
    ...game,
    status: "ready",
    pot: game.wager,
    npcTest: true,
    testPlayerMode: false,
    testControllerUserId: "",
    joiner: npcPlayer,
    ready: { [game.creator.userId]: false, [npcPlayer.userId]: false },
    readyWindowStartedAt: null,
    readyDeadlineAt: null,
    countdownStartedAt: null,
    startAt: null,
    npcReadyAt: null,
    npcActionAt: null,
    actions: {},
    blackjackState: null,
    drawState: null,
    fishingState: null,
    rouletteState: null,
    safecrackerState: null,
    mountainraceState: null,
    ledgerIds: { ...(game.ledgerIds || {}), npc: `duel:${game.gameId}:simple-${game.mode}-npc` }
  });
  return { game: duelPublicGame(game, viewer), record: await getUserRecord(viewer) };
}

async function duelAddRemoteNetworkBot(user, gameId, profile = "normal") {
  const viewer = cleanUserId(user.id);
  let game = await duelGetRawStrong(gameId);
  if (!game) {
    const active = await duelFindActiveGameForUser(viewer);
    if (active && cleanUserId(active.creator?.userId) === viewer) game = active;
  }
  if (!game) throw new Error("Create a duel before adding the Remote Network Bot.");
  if (cleanUserId(game.creator?.userId) !== viewer) throw new Error("Only the creator can add the Remote Network Bot.");
  if (!duelSupportsSyntheticOpponent(game.mode)) throw new Error("This game does not support the Remote Network Bot.");
  const profiles = {
    normal:{label:"Normal",minDelayMs:100,maxDelayMs:400,stallChance:0,duplicateChance:0,reconnectChance:0},
    mobile:{label:"Mobile",minDelayMs:300,maxDelayMs:1500,stallChance:.08,duplicateChance:.02,reconnectChance:.04},
    bad:{label:"Bad Connection",minDelayMs:500,maxDelayMs:3000,stallChance:.18,duplicateChance:.08,reconnectChance:.12},
    stress:{label:"Stress Test",minDelayMs:100,maxDelayMs:3500,stallChance:.25,duplicateChance:.18,reconnectChance:.18}
  };
  const key = Object.prototype.hasOwnProperty.call(profiles, String(profile)) ? String(profile) : "normal";
  const network = profiles[key];
  const existingRemoteBot = String(game.joiner?.userId || "").startsWith("remote-bot-");
  if (existingRemoteBot && game.npcTest) {
    return {game:duelPublicGame(game,viewer),record:await getUserRecord(viewer),remoteNetworkProfile:key,remoteNetworkConfig:network,recoveredExistingBot:true};
  }
  if (game.status !== "waiting" || game.joiner) throw new Error("The Remote Network Bot can only join a waiting duel.");
  const botId = `remote-bot-${game.mode}-${crypto.randomBytes(4).toString("hex")}`;
  const bot = duelSanitizePlayer({userId:botId,name:`Remote Bot (${network.label})`,tornId:botId,avatarUrl:"",isNpc:true,isRemoteBot:true,isTestPlayer:false});
  game = await duelSaveGame({
    ...game,status:"ready",pot:game.wager,npcTest:true,remoteNetworkTest:true,remoteNetworkProfile:key,remoteNetworkConfig:network,
    testPlayerMode:false,testControllerUserId:"",joiner:bot,ready:{[game.creator.userId]:false,[bot.userId]:false},
    readyWindowStartedAt:null,readyDeadlineAt:null,countdownStartedAt:null,startAt:null,npcReadyAt:null,npcActionAt:null,actions:{},
    blackjackState:null,drawState:null,fishingState:null,rouletteState:null,safecrackerState:null,mountainraceState:null,
    ledgerIds:{...(game.ledgerIds||{}),npc:`duel:${game.gameId}:remote-${game.mode}-bot`}
  });
  return {game:duelPublicGame(game,viewer),record:await getUserRecord(viewer),remoteNetworkProfile:key,remoteNetworkConfig:network};
}


function duelRemoteBotProfileConfig(profile = "normal") {
  const profiles = {
    normal:{label:"Normal",minDelayMs:100,maxDelayMs:400,stallChance:0,duplicateChance:0,reconnectChance:0},
    mobile:{label:"Mobile",minDelayMs:300,maxDelayMs:1500,stallChance:.08,duplicateChance:.02,reconnectChance:.04},
    bad:{label:"Bad Connection",minDelayMs:500,maxDelayMs:3000,stallChance:.18,duplicateChance:.08,reconnectChance:.12},
    stress:{label:"Stress Test",minDelayMs:100,maxDelayMs:3500,stallChance:.25,duplicateChance:.18,reconnectChance:.18}
  };
  const key = Object.prototype.hasOwnProperty.call(profiles, String(profile)) ? String(profile) : "normal";
  return { key, network: profiles[key] };
}

function duelRebuildWaitingGameFromCreateResult(user, requestedMode, requestedWager, publicGame = {}) {
  const mode = String(publicGame.mode || requestedMode || "").toLowerCase();
  const wager = int(publicGame.wager, int(requestedWager, 0));
  const gameId = mpCleanId(publicGame.gameId || "");
  if (!gameId || !DUEL_MODES[mode]) return null;
  const at = String(publicGame.createdAt || publicGame.updatedAt || nowIso());
  return duelSanitizeGame({
    schemaVersion: DUEL_SCHEMA_VERSION,
    gameId,
    mode,
    modeName: DUEL_MODES[mode],
    status: String(publicGame.status || "waiting"),
    wager,
    pot: int(publicGame.pot, wager),
    createdAt: at,
    updatedAt: String(publicGame.updatedAt || at),
    creator: duelSanitizePlayer(publicGame.creator || { userId: user.id, name: user.name || "Unknown", tornId: user.tornId || user.id, avatarUrl: user.avatarUrl }),
    joiner: publicGame.joiner ? duelSanitizePlayer(publicGame.joiner) : null,
    actions: {},
    ledgerIds: { creator: `duel:${gameId}:creator-escrow` }
  });
}

async function duelCreateRemoteNetworkBotGame(user, details = {}) {
  const viewer = cleanUserId(user.id);
  const mode = String(details.mode || "roulette").toLowerCase();
  const wager = int(details.wager, 0);
  const clientGameId = duelClientCreateGameId(mode, details.clientGameId || details.gameId || "");
  if (!clientGameId) throw new Error("The game request ID was invalid. Create the duel again.");

  let createResult = null;
  let game = await duelGetRawStrong(clientGameId, 1);
  if (!game) {
    createResult = await duelCreateGame(user, { mode, wager, clientGameId });
    if (createResult?.activeModeConflict) {
      // Never let the atomic testing endpoint attach a bot to a different
      // real-player match returned by the shared active-game guard.
      return { ...createResult, atomicCreateAndAttach: false };
    }
    const createdId = mpCleanId(createResult?.game?.gameId || clientGameId);
    game = await duelGetRawStrong(createdId, 1);
    if (!game) game = duelRebuildWaitingGameFromCreateResult(user, mode, wager, createResult?.game || {});
  }
  if (!game) throw new Error("The duel could not be created for the Remote Network Bot.");
  if (String(game.mode || "") !== mode) throw new Error("The Remote Network Bot request resolved to a different game mode.");
  if (cleanUserId(game.creator?.userId) !== viewer) throw new Error("Only the creator can add the Remote Network Bot.");
  if (!duelSupportsSyntheticOpponent(game.mode)) throw new Error("This game does not support the Remote Network Bot.");

  const { key, network } = duelRemoteBotProfileConfig(details.profile);
  const existingRemoteBot = String(game.joiner?.userId || "").startsWith("remote-bot-");
  if (existingRemoteBot) {
    return {
      game: duelPublicGame(game, viewer),
      record: await getUserRecord(viewer),
      remoteNetworkProfile: key,
      remoteNetworkConfig: network,
      recoveredExistingBot: true,
      recoveredCreate: Boolean(createResult?.recoveredCreate)
    };
  }
  if (game.status !== "waiting" || game.joiner) throw new Error("The Remote Network Bot can only join a waiting duel.");

  const botId = `remote-bot-${game.mode}-${crypto.randomBytes(4).toString("hex")}`;
  const bot = duelSanitizePlayer({
    userId: botId,
    name: `Remote Bot (${network.label})`,
    tornId: botId,
    avatarUrl: "",
    isNpc: true,
    isRemoteBot: true,
    isTestPlayer: false
  });
  game = await duelSaveGame({
    ...game,
    status: "ready",
    pot: game.wager,
    npcTest: true,
    remoteNetworkTest: true,
    remoteNetworkProfile: key,
    remoteNetworkConfig: network,
    testPlayerMode: false,
    testControllerUserId: "",
    joiner: bot,
    ready: { [game.creator.userId]: false, [bot.userId]: false },
    readyWindowStartedAt: null,
    readyDeadlineAt: null,
    countdownStartedAt: null,
    startAt: null,
    npcReadyAt: null,
    npcActionAt: null,
    actions: {},
    blackjackState: null,
    drawState: null,
    fishingState: null,
    rouletteState: null,
    safecrackerState: null,
    mountainraceState: null,
    ledgerIds: { ...(game.ledgerIds || {}), creator: game.ledgerIds?.creator || `duel:${game.gameId}:creator-escrow`, npc: `duel:${game.gameId}:remote-${game.mode}-bot` }
  });
  return {
    game: duelPublicGame(game, viewer),
    record: await getUserRecord(viewer),
    remoteNetworkProfile: key,
    remoteNetworkConfig: network,
    atomicCreateAndAttach: true,
    recoveredCreate: Boolean(createResult?.recoveredCreate)
  };
}

async function duelActionGame(user, gameId, details = {}) {
  let game = await duelReadFocusedGame(user, gameId, 3);
  if (!game) throw new Error("That duel was not found.");
  const actor = duelControlledActor(game, user, Boolean(details.asTestPlayer));
  const viewer = actor.id;
  const actorUser = { ...user, id: viewer, name: actor.name };
  const rawChoice = String(details.choice || "");
  if (rawChoice.toLowerCase() === "ready") return await duelReadyGame(user, gameId, { asTestPlayer: Boolean(details.asTestPlayer) });
  if (["rematch", "npc-rematch", "remote-bot-rematch"].includes(rawChoice.toLowerCase())) {
    return await withDuelReadyLock(gameId, async () => {
      let latest = await duelGetRaw(gameId);
      if (!latest) throw new Error("That duel was not found.");
      if (latest.status !== "complete" || !duelSupportsRematch(latest.mode)) throw new Error("Rematches are only available after a completed duel.");
      const playerIds = [cleanUserId(latest.creator?.userId), cleanUserId(latest.joiner?.userId)].filter(Boolean);
      if (!playerIds.includes(viewer)) throw new Error("You are not in this duel.");
      if (latest.rematchGameId) return { game: duelPublicGame(latest, viewer), record: await getUserRecord(user.id) };
      const npcId = [latest.creator, latest.joiner].find(player => player?.isNpc || String(player?.userId || "").startsWith("npc-"))?.userId || "";
      const isNpcAcceptance = rawChoice.toLowerCase() === "npc-rematch";
      const isRemoteBotRematch = rawChoice.toLowerCase() === "remote-bot-rematch";
      if (isNpcAcceptance && (!latest.npcTest || !npcId)) throw new Error("This duel does not have a simple NPC opponent.");
      const remoteBotId = [latest.creator, latest.joiner].find(player => player?.isRemoteBot || String(player?.userId || "").startsWith("remote-bot-"))?.userId || "";
      if (isRemoteBotRematch && (!latest.remoteNetworkTest || !remoteBotId)) throw new Error("This duel does not have a Remote Network Bot opponent.");
      const now = Date.now();
      let rematch = latest.rematch && typeof latest.rematch === "object" ? { ...latest.rematch } : { requestedBy: {}, firstRequestedAt: null, expiresAt: null };
      const firstAt = Date.parse(rematch.firstRequestedAt || 0);
      const expiresAt = Date.parse(rematch.expiresAt || 0);
      if (!firstAt || !expiresAt || now > expiresAt) {
        if (isNpcAcceptance) throw new Error("The rematch request expired.");
        rematch = { requestedBy: {}, firstRequestedAt: new Date(now).toISOString(), expiresAt: new Date(now + 10000).toISOString() };
      }
      if (isNpcAcceptance) {
        const humanRequestedAt = Object.entries(rematch.requestedBy || {}).find(([id]) => id !== npcId)?.[1];
        if (!humanRequestedAt) throw new Error("Request the rematch before the NPC can accept.");
        if (now - Date.parse(humanRequestedAt) < 2200) throw new Error("The NPC is still deciding.");
      }
      const acceptingId = isRemoteBotRematch ? cleanUserId(remoteBotId) : (isNpcAcceptance ? cleanUserId(npcId) : viewer);
      rematch.requestedBy = { ...(rematch.requestedBy || {}), [acceptingId]: new Date(now).toISOString() };
      latest = await duelSaveGame({ ...latest, rematch });
      const bothAccepted = playerIds.every(id => Boolean(rematch.requestedBy[id]));
      if (!bothAccepted) return { game: duelPublicGame(latest, viewer), record: await getUserRecord(user.id) };

      const firstId = Object.entries(rematch.requestedBy).sort((a,b) => Date.parse(a[1]) - Date.parse(b[1]))[0]?.[0] || playerIds[0];
      const secondId = playerIds.find(id => id !== firstId) || playerIds[1];
      const playerFor = id => {
        const p = cleanUserId(latest.creator?.userId) === id ? latest.creator : latest.joiner;
        return { id, name: p?.name || "Unknown", tornId: p?.tornId || id, avatarUrl: p?.avatarUrl || null };
      };
      let created;
      let creatorForCleanup = playerFor(firstId);
      try {
        const syntheticPlayer = [latest.creator, latest.joiner].find(player => player?.isNpc || player?.isRemoteBot || String(player?.userId || "").startsWith("npc-") || String(player?.userId || "").startsWith("remote-bot-"));
        let rematchGame;
        if (syntheticPlayer) {
          const humanId = playerIds.find(id => id !== cleanUserId(syntheticPlayer.userId));
          const human = playerFor(humanId);
          creatorForCleanup = human;
          created = await duelCreateGame(human, { mode: latest.mode, wager: latest.wager });
          const attached = syntheticPlayer.isRemoteBot || String(syntheticPlayer.userId || "").startsWith("remote-bot-")
            ? await duelAddRemoteNetworkBot(human, created.game.gameId, latest.remoteNetworkProfile || "normal")
            : await duelAddSimpleNpc(human, created.game.gameId);
          rematchGame = attached.game;
        } else {
          created = await duelCreateGame(playerFor(firstId), { mode: latest.mode, wager: latest.wager });
          const joined = await duelJoinGame(playerFor(secondId), created.game.gameId);
          rematchGame = joined.game;
        }
        latest = await duelSaveGame({ ...latest, rematch, rematchGameId: rematchGame.gameId });
        const authoritativeRematch = await duelGetRawStrong(rematchGame.gameId, 2) || await duelGetRaw(rematchGame.gameId) || rematchGame;
        return { game: duelPublicGame(latest, viewer), rematchGame: duelPublicGame(authoritativeRematch, viewer), record: await getUserRecord(user.id) };
      } catch (error) {
        if (created?.game?.gameId) {
          try { await duelCancelGame(creatorForCleanup, created.game.gameId); } catch (_) {}
        }
        throw error;
      }
    });
  }

  // The browser starts the board from the authoritative startAt timestamp. A
  // click can therefore arrive before a separate polling request has persisted
  // countdown -> playing. Normalize and save that transition here under the
  // same Ready lock before rejecting an otherwise valid first action.
  if (["ready", "countdown"].includes(game.status)) {
    game = await withDuelReadyLock(gameId, async () => {
      const latest = await duelGetRaw(gameId);
      if (!latest) throw new Error("That duel was not found.");
      const normalized = duelNormalizeReadyState(latest);
      return JSON.stringify(normalized) !== JSON.stringify(latest) ? await duelSaveGame(normalized) : latest;
    });
  }
  if (game.status !== "playing") throw new Error("That duel is not ready for actions.");
  if (game.creator.userId !== viewer && game.joiner?.userId !== viewer) throw new Error("You are not in this duel.");
  const choice = rawChoice.toLowerCase().replace(/[^a-z0-9._:-]/g, "").slice(0, 60);

  if (game.mode === "draw") {
    if (!choice.startsWith("target:")) throw new Error("Choose a visible DRAW! target.");
    const targetId = choice.slice("target:".length);
    return await drawTapTarget(actorUser, gameId, targetId, details.clickedAt, details.actionId);
  }

  if (game.mode === "fishing") {
    if (!choice.startsWith("fish:")) throw new Error("Tap while a fish is disturbing the water.");
    return await fishingTap(actorUser, gameId, choice.slice(5), details.clickedAt, details.actionId);
  }

  if (game.mode === "roulette") {
    return await rouletteAction(actorUser, gameId, choice, details);
  }

  if (game.mode === "safecracker") {
    return await safeCrackerAction(actorUser, gameId, rawChoice, details);
  }

  if (game.mode === "mountainrace") {
    return await mountainRaceAction(actorUser, gameId, rawChoice, details);
  }

  if (game.mode === "blackjack") {
    const applied = bjApplyTournamentAction(game, viewer, choice || "stand");
    if (applied.complete) {
      const resolved = bjResolveTournament(applied.game, applied.state);
      game = await duelCompleteWithResolved(applied.game, resolved);
    } else {
      game = await duelSaveGame(applied.game);
    }
    return { game: duelPublicGame(game, viewer), record: await getUserRecord(viewer) };
  }

  if (game.actions?.[viewer]) throw new Error("You already locked in your action.");
  const action = { choice: choice || "play", at: nowIso(), hand: Array.isArray(details.hand) ? details.hand.map(n => int(n, 0)).filter(Boolean).slice(0, 5) : undefined };
  game = await duelSaveGame({ ...game, actions: { ...(game.actions || {}), [viewer]: action } });
  game = await duelMaybeComplete(game, viewer);
  return { game: duelPublicGame(game, viewer), record: await getUserRecord(viewer) };
}


function duelAutoNpcGeneric(game) {
  const clean = duelSanitizeGame(game);
  if (clean.status !== "playing" || !clean.joiner?.isNpc || ["draw","fishing","roulette","blackjack","safecracker","mountainrace"].includes(clean.mode)) return clean;
  const npcId = cleanUserId(clean.joiner.userId);
  if (clean.actions?.[npcId]) return clean;
  const nowMs = Date.now();
  const startMs = Date.parse(clean.startAt || clean.updatedAt || 0);
  const actionAt = clean.npcActionAt ? Date.parse(clean.npcActionAt) : startMs + 900 + Math.floor(Math.random() * 1600);
  if (nowMs < actionAt) return { ...clean, npcActionAt: new Date(actionAt).toISOString() };
  return { ...clean, npcActionAt: new Date(actionAt).toISOString(), actions: { ...(clean.actions || {}), [npcId]: { choice: duelNpcChoice(clean.mode), at: nowIso(), npc: true } } };
}

async function duelReadFocusedGame(user, gameId, attempts = 3) {
  const requestedGameId = mpCleanId(gameId);
  if (!requestedGameId) return null;
  const total = Math.max(1, Math.min(6, int(attempts, 3)));
  for (let attempt = 0; attempt < total; attempt += 1) {
    const game = await duelGetRawStrong(requestedGameId, 1) || await duelGetRaw(requestedGameId);
    if (game) return game;
    const active = await duelFindActiveGameForUser(user?.id, "", { scanFallback: false });
    if (active?.gameId === requestedGameId) return active;
    if (attempt + 1 < total) await sleep(120 * (attempt + 1));
  }
  return null;
}

async function duelGetGame(user, gameId, options = {}) {
  let game = await duelReadFocusedGame(user, gameId, 3);
  if (!game) throw new Error("That duel was not found.");
  if (duelIsActiveStatus(game.status) && (duelIsExpired(game) || !duelHasValidSchema(game))) { game = await duelInvalidateLegacyGame(game, "This saved game was outdated or expired. Your wager was returned."); }
  const controlledActor = duelControlledActor(game, user, Boolean(options.asTestPlayer));
  // During an active human-vs-human DRAW round, avoid hydrating and returning the
  // entire target schedule when the authoritative database revision did not change.
  // The browser already owns the immutable schedule and only needs a changed snapshot.
  if (game.mode === "draw" && game.status === "playing" && options.knownRevision !== undefined) {
    const npcId = game?.joiner?.isNpc || String(game?.joiner?.userId || "").startsWith("npc-")
      ? cleanUserId(game.joiner.userId) : "";
    if (!npcId) {
      const peek = await drawDatabase.peekMatchRevision(game.gameId);
      const known = Number(options.knownRevision);
      if (peek && Number.isFinite(known) && known === Number(peek.revision) && Date.now() < Date.parse(peek.endAt || "")) {
        return { unchanged: true, syncRevision: String(peek.revision), gameId: game.gameId };
      }
    }
  }
  if (["ready","countdown"].includes(game.status)) {
    game = await withDuelReadyLock(gameId, async () => {
      const latest = await duelReadFocusedGame(user, gameId, 2);
      if (!latest) throw new Error("That duel was not found.");
      const normalized = duelNormalizeReadyState(latest);
      return JSON.stringify(normalized) !== JSON.stringify(latest) ? await duelSaveGame(normalized) : latest;
    });
  }
  if (game.mode === "draw") {
    let normalized = drawNormalizeReadyState(game);
    if (JSON.stringify(normalized) !== JSON.stringify(game)) game = await duelSaveGame(normalized);
    if (!["ready", "countdown"].includes(game.status)) {
      const latest = await duelGetRaw(gameId);
      if (!latest) throw new Error("That duel was not found.");
      const databaseState = await drawDatabaseState(latest, { runNpc: true });
      game = { ...latest, drawState: databaseState };
      game = await drawMaybeCompleteDatabase(game);
    }
  } else if (game.mode === "fishing") {
    let latest = await duelGetRaw(gameId);
    if (!latest) throw new Error("That duel was not found.");
    latest = duelNormalizeReadyState(latest);
    if (latest.status === "playing") {
      const databaseState = await fishingDatabaseState(latest, { runNpc: true });
      game = { ...latest, fishingState: databaseState };
      game = await fishingMaybeCompleteDatabase(game);
    } else game = latest;
  } else if (game.mode === "roulette") {
    let latest = duelNormalizeReadyState(game);
    if (latest.status === "playing") latest = await rouletteAdvanceAndSave(latest);
    game = latest;
  } else if (game.mode === "safecracker") {
    let latest = duelNormalizeReadyState(game);
    if (latest.status === "playing") latest = await safeCrackerAdvanceAndSave(latest);
    game = latest;
  } else if (game.mode === "mountainrace") {
    let latest = duelNormalizeReadyState(game);
    if (latest.status === "playing") latest = await mountainRaceAdvanceAndSave(latest);
    game = latest;
  } else {
    const auto = duelAutoNpcGeneric(game);
    if (JSON.stringify(auto) !== JSON.stringify(game)) game = await duelSaveGame(auto);
    game = await duelMaybeComplete(game, user.id);
  }
  return { game: duelPublicGame(game, controlledActor.id), skipBalanceLookup: true, contractVersion: MULTIPLAYER_CONTRACT_VERSION };
}




// ---------------- Russian Roulette Duel ----------------
const ROULETTE_LOCKS = globalThis.__ROULETTE_GAME_LOCKS || (globalThis.__ROULETTE_GAME_LOCKS = new Map());
async function withRouletteLock(gameId, task){
  const key=mpCleanId(gameId); const prior=ROULETTE_LOCKS.get(key)||Promise.resolve(); let release;
  const gate=new Promise(r=>release=r); ROULETTE_LOCKS.set(key,prior.then(()=>gate)); await prior;
  try{return await task();}finally{release();setTimeout(()=>ROULETTE_LOCKS.delete(key),0);}
}
function roulettePlayerIds(game){return [cleanUserId(game?.creator?.userId),cleanUserId(game?.joiner?.userId)].filter(Boolean);}
function rouletteOther(game,id){return roulettePlayerIds(game).find(x=>x!==cleanUserId(id))||"";}
function rouletteLog(event, game, state, extra={}){try{console.log(`[roulette-${event}]`,JSON.stringify({gameId:String(game?.gameId||""),revision:Number(state?.revision||0),phase:String(state?.phase||""),turnId:String(state?.turnId||""),remaining:Number(state?.remaining||0),...extra}));}catch{}}
const ROULETTE_REVOLVER_MODEL = "steel-walnut";
function rouletteChamberPosition(value){
  const n=Math.trunc(Number(value));
  return Number.isFinite(n)?Math.min(6,Math.max(1,n)):6;
}
function rouletteNewChamberCycle(){
  const bulletPosition=crypto.randomInt(1,7);
  return {bulletPosition,remaining:bulletPosition,chamberCycleId:crypto.randomBytes(8).toString("hex")};
}
function rouletteRemaining(state={}){
  return rouletteChamberPosition(state.remaining??state.bulletPosition??6);
}
function rouletteInitialState(game,startMs=Date.now()){
  const ids=roulettePlayerIds(game); const first=ids[Math.floor(Math.random()*Math.max(1,ids.length))]||ids[0]||"";
  const chamber=rouletteNewChamberCycle();
  return {phase:"turn",turnId:first,openingSpinWinnerId:first,revolverModel:ROULETTE_REVOLVER_MODEL,...chamber,shotsFired:0,blankStreak:0,spinUsed:Object.fromEntries(ids.map(id=>[id,false])),lastAction:"opening_spin",lastActorId:"",lastOutcome:"first_player",lastShotNumber:0,winnerId:"",loserId:"",startedAt:new Date(startMs).toISOString(),revision:1};
}
function roulettePublicState(game,viewer){
  const st=game?.rouletteState||null;if(!st)return null;
  const {bulletPosition:_hidden,remaining:_hiddenRemaining,chamberCycleId:_hiddenCycle,blankRoundsRemaining:_hiddenBlanks,processedActionIds:_hiddenActionIds,...safe}=st; const id=cleanUserId(viewer);
  return {...safe,revolverModel:ROULETTE_REVOLVER_MODEL,chambersTotal:6,liveRounds:1,chamberModel:"fixed-six",isMyTurn:game?.status==="playing"&&cleanUserId(st.turnId)===id,canSpin:cleanUserId(st.turnId)===id&&!Boolean(st.spinUsed?.[id])&&st.phase==="turn",canShoot:cleanUserId(st.turnId)===id&&["turn","press_luck"].includes(st.phase),canPass:cleanUserId(st.turnId)===id&&st.phase==="press_luck",mySpinUsed:Boolean(st.spinUsed?.[id]),opponentSpinUsed:Boolean(st.spinUsed?.[rouletteOther(game,id)])};
}
function rouletteCanAct(game,viewer){const st=game?.rouletteState||{};return game.status==="playing"&&cleanUserId(st.turnId)===cleanUserId(viewer)&&["turn","press_luck"].includes(st.phase);}
async function roulettePayComplete(game,winnerId,loserId){
  const ids=roulettePlayerIds(game),winner=cleanUserId(winnerId),loser=cleanUserId(loserId);
  if(ids.length!==2||!ids.includes(winner)||!ids.includes(loser)||winner===loser) throw new Error("Russian Roulette winner state is inconsistent.");
  winnerId=winner; loserId=loser;
  const pot=int(game.pot,game.wager*2),npc=Boolean(game.npcTest)||Boolean(game.joiner?.isNpc);const odds=await getGameOddsSettings();const parts=npc?{payout:game.wager,houseCut:0}:mpRealGamePayout(pot,odds.multiplayer.houseCutPercent);
  const player=cleanUserId(game.creator.userId)===winnerId?game.creator:game.joiner; const npcWinner=Boolean(player?.isNpc)||String(player?.userId||"").startsWith("npc-");
  const payout=npcWinner?0:parts.payout;if(payout>0)await duelPayPlayer(player,payout,game,npc?"duel_npc_test_payout":"duel_payout",`${player.name||"Winner"} won Russian Roulette and received ${formatTickets(payout)}.`);
  return {...game,status:"complete",completedAt:nowIso(),winnerUserId:winnerId,loserUserId:loserId,payout,houseCut:npcWinner?pot:parts.houseCut,result:{winnerRole:cleanUserId(game.creator.userId)===winnerId?"creator":"joiner",tie:false,text:"Russian Roulette winner"}};
}
async function rouletteAdvance(game){
  let g=duelSanitizeGame(game),s={...(g.rouletteState||rouletteInitialState(g,Date.parse(g.startAt||0)||Date.now()))}; if(g.status!=="playing")return g;
  const npcId=(g.joiner?.isNpc||String(g.joiner?.userId||"").startsWith("npc-"))?cleanUserId(g.joiner.userId):"";
  if(!(npcId&&cleanUserId(s.turnId)===npcId&&["turn","press_luck"].includes(s.phase))) return {...g,rouletteState:s,npcActionAt:null};

  const now=Date.now();
  const scheduled=Date.parse(g.npcActionAt||"");
  if(!Number.isFinite(scheduled)){
    return {...g,rouletteState:s,npcActionAt:new Date(now+2600+Math.floor(Math.random()*1401)).toISOString()};
  }
  if(now<scheduled)return {...g,rouletteState:s};
  // Reconfirm actor ownership immediately before executing the scheduled NPC
  // action. This protects against stale snapshots and future refactors.
  if(cleanUserId(s.turnId)!==npcId||!["turn","press_luck"].includes(String(s.phase||""))){
    return {...g,rouletteState:s,npcActionAt:null};
  }

  // Execute exactly one NPC decision, then require a fresh server-scheduled
  // delay before any additional action. The NPC only uses public state.
  let nextActionAt=null;
  if(s.phase==="turn"&&!s.spinUsed?.[npcId]&&Number(s.remaining||6)<=3&&Math.random()<.7){
    const chamber=rouletteNewChamberCycle();
    s={...s,revolverModel:ROULETTE_REVOLVER_MODEL,...chamber,blankStreak:0,spinUsed:{...(s.spinUsed||{}),[npcId]:true},lastAction:"spin",lastActorId:npcId,lastOutcome:"spun",revision:Number(s.revision||0)+1};
    nextActionAt=new Date(now+2400+Math.floor(Math.random()*1201)).toISOString();
    return {...g,rouletteState:s,npcActionAt:nextActionAt};
  }

  const remaining=rouletteRemaining(s);
  const pressAgain=s.phase==="press_luck"&&remaining>=4&&Math.random()<.55;
  if(s.phase==="press_luck"&&!pressAgain){
    s={...s,phase:"turn",turnId:rouletteOther(g,npcId),blankStreak:0,lastAction:"pass",lastActorId:npcId,lastOutcome:"passed",revision:Number(s.revision||0)+1};
    return {...g,rouletteState:s,npcActionAt:null};
  }

  const live=remaining===1;
  if(live){
    const winner=rouletteOther(g,npcId);
    if(!winner||winner===npcId) throw new Error("Russian Roulette could not identify the surviving opponent.");
    s={...s,phase:"complete",lastAction:"shoot",lastActorId:npcId,lastOutcome:"live",lastShotNumber:Number(s.shotsFired||0)+1,shotsFired:Number(s.shotsFired||0)+1,winnerId:winner,loserId:npcId,revision:Number(s.revision||0)+1};
    g={...g,rouletteState:s,npcActionAt:null};
    return await roulettePayComplete(g,winner,npcId);
  }
  const nextRemaining=rouletteChamberPosition(remaining-1);
  s={...s,revolverModel:ROULETTE_REVOLVER_MODEL,phase:"press_luck",remaining:nextRemaining,shotsFired:Number(s.shotsFired||0)+1,blankStreak:Number(s.blankStreak||0)+1,lastAction:"shoot",lastActorId:npcId,lastOutcome:"blank",lastShotNumber:Number(s.shotsFired||0)+1,revision:Number(s.revision||0)+1};
  nextActionAt=new Date(now+2600+Math.floor(Math.random()*1401)).toISOString();
  return {...g,rouletteState:s,npcActionAt:nextActionAt};
}
async function rouletteAdvanceAndSave(game){
  const gameId=mpCleanId(game?.gameId);
  if(!gameId)return game;
  // All polling requests and user actions must share one Roulette lock. A
  // delayed/stale GET must never save an NPC action after control has already
  // returned to the human player.
  return await withRouletteLock(gameId,async()=>{
    const latest=await duelGetRaw(gameId);
    if(!latest)return game;
    const next=await rouletteAdvance(latest);
    return JSON.stringify(next)!==JSON.stringify(latest)?await duelSaveGame(next):latest;
  });
}
async function rouletteMaybeComplete(game){return await rouletteAdvanceAndSave(game);}
async function rouletteAction(user,gameId,choice,details={}){return await withRouletteLock(gameId,async()=>{
  // IMPORTANT: a human action must never advance the NPC first. Previously a
  // stale browser request could run rouletteAdvance(), let the NPC finish its
  // turn, then continue as a human shot after control returned to the player.
  // NPC advancement now happens only in authoritative GET/poll processing.
  let g=await duelGetRaw(gameId);if(!g)throw new Error("That duel was not found.");
  if(g.status!=="playing")return {game:duelPublicGame(g,user.id),record:await getUserRecord(user.id)};
  let s={...(g.rouletteState||{})},id=cleanUserId(user.id);
  const actionId=String(details.actionId||"").replace(/[^a-zA-Z0-9._:-]/g,"").slice(0,120);
  const processed=Array.isArray(s.processedActionIds)?s.processedActionIds.map(String):[];
  if(actionId&&processed.includes(actionId))return {game:duelPublicGame(g,id),record:await getUserRecord(id)};
  const expectedTurnId=cleanUserId(details.expectedTurnId||"");
  // Delayed mobile taps and overlapping network responses must be idempotent.
  // Return the newest authoritative snapshot instead of turning an already
  // accepted shot/pass into a 500 that leaves the browser controls stranded.
  if(expectedTurnId&&expectedTurnId!==cleanUserId(s.turnId)){
    return {game:duelPublicGame(g,id),record:await getUserRecord(id),ignoredAction:true,ignoreReason:"turn-changed"};
  }
  if(cleanUserId(s.turnId)!==id){
    return {game:duelPublicGame(g,id),record:await getUserRecord(id),ignoredAction:true,ignoreReason:"not-your-turn"};
  }
  const expectedRevision=Number(details.expectedRevision);
  if(Number.isFinite(expectedRevision)&&expectedRevision>=0&&expectedRevision!==Number(s.revision||0)){
    return {game:duelPublicGame(g,id),record:await getUserRecord(id),ignoredAction:true,ignoreReason:"revision-changed"};
  }
  const markProcessed=state=>actionId?{...state,processedActionIds:[...processed,actionId].slice(-40)}:state;
  if(choice==="roulette:spin"){
    if(s.phase!=="turn")throw new Error("You can only spin before your first shot of the turn.");if(s.spinUsed?.[id])throw new Error("You already used your spin.");
    const chamber=rouletteNewChamberCycle();
    s={...s,revolverModel:ROULETTE_REVOLVER_MODEL,...chamber,blankStreak:0,spinUsed:{...(s.spinUsed||{}),[id]:true},lastAction:"spin",lastActorId:id,lastOutcome:"spun",revision:Number(s.revision||0)+1};
  }else if(choice==="roulette:shoot"){
    if(!["turn","press_luck"].includes(s.phase))throw new Error("You cannot pull the trigger right now.");
    const remaining=rouletteRemaining(s);
    const live=remaining===1;
    if(live){const winner=rouletteOther(g,id);if(!winner||winner===id)throw new Error("Russian Roulette could not identify the surviving opponent.");s={...s,phase:"complete",lastAction:"shoot",lastActorId:id,lastOutcome:"live",lastShotNumber:Number(s.shotsFired||0)+1,shotsFired:Number(s.shotsFired||0)+1,winnerId:winner,loserId:id,revision:Number(s.revision||0)+1};s=markProcessed(s);g=await duelSaveGame({...g,rouletteState:s});g=await duelSaveGame(await roulettePayComplete(g,winner,id));return {game:duelPublicGame(g,id),record:await getUserRecord(id)};}
    const nextRemaining=rouletteChamberPosition(remaining-1);
    s={...s,revolverModel:ROULETTE_REVOLVER_MODEL,phase:"press_luck",remaining:nextRemaining,shotsFired:Number(s.shotsFired||0)+1,blankStreak:Number(s.blankStreak||0)+1,lastAction:"shoot",lastActorId:id,lastOutcome:"blank",lastShotNumber:Number(s.shotsFired||0)+1,revision:Number(s.revision||0)+1};
  }else if(choice==="roulette:pass"){
    if(s.phase!=="press_luck")throw new Error("You can only pass after surviving a blank.");
    const nextTurnId=rouletteOther(g,id);
    s={...s,phase:"turn",turnId:nextTurnId,blankStreak:0,lastAction:"pass",lastActorId:id,lastOutcome:"passed",revision:Number(s.revision||0)+1};
    // When control passes to the NPC, persist its decision deadline now. This
    // removes the otherwise-required extra polling request just to schedule it.
    const nextIsNpc=Boolean(g.joiner?.isNpc)&&cleanUserId(g.joiner?.userId)===cleanUserId(nextTurnId);
    g={...g,npcActionAt:nextIsNpc?new Date(Date.now()+2600+Math.floor(Math.random()*1401)).toISOString():null};
  }else throw new Error("Choose a valid roulette action.");
  s=markProcessed(s);rouletteLog("action",g,s,{choice,userId:id,outcome:s.lastOutcome,actionId});g=await duelSaveGame({...g,rouletteState:s});return {game:duelPublicGame(g,id),record:await getUserRecord(id)};
});}

// ---------------- Rumble Fishing Duel (clean rebuild) ----------------
const FISHING_LOCKS = globalThis.__FISHING_GAME_LOCKS || (globalThis.__FISHING_GAME_LOCKS = new Map());
async function withFishingGameLock(gameId, task) {
  const key = mpCleanId(gameId);
  const prior = FISHING_LOCKS.get(key) || Promise.resolve();
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  FISHING_LOCKS.set(key, prior.then(() => gate));
  await prior;
  try { return await task(); } finally { release(); setTimeout(() => FISHING_LOCKS.delete(key), 0); }
}
function fishingRand(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
function fishingFishIdentity(size){
  let pool;
  if(size>=88) pool=["Titan Sturgeon","Grand Marlin","Giant Bluefin Tuna","Broadbill Swordfish","Arapaima","Mekong Giant Catfish"];
  else if(size>=70) pool=["King Salmon","Northern Muskie","Lake Sturgeon","Alligator Gar","Wels Catfish","Goliath Tigerfish"];
  else if(size>=48) pool=["Largemouth Bass","Rainbow Trout","Red Snapper","Northern Pike","Striped Bass","Mahi-Mahi","Peacock Bass","Common Carp"];
  else if(size>=28) pool=["Yellow Perch","Black Crappie","Bluegill","Brook Trout","Koi Carp","Clown Knifefish","Oscar","River Bream"];
  else pool=["Silver Minnow","Sardine","Tiny Sunfish","Anchovy","Neon Tetra","Guppy","Smelt","Dwarf Gourami"];
  const baseName=pool[fishingRand(0,pool.length-1)];
  const roll=Math.random();
  let variant="standard", rarity="regular", displayName=baseName;
  if(roll<0.006){variant="crystal";rarity="legendary";displayName=`Crystal ${baseName}`;}
  else if(roll<0.018){variant="golden";rarity="rare";displayName=`Golden ${baseName}`;}
  else if(roll<0.031){variant="albino";rarity="rare";displayName=`Albino ${baseName}`;}
  else if(roll<0.045){variant="midnight";rarity="rare";displayName=`Midnight ${baseName}`;}
  else if(roll<0.065){variant="emerald";rarity="uncommon";displayName=`Emerald ${baseName}`;}
  return {name:displayName,baseName,variant,rarity};
}
function fishingInitialState(game, requestedStartMs){
  const requested=Number(requestedStartMs);
  const startMs=Number.isFinite(requested)?requested:Date.now();
  const endMs=startMs+60000;
  const count=fishingRand(7,9);
  // Every fish in a round has a unique measured length, so two visibly different
  // catches can never be resolved as a tie because of duplicate generated sizes.
  const sizePool=Array.from({length:89},(_,i)=>i+12).sort(()=>Math.random()-.5);
  const sizes=sizePool.slice(0,count);
  const min=Math.min(...sizes), max=Math.max(...sizes);
  const rippleMin=fishingRand(42,54), rippleMax=fishingRand(150,184);
  const rumbleMin=fishingRand(10,18), rumbleMax=fishingRand(82,98);
  const events=[];
  const firstAt=startMs+2800;
  const lastEnd=endMs-2200;
  const duration=4400;
  // Keep the same 7–9 ripple count, but reserve a real quiet period between
  // every visible bite. Using explicit non-overlapping start times prevents a
  // new ripple from appearing on the same frame that the previous one ends.
  const minimumQuietGap=1500;
  const availableSpan=lastEnd-firstAt;
  const naturalGap=count>1?(availableSpan-(count*duration))/(count-1):0;
  const quietGap=Math.max(minimumQuietGap,naturalGap);
  for(let i=0;i<count;i++){
    const size=sizes[i];
    const ratio=max===min?.5:(size-min)/(max-min);
    const at=Math.round(firstAt+i*(duration+quietGap));
    const endAt=Math.min(at+duration,lastEnd);
    events.push({
      id:`bite-${i+1}-${crypto.randomBytes(3).toString("hex")}`,
      at:new Date(at).toISOString(), endAt:new Date(endAt).toISOString(),
      size, ...fishingFishIdentity(size),
      ripple:Math.round(rippleMin+(rippleMax-rippleMin)*Math.pow(ratio,.78)),
      rippleSpeed:Number((1.34-ratio*.46+(Math.random()-.5)*.08).toFixed(2)),
      rippleThickness:Math.round(3+ratio*4),
      rippleWobble:Number((0.92+Math.random()*.18).toFixed(2)),
      rumble:Math.round(rumbleMin+(rumbleMax-rumbleMin)*Math.pow(ratio,.72)),
      claimedBy:"", claimedAt:null
    });
  }
  const npcPlanEventIds = events.map(e=>e.id);
  return {roundId:`fish-round-${crypto.randomBytes(6).toString("hex")}`,durationMs:60000,startAt:new Date(startMs).toISOString(),endAt:new Date(endMs).toISOString(),events,catches:{},npcPlanEventIds,revision:1,serverNow:nowIso(),message:"Watch the water. One catch each; largest fish wins."};
}
function fishingNormalizeClaims(game){
  if(!game||game.mode!=="fishing") return game;
  const original=game.fishingState||{};
  const events=(original.events||[]).map(e=>({...e,claimedBy:"",claimedAt:null}));
  const eventById=new Map(events.map((e,i)=>[String(e.id),{event:e,index:i}]));
  const allowed=new Set([cleanUserId(game.creator?.userId),cleanUserId(game.joiner?.userId)].filter(Boolean));
  const candidates=[];
  const addCandidate=(userId,catchData,claimedAtFallback)=>{
    const uid=cleanUserId(userId);
    if(!allowed.has(uid)||!catchData) return;
    const eventId=String(catchData.eventId||"");
    const info=eventById.get(eventId);
    if(!info) return;
    const at=String(catchData.at||catchData.claimedAt||claimedAtFallback||info.event.claimedAt||"");
    const atMs=Date.parse(at||"");
    candidates.push({uid,eventId,at:Number.isFinite(atMs)?atMs:Number.MAX_SAFE_INTEGER,atText:at||nowIso(),index:info.index});
  };
  for(const [uid,c] of Object.entries(original.catches||{})) addCandidate(uid,c,c?.at);
  for(const e of original.events||[]) if(e?.claimedBy) addCandidate(e.claimedBy,{eventId:e.id,at:e.claimedAt},e.claimedAt);
  candidates.sort((a,b)=>a.at-b.at||a.index-b.index||a.uid.localeCompare(b.uid));
  const usedUsers=new Set(), usedEvents=new Set(), catches={};
  for(const c of candidates){
    if(usedUsers.has(c.uid)||usedEvents.has(c.eventId)) continue;
    const info=eventById.get(c.eventId); if(!info) continue;
    const e=info.event;
    usedUsers.add(c.uid); usedEvents.add(c.eventId);
    e.claimedBy=c.uid; e.claimedAt=c.atText;
    catches[c.uid]={eventId:e.id,size:e.size,measuredSize:Number(e.size),name:e.name,at:c.atText,ripple:e.ripple,rumble:e.rumble};
  }
  const changed=JSON.stringify(original.catches||{})!==JSON.stringify(catches)||JSON.stringify((original.events||[]).map(e=>({id:e.id,claimedBy:e.claimedBy||"",claimedAt:e.claimedAt||null})))!==JSON.stringify(events.map(e=>({id:e.id,claimedBy:e.claimedBy||"",claimedAt:e.claimedAt||null})));
  return {...game,fishingState:{...original,events,catches,npcPlanEventIds:Array.isArray(original.npcPlanEventIds)&&original.npcPlanEventIds.length?original.npcPlanEventIds:events.map(e=>e.id),revision:int(original.revision,0)+(changed?1:0),serverNow:nowIso()},updatedAt:changed?nowIso():game.updatedAt};
}

function fishingHasValidTimeline(state={}){
  const a=Date.parse(state.startAt||""), b=Date.parse(state.endAt||"");
  if(!Number.isFinite(a)||!Number.isFinite(b)||b-a!==60000||!Array.isArray(state.events)||state.events.length<7) return false;
  let lastEnd=a;
  for(const e of state.events){ const x=Date.parse(e.at||""), y=Date.parse(e.endAt||""); if(!Number.isFinite(x)||!Number.isFinite(y)||x<lastEnd||y<=x) return false; lastEnd=y; }
  return true;
}
function fishingEnsureState(game){
  if(!game||game.mode!=="fishing"||game.status!=="playing") return game;
  const anchorMs = Number.isFinite(Date.parse(game.startAt || "")) ? Date.parse(game.startAt) : Date.now();
  const ensured=fishingHasValidTimeline(game.fishingState||{})?game:{...game,fishingState:fishingInitialState(game, anchorMs),updatedAt:nowIso()};
  return fishingNormalizeClaims(ensured);
}
function fishingDatabasePlayerIds(game){ return [cleanUserId(game?.creator?.userId),cleanUserId(game?.joiner?.userId)].filter(Boolean); }
async function fishingDatabaseState(game,options={}){
  const ensured=fishingEnsureState(game);
  const initialState=ensured.fishingState||fishingInitialState(game,Date.parse(game.startAt||"")||Date.now());
  const npcId=(game?.joiner?.isNpc||String(game?.joiner?.userId||"").startsWith("npc-"))?cleanUserId(game.joiner.userId):"";
  if(options.runNpc&&npcId&&game.status==="playing") return await fishingDatabase.npcAttempt({gameId:game.gameId,initialState,npcId});
  return await fishingDatabase.getMatch({gameId:game.gameId,initialState});
}
async function fishingMaybeCompleteDatabase(game){
  if(!game||game.mode!=="fishing"||game.status!=="playing") return game;
  const state=game.fishingState||{};
  const creator=cleanUserId(game.creator?.userId),joiner=cleanUserId(game.joiner?.userId);
  const both=Boolean(state.catches?.[creator]&&state.catches?.[joiner]);
  if(!both&&Date.now()<Date.parse(state.endAt||"")) return game;
  return await duelCompleteWithResolved(game,fishingResolved(game));
}
function fishingPublicState(game,viewer){
  const state=game.fishingState||{};
  const serverEpochMs=Date.now();
  const startEpochMs=Date.parse(state.startAt||"");
  const endEpochMs=Date.parse(state.endAt||"");
  const remainingMs=game.status==="playing"&&Number.isFinite(endEpochMs)?Math.max(0,endEpochMs-serverEpochMs):0;
  return {...state,
    roundId:String(state.roundId||`${game.gameId}:${state.startAt||""}`),
    serverNow:new Date(serverEpochMs).toISOString(),serverEpochMs,
    startEpochMs:Number.isFinite(startEpochMs)?startEpochMs:0,
    endEpochMs:Number.isFinite(endEpochMs)?endEpochMs:0,
    remainingMs,
    events:(state.events||[]).map(e=>({id:e.id,at:e.at,endAt:e.endAt,atMs:Date.parse(e.at||"")||0,endAtMs:Date.parse(e.endAt||"")||0,ripple:e.ripple,rumble:e.rumble,claimedBy:e.claimedBy||"",claimedAt:e.claimedAt||null,size:e.claimedBy?e.size:undefined,name:e.claimedBy?e.name:undefined})),
    myCatch:state.catches?.[viewer]||null,creatorCatch:state.catches?.[game.creator?.userId]||null,joinerCatch:state.catches?.[game.joiner?.userId]||null,
    secondsLeft:Math.max(0,Math.ceil(remainingMs/1000))};
}
function fishingResolved(game){
  const s=game.fishingState||{}, c=s.catches?.[game.creator?.userId]||null, j=s.catches?.[game.joiner?.userId]||null;
  if(!c&&!j) return {mode:"fishing",creator:{catch:null},joiner:{catch:null},tie:true,text:"Neither player caught a fish."};
  if(c&&!j) return {mode:"fishing",creator:{catch:c,size:c.size,name:c.name},joiner:{catch:null,size:0},winnerRole:"creator",tie:false,text:"The joiner did not catch a fish."};
  if(j&&!c) return {mode:"fishing",creator:{catch:null,size:0},joiner:{catch:j,size:j.size,name:j.name},winnerRole:"joiner",tie:false,text:"The creator did not catch a fish."};
  const creatorSize=Number(c.measuredSize??c.size??0);
  const joinerSize=Number(j.measuredSize??j.size??0);
  if(Math.abs(creatorSize-joinerSize)<0.000001) return {mode:"fishing",creator:{catch:c,size:creatorSize,name:c.name},joiner:{catch:j,size:joinerSize,name:j.name},tie:true,text:"Both fish have the exact same measured length."};
  return {mode:"fishing",creator:{catch:c,size:creatorSize,name:c.name},joiner:{catch:j,size:joinerSize,name:j.name},winnerRole:creatorSize>joinerSize?"creator":"joiner",tie:false,text:"The larger measured fish wins."};
}
async function fishingMaybeComplete(game){
  if(game.mode!=="fishing"||game.status!=="playing") return game;
  game=fishingNormalizeClaims(fishingEnsureState(game)); const s=game.fishingState||{};
  const both=Boolean(s.catches?.[game.creator?.userId]&&s.catches?.[game.joiner?.userId]);
  if(!both&&Date.now()<Date.parse(s.endAt||0)) return game;
  return await duelCompleteWithResolved(game,fishingResolved(game));
}
async function fishingTap(user,gameId,eventId,clickedAt){
  return await withFishingGameLock(gameId,async()=>{
    let game=await duelGetRaw(gameId); if(!game||game.mode!=="fishing") throw new Error("Fishing duel not found.");
    game=fishingNormalizeClaims(fishingEnsureState(game)); const viewer=cleanUserId(user.id);
    if(game.status!=="playing") throw new Error("This fishing round is over.");
    if(viewer!==game.creator?.userId&&viewer!==game.joiner?.userId) throw new Error("You are not in this duel.");
    if(game.fishingState?.catches?.[viewer]) throw new Error("You already pulled your one fish.");
    const s={...(game.fishingState||{}),catches:{...(game.fishingState?.catches||{})},events:(game.fishingState?.events||[]).map(e=>({...e}))};
    if(s.catches[viewer]) throw new Error("You already pulled your one fish.");
    const idx=s.events.findIndex(e=>e.id===eventId); if(idx<0) throw new Error("That ripple is gone.");
    const e=s.events[idx], now=Date.now();
    const begin=Date.parse(e.at), finish=Date.parse(e.endAt);
    const reported=Number(clickedAt);
    const saneReported=Number.isFinite(reported)&&Math.abs(reported-now)<=5000?reported:now;
    // The ripple remains catchable for its full visible lifetime. Allow a small
    // network allowance so a tap made at the edge is not rejected in transit.
    const graceMs=1800;
    if(now<begin-graceMs||now>finish+graceMs||saneReported<begin-graceMs||saneReported>finish+graceMs) throw new Error("That fish is no longer biting.");
    if(e.claimedBy) throw new Error("Your opponent hooked that fish first.");
    e.claimedBy=viewer; e.claimedAt=new Date(Math.min(now,Math.max(begin,saneReported))).toISOString();
    s.catches[viewer]={eventId:e.id,size:e.size,measuredSize:Number(e.size),name:e.name,at:e.claimedAt,ripple:e.ripple,rumble:e.rumble};
    s.revision=int(s.revision,0)+1; s.serverNow=nowIso();
    let candidate=fishingNormalizeClaims({...game,fishingState:s});
    // A stale or simultaneous request may have attempted to claim an already-used
    // event. Normalization is authoritative: one player, one catch; one event, one owner.
    if(!candidate.fishingState?.catches?.[viewer]) throw new Error("Your opponent hooked that fish first.");
    candidate=await duelSaveGame(candidate);

    // Netlify may execute two taps on different function instances, so the in-memory
    // lock above is not enough by itself. Give concurrent writes a brief chance to land,
    // then merge every observed claim and normalize them into one authoritative owner.
    await new Promise(resolve=>setTimeout(resolve,140));
    const observed=await duelGetRaw(gameId);
    if(observed&&observed.mode==="fishing"){
      const mergedState={
        ...(observed.fishingState||candidate.fishingState||{}),
        events:(observed.fishingState?.events||candidate.fishingState?.events||[]).map(e=>({...e})),
        catches:{...(observed.fishingState?.catches||{}),...(candidate.fishingState?.catches||{})},
        revision:Math.max(int(observed.fishingState?.revision,0),int(candidate.fishingState?.revision,0))+1,
        serverNow:nowIso()
      };
      // Preserve event-side claims from both snapshots so normalization can choose
      // the earliest claimant even when one whole-game write temporarily replaced another.
      const byId=new Map(mergedState.events.map(e=>[String(e.id),e]));
      for(const source of [candidate.fishingState?.events||[],observed.fishingState?.events||[]]){
        for(const e of source){
          if(!e?.claimedBy) continue;
          const target=byId.get(String(e.id)); if(!target) continue;
          if(!target.claimedBy||Date.parse(e.claimedAt||"")<Date.parse(target.claimedAt||"")){
            target.claimedBy=e.claimedBy; target.claimedAt=e.claimedAt;
          }
        }
      }
      candidate=fishingNormalizeClaims({...observed,fishingState:mergedState});
      candidate=await duelSaveGame(candidate);
    }

    // Re-read once more after reconciliation. Only the player who still owns this
    // exact event receives a catch; the losing concurrent request is rejected.
    await new Promise(resolve=>setTimeout(resolve,60));
    const confirmedRaw=await duelGetRaw(gameId);
    if(confirmedRaw&&confirmedRaw.mode==="fishing") candidate=fishingNormalizeClaims(confirmedRaw);
    const confirmedCatch=candidate.fishingState?.catches?.[viewer]||null;
    if(!confirmedCatch||String(confirmedCatch.eventId)!==String(eventId)) throw new Error("Your opponent hooked that fish first.");
    const eventOwner=(candidate.fishingState?.events||[]).find(x=>String(x.id)===String(eventId))?.claimedBy||"";
    if(cleanUserId(eventOwner)!==viewer) throw new Error("Your opponent hooked that fish first.");

    const cs=candidate.fishingState?.catches||{};
    const bothNow=Boolean(cs[game.creator?.userId]&&cs[game.joiner?.userId]);
    game=bothNow?await duelCompleteWithResolved(candidate,fishingResolved(candidate)):await fishingMaybeComplete(candidate);
    return {game:duelPublicGame(game,viewer),record:await getUserRecord(viewer),catch:confirmedCatch};
  });
}
function fishingAutoNpc(game){
  if(game.mode!=="fishing"||game.status!=="playing"||!game.joiner?.isNpc) return game;
  game=fishingNormalizeClaims(game);
  const base=game.fishingState||{};
  const npc=cleanUserId(game.joiner.userId);
  if(base.catches?.[npc]) return game;
  const s={...base,catches:{...(base.catches||{})},events:(base.events||[]).map(e=>({...e}))};
  const now=Date.now();

  // Pick exactly one ripple and one catch instant for the entire round. Persisting
  // this plan prevents repeated polls or multiple function instances from rerolling it.
  if(!s.npcCatchEventId || !s.npcCatchAt){
    const candidates=s.events.filter(e=>{
      const begin=Date.parse(e.at||""), finish=Date.parse(e.endAt||"");
      return !e.claimedBy && Number.isFinite(begin) && Number.isFinite(finish) && finish>begin;
    });
    if(!candidates.length) return game;
    const target=candidates[Math.floor(Math.random()*candidates.length)];
    const begin=Date.parse(target.at), finish=Date.parse(target.endAt);
    const earliest=begin+Math.max(120,Math.floor((finish-begin)*0.30));
    const latest=begin+Math.max(160,Math.floor((finish-begin)*0.72));
    const catchAt=earliest+Math.floor(Math.random()*Math.max(1,latest-earliest));
    s.npcCatchEventId=target.id;
    s.npcCatchAt=new Date(catchAt).toISOString();
    s.revision=int(s.revision,0)+1;
    s.serverNow=nowIso();
    return fishingNormalizeClaims({...game,fishingState:s,updatedAt:nowIso()});
  }

  const target=s.events.find(e=>String(e.id)===String(s.npcCatchEventId));
  const catchAt=Date.parse(s.npcCatchAt||"");
  if(!target || target.claimedBy || !Number.isFinite(catchAt)) return game;
  const begin=Date.parse(target.at||""), finish=Date.parse(target.endAt||"");
  if(now<catchAt || now<begin || now>finish) return game;

  target.claimedBy=npc;
  target.claimedAt=nowIso();
  s.catches[npc]={eventId:target.id,size:target.size,measuredSize:Number(target.size),name:target.name,at:target.claimedAt,ripple:target.ripple,rumble:target.rumble};
  s.npcCaught=true;
  s.revision=int(s.revision,0)+1;
  s.serverNow=nowIso();
  return fishingNormalizeClaims({...game,fishingState:s,updatedAt:nowIso()});
}


// Fishing V3 invariants: canonical player keys, one catch per player, one owner per ripple.
function fishingV3PlayerId(value){ return cleanUserId(value); }
function fishingV3Normalize(game){
  if(!game || game.mode!=="fishing") return game;
  const original=game.fishingState||{};
  const creatorId=fishingV3PlayerId(game.creator?.userId);
  const joinerId=fishingV3PlayerId(game.joiner?.userId);
  const allowed=new Set([creatorId,joinerId].filter(Boolean));
  const events=(original.events||[]).map(e=>({...e,claimedBy:"",claimedAt:null}));
  const byId=new Map(events.map((e,i)=>[String(e.id),{e,i}]));
  const candidates=[];
  const add=(uid0,c)=>{
    const uid=fishingV3PlayerId(uid0);
    if(!uid||!allowed.has(uid)||!c)return;
    const id=String(c.eventId||c.id||""); const hit=byId.get(id); if(!hit)return;
    const t=Date.parse(c.at||c.claimedAt||"");
    candidates.push({uid,id,t:Number.isFinite(t)?t:Number.MAX_SAFE_INTEGER,text:c.at||c.claimedAt||nowIso(),i:hit.i});
  };
  for(const [uid,c] of Object.entries(original.catches||{}))add(uid,c);
  for(const e of original.events||[])if(e?.claimedBy)add(e.claimedBy,{eventId:e.id,at:e.claimedAt});
  candidates.sort((a,b)=>a.t-b.t||a.i-b.i||a.uid.localeCompare(b.uid));
  const usedUsers=new Set(),usedEvents=new Set(),catches={};
  for(const c of candidates){
    if(usedUsers.has(c.uid)||usedEvents.has(c.id))continue;
    const hit=byId.get(c.id); if(!hit)continue;
    usedUsers.add(c.uid);usedEvents.add(c.id);
    hit.e.claimedBy=c.uid;hit.e.claimedAt=c.text;
    catches[c.uid]={eventId:hit.e.id,size:Number(hit.e.size),measuredSize:Number(hit.e.size),name:hit.e.name,at:c.text,ripple:hit.e.ripple,rumble:hit.e.rumble};
  }
  return {...game,fishingState:{...original,events,catches,revision:int(original.revision,0)+1,serverNow:nowIso()}};
}
fishingNormalizeClaims = fishingV3Normalize;

const fishingTapLegacyV3 = fishingTap;
fishingTap = async function(user,gameId,eventId,clickedAt,actionIdRaw=""){
  const viewer=fishingV3PlayerId(user?.id);
  let game=await duelGetRaw(gameId);
  if(!game||game.mode!=="fishing") throw new Error("Fishing duel not found.");
  if(game.status!=="playing") throw new Error("This fishing round is over.");
  const players=fishingDatabasePlayerIds(game);
  if(!players.includes(viewer)) throw new Error("You are not in this fishing duel.");
  const ensured=fishingEnsureState(game);
  const initialState=ensured.fishingState;
  const actionId=String(actionIdRaw||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,90)||`fish-${viewer}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const claimed=await fishingDatabase.claimRipple({gameId,initialState,userId:viewer,eventId,actionId,clickedAt});
  game={...game,fishingState:claimed.state};
  game=await fishingMaybeCompleteDatabase(game);
  return {game:duelPublicGame(game,viewer),record:await getUserRecord(viewer),catch:claimed.catch||claimed.state?.catches?.[viewer]||null,duplicate:Boolean(claimed.duplicate)};
};

const fishingAutoNpcLegacyV3 = fishingAutoNpc;
fishingAutoNpc = function(game){
  game=fishingV3Normalize(game);
  const npc=fishingV3PlayerId(game?.joiner?.userId);
  if(!game||game.mode!=="fishing"||!game.joiner?.isNpc||game.fishingState?.catches?.[npc]) return game;
  return fishingV3Normalize(fishingAutoNpcLegacyV3(game));
};

async function duelCompleteRealtimeDraw(gameId, scores = {}, sequence = 0, ledger = []) {
  return await withDrawGameLock(gameId, async () => {
    let game = await duelGetRaw(gameId);
    if (!game) throw new Error("That DRAW duel was not found.");
    if (game.mode !== "draw") throw new Error("That is not a DRAW duel.");
    if (game.status === "complete") return game;
    const creatorId = cleanUserId(game.creator?.userId);
    const joinerId = cleanUserId(game.joiner?.userId);
    const creatorScore = Number.isFinite(Number(scores?.[creatorId])) ? Math.trunc(Number(scores[creatorId])) : 0;
    const joinerScore = Number.isFinite(Number(scores?.[joinerId])) ? Math.trunc(Number(scores[joinerId])) : 0;
    const resolved = creatorScore === joinerScore
      ? { mode: "draw", creator: { score: creatorScore }, joiner: { score: joinerScore }, scores: { [creatorId]: creatorScore, [joinerId]: joinerScore }, tie: true, text: `DRAW! tied ${creatorScore}-${joinerScore}.` }
      : { mode: "draw", creator: { score: creatorScore }, joiner: { score: joinerScore }, scores: { [creatorId]: creatorScore, [joinerId]: joinerScore }, winnerRole: creatorScore > joinerScore ? "creator" : "joiner", tie: false, text: `DRAW! final score ${creatorScore}-${joinerScore}.` };
    game = { ...game, drawState: { ...(game.drawState || {}), scores: resolved.scores, revision: Math.max(int(sequence, 0), int(game.drawState?.revision, 0)), actionLedger: Array.isArray(ledger) ? ledger.slice(-500) : [], realtimeAuthoritative: true } };
    return await duelCompleteWithResolved(game, resolved);
  });
}


module.exports = {
  initBlobs,
  getUserRecord,
  saveUserRecord,
  listUserRecords,
  recordConnect,
  recordCheck,
  recordBet,
  issueTicket,
  completeTicket,
  recordAdminAdjustment,
  recordWithdrawal,
  recoverPreviousWithdrawal,
  getRecordBalance,
  getOddsSettings,
  saveOddsSettings,
  setDefaultOddsProfile,
  setUserOddsProfile,
  clearUserOddsProfile,
  setGameOddsSettings,
  getGameOddsSettings,
  getResolvedOddsForUser,
  publicOddsSettings,
  sanitizeOddsProfile,
  resolveSiteUser,
  TICKETS_PER_XAN,
  ticketsFromXans,
  formatTickets,
  FIRST_TICKET_ODDS_PROFILE,
  FIRST_DOUBLE_LOSS_ODDS_PROFILE,
  ODDS_PRESETS,
  DEFAULT_GAME_ODDS,
  runnerGetGame,
  runnerStartGame,
  runnerChooseDirection,
  runnerCashOut,
  horseGetCard,
  horseStartRace,
  arcadePlayGame,
  duelListGames,
  duelGetGame,
  duelCreateGame,
  duelCancelGame,
  duelAbandonNpcGame,
  duelJoinGame,
  duelAddSimpleNpc,
  duelAddRemoteNetworkBot,
  duelCreateRemoteNetworkBotGame,
  duelActionGame,
  duelReadyGame,
  duelCompleteRealtimeDraw,
  duelCleanupLegacyGames,
  duelAdminCancelAllGames,
  multiplayerListGames,
  multiplayerGetGame,
  multiplayerCreateGame,
  multiplayerCancelGame,
  multiplayerJoinGame,
  multiplayerAddNpc,
  multiplayerChooseCoin,
  multiplayerChooseTurn,
  multiplayerPickSlot,
  multiplayerNpcPick,
  multiplayerAdminCancelAllGames,
  basketballListGames,
  basketballGetGame,
  basketballCreateGame,
  basketballCancelGame,
  basketballJoinGame,
  basketballAddNpc,
  basketballReady,
  basketballShot,
  basketballFinish
};
