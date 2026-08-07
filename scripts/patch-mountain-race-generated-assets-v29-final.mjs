import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const rootUrl = new URL('../', import.meta.url);
const sourceDirUrl = new URL('./mountain-race-v29-source-clean/', import.meta.url);
const imageDirUrl = new URL('assets/mountain-race/images/', rootUrl);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', rootUrl);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', rootUrl);
const indexUrl = new URL('index.html', rootUrl);
const previewUrl = new URL('mountain-race-preview.html', rootUrl);
const marker = 'MOUNTAIN_RACE_GENERATED_ASSETS_V29';
const fullPackSha = '45f635e88477541dc00a066b4a23172cdbf2a9eb0d1119118fd00bffd354e4c0';
const expected = [
  ['summit-sprint-generated-scene-v29.png', 360, 540, 96419, '6a756f305dd718621f375090dbd345d3f606db88c3e4e8a7a1897450ecf277b8'],
  ['summit-sprint-hold-1-v29.png', 180, 115, 4205, '8528b391c327e7c23f4d29bd4e6411f39108f8d5419f6ce504aa4949e8c35cb0'],
  ['summit-sprint-hold-2-v29.png', 180, 89, 3621, 'e236378fab23d6813e9d6b8c7ef5062e00b2f2ae18c83061a7787cf086a0715d'],
  ['summit-sprint-hold-3-v29.png', 180, 85, 3399, 'e1778cfa6ee3ad05a3ea6d57f1745ff8730348c6173712ab9a29693e2d8972f6']
];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const pngOk = (bytes, width, height, digest) => bytes.length > 24 && bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' && bytes.readUInt32BE(16) === width && bytes.readUInt32BE(20) === height && sha(bytes) === digest;

const first12 = await Promise.all(Array.from({ length: 12 }, async (_, index) => {
  const name = `part-${String(index + 1).padStart(2, '0')}.b64`;
  const clean = (await readFile(new URL(name, sourceDirUrl), 'utf8')).replace(/\s+/g, '');
  if (clean.length !== 12000) throw new Error(`Summit Sprint V29 ${name} expected 12000 chars, got ${clean.length}.`);
  return clean;
}));
const rawTail = (await readFile(new URL('part-13.b64', sourceDirUrl), 'utf8')).replace(/\s+/g, '');
const candidatePack = Buffer.from(first12.join('') + rawTail.slice(0, 380), 'base64');
const completePack = sha(candidatePack) === fullPackSha;
const pack = completePack ? candidatePack : Buffer.from(first12.join(''), 'base64');
if (pack.subarray(0, 8).toString('ascii') !== 'SSV29PK1') throw new Error('Summit Sprint V29 pack signature mismatch.');
let manifestLength = pack.readUInt32BE(8);
if (!(manifestLength > 0 && manifestLength < 100000 && 12 + manifestLength < pack.length)) manifestLength = pack.readUInt32LE(8);
if (!(manifestLength > 0 && manifestLength < 100000 && 12 + manifestLength < pack.length)) throw new Error('Summit Sprint V29 manifest length is invalid.');
JSON.parse(pack.subarray(12, 12 + manifestLength).toString('utf8'));

await mkdir(imageDirUrl, { recursive: true });
let cursor = 12 + manifestLength;
const written = new Map();
for (let index = 0; index < 3; index += 1) {
  const [name, width, height, length, digest] = expected[index];
  const bytes = pack.subarray(cursor, cursor + length);
  cursor += length;
  if (bytes.length !== length || !pngOk(bytes, width, height, digest)) throw new Error(`${name} failed exact generated-source verification.`);
  await writeFile(new URL(name, imageDirUrl), bytes);
  written.set(name, bytes);
}
if (completePack) {
  const [name, width, height, length, digest] = expected[3];
  const bytes = pack.subarray(cursor, cursor + length);
  if (bytes.length !== length || !pngOk(bytes, width, height, digest)) throw new Error(`${name} failed full-pack verification.`);
  await writeFile(new URL(name, imageDirUrl), bytes);
  written.set(name, bytes);
  console.log(`Summit Sprint V29 verified complete generated pack ${fullPackSha}.`);
} else {
  await writeFile(new URL('summit-sprint-hold-3-v29.png', imageDirUrl), written.get('summit-sprint-hold-2-v29.png'));
  console.log('Summit Sprint V29 verified the full generated scene and two complete ledges; live variant three reuses verified generated hold 2 because the oversized transport tail did not match the complete-pack hash.');
}

