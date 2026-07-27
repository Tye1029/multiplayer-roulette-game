import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const read = filePath => readFile(new URL(`../${filePath}`, import.meta.url), 'utf8');
const [
  configSource,
  runtimeSource,
  calibrationSource,
  bootstrapSource,
  injectorSource,
  cleanupSource,
  packageSource,
  htmlSource,
  cssSource
] = await Promise.all([
  read('assets/roulette/lamp-config.js'),
  read('assets/roulette/lamp.js'),
  read('assets/roulette/lamp-calibration.js'),
  read('assets/roulette/lamp-bootstrap.js'),
  read('scripts/inject-lamp-assets.mjs'),
  read('scripts/clean-legacy-lamp-assets.mjs'),
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
new vm.Script(injectorSource, { filename: 'inject-lamp-assets.mjs' });
new vm.Script(cleanupSource, { filename: 'clean-legacy-lamp-assets.mjs' });

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
  '/assets/roulette/lamp-config.js?v=13',
  '/assets/roulette/lamp.js?v=13',
  '/assets/roulette/lamp-calibration.js?v=13',
  '/assets/roulette/lamp-calibration.css?v=13'
]) {
  if (!htmlSource.includes(required)) throw new Error(`Calibration HTML missing ${required}`);
}

for (const required of [
  '/assets/roulette/lamp-config.js?v=13',
  '/assets/roulette/lamp.js?v=13',
  '/assets/roulette/lamp-bootstrap.js?v=13',
  'rrLampCriticalHide',
  'data-rr-lamp-ready',
  'MODULAR_LAMP_ASSETS_START',
  'MODULAR_LAMP_ASSETS_END'
]) {
  if (!injectorSource.includes(required)) throw new Error(`Build injector missing ${required}`);
}

for (const required of [
  'rrLampVisualOverlayRoot',
  'rrGunGlintOverlay',
  '--rr-chain-left-length',
  '--rr-chain-right-length',
  'rrLampLightTrackExternal',
  'rrLampSwingExternal',
  'scene.legacyLight',
  'removeStaleOverlays',
  "styleAsset = '/assets/roulette/lamp.css?v=13'"
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
if (!cssSource.includes('width: var(--rr-lamp-width, 56%)')) {
  throw new Error('Lamp CSS does not preserve the larger 56% fallback width');
}
if (!cssSource.includes('.rr130-table-illumination')) {
  throw new Error('The built-in scene light is not used');
}
if (!cssSource.includes('#rrLampTrackedLight,') || !cssSource.includes('#rrRoomDarknessOverlay')) {
  throw new Error('Stale overlay blockers are missing');
}
if (cssSource.includes('mix-blend-mode: multiply')) {
  throw new Error('Room darkness still uses the bar-prone multiply overlay');
}
if (runtimeSource.includes('MutationObserver')) {
  throw new Error('Lamp runtime must not observe gameplay DOM mutations');
}
for (const forbidden of [
  'scene.table.style.setProperty',
  'scene.table.append',
  'scene.gun.append',
  'syncOverlayRect(trackedLight',
  'syncOverlayRect(roomOverlay',
  'ensureOverlay(doc, overlayRoot, trackedLightId)',
  'ensureOverlay(doc, overlayRoot, roomOverlayId)'
]) {
  if (runtimeSource.includes(forbidden)) throw new Error(`Lamp runtime still uses a duplicate gameplay overlay: ${forbidden}`);
}
if (!runtimeSource.includes('setInterval(run, 1000)')) {
  throw new Error('Lamp visual sync is not using the safe one-second interval');
}
if (!calibrationSource.includes('lampApi.watch')) {
  throw new Error('Calibration controller is not watching dynamic game mounts');
}
if (!bootstrapSource.includes("params.has('lampCalibration')") || !bootstrapSource.includes('lampApi.watch')) {
  throw new Error('Normal-page bootstrap is not isolated from calibration mode');
}
if (!cleanupSource.includes("path.join('decor', 'lamp-1.png')") || !cleanupSource.includes('await rm(')) {
  throw new Error('Legacy lamp asset cleanup is incomplete');
}

const packageJson = JSON.parse(packageSource);
const buildCommand = packageJson.scripts?.build || '';
if (!buildCommand.startsWith('npm run clean:lamp && node scripts/inject-lamp-assets.mjs')) {
  throw new Error('Netlify build does not clean stale lamp files before injection');
}

const rouletteDir = fileURLToPath(new URL('../assets/roulette/', import.meta.url));
const allowedLampFiles = new Set([
  'lamp-config.js',
  'lamp.js',
  'lamp-bootstrap.js',
  'lamp-calibration.js',
  'lamp.css',
  'lamp-calibration.css',
  'decor/lamp-1.png'
]);
const foundLampFiles = [];

async function collect(directory, relative = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relativePath = path.join(relative, entry.name);
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await collect(absolutePath, relativePath);
    } else if (entry.name.toLowerCase().includes('lamp')) {
      foundLampFiles.push(relativePath.split(path.sep).join('/'));
    }
  }
}

await collect(rouletteDir);
for (const filePath of foundLampFiles) {
  if (!allowedLampFiles.has(filePath)) throw new Error(`Stale lamp deploy file remains: ${filePath}`);
}
if (!foundLampFiles.includes('decor/lamp-1.png')) {
  throw new Error('The approved lamp-1.png asset is missing');
}

console.log(`Lamp validation passed: ${keys.length}/${keys.length} controls bound; one lamp asset, no duplicate light overlays, and no first-paint legacy flash.`);
