import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import clean01 from './mountain-race-v28-source/clean-01.mjs';
import clean02 from './mountain-race-v28-source/clean-02.mjs';
import clean03 from './mountain-race-v28-source/clean-03.mjs';
import clean04 from './mountain-race-v28-source/clean-04.mjs';
import clean05 from './mountain-race-v28-source/clean-05.mjs';
import clean06 from './mountain-race-v28-source/clean-06.mjs';
import clean07 from './mountain-race-v28-source/clean-07.mjs';
import clean08 from './mountain-race-v28-source/clean-08.mjs';
import clean09 from './mountain-race-v28-source/clean-09.mjs';
import clean10 from './mountain-race-v28-source/clean-10.mjs';
import clean11 from './mountain-race-v28-source/clean-11.mjs';
import clean12 from './mountain-race-v28-source/clean-12.mjs';
import clean13 from './mountain-race-v28-source/clean-13.mjs';
import clean14 from './mountain-race-v28-source/clean-14.mjs';
import clean15 from './mountain-race-v28-source/clean-15.mjs';
import clean16 from './mountain-race-v28-source/clean-16.mjs';
import clean17 from './mountain-race-v28-source/clean-17.mjs';
import clean18 from './mountain-race-v28-source/clean-18.mjs';
import clean19 from './mountain-race-v28-source/clean-19.mjs';

const rootUrl = new URL('../', import.meta.url);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', rootUrl);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', rootUrl);
const indexUrl = new URL('index.html', rootUrl);
const previewUrl = new URL('mountain-race-preview.html', rootUrl);
const imageDirUrl = new URL('assets/mountain-race/images/', rootUrl);
const sceneUrl = new URL('summit-sprint-reference-scene-v28.png', imageDirUrl);
const marker = 'MOUNTAIN_RACE_REFERENCE_SCENE_V28';
const expectedSha256 = '6321bb3278290497a29b02b29f97e414d0accc99ed49c2b3daae7efef01c3d54';
const chunks = [clean01, clean02, clean03, clean04, clean05, clean06, clean07, clean08, clean09, clean10, clean11, clean12, clean13, clean14, clean15, clean16, clean17, clean18, clean19];
const expectedChunkSha256 = [
  'd033465524959f98d1c95223d273500bf37bbf9b7b342c979aa254228f8e4e61',
  '1a73c05e40f1ef3096460f47ad497da4e252d6f2392f3080f99450a27464d34a',
  '6651636edd8e0c7491440eb068d8fcff3f42fa71aa5ff58fdba118926b5d0301',
  'b33f5099403a576b158d2775a6711732f00f7962c6c083633f5c48286bd4189f',
  '6af05ff3501a35abbeb08398e02062c0655b2cb4a09e36ba37046e19520ef715',
  'b8ea4b5769282f9bcb93f56c4c3afc780b98b046b7b1f65694ab052eed900e92',
  '5b64838f2bad7b5edddd3312b7bb0f28354a18ca9956b15c0279baa2ccfbf274',
  'd0b526021bf8d6bac88bd95b0197e2a857b0ba618ddec3e6ae252b42cc98df22',
  '402a4da975e7e06e7914dd28f3451d7cf06a7beabaf21e589284a8053b132dcd',
  '398df2453fbb3ace1eef88a3e326b674ad16d6f536a82d7884df74c6d59ee3d1',
  '3a6c174a4b4541f130584f0cce2a0fa4244e4ec11157c14a863f12b9a98c92a3',
  'e029abcd9d8ed983af09dc58c0a1a27a47427d3e8c6491285423a4a66219155d',
  '9822165cc7aa17af08603b5b5fb31b959dde23a810006493eb4718d388136a64',
  '7dc8111627c9b2cf20bac33c83d6cafde130570b42c6a595357570c475e8a4fb',
  '463ce2d2773cd45721e80767e8d5a1614138d021ad15e31e61834a3f873f2298',
  '9d272d778ed23ed8028ebcc8a41a6cac6a4094b092d5322fa7d18a90c1d1dd77',
  'ab372f9228452f8503d744da58606605dd42611edb4598b4cfe9a9dda976f078',
  'e371158407ff83787d67b5e8d44265c2b2f67fbd1134e25f3767a02826839b21',
  '3e835fbd8e686165ee70def40eff760242fd2909643db7473b9b654a657854d1'
];
for (let i = 0; i < chunks.length; i += 1) {
  const expectedLength = i === 18 ? 6096 : 12000;
  const chunkSha = createHash('sha256').update(chunks[i]).digest('hex');
  console.log(`Summit Sprint V28 source chunk ${String(i + 1).padStart(2, '0')}: ${chunks[i].length} chars, sha256 ${chunkSha}`);
  if (chunks[i].length !== expectedLength || chunkSha !== expectedChunkSha256[i]) {
    throw new Error(`Summit Sprint V28 source chunk ${i + 1} integrity mismatch; expected ${expectedLength} chars / ${expectedChunkSha256[i]}, got ${chunks[i].length} chars / ${chunkSha}.`);
  }
}

const scene = Buffer.from(chunks.join(''), 'base64');
if (scene.length < 50000 || scene.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
  throw new Error('Summit Sprint V28 reference scene source is not a valid PNG.');
}
const width = scene.readUInt32BE(16);
const height = scene.readUInt32BE(20);
if (width !== 360 || height !== 540) {
  throw new Error(`Summit Sprint V28 reference scene must be 360x540, got ${width}x${height}.`);
}
const sha256 = createHash('sha256').update(scene).digest('hex');
if (sha256 !== expectedSha256) {
  throw new Error(`Summit Sprint V28 source hash mismatch: expected ${expectedSha256}, got ${sha256}.`);
}

