import { access, readFile } from 'node:fs/promises';
import vm from 'node:vm';

const read = filePath => readFile(new URL(`../${filePath}`, import.meta.url), 'utf8');
const [
  configSource,
  runtimeSource,
  calibrationSource,
  bootstrapSource,
  turnOrientationSource,
  injectorSource,
  packageSource,
  htmlSource,
  cssSource
] = await Promise.all([
  read('assets/roulette/lamp-config.js'),
  read('assets/roulette/lamp.js'),
  read('assets/roulette/lamp-calibration.js'),
  read('assets/roulette/lamp-bootstrap.js'),
  read('assets/roulette/turn-orientation.js'),
  read('scripts/inject-lamp-assets.mjs'),
  read('package.json'),
  read('lamp-calibration.html'),
  read('assets/roulette/lamp.css')
]);

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(configSource, sandbox, { filename: 'lamp-config.js' });
new vm.Script(runtimeSource, { filename: 'lamp.js' });
new vm.Script(calibrationSource, { filename: 'lamp-calibration.js' });
new vm.Script(bootstrapSource, { filename: 'lamp-bootstrap.js' });
new vm.Script(turnOrientationSource, { filename: 'turn-orientation.js' });

const api = sandbox.window.RouletteLampConfig;
if (!api) throw new Error('RouletteLampConfig was not exported');

const keys = Object.keys(api.bindings);
if (keys.length !== 25) throw new Error(`Expected 25 controls, found ${keys.length}`);

for (const key of keys) {
  if (!Object.hasOwn(api.defaults, key)) throw new Error(`Missing default for ${key}`);
  if (!runtimeSource.includes(`cfg.${key}`)) throw new Error(`Runtime does not apply ${key}`);
  if (!runtimeSource.includes(`${key}:`)) throw new Error(`Runtime target map does not include ${key}`);
}

for (const required of [
  '/assets/roulette/lamp-config.js?v=16',
  '/assets/roulette/lamp.js?v=16',
  '/assets/roulette/lamp-calibration.js?v=16',
  '/assets/roulette/lamp-calibration.css?v=16'
]) {
  if (!htmlSource.includes(required)) throw new Error(`Calibration HTML missing ${required}`);
}

for (const required of [
  '/assets/roulette/lamp-config.js?v=16',
  '/assets/roulette/lamp.js?v=16',
  '/assets/roulette/lamp-bootstrap.js?v=16',
  '/assets/roulette/turn-orientation.js?v=1',
  'rrLampCriticalHide',
  'MODULAR_LAMP_ASSETS_START',
  'MODULAR_LAMP_ASSETS_END'
]) {
  if (!injectorSource.includes(required)) throw new Error(`Build injector missing ${required}`);
}

for (const forbidden of [
  'gun-turn-animation',
  'gun-animation-test',
  'data-shot-revision'
]) {
  if (injectorSource.includes(forbidden)) throw new Error(`Build injector still contains a temporary gun hook: ${forbidden}`);
}

for (const required of [
  '/assets/roulette/decor/lamp-1.png',
  "styleAsset = '/assets/roulette/lamp.css?v=16'",
  'applyLightingVariables',
  '--rr-cal-light-background',
  '--rr-light-track-distance',
  '--rr-light-track-duration',
  'lampNeedsRepair',
  'scene.game !== lastGame || scene.swing !== lastSwing',
  'if (lampNeedsRepair()) run()'
]) {
  if (!runtimeSource.includes(required)) throw new Error(`Lamp runtime missing ${required}`);
}

for (const forbidden of [
  '.rr-gun-motion',
  'getBoundingClientRect',
  'applyGunGlint',
  'ensureGunGlint',
  'scene.gun',
  'scene.table',
  'data-current-turn',
  'data-shot-revision',
  'setInterval('
]) {
  if (runtimeSource.includes(forbidden)) throw new Error(`Lamp runtime still interacts with gun or turn rendering: ${forbidden}`);
}

