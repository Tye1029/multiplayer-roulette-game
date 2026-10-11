'use strict';
const database = require('./bluff/database');
const auth = require('./rps/database');
const model = require('../../shared/games/bluff-model');
function createHandler(store = database, identity = auth) {
  return async request => {
    const reply = (status, data) => new Response(JSON.stringify(data), { status, headers: {
      'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Bluff-Build': 'BLUFF_OR_BUST_V1'
    } });
    if (request.method !== 'POST') return reply(405, { error: 'Use POST.' });
    const raw = await request.text();
    if (raw.length > 8192) return reply(413, { error: 'Request too large.' });
    let b;
    try { b = JSON.parse(raw); if (!b || Array.isArray(b) || typeof b !== 'object') throw 0; }
    catch { return reply(400, { error: 'Invalid request.' }); }
    try {
      const player = await identity.authenticate(b.token);
      if (!player) return reply(401, { error: 'Connect your public Torn API key on the home page to play online. Practice needs no account.' });
      if (!['create', 'join', 'get', 'ready', 'play', 'decide', 'rematch', 'leave'].includes(b.action)) return reply(400, { error: 'Unknown action.' });
      if (b.action !== 'create' && !/^[A-F0-9]{12}$/.test(b.gameId || '')) return reply(400, { error: 'Invalid invitation code.' });
      const state = b.action === 'create' ? await store.create(player, b) : await store.action(b.gameId, player, b);
      return reply(200, { ok: true, game: model.publicState(state, player.id) });
    } catch (e) { return reply(e.status || 503, { error: e.status ? e.message : 'The table is temporarily unavailable. Retry to recover your game.' }); }
  };
}
exports.default = createHandler();
exports.createHandler = createHandler;
