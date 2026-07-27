import { access, readFile } from 'node:fs/promises';
import vm from 'node:vm';

const read = filePath => readFile(new URL(`../${filePath}`, import.meta.url), 'utf8');
const [
  configSource,
  runtimeSource,
  calibrationSource,
  bootstrapSource,
  injectorSource,
  packageSource,
  htmlSource,
  cssSource
] = await Promise.all([
  read('assets/roulette/lamp-config.js'),
  read('assets/roulette/lamp.js'),
  read('assets/roulette/lamp-calibration.js'),
  read('assets/roulette/lamp-bootstrap.js'),
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
  '/assets/roulette/lamp-config.js?v=14',
  '/assets/roulette/lamp.js?v=14',
  '/assets/roulette/lamp-calibration.js?v=14',
  '/assets/roulette/lamp-calibration.css?v=14'
]) {
  if (!htmlSource.includes(required)) throw new Error(`Calibration HTML missing ${required}`);
}

for (const required of [
  '/assets/roulette/lamp-config.js?v=14',
  '/assets/roulette/lamp.js?v=14',
  '/assets/roulette/lamp-bootstrap.js?v=14',
  'rrLampCriticalHide',
  'data-rr-lamp-ready',
  'MODULAR_LAMP_ASSETS_START',
  'MODULAR_LAMP_ASSETS_END'
]) {
  if (!injectorSource.includes(required)) throw new Error(`Build injector missing ${required}`);
}

for (const required of [
  '/assets/roulette/decor/lamp-1.png',
  "styleAsset = '/assets/roulette/lamp.css?v=14'",
  'applyLightingVariables',
  '--rr-cal-light-background',
  '--rr-light-track-duration',
  'cfg.gunGleam <= 0.05',
  'removeStaleOverlays',
  'setInterval(run, 1000)'
]) {
  if (!runtimeSource.includes(required)) throw new Error(`Lamp runtime missing ${required}`);
}

for (const required of [
  'background: var(--rr-cal-light-background',
  'animation-duration: var(--rr-light-track-duration',
  'transition: none !important',
  'animation: none !important',
  '#rrLampTrackedLight',
  '#rrRoomDarknessOverlay'
]) {
  if (!cssSource.includes(required)) throw new Error(`Lamp CSS missing ${required}`);
}

if (runtimeSource.includes('MutationObserver')) {
  throw new Error('Lamp runtime must not observe gameplay DOM mutations');
}
for (const forbidden of [
  "scene.sceneLight,\n        'background'",
  "scene.sceneLight, 'background'",
  'scene.gun.append',
  'scene.table.append',
  'scene.gun.style.setProperty',
  'scene.table.style.setProperty'
]) {
  if (runtimeSource.includes(forbidden)) throw new Error(`Lamp runtime still interferes with gameplay: ${forbidden}`);
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
  throw new Error('Calibration controller is not watching dynamic game mounts');
}
if (!bootstrapSource.includes("params.has('lampCalibration')") || !bootstrapSource.includes('lampApi.watch')) {
  throw new Error('Normal-page bootstrap is not isolated from calibration mode');
}

console.log(`Lamp validation passed: ${keys.length}/${keys.length} controls bound; saved lighting is deterministic and builds do not delete gameplay assets.`);