await mkdir(imageDirUrl, { recursive: true });
await writeFile(sceneUrl, scene);

let [css, runtime, html, preview] = await Promise.all([
  readFile(cssUrl, 'utf8'),
  readFile(runtimeUrl, 'utf8'),
  readFile(indexUrl, 'utf8'),
  readFile(previewUrl, 'utf8')
]);

if (!runtime.includes(marker)) {
  const anchor = "    root.dataset.mrProfessionalRebuild = '27';";
  if (!runtime.includes(anchor)) throw new Error('Summit Sprint V28 could not find the V27 runtime activation anchor.');
  runtime = runtime.replace(anchor, `${anchor}\n    // ${marker}\n    // The generated V28 reference scene is the visual substrate only. Gameplay,\n    // climbers, prompts, timers and multiplayer state remain live DOM layers.\n    root.dataset.mrReferenceScene = '28';`);
}

if (!css.includes(marker)) {
  css += String.raw`

/* MOUNTAIN_RACE_REFERENCE_SCENE_V28
   Generated reference-style scene restart. The photographic PNG is viewport art,
   not a logical 24-hold wall texture, so it is never stretched to the 1520px route.
   The authoritative wall continues moving invisibly above it while live climbers,
   direction prompts and HUD remain interactive. */
[data-mountain-race-mount][data-mr-reference-scene="28"] { background: #87b8cf !important; }
[data-mountain-race-mount][data-mr-reference-scene="28"] .mr-climb-viewport {
  background-color: #88b9d0 !important;
  background-image: url('/assets/mountain-race/images/summit-sprint-reference-scene-v28.png') !important;
  background-repeat: no-repeat !important;
  background-size: auto 100% !important;
  box-shadow: inset 0 0 34px rgba(5,16,20,.12) !important;
}
[data-mountain-race-mount][data-mr-reference-scene="28"] .mr-lane:first-child .mr-climb-viewport { background-position: left bottom !important; }
[data-mountain-race-mount][data-mr-reference-scene="28"] .mr-lane:last-child .mr-climb-viewport { background-position: right bottom !important; }
[data-mountain-race-mount][data-mr-reference-scene="28"] .mr-cliff-art,
[data-mountain-race-mount][data-mr-reference-scene="28"] .mr-start-art,
[data-mountain-race-mount][data-mr-reference-scene="28"] .mr-summit-art,
[data-mountain-race-mount][data-mr-reference-scene="28"] .mr-hold-art { display: none !important; }
[data-mountain-race-mount][data-mr-reference-scene="28"] .mr-mountain-wall { background: none !important; filter: none !important; box-shadow: none !important; }
[data-mountain-race-mount][data-mr-reference-scene="28"] .mr-mountain-wall::before,
[data-mountain-race-mount][data-mr-reference-scene="28"] .mr-mountain-wall::after,
[data-mountain-race-mount][data-mr-reference-scene="28"] .mr-lane::before,
[data-mountain-race-mount][data-mr-reference-scene="28"] .mr-lane::after { content: none !important; display: none !important; }
[data-mountain-race-mount][data-mr-reference-scene="28"] .mr-rock-hold { background: none !important; border: 0 !important; box-shadow: none !important; filter: none !important; }
[data-mountain-race-mount][data-mr-reference-scene="28"] .mr-rock-hold b {
  width: 28px !important; height: 28px !important; border-radius: 50% !important;
  border: 1px solid rgba(255,255,255,.48) !important; background: rgba(7,12,13,.78) !important;
  box-shadow: 0 3px 8px rgba(0,0,0,.42) !important; backdrop-filter: blur(2px) !important;
}
[data-mountain-race-mount][data-mr-reference-scene="28"] .mr-rock-hold.current b { box-shadow: 0 3px 8px rgba(0,0,0,.42), 0 0 0 2px rgba(232,185,73,.48) !important; }
[data-mountain-race-mount][data-mr-reference-scene="28"] .mr-climber { z-index: 18 !important; filter: drop-shadow(0 7px 5px rgba(0,0,0,.42)) !important; }
@media (min-width: 521px) {
  [data-mountain-race-mount][data-mr-reference-scene="28"] .mr-climb-viewport { background-size: 200% auto !important; background-position-y: bottom !important; }
}
`;
}

const cache28 = source => source.replace(/(mountain-race\.css\?[^"'\s>]*?)(?:&?visual=\d+)?(["'\s>])/g, (_m, base, end) => {
  const clean = base.replace(/&?visual=\d+/g, '');
  return `${clean}${clean.includes('?') ? '&' : '?'}visual=28${end}`;
});
html = cache28(html);
preview = cache28(preview);

if (!runtime.includes(marker) || !runtime.includes("root.dataset.mrReferenceScene = '28';")) throw new Error('Summit Sprint V28 runtime activation is missing.');
if (!css.includes(marker) || !css.includes('summit-sprint-reference-scene-v28.png')) throw new Error('Summit Sprint V28 CSS activation is missing.');
if (!html.includes('visual=28') || !preview.includes('visual=28')) throw new Error('Summit Sprint V28 cache boundary is missing.');

await Promise.all([writeFile(cssUrl, css), writeFile(runtimeUrl, runtime), writeFile(indexUrl, html), writeFile(previewUrl, preview)]);
console.log(`Applied Summit Sprint V28 generated reference scene (${width}x${height}, ${scene.length} bytes, sha256 ${sha256}).`);
