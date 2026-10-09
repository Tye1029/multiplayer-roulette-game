'use strict';
const db = require('./rps/database');
const rules = require('../../shared/games/rps-model');
const BUILD = 'HAND_OF_DOOM_V3_20261009';
function createHandler(database = db, request = fetch) {
  return async event => {
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-RPS-Build': BUILD };
    const reply = (statusCode, value) => ({ statusCode, headers, body: JSON.stringify({ build: BUILD, ...value }) });
    if (event.httpMethod !== 'POST') return reply(405, { error: 'Use POST.' });
    if ((event.body || '').length > 2048) return reply(413, { error: 'Request too large.' });
    let body;
    try { body = JSON.parse(event.body || '{}'); if (!body || Array.isArray(body) || typeof body !== 'object') throw 0; }
    catch { return reply(400, { error: 'Invalid JSON body.' }); }
    try {
      if (body.action === 'login') {
        if (typeof body.visitorKey !== 'string' || !/^[A-Za-z0-9]{8,64}$/.test(body.visitorKey))
          return reply(400, { error: 'Enter a valid Torn API key.' });
        const response = await request(`https://api.torn.com/user/?selections=profile&key=${encodeURIComponent(body.visitorKey)}&comment=hand-of-doom`, { signal: AbortSignal.timeout(8000) });
        if (!response.ok) return reply(502, { error: 'Torn is temporarily unavailable. Try again shortly.' });
        const result = await response.json(), profile = result.profile || result;
        const userId = String(profile.player_id || profile.id || '');
        if (result.error || !/^[1-9]\d*$/.test(userId)) return reply(401, { error: 'Torn could not verify this key.' });
        // Identity comes only from Torn; never trust submitted IDs, names or visitor aliases.
        const player = { id:userId, name:String(profile.name || 'Gladiator').slice(0,40) };
        return reply(200, { ok:true, player, token:await database.session(player) });
      }
      const identity = await database.authenticate(body.token);
      const player = identity && {...identity, character:rules.character(body.character)};
      if (!player) return reply(401, { error:'Connect your Torn key to enter a live duel.' });
      if (body.action === 'lobby') return reply(200, { ok:true, player, games:await database.lobby(player) });
      if (body.action === 'rivals') return reply(200, { ok:true, ...await database.rivals(player) });
      if (body.action === 'invitations') return reply(200, { ok:true, invitations:await database.invitations(player) });
      let state;
      if (body.action === 'create') state = await database.create(player, body.bot === true);
      else if (body.action === 'challenge') {
        const rival = (await database.rivals(player)).archRival;
        if (!rival) return reply(409,{error:'Complete a human duel to establish your arch rival.'});
        state = await database.create(player,false,rival);
      }
      else if (['join','get','pick','rematch','leave','decline'].includes(body.action)) {
        const gameId = String(body.gameId || '').toUpperCase();
        if (!/^[A-F0-9]{12}$/.test(gameId)) return reply(400, { error:'Enter the 12-character arena code.' });
        state = await database.act(gameId, player, body.action, body);
        if (body.action === 'decline') return reply(200,{ok:true});
      } else return reply(400, { error:'Unknown arena action.' });
      return reply(200, { ok:true, player, game:rules.publicState(state, player.id) });
    } catch (error) {
      // Do not echo database errors or request URLs (which can contain API keys).
      return reply(error.status || 503, { error:error.status ? error.message : 'The arena is temporarily unavailable. Your locked hand is safe; retry shortly.' });
    }
  };
}
exports.handler = createHandler();
exports.createHandler = createHandler;
