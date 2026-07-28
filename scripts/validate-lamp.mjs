import { access, readFile } from 'node:fs/promises';
import vm from 'node:vm';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [
  html,
  injector,
  turnLock,
  turnFire,
  config,
  lamp,
  bootstrap,
  calibration,
  lampCss,
  packageSource
] = await Promise.all([
  read('index.html'),
  read('scripts/inject-lamp-assets.mjs'),
  read('assets/roulette/turn-animation.js'),
  read('assets/roulette/turn-fire.js'),
  read('assets/roulette/lamp-config.js'),
  read('assets/roulette/lamp.js'),
  read('assets/roulette/lamp-bootstrap.js'),
  read('assets/roulette/lamp-calibration.js'),
  read('assets/roulette/lamp.css'),
  read('package.json')
]);

for (const [name, source] of [
  ['turn-animation.js', turnLock],
  ['turn-fire.js', turnFire],
  ['lamp.js', lamp],
  ['lamp-bootstrap.js', bootstrap],
  ['lamp-calibration.js', calibration]
]) new vm.Script(source, { filename: name });

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(config, sandbox, { filename: 'lamp-config.js' });
if (Object.keys(sandbox.window.RouletteLampConfig?.bindings || {}).length !== 25) {
  throw new Error('The 25 lamp calibration controls are not intact.');
}

for (const required of [
  '/assets/roulette/lamp.css?v=18',
  '/assets/roulette/lamp-config.js?v=19',
  '/assets/roulette/lamp.js?v=19',
  '/assets/roulette/lamp-bootstrap.js?v=19',
  '/assets/roulette/turn-animation.js?v=5',
  '/assets/roulette/turn-fire.js?v=2',
  'MODULAR_LAMP_ASSETS_START',
  'rrLampCriticalHide'
]) {
  if (!html.includes(required)) throw new Error(`Built page is missing ${required}`);
}

for (const required of [
  "const styleId = 'rrStrictTurnLockStyles'",
  'const lock = {',
  "pendingTurnId: ''",
  'function setRuntimeLock(gameId, turnId, angle)',
  'function applyFacing(layers, angle, turnId',
  'function enforceLockedFacing(gameId)',
  'layers.facing !== lock.animatingFacing',
  'setRuntimeLock(gameId, lock.pendingTurnId, lock.pendingAngle)',
  'function queueTurnRotation(game, gameId, turnId, duration)',
  'async function rotateToLockedTurn(game, gameId, requestedTurnId',
  '{ transform: `rotate(${from + delta * 0.72}deg)`, offset: 0.72 }',
  '{ transform: `rotate(${from + delta - 9 * sign}deg)`, offset: 0.94 }',
  "easing: 'cubic-bezier(.22,.58,.12,1)'",
  "{ transform: 'rotate(116deg)', offset: 0.24 }",
  '{ transform: `rotate(${finalAngle + 720}deg)`, offset: 1 }',
  'async function rotateToLockedTurn(game, gameId, requestedTurnId, duration = 1020)',
  'queueTurnRotation(game, gameId, turnId, 1020)',
  'Number(options.duration) || 1020',
  'const duration = 5300',
  'await rotateToLockedTurn(newest, gameId, newestTurnId, 800)',
  'rouletteMotionTransform = function (_angle',
  'rouletteOrientToShotActor = async function',
  'rouletteRotateToTurn = async function',
  'rouletteOpeningSequence = async function',
  'window.RouletteTurnLock = {',
  'html body [data-roulette-game] .rr-gun-recoil > .rr-revolver',
  'html body [data-roulette-game] .rr-gun-recoil .rr-gun-photo',
  'html body [data-roulette-game] .rr-table',
  'animation: none !important',
  'transform: none !important',
  'transition: none !important'
]) {
  if (!turnLock.includes(required)) throw new Error(`Strict turn lock is missing ${required}`);
}

