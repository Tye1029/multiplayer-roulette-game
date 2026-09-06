const crypto = require("crypto");
const DUEL_FUNCTION_BUILD = "multiplayer_cohesion_v6";
const SUMMIT_INPUT_ROUTE_BUILD = "batch-v7";
const {
  initBlobs,
  resolveSiteUser,
  getUserRecord,
  getRecordBalance,
  duelListGames,
  duelGetGame,
  duelCreateGame,
  duelCancelGame,
  duelAbandonNpcGame,
  duelJoinGame,
  duelAddSimpleNpc,
  duelAddRemoteNetworkBot,
  duelCreateRemoteNetworkBotGame,
  duelActionGame
} = require("./_data");

const TORN_API_BASE = "https://api.torn.com";
const DUEL_PROFILE_CACHE = globalThis.__DUEL_PROFILE_CACHE || (globalThis.__DUEL_PROFILE_CACHE = new Map());
const DUEL_PROFILE_CACHE_MS = 2 * 60 * 1000;

exports.handler = async (event) => {
  initBlobs(event);
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "X-Duel-Function-Build": DUEL_FUNCTION_BUILD,
    "X-Safe-Cracker-Feedback": "fast-authoritative-v1",
    "X-Summit-Input-Route-Build": SUMMIT_INPUT_ROUTE_BUILD
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };
  if (event.httpMethod !== "POST") return json(headers, 405, { ok: false, error: "Use POST." });

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return json(headers, 400, { ok: false, error: "Invalid JSON body." }); }

  const visitorKey = String(body.visitorKey || "").trim();
  if (!/^[A-Za-z0-9]{8,64}$/.test(visitorKey)) {
    return json(headers, 400, { ok: false, error: "Save your Torn API key before playing Multiplayer Arcade." });
  }

  const action = String(body.action || "list").toLowerCase();

  try {
    let visitor = verifySessionToken(body.duelSessionToken);
    let refreshedSessionToken = "";
    if (!visitor) {
      let visitorProfile;
      const cachedProfile = DUEL_PROFILE_CACHE.get(visitorKey);
      if (cachedProfile && Date.now() - cachedProfile.at < DUEL_PROFILE_CACHE_MS) {
        visitorProfile = cachedProfile.profile;
      } else {
        visitorProfile = await tornFetch(`/user/?selections=profile&key=${encodeURIComponent(visitorKey)}&comment=xans-multiplayer-arcade`);
        DUEL_PROFILE_CACHE.set(visitorKey, { at: Date.now(), profile: visitorProfile });
        if (DUEL_PROFILE_CACHE.size > 80) {
          for (const [key, value] of DUEL_PROFILE_CACHE.entries()) {
            if (Date.now() - value.at > DUEL_PROFILE_CACHE_MS) DUEL_PROFILE_CACHE.delete(key);
          }
        }
      }
      visitor = extractUser(visitorProfile);
      if (!visitor.id) return json(headers, 400, { ok: false, error: "Could not verify the Torn user ID from that API key." });
      refreshedSessionToken = createSessionToken(visitor);
    }

    const siteUser = await resolveSiteUser(visitor, body.visitorId);
    const user = {
      id: siteUser.id,
      name: siteUser.tornName || siteUser.name || visitor.name || "Unknown",
      tornId: siteUser.tornId || visitor.id,
      avatarUrl: visitor.avatarUrl || null
    };

    let result;
    if (action === "list") result = await duelListGames(user);
    else if (action === "get") result = await duelGetGame(user, body.gameId, { asTestPlayer: Boolean(body.controlTestPlayer), knownRevision: body.knownRevision });
    else if (action === "create") result = await duelCreateGame(user, { mode: body.mode, wager: body.wager, lastWithdrawal: body.lastWithdrawal });
    else if (action === "cancel") result = await duelCancelGame(user, body.gameId);
    else if (action === "recover-npc") result = await duelAbandonNpcGame(user, body.gameId);
    else if (action === "join") result = await duelJoinGame(user, body.gameId);
    else if (action === "npc") result = await duelAddSimpleNpc(user, body.gameId);
    else if (action === "remote-bot") result = await duelAddRemoteNetworkBot(user, body.gameId, body.profile);
    else if (action === "create-remote-bot") result = await duelCreateRemoteNetworkBotGame(user, body);
    else if (action === "act") result = await duelActionGame(user, body.gameId, { choice: body.choice, hand: body.hand, clickedAt: body.clickedAt, actionId: body.actionId, chargeMs: body.chargeMs, flightId: body.flightId, visualOffsetMs: body.visualOffsetMs, estimatedOneWayMs: body.estimatedOneWayMs, expectedPhase: body.expectedPhase, expectedRevision: body.expectedRevision, expectedTurnId: body.expectedTurnId, expectedVisualKey: body.expectedVisualKey, expectedPromptIndex: body.expectedPromptIndex, expectedControl: body.expectedControl, inputBatch: body.inputBatch, asTestPlayer: Boolean(body.controlTestPlayer) });
    else return json(headers, 400, { ok: false, error: "Unknown Multiplayer Arcade action." });

    // Unchanged DRAW sync responses intentionally skip the balance lookup and
    // large game payload. This keeps active polling small and inexpensive.
    if (result?.unchanged || result?.databaseAuthoritative || result?.skipBalanceLookup) {
      return json(headers, 200, { ok: true, siteUserId: user.id, duelSessionToken: refreshedSessionToken || undefined, ...result });
    }
    const record = result.record || await getUserRecord(user.id);
    const serverBalance = getRecordBalance(record);
    return json(headers, 200, { ok: true, user: visitor, siteUserId: user.id, serverBalance, duelSessionToken: refreshedSessionToken || undefined, ...result });
  } catch (error) {
    console.error("[duel-action] Error:", error.message || error);
    return json(headers, 500, { ok: false, error: error.message || "Unable to update Multiplayer Arcade." });
  }
};

