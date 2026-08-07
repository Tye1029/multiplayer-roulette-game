import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const rootUrl = new URL('../', import.meta.url);
const css = await readFile(new URL('assets/mountain-race/mountain-race.css', rootUrl), 'utf8');
const runtime = await readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', rootUrl), 'utf8');
const html = await readFile(new URL('index.html', rootUrl), 'utf8');
const preview = await readFile(new URL('mountain-race-preview.html', rootUrl), 'utf8');
const marker = 'MOUNTAIN_RACE_GENERATED_ASSETS_V29';
const sha256 = value => createHash('sha256').update(value).digest('hex');

const expectedAssets = [
  ['summit-sprint-generated-scene-v29.png', 360, 540, 96431, '5d9621443bad461ee4980155895641da7dcc5b50b268509b3c2cedd24ef619aa'],
  ['summit-sprint-hold-1-v29.png', 200, 130, 5216, '56c2101bad3cfd248a91954bfe3c75a568dc0275cb21ac86b7ac5549539fa9f7'],
  ['summit-sprint-hold-2-v29.png', 200, 130, 4428, 'cafdac5029e86f6802f8dfe5980ac7445ea484009fe08cbba81fec987957bc0d'],
  ['summit-sprint-hold-3-v29.png', 200, 130, 4181, 'ffe0dbefe5e27f34bcd7d397e0a40c5e52fd988cdc98bd5cff6d0c59b387bf2f']
];

for (const [name, width, height, length, hash] of expectedAssets) {
  const bytes = await readFile(new URL(`assets/mountain-race/images/${name}`, rootUrl));
  if (bytes.length !== length) throw new Error(`${name} byte length mismatch: ${bytes.length}.`);
  if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error(`${name} is not PNG.`);
  if (bytes.readUInt32BE(16) !== width || bytes.readUInt32BE(20) !== height) throw new Error(`${name} dimensions are wrong.`);
  if (sha256(bytes) !== hash) throw new Error(`${name} SHA mismatch.`);
}

for (const token of [
  marker,
  '[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-race-stage',
  'summit-sprint-generated-scene-v29.png',
  'background-size: contain !important;',
  '[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-hold-art'
]) {
  if (!css.includes(token)) throw new Error(`V29 CSS token missing: ${token}`);
}
if (!runtime.includes(marker) || !runtime.includes("root.dataset.mrGeneratedAssets = '29';")) throw new Error('V29 runtime activation missing.');
if (!runtime.includes('summit-sprint-hold-${(index % 3) + 1}-v29.png')) throw new Error('V29 generated hold mapping missing.');
if (!runtime.includes('const total = Math.max(8, Math.min(80, Math.trunc(Number(publicState.stepsTotal) || 24)))')) throw new Error('Authoritative race hold-count logic changed unexpectedly.');
if (!runtime.includes('wrong inputs cost one hold') && !runtime.includes('Wrong inputs cost one hold')) throw new Error('Wrong-input gameplay behavior copy missing.');
if (!html.includes('visual=29') || !preview.includes('visual=29')) throw new Error('V29 cache boundary missing.');
if (css.includes('data-mr-generated-assets="29"] .mr-race-stage {\n  background-repeat: repeat')) throw new Error('V29 scene must not repeat.');

console.log('Validated Summit Sprint V29 exact generated PNGs, preserved scene proportions, live ledge sprites, and gameplay invariants.');
