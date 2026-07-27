import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [configSource, runtimeSource, calibrationSource, bootstrapSource, injectorSource, htmlSource, cssSource] = await Promise.all([
  read('assets/roulette/lamp-config.js'),
  read('assets/roulette/lamp.js'),
  read('assets/roulette/lamp-calibration.js'),
  read('assets/roulette/lamp-bootstrap.js'),
  read('scripts/inject-lamp-assets.mjs'),
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
  '/assets/roulette/lamp-config.js?v=12',
  '/assets/roulette/lamp.js?v=12',
  '/assets/roulette/lamp-calibration.js?v=12',
  '/assets/roulette/lamp-calibration.css?v=12'
]) {
  if (!htmlSource.includes(required)) throw new Error(`Calibration HTML missing ${required}`);
}

for (const required of [
  '/assets/roulette/lamp-config.js?v=12',
  '/assets/roulette/lamp.js?v=12',
  '/assets/roulette/lamp-bootstrap.js?v=12',
  'MODULAR_LAMP_ASSETS_START',
  'MODULAR_LAMP_ASSETS_END'
]) {
  if (!injectorSource.includes(required)) throw new Error(`Build injector missing ${required}`);
}

for (const required of [
  'rrLampVisualOverlayRoot',
  'rrLampTrackedLight',
  'rrRoomDarknessOverlay',
  'rrGunGlintOverlay',
  '--rr-chain-left-length',
  '--rr-chain-right-length',
  'rrLampLightTrackExternal',
  'rrLampSwingExternal'
]) {
  if (!runtimeSource.includes(required) && !cssSource.includes(required)) {
    throw new Error(`Lamp implementation missing ${required}`);
  }
}

if (htmlSource.includes('function apply(') || htmlSource.includes('const groups=')) {
  throw new Error('Calibration HTML still contains embedded lamp implementation');
}
if (!runtimeSource.includes('/assets/roulette/decor/lamp-1.png')) {
  throw new Error('Runtime is not using lamp-1.png');
}
if (!runtimeSource.includes("styleAsset = '/assets/roulette/lamp.css?v=12'")) {
  throw new Error('Runtime lamp stylesheet cache version is out of sync');
}
if (!cssSource.includes('width: var(--rr-lamp-width, 56%)')) {
  throw new Error('Lamp CSS does not preserve the larger 56% fallback width');
}
if (runtimeSource.includes('MutationObserver')) {
  throw new Error('Lamp runtime must not observe gameplay DOM mutations');
}
for (const forbidden of [
  'scene.table.style.setProperty',
  'scene.table.append',
  'scene.gun.append',
  "scene.gun, 'filter'",
  "target,\n        'filter'"
]) {
  if (runtimeSource.includes(forbidden)) throw new Error(`Lamp runtime still touches gameplay visuals: ${forbidden}`);
}
if (!runtimeSource.includes('(doc.body || doc.documentElement).append(root)')) {
  throw new Error('Visual overlays are not isolated outside the game-managed DOM');
}
if (!runtimeSource.includes('setInterval(run, 750)')) {
  throw new Error('Lamp visual sync is not using the low-frequency safe interval');
}
if (!calibrationSource.includes('lampApi.watch')) {
  throw new Error('Calibration controller is not watching dynamic game mounts');
}
if (!bootstrapSource.includes("params.has('lampCalibration')") || !bootstrapSource.includes('lampApi.watch')) {
  throw new Error('Normal-page bootstrap is not isolated from calibration mode');
}

console.log(`Lamp validation passed: ${keys.length}/${keys.length} controls bound; gameplay DOM isolation and safe visual sync verified.`);
