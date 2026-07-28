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

const startLoopStart = audio.indexOf('function startLoop(name)');
const startLoopEnd = audio.indexOf('function stopLoop(name)', startLoopStart);
if (startLoopStart < 0 || startLoopEnd < 0) throw new Error('The ambience loop implementation cannot be inspected.');
const startLoop = audio.slice(startLoopStart, startLoopEnd);
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
  "root.style.setProperty('--rr-smoke-ambient-opacity'",
  "root.style.setProperty('--rr-smoke-lit-opacity'",
  "root.style.setProperty('--rr-smoke-blur'",
  "root.style.setProperty('--rr-smoke-speed'",
  "element.className = 'rr-atmosphere-settings rr-atmosphere-portal'",
  "toggle.textContent = '⚙ Scene Settings'",
  'document.body.append(element);',
  'panel.parentElement === document.body',
  'function rouletteScreenIsVisible()',
  "selectedMode === 'roulette'",
  "event.target?.id === 'duelModeSelect'",
  "attributeFilter: ['hidden']"
]) {
  if (!settings.includes(required)) throw new Error(`Atmosphere settings are missing ${required}`);
}

for (const required of [
  '.rr-atmosphere-settings{',
  'position:fixed!important;',
  'z-index:2147483000!important;',
  '.rr-atmosphere-settings.is-collapsed',
  '.rr-atmosphere-row input[type="range"]',
  '[data-roulette-game] .rr-smoke-ambient',
  '[data-roulette-game] .rr-smoke-lit',
  'rgba(205,210,212,.25)',
  'z-index:5!important;'
]) {
  if (!settingsCss.includes(required)) throw new Error(`Viewport settings panel or visible smoke styling is missing ${required}`);
}

for (const required of [
  "window.addEventListener('rr-lamp-config-change'",
  'window.RouletteLampBootstrap = Object.freeze({',
  'apply(nextConfig) { applyConfig(nextConfig); }'
]) {
  if (!bootstrap.includes(required)) throw new Error(`Live lamp settings bridge is missing ${required}`);
}

for (const required of [
  '<style id="rr-v153-adjustable-smoke-priority">',
  'opacity:var(--rr-smoke-ambient-opacity,.63)!important;',
  'opacity:var(--rr-smoke-lit-opacity,.69)!important;'
]) {
  if (!html.includes(required)) throw new Error(`The final adjustable smoke override is missing ${required}`);
}

const assetOrder = [
  '/assets/roulette/lamp-config.js?v=19',
  '/assets/roulette/lamp.js?v=20&smoke=1',
  '/assets/roulette/lamp-bootstrap.js?v=19&settings=2',
  '/assets/roulette/atmosphere-settings.js?v=4',
  '/assets/roulette/audio-manager.js?v=4&ambience=2&countdown=2&audible=3&media=2'
];
for (const asset of [
  '/assets/roulette/atmosphere-settings.css?v=3',
  ...assetOrder
]) {
  if (!injector.includes(asset)) throw new Error(`Asset injector is missing ${asset}`);
  if (!html.includes(asset)) throw new Error(`Built page is missing ${asset}`);
}
const indexes = assetOrder.map(asset => injector.indexOf(asset));
if (indexes.some(index => index < 0) || indexes.some((index, position) => position > 0 && index <= indexes[position - 1])) {
  throw new Error('Lamp, pregame viewport settings, and media-safe ambience assets are not loaded in the required order.');
}
if (!injector.includes("import './patch-roulette-media-settings.mjs';")) {
  throw new Error('The media-safe ambience build patch is not connected.');
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

console.log('Media/settings validation passed: ambience avoids Chrome media controls, the scene settings tab is viewport-mounted and visible before Roulette starts, smoke is adjustable, and all 25 calibration controls plus protected gun files remain intact.');
