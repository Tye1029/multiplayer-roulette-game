import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [configSource, runtimeSource, calibrationSource, htmlSource, cssSource] = await Promise.all([
  read('assets/roulette/lamp-config.js'),
  read('assets/roulette/lamp.js'),
  read('assets/roulette/lamp-calibration.js'),
  read('lamp-calibration.html'),
  read('assets/roulette/lamp.css')
]);

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(configSource, sandbox, { filename: 'lamp-config.js' });
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
  '/assets/roulette/lamp-config.js?v=9',
  '/assets/roulette/lamp.js?v=9',
  '/assets/roulette/lamp-calibration.js?v=9',
  '/assets/roulette/lamp-calibration.css?v=9'
]) {
  if (!htmlSource.includes(required)) throw new Error(`Calibration HTML missing ${required}`);
}

if (htmlSource.includes('function apply(') || htmlSource.includes('const groups=')) {
  throw new Error('Calibration HTML still contains embedded lamp implementation');
}

if (!runtimeSource.includes('/assets/roulette/decor/lamp-1.png')) {
  throw new Error('Runtime is not using lamp-1.png');
}
if (!cssSource.includes('width: var(--rr-lamp-width, 56%)')) {
  throw new Error('Lamp CSS does not preserve the larger 56% default width');
}
if (!calibrationSource.includes('lampApi.watch')) {
  throw new Error('Calibration controller is not watching dynamic game mounts');
}

console.log(`Lamp validation passed: ${keys.length}/${keys.length} controls bound.`);
