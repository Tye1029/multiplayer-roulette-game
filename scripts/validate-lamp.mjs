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
  calibrationHtml,
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
  read('lamp-calibration.html'),
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
  '/assets/roulette/lamp.js?v=20',
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
  'async function rotateToLockedTurn(game, gameId, requestedTurnId, duration = 1020)',
  'queueTurnRotation(game, gameId, turnId, 1020)',
  'rouletteMotionTransform = function (_angle',
  'rouletteOrientToShotActor = async function',
  'rouletteRotateToTurn = async function',
  'rouletteOpeningSequence = async function',
  'window.RouletteTurnLock = {'
]) {
  if (!turnLock.includes(required)) throw new Error(`Strict turn lock is missing ${required}`);
}

for (const required of [
  'const api = window.RouletteTurnLock',
  'rouletteShotSequence = async function (_game, state, gameId)',
  'const lockedTurnId = lock.turnId',
  'const lockedAngle = lock.angle',
  'const recoilMotion = rouletteAnimate(layers.recoil',
  'applyFacing(mounted, lockedAngle, lockedTurnId, true)',
  'await rotateToLockedTurn(newest, gameId, newestTurnId, 1020)',
  'enforceLockedFacing(gameId)'
]) {
  if (!turnFire.includes(required)) throw new Error(`Isolated firing effects are missing ${required}`);
}

for (const forbidden of [
  'rr126-',
  'rr130-table-illumination',
  'RouletteLamp',
  '__rrLamp',
  'lampAsset',
  'lamp.js',
  'animationDelayFor'
]) {
  if (turnLock.includes(forbidden) || turnFire.includes(forbidden)) {
    throw new Error(`Gun animation code still references lamp state: ${forbidden}`);
  }
}

for (const required of [
  '/assets/roulette/decor/lamp-1.png',
  'const phaseEpoch = Number(global.__rrLampPhaseEpoch) || Date.now()',
  'function phaseMilliseconds(durationSeconds)',
  'function ensureElementTimeline(element, stateKey, signature, frames, timing, phase)',
  'function ensureSwingTimeline(swing, cfg)',
  "setImportant(swing, 'animation', 'none')",
  "'__rrLampSwingTimeline'",
  'function ensureLightTimeline(sceneLight, cfg)',
  "setImportant(sceneLight, 'animation', 'none')",
  "'__rrLampLightTimeline'",
  'animation.currentTime = phase',
  'scene.game !== lastGame',
  'scene.swing !== lastSwing',
  'scene.chain !== lastChain',
  'scene.sceneLight !== lastLight',
  'unless the roulette render actually replaced a lamp or light node'
]) {
  if (!lamp.includes(required)) throw new Error(`Independent lamp timeline is missing ${required}`);
}

for (const forbidden of [
  'animationDelayFor',
  'animation-delay',
  'rr-animation-lock',
  'rr-fired',
  'RouletteTurnLock',
  'rouletteShotSequence',
  'rouletteRotateToTurn',
  'lastActorId',
  '.rr-gun-motion',
  'scene.gun',
  'scene.table',
  'data-current-turn'
]) {
  if (lamp.includes(forbidden)) throw new Error(`Lamp runtime is tied to gun or turn state: ${forbidden}`);
}

for (const forbidden of ['.rr-gun-motion', 'scene.gun', 'scene.table', 'data-current-turn']) {
  if (lampCss.includes(forbidden)) {
    throw new Error(`Lamp stylesheet interacts with gun or table state: ${forbidden}`);
  }
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
if (!injector.includes('/assets/roulette/lamp.js?v=20')) {
  throw new Error('The injector is not loading independent lamp runtime version 20.');
}
if (!injector.includes('/assets/roulette/turn-animation.js?v=5')) {
  throw new Error('The injector is not loading strict turn lock version 5.');
}
if (!injector.includes('/assets/roulette/turn-fire.js?v=2')) {
  throw new Error('The injector is not loading isolated firing effects version 2.');
}
if (!calibrationHtml.includes('/assets/roulette/lamp.js?v=20') || !calibrationHtml.includes('lampCalibration=20')) {
  throw new Error('Lamp calibration page is not loading independent timeline version 20.');
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
console.log('Validation passed: lamp and light use independent persistent timelines; gun and firing code cannot restart them.');