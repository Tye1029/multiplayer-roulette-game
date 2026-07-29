import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [
  html,
  audio,
  smoke,
  smokeCss,
  config,
  injector,
  edge,
  turnAnimation,
  turnFire
] = await Promise.all([
  read('index.html'),
  read('assets/roulette/audio-manager.js'),
  read('assets/roulette/smoke.js'),
  read('assets/roulette/smoke.css'),
  read('assets/roulette/lamp-config.js'),
  read('scripts/inject-lamp-assets.mjs'),
  read('netlify/edge-functions/inject-roulette-settings.js'),
  read('assets/roulette/turn-animation.js'),
  read('assets/roulette/turn-fire.js')
]);

for (const [name, source] of [
  ['audio-manager.js', audio],
  ['smoke.js', smoke],
  ['edge smoke injector', edge]
]) new vm.Script(source.replace(/^export default /m, '').replace(/^export const config[\s\S]*$/m, ''), { filename: name });

for (const required of [
  "const LOOP_FILES = new Set(['room', 'hum', 'heartbeat', 'rumble'])",
  'function createWebAudioLoop(name)',
  '__rrWebAudioLoop: true',
  'sourceNode = context.createBufferSource();',
  'function suppressBrowserMediaControls()',
  'mediaSession.metadata = null',
  "mediaSession.playbackState = 'none'",
  'const audio = createWebAudioLoop(name);'
]) {
  if (!audio.includes(required)) throw new Error(`Media-safe ambience is missing ${required}`);
}

for (const required of [
  'global.__rrPermanentSmokeV1 = true',
  "document.querySelectorAll('[data-roulette-game]')",
  "ensureLayer(smoke, 'rr-smoke-ambient')",
  "ensureLayer(smoke, 'rr-smoke-lit')",
  'synchronizeLitSmoke(lit, readLampConfig())',
  'animation.currentTime = Math.max(0, Date.now() - phaseEpoch)',
  "observer.observe(document.body || document.documentElement, { childList: true, subtree: true })"
]) {
  if (!smoke.includes(required)) throw new Error(`Permanent smoke runtime is missing ${required}`);
}

for (const required of [
  '[data-roulette-game] .rr-smoke {',
  'opacity: .72 !important;',
  'opacity: .78 !important;',
  'rgba(216, 220, 221, .32)',
  'rgba(255, 242, 207, .48)',
  '@keyframes rrPermanentSmokeDrift',
  'mix-blend-mode: screen !important;'
]) {
  if (!smokeCss.includes(required)) throw new Error(`Visible smoke styling is missing ${required}`);
}

const smokeAssets = [
  '/assets/roulette/smoke.css?v=2',
  '/assets/roulette/smoke.js?v=2'
];
for (const asset of smokeAssets) {
  if (!injector.includes(asset)) throw new Error(`Asset injector is missing ${asset}`);
}
if (!injector.includes('const lateSmokeLink =')) {
  throw new Error('The smoke stylesheet is not forced after the legacy inline scene styles.');
}
if (injector.includes('/assets/roulette/atmosphere-settings.js') || injector.includes('rrAtmosphereSettingsStyles')) {
  throw new Error('The abandoned Scene Settings menu is still injected into the Roulette page.');
}

for (const required of [
  '<!-- rr-edge-permanent-smoke-v2 -->',
  '/assets/roulette/smoke.css?v=2',
  '/assets/roulette/smoke.js?v=2',
  "headers.set('cache-control', 'no-store, no-cache, must-revalidate')"
]) {
  if (!edge.includes(required)) throw new Error(`Edge smoke fallback is missing ${required}`);
}
if (edge.includes('Scene Settings') || edge.includes('atmosphere-settings')) {
  throw new Error('The edge fallback still injects the abandoned settings menu.');
}

for (const asset of smokeAssets) {
  if (!html.includes(asset)) throw new Error(`Built page is missing ${asset}`);
}

const smokeLinkIndex = html.lastIndexOf('/assets/roulette/smoke.css?v=2');
const legacySmokeIndex = html.lastIndexOf('.rr-smoke{\n  animation:rrV90AmbientSmoke');
if (smokeLinkIndex < 0 || (legacySmokeIndex >= 0 && smokeLinkIndex <= legacySmokeIndex)) {
  throw new Error('The permanent smoke stylesheet does not load after the legacy 30% opacity rule.');
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

console.log('Media/smoke validation passed: the settings menu is removed, full-strength smoke mounts in every Roulette scene after legacy styles, its warm layer follows the lamp phase, ambience avoids Chrome media controls, and protected gun files remain intact.');
