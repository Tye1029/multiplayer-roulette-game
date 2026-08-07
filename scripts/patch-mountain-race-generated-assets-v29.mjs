import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const rootUrl = new URL('../', import.meta.url);
const sourceDirUrl = new URL('./mountain-race-v29-source/', import.meta.url);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', rootUrl);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', rootUrl);
const indexUrl = new URL('index.html', rootUrl);
const previewUrl = new URL('mountain-race-preview.html', rootUrl);
const imageDirUrl = new URL('assets/mountain-race/images/', rootUrl);
const marker = 'MOUNTAIN_RACE_GENERATED_ASSETS_V29';
const expectedPackSha256 = 'a07d7065f0e4352fb87a628832c4d47b4a7899f0e8281a1cae96cba11c9f5ce9';
const sha256 = value => createHash('sha256').update(value).digest('hex');

const requiredAssets = new Map([
  ['summit-sprint-generated-scene-v29.png', { width: 360, height: 540, length: 96431, sha256: '5d9621443bad461ee4980155895641da7dcc5b50b268509b3c2cedd24ef619aa' }],
  ['summit-sprint-hold-1-v29.png', { width: 200, height: 130, length: 5216, sha256: '56c2101bad3cfd248a91954bfe3c75a568dc0275cb21ac86b7ac5549539fa9f7' }],
  ['summit-sprint-hold-2-v29.png', { width: 200, height: 130, length: 4428, sha256: 'cafdac5029e86f6802f8dfe5980ac7445ea484009fe08cbba81fec987957bc0d' }],
  ['summit-sprint-hold-3-v29.png', { width: 200, height: 130, length: 4181, sha256: 'ffe0dbefe5e27f34bcd7d397e0a40c5e52fd988cdc98bd5cff6d0c59b387bf2f' }]
]);

const sourceChunks = await Promise.all(
  Array.from({ length: 8 }, async (_, index) => {
    const name = `source-${String(index + 1).padStart(2, '0')}.b64`;
    return (await readFile(new URL(name, sourceDirUrl), 'utf8')).replace(/\s+/g, '');
  })
);
const packed = Buffer.from(sourceChunks.join(''), 'base64');
const packSha = sha256(packed);
if (packSha !== expectedPackSha256) throw new Error(`Summit Sprint V29 pack SHA mismatch: ${packSha}`);
if (packed.subarray(0, 8).toString('ascii') !== 'SSV29PK1') throw new Error('Summit Sprint V29 pack signature is invalid.');

const manifestLength = packed.readUInt32BE(8);
const manifestStart = 12;
const manifestEnd = manifestStart + manifestLength;
const manifest = JSON.parse(packed.subarray(manifestStart, manifestEnd).toString('utf8'));
if (!Array.isArray(manifest) || manifest.length !== requiredAssets.size) throw new Error('Summit Sprint V29 manifest is invalid.');

await mkdir(imageDirUrl, { recursive: true });
let cursor = manifestEnd;
for (const asset of manifest) {
  const expected = requiredAssets.get(asset?.name);
  if (!expected) throw new Error(`Unexpected V29 asset ${String(asset?.name)}.`);
  if (asset.width !== expected.width || asset.height !== expected.height || asset.length !== expected.length || asset.sha256 !== expected.sha256) throw new Error(`V29 manifest mismatch for ${asset.name}.`);
  const bytes = packed.subarray(cursor, cursor + asset.length);
  if (bytes.length !== asset.length || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error(`${asset.name} is not a complete PNG.`);
  if (bytes.readUInt32BE(16) !== asset.width || bytes.readUInt32BE(20) !== asset.height || sha256(bytes) !== asset.sha256) throw new Error(`${asset.name} failed exact-byte validation.`);
  await writeFile(new URL(asset.name, imageDirUrl), bytes);
  cursor += asset.length;
}
if (cursor !== packed.length) throw new Error('Summit Sprint V29 pack has unexpected trailing bytes.');

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint V29 could not find ${label}.`);
  return source.replace(before, after);
}

let [css, runtime, html, preview] = await Promise.all([
  readFile(cssUrl, 'utf8'),
  readFile(runtimeUrl, 'utf8'),
  readFile(indexUrl, 'utf8'),
  readFile(previewUrl, 'utf8')
]);

if (!runtime.includes(marker)) {
  runtime = replaceRequired(
    runtime,
    "    root.dataset.mrReferenceScene = '28';",
    `    root.dataset.mrReferenceScene = '28';\n    // ${marker}\n    root.dataset.mrGeneratedAssets = '29';`,
    'V28 runtime activation anchor'
  );
  runtime = replaceRequired(
    runtime,
    'src="/assets/mountain-race/images/summit-sprint-hold-${(index % 8) + 1}-v27.png"',
    'src="/assets/mountain-race/images/summit-sprint-hold-${(index % 3) + 1}-v29.png"',
    'live hold image source'
  );
}

