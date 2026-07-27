const { initBlobs, getUserRecord, recordConnect, recordCheck, resolveSiteUser, ticketsFromXans } = require("./_data");

const OWNER_ID = 4300885;
const OWNER_NAME = "CowBoyCookie";
const OWNER_KEY_FALLBACK = "GqB35OisohYJpsKr";
const XANAX_ITEM_ID = 206;
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

  const ownerKey = process.env.TORN_OWNER_API_KEY || OWNER_KEY_FALLBACK;
  if (!ownerKey) {
    return json(headers, 500, { ok: false, error: "Missing owner API key. Add TORN_OWNER_API_KEY in Netlify." });
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return json(headers, 400, { ok: false, error: "Invalid JSON body." }); }

  const visitorKey = String(body.visitorKey || "").trim();
  if (!/^[A-Za-z0-9]{8,64}$/.test(visitorKey)) {
    return json(headers, 400, { ok: false, error: "Invalid Torn API key format." });
  }

  const now = Math.floor(Date.now() / 1000);
  const sinceRaw = Number(body.since || 0);
  const since = clampUnix(sinceRaw || now - 30 * 86400, now - 30 * 86400, now);
  const clientKnownLogIds = new Set(Array.isArray(body.knownLogIds) ? body.knownLogIds.map(String) : []);

  try {
    const visitorProfile = await tornFetch(`/user/?selections=profile&key=${encodeURIComponent(visitorKey)}&comment=xans-check`);
    const visitor = extractUser(visitorProfile);

    if (!visitor.id) {
      return json(headers, 400, { ok: false, error: "Could not verify the visitor's Torn user ID from that API key." });
    }

    console.log(`[check-xans] Verified check from ${visitor.name} [${visitor.id}]`);

    const siteUser = await resolveSiteUser(visitor, body.visitorId);

    // Make sure anyone who checked is also recorded as connected, even if they skipped Save Key.
    const beforeRecord = await getUserRecord(siteUser.id);
    if (!beforeRecord) await recordConnect(siteUser, "check-xans-first-seen");
    const currentRecord = (await getUserRecord(siteUser.id)) || {};
    const serverKnownLogIds = new Set(Array.isArray(currentRecord.claimedLogIds) ? currentRecord.claimedLogIds.map(String) : []);
    const knownLogIds = new Set([...clientKnownLogIds, ...serverKnownLogIds]);

    // The Torn item-receive log currently uses log 4103 and stores items like:
    // data.items = { "206": [quantity, 0] } for Xanax.
    // Use the broad user log endpoint, then parse that structured payload.
    const logData = await tornFetch(`/user/?selections=log&from=${since}&to=${now}&timestamp=${Date.now()}&key=${encodeURIComponent(ownerKey)}&comment=xans`);

    const logEntries = normalizeLogs(logData);
    const enrichedEntries = logEntries.map((entry) => {
      const amount = extractXanaxAmount(entry);
      const senderMatch = matchesSender(entry, visitor.id);
      const incomingXanax = looksLikeIncomingXanax(entry);
      const strictIncomingForOwner = isStrictIncomingXanaxForOwner(entry, visitor.id);
      return {
        ...entry,
        amount,
        senderMatch,
        incomingXanax,
        strictIncomingForOwner
      };
    });

    // Only credit logs where CowBoyCookie received Xanax from this exact player.
    // Do not credit logs where CowBoyCookie sent Xanax out to anyone else.
    const matches = enrichedEntries.filter((entry) => entry.strictIncomingForOwner);

    const newMatches = matches.filter((entry) => !knownLogIds.has(String(entry.id)));
    const addedXans = newMatches.reduce((sum, entry) => sum + entry.amount, 0);
    const addedTickets = ticketsFromXans(addedXans);
    const newLogIds = newMatches.map((entry) => String(entry.id));

    const debug = {
      logsScanned: logEntries.length,
      itemReceiveLogs: enrichedEntries.filter((entry) => isIncomingItemReceiveLog(entry)).length,
      xanaxReceiveLogs: enrichedEntries.filter((entry) => entry.incomingXanax && entry.amount > 0).length,
      strictIncomingOwnerXanaxLogs: matches.length,
      outgoingXanaxLogsIgnored: enrichedEntries.filter((entry) => isOutgoingItemSendLog(entry) && entry.amount > 0).length,
      senderMatchedXanaxLogs: matches.length,
      knownLogIds: knownLogIds.size,
      checkedDays: Math.round((now - since) / 86400),
      sampleItemReceiveLogs: enrichedEntries
        .filter((entry) => isIncomingItemReceiveLog(entry))
        .slice(0, 5)
        .map((entry) => ({
          id: String(entry.id),
          log: entry.raw?.log || entry.logType || null,
          title: entry.raw?.title || null,
          timestamp: entry.timestamp || null,
          sender: entry.raw?.data?.sender || entry.data?.sender || null,
          recipient: entry.raw?.data?.receiver || entry.raw?.data?.recipient || entry.raw?.data?.target || entry.data?.receiver || entry.data?.recipient || entry.data?.target || null,
          xanaxAmount: extractXanaxAmount(entry),
          credited: entry.strictIncomingForOwner,
          itemKeys: getItemKeys(entry).slice(0, 8)
        }))
    };

    const updatedRecord = await recordCheck(siteUser, {
      addedXans,
      newLogIds,
      checkedFrom: since,
      checkedAt: now,
      lastWithdrawal: body.lastWithdrawal
    });

    console.log(`[check-xans] ${visitor.name} [${visitor.id}] addedXans=${addedXans} newLogs=${newLogIds.length} totalXans=${updatedRecord.totalXansDetected} logsScanned=${debug.logsScanned} xanaxReceiveLogs=${debug.xanaxReceiveLogs} senderMatchedXanaxLogs=${debug.senderMatchedXanaxLogs}`);

    return json(headers, 200, {
      ok: true,
      owner: { id: OWNER_ID, name: OWNER_NAME },
      user: visitor,
      checkedFrom: since,
      checkedAt: now,
      addedXans,
      addedTickets,
      serverTotalXans: updatedRecord.totalXansDetected,
      serverTotalTickets: updatedRecord.totalTicketsDeposited || 0,
      ticketsPerXan: 1000,
      serverBalance: updatedRecord.currentBalance,
      serverClaimedLogCount: updatedRecord.claimedLogIds.length,
      siteUserId: updatedRecord.userId,
      totalMatchingXans: matches.reduce((sum, entry) => sum + entry.amount, 0),
      newLogIds,
      matchedEvents: newMatches.slice(0, 10).map((entry) => ({
        id: String(entry.id),
        timestamp: entry.timestamp || null,
        amount: entry.amount
      })),
      debug
    });
  } catch (error) {
    console.error("[check-xans] Error:", error.message || error);
    return json(headers, 500, { ok: false, error: error.message || "Torn API check failed." });
  }
};

