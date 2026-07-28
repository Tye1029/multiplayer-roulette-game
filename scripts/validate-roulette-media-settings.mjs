import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [
  html, audio, settings, settingsCss, bootstrap, config, injector, turnAnimation, turnFire
] = await Promise.all([
  read('index.html'),
  read('assets/roulette/audio-manager.js'),
  read('assets/roulette/atmosphere-settings.js'),
  read('assets/roulette/atmosphere-settings.css'),
  read('assets/roulette/lamp-bootstrap.js'),
  read('assets/roulette/lamp-config.js'),
  read('scripts/inject-lamp-assets.mjs'),
  read('assets/roulette/turn-animation.js'),
  read('assets/roulette/turn-fire.js')
]);

for (const [name, source] of [
  ['audio-manager.js', audio],
  ['atmosphere-settings.js', settings],
  ['lamp-bootstrap.js', bootstrap]
]) new vm.Script(source, { filename: name });

for (const required of [
  "const LOOP_FILES = new Set(['room', 'hum', 'heartbeat', 'rumble'])",
  'function createWebAudioLoop(name)',
  '__rrWebAudioLoop: true',
  'sourceNode = context.createBufferSource();',
  'sourceNode.loop = true;',
  'function suppressBrowserMediaControls()',
  'mediaSession.metadata = null',
  "mediaSession.playbackState = 'none'",
  "document.addEventListener('play', suppressBrowserMediaControls, true)",
  'const audio = createWebAudioLoop(name);'
]) {
  if (!audio.includes(required)) throw new Error(`Media-safe ambience is missing ${required}`);
}

const startLoop = audio.slice(audio.indexOf('function startLoop(name)'), audio.indexOf('function stopLoop(name)'));
if (startLoop.includes('template(name).cloneNode(true)')) {
  throw new Error('Persistent ambience still uses an HTML media element and can create Chrome media controls.');
}

for (const required of [
  "const atmosphereKey = 'rrAtmosphereSettingsV1'",
  "const collapsedKey = 'rrAtmosphereSettingsCollapsedV1'",
  "['lamp', 'strength', 'Light brightness'",
  "['smoke', 'smokeDensity', 'Smoke density'",
  "global.dispatchEvent(new CustomEvent('rr-lamp-config-change'",
  "panel?.classList.remove('is-collapsed')",
  "--rr-smoke-density",
  "--rr-smoke-light",
  "--rr-smoke-blur",
  "--rr-smoke-speed"
]) {
  const source = required.startsWith('--rr-') ? settingsCss : settings;
  if (!source.includes(required)) throw new Error(`Atmosphere settings are missing ${required}`);
}

for (const required of [
  'opacity:calc(var(--rr-smoke-density) * .60)!important;',
  'opacity:calc(var(--rr-smoke-light) * .62)!important;',
  'rgba(205,210,212,.25)',
  'z-index:5!important;',
  '.rr-atmosphere-settings.is-collapsed'
]) {
  if (!settingsCss.includes(required)) throw new Error(`Visible adjustable smoke styling is missing ${required}`);
}

for (const required of [
  "window.addEventListener('rr-lamp-config-change'",
  'window.RouletteLampBootstrap = Object.freeze({',
  'apply(nextConfig) { applyConfig(nextConfig); }'
]) {
  if (!bootstrap.includes(required)) throw new Error(`Live lamp settings bridge is missing ${required}`);
}

for (const required of [
  "import './patch-roulette-media-settings.mjs';",
  '/assets/roulette/atmosphere-settings.css?v=1',
  '/assets/roulette/lamp-bootstrap.js?v=19&settings=1',
  '/assets/roulette/atmosphere-settings.js?v=1',
  '/assets/roulette/audio-manager.js?v=4&ambience=2&countdown=2&audible=3&media=1'
]) {
  if (!injector.includes(required) || !html.includes(required.replace("import './patch-roulette-media-settings.mjs';", '/assets/roulette/atmosphere-settings.css?v=1'))) {
    if (required.startsWith('import ')) {
      if (!injector.includes(required)) throw new Error(`Build pipeline is missing ${required}`);
    } else {
      throw new Error(`Built page or injector is missing ${required}`);
    }
  }
}

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(config, sandbox, { filename: 'lamp-config.js' });
if (Object.keys(sandbox.window.RouletteLampConfig?.bindings || {}).length !== 25) {
  throw new Error('The original 25 lamp calibration controls were not preserved.');
}

function gitBlobSha(source) {
  const bytes = Buffer.from(source, 'utf8');
  return createHash('sha1')
    .update(Buffer.from(`blob ${bytes.length}\0`, 'utf8'))
    .update(bytes)
    .digest('hex');
}

for (const [name, expected, source] of [
  ['turn-animation.js', '24358e84c147d99e7297089e69ed1abd0802379f', turnAnimation],
  ['turn-fire.js', '940e824eae39ddc40dda6200f893f97fc365949b', turnFire]
]) {
  const actual = gitBlobSha(source);
  if (actual !== expected) throw new Error(`${name} hash changed: ${actual}`);
}

console.log('Media/settings validation passed: persistent ambience uses Web Audio without Chrome media controls, smoke is visible and adjustable, the panel collapses, and all 25 lamp calibration controls plus protected gun files remain intact.');