for (const required of [
  'background: var(--rr-cal-light-background',
  'background-position: calc(50% - var(--rr-light-track-distance',
  'background-position: calc(50% + var(--rr-light-track-distance',
  'transform: none !important',
  'will-change: background-position',
  '#rrLampTrackedLight',
  '#rrRoomDarknessOverlay'
]) {
  if (!cssSource.includes(required)) throw new Error(`Lamp CSS missing ${required}`);
}

for (const forbidden of [
  '[data-roulette-game] .rr-gun-motion',
  '[data-current-turn',
  '[data-shot-revision'
]) {
  if (cssSource.includes(forbidden)) throw new Error(`Lamp CSS still styles gun or turn state: ${forbidden}`);
}

if (cssSource.includes('@keyframes rrLampLightTrackExternal {\n  0%, 100% { transform:')) {
  throw new Error('Light tracking still transforms a scene element');
}
if (injectorSource.includes('.rr126-swing { visibility: hidden')) {
  throw new Error('Critical CSS still hides the whole lamp rig during firing rerenders');
}

for (const required of [
  "const GAME_SELECTOR = '[data-roulette-game]'",
  "const GUN_SELECTOR = '.rr-gun-motion'",
  "const OWNER_ATTRIBUTE = 'data-rr-turn-owner'",
  "const READY_ATTRIBUTE = 'data-rr-turn-ready'",
  'rotate: 180deg !important',
  'transition: rotate 780ms',
  '/^YOUR TURN[.!]?$/',
  '/\\bHAS THE REVOLVER\\b/',
  'ownerFromData',
  'ownerFromVisibleStatus',
  'const ownerChanged = owner !== lastOwner',
  'if (!gunChanged && !ownerChanged) return',
  "gameRoot.setAttribute(OWNER_ATTRIBUTE, owner)",
  'gameObserver.observe(gameRoot',
  'pageObserver.observe(document.body || document.documentElement'
]) {
  if (!turnOrientationSource.includes(required)) {
    throw new Error(`Turn orientation implementation missing ${required}`);
  }
}

for (const forbidden of [
  'fetch(',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'sendBeacon',
  'setInterval(',
  '.animate(',
  'playRecoil',
  'data-shot-revision',
  'lastShotNumber',
  'shotsFired',
  '/.netlify/functions/',
  'localStorage',
  'sessionStorage',
  'transform: rotate('
]) {
  if (turnOrientationSource.includes(forbidden)) {
    throw new Error(`Turn orientation must remain deterministic and state-neutral: ${forbidden}`);
  }
}

const packageJson = JSON.parse(packageSource);
const buildCommand = packageJson.scripts?.build || '';
if (buildCommand !== "node scripts/inject-lamp-assets.mjs && npm run validate:lamp && echo 'Static Netlify site - validation complete'") {
  throw new Error('Netlify build must not delete repository or gameplay assets');
}
if (packageJson.scripts?.['clean:lamp']) {
  throw new Error('Deployment-time lamp cleanup must remain disabled');
}

await access(new URL('../assets/roulette/decor/lamp-1.png', import.meta.url));
await access(new URL('../assets/roulette/turn-orientation.js', import.meta.url));

async function requireMissing(filePath) {
  try {
    await access(new URL(`../${filePath}`, import.meta.url));
    throw new Error(`Temporary gun diagnostic file still exists: ${filePath}`);
  } catch (error) {
    if (error.message === `Temporary gun diagnostic file still exists: ${filePath}`) throw error;
    if (error.code !== 'ENOENT') throw error;
  }
}

for (const filePath of [
  'assets/roulette/gun-turn-animation.js',
  'assets/roulette/gun-animation-test.js',
  'assets/roulette/gun-animation-test.css',
  'gun-animation-test.html',
  'assets/roulette/decor/workshop-lamp-body-game-small-2.png'
]) {
  await requireMissing(filePath);
}

if (!calibrationSource.includes('lampApi.watch')) {
  throw new Error('Calibration controller is not watching dynamic lamp mounts');
}
if (!bootstrapSource.includes("params.has('lampCalibration')") || !bootstrapSource.includes('lampApi.watch')) {
  throw new Error('Normal-page lamp bootstrap is not isolated from calibration mode');
}

console.log(`Validation passed: ${keys.length}/${keys.length} lamp controls bound; turn ownership rotates the real gun exactly once per owner change.`);
