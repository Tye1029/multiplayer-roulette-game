import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';

const rootUrl = new URL('../', import.meta.url);
const imageDir = new URL('assets/mountain-race/images/', rootUrl);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = message => { throw new Error(`Summit Sprint V29 validation failed: ${message}`); };
const exact = [
  ['summit-sprint-generated-scene-v29.png', 360, 540, 96419, '6a756f305dd718621f375090dbd345d3f606db88c3e4e8a7a1897450ecf277b8'],
  ['summit-sprint-hold-1-v29.png', 180, 115, 4205, '8528b391c327e7c23f4d29bd4e6411f39108f8d5419f6ce504aa4949e8c35cb0'],
  ['summit-sprint-hold-2-v29.png', 180, 89, 3621, 'e236378fab23d6813e9d6b8c7ef5062e00b2f2ae18c83061a7787cf086a0715d']
];
for (const [name, width, height, length, digest] of exact) {
  const url = new URL(name, imageDir);
  const [bytes, info] = await Promise.all([readFile(url), stat(url)]);
  if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') fail(`${name} is not PNG`);
  if (bytes.readUInt32BE(16) !== width || bytes.readUInt32BE(20) !== height) fail(`${name} dimensions mismatch`);
  if (info.size !== length || sha(bytes) !== digest) fail(`${name} generated-source hash/size mismatch`);
}
const hold3 = await readFile(new URL('summit-sprint-hold-3-v29.png', imageDir));
const hold3Sha = sha(hold3);
if (!['e1778cfa6ee3ad05a3ea6d57f1745ff8730348c6173712ab9a29693e2d8972f6', 'e236378fab23d6813e9d6b8c7ef5062e00b2f2ae18c83061a7787cf086a0715d'].includes(hold3Sha)) fail('hold 3 is neither exact generated variant three nor the verified generated hold-2 fallback');

const [css, runtime, html, preview] = await Promise.all([
  readFile(new URL('assets/mountain-race/mountain-race.css', rootUrl), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', rootUrl), 'utf8'),
  readFile(new URL('index.html', rootUrl), 'utf8'),
  readFile(new URL('mountain-race-preview.html', rootUrl), 'utf8')
]);
const marker = 'MOUNTAIN_RACE_GENERATED_ASSETS_V29';
if (!runtime.includes(marker) || !runtime.includes("root.dataset.mrGeneratedAssets = '29';")) fail('runtime activation missing');
if (!runtime.includes('summit-sprint-hold-${(index % 3) + 1}-v29.png')) fail('live generated hold mapping missing');
if (!css.includes(marker) || !css.includes("url('/assets/mountain-race/images/summit-sprint-generated-scene-v29.png')")) fail('generated mountain scene mount missing');
if (!css.includes('aspect-ratio: 1 / 3 !important')) fail('exact half-scene lane ratio missing');
if (!css.includes('background-size: auto 100% !important')) fail('proportional source scaling missing');
if (!css.includes('background-repeat: no-repeat !important')) fail('no-repeat protection missing');
if (!css.includes('.mr-cliff-art') || !css.includes('.mr-start-art') || !css.includes('.mr-summit-art')) fail('old terrain retirement selectors missing');
if (!html.includes('visual=29') || !preview.includes('visual=29')) fail('V29 cache boundary missing');
for (const token of ['renderHolds', 'promptIndex', 'mr-climber', 'mr-rock-hold']) if (!runtime.includes(token)) fail(`gameplay invariant missing: ${token}`);
console.log(`Validated Summit Sprint V29 generated mountain scene and ledges; hold3=${hold3Sha}.`);
