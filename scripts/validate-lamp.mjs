import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [
  configSource,
  runtimeSource,
  calibrationSource,
  bootstrapSource,
  injectorSource,
  htmlSource,
  cssSource
] = await Promise.all([
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
if (keys.length !== 20) throw new Error(`Expected 20 controls, found ${keys.length}`);

for (const key of keys) {
  if (!Object.hasOwn(api.defaults, key)) throw new Error(`Missing default for ${key}`);
  if (!runtimeSource.includes(`${key}:`) && !runtimeSource.includes(`cfg.${key}`)) {
    throw new Error(`Runtime does not bind ${key}`);
  }
}

for (const required of [
  '/assets/roulette/lamp-config.js?v=10',
  '/assets/roulette/lamp.js?v=10',
  '/assets/roulette/lamp-calibration.js?v=10',
  '/assets/roulette/lamp-calibration.css?v=10'
]) {
  if (!htmlSource.includes(required)) throw new Error(`Calibration HTML missing ${required}`);
}

for (const required of [
  '/assets/roulette/lamp-config.js?v=10',
  '/assets/roulette/lamp.js?v=10',
  '/assets/roulette/lamp-bootstrap.js?v=10',
  'MODULAR_LAMP_ASSETS_START',
  'MODULAR_LAMP_ASSETS_END'
]) {
  if (!injectorSource.includes(required)) throw new Error(`Build injector missing ${required}`);
}

if (htmlSource.includes('function apply(') || htmlSource.includes('const groups=')) {
  throw new Error('Calibration HTML still contains embedded lamp implementation');
}
if (!runtimeSource.includes('/assets/roulette/decor/lamp-1.png')) {
  throw new Error('Runtime is not using lamp-1.png');
}
if (!runtimeSource.includes("styleAsset = '/assets/roulette/lamp.css?v=10'")) {
  throw new Error('Runtime lamp stylesheet cache version is out of sync');
}
if (!cssSource.includes('width: var(--rr-lamp-width, 56%)')) {
  throw new Error('Lamp CSS does not preserve the larger 56% default width');
}
if (cssSource.includes('var(--rr-lamp-glow, .82) *')) {
  throw new Error('Lamp CSS contains an unsupported multiplication expression');
}
if (!calibrationSource.includes('lampApi.watch')) {
  throw new Error('Calibration controller is not watching dynamic game mounts');
}
if (!bootstrapSource.includes("params.has('lampCalibration')") || !bootstrapSource.includes('lampApi.watch')) {
  throw new Error('Normal-page bootstrap is not isolated from calibration mode');
}

console.log(`Lamp validation passed: ${keys.length}/${keys.length} controls bound; modular bootstrap verified.`);
