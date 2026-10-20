import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', root);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const indexUrl = new URL('index.html', root);
const marker = 'MOUNTAIN_RACE_CONCEPT_TARGET_V18';

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint Concept Target V18 patch failed: ${message}`);
}

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint Concept Target V18 could not find ${label}.`);
  return source.replace(before, after);
}

function setConceptCache(url) {
  if (/([?&])concept=\d+/.test(url)) return url.replace(/([?&])concept=\d+/, '$1concept=18');
  return `${url}${url.includes('?') ? '&' : '?'}concept=18`;
}

function indentFunction(fn, replacementName) {
  return fn.toString()
    .replace(fn.name, replacementName)
    .split('\n')
    .map(line => `  ${line}`)
    .join('\n');
}

function generatedDirectionGlyphV18(value) {
  const token = control(value);
  const paths = {
    up: 'M16 3 29 16h-8v13H11V16H3Z',
    right: 'M29 16 16 29v-8H3V11h13V3Z',
    down: 'M16 29 3 16h8V3h10v13h8Z',
    left: 'M3 16 16 3v8h13v10H16v8Z'
  };
  return `<svg class="mr-direction-glyph-v18 direction-${token}" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path class="mr-glyph-shadow-v18" d="${paths[token]}"></path><path class="mr-glyph-face-v18" d="${paths[token]}"></path><path class="mr-glyph-shine-v18" d="M8 10.5 16 5l8 5.5" pathLength="1"></path></svg>`;
}

function generatedEnsureConceptTargetV18(root) {
  root.dataset.mrConceptTarget = '18';
  const world = root.querySelector(':scope > .mr-world-layer');
  if (world && !world.querySelector(':scope > .mr-concept-depth-v18')) {
    world.insertAdjacentHTML('beforeend', `
      <div class="mr-concept-depth-v18" aria-hidden="true">
        <span class="mr-range-v18 far"></span>
        <span class="mr-range-v18 near"></span>
        <span class="mr-valley-haze-v18"></span>
      </div>`);
  }
}

let [css, runtime, html] = await Promise.all([
  readFile(cssUrl, 'utf8'),
  readFile(runtimeUrl, 'utf8'),
  readFile(indexUrl, 'utf8')
]);

if (!runtime.includes(marker)) {
  runtime = replaceRequired(
    runtime,
    '  // MOUNTAIN_RACE_ENVIRONMENT_POLISH_V17',
    `  // MOUNTAIN_RACE_ENVIRONMENT_POLISH_V17\n  // ${marker}`,
    'V17 runtime marker'
  );

  const helperAnchor = '  const MOUNTAIN_RACE_WORLD_V14 = ';
  assert(runtime.includes(helperAnchor), 'persistent V14 world helper is missing');
  const helpers = [
    indentFunction(generatedDirectionGlyphV18, 'directionGlyphV18'),
    indentFunction(generatedEnsureConceptTargetV18, 'ensureConceptTargetV18')
  ].join('\n\n');
  runtime = runtime.replace(helperAnchor, `${helpers}\n\n${helperAnchor}`);

  const symbolPattern = /  function symbol\(value\) \{\n[\s\S]*?\n  \}/;
  assert(symbolPattern.test(runtime), 'direction symbol helper is missing');
  runtime = runtime.replace(symbolPattern, `  function symbol(value) {\n    return directionGlyphV18(value);\n  }`);

  runtime = replaceRequired(
    runtime,
    "        known ? 'known' : 'unknown'\n      ].filter(Boolean).join(' ');",
    "        known ? 'known' : 'unknown',\n        known ? `direction-${known}` : ''\n      ].filter(Boolean).join(' ');",
    'known hold class list'
  );

  runtime = replaceRequired(
    runtime,
    "known ? symbol(known) : '•'",
    "known ? symbol(known) : ''",
    'unknown hold bullet'
  );

  runtime = replaceRequired(
    runtime,
    '    ensureMountainRaceEnvironmentV17(root);',
    '    ensureMountainRaceEnvironmentV17(root);\n    ensureConceptTargetV18(root);',
    'persistent concept installation'
  );
}