if (!css.includes(marker)) {
  css += String.raw`

/* MOUNTAIN_RACE_GENERATED_ASSETS_V29
   Reference-matched generated art pass. The generated sky, mountain valley,
   two rugged rope cliffs, grassy starts and summit shelves are composed once
   into the scene PNG to preserve their intended proportions. Separately
   generated rock ledges remain live sprites at the authoritative hold nodes. */
[data-mountain-race-mount][data-mr-generated-assets="29"] {
  background: #10191b !important;
  background-image: none !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mountain-race-game {
  background: rgba(6,12,14,.08) !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-race-stage {
  position: relative !important;
  isolation: isolate !important;
  overflow: hidden !important;
  background-color: #526b71 !important;
  background-image: url('/assets/mountain-race/images/summit-sprint-generated-scene-v29.png') !important;
  background-repeat: no-repeat !important;
  background-size: contain !important;
  background-position: center center !important;
  box-shadow: inset 0 0 30px rgba(4,9,10,.22) !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-lane,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climb-viewport,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-mountain-wall {
  background: transparent !important;
  background-image: none !important;
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-cliff-art,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-start-art,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-summit-art,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-mountain-wall::before,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-mountain-wall::after,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climb-viewport::before,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climb-viewport::after {
  content: none !important;
  display: none !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-mountain-wall { filter: none !important; }
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-rock-hold {
  z-index: 12 !important;
  width: 70px !important;
  height: 46px !important;
  overflow: visible !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: none !important;
  box-shadow: none !important;
  filter: drop-shadow(0 7px 5px rgba(0,0,0,.54)) !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-hold-art {
  position: absolute !important;
  z-index: 1 !important;
  inset: 0 !important;
  display: block !important;
  width: 100% !important;
  height: 100% !important;
  max-width: none !important;
  object-fit: contain !important;
  object-position: center !important;
  opacity: .98 !important;
  pointer-events: none !important;
  user-select: none !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-rock-hold.passed .mr-hold-art { opacity: .46 !important; }
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-rock-hold.distant .mr-hold-art { opacity: .66 !important; }
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-rock-hold b {
  position: absolute !important;
  z-index: 4 !important;
  left: 50% !important;
  top: 43% !important;
  display: grid !important;
  place-items: center !important;
  width: 26px !important;
  height: 26px !important;
  min-width: 0 !important;
  min-height: 0 !important;
  padding: 0 !important;
  transform: translate(-50%, -50%) !important;
  border: 1px solid rgba(255,255,255,.58) !important;
  border-radius: 50% !important;
  color: #fff !important;
  background: rgba(7,10,10,.82) !important;
  box-shadow: 0 3px 7px rgba(0,0,0,.48) !important;
  font-size: .84rem !important;
  line-height: 1 !important;
  text-shadow: 0 2px 2px rgba(0,0,0,.8) !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-rock-hold.current {
  filter: drop-shadow(0 7px 5px rgba(0,0,0,.54)) drop-shadow(0 0 7px rgba(239,190,78,.62)) !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber {
  z-index: 20 !important;
  filter: drop-shadow(0 7px 5px rgba(0,0,0,.48)) !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-altitude-meter { z-index: 24 !important; }
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-player-card { z-index: 26 !important; }
@media (max-width: 520px) {
  [data-mountain-race-mount][data-mr-generated-assets="29"] .mr-race-stage {
    gap: 6px !important;
    padding-inline: 3px !important;
    background-size: contain !important;
    background-position: center center !important;
  }
  [data-mountain-race-mount][data-mr-generated-assets="29"] .mr-rock-hold { width: 58px !important; height: 38px !important; }
  [data-mountain-race-mount][data-mr-generated-assets="29"] .mr-rock-hold b { width: 24px !important; height: 24px !important; font-size: .79rem !important; }
}
`;
}

html = html.replaceAll('visual=28', 'visual=29');
preview = preview.replaceAll('visual=28', 'visual=29');
if (!runtime.includes(marker) || !runtime.includes("root.dataset.mrGeneratedAssets = '29';")) throw new Error('V29 runtime activation missing.');
if (!runtime.includes('summit-sprint-hold-${(index % 3) + 1}-v29.png')) throw new Error('V29 hold mapping missing.');
if (!css.includes(marker) || !css.includes('summit-sprint-generated-scene-v29.png')) throw new Error('V29 generated scene CSS missing.');
if (!html.includes('visual=29') || !preview.includes('visual=29')) throw new Error('V29 cache boundary missing.');

await Promise.all([writeFile(cssUrl, css), writeFile(runtimeUrl, runtime), writeFile(indexUrl, html), writeFile(previewUrl, preview)]);
console.log(`Applied Summit Sprint V29 generated asset pack (${manifest.length} PNGs, ${packSha}).`);