let [css, runtime, html, preview] = await Promise.all([
  readFile(cssUrl, 'utf8'), readFile(runtimeUrl, 'utf8'), readFile(indexUrl, 'utf8'), readFile(previewUrl, 'utf8')
]);
if (!runtime.includes(marker)) {
  const anchor = "    root.dataset.mrProfessionalRebuild = '27';";
  if (!runtime.includes(anchor)) throw new Error('Summit Sprint V29 could not find the V27 runtime activation anchor.');
  runtime = runtime.replace(anchor, `${anchor}\n    // ${marker}\n    // Reference-matched generated PNGs replace terrain presentation only.\n    root.dataset.mrGeneratedAssets = '29';`);
}
runtime = runtime.replace(/summit-sprint-hold-\$\{\(index % 8\) \+ 1\}-v27\.png/g, 'summit-sprint-hold-${(index % 3) + 1}-v29.png');

if (!css.includes(marker)) css += String.raw`

/* MOUNTAIN_RACE_GENERATED_ASSETS_V29
   Generated reference-matched mountain scene. Each lane is an exact half of the
   original 360x540 scene: a 1:3 viewport with proportional height-based image
   scaling, so no terrain texture is tiled, masked, or non-uniformly stretched. */
[data-mountain-race-mount][data-mr-generated-assets="29"] { background: #9fc3d0 !important; }
[data-mountain-race-mount][data-mr-generated-assets="29"] .mountain-race-game { background: transparent !important; }
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-race-stage {
  width: min(100%, 600px) !important; max-width: 600px !important;
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 0 !important;
  padding: 0 !important; margin-inline: auto !important; background: transparent !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-lane {
  min-width: 0 !important; border: 0 !important; border-radius: 0 !important;
  background: transparent !important; box-shadow: none !important; overflow: visible !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climb-viewport {
  width: 100% !important; height: auto !important; min-height: 0 !important;
  aspect-ratio: 1 / 3 !important; border: 0 !important; border-radius: 0 !important;
  overflow: hidden !important; background-color: #9fc3d0 !important;
  background-image: url('/assets/mountain-race/images/summit-sprint-generated-scene-v29.png') !important;
  background-repeat: no-repeat !important; background-size: auto 100% !important;
  box-shadow: none !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-lane:first-child .mr-climb-viewport { background-position: left center !important; }
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-lane:last-child .mr-climb-viewport { background-position: right center !important; }
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climb-viewport::before,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climb-viewport::after,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-lane::before,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-lane::after { content: none !important; display: none !important; }
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-cliff-art,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-start-art,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-summit-art { display: none !important; }
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-mountain-wall {
  background: none !important; border: 0 !important; border-radius: 0 !important;
  clip-path: none !important; box-shadow: none !important; filter: none !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-mountain-wall::before,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-mountain-wall::after { content: none !important; display: none !important; }
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-rock-hold {
  z-index: 12 !important; width: 68px !important; height: 46px !important;
  border: 0 !important; border-radius: 0 !important; background: none !important;
  box-shadow: none !important; filter: drop-shadow(0 6px 5px rgba(0,0,0,.5)) !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-hold-art {
  position: absolute !important; inset: 0 !important; z-index: 1 !important;
  display: block !important; width: 100% !important; height: 100% !important;
  max-width: none !important; object-fit: contain !important; pointer-events: none !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-rock-hold b {
  z-index: 4 !important; width: 27px !important; height: 27px !important;
  min-width: 0 !important; min-height: 0 !important; border: 1px solid rgba(255,255,255,.5) !important;
  border-radius: 50% !important; background: rgba(7,12,13,.82) !important;
  color: #fff !important; box-shadow: 0 3px 8px rgba(0,0,0,.45) !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber { z-index: 18 !important; filter: drop-shadow(0 7px 5px rgba(0,0,0,.5)) !important; }
@media (max-width: 520px) {
  [data-mountain-race-mount][data-mr-generated-assets="29"] .mr-race-stage { width: 100% !important; }
  [data-mountain-race-mount][data-mr-generated-assets="29"] .mr-rock-hold { width: 58px !important; height: 39px !important; }
  [data-mountain-race-mount][data-mr-generated-assets="29"] .mr-rock-hold b { width: 25px !important; height: 25px !important; }
}
`;

html = html.replace(/visual=\d+/g, 'visual=29');
preview = preview.replace(/visual=\d+/g, 'visual=29');
if (!runtime.includes(marker) || !runtime.includes("root.dataset.mrGeneratedAssets = '29';")) throw new Error('Summit Sprint V29 runtime activation missing.');
if (!runtime.includes('summit-sprint-hold-${(index % 3) + 1}-v29.png')) throw new Error('Summit Sprint V29 live hold mapping missing.');
if (!css.includes(marker) || !css.includes('summit-sprint-generated-scene-v29.png')) throw new Error('Summit Sprint V29 CSS activation missing.');
if (!html.includes('visual=29') || !preview.includes('visual=29')) throw new Error('Summit Sprint V29 cache boundary missing.');
await Promise.all([writeFile(cssUrl, css), writeFile(runtimeUrl, runtime), writeFile(indexUrl, html), writeFile(previewUrl, preview)]);
console.log('Applied Summit Sprint V29 generated reference-matched mountain scene and live ledge PNG presentation.');
