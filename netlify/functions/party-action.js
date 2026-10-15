"use strict";
const database = require("./party/database");
function createHandler(store = database) {
  return async (request) => {
    const reply = (status, data, extra = {}) =>
      new Response(JSON.stringify(data), {
        status,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "X-Party-Build": "BOARDWALK_CARNIVAL_V7",
          ...extra,
        },
      });
    if (request.method !== "POST") return reply(405, { error: "Use POST." });
    const origin = request.headers.get("origin"),
      url = new URL(request.url);
    if (origin && origin !== url.origin)
      return reply(403, { error: "Open this party on its own website." });
    if (!request.headers.get("content-type")?.includes("application/json"))
      return reply(415, { error: "Use JSON." });
    const raw = await request.text();
    if (raw.length > 4096) return reply(413, { error: "Request too large." });
    let b;
    try {
      b = JSON.parse(raw);
      if (!b || typeof b !== "object" || Array.isArray(b)) throw 0;
    } catch {
      return reply(400, { error: "Invalid request." });
    }
    try {
      const cookie = request.headers.get("cookie") || "",
        token = cookie.match(
          /(?:^|;\s*)boardwalk_session=([a-f0-9]{64})(?:;|$)/,
        )?.[1],
        p = await store.authenticate(token);
      if (b.action === "register") {
        if (p)
          return reply(200, { ok: true, profile: await store.profile(p.id) });
        const ip = request.headers.get("x-nf-client-connection-ip") || "local",
          result = await store.register(b, ip);
        return reply(
          200,
          { ok: true, profile: result.profile },
          {
            "Set-Cookie": `boardwalk_session=${result.token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000${url.protocol === "https:" ? "; Secure" : ""}`,
          },
        );
      }
      if (!p)
        return reply(401, {
          error: "Create your guest profile to join the boardwalk.",
        });
      await store.limit("action:" + p.id, 600);
      if (b.action === "profile")
        return reply(200, { ok: true, profile: await store.profile(p.id) });
      if (["character", "purchase", "equip"].includes(b.action)) {
        await store.customize(p, b);
        return reply(200, { ok: true, profile: await store.profile(p.id) });
      }
      if (
        ![
          "create",
          "join",
          "get",
          "ready",
          "game-ready",
          "skip-bots",
          "start",
          "add-bot",
          "pick-character",
          "move",
          "roll",
          "choose",
          "continue",
          "challenge",
          "item",
          "buy-item",
          "buy-trophy",
          "ride-ferry",
          "accept-item",
          "play",
          "leave",
          "rematch",
        ].includes(b.action)
      )
        return reply(400, { error: "Unknown action." });
      if (
        !["get", "join"].includes(b.action) &&
        !/^[a-f0-9-]{36}$/i.test(b.requestId || "")
      )
        return reply(400, { error: "Missing action identifier." });
      if (b.action !== "create" && !/^[A-HJ-NP-Z2-9]{6}$/.test(b.room || ""))
        return reply(400, { error: "Enter the six-letter room code." });
      const game =
        b.action === "create"
          ? await store.create(p, b)
          : await store.action(p, b);
      return reply(200, { ok: true, game });
    } catch (e) {
      return reply(e.status || 503, {
        error: e.status
          ? e.message
          : "The boardwalk is reconnecting. Try again in a moment.",
      });
    }
  };
}
exports.default = createHandler();
exports.createHandler = createHandler;
