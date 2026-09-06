import { access, readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', root);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const indexUrl = new URL('index.html', root);
const imageUrl = new URL('assets/mountain-race/images/summit-sprint-cliff-v20.png', root);
const marker = 'MOUNTAIN_RACE_SCREENSHOT_BASE_V20';

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint Screenshot Base V20 patch failed: ${message}`);
}

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint Screenshot Base V20 could not find ${label}.`);
  return source.replace(before, after);
}

async function loadScreenshotBase64() {
  const chunks = [];
  for (let index = 1; index <= 16; index += 1) {
    const url = new URL(`./mountain-race-screenshot-left-v20-part${index}.mjs`, import.meta.url);
    try {
      await access(url);
      const module = await import(url.href);
      const value = module.default
        || module.chunk
        || module.base64
        || Object.values(module).find(entry => typeof entry === 'string');
      assert(typeof value === 'string' && value.length > 0, `PNG chunk ${index} is empty`);
      chunks.push({ index, value: value.replace(/\s+/g, '') });
    } catch (error) {
      if (error?.code !== 'ENOENT' && error?.code !== 'ERR_MODULE_NOT_FOUND') throw error;
    }
  }
  assert(chunks.length > 0, 'no screenshot PNG chunks were found');
  chunks.sort((a, b) => a.index - b.index);
  return chunks.map(chunk => chunk.value).join('');
}

const base64 = await loadScreenshotBase64();
const png = Buffer.from(base64, 'base64');
assert(png.length > 12000, `decoded screenshot PNG is unexpectedly small (${png.length} bytes)`);
assert(
  png[0] === 0x89 && png[1] === 0x50 && png[2] === 0x4e && png[3] === 0x47
    && png[4] === 0x0d && png[5] === 0x0a && png[6] === 0x1a && png[7] === 0x0a,
  'decoded screenshot asset is not a PNG'
);
await writeFile(imageUrl, png);

let [css, runtime, html] = await Promise.all([
  readFile(cssUrl, 'utf8'),
  readFile(runtimeUrl, 'utf8'),
  readFile(indexUrl, 'utf8')
]);

if (!runtime.includes(marker)) {
  runtime = replaceRequired(
    runtime,
    '  // MOUNTAIN_RACE_CONCEPT_DETAIL_V19',
    `  // MOUNTAIN_RACE_CONCEPT_DETAIL_V19\n  // ${marker}`,
    'V19 runtime marker'
  );
  runtime = replaceRequired(
    runtime,
    '    ensureConceptDetailV19(root);',
    "    ensureConceptDetailV19(root);\n    root.dataset.mrScreenshotBase = '20';",
    'V19 environment installation'
  );
}

