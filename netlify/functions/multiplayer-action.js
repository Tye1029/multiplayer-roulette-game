const {
  initBlobs,
  resolveSiteUser,
  getUserRecord,
  getRecordBalance,
  multiplayerListGames,
  multiplayerGetGame,
  multiplayerCreateGame,
  multiplayerCancelGame,
  multiplayerJoinGame,
  multiplayerAddNpc,
  multiplayerChooseCoin,
  multiplayerChooseTurn,
  multiplayerPickSlot,
  multiplayerNpcPick
} = require("./_data");

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
    return json(headers, 400, { ok: false, error: "Save your Torn API key before using multiplayer." });
  }

  const action = String(body.action || "list").toLowerCase();

  try {
    const visitorProfile = await tornFetch(`/user/?selections=profile&key=${encodeURIComponent(visitorKey)}&comment=xans-multiplayer`);
    const visitor = extractUser(visitorProfile);
    if (!visitor.id) return json(headers, 400, { ok: false, error: "Could not verify the Torn user ID from that API key." });

    const siteUser = await resolveSiteUser(visitor, body.visitorId);
    const user = {
      id: siteUser.id,
      name: siteUser.tornName || siteUser.name || visitor.name || "Unknown",
      tornId: siteUser.tornId || visitor.id,
      avatarUrl: visitor.avatarUrl || null
    };

    let result;
    if (action === "list") {
      result = { games: await multiplayerListGames(user.id) };
    } else if (action === "get") {
      result = { game: await multiplayerGetGame(body.gameId, user.id) };
    } else if (action === "create") {
      result = await multiplayerCreateGame(user, { wager: body.wager });
    } else if (action === "cancel") {
      result = await multiplayerCancelGame(user, body.gameId);
    } else if (action === "join") {
      result = await multiplayerJoinGame(user, body.gameId);
    } else if (action === "npc") {
      result = await multiplayerAddNpc(user, body.gameId);
    } else if (action === "coin") {
      result = await multiplayerChooseCoin(user, body.gameId, body.choice);
    } else if (action === "turn") {
      result = await multiplayerChooseTurn(user, body.gameId, body.orderChoice);
    } else if (action === "pick") {
      result = await multiplayerPickSlot(user, body.gameId, body.index);
    } else if (action === "npc-pick") {
      result = await multiplayerNpcPick(user, body.gameId);
    } else {
      return json(headers, 400, { ok: false, error: "Unknown multiplayer action." });
    }

    const record = result.record || await getUserRecord(user.id);
    const serverBalance = getRecordBalance(record);
    return json(headers, 200, {
      ok: true,
      user: visitor,
      siteUserId: user.id,
      serverBalance,
      ...result
    });
  } catch (error) {
    console.error("[multiplayer-action] Error:", error.message || error);
    return json(headers, 500, { ok: false, error: error.message || "Unable to update multiplayer game." });
  }
};

function json(headers, statusCode, payload) {
  return { statusCode, headers, body: JSON.stringify(payload) };
}

async function tornFetch(path) {
  const response = await fetch(`${TORN_API_BASE}${path}`, {
    headers: { "User-Agent": "CowBoyCookie-Xan-Scratch-Multiplayer/1.0" }
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
  const avatarUrl = profile.profile_image || profile.image || profile.avatar || profile.profile?.image || profile.profile?.profile_image || profile.user?.image || null;
  return { id: id ? Number(id) : null, name, avatarUrl };
}