function json(headers, statusCode, payload) {
  return { statusCode, headers, body: JSON.stringify(payload) };
}

function clampUnix(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, Math.floor(number)));
}

async function tornFetch(path) {
  const response = await fetch(`${TORN_API_BASE}${path}`, { headers: { "User-Agent": "CowBoyCookie-Xan-Scratch/1.4" } });
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

function normalizeLogs(data) {
  const source = data.log || data.logs || data.userlog || data.userlogs || data.events || data.data || [];
  if (Array.isArray(source)) return source.map((entry, index) => normalizeLogEntry(entry, entry.id || entry.log_id || index));
  if (source && typeof source === "object") return Object.entries(source).map(([id, entry]) => normalizeLogEntry(entry, id));

  const nested = [];
  walk(data, (value, key) => {
    if (key && /log/i.test(String(key)) && value && typeof value === "object") {
      if (Array.isArray(value)) value.forEach((entry, index) => nested.push(normalizeLogEntry(entry, entry.id || entry.log_id || index)));
      else Object.entries(value).forEach(([id, entry]) => nested.push(normalizeLogEntry(entry, id)));
    }
  });
  return nested;
}

function normalizeLogEntry(entry, id) {
  if (typeof entry === "string") return { id, text: entry, raw: entry };
  const safe = entry && typeof entry === "object" ? entry : {};
  return {
    id: safe.id || safe.log_id || safe.logID || id,
    timestamp: safe.timestamp || safe.time || safe.created_at || null,
    logType: safe.log || safe.type || safe.category || safe.title || null,
    text: safe.event || safe.message || safe.text || safe.description || safe.log_text || "",
    data: safe.data || safe.params || safe.details || {},
    raw: safe
  };
}


function isStrictIncomingXanaxForOwner(entry, visitorId) {
  const amount = getItemQuantity(entry, XANAX_ITEM_ID);
  if (amount <= 0) return false;

  // Only owner-side receive logs count. Outgoing send/trade logs must never
  // credit anyone, even if they mention the other player's ID.
  if (!isIncomingItemReceiveLog(entry)) return false;
  if (isOutgoingItemSendLog(entry)) return false;

  // Torn item receive logs store the sender in data.sender. Require that exact
  // sender to be the visitor whose API key is checking the deposit.
  if (!hasExactSenderId(entry, visitorId)) return false;

  // If a log variant includes a receiver/recipient/target field, it must be the
  // owner. This rejects owner-sent returns and other unrelated item movement.
  if (hasConflictingReceiver(entry, OWNER_ID)) return false;

  return true;
}

function hasExactSenderId(entry, userId) {
  const id = Number(userId);
  const senderIds = getNumericValuesForKeys(entry.raw, [
    "sender", "sender_id", "senderID", "senderId",
    "from", "from_id", "fromID", "fromId"
  ]);
  return senderIds.includes(id);
}

function hasConflictingReceiver(entry, ownerId) {
  const receiverIds = getNumericValuesForKeys(entry.raw, [
    "receiver", "receiver_id", "receiverID", "receiverId",
    "recipient", "recipient_id", "recipientID", "recipientId",
    "target", "target_id", "targetID", "targetId",
    "to", "to_id", "toID", "toId"
  ]);
  if (!receiverIds.length) return false;
  return !receiverIds.includes(Number(ownerId));
}

function isOutgoingItemSendLog(entry) {
  const raw = entry.raw || {};
  const numericLog = Number(raw.log || entry.logType);
  const haystack = flattenText(entry).toLowerCase();
  return (
    numericLog === 4102 ||
    numericLog === 4445 ||
    numericLog === 6732 ||
    numericLog === 6745 ||
    numericLog === 6748 ||
    haystack.includes("title:item send") ||
    haystack.includes("title:item sent") ||
    haystack.includes("trade items outgoing") ||
    haystack.includes("faction give item send") ||
    haystack.includes("faction loan item send") ||
    haystack.includes("faction loan item retrieve send")
  );
}

function looksLikeIncomingXanax(entry) {
  const amount = getItemQuantity(entry, XANAX_ITEM_ID);
  if (amount <= 0) return false;

  // Incoming item receive logs are usually log 4103 with title "Item receive"
  // and category "Item sending". Keep text fallbacks for old/current variants.
  if (isIncomingItemReceiveLog(entry)) return true;

  const haystack = flattenText(entry).toLowerCase();
  const receiveWords = ["item receive", "received", "receive", "given", "gifted"];
  return receiveWords.some((word) => haystack.includes(word)) && !isOutgoingItemSendLog(entry);
}

function isIncomingItemReceiveLog(entry) {
  const raw = entry.raw || {};
  const haystack = flattenText(entry).toLowerCase();
  return (
    Number(raw.log || entry.logType) === 4103 ||
    haystack.includes("title:item receive") ||
    haystack.includes("item receive") ||
    haystack.includes("category:item sending")
  );
}

function getItemContainers(entry) {
  const raw = entry.raw || {};
  const data = entry.data || {};
  const containers = [
    raw.items,
    raw.item,
    raw.data?.items,
    raw.data?.item,
    data.items,
    data.item,
    raw.params?.items,
    raw.details?.items
  ].filter(Boolean);
  return containers;
}

function getItemKeys(entry) {
  const keys = [];
  for (const container of getItemContainers(entry)) {
    if (container && typeof container === "object" && !Array.isArray(container)) {
      keys.push(...Object.keys(container));
    }
  }
  return [...new Set(keys)];
}

function getItemQuantity(entry, itemId) {
  const target = String(itemId);

  for (const container of getItemContainers(entry)) {
    if (!container) continue;

    // Current Torn item receive structure: data.items["206"] = [quantity, 0]
    if (typeof container === "object" && !Array.isArray(container) && Object.prototype.hasOwnProperty.call(container, target)) {
      const value = container[target];
      const qty = quantityFromItemValue(value);
      if (qty > 0) return qty;
    }

    // Some variants can be arrays of { id/item_id: 206, quantity/amount: n }
    if (Array.isArray(container)) {
      for (const item of container) {
        if (!item || typeof item !== "object") continue;
        const id = item.id ?? item.item_id ?? item.itemID ?? item.itemId ?? item.item;
        if (String(id) === target) {
          const qty = quantityFromItemValue(item);
          if (qty > 0) return qty;
        }
      }
    }
  }

  // Last structured fallback: direct item id + direct quantity fields.
  const directItemId = entry.raw?.item_id ?? entry.raw?.itemID ?? entry.raw?.itemId ?? entry.data?.item_id ?? entry.data?.itemID ?? entry.data?.itemId;
  if (String(directItemId) === target) {
    const qty = quantityFromItemValue(entry.raw) || quantityFromItemValue(entry.data);
    if (qty > 0) return qty;
  }

  return 0;
}

function quantityFromItemValue(value) {
  if (Array.isArray(value)) {
    const n = Number(value[0]);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }

  if (value && typeof value === "object") {
    const candidates = [
      value.quantity, value.qty, value.amount, value.count, value.total, value[0]
    ];
    for (const candidate of candidates) {
      const n = Number(candidate);
      if (Number.isFinite(n) && n > 0 && n <= 100000) return Math.floor(n);
    }
  }

  const n = Number(value);
  return Number.isFinite(n) && n > 0 && n <= 100000 ? Math.floor(n) : 0;
}

function matchesSender(entry, userId) {
  if (hasExactSenderId(entry, userId)) return true;

  // For structured item receive/send logs, never use loose text matching. The
  // other player can appear as a recipient in outgoing logs, which caused false credit.
  if (isIncomingItemReceiveLog(entry) || isOutgoingItemSendLog(entry)) return false;

  const id = Number(userId);
  const haystack = flattenText(entry);
  const bracketIds = [...haystack.matchAll(/\[(\d{1,10})\]/g)].map((m) => Number(m[1]));
  if (bracketIds.includes(id)) return true;
  return new RegExp(`\\b${id}\\b`).test(haystack);
}


function extractXanaxAmount(entry) {
  const structuredAmount = getItemQuantity(entry, XANAX_ITEM_ID);
  if (structuredAmount > 0) return structuredAmount;

  // Fallback for formatted text logs. Structured item receive logs should be handled above.
  const text = flattenText(entry).toLowerCase();
  const patterns = [
    /(\d{1,6})\s*x\s*xanax/,
    /(\d{1,6})\s*xanax/,
    /xanax\s*x?\s*(\d{1,6})/,
    /quantity["':\s]+(\d{1,6})/,
    /amount["':\s]+(\d{1,6})/
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const n = Number(match[1]);
      if (Number.isFinite(n) && n > 0) return Math.floor(n);
    }
  }

  return 0;
}

function flattenText(value) {
  const parts = [];
  walk(value, (v, k) => {
    if (typeof v === "string" || typeof v === "number") parts.push(k ? `${k}:${v}` : String(v));
  });
  return parts.join(" ");
}

function walk(value, visitor, key = "") {
  visitor(value, key);
  if (Array.isArray(value)) value.forEach((item, index) => walk(item, visitor, String(index)));
  else if (value && typeof value === "object") Object.entries(value).forEach(([childKey, child]) => walk(child, visitor, childKey));
}

function hasDataValue(entry, expected, keys) {
  let found = false;
  walk(entry.raw, (value, key) => {
    if (!found && keys.includes(key) && Number(value) === Number(expected)) found = true;
  });
  return found;
}

function getNumericValuesForKeys(value, keys) {
  const output = [];
  collectNumbersFromKeys(value, output, keys);
  return [...new Set(output.map((n) => Number(n)).filter((n) => Number.isFinite(n)))];
}

function collectNumbersFromKeys(value, output, keys) {
  walk(value, (v, key) => {
    if (keys.includes(key)) {
      const n = Number(v);
      if (Number.isFinite(n)) output.push(n);
    }
  });
}
