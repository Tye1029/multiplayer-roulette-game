import { readFile, stat } from 'node:fs/promises';

const rootUrl = new URL('../', import.meta.url);
const sceneUrl = new URL('assets/mountain-race/images/summit-sprint-reference-scene-v28.png', rootUrl);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', rootUrl);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', rootUrl);
const indexUrl = new URL('index.html', rootUrl);
const previewUrl = new URL('mountain-race-preview.html', rootUrl);
const marker = 'MOUNTAIN_RACE_REFERENCE_SCENE_V28';

const [scene, css, runtime, html, preview, info] = await Promise.all([
  readFile(sceneUrl),
  readFile(cssUrl, 'utf8'),
  readFile(runtimeUrl, 'utf8'),
  readFile(indexUrl, 'utf8'),
  readFile(previewUrl, 'utf8'),
  stat(sceneUrl)
]);

const fail = message => { throw new Error(`Summit Sprint V28 validation failed: ${message}`); };
if (scene.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') fail('reference scene is not a PNG');
if (scene.readUInt32BE(16) !== 360 || scene.readUInt32BE(20) !== 540) fail('reference scene dimensions are not 360x540');
if (info.size < 50000) fail(`reference scene is unexpectedly small (${info.size} bytes)`);
if (!runtime.includes(marker)) fail('runtime marker missing');
if (!runtime.includes("root.dataset.mrReferenceScene = '28';")) fail('runtime V28 dataset missing');
if (!css.includes(marker)) fail('CSS marker missing');
if (!css.includes("url('/assets/mountain-race/images/summit-sprint-reference-scene-v28.png')")) fail('scene PNG is not mounted');
if (!css.includes('background-repeat: no-repeat !important')) fail('scene no-repeat protection missing');
if (!css.includes('.mr-cliff-art') || !css.includes('.mr-start-art') || !css.includes('.mr-summit-art') || !css.includes('.mr-hold-art')) fail('V27 art retirement selectors missing');
if (!css.includes('display: none !important')) fail('old generated art is not retired under V28');
if (!html.includes('visual=28') || !preview.includes('visual=28')) fail('V28 cache boundary missing');

// Gameplay stays authoritative and untouched by the V28 presentation layer.
for (const token of ['renderHolds', 'promptIndex', 'mr-climber', 'mr-rock-hold']) {
  if (!runtime.includes(token)) fail(`gameplay/presentation invariant missing: ${token}`);
}

console.log(`Validated Summit Sprint V28 reference scene PNG (${info.size} bytes) and live overlay invariants.`);
