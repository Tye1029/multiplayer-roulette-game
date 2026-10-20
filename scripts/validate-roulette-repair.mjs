import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import vm from 'node:vm';
import { rouletteTestRuntime } from './roulette-test-runtime.mjs';

const test = await rouletteTestRuntime();
test.reset();
assert.equal(test.public().rouletteState.canSpin, true, 'Spin must be available before the first shot');
assert.equal(test.rules.roulettePublicState(test.get(), 'bob').canSpin, false, 'Off-turn spin became available');
await test.act('roulette:spin', 'alice', { actionId: 'first-spin' });
assert.equal(test.public().rouletteState.canSpin, false);
await test.act('roulette:spin', 'alice', { actionId: 'first-spin' });
assert.equal(test.get().rouletteState.shotsFired, 0, 'Spin fired a shot');
await assert.rejects(test.act('roulette:spin'), /already used/);
test.reset();
await test.act('roulette:shoot', 'alice', { actionId: 'shot-one' });
assert.equal(test.public().rouletteState.canSpin, true);
assert.equal(test.public().rouletteState.canPass, true);
await test.act('roulette:shoot', 'alice', { actionId: 'shot-one' });
assert.equal(test.get().rouletteState.shotsByPlayer.alice, 1, 'Duplicate shot counted twice');
await test.act('roulette:pass');
assert.equal(test.rules.roulettePublicState(test.get(), 'bob').canSpin, true, 'Opponent must have its own unused spin');
await test.act('roulette:spin', 'bob');
await test.act('roulette:shoot', 'bob');
await test.act('roulette:pass', 'bob');
assert.equal(test.public().rouletteState.canSpin, true, 'Pass removed unused spin eligibility');
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
test.get().rouletteState.remaining = 6;
test.get().npcActionAt = new Date(Date.now() - 1).toISOString();
test.set(await test.rules.rouletteAdvance(test.get()));
assert.equal(test.get().rouletteState.lastAction, 'shoot', 'NPC should preserve its spin on a fresh cylinder');
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

// A bot can shoot and pass before the local shot feedback has finished. Queue
// the authoritative handoff while busy, then animate it exactly once afterward.
game.revision++; game.rouletteState.revision++; game.rouletteState.turnId = 'alice';
context.rouletteVisualRuntime.busy = true;
await context.RouletteFacingGuard.reconcile();
assert.equal(rotations, 1);
assert(context.RouletteFacingGuard.diagnostics().pendingTransition);
for (let i = 0; i < 4; i++) await context.RouletteFacingGuard.reconcile();
context.rouletteVisualRuntime.busy = false;
const returning = context.RouletteFacingGuard.reconcile();
assert.equal(rotations, 2);
resolveRotation(); await returning;
assert.equal(context.RouletteFacingGuard.diagnostics().completedRotations, 2);
assert(!context.RouletteFacingGuard.diagnostics().recent.some(event => event.reason === 'mismatch-without-transition-token'));

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
assert((await stat(new URL('../assets/roulette/decor/rustic-pendant-v2.png', import.meta.url))).size < 300000);
console.log('Roulette repair passed: first-turn spin, one-use across passes, duplicates, six chamber outcomes, bot eligibility, private fields, uninterrupted handoffs after shot feedback, and scoped image preloads.');