function sessionSecret() {
  return String(process.env.DUEL_SESSION_SECRET || process.env.ADMIN_PASSWORD || "").trim();
}
function base64url(value) {
  return Buffer.from(value).toString("base64url");
}
function createSessionToken(visitor) {
  const secret = sessionSecret();
  if (!secret || !visitor?.id) return "";
  const payload = base64url(JSON.stringify({
    id: String(visitor.id),
    name: String(visitor.name || "Unknown").slice(0, 80),
    avatarUrl: visitor.avatarUrl ? String(visitor.avatarUrl).slice(0, 500) : "",
    exp: Date.now() + 30 * 60 * 1000
  }));
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}
function verifySessionToken(token) {
  const secret = sessionSecret();
  const raw = String(token || "");
  if (!secret || !raw.includes(".")) return null;
  const [payload, signature] = raw.split(".");
  if (!payload || !signature) return null;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!parsed.id || Number(parsed.exp || 0) <= Date.now()) return null;
    return { id: String(parsed.id), name: String(parsed.name || "Unknown"), avatarUrl: parsed.avatarUrl || null };
  } catch { return null; }
}

function json(headers, statusCode, payload) {
  return { statusCode, headers, body: JSON.stringify(payload) };
}

async function tornFetch(path) {
  const response = await fetch(`${TORN_API_BASE}${path}`, {
    headers: { "User-Agent": "CowBoyCookie-Xan-Multiplayer-Arcade/1.0" }
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
  const name = profile.name || profile.profile?.name || profile.user?.name || "Unknown";
  const avatarUrl = profile.profile_image || profile.avatar || profile.profile?.profile_image || profile.user?.profile_image || null;
  return { id: id ? String(id) : "", name: String(name || "Unknown"), avatarUrl: avatarUrl ? String(avatarUrl) : null };
}
