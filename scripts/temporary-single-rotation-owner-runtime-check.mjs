import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../assets/roulette/turn-facing-guard.js', import.meta.url), 'utf8');

const facing = {
  style: {},
  dataset: {},
  matches(selector) { return selector === '[data-roulette-facing]'; },
  getAnimations() { return []; }
};
const root = {
  dataset: { gameId: 'rotation-test', status: 'playing', rouletteOpening: '0' },
  classList: { contains() { return false; } }
};
const layers = { root, facing };
let rotateCalls = 0;
let audioCalls = 0;
const dispatched = [];
const intervals = [];
const rafs = [];

const lock = {
  gameId: '', turnId: '', angle: 356,
  pendingTurnId: '', pendingAngle: 356, queuedTurnId: '',
  epoch: 0, opening: false, firing: false, animatingFacing: null
};

const context = {
  console,
  Date,
  String,
  Number,
  Array,
  Map,
  Set,
  Promise,
  CustomEvent: class CustomEvent { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } },
  CSS: { escape: value => String(value) },
  document: {
    readyState: 'complete',
    body: {},
    documentElement: {},
    addEventListener() {}
  },
  MutationObserver: class MutationObserver { observe() {} disconnect() {} },
  requestAnimationFrame(callback) { rafs.push(callback); return rafs.length; },
  setInterval(callback) { intervals.push(callback); return intervals.length; },
  clearInterval() {},
  addEventListener() {},
  dispatchEvent(event) { dispatched.push(event); return true; },
  duelActive: {
    querySelector(selector) {
      if (selector === '[data-roulette-game]') return root;
      if (selector.includes('[data-roulette-game]')) return root;
      return null;
    }
  },
  rouletteVisualRuntime: {
    gameId: 'rotation-test', busy: false, currentAngle: 356,
    angleHydrated: true, lastTurnId: '', displayTurnId: '', rotationTargetId: ''
  },
  rouletteLatestGame: null,
  duelLastActiveGame: null,
  rouletteBind() { return true; },
  async rouletteRotateToTurn() { throw new Error('Legacy rotation path should be blocked.'); },
  async rouletteAnimate(element) { return element; },
  RouletteAudio: {
    turnRotate() { audioCalls += 1; return true; }
  }
};
context.window = context;
context.globalThis = context;
context.RouletteTurnLock = {
  lock,
  ensureLayers() { return layers; },
  applyFacing(_layers, angle, turnId) {
    facing.style.transform = `rotate(${angle}deg)`;
    facing.dataset.rouletteFacingAngle = String(angle);
    facing.dataset.rouletteFacingTurnId = String(turnId || '');
    root.dataset.rouletteLockedTurnId = String(turnId || '');
    root.dataset.rouletteLockedAngle = String(angle);
    return layers;
  },
  enforceLockedFacing() {
    context.RouletteTurnLock.applyFacing(layers, lock.angle, lock.turnId);
    return layers;
  },
  async rotateToLockedTurn(game, gameId, turnId) {
    rotateCalls += 1;
    const target = String(turnId) === String(game.creator.userId) ? 356 : 176;
    lock.gameId = String(gameId);
    lock.pendingTurnId = String(turnId);
    lock.pendingAngle = target;
    lock.animatingFacing = facing;
    await context.rouletteAnimate(facing, [{ transform: `rotate(${target}deg)` }], { duration: 1020 });
    lock.turnId = String(turnId);
    lock.angle = target;
    lock.pendingTurnId = '';
    lock.pendingAngle = target;
    lock.animatingFacing = null;
    context.RouletteTurnLock.applyFacing(layers, target, turnId);
  }
};

vm.createContext(context);
vm.runInContext(source, context, { filename: 'turn-facing-guard.js' });

function game(revision, stateRevision, status, turnId) {
  return {
    gameId: 'rotation-test', mode: 'roulette', status, revision,
    updatedAt: `2026-07-29T16:00:${String(revision).padStart(2, '0')}.000Z`,
    creator: { userId: 'creator' }, joiner: { userId: 'joiner' },
    rouletteState: { revision: stateRevision, turnId }
  };
}
function publish(next) {
  context.rouletteLatestGame = next;
  context.duelLastActiveGame = next;
  root.dataset.status = next.status;
  root.dataset.turnId = next.rouletteState.turnId;
  root.dataset.revision = String(next.rouletteState.revision);
}

publish(game(1, 1, 'playing', 'creator'));
await context.RouletteFacingGuard.reconcile();
assert.equal(rotateCalls, 0, 'Initial hydration must snap, not rotate.');
assert.equal(lock.turnId, 'creator');

publish(game(2, 2, 'playing', 'creator'));
await context.RouletteFacingGuard.reconcile();
assert.equal(rotateCalls, 0, 'Same-turn shot/poll revision must not rotate.');

publish(game(3, 3, 'playing', 'joiner'));
await context.RouletteFacingGuard.reconcile();
assert.equal(rotateCalls, 1, 'One real turn transition must rotate exactly once.');
assert.equal(audioCalls, 1, 'The approved rotation must start one sound.');
assert.equal(lock.turnId, 'joiner');

await context.RouletteFacingGuard.reconcile();
await context.RouletteFacingGuard.reconcile();
assert.equal(rotateCalls, 1, 'Repeated polling must not replay a completed token.');

await context.rouletteRotateToTurn(game(3, 3, 'playing', 'joiner'), {}, 'rotation-test', { targetTurnId: 'creator' });
assert.equal(rotateCalls, 1, 'The legacy rotation API must be blocked.');

context.rouletteVisualRuntime.busy = true;
publish(game(4, 4, 'playing', 'creator'));
await context.RouletteFacingGuard.reconcile();
assert.equal(rotateCalls, 1, 'A transition waits while visual work is busy.');
publish(game(5, 5, 'playing', 'joiner'));
await context.RouletteFacingGuard.reconcile();
assert.equal(rotateCalls, 1, 'A superseding transition also waits while busy.');
context.rouletteVisualRuntime.busy = false;
await context.RouletteFacingGuard.reconcile();
assert.equal(rotateCalls, 2, 'Only the newest superseding transition may run.');
assert.equal(lock.turnId, 'joiner');

publish(game(6, 6, 'complete', 'joiner'));
await context.RouletteFacingGuard.reconcile();
assert.equal(rotateCalls, 2, 'Completion must never start another rotation.');
assert.equal(lock.turnId, 'joiner');
assert.equal(facing.dataset.rouletteFacingAngle, '176');

const events = context.__rouletteFacingDiagnostics.map(entry => entry.event);
for (const required of ['requested', 'approved', 'completed', 'blocked', 'cancelled']) {
  assert.ok(events.includes(required), `Missing ${required} rotation diagnostic.`);
}
const approved = context.__rouletteFacingDiagnostics.filter(entry => entry.event === 'approved');
assert.equal(new Set(approved.map(entry => entry.token)).size, approved.length, 'Approved rotation tokens must be unique.');

console.log(JSON.stringify({
  status: 'passed',
  rotateCalls,
  audioCalls,
  finalTurnId: lock.turnId,
  finalAngle: facing.dataset.rouletteFacingAngle,
  diagnostics: events.reduce((counts, event) => ({ ...counts, [event]: (counts[event] || 0) + 1 }), {})
}, null, 2));