if (!css.includes(marker)) {
  css += String.raw`

/* MOUNTAIN_RACE_CONCEPT_TARGET_V18
   Premium concept-target presentation based on the approved mockup.
   The raster cliff stays live and scrollable; every route symbol is a new
   interactive SVG emblem instead of a baked dot or arrow in the artwork. */

[data-mountain-race-mount][data-mr-concept-target="18"] {
  --mr-you-accent: #35b9ff;
  --mr-you-deep: #075a92;
  --mr-opponent-accent: #ff9a35;
  --mr-opponent-deep: #8a3811;
  --mr-gold: #ffc95b;
  --mr-ink: #07131f;
  background: #63b9eb;
}

.mr-concept-depth-v18,
.mr-concept-depth-v18 > span {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.mr-concept-depth-v18 {
  z-index: 3;
  overflow: hidden;
}

.mr-range-v18 {
  inset: auto -12% 0;
  height: 35%;
  opacity: .52;
  background: linear-gradient(145deg, transparent 0 12%, #5f7d8a 12.4% 24%, transparent 24.4% 32%, #78939d 32.4% 46%, transparent 46.4% 55%, #557482 55.4% 69%, transparent 69.4%);
  clip-path: polygon(0 100%,0 76%,9% 54%,18% 72%,28% 36%,39% 69%,50% 25%,61% 68%,72% 42%,83% 72%,92% 49%,100% 73%,100% 100%);
  filter: blur(.2px);
}

.mr-range-v18.far { transform: translateY(11%) scale(1.08); opacity: .27; }
.mr-range-v18.near { transform: translateY(24%); opacity: .42; }

.mr-valley-haze-v18 {
  background: linear-gradient(180deg, transparent 30%, rgba(235,248,253,.08) 56%, rgba(225,243,250,.72) 100%);
}

.mountain-race-game {
  max-width: 980px;
  margin-inline: auto;
  color: #f7fbff;
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
}

.mountain-race-game .mr-titlebar {
  width: min(92%, 760px);
  margin: 4px auto 10px;
  min-height: 84px;
  padding: 12px 92px 12px 28px;
  border: 2px solid rgba(107,213,255,.82);
  border-radius: 24px;
  clip-path: polygon(4% 0,96% 0,100% 50%,96% 100%,4% 100%,0 50%);
  background: linear-gradient(180deg, rgba(22,49,69,.98), rgba(4,18,31,.98));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.24), inset 0 -10px 24px rgba(0,0,0,.32), 0 7px 0 rgba(0,15,26,.56), 0 18px 36px rgba(0,22,40,.3), 0 0 22px rgba(43,184,239,.24);
}

.mountain-race-game .mr-titlebar p { color: #a9dff5; letter-spacing: .18em; font-size: 11px; }
.mountain-race-game .mr-titlebar h2 { font-size: clamp(28px, 5.4vw, 48px); letter-spacing: .06em; line-height: 1; text-shadow: 0 3px 0 rgba(0,0,0,.5), 0 0 18px rgba(85,203,255,.22); }

.mountain-race-game .mr-race-clock {
  right: 18px;
  width: 64px;
  min-width: 64px;
  border: 1px solid rgba(255,213,109,.78);
  border-radius: 14px;
  background: linear-gradient(180deg, #2b3c48, #111b23);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.18), 0 5px 12px rgba(0,0,0,.35);
}

.mountain-race-game .mr-race-stage { position: relative; z-index: 11; gap: 14px; padding: 0 clamp(4px, 1vw, 10px); align-items: stretch; }
.mountain-race-game .mr-race-stage::before {
  content: '';
  position: absolute;
  z-index: 4;
  top: 74px;
  bottom: 12px;
  left: 50%;
  width: 18px;
  transform: translateX(-50%);
  border-radius: 50%;
  background: linear-gradient(90deg, rgba(2,8,13,.82), #02070b 48%, rgba(2,8,13,.82));
  box-shadow: 0 0 22px rgba(0,0,0,.74), inset 0 0 8px rgba(72,160,197,.08);
}

.mountain-race-game .mr-lane { position: relative; z-index: 6; min-width: 0; border: 0 !important; border-radius: 0 !important; background: transparent !important; box-shadow: none !important; overflow: visible; }
.mountain-race-game .mr-lane.me { --mr-lane-accent: var(--mr-you-accent); --mr-lane-deep: var(--mr-you-deep); }
.mountain-race-game .mr-lane.opponent { --mr-lane-accent: var(--mr-opponent-accent); --mr-lane-deep: var(--mr-opponent-deep); }

.mountain-race-game .mr-player-card {
  min-height: 64px;
  margin: 0 4px 8px;
  padding: 9px 12px;
  border: 1px solid color-mix(in srgb, var(--mr-lane-accent) 72%, white 12%);
  border-radius: 17px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--mr-lane-deep) 82%, #05111c), rgba(5,17,28,.97));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.18), inset 0 -10px 18px rgba(0,0,0,.25), 0 7px 16px rgba(0,0,0,.25), 0 0 14px color-mix(in srgb, var(--mr-lane-accent) 26%, transparent);
}

.mountain-race-game .mr-player-badge {
  border: 2px solid rgba(255,255,255,.78);
  background: radial-gradient(circle at 35% 28%, #fff, var(--mr-lane-accent) 25%, var(--mr-lane-deep) 72%);
  box-shadow: 0 3px 8px rgba(0,0,0,.4), 0 0 10px color-mix(in srgb, var(--mr-lane-accent) 44%, transparent);
}

.mountain-race-game .mr-player-copy strong { font-size: 14px; letter-spacing: .04em; }
.mountain-race-game .mr-player-copy small { color: rgba(237,248,255,.68); }
.mountain-race-game .mr-player-progress { color: #fff; font-weight: 950; text-shadow: 0 2px 0 rgba(0,0,0,.45); }

.mountain-race-game .mr-climb-viewport {
  min-height: clamp(530px, 71vh, 760px);
  border: 2px solid rgba(238,248,255,.42);
  border-radius: 28px 28px 20px 20px;
  background: #342417;
  box-shadow: inset 0 0 0 1px rgba(0,0,0,.34), inset 0 0 38px rgba(0,0,0,.22), 0 18px 32px rgba(13,30,40,.3), 0 3px 0 rgba(255,255,255,.22);
  overflow: hidden;
}

.mountain-race-game .mr-mountain-wall { filter: saturate(1.05) contrast(1.1) brightness(1.02); }
.mountain-race-game .mr-mountain-wall::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background: linear-gradient(102deg, rgba(255,233,191,.18), transparent 28% 70%, rgba(20,10,5,.31)), radial-gradient(ellipse at 18% 8%, rgba(255,247,220,.19), transparent 30%), linear-gradient(180deg, transparent 0 74%, rgba(18,10,5,.17));
  mix-blend-mode: soft-light;
}

.mountain-race-game .mr-altitude-meter { display: none; }
.mountain-race-game .mr-rock-hold { z-index: 8; transition: transform 120ms ease, filter 120ms ease, opacity 120ms ease; }
.mountain-race-game .mr-rock-hold.unknown { opacity: .5; transform: translateX(-50%) scale(.82) rotate(var(--mr-hold-rotation, 0deg)); }
.mountain-race-game .mr-rock-hold.unknown b { display: none !important; }
.mountain-race-game .mr-rock-hold.known { opacity: 1; transform: translateX(-50%) scale(.96); }
.mountain-race-game .mr-rock-hold.current { transform: translateX(-50%) scale(1.12); }

.mountain-race-game .mr-rock-hold b {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 33px;
  height: 33px;
  transform: translate(-50%, -53%);
  display: grid;
  place-items: center;
  border: 2px solid rgba(225,245,255,.85);
  border-radius: 50%;
  background: radial-gradient(circle at 34% 26%, rgba(255,255,255,.35), transparent 24%), linear-gradient(180deg, #1a4057, #071722 72%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.3), inset 0 -5px 9px rgba(0,0,0,.45), 0 3px 0 rgba(0,0,0,.58), 0 0 10px rgba(70,196,245,.34);
}

.mountain-race-game .mr-rock-hold.current b {
  width: 37px;
  height: 37px;
  border-color: #fff1b2;
  background: radial-gradient(circle at 34% 25%, rgba(255,255,255,.62), transparent 24%), linear-gradient(180deg, #d8942b, #7c3b09 72%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.42), inset 0 -6px 10px rgba(62,24,0,.46), 0 4px 0 rgba(57,23,0,.64), 0 0 10px rgba(255,216,112,.88), 0 0 22px rgba(255,151,44,.55);
}

.mr-direction-glyph-v18 { width: 21px; height: 21px; overflow: visible; filter: drop-shadow(0 2px 1px rgba(0,0,0,.55)); }
.mr-direction-glyph-v18 .mr-glyph-shadow-v18 { fill: rgba(0,0,0,.6); transform: translateY(1.5px); transform-origin: center; }
.mr-direction-glyph-v18 .mr-glyph-face-v18 { fill: #f8fcff; stroke: rgba(255,255,255,.86); stroke-width: .75; stroke-linejoin: round; }
.mr-direction-glyph-v18 .mr-glyph-shine-v18 { fill: none; stroke: rgba(255,255,255,.7); stroke-width: 1.2; stroke-linecap: round; opacity: .62; }

.mountain-race-game .mr-command-deck {
  position: relative;
  z-index: 20;
  width: min(96%, 790px);
  margin: -8px auto 0;
  padding: 16px;
  border: 2px solid rgba(103,199,238,.52);
  border-radius: 26px;
  background: linear-gradient(180deg, rgba(16,35,48,.98), rgba(4,12,20,.99));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.18), inset 0 -12px 24px rgba(0,0,0,.31), 0 -4px 18px rgba(0,0,0,.18), 0 16px 34px rgba(0,16,28,.38);
}

.mountain-race-game .mr-next-moves { gap: 8px; }
.mountain-race-game .mr-prompt-label { color: #eaf8ff; letter-spacing: .14em; }
.mountain-race-game .mr-prompt {
  min-width: 58px;
  min-height: 62px;
  border: 1px solid rgba(118,207,242,.48);
  border-radius: 15px;
  background: linear-gradient(180deg, #193549, #081621);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.14), 0 5px 10px rgba(0,0,0,.25);
}

.mountain-race-game .mr-prompt.active {
  border-color: #ffe18a;
  background: linear-gradient(180deg, #d58d26, #743707);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.28), 0 5px 0 #492000, 0 0 17px rgba(255,175,52,.48);
}

.mountain-race-game .mr-prompt b,
.mountain-race-game .mr-control b { display: grid; place-items: center; line-height: 1; }
.mountain-race-game .mr-prompt .mr-direction-glyph-v18 { width: 27px; height: 27px; }
.mountain-race-game .mr-direction-pad { grid-template-columns: repeat(4, minmax(54px, 1fr)); gap: 10px; }

.mountain-race-game .mr-control {
  min-height: 76px;
  border: 2px solid rgba(120,211,247,.62);
  border-radius: 18px;
  background: radial-gradient(circle at 28% 18%, rgba(255,255,255,.12), transparent 25%), linear-gradient(180deg, #15364c, #06131e 76%);
  color: #f8fcff;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.2), inset 0 -8px 14px rgba(0,0,0,.35), 0 6px 0 #03101a, 0 10px 18px rgba(0,0,0,.32), 0 0 12px rgba(53,178,229,.16);
  transition: transform 80ms ease, box-shadow 80ms ease, filter 80ms ease;
}

.mountain-race-game .mr-control:not(:disabled):active { transform: translateY(5px); box-shadow: inset 0 1px 0 rgba(255,255,255,.18), inset 0 -4px 9px rgba(0,0,0,.28), 0 1px 0 #03101a; }
.mountain-race-game .mr-control .mr-direction-glyph-v18 { width: 34px; height: 34px; }
.mountain-race-game .mr-control small { color: rgba(225,244,252,.68); font-weight: 850; letter-spacing: .1em; }
.mountain-race-game .mr-climber { z-index: 14; filter: drop-shadow(0 8px 5px rgba(0,0,0,.46)); }
.mountain-race-game .mr-climber-body { box-shadow: inset 3px 1px 0 rgba(255,255,255,.19), inset -4px -4px 0 rgba(0,0,0,.24), 0 0 0 2px rgba(8,16,21,.86); }
.mountain-race-game .mr-climber-body::after { content: ''; position: absolute; left: 50%; bottom: -3px; width: 24px; height: 8px; transform: translateX(-50%); border: 2px solid #d6a34c; border-radius: 3px 3px 7px 7px; box-shadow: 0 2px 0 rgba(0,0,0,.36); }

@media (max-width: 620px) {
  .mountain-race-game .mr-titlebar { width: calc(100% - 10px); min-height: 66px; padding: 9px 68px 9px 19px; border-radius: 18px; }
  .mountain-race-game .mr-titlebar h2 { font-size: clamp(23px, 8vw, 34px); }
  .mountain-race-game .mr-titlebar p { font-size: 9px; }
  .mountain-race-game .mr-race-clock { right: 10px; width: 52px; min-width: 52px; }
  .mountain-race-game .mr-race-stage { gap: 7px; padding-inline: 0; }
  .mountain-race-game .mr-race-stage::before { width: 10px; }
  .mountain-race-game .mr-player-card { min-height: 55px; margin-inline: 1px; padding: 7px 8px; }
  .mountain-race-game .mr-player-copy strong { font-size: 11px; }
  .mountain-race-game .mr-player-copy small { font-size: 8px; }
  .mountain-race-game .mr-player-progress { font-size: 10px; }
  .mountain-race-game .mr-climb-viewport { min-height: clamp(480px, 66vh, 680px); border-radius: 20px 20px 14px 14px; }
  .mountain-race-game .mr-command-deck { width: 100%; padding: 11px 8px; border-radius: 20px; }
  .mountain-race-game .mr-prompt { min-width: 48px; min-height: 54px; }
  .mountain-race-game .mr-direction-pad { gap: 6px; }
  .mountain-race-game .mr-control { min-height: 66px; border-radius: 14px; padding-inline: 4px; }
  .mountain-race-game .mr-control .mr-direction-glyph-v18 { width: 29px; height: 29px; }
  .mountain-race-game .mr-control small { font-size: 8px; }
}

@media (prefers-reduced-motion: reduce) {
  .mountain-race-game .mr-control,
  .mountain-race-game .mr-rock-hold { transition: none !important; }
}
`;
}

if (!html.includes(marker)) {
  html += `\n<!-- ${marker} -->\n`;
}

html = html.replace(/assets\/mountain-race\/mountain-race\.(?:css|js)[^"'\s>]*/g, match => setConceptCache(match));

await Promise.all([
  writeFile(cssUrl, css),
  writeFile(runtimeUrl, runtime),
  writeFile(indexUrl, html)
]);

console.log('Summit Sprint Concept Target V18 applied.');
