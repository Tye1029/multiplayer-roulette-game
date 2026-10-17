import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', root);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const indexUrl = new URL('index.html', root);
const marker = 'MOUNTAIN_RACE_CONCEPT_DETAIL_V19';

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint Concept Detail V19 patch failed: ${message}`);
}

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint Concept Detail V19 could not find ${label}.`);
  return source.replace(before, after);
}

function indentFunction(fn, replacementName) {
  return fn.toString()
    .replace(fn.name, replacementName)
    .split('\n')
    .map(line => `  ${line}`)
    .join('\n');
}

function generatedDetailRandomV19(seed) {
  let value = Number(seed) >>> 0;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 4294967296;
  };
}

function generatedCreateCliffTextureV19() {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 1536;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return '';
  const random = detailRandomV19(0x19c11ff);

  const base = ctx.createLinearGradient(0, 0, canvas.width, 0);
  base.addColorStop(0, '#4d311c');
  base.addColorStop(.12, '#6d472b');
  base.addColorStop(.34, '#8d6241');
  base.addColorStop(.56, '#a2754e');
  base.addColorStop(.78, '#7e5537');
  base.addColorStop(1, '#3e2516');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let wash = 0; wash < 8; wash += 1) {
    const y = (canvas.height / 8) * wash;
    const fade = ctx.createLinearGradient(0, y, 0, y + canvas.height / 7);
    fade.addColorStop(0, `rgba(255,227,178,${0.05 + random() * 0.03})`);
    fade.addColorStop(.45, 'rgba(255,227,178,0)');
    fade.addColorStop(1, `rgba(28,15,9,${0.08 + random() * 0.05})`);
    ctx.fillStyle = fade;
    ctx.fillRect(0, y, canvas.width, canvas.height / 7);
  }

  for (let grain = 0; grain < 2400; grain += 1) {
    const x = random() * canvas.width;
    const y = random() * canvas.height;
    const width = 1.8 + random() * 28;
    const height = 1.8 + random() * 22;
    const alpha = 0.012 + random() * 0.06;
    ctx.fillStyle = random() > .52
      ? `rgba(234,192,142,${alpha})`
      : `rgba(32,18,10,${alpha + 0.012})`;
    ctx.beginPath();
    ctx.ellipse(x, y, width, height, random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let seam = 0; seam < 110; seam += 1) {
    let x = -30 + random() * (canvas.width + 60);
    let y = 16 + random() * (canvas.height - 32);
    let angle = -0.6 + random() * 1.2;
    const points = [[x, y]];
    const steps = 4 + Math.floor(random() * 8);
    for (let step = 0; step < steps; step += 1) {
      angle += -0.28 + random() * 0.56;
      const distance = 12 + random() * 26;
      x += Math.cos(angle) * distance;
      y += Math.sin(angle) * distance * 0.4 + (-3 + random() * 6);
      points.push([x, y]);
    }
    ctx.strokeStyle = `rgba(26,14,8,${0.24 + random() * 0.28})`;
    ctx.lineWidth = 1 + random() * 2.4;
    ctx.beginPath();
    points.forEach(([px, py], idx) => idx ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
    ctx.stroke();
    ctx.strokeStyle = 'rgba(244,209,164,.12)';
    ctx.lineWidth = .8;
    ctx.beginPath();
    points.forEach(([px, py], idx) => idx ? ctx.lineTo(px + 1, py - 1) : ctx.moveTo(px + 1, py - 1));
    ctx.stroke();
  }

  ctx.lineCap = 'round';
  for (let ledge = 0; ledge < 42; ledge += 1) {
    const y = 34 + random() * (canvas.height - 68);
    const startX = -40 + random() * 220;
    const length = 120 + random() * 230;
    ctx.strokeStyle = `rgba(36,19,11,${0.34 + random() * 0.22})`;
    ctx.lineWidth = 2 + random() * 3;
    ctx.beginPath();
    ctx.moveTo(startX, y);
    let cursor = startX;
    while (cursor < startX + length) {
      cursor += 18 + random() * 38;
      ctx.lineTo(cursor, y - 8 + random() * 16);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(248,214,164,.10)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(startX, y - 2);
    cursor = startX;
    while (cursor < startX + length) {
      cursor += 18 + random() * 38;
      ctx.lineTo(cursor, y - 10 + random() * 16);
    }
    ctx.stroke();
  }

  for (let pocket = 0; pocket < 58; pocket += 1) {
    const x = 18 + random() * (canvas.width - 36);
    const y = 18 + random() * (canvas.height - 36);
    const radiusX = 8 + random() * 22;
    const radiusY = 5 + random() * 13;
    const rot = random() * Math.PI;
    const pocketShade = ctx.createRadialGradient(x - radiusX * .3, y - radiusY * .28, 0, x, y, radiusX * 1.3);
    pocketShade.addColorStop(0, 'rgba(255,232,193,.08)');
    pocketShade.addColorStop(.45, 'rgba(106,63,37,.06)');
    pocketShade.addColorStop(1, 'rgba(21,11,7,0)');
    ctx.fillStyle = pocketShade;
    ctx.beginPath();
    ctx.ellipse(x, y, radiusX, radiusY, rot, 0, Math.PI * 2);
    ctx.fill();
  }

  const sun = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  sun.addColorStop(0, 'rgba(255,236,195,.22)');
  sun.addColorStop(.18, 'rgba(255,226,175,.08)');
  sun.addColorStop(.52, 'rgba(117,71,42,.03)');
  sun.addColorStop(1, 'rgba(25,14,8,.24)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  return canvas.toDataURL('image/png');
}

function generatedCreateGrassTextureV19() {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 180;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const random = detailRandomV19(0x19a5511);

  const soil = ctx.createLinearGradient(0, 42, 0, canvas.height);
  soil.addColorStop(0, 'rgba(132,95,58,.24)');
  soil.addColorStop(.34, 'rgba(98,67,36,.34)');
  soil.addColorStop(1, 'rgba(42,26,14,.56)');
  ctx.fillStyle = soil;
  ctx.fillRect(0, 34, canvas.width, canvas.height - 34);

  for (let pebble = 0; pebble < 260; pebble += 1) {
    const x = random() * canvas.width;
    const y = 60 + random() * 100;
    const size = .8 + random() * 3.2;
    ctx.fillStyle = random() > .5
      ? `rgba(210,169,114,${0.09 + random() * 0.17})`
      : `rgba(52,31,18,${0.08 + random() * 0.18})`;
    ctx.beginPath();
    ctx.ellipse(x, y, size * 1.5, size, random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.lineCap = 'round';
  for (let blade = 0; blade < 1280; blade += 1) {
    const x = random() * canvas.width;
    const baseY = 58 + random() * 12;
    const height = 12 + random() * 44;
    const lean = -10 + random() * 20;
    const palette = random();
    ctx.strokeStyle = palette > .74
      ? `rgba(169,215,95,${0.42 + random() * 0.28})`
      : palette > .34
        ? `rgba(88,149,58,${0.42 + random() * 0.34})`
        : `rgba(43,104,39,${0.40 + random() * 0.32})`;
    ctx.lineWidth = 0.7 + random() * 1.45;
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.quadraticCurveTo(x + lean * .45, baseY - height * .58, x + lean, baseY - height);
    ctx.stroke();
  }

  const topLight = ctx.createLinearGradient(0, 0, 0, 82);
  topLight.addColorStop(0, 'rgba(255,247,208,.24)');
  topLight.addColorStop(1, 'rgba(255,247,208,0)');
  ctx.fillStyle = topLight;
  ctx.fillRect(0, 0, canvas.width, 82);

  return canvas.toDataURL('image/png');
}

function generatedCreateLedgeSpriteV19() {
  const tileWidth = 112;
  const tileHeight = 72;
  const canvas = document.createElement('canvas');
  canvas.width = tileWidth * 6;
  canvas.height = tileHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const random = detailRandomV19(0x19ddd221);

  for (let tile = 0; tile < 6; tile += 1) {
    const offset = tile * tileWidth;
    const centerX = offset + tileWidth / 2;
    const centerY = 36;
    const points = [];
    const pointCount = 9 + Math.floor(random() * 3);
    for (let point = 0; point < pointCount; point += 1) {
      const angle = Math.PI * 2 * point / pointCount + (-.13 + random() * .26);
      const radiusX = 28 + random() * 18;
      const radiusY = 16 + random() * 10;
      points.push([
        centerX + Math.cos(angle) * radiusX,
        centerY + Math.sin(angle) * radiusY
      ]);
    }

    const path = new Path2D();
    points.forEach(([x, y], index) => index ? path.lineTo(x, y) : path.moveTo(x, y));
    path.closePath();

    ctx.save();
    ctx.translate(4, 7);
    ctx.shadowColor = 'rgba(22,11,6,.62)';
    ctx.shadowBlur = 6;
    ctx.fillStyle = 'rgba(24,12,6,.58)';
    ctx.fill(path);
    ctx.restore();

    const face = ctx.createLinearGradient(offset + 18, 8, offset + 86, 56);
    face.addColorStop(0, tile % 2 ? '#d7a677' : '#c99362');
    face.addColorStop(.42, tile % 3 ? '#9b6842' : '#a9744a');
    face.addColorStop(1, '#4a2d1a');
    ctx.fillStyle = face;
    ctx.fill(path);

    ctx.save();
    ctx.clip(path);
    for (let fleck = 0; fleck < 66; fleck += 1) {
      const x = offset + 12 + random() * 86;
      const y = 8 + random() * 54;
      const size = .7 + random() * 2.4;
      ctx.fillStyle = random() > .56
        ? `rgba(248,217,171,${0.05 + random() * 0.16})`
        : `rgba(44,24,12,${0.05 + random() * 0.16})`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(52,29,15,.48)';
    ctx.lineWidth = 1.25;
    for (let crack = 0; crack < 4; crack += 1) {
      const x = offset + 26 + random() * 48;
      const y = 18 + random() * 18;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 8 + random() * 16, y + 8 + random() * 10);
      ctx.stroke();
    }
    ctx.restore();

    ctx.strokeStyle = 'rgba(254,225,180,.52)';
    ctx.lineWidth = 1.15;
    ctx.stroke(path);
  }

  return canvas.toDataURL('image/png');
}

function generatedEnsureConceptDetailV19(root) {
  let assets = window.__mountainRaceConceptDetailV19;
  if (!assets) {
    try {
      assets = {
        cliff: createCliffTextureV19(),
        grass: createGrassTextureV19(),
        ledges: createLedgeSpriteV19()
      };
    } catch (error) {
      console.warn('Summit Sprint concept detail texture fallback:', error);
      assets = { cliff: '', grass: '', ledges: '' };
    }
    window.__mountainRaceConceptDetailV19 = assets;
  }

  if (assets.cliff) root.style.setProperty('--mr-cliff-detail-v19', `url("${assets.cliff}")`);
  if (assets.grass) root.style.setProperty('--mr-grass-detail-v19', `url("${assets.grass}")`);
  if (assets.ledges) root.style.setProperty('--mr-ledge-sprite-v19', `url("${assets.ledges}")`);
  root.dataset.mrConceptDetail = '19';
}

let [css, runtime, html] = await Promise.all([
  readFile(cssUrl, 'utf8'),
  readFile(runtimeUrl, 'utf8'),
  readFile(indexUrl, 'utf8')
]);

if (!runtime.includes(marker)) {
  runtime = replaceRequired(
    runtime,
    '  // MOUNTAIN_RACE_CONCEPT_TARGET_V18',
    `  // MOUNTAIN_RACE_CONCEPT_TARGET_V18\n  // ${marker}`,
    'V18 runtime marker'
  );

  const helperAnchor = '  const MOUNTAIN_RACE_WORLD_V14 = ';
  assert(runtime.includes(helperAnchor), 'persistent V14 world helper is missing');
  const helpers = [
    indentFunction(generatedDetailRandomV19, 'detailRandomV19'),
    indentFunction(generatedCreateCliffTextureV19, 'createCliffTextureV19'),
    indentFunction(generatedCreateGrassTextureV19, 'createGrassTextureV19'),
    indentFunction(generatedCreateLedgeSpriteV19, 'createLedgeSpriteV19'),
    indentFunction(generatedEnsureConceptDetailV19, 'ensureConceptDetailV19')
  ].join('\n\n');
  runtime = runtime.replace(helperAnchor, `${helpers}\n\n${helperAnchor}`);

  runtime = replaceRequired(
    runtime,
    '    ensureConceptTargetV18(root);',
    '    ensureConceptTargetV18(root);\n    ensureConceptDetailV19(root);',
    'persistent concept detail installation'
  );
}

if (!css.includes(marker)) {
  css += String.raw`

/* MOUNTAIN_RACE_CONCEPT_DETAIL_V19
   Detailed raster cliffs, realistic grassy footing, rock ledges, brighter
   summit continuity, and stronger sunlight/shadow separation. */

[data-mountain-race-mount][data-mr-concept-detail="19"] .mr-mountain-wall {
  background-color: #7d5436;
  background-image:
    linear-gradient(106deg, rgba(255,240,211,.24) 0%, rgba(255,240,211,.06) 24%, rgba(255,240,211,0) 43%),
    linear-gradient(180deg, rgba(255,255,255,.04) 0%, rgba(255,255,255,0) 16%, rgba(18,10,6,0) 84%, rgba(18,10,6,.18) 100%),
    linear-gradient(90deg, rgba(29,16,10,.22) 0%, rgba(29,16,10,0) 9%, rgba(255,229,183,.06) 40%, rgba(22,12,8,.18) 100%),
    var(--mr-cliff-detail-v19),
    var(--mr-mountain-raster-v16);
  background-size: 100% 100%, 100% 100%, 100% 100%, 100% 100%, 100% 100%;
  background-position: center, center, center, center top, center top;
  background-repeat: no-repeat;
  filter: saturate(1.12) contrast(1.1);
  box-shadow:
    inset 10px 0 16px rgba(22,13,8,.16),
    inset -16px 0 18px rgba(21,11,7,.18),
    inset 0 -30px 28px rgba(31,18,11,.10);
}

[data-mountain-race-mount][data-mr-concept-detail="19"] .mr-mountain-wall::before {
  opacity: .64;
  background:
    linear-gradient(162deg, rgba(255,237,196,.18) 0 12%, rgba(255,237,196,0) 25%),
    linear-gradient(18deg, transparent 0 16%, rgba(35,18,11,.14) 24%, transparent 29%),
    linear-gradient(144deg, transparent 0 54%, rgba(249,218,170,.09) 58%, transparent 63%),
    linear-gradient(24deg, transparent 0 76%, rgba(28,14,9,.16) 82%, transparent 87%);
}

[data-mountain-race-mount][data-mr-concept-detail="19"] .mr-climb-viewport {
  background: linear-gradient(180deg, rgba(136,205,240,.18), rgba(91,166,209,.08));
  box-shadow:
    inset 0 0 0 1px rgba(255,255,255,.14),
    0 16px 30px rgba(4,9,16,.20);
}

[data-mountain-race-mount][data-mr-concept-detail="19"] .mr-climb-viewport::before {
  content: '' !important;
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background:
    linear-gradient(180deg, rgba(255,255,255,.12) 0%, rgba(255,255,255,0) 14%),
    linear-gradient(90deg, rgba(255,255,255,.04) 0%, rgba(255,255,255,0) 26%);
  opacity: .9;
}

[data-mountain-race-mount][data-mr-concept-detail="19"] .mr-climb-viewport::after {
  content: none !important;
}

[data-mountain-race-mount][data-mr-concept-detail="19"] .mr-rock-hold {
  width: 74px !important;
  height: 48px !important;
  background-image: var(--mr-ledge-sprite-v19) !important;
  background-size: 600% 100% !important;
  filter: drop-shadow(0 8px 4px rgba(29,16,9,.58));
}

[data-mountain-race-mount][data-mr-concept-detail="19"] .mr-rock-hold.current {
  filter:
    drop-shadow(0 8px 4px rgba(29,16,9,.62))
    drop-shadow(0 0 8px rgba(255,215,132,.94))
    drop-shadow(0 0 16px rgba(255,162,54,.55));
}

[data-mountain-race-mount][data-mr-concept-detail="19"] .mr-rock-hold b {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  margin: 6px auto 0;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, rgba(255,255,255,.18), rgba(255,255,255,0) 50%), linear-gradient(180deg, rgba(13,24,37,.94), rgba(5,12,20,.96));
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.12), 0 3px 8px rgba(6,10,16,.28);
}

[data-mountain-race-mount][data-mr-concept-detail="19"] .mr-rock-hold.unknown b {
  display: none;
}

[data-mountain-race-mount][data-mr-concept-detail="19"] .mr-direction-glyph-v18 {
  width: 20px;
  height: 20px;
  overflow: visible;
}

[data-mountain-race-mount][data-mr-concept-detail="19"] .mr-finish-ledge {
  left: 8%;
  right: 8%;
  height: 122px;
  border-radius: 30px 30px 24px 24px;
  background:
    linear-gradient(180deg, rgba(255,245,215,.16), rgba(255,245,215,0) 26%),
    var(--mr-grass-detail-v19),
    linear-gradient(180deg, #7fd05f 0 34%, #5fa449 34% 48%, #7a4f32 49%, #53311d 100%);
  background-size: 100% 100%, 100% 100%, 100% 100%;
  background-position: center, center top, center;
  background-repeat: no-repeat;
  box-shadow: 0 16px 24px rgba(13,20,14,.22), inset 0 10px 20px rgba(255,245,217,.10);
}

[data-mountain-race-mount][data-mr-concept-detail="19"] .mr-finish-ledge::before {
  content: '';
  position: absolute;
  left: 6%;
  right: 6%;
  top: 10px;
  height: 52px;
  border-radius: 999px;
  background:
    radial-gradient(circle at 20% 52%, rgba(255,252,234,.38), rgba(255,252,234,0) 32%),
    linear-gradient(180deg, rgba(165,219,102,.54), rgba(99,161,67,.74));
}

[data-mountain-race-mount][data-mr-concept-detail="19"] .mr-lane .mr-climber {
  filter: drop-shadow(0 7px 8px rgba(16,20,20,.26));
}

[data-mountain-race-mount][data-mr-concept-detail="19"] .mr-stage-ridge {
  opacity: .58;
}
`;
}

html = html.replace(/mountain-race-multiplayer\.js\?([^"']*)/g, (full, query) => full.includes('concept=19') ? full : `mountain-race-multiplayer.js?${query}&concept=19`);
html = html.replace(/mountain-race\.css\?([^"']*)/g, (full, query) => full.includes('concept=19') ? full : `mountain-race.css?${query}&concept=19`);

await Promise.all([
  writeFile(cssUrl, css),
  writeFile(runtimeUrl, runtime),
  writeFile(indexUrl, html)
]);
