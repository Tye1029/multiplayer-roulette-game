import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import vm from 'node:vm';
import { rouletteTestRuntime } from './roulette-test-runtime.mjs';

const test = await rouletteTestRuntime();
test.reset();
assert.equal(test.public().rouletteState.canSpin, false);
await assert.rejects(test.act('roulette:spin'), /first shot/);
await test.act('roulette:shoot', 'alice', { actionId: 'shot-one' });
assert.equal(test.public().rouletteState.canSpin, true);
assert.equal(test.public().rouletteState.canPass, true);
await test.act('roulette:shoot', 'alice', { actionId: 'shot-one' });
assert.equal(test.get().rouletteState.shotsByPlayer.alice, 1, 'Duplicate shot counted twice');
await test.act('roulette:pass');
assert.equal(test.rules.roulettePublicState(test.get(), 'bob').canSpin, false, 'Opponent shot unlocked bot spin');
await assert.rejects(test.act('roulette:spin', 'bob'), /first shot/);
await test.act('roulette:shoot', 'bob');
await test.act('roulette:pass', 'bob');
assert.equal(test.public().rouletteState.canSpin, true, 'Pass removed first-shot eligibility');
await test.act('roulette:spin');
assert.equal(test.get().rouletteState.remaining, 6);
assert.equal(test.public().rouletteState.canSpin, false);
await assert.rejects(test.act('roulette:spin'), /already used/);
await test.act('roulette:shoot');
await test.act('roulette:pass');
await test.act('roulette:shoot', 'bob');
await test.act('roulette:pass', 'bob');
assert.equal(test.public().rouletteState.canSpin, false, 'Later turn restored used spin');
for (const field of ['remaining', 'bulletPosition', 'chamberCycleId', 'processedActionIds'])
  assert(!(field in test.public().rouletteState), `Leaked ${field}`);
for (let position = 1; position <= 6; position++) {
  test.reset(); test.get().rouletteState.remaining = position;
  test.get().rouletteState.bulletPosition = position;
  for (let shot = 1; shot <= position; shot++) await test.act('roulette:shoot');
  assert.equal(test.get().status, 'complete');
  assert.equal(test.get().rouletteState.shotsFired, position);
  assert.equal(test.get().winnerUserId, 'bob');
}
test.reset();
test.get().rouletteState.turnId = 'bob';
test.get().rouletteState.remaining = 3;
test.get().npcActionAt = new Date(Date.now() - 1).toISOString();
test.set(await test.rules.rouletteAdvance(test.get()));
assert.equal(test.get().rouletteState.lastAction, 'shoot', 'NPC spun before its first shot');
assert.equal(test.get().rouletteState.shotsByPlayer.bob, 1);

// Real guard, pending animation promise, and repeated mutation/poll reconciliation.
const guardSource = await readFile(new URL('../assets/roulette/turn-facing-guard.js', import.meta.url), 'utf8');
let resolveRotation, cancellations = 0, rotations = 0;
const facing = { matches: () => true, getAnimations: () => [{ cancel: () => { cancellations++; } }] };
const root = { dataset: {}, classList: { contains: () => false } };
const game = { gameId: 'rotation-fixture', mode: 'roulette', status: 'playing', revision: 1,
  creator: { userId: 'alice' }, rouletteState: { turnId: 'alice', revision: 1 } };
const lock = { gameId: game.gameId, turnId: 'alice', angle: 356, epoch: 0 };
const context = vm.createContext({
  document: { readyState: 'loading', addEventListener() {} },
  CSS: { escape: String }, CustomEvent: class {},
  requestAnimationFrame() {}, setInterval() {}, clearInterval() {},
  addEventListener() {}, dispatchEvent() {},
  duelActive: { querySelector: () => root }, rouletteLatestGame: game, duelLastActiveGame: game,
  rouletteVisualRuntime: { busy: false },
  RouletteTurnLock: {
    lock, ensureLayers: () => ({ facing }), applyFacing() {}, enforceLockedFacing() {},
    rotateToLockedTurn: async (_game, _id, turnId) => {
      rotations++; lock.pendingTurnId = turnId; lock.animatingFacing = facing;
      await new Promise(resolve => { resolveRotation = resolve; });
      lock.turnId = turnId; lock.angle = 176; lock.pendingTurnId = '';
    }
  }
});
context.window = context;
vm.runInContext(guardSource, context);
await context.RouletteFacingGuard.reconcile();
game.revision++; game.rouletteState.revision++; game.rouletteState.turnId = 'bob';
const running = context.RouletteFacingGuard.reconcile();
assert.equal(rotations, 1);
for (let i = 0; i < 8; i++) await context.RouletteFacingGuard.reconcile();
assert.equal(cancellations, 0, 'Polling cancelled the approved turn animation');
assert(context.RouletteFacingGuard.diagnostics().activeTransition);
resolveRotation(); await running;
assert.equal(context.RouletteFacingGuard.diagnostics().completedRotations, 1);
await context.RouletteFacingGuard.reconcile();
assert.equal(rotations, 1, 'Repeated poll replayed a rotation');

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const preloads = html.match(/<template id="rouletteImagePreloads">([\s\S]*?)<\/template>/)[1];
const paths = [...preloads.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
const loader = html.match(/<script id="game-asset-loading-v1">([\s\S]*?)<\/script>/)[1];
const requests = [], events = {};
const env = { window: { addEventListener() {} }, location: { search: '' }, URLSearchParams,
  document: { getElementById: id => id === 'rouletteImagePreloads' ? { content: { cloneNode: () => paths } } : null,
    head: { appendChild: nodes => requests.push(...nodes) }, addEventListener: (name, fn) => { events[name] = fn; } } };
vm.runInNewContext(loader, env);
events.DOMContentLoaded(); assert.equal(requests.length, 0);
env.window.DuelAssetLoader.warm('safecracker'); assert.equal(requests.length, 0);
env.window.DuelAssetLoader.warm('roulette'); env.window.DuelAssetLoader.warm('roulette');
assert.deepEqual(requests, paths, 'Roulette selection must load each scene image once');
for (const path of paths) await stat(new URL(`..${path}`, import.meta.url));
assert((await stat(new URL('../assets/roulette/decor/workshop-lamp-image2.png', import.meta.url))).size < 120000);
console.log('Roulette repair passed: first-shot unlock, one-use spin across passes, duplicates, six chamber outcomes, bot eligibility, private fields, live animation hold, and scoped image preloads.');
