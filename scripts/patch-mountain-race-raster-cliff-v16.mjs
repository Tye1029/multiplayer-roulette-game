import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', root);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const indexUrl = new URL('index.html', root);
const marker = 'MOUNTAIN_RACE_RASTER_CLIFF_V16';

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint Raster Cliff V16 patch failed: ${message}`);
}

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint Raster Cliff V16 could not find ${label}.`);
  return source.replace(before, after);
}

function setTextureCache(url) {
  if (/([?&])texture=\d+/.test(url)) return url.replace(/([?&])texture=\d+/, '$1texture=16');
  return `${url}${url.includes('?') ? '&' : '?'}texture=16`;
}

function indentFunction(fn, replacementName) {
  return fn.toString()
    .replace(fn.name, replacementName)
    .split('\n')
    .map(line => `  ${line}`)
    .join('\n');
}

function generatedRasterRandomV16(seed) {
  let value = Number(seed) >>> 0;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 4294967296;
  };
}

function generatedCreateMountainRasterV16() {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 1280;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return '';
  const random = rasterRandomV16(0x16c11ff);

  const base = ctx.createLinearGradient(0, 0, canvas.width, 0);
  base.addColorStop(0, '#4a2d1b');
  base.addColorStop(.16, '#755038');
  base.addColorStop(.47, '#a07552');
  base.addColorStop(.68, '#805a3d');
  base.addColorStop(1, '#392216');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let index = 0; index < 1250; index += 1) {
    const x = random() * canvas.width;
    const y = random() * canvas.height;
    const width = 3 + random() * 34;
    const height = 2 + random() * 26;
    const light = random() > .61;
    const alpha = .018 + random() * .055;
    ctx.fillStyle = light
      ? `rgba(239,196,139,${alpha})`
      : `rgba(32,17,9,${alpha + .01})`;
    ctx.beginPath();
    ctx.ellipse(x, y, width, height, random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  const faceShade = ctx.createLinearGradient(0, 0, canvas.width, 0);
  faceShade.addColorStop(0, 'rgba(28,15,8,.38)');
  faceShade.addColorStop(.23, 'rgba(255,224,174,.05)');
  faceShade.addColorStop(.55, 'rgba(255,226,177,.09)');
  faceShade.addColorStop(1, 'rgba(25,13,7,.45)');
  ctx.fillStyle = faceShade;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let crack = 0; crack < 58; crack += 1) {
    let x = 12 + random() * (canvas.width - 24);
    let y = 12 + random() * (canvas.height - 24);
    let angle = -.8 + random() * 1.6;
    const points = [[x, y]];
    const steps = 3 + Math.floor(random() * 8);
    for (let step = 0; step < steps; step += 1) {
      angle += -.42 + random() * .84;
      const distance = 7 + random() * 16;
      x += Math.cos(angle) * distance;
      y += Math.abs(Math.sin(angle)) * distance * .72 + (-2 + random() * 5);
      points.push([x, y]);
    }
    ctx.strokeStyle = `rgba(24,12,6,${.48 + random() * .32})`;
    ctx.lineWidth = random() > .76 ? 2.2 : 1.15;
    ctx.beginPath();
    points.forEach(([px, py], pointIndex) => pointIndex ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
    ctx.stroke();
    ctx.strokeStyle = 'rgba(230,183,124,.13)';
    ctx.lineWidth = .8;
    ctx.translate(1, -1);
    ctx.beginPath();
    points.forEach(([px, py], pointIndex) => pointIndex ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
    ctx.stroke();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  for (let ledge = 0; ledge < 17; ledge += 1) {
    let x = -18 + random() * 220;
    const y = 30 + random() * 1210;
    const length = 60 + random() * 150;
    ctx.strokeStyle = `rgba(26,13,7,${.48 + random() * .22})`;
    ctx.lineWidth = 2 + random() * 2.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    while (x < length) {
      x += 11 + random() * 22;
      ctx.lineTo(x, y - 6 + random() * 12);
    }
    ctx.stroke();
  }

  return canvas.toDataURL('image/png');
}

function generatedCreateHoldSpriteV16() {
  const tileWidth = 96;
  const tileHeight = 72;
  const canvas = document.createElement('canvas');
  canvas.width = tileWidth * 6;
  canvas.height = tileHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const random = rasterRandomV16(0x51a6d00d);

  for (let tile = 0; tile < 6; tile += 1) {
    const offset = tile * tileWidth;
    const centerX = offset + tileWidth / 2;
    const centerY = 36;
    const points = [];
    const pointCount = 8 + Math.floor(random() * 4);
    for (let point = 0; point < pointCount; point += 1) {
      const angle = Math.PI * 2 * point / pointCount + (-.12 + random() * .24);
      const radiusX = 28 + random() * 12;
      const radiusY = 18 + random() * 9;
      points.push([
        centerX + Math.cos(angle) * radiusX,
        centerY + Math.sin(angle) * radiusY
      ]);
    }

    const path = new Path2D();
    points.forEach(([x, y], pointIndex) => pointIndex ? path.lineTo(x, y) : path.moveTo(x, y));
    path.closePath();

    ctx.save();
    ctx.translate(3, 6);
    ctx.shadowColor = 'rgba(20,10,5,.72)';
    ctx.shadowBlur = 5;
    ctx.fillStyle = 'rgba(24,12,6,.74)';
    ctx.fill(path);
    ctx.restore();

    const rockGradient = ctx.createLinearGradient(offset + 20, 12, offset + 76, 62);
    rockGradient.addColorStop(0, tile % 2 ? '#d0a16e' : '#bd8b5b');
    rockGradient.addColorStop(.45, tile % 3 ? '#875938' : '#976743');
    rockGradient.addColorStop(1, '#3d2415');
    ctx.fillStyle = rockGradient;
    ctx.fill(path);

    ctx.save();
    ctx.clip(path);
    for (let grain = 0; grain < 58; grain += 1) {
      const x = offset + 12 + random() * 72;
      const y = 11 + random() * 50;
      const size = .7 + random() * 2.2;
      ctx.fillStyle = random() > .58
        ? `rgba(238,197,143,${.05 + random() * .13})`
        : `rgba(39,21,11,${.05 + random() * .16})`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(35,18,9,.56)';
    ctx.lineWidth = 1.2;
    for (let line = 0; line < 3; line += 1) {
      const x = offset + 29 + random() * 34;
      const y = 21 + random() * 22;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 7 + random() * 14, y + 7 + random() * 10);
      ctx.stroke();
    }
    ctx.restore();

    ctx.strokeStyle = 'rgba(246,216,171,.52)';
    ctx.lineWidth = 1.15;
    ctx.stroke(path);
  }

  return canvas.toDataURL('image/png');
}

function generatedEnsureMountainRaceRasterAssetsV16(root) {
  let assets = window.__mountainRaceRasterAssetsV16;
  if (!assets) {
    try {
      assets = {
        mountain: createMountainRasterV16(),
        holds: createHoldSpriteV16()
      };
    } catch (error) {
      console.warn('Summit Sprint raster texture fallback:', error);
      assets = { mountain: '', holds: '' };
    }
    window.__mountainRaceRasterAssetsV16 = assets;
  }
  if (assets.mountain) root.style.setProperty('--mr-mountain-raster-v16', `url("${assets.mountain}")`);
  if (assets.holds) root.style.setProperty('--mr-hold-sprite-v16', `url("${assets.holds}")`);
  root.dataset.mrRasterTexture = '16';
}

let [css, runtime, html] = await Promise.all([
  readFile(cssUrl, 'utf8'),
  readFile(runtimeUrl, 'utf8'),
  readFile(indexUrl, 'utf8')
]);

if (!runtime.includes(marker)) {
  runtime = replaceRequired(
    runtime,
    '  // MOUNTAIN_RACE_DAYLIGHT_TERRAIN_V15',
    `  // MOUNTAIN_RACE_DAYLIGHT_TERRAIN_V15\n  // ${marker}`,
    'V15 runtime marker'
  );

  const helperAnchor = '  const MOUNTAIN_RACE_WORLD_V14 = ';
  assert(runtime.includes(helperAnchor), 'persistent V14 world helper is missing');
  const helpers = [
    indentFunction(generatedRasterRandomV16, 'rasterRandomV16'),
    indentFunction(generatedCreateMountainRasterV16, 'createMountainRasterV16'),
    indentFunction(generatedCreateHoldSpriteV16, 'createHoldSpriteV16'),
    indentFunction(generatedEnsureMountainRaceRasterAssetsV16, 'ensureMountainRaceRasterAssetsV16')
  ].join('\n\n');
  runtime = runtime.replace(helperAnchor, `${helpers}\n\n${helperAnchor}`);

  runtime = replaceRequired(
    runtime,
    '    ensureMountainRaceWorld(root);',
    '    ensureMountainRaceWorld(root);\n    ensureMountainRaceRasterAssetsV16(root);',
    'persistent raster asset installation'
  );
}

if (!css.includes(marker)) {
  css += String.raw`

/* MOUNTAIN_RACE_RASTER_CLIFF_V16
   A browser-generated PNG cliff texture moves with the authoritative wall
   transform. A transparent PNG sprite sheet supplies six irregular,
   independently positioned grab rocks while grass, ropes, summit and
   climbers remain separate gameplay layers. */

[data-mountain-race-mount][data-mr-raster-texture="16"] {
  --mr-raster-ready: 1;
}

.mountain-race-game .mr-mountain-wall {
  background-color: #68452c;
  background-image:
    linear-gradient(90deg, rgba(37,20,11,.3), transparent 18% 70%, rgba(34,18,10,.42)),
    linear-gradient(180deg, rgba(255,221,168,.07), transparent 28% 72%, rgba(37,20,11,.19)),
    var(--mr-mountain-raster-v16);
  background-size: 100% 100%, 100% 100%, 100% 100%;
  background-position: center, center, center top;
  background-repeat: no-repeat;
  image-rendering: auto;
  filter: saturate(1.04) contrast(1.07);
}

.mountain-race-game .mr-mountain-wall::before {
  opacity: .42;
  background:
    linear-gradient(17deg, transparent 0 28%, rgba(34,18,10,.18) 28.4% 29%, transparent 29.5%),
    linear-gradient(151deg, transparent 0 47%, rgba(239,195,137,.08) 47.4% 48%, transparent 48.5%),
    linear-gradient(33deg, transparent 0 73%, rgba(38,20,11,.16) 73.5% 74.5%, transparent 75%);
}

.mountain-race-game .mr-mountain-wall .mr-rock-hold {
  width: 58px !important;
  height: 45px !important;
  border: 0;
  border-radius: 0;
  color: #fffaf0;
  background-color: transparent;
  background-image: var(--mr-hold-sprite-v16);
  background-size: 600% 100%;
  background-repeat: no-repeat;
  background-position-y: center;
  box-shadow: none;
  filter: drop-shadow(0 7px 3px rgba(30,16,8,.62));
}

.mountain-race-game .mr-rock-hold:nth-of-type(6n + 1) { background-position-x: 0%; }
.mountain-race-game .mr-rock-hold:nth-of-type(6n + 2) { background-position-x: 20%; }
.mountain-race-game .mr-rock-hold:nth-of-type(6n + 3) { background-position-x: 40%; }
.mountain-race-game .mr-rock-hold:nth-of-type(6n + 4) { background-position-x: 60%; }
.mountain-race-game .mr-rock-hold:nth-of-type(6n + 5) { background-position-x: 80%; }
.mountain-race-game .mr-rock-hold:nth-of-type(6n) { background-position-x: 100%; }

.mountain-race-game .mr-mountain-wall .mr-rock-hold.current {
  border: 0;
  background-color: transparent;
  box-shadow: none;
  filter:
    drop-shadow(0 7px 3px rgba(30,16,8,.66))
    drop-shadow(0 0 5px rgba(255,216,139,.95))
    drop-shadow(0 0 12px rgba(240,144,55,.72));
}

.mountain-race-game .mr-lane.opponent .mr-rock-hold.current {
  filter:
    drop-shadow(0 7px 3px rgba(30,16,8,.66))
    drop-shadow(0 0 5px rgba(184,232,250,.9))
    drop-shadow(0 0 11px rgba(78,163,201,.62));
}

.mountain-race-game .mr-rock-hold b {
  color: #fffaf0;
  font-family: Arial, Helvetica, sans-serif;
  font-weight: 950;
  text-shadow:
    0 2px 1px rgba(24,12,6,.95),
    1px 0 1px rgba(24,12,6,.75),
    -1px 0 1px rgba(24,12,6,.75);
}

.mountain-race-game .mr-rock-hold.passed {
  opacity: .62;
  filter: saturate(.72) brightness(.8) drop-shadow(0 6px 3px rgba(30,16,8,.48));
}

.mountain-race-game .mr-rock-hold.distant {
  opacity: .5;
}

@media (max-width: 720px) {
  .mountain-race-game .mr-mountain-wall .mr-rock-hold {
    width: 46px !important;
    height: 36px !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  .mountain-race-game .mr-rock-hold.current {
    animation: none !important;
  }
}
`;
}

html = html.replace(/assets\/mountain-race\/mountain-race\.css(?:\?[^"'<>\s]*)?/g, setTextureCache);
html = html.replace(/assets\/mountain-race\/mountain-race-multiplayer\.js(?:\?[^"'<>\s]*)?/g, setTextureCache);

const htmlMarker = `<!-- ${marker} -->`;
if (!html.includes(htmlMarker)) {
  const boundary = html.includes('</body>') ? '</body>' : '</html>';
  assert(html.includes(boundary), 'document closing boundary is missing');
  html = html.replace(boundary, `${htmlMarker}\n${boundary}`);
}

for (const required of [
  marker,
  'function createMountainRasterV16()',
  'function createHoldSpriteV16()',
  "canvas.toDataURL('image/png')",
  'ensureMountainRaceRasterAssetsV16(root)',
  '--mr-mountain-raster-v16',
  '--mr-hold-sprite-v16',
  'texture=16'
]) {
  assert(runtime.includes(required) || css.includes(required) || html.includes(required), `generated V16 output is missing ${required}`);
}

assert(runtime.includes('ensureMountainRaceWorld(root);\n    ensureMountainRaceRasterAssetsV16(root);'), 'raster assets are not attached to the persistent world render');
assert(!runtime.includes('root.innerHTML = `'), 'whole-mount replacement returned and may reintroduce flashing');

await Promise.all([
  writeFile(cssUrl, css),
  writeFile(runtimeUrl, runtime),
  writeFile(indexUrl, html)
]);

console.log('Applied Summit Sprint Raster Cliff V16: a cached PNG mountain face now moves with each climb, six transparent PNG grab-rock variants replace button-like holds, and the persistent anti-flash world plus gameplay layers remain unchanged.');