if (!css.includes(marker)) {
  css += String.raw`

/* MOUNTAIN_RACE_SCREENSHOT_BASE_V20
   Uses the approved realistic cliff screenshot crop as the live moving wall.
   Gameplay climbers, prompts and direction controls remain interactive layers. */

[data-mountain-race-mount][data-mr-screenshot-base="20"] {
  --mr-v20-cliff: url("images/summit-sprint-cliff-v20.png");
  --mr-v20-sun: rgba(255, 225, 166, .28);
  --mr-v20-shadow: rgba(8, 10, 9, .46);
  background:
    radial-gradient(circle at 14% 5%, rgba(255,244,202,.31), transparent 31%),
    linear-gradient(180deg, #84b7c7 0%, #507886 45%, #283b3f 100%);
}

[data-mountain-race-mount][data-mr-screenshot-base="20"] .mr-climb-viewport {
  background: #243b3f;
  border-color: rgba(183, 157, 92, .34);
  box-shadow:
    inset 0 0 0 1px rgba(255,255,255,.08),
    inset 0 0 40px rgba(2,8,8,.32),
    0 18px 34px rgba(1,6,7,.28);
}

[data-mountain-race-mount][data-mr-screenshot-base="20"] .mr-climb-viewport::before {
  content: '' !important;
  position: absolute;
  inset: 0;
  z-index: 9;
  pointer-events: none;
  border-radius: inherit;
  background:
    radial-gradient(ellipse at 13% 2%, rgba(255,237,190,.23) 0%, rgba(255,237,190,.08) 24%, transparent 49%),
    linear-gradient(106deg, rgba(255,232,181,.13) 0%, transparent 34%, rgba(7,10,9,.08) 68%, rgba(4,7,7,.22) 100%),
    linear-gradient(180deg, transparent 0 78%, rgba(5,8,7,.18) 100%);
  mix-blend-mode: soft-light;
}

[data-mountain-race-mount][data-mr-screenshot-base="20"] .mr-climb-viewport::after {
  content: none !important;
}

[data-mountain-race-mount][data-mr-screenshot-base="20"] .mr-mountain-wall {
  isolation: isolate;
  overflow: visible;
  background-color: #4e493c !important;
  background-image:
    linear-gradient(108deg, rgba(255,230,173,.15) 0%, rgba(255,230,173,0) 36%, rgba(6,8,7,.17) 100%),
    var(--mr-v20-cliff) !important;
  background-size: 100% 100%, 100% 100% !important;
  background-position: center, center top !important;
  background-repeat: no-repeat !important;
  filter: saturate(1.04) contrast(1.08) brightness(.98);
  box-shadow:
    inset 13px 0 24px rgba(255,222,164,.06),
    inset -18px 0 28px rgba(5,7,6,.28);
}

[data-mountain-race-mount][data-mr-screenshot-base="20"] .mr-lane.opponent .mr-mountain-wall {
  transform-origin: 50% 50%;
  background-position: center, 56% top !important;
  filter: saturate(1.02) contrast(1.09) brightness(.95);
}

[data-mountain-race-mount][data-mr-screenshot-base="20"] .mr-mountain-wall::before {
  content: '' !important;
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background:
    radial-gradient(ellipse at 20% 7%, rgba(255,235,187,.20), transparent 34%),
    linear-gradient(100deg, rgba(255,230,177,.09), transparent 31%, rgba(12,13,10,.14) 78%, rgba(3,5,5,.25));
  opacity: .9;
}

[data-mountain-race-mount][data-mr-screenshot-base="20"] .mr-mountain-wall::after {
  content: '' !important;
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background:
    linear-gradient(90deg, rgba(0,0,0,.20), transparent 8%, transparent 90%, rgba(0,0,0,.24)),
    linear-gradient(180deg, rgba(255,255,255,.025), transparent 16%, transparent 84%, rgba(0,0,0,.10));
}

[data-mountain-race-mount][data-mr-screenshot-base="20"] .mr-route-rope {
  opacity: .12;
  filter: sepia(.8) brightness(.8) drop-shadow(2px 2px 2px rgba(0,0,0,.48));
}

[data-mountain-race-mount][data-mr-screenshot-base="20"] .mr-rock-hold {
  z-index: 7;
  width: 58px !important;
  height: 44px !important;
  background: transparent !important;
  background-image: none !important;
  border: 0 !important;
  box-shadow: none !important;
  filter: none !important;
}

[data-mountain-race-mount][data-mr-screenshot-base="20"] .mr-rock-hold.unknown {
  opacity: 0 !important;
}

[data-mountain-race-mount][data-mr-screenshot-base="20"] .mr-rock-hold b {
  display: grid;
  place-items: center;
  width: 31px;
  height: 31px;
  margin: 7px auto 0;
  border-radius: 50%;
  border: 1px solid rgba(239,214,155,.48);
  background:
    radial-gradient(circle at 33% 25%, rgba(255,255,255,.20), transparent 36%),
    linear-gradient(180deg, rgba(28,30,27,.94), rgba(8,11,10,.97));
  box-shadow:
    0 5px 9px rgba(0,0,0,.55),
    inset 0 1px 0 rgba(255,255,255,.13);
}

[data-mountain-race-mount][data-mr-screenshot-base="20"] .mr-rock-hold.current b {
  border-color: rgba(255,220,137,.92);
  box-shadow:
    0 6px 11px rgba(0,0,0,.58),
    0 0 11px rgba(255,191,66,.82),
    0 0 23px rgba(255,139,35,.32),
    inset 0 1px 0 rgba(255,255,255,.21);
}

[data-mountain-race-mount][data-mr-screenshot-base="20"] .mr-lane.opponent .mr-rock-hold.current b {
  border-color: rgba(168,226,255,.9);
  box-shadow:
    0 6px 11px rgba(0,0,0,.58),
    0 0 11px rgba(80,191,255,.78),
    0 0 22px rgba(40,142,211,.34),
    inset 0 1px 0 rgba(255,255,255,.19);
}

[data-mountain-race-mount][data-mr-screenshot-base="20"] .mr-direction-glyph-v18 {
  width: 18px;
  height: 18px;
  filter: drop-shadow(0 1px 1px rgba(0,0,0,.75));
}

[data-mountain-race-mount][data-mr-screenshot-base="20"] .mr-start-ledge,
[data-mountain-race-mount][data-mr-screenshot-base="20"] .mr-finish-ledge {
  border-radius: 28px 28px 18px 18px;
  background:
    radial-gradient(ellipse at 23% 18%, rgba(255,245,193,.20), transparent 34%),
    linear-gradient(180deg, rgba(104,153,69,.08) 0 10%, rgba(67,111,48,.86) 38%, rgba(43,74,34,.94) 51%, rgba(79,62,42,.98) 52%, rgba(39,33,24,.98) 100%) !important;
  box-shadow:
    0 15px 22px rgba(3,8,6,.45),
    inset 0 7px 12px rgba(220,235,163,.12),
    inset 0 -9px 13px rgba(4,8,5,.31);
}

[data-mountain-race-mount][data-mr-screenshot-base="20"] .mr-start-ledge::before,
[data-mountain-race-mount][data-mr-screenshot-base="20"] .mr-finish-ledge::before {
  content: '' !important;
  position: absolute;
  left: 3%;
  right: 3%;
  top: -13px;
  height: 45px;
  border-radius: 58% 42% 48% 52%;
  background:
    repeating-linear-gradient(78deg, transparent 0 5px, rgba(137,189,84,.72) 6px 8px, transparent 9px 13px),
    linear-gradient(180deg, rgba(137,180,83,.95), rgba(61,111,46,.82));
  filter: drop-shadow(0 7px 5px rgba(3,8,5,.34));
  transform-origin: center bottom;
  animation: mr-v20-grass-breeze 4.8s ease-in-out infinite alternate;
}

[data-mountain-race-mount][data-mr-screenshot-base="20"] .mr-start-ledge::after,
[data-mountain-race-mount][data-mr-screenshot-base="20"] .mr-finish-ledge::after {
  content: '' !important;
  position: absolute;
  left: 18%;
  right: 18%;
  bottom: 13px;
  height: 15px;
  border-radius: 50%;
  background: radial-gradient(ellipse, rgba(0,0,0,.30), transparent 68%);
}

[data-mountain-race-mount][data-mr-screenshot-base="20"] .mr-climber {
  z-index: 11;
  filter:
    drop-shadow(5px 9px 5px rgba(3,6,5,.43))
    drop-shadow(0 1px 1px rgba(255,226,178,.12));
}

[data-mountain-race-mount][data-mr-screenshot-base="20"] .mr-titlebar,
[data-mountain-race-mount][data-mr-screenshot-base="20"] .mr-command-deck {
  background:
    linear-gradient(180deg, rgba(24,25,21,.97), rgba(7,9,8,.98));
  border-color: rgba(194,158,75,.48);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.09),
    0 11px 24px rgba(0,0,0,.35);
}

@keyframes mr-v20-grass-breeze {
  from { transform: skewX(-1deg) translateX(-1px); }
  to { transform: skewX(2.2deg) translateX(1px); }
}

@media (prefers-reduced-motion: reduce) {
  [data-mountain-race-mount][data-mr-screenshot-base="20"] .mr-start-ledge::before,
  [data-mountain-race-mount][data-mr-screenshot-base="20"] .mr-finish-ledge::before {
    animation: none !important;
  }
}
`;
}

html = html.replace(/mountain-race-multiplayer\.js\?([^"']*)/g, (full, query) => full.includes('screenshot=20') ? full : `mountain-race-multiplayer.js?${query}&screenshot=20`);
html = html.replace(/mountain-race\.css\?([^"']*)/g, (full, query) => full.includes('screenshot=20') ? full : `mountain-race.css?${query}&screenshot=20`);

await Promise.all([
  writeFile(cssUrl, css),
  writeFile(runtimeUrl, runtime),
  writeFile(indexUrl, html)
]);