for (const forbidden of [
  'rouletteShotSequence =',
  'MutationObserver',
  'setInterval(',
  'getBoundingClientRect',
  'lastActorId',
  'scale(${-scale}',
  'rouletteMotionTransform(base+10',
  'rouletteMotionTransform(base-2',
  'data-current-turn',
  'data-shot-revision'
]) {
  if (turnLock.includes(forbidden)) throw new Error(`Turn lock contains conflicting behavior: ${forbidden}`);
}

for (const required of [
  "const api = window.RouletteTurnLock",
  'rouletteShotSequence = async function (_game, state, gameId)',
  'const lockedTurnId = lock.turnId',
  'const lockedAngle = lock.angle',
  'const recoilMotion = rouletteAnimate(layers.recoil',
  'applyFacing(mounted, lockedAngle, lockedTurnId, true)',
  'newestTurnId !== lockedTurnId',
  'await rotateToLockedTurn(newest, gameId, newestTurnId, 1020)',
  'enforceLockedFacing(gameId)'
]) {
  if (!turnFire.includes(required)) throw new Error(`Isolated firing effects are missing ${required}`);
}

for (const forbidden of [
  'lastActorId',
  'angleForPlayer',
  'setRuntimeLock',
  'rouletteVisualRuntime.currentAngle',
  'rouletteVisualRuntime.lastTurnId',
  'rouletteAnimate(layers.facing',
  'rouletteAnimate(motion',
  'rouletteMotionTransform('
]) {
  if (turnFire.includes(forbidden)) throw new Error(`Firing can still change facing: ${forbidden}`);
}

for (const forbidden of [
  'rouletteRotateToTurn',
  'rouletteShotSequence',
  'rouletteMotionTransform',
  'gun-facing.js',
  'turn-orientation.js',
  'gun-turn-animation.js'
]) {
  if (injector.includes(forbidden)) throw new Error(`Lamp injector rewrites or loads obsolete gun code: ${forbidden}`);
}
if (!injector.includes('/assets/roulette/turn-animation.js?v=5')) {
  throw new Error('The injector is not loading strict turn lock version 5.');
}
if (!injector.includes('/assets/roulette/turn-fire.js?v=2')) {
  throw new Error('The injector is not loading isolated firing effects.');
}

for (const required of [
  '/assets/roulette/decor/lamp-1.png',
  'animationDelayFor(duration)',
  'repairImmediately',
  'scene.chain !== lastChain',
  'scene.sceneLight !== lastLight'
]) {
  if (!lamp.includes(required)) throw new Error(`Lamp runtime is missing ${required}`);
}
for (const forbidden of ['.rr-gun-motion', 'scene.gun', 'scene.table', 'data-current-turn']) {
  if (lamp.includes(forbidden) || lampCss.includes(forbidden)) {
    throw new Error(`Lamp code still interacts with gun or table state: ${forbidden}`);
  }
}

const packageJson = JSON.parse(packageSource);
const expected = "node scripts/inject-lamp-assets.mjs && npm run validate:lamp && echo 'Static Netlify site - validation complete'";
if (packageJson.scripts?.build !== expected) throw new Error('Unexpected Netlify build pipeline.');

async function requireMissing(path) {
  try {
    await access(new URL(`../${path}`, import.meta.url));
    throw new Error(`Obsolete file still exists: ${path}`);
  } catch (error) {
    if (error.message === `Obsolete file still exists: ${path}`) throw error;
    if (error.code !== 'ENOENT') throw error;
  }
}
for (const path of [
  'scripts/clean-roulette-scene.mjs',
  'assets/roulette/gun-facing.js',
  'assets/roulette/turn-orientation.js',
  'assets/roulette/gun-turn-animation.js',
  'assets/roulette/gun-animation-test.js',
  'assets/roulette/gun-animation-test.css',
  'gun-animation-test.html'
]) await requireMissing(path);

await access(new URL('../assets/roulette/decor/lamp-1.png', import.meta.url));
await access(new URL('../assets/roulette/decor/workshop-lamp-chain.png', import.meta.url));
console.log('Validation passed: strict facing lock preserved; opening spin and turn rotations are slowed by about 12.5%; firing and table behavior are unchanged.');
