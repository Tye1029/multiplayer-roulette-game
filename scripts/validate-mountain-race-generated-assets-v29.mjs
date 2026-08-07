import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';

const rootUrl = new URL('../', import.meta.url);
const imageDir = new URL('assets/mountain-race/images/', rootUrl);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = message => { throw new Error(`Summit Sprint V29 validation failed: ${message}`); };

const assets = [
  ['summit-sprint-sky-v29.png', 1024, 1536, 2546924, '1909e293a9c386d7cd05f3a4e1d65594377513375ffb3139fa6a1b7af1db50d9', 2],
  ['summit-sprint-cliff-left-v29.png', 1024, 1536, 3491612, '5a440011a8686d0e657e014eba21d85172f29eece06c5cfd75b835f537508473', 6],
  ['summit-sprint-cliff-right-v29.png', 1024, 1536, 3717072, 'ec2fa86cdc09c93414ca9ed624910850b25d819d724bddb36b03acdb08dd0239', 6],
  ['summit-sprint-start-left-v29.png', 1024, 1536, 3077314, '23905f7ad53c284537dcb56db94cac21ec6e0898d5880cf290baaf35f489dd9b', 6],
  ['summit-sprint-start-right-v29.png', 1024, 1536, 3571871, '3fbd204683516198868fb7813f3921baff81cdaf076d77d7c97101b34acd9ab2', 6],
  ['summit-sprint-summit-left-v29.png', 1024, 1536, 3194771, '736357eb2665d112e8c9c2921556912d9c1d28dda51b0a6dd38c9ee3f9996a9f', 6],
  ['summit-sprint-summit-right-v29.png', 1024, 1536, 3050394, 'acaaa58061fe6f2274b5efca6b349f091c3686c8eec213e0b48ac80a2911a77d', 6],
  ['summit-sprint-hold-1-v29.png', 1024, 1536, 2549383, 'fa5e7c5e65a0d4bc3d78c34428a805d9c2f444678529a444ca7367a02a653e6c', 6],
  ['summit-sprint-hold-2-v29.png', 1024, 1536, 2453014, 'a4607afa092cd605fecb5f5cfb027c82348b3ac41f3f2d81141bac696a640a32', 6],
  ['summit-sprint-hold-3-v29.png', 1024, 1536, 2453591, '3f1a3433e923a818e5819ca3197aa5296b5c9021f885539f91796f2061a6499b', 6]
];

for (const [name, width, height, length, digest, colorType] of assets) {
  const url = new URL(name, imageDir);
  const [bytes, info] = await Promise.all([readFile(url), stat(url)]);
  if (!info.isFile() || info.size !== length) fail(`${name} byte length mismatch`);
  if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') fail(`${name} is not PNG`);
  if (bytes.readUInt32BE(16) !== width || bytes.readUInt32BE(20) !== height) fail(`${name} dimensions mismatch`);
  if (bytes[25] !== colorType) fail(`${name} PNG color type mismatch`);
  if (sha256(bytes) !== digest) fail(`${name} source hash mismatch`);
}

const [css, runtime, prototypeRuntime, html, preview] = await Promise.all([
  readFile(new URL('assets/mountain-race/mountain-race.css', rootUrl), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', rootUrl), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.js', rootUrl), 'utf8'),
  readFile(new URL('index.html', rootUrl), 'utf8'),
  readFile(new URL('mountain-race-preview.html', rootUrl), 'utf8')
]);

for (const token of [
  'MOUNTAIN_RACE_GENERATED_ASSETS_V29',
  "url('/assets/mountain-race/images/summit-sprint-sky-v29.png')",
  '.mr-cliff-art img',
  'object-fit: contain !important',
  'background-repeat: no-repeat !important',
  '.mr-hold-art'
]) if (!css.includes(token)) fail(`CSS token missing: ${token}`);

for (const token of [
  'MOUNTAIN_RACE_GENERATED_ASSETS_V29',
  "root.dataset.mrGeneratedAssets = '29';",
  "summit-sprint-cliff-${side === 'me' ? 'left' : 'right'}-v29.png",
  "summit-sprint-start-${side === 'me' ? 'left' : 'right'}-v29.png",
  "summit-sprint-summit-${side === 'me' ? 'left' : 'right'}-v29.png",
  'summit-sprint-hold-${(index % 3) + 1}-v29.png',
  'renderHolds',
  'promptIndex',
  'mr-climber'
]) if (!runtime.includes(token)) fail(`runtime token missing: ${token}`);

if (!runtime.includes('const total = Math.max(8, Math.min(80, Math.trunc(Number(publicState.stepsTotal) || 24)))')) fail('authoritative 24-hold default changed');
if (!runtime.includes('wrong inputs cost one hold') && !runtime.includes('Wrong inputs cost one hold')) fail('wrong-input slip behavior copy missing');
for (const token of [
  'MOUNTAIN_RACE_GENERATED_ASSETS_V29',
  "root.dataset.mrGeneratedAssets = '29';",
  'summit-sprint-cliff-${playerKey === \'me\' ? \'left\' : \'right\'}-v29.png',
  'summit-sprint-start-${playerKey === \'me\' ? \'left\' : \'right\'}-v29.png',
  'summit-sprint-summit-${playerKey === \'me\' ? \'left\' : \'right\'}-v29.png',
  'summit-sprint-hold-${(index % 3) + 1}-v29.png'
]) if (!prototypeRuntime.includes(token)) fail(`prototype runtime token missing: ${token}`);
if (!html.includes('visual=29') || !preview.includes('visual=29')) fail('V29 cache boundary missing');
if (css.includes('data-mr-generated-assets="29"] .mr-cliff-art img {\n  width: 100%')) fail('V29 cliff art is non-uniformly stretched');

console.log(`Validated ${assets.length} direct high-resolution V29 PNGs, native aspect-ratio image layers, live directional holds, and gameplay invariants.`);
