import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const startMarker = '  function rnbStateRevision(game){';
const endMarker = '  async function rnbFetchAuthoritativeGame(gameId){';
const start = html.indexOf(startMarker);
const end = html.indexOf(endMarker, start + startMarker.length);
assert.ok(start >= 0 && end > start, 'Remote Bot adoption helper was not generated.');
const helper = html.slice(start, end);

const context = {
  console,
  Date,
  String,
  Number,
  Array,
  botLogs: [],
  remembered: [],
  rendered: [],
  rejectedByRouletteGuard: false,
  duelLastRenderKey: 'old',
  duelLastActiveGame: {
    gameId: 'network-test', mode: 'roulette', status: 'playing', revision: 8,
    updatedAt: '2026-07-29T15:00:08.000Z', rouletteState: { revision: 4, turnId: 'creator' }
  },
  rouletteLatestGame: {
    gameId: 'network-test', mode: 'roulette', status: 'playing', revision: 8,
    updatedAt: '2026-07-29T15:00:08.000Z', rouletteState: { revision: 4, turnId: 'creator' }
  },
  line(arr, message, data) { arr.push({ message, data }); },
  rouletteAcceptSnapshot(game) { return !context.rejectedByRouletteGuard; },
  rouletteNormalizeSnapshot(game) { return { ...game, normalized: true }; },
  duelRememberCurrentGame(gameId) { context.remembered.push(gameId); },
  duelRenderActive(game, force) { context.rendered.push({ game, force }); }
};
vm.createContext(context);
vm.runInContext(`${helper}\nthis.rnbAdoptGame=rnbAdoptGame;this.rnbSnapshotStamp=rnbSnapshotStamp;`, context);

const staleTopLevel = {
  gameId: 'network-test', mode: 'roulette', status: 'playing', revision: 7,
  updatedAt: '2026-07-29T15:00:09.000Z', rouletteState: { revision: 99, turnId: 'joiner' }
};
const kept = context.rnbAdoptGame(staleTopLevel, true);
assert.equal(kept.revision, 8);
assert.equal(context.rendered.length, 0);
assert.equal(context.botLogs.at(-1)?.message, 'ignored stale game snapshot');

const staleState = {
  gameId: 'network-test', mode: 'roulette', status: 'playing', revision: 8,
  updatedAt: '2026-07-29T15:00:09.000Z', rouletteState: { revision: 3, turnId: 'joiner' }
};
const keptState = context.rnbAdoptGame(staleState, true);
assert.equal(keptState.rouletteState.revision, 4);
assert.equal(context.rendered.length, 0);

const newer = {
  gameId: 'network-test', mode: 'roulette', status: 'complete', revision: 9,
  updatedAt: '2026-07-29T15:00:10.000Z', rouletteState: { revision: 5, turnId: 'joiner' }
};
const adopted = context.rnbAdoptGame(newer, true);
assert.equal(adopted.revision, 9);
assert.equal(adopted.normalized, true);
assert.equal(context.duelLastActiveGame.revision, 9);
assert.equal(context.rouletteLatestGame.revision, 9);
assert.equal(context.rendered.length, 1);
assert.equal(context.rendered[0].force, true);
assert.equal(context.remembered.at(-1), 'network-test');

context.rejectedByRouletteGuard = true;
const rejected = context.rnbAdoptGame({ ...newer, revision: 10, rouletteState: { revision: 6 } }, true);
assert.equal(rejected.revision, 9);
assert.equal(context.rendered.length, 1);
assert.equal(context.botLogs.at(-1)?.message, 'ignored rejected roulette snapshot');

assert.ok(html.includes('const needLobby = !focusedGameOpen && (!duelLobbyLoaded'));
assert.ok(!html.includes('!duelCachedGames.length || !focusedGameOpen'));
assert.ok(html.includes('<b>Game revision</b>'));
assert.ok(html.includes('<b>State revision</b>'));

console.log(JSON.stringify({
  status: 'passed',
  checks: [
    'older top-level Remote Bot snapshot rejected',
    'older mode-state revision rejected',
    'newer authoritative snapshot adopted and rendered',
    'Roulette guard rejection preserved newest accepted state',
    'focused game polling no longer runs lobby list',
    'debug output separates game and state revisions'
  ],
  staleLogs: context.botLogs.length,
  renders: context.rendered.length
}, null, 2));
