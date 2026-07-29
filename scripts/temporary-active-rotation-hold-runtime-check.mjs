import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../assets/roulette/turn-facing-guard.js', import.meta.url), 'utf8');

let releaseAnimation;
let animationStarted = false;
let rotateCalls = 0;
let audioCalls = 0;
let applyCalls = 0;
const rafs = [];
const intervals = [];

const facing = {
  style: {},
  dataset: {},
  matches(selector) { return selector === '[data-roulette-facing]'; },
  getAnimations() { return []; }
};
const root = {
  dataset: { gameId: 'hold-test', status: 'playing', rouletteOpening: '0', revision: '1', turnId: 'creator' },
  classList: { contains() { return false; } }
};
const layers = { root, facing };
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
  dispatchEvent() { return true; },
  duelActive: {
    querySelector(selector) {
      if (selector === '[data-roulette-game]' || selector.includes('[data-roulette-game]')) return root;
      return null;
    }
  },
  rouletteVisualRuntime: {
    gameId: 'hold-test', busy: false, currentAngle: 356,
    angleHydrated: true, lastTurnId: '', displayTurnId: '', rotationTargetId: ''
  },
  rouletteLatestGame: null,
  duelLastActiveGame: null,
  rouletteBind() { return true; },
  async rouletteRotateToTurn() { throw new Error('Legacy rotation API must remain blocked.'); },
  async rouletteAnimate(element) {
    if (element !== facing) return element;
    animationStarted = true;
    await new Promise(resolve => { releaseAnimation = resolve; });
    return element;
  },
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
    applyCalls += 1;
    facing.style.transform = `rotate(${angle}deg)`;
    facing.dataset.rouletteFacingAngle = String(angle);
    facing.dataset.rouletteFacingTurnId = String(turnId || '');
    root.dataset.rouletteLockedTurnId = String(turnId || '');
    root.dataset.rouletteLockedAngle = String(angle);
    return layers;
  },
  enforceLockedFacing() {
    if (lock.pendingTurnId && lock.animatingFacing === facing) return layers;
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

function game(revision, stateRevision, turnId, status = 'playing') {
  return {
    gameId: 'hold-test', mode: 'roulette', status, revision,
    updatedAt: `2026-07-29T16:30:${String(revision).padStart(2, '0')}.000Z`,
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

publish(game(1, 1, 'creator'));
await context.RouletteFacingGuard.reconcile();
assert.equal(lock.turnId, 'creator');
const initialApplyCalls = applyCalls;

publish(game(2, 2, 'joiner'));
const runningRotation = context.RouletteFacingGuard.reconcile();
for (let i = 0; i < 20 && !animationStarted; i += 1) await Promise.resolve();
assert.equal(animationStarted, true, 'Approved rotation did not reach its animation.');
assert.equal(rotateCalls, 1);
assert.equal(audioCalls, 1);
assert.equal(lock.pendingTurnId, 'joiner');

const appliesAtAnimationStart = applyCalls;
await context.RouletteFacingGuard.reconcile();
await context.RouletteFacingGuard.reconcile();
await context.RouletteFacingGuard.reconcile();
assert.equal(applyCalls, appliesAtAnimationStart, 'A guard poll snapped the gun during its approved rotation.');
assert.equal(lock.pendingTurnId, 'joiner', 'A guard poll cleared the approved pending rotation.');
assert.equal(context.__rouletteFacingDiagnostics.some(entry => entry.reason === 'mismatch-without-transition-token'), false);

releaseAnimation();
await runningRotation;
assert.equal(lock.pendingTurnId, '');
assert.equal(lock.turnId, 'joiner');
assert.equal(facing.dataset.rouletteFacingAngle, '176');
assert.equal(context.__rouletteFacingDiagnostics.filter(entry => entry.event === 'approved').length, 1);
assert.equal(context.__rouletteFacingDiagnostics.filter(entry => entry.event === 'completed').length, 1);
assert.equal(context.__rouletteFacingDiagnostics.some(entry => entry.reason === 'mismatch-without-transition-token'), false);
assert.ok(applyCalls > initialApplyCalls, 'The final locked facing was not applied after animation completion.');

console.log(JSON.stringify({
  status: 'passed',
  rotateCalls,
  audioCalls,
  appliesAtAnimationStart,
  applyCallsAfterThreeMidAnimationPolls: appliesAtAnimationStart,
  finalAngle: facing.dataset.rouletteFacingAngle,
  mismatchSnaps: context.__rouletteFacingDiagnostics.filter(entry => entry.reason === 'mismatch-without-transition-token').length,
  events: context.__rouletteFacingDiagnostics.map(entry => entry.event)
}, null, 2));
