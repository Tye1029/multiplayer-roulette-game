import { access, readFile } from 'node:fs/promises';
import vm from 'node:vm';

const read = filePath => readFile(new URL(`../${filePath}`, import.meta.url), 'utf8');
const [
  configSource,
  runtimeSource,
  calibrationSource,
  bootstrapSource,
  gunFacingSource,
  injectorSource,
  packageSource,
  htmlSource,
  cssSource
] = await Promise.all([
  read('assets/roulette/lamp-config.js'),
  read('assets/roulette/lamp.js'),
  read('assets/roulette/lamp-calibration.js'),
  read('assets/roulette/lamp-bootstrap.js'),
  read('assets/roulette/gun-facing.js'),
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
new vm.Script(gunFacingSource, { filename: 'gun-facing.js' });

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
  '/assets/roulette/gun-facing.js?v=1',
  'rrLampCriticalHide',
  'MODULAR_LAMP_ASSETS_START',
  'MODULAR_LAMP_ASSETS_END'
]) {
  if (!injectorSource.includes(required)) throw new Error(`Build injector missing ${required}`);
}

for (const forbidden of [
  'turn-orientation',
  'gun-turn-animation',
  'gun-animation-test',
  'data-shot-revision'
]) {
  if (injectorSource.includes(forbidden)) throw new Error(`Build injector still contains an obsolete gun hook: ${forbidden}`);
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
  "const MOTION_SELECTOR = '.rr-gun-motion'",
  "const ROTOR_ATTRIBUTE = 'data-rr-gun-facing-rotor'",
  'ownerFromData',
  'ownerFromVisibleStatus',
  'findLowestCommonAncestor',
  'findGunRotor',
  'setFacing',
  'angleForOwner',
  'owner === OWNER_OPPONENT ? 180 : 0',
  "rotor.style.setProperty('rotate'",
  "rotor.style.setProperty('transform-origin', '50% 50%'",
  'facingAnimation = rotor.animate(',
  'duration: 720',
  'const ownerChanged = owner !== lastOwner',
  'if (!motionChanged && !rotorChanged && !ownerChanged) return',
  'Boolean(previousOwner && ownerChanged)',
  'gameObserver.observe(gameRoot',
  'pageObserver.observe(document.body || document.documentElement'
]) {
  if (!gunFacingSource.includes(required)) {
    throw new Error(`Clean gun-facing implementation missing ${required}`);
  }
}

for (const forbidden of [
  'getBoundingClientRect',
  'measureVisibleArtworkPivot',
  'rotationFromTransform',
  'cancelLegacyFlip',
  '--rr-turn-origin',
  'translate:',
  "style.setProperty('translate'",
  'transform-box',
  'setInterval(',
  'fetch(',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'sendBeacon',
  'playRecoil',
  'data-shot-revision',
  'lastShotNumber',
  'shotsFired',
  '/.netlify/functions/',
  'localStorage',
  'sessionStorage'
]) {
  if (gunFacingSource.includes(forbidden)) {
    throw new Error(`Gun facing must remain simple and state-neutral: ${forbidden}`);
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
await access(new URL('../assets/roulette/gun-facing.js', import.meta.url));

async function requireMissing(filePath) {
  try {
    await access(new URL(`../${filePath}`, import.meta.url));
    throw new Error(`Obsolete diagnostic or gun patch file still exists: ${filePath}`);
  } catch (error) {
    if (error.message === `Obsolete diagnostic or gun patch file still exists: ${filePath}`) throw error;
    if (error.code !== 'ENOENT') throw error;
  }
}

for (const filePath of [
  'assets/roulette/turn-orientation.js',
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

console.log(`Validation passed: ${keys.length}/${keys.length} lamp controls bound; one clean gun-facing animation rotates only the visible gun group.`);
