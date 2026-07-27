import { access, readFile } from 'node:fs/promises';
import vm from 'node:vm';

const read = filePath => readFile(new URL(`../${filePath}`, import.meta.url), 'utf8');
const [
  configSource,
  runtimeSource,
  calibrationSource,
  bootstrapSource,
  gunAnimationSource,
  gunTestSource,
  gunTestHtmlSource,
  gunTestCssSource,
  injectorSource,
  packageSource,
  htmlSource,
  cssSource
] = await Promise.all([
  read('assets/roulette/lamp-config.js'),
  read('assets/roulette/lamp.js'),
  read('assets/roulette/lamp-calibration.js'),
  read('assets/roulette/lamp-bootstrap.js'),
  read('assets/roulette/gun-turn-animation.js'),
  read('assets/roulette/gun-animation-test.js'),
  read('gun-animation-test.html'),
  read('assets/roulette/gun-animation-test.css'),
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
new vm.Script(gunAnimationSource, { filename: 'gun-turn-animation.js' });
new vm.Script(gunTestSource, { filename: 'gun-animation-test.js' });

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
  '/assets/roulette/gun-turn-animation.js?v=3',
  'rrLampCriticalHide',
  'MODULAR_LAMP_ASSETS_START',
  'MODULAR_LAMP_ASSETS_END'
]) {
  if (!injectorSource.includes(required)) throw new Error(`Build injector missing ${required}`);
}

for (const required of [
  '/assets/roulette/decor/lamp-1.png',
  "styleAsset = '/assets/roulette/lamp.css?v=16'",
  'applyLightingVariables',
  '--rr-cal-light-background',
  '--rr-light-track-distance',
  '--rr-light-track-duration',
  '--rr-gun-gleam',
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
  'setInterval('
]) {
  if (runtimeSource.includes(forbidden)) throw new Error(`Lamp runtime still interacts with gun/turn rendering: ${forbidden}`);
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
if (cssSource.includes('[data-roulette-game] .rr-gun-motion')) {
  throw new Error('Lamp CSS must not select or style the gun');
}
if (cssSource.includes('@keyframes rrLampLightTrackExternal {\n  0%, 100% { transform:')) {
  throw new Error('Light tracking still transforms a scene element');
}

for (const required of [
  "const GUN_SELECTOR = '.rr-gun-motion'",
  'readTurnSignature',
  'readShotSignature',
  'playTurnAnimation',
  'playRecoilAnimation',
  'turnChanged',
  'shotChanged',
  'gunChanged',
  'MutationObserver',
  "params.has('lampCalibration')",
  "rotate: `${delta}deg`",
  "translate: '-3.5% 1.5%'",
  'SHOT_DATA_KEY',
  'RECOIL_DEDUPE_MS',
  'if (explicitValues.length) return',
  "'data-shot-revision'",
  "'data-current-turn-revision'",
  'now - lastRecoilAt >= RECOIL_DEDUPE_MS'
]) {
  if (!gunAnimationSource.includes(required)) throw new Error(`Gun animation bridge missing ${required}`);
}
for (const forbidden of [
  'fetch(',
  'XMLHttpRequest',
  'localStorage.setItem',
  'classList.add',
  'classList.remove',
  'style.setProperty'
]) {
  if (gunAnimationSource.includes(forbidden)) throw new Error(`Gun animation bridge must remain state-neutral: ${forbidden}`);
}

for (const required of [
  '<main class="test-shell" data-roulette-game data-current-turn="local">',
  'class="rr-gun-motion"',
  'id="testGun"',
  '/assets/roulette/gun-turn-animation.js?v=3',
  '/assets/roulette/gun-animation-test.js?v=2',
  '/assets/roulette/gun-animation-test.css?v=1',
  'Opponent fires',
  'does not create a game'
]) {
  if (!gunTestHtmlSource.includes(required)) throw new Error(`Gun animation test page missing ${required}`);
}

for (const required of [
  'runAutomaticLoop',
  'expectAnimation',
  "setTurn('opponent')",
  "fire('opponent')",
  'gun.getAnimations()',
  "expectAnimation('turn'",
  "expectAnimation('recoil'",
  'data-test-action',
  "overall.textContent = 'PASS'",
  'shotRevision',
  'manualBusy',
  'manualTakeoverPending',
  'setManualControlsDisabled',
  'isCancelled',
  'await wait(950)'
]) {
  if (!gunTestSource.includes(required)) throw new Error(`Gun animation test harness missing ${required}`);
}
for (const forbidden of [
  'fetch(',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'sendBeacon',
  'localStorage',
  'sessionStorage',
  '/.netlify/functions/',
  'create-game',
  'join-game'
]) {
  if (gunTestSource.includes(forbidden) || gunTestHtmlSource.includes(forbidden)) {
    throw new Error(`Gun animation test must remain offline and state-isolated: ${forbidden}`);
  }
}
for (const required of [
  '.rr-gun-motion',
  '.muzzle-flash',
  '[data-current-turn="local"] .player-local',
  '[data-current-turn="opponent"] .player-opponent',
  '@keyframes testHammer',
  '@keyframes testFlash'
]) {
  if (!gunTestCssSource.includes(required)) throw new Error(`Gun animation test styling missing ${required}`);
}

if (injectorSource.includes('.rr126-swing { visibility: hidden')) {
  throw new Error('Critical CSS still hides the whole lamp rig during firing rerenders');
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
try {
  await access(new URL('../assets/roulette/decor/workshop-lamp-body-game-small-2.png', import.meta.url));
  throw new Error('Confirmed obsolete workshop lamp asset still exists');
} catch (error) {
  if (error.message === 'Confirmed obsolete workshop lamp asset still exists') throw error;
  if (error.code !== 'ENOENT') throw error;
}

if (!calibrationSource.includes('lampApi.watch')) {
  throw new Error('Calibration controller is not watching dynamic lamp mounts');
}
if (!bootstrapSource.includes("params.has('lampCalibration')") || !bootstrapSource.includes('lampApi.watch')) {
  throw new Error('Normal-page lamp bootstrap is not isolated from calibration mode');
}

console.log(`Validation passed: ${keys.length}/${keys.length} lamp controls bound; recoil is deduplicated and automatic/manual gun tests cannot overlap.`);
