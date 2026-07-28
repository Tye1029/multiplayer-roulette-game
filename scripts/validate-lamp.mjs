import { access, readFile } from 'node:fs/promises';
import vm from 'node:vm';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [
  html,
  injector,
  turnAnimation,
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
  read('assets/roulette/lamp-config.js'),
  read('assets/roulette/lamp.js'),
  read('assets/roulette/lamp-bootstrap.js'),
  read('assets/roulette/lamp-calibration.js'),
  read('assets/roulette/lamp.css'),
  read('package.json')
]);

for (const [name, source] of [
  ['turn-animation.js', turnAnimation],
  ['lamp.js', lamp],
  ['lamp-bootstrap.js', bootstrap],
  ['lamp-calibration.js', calibration]
]) {
  new vm.Script(source, { filename: name });
}

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(config, sandbox, { filename: 'lamp-config.js' });
const api = sandbox.window.RouletteLampConfig;
if (!api || Object.keys(api.bindings).length !== 25) {
  throw new Error('The 25 lamp calibration controls are not intact.');
}

for (const required of [
  '/assets/roulette/lamp.css?v=18',
  '/assets/roulette/lamp-config.js?v=19',
  '/assets/roulette/lamp.js?v=19',
  '/assets/roulette/lamp-bootstrap.js?v=19',
  '/assets/roulette/turn-animation.js?v=2',
  'MODULAR_LAMP_ASSETS_START',
  'rrLampCriticalHide'
]) {
  if (!html.includes(required)) throw new Error(`Built page is missing ${required}`);
}

for (const required of [
  "const facingSelector = ':scope > [data-roulette-facing]'",
  "const recoilSelector = ':scope > [data-roulette-recoil]'",
  "(document.body || document.documentElement).append(style)",
  'html body [data-roulette-game] .rr-gun-motion',
  'transform: translate(-50%, -50%) scale(.74) !important',
  'animation: none !important',
  "facing.dataset.rouletteFacing = '1'",
  "recoil.dataset.rouletteRecoil = '1'",
  'function ensureLayers(root)',
  'function settleFacing(gameId, angle, turnId',
  'async function animateFacing(game, gameId, turnId',
  'rouletteMotionTransform = function (_angle',
  'rouletteRotateToTurn = async function',
  'rouletteOpeningSequence = async function',
  'rouletteShotSequence = async function',
  'rouletteOrientToShotActor = async function',
  'const actorAngle = normalizeAngle(angleForPlayer(game, actorId))',
  'const recoilMotion = rouletteAnimate(',
  'layers.recoil,',
  'const originalBind = rouletteBind',
  'mountCurrentScene()'
]) {
  if (!turnAnimation.includes(required)) throw new Error(`Two-layer turn module is missing ${required}`);
}

for (const forbidden of [
  'MutationObserver',
  'setInterval(',
  'getBoundingClientRect',
  'rouletteAnimate(\n            layers.motion',
  'rouletteAnimate(motion',
  'scale(${-scale}',
  'data-current-turn',
  'data-shot-revision',
  'motion.style.transform = rouletteMotionTransform(angle',
  'motion.style.transform=rouletteMotionTransform(angle'
]) {
  if (turnAnimation.includes(forbidden)) {
    throw new Error(`Turn module contains a conflicting patch technique: ${forbidden}`);
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
  if (injector.includes(forbidden)) throw new Error(`Lamp injector still rewrites or loads obsolete gun code: ${forbidden}`);
}
if (!injector.includes('/assets/roulette/turn-animation.js?v=2')) {
  throw new Error('Lamp injector is not loading the cache-busted two-layer turn module.');
}

for (const id of [
  'rr-v114-image2-lamp-rig',
  'rr-v126-split-lamp-rig',
  'rr-v130-table-surface-lighting',
  'rr-v140-lighting-debug-rebuild',
  'rr-v145-single-driver-light-sync',
  'rr-v148-final-lamp-asset-cleanup'
]) {
  if (html.includes(`id="${id}"`) || html.includes(`id='${id}'`)) {
    throw new Error(`Obsolete lamp block survived the build: ${id}`);
  }
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
    throw new Error(`Lamp module still interacts with gun state: ${forbidden}`);
  }
}

const packageJson = JSON.parse(packageSource);
const expected = "node scripts/inject-lamp-assets.mjs && npm run validate:lamp && echo 'Static Netlify site - validation complete'";
if (packageJson.scripts?.build !== expected) throw new Error('Build still runs the old gameplay rewriter.');

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

console.log('Validation passed: outer gun positioning is locked; one facing layer rotates and one recoil layer fires.');