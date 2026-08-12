import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', root);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const indexUrl = new URL('index.html', root);
const marker = 'MOUNTAIN_RACE_ENVIRONMENT_POLISH_V17';

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint Environment Polish V17 patch failed: ${message}`);
}

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint Environment Polish V17 could not find ${label}.`);
  return source.replace(before, after);
}

function setEnvironmentCache(url) {
  if (/([?&])environment=\d+/.test(url)) return url.replace(/([?&])environment=\d+/, '$1environment=17');
  return `${url}${url.includes('?') ? '&' : '?'}environment=17`;
}

function indentFunction(fn, replacementName) {
  return fn.toString()
    .replace(fn.name, replacementName)
    .split('\n')
    .map(line => `  ${line}`)
    .join('\n');
}

function generatedEnvironmentRandomV17(seed) {
  let value = Number(seed) >>> 0;
  return () => {
    value = Math.imul(value ^ (value >>> 15), 1 | value);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function generatedCreateMountainDetailRasterV17() {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 1280;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const random = environmentRandomV17(0x17a11f3);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let band = 0; band < 92; band += 1) {
    const y = random() * canvas.height;
    const startX = -30 + random() * 180;
    const length = 90 + random() * 240;
    const slope = -8 + random() * 16;
    ctx.strokeStyle = random() > .56
      ? `rgba(255,224,177,${.028 + random() * .055})`
      : `rgba(35,18,9,${.035 + random() * .08})`;
    ctx.lineWidth = .6 + random() * 1.7;
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.bezierCurveTo(
      startX + length * .3,
      y + slope + (-5 + random() * 10),
      startX + length * .68,
      y + slope + (-6 + random() * 12),
      startX + length,
      y + slope
    );
    ctx.stroke();
  }

  for (let chip = 0; chip < 380; chip += 1) {
    const x = random() * canvas.width;
    const y = random() * canvas.height;
    const width = 1 + random() * 8;
    const height = .8 + random() * 5;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-.8 + random() * 1.6);
    ctx.fillStyle = random() > .5
      ? `rgba(247,207,151,${.025 + random() * .09})`
      : `rgba(26,13,7,${.03 + random() * .11})`;
    ctx.fillRect(-width / 2, -height / 2, width, height);
    ctx.restore();
  }

  for (let pocket = 0; pocket < 34; pocket += 1) {
    const x = 16 + random() * (canvas.width - 32);
    const y = 20 + random() * (canvas.height - 40);
    const radius = 7 + random() * 24;
    const shadow = ctx.createRadialGradient(x - radius * .35, y - radius * .3, 0, x, y, radius);
    shadow.addColorStop(0, 'rgba(238,188,127,.08)');
    shadow.addColorStop(.45, 'rgba(86,47,25,.06)');
    shadow.addColorStop(1, 'rgba(26,13,7,0)');
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.ellipse(x, y, radius, radius * (.45 + random() * .35), random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let lichen = 0; lichen < 210; lichen += 1) {
    const x = random() * canvas.width;
    const y = random() * canvas.height;
    const size = .6 + random() * 2.4;
    ctx.fillStyle = random() > .52
      ? `rgba(126,139,73,${.025 + random() * .065})`
      : `rgba(176,155,91,${.02 + random() * .05})`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  const light = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  light.addColorStop(0, 'rgba(255,232,191,.18)');
  light.addColorStop(.34, 'rgba(255,219,166,.035)');
  light.addColorStop(.72, 'rgba(56,29,14,.03)');
  light.addColorStop(1, 'rgba(28,14,7,.22)');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  return canvas.toDataURL('image/png');
}

function generatedCreateGrassTextureV17() {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const random = environmentRandomV17(0x17c6a55);

  const soil = ctx.createLinearGradient(0, 28, 0, canvas.height);
  soil.addColorStop(0, 'rgba(99,72,39,.12)');
  soil.addColorStop(1, 'rgba(45,28,15,.42)');
  ctx.fillStyle = soil;
  ctx.fillRect(0, 30, canvas.width, canvas.height - 30);

  for (let stone = 0; stone < 180; stone += 1) {
    const x = random() * canvas.width;
    const y = 42 + random() * 48;
    const size = .6 + random() * 2.8;
    ctx.fillStyle = random() > .5
      ? `rgba(193,156,101,${.1 + random() * .16})`
      : `rgba(45,27,14,${.1 + random() * .18})`;
    ctx.beginPath();
    ctx.ellipse(x, y, size * 1.4, size, random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.lineCap = 'round';
  for (let blade = 0; blade < 760; blade += 1) {
    const x = random() * canvas.width;
    const baseY = 44 + random() * 14;
    const height = 8 + random() * 30;
    const lean = -7 + random() * 14;
    const palette = random();
    ctx.strokeStyle = palette > .72
      ? `rgba(155,194,85,${.42 + random() * .35})`
      : palette > .36
        ? `rgba(81,138,52,${.42 + random() * .38})`
        : `rgba(47,101,40,${.38 + random() * .34})`;
    ctx.lineWidth = .65 + random() * 1.25;
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.quadraticCurveTo(x + lean * .45, baseY - height * .55, x + lean, baseY - height);
    ctx.stroke();
  }

  return canvas.toDataURL('image/png');
}

function generatedEnsureMountainRaceEnvironmentV17(root) {
  let assets = window.__mountainRaceEnvironmentV17;
  if (!assets) {
    try {
      assets = {
        mountainDetail: createMountainDetailRasterV17(),
        grass: createGrassTextureV17()
      };
    } catch (error) {
      console.warn('Summit Sprint environment texture fallback:', error);
      assets = { mountainDetail: '', grass: '' };
    }
    window.__mountainRaceEnvironmentV17 = assets;
  }

  if (assets.mountainDetail) root.style.setProperty('--mr-mountain-detail-v17', `url("${assets.mountainDetail}")`);
  if (assets.grass) root.style.setProperty('--mr-grass-texture-v17', `url("${assets.grass}")`);

  const world = root.querySelector(':scope > .mr-world-layer');
  if (world && !world.querySelector(':scope > .mr-environment-v17')) {
    world.insertAdjacentHTML('beforeend', `
      <div class="mr-environment-v17" aria-hidden="true">
        <span class="mr-sun-v17"></span>
        <span class="mr-cloud-bank-v17 far"></span>
        <span class="mr-cloud-bank-v17 near"></span>
        <span class="mr-wind-v17"><i></i><i></i><i></i><i></i><i></i><i></i></span>
      </div>`);
  }
  root.dataset.mrEnvironment = '17';
}

let [css, runtime, html] = await Promise.all([
  readFile(cssUrl, 'utf8'),
  readFile(runtimeUrl, 'utf8'),
  readFile(indexUrl, 'utf8')
]);

if (!runtime.includes(marker)) {
  runtime = replaceRequired(
    runtime,
    '  // MOUNTAIN_RACE_RASTER_CLIFF_V16',
    `  // MOUNTAIN_RACE_RASTER_CLIFF_V16\n  // ${marker}`,
    'V16 runtime marker'
  );

  const helperAnchor = '  const MOUNTAIN_RACE_WORLD_V14 = ';
  assert(runtime.includes(helperAnchor), 'persistent V14 world helper is missing');
  const helpers = [
    indentFunction(generatedEnvironmentRandomV17, 'environmentRandomV17'),
    indentFunction(generatedCreateMountainDetailRasterV17, 'createMountainDetailRasterV17'),
    indentFunction(generatedCreateGrassTextureV17, 'createGrassTextureV17'),
    indentFunction(generatedEnsureMountainRaceEnvironmentV17, 'ensureMountainRaceEnvironmentV17')
  ].join('\n\n');
  runtime = runtime.replace(helperAnchor, `${helpers}\n\n${helperAnchor}`);

  runtime = replaceRequired(
    runtime,
    '    ensureMountainRaceRasterAssetsV16(root);',
    '    ensureMountainRaceRasterAssetsV16(root);\n    ensureMountainRaceEnvironmentV17(root);',
    'persistent environment installation'
  );
}

if (!css.includes(marker)) {
  css += String.raw`

/* MOUNTAIN_RACE_ENVIRONMENT_POLISH_V17
   Professional terrain lighting, detailed grass, layered clouds, wind,
   atmospheric depth and grounded summit shadows. All layers remain inside
   the persistent V14 compositor and never rebuild the whole game mount. */

[data-mountain-race-mount][data-mr-environment="17"] {
  background: #72c7f2;
}

[data-mountain-race-mount] > .mr-world-layer {
  background:
    radial-gradient(circle at 16% 9%, rgba(255,247,215,.66), transparent 12%),
    linear-gradient(180deg, #49ade8 0%, #75caf2 35%, #b5e1f5 70%, #dceff5 100%);
}

.mr-environment-v17,
.mr-environment-v17 > span {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.mr-environment-v17 {
  z-index: 7;
  overflow: hidden;
  transform: translateZ(0);
  backface-visibility: hidden;
}

.mr-sun-v17 {
  inset: auto;
  top: 4%;
  left: 8%;
  width: 118px;
  height: 118px;
  border-radius: 50%;
  background:
    radial-gradient(circle at 44% 42%, #fffef4 0 26%, #fff3b8 42%, rgba(255,221,124,.2) 67%, transparent 72%);
  box-shadow:
    0 0 36px rgba(255,241,180,.72),
    0 0 110px rgba(255,214,118,.38),
    0 0 220px rgba(255,211,109,.18);
  opacity: .92;
}

.mr-sun-v17::after {
  content: '';
  position: absolute;
  left: -120px;
  top: 70px;
  width: 540px;
  height: 660px;
  transform: rotate(-13deg);
  transform-origin: 0 0;
  background: linear-gradient(104deg, rgba(255,236,185,.12), rgba(255,236,185,.035) 38%, transparent 68%);
  clip-path: polygon(0 0, 100% 18%, 72% 100%, 8% 78%);
}

.mr-cloud-bank-v17 {
  inset: auto;
  width: 64%;
  height: 170px;
  background:
    radial-gradient(ellipse at 14% 60%, rgba(255,255,255,.88) 0 17%, transparent 18%),
    radial-gradient(ellipse at 31% 48%, rgba(255,255,255,.9) 0 22%, transparent 23%),
    radial-gradient(ellipse at 52% 60%, rgba(250,253,255,.84) 0 25%, transparent 26%),
    radial-gradient(ellipse at 73% 46%, rgba(255,255,255,.88) 0 20%, transparent 21%),
    radial-gradient(ellipse at 89% 64%, rgba(247,252,255,.82) 0 17%, transparent 18%);
  filter: drop-shadow(0 18px 18px rgba(91,142,167,.12));
  will-change: transform;
  backface-visibility: hidden;
}

.mr-cloud-bank-v17.far {
  top: 10%;
  left: -72%;
  opacity: .48;
  transform: scale(.72);
  animation: mrCloudDriftFarV17 42s linear infinite;
}

.mr-cloud-bank-v17.near {
  top: 22%;
  left: -68%;
  opacity: .62;
  animation: mrCloudDriftNearV17 29s linear infinite;
  animation-delay: -14s;
}

.mr-wind-v17 {
  z-index: 8;
  overflow: hidden;
}

.mr-wind-v17 i {
  position: absolute;
  left: -22%;
  width: 18%;
  height: 1px;
  border-radius: 50%;
  opacity: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.42), transparent);
  box-shadow: 0 0 3px rgba(255,255,255,.26);
  animation: mrWindStreakV17 7.5s ease-in-out infinite;
}

.mr-wind-v17 i:nth-child(1) { top: 18%; animation-delay: -1.2s; }
.mr-wind-v17 i:nth-child(2) { top: 31%; width: 26%; animation-delay: -4.8s; }
.mr-wind-v17 i:nth-child(3) { top: 46%; width: 13%; animation-delay: -2.7s; }
.mr-wind-v17 i:nth-child(4) { top: 61%; width: 22%; animation-delay: -6.1s; }
.mr-wind-v17 i:nth-child(5) { top: 73%; width: 15%; animation-delay: -.3s; }
.mr-wind-v17 i:nth-child(6) { top: 84%; width: 24%; animation-delay: -3.9s; }

.mountain-race-game .mr-mountain-wall {
  background-image:
    linear-gradient(112deg, rgba(255,228,184,.18) 0%, rgba(255,222,171,.035) 28%, transparent 48%, rgba(35,18,9,.16) 78%, rgba(24,12,6,.34) 100%),
    var(--mr-mountain-detail-v17),
    linear-gradient(180deg, rgba(255,226,176,.08), transparent 31% 72%, rgba(35,18,9,.22)),
    var(--mr-mountain-raster-v16);
  background-size: 100% 100%, 100% 100%, 100% 100%, 100% 100%;
  background-position: center, center top, center, center top;
  background-repeat: no-repeat;
  box-shadow:
    inset 26px 0 42px rgba(255,215,158,.08),
    inset -30px 0 48px rgba(31,16,8,.42),
    inset 0 -28px 44px rgba(31,17,9,.18),
    0 18px 30px rgba(56,35,21,.28);
  filter: saturate(1.06) contrast(1.1);
}

.mountain-race-game .mr-mountain-wall::before {
  opacity: .68;
  background:
    linear-gradient(113deg, rgba(255,230,190,.1), transparent 23% 58%, rgba(24,12,6,.16)),
    linear-gradient(19deg, transparent 0 27%, rgba(41,21,11,.24) 27.4% 28.4%, transparent 29%),
    linear-gradient(151deg, transparent 0 46%, rgba(249,208,151,.12) 46.4% 47.3%, transparent 48%),
    linear-gradient(33deg, transparent 0 73%, rgba(34,17,9,.22) 73.5% 74.7%, transparent 75.2%);
}

.mountain-race-game .mr-mountain-wall::after,
.mr-start-meadow,
.mr-summit-turf {
  background-image:
    var(--mr-grass-texture-v17),
    linear-gradient(180deg, rgba(177,213,99,.88) 0 18%, rgba(87,143,54,.96) 20% 39%, rgba(101,72,40,.98) 41% 72%, rgba(48,29,15,.98) 100%);
  background-size: 100% 100%, 100% 100%;
  background-position: center top, center;
  background-repeat: no-repeat;
}

.mr-start-meadow {
  box-shadow:
    0 8px 0 #332014,
    0 18px 24px rgba(50,34,21,.38),
    inset 0 5px rgba(222,239,157,.2),
    inset 0 -10px rgba(42,26,14,.18);
}

.mr-start-meadow::before,
.mr-start-meadow::after,
.mr-start-meadow span,
.mr-start-meadow i {
  animation: mrGrassSwayV17 2.8s ease-in-out infinite alternate;
}

.mr-start-meadow::after { animation-delay: -.8s; }
.mr-start-meadow span { animation-delay: -1.7s; }
.mr-start-meadow i { animation-delay: -2.25s; }

.mr-finish-ledge.mr-summit-plateau {
  box-shadow:
    0 9px 0 #2f1c11,
    0 18px 26px rgba(48,30,18,.42),
    inset 0 5px rgba(223,240,156,.19),
    inset 0 -13px rgba(40,24,13,.2);
}

.mr-summit-turf {
  overflow: visible;
  box-shadow:
    0 5px rgba(58,89,37,.34),
    0 8px 14px rgba(44,29,17,.18);
  animation: mrSummitGrassBreathV17 3.4s ease-in-out infinite alternate;
}

.mr-summit-turf::after {
  content: '';
  position: absolute;
  left: 8%;
  right: 8%;
  bottom: -11px;
  height: 14px;
  border-radius: 50%;
  background: radial-gradient(ellipse, rgba(44,26,14,.34), transparent 72%);
}

.mr-climber.finished::after,
.mr-climber.standing-on-summit::after {
  content: '';
  position: absolute;
  z-index: -1;
  left: 50%;
  bottom: -7px;
  width: 42px;
  height: 10px;
  transform: translateX(-50%);
  border-radius: 50%;
  background: radial-gradient(ellipse, rgba(43,27,15,.46), rgba(43,27,15,.18) 55%, transparent 74%);
}

.mountain-race-game .mr-mountain-wall .mr-rock-hold {
  filter:
    drop-shadow(1px 1px 0 rgba(246,211,159,.18))
    drop-shadow(0 8px 4px rgba(28,14,7,.62));
}

.mountain-race-game .mr-mountain-wall .mr-rock-hold::before {
  content: '';
  position: absolute;
  inset: 9% 10% 38%;
  border-radius: 50%;
  background: linear-gradient(145deg, rgba(255,231,192,.24), rgba(255,231,192,0));
  pointer-events: none;
}

.mountain-race-game .mr-mountain-wall .mr-rock-hold::after {
  content: '';
  position: absolute;
  left: 13%;
  right: 10%;
  bottom: 5%;
  height: 27%;
  border-radius: 50%;
  background: linear-gradient(180deg, transparent, rgba(28,14,7,.32));
  pointer-events: none;
}

@keyframes mrCloudDriftFarV17 {
  from { transform: translate3d(0, 0, 0) scale(.72); }
  to { transform: translate3d(245%, 8px, 0) scale(.72); }
}

@keyframes mrCloudDriftNearV17 {
  from { transform: translate3d(0, 0, 0); }
  to { transform: translate3d(230%, -6px, 0); }
}

@keyframes mrWindStreakV17 {
  0%, 18% { transform: translate3d(0, 0, 0) skewX(-18deg); opacity: 0; }
  30% { opacity: .45; }
  64% { opacity: .2; }
  82%, 100% { transform: translate3d(690%, -9px, 0) skewX(-18deg); opacity: 0; }
}

@keyframes mrGrassSwayV17 {
  from { rotate: -4deg; }
  to { rotate: 7deg; }
}

@keyframes mrSummitGrassBreathV17 {
  from { filter: brightness(.98) saturate(1); }
  to { filter: brightness(1.06) saturate(1.08); }
}

@media (max-width: 720px) {
  .mr-sun-v17 { width: 88px; height: 88px; }
  .mr-cloud-bank-v17 { width: 86%; height: 130px; }
  .mr-wind-v17 i:nth-child(even) { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .mr-cloud-bank-v17,
  .mr-wind-v17 i,
  .mr-start-meadow::before,
  .mr-start-meadow::after,
  .mr-start-meadow span,
  .mr-start-meadow i,
  .mr-summit-turf {
    animation: none !important;
  }
}
`;
}

html = html.replace(/assets\/mountain-race\/mountain-race\.css(?:\?[^"'<>\s]*)?/g, setEnvironmentCache);
html = html.replace(/assets\/mountain-race\/mountain-race-multiplayer\.js(?:\?[^"'<>\s]*)?/g, setEnvironmentCache);

const htmlMarker = `<!-- ${marker} -->`;
if (!html.includes(htmlMarker)) {
  const boundary = html.includes('</body>') ? '</body>' : '</html>';
  assert(html.includes(boundary), 'document closing boundary is missing');
  html = html.replace(boundary, `${htmlMarker}\n${boundary}`);
}

for (const required of [
  marker,
  'function createMountainDetailRasterV17()',
  'function createGrassTextureV17()',
  'function ensureMountainRaceEnvironmentV17(root)',
  'class="mr-environment-v17"',
  '--mr-mountain-detail-v17',
  '--mr-grass-texture-v17',
  'environment=17'
]) {
  assert(runtime.includes(required) || css.includes(required) || html.includes(required), `generated V17 output is missing ${required}`);
}
assert(runtime.includes('ensureMountainRaceRasterAssetsV16(root);\n    ensureMountainRaceEnvironmentV17(root);'), 'V17 environment is not attached after the V16 raster assets');
assert(!runtime.includes('root.innerHTML = `'), 'whole-mount replacement returned and may reintroduce flashing');

await Promise.all([
  writeFile(cssUrl, css),
  writeFile(runtimeUrl, runtime),
  writeFile(indexUrl, html)
]);

console.log('Applied Summit Sprint Environment Polish V17: layered sunlight, enhanced rock detail, textured grass, drifting cloud banks, wind streaks and grounded summit shadows now enrich the persistent V16 cliff without changing gameplay or networking.');
