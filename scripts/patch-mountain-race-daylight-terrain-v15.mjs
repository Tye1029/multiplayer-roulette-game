import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', root);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const indexUrl = new URL('index.html', root);
const marker = 'MOUNTAIN_RACE_DAYLIGHT_TERRAIN_V15';

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint Daylight Terrain V15 patch failed: ${message}`);
}

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint Daylight Terrain V15 could not find ${label}.`);
  return source.replace(before, after);
}

function setTerrainCache(url) {
  if (/([?&])terrain=\d+/.test(url)) return url.replace(/([?&])terrain=\d+/, '$1terrain=15');
  return `${url}${url.includes('?') ? '&' : '?'}terrain=15`;
}

let [css, runtime, html] = await Promise.all([
  readFile(cssUrl, 'utf8'),
  readFile(runtimeUrl, 'utf8'),
  readFile(indexUrl, 'utf8')
]);

if (!runtime.includes(marker)) {
  runtime = replaceRequired(
    runtime,
    '  // MOUNTAIN_RACE_VISUAL_REBUILD_V14',
    `  // MOUNTAIN_RACE_VISUAL_REBUILD_V14\n  // ${marker}`,
    'V14 runtime marker'
  );

  runtime = replaceRequired(
    runtime,
    `    return Array.from({ length: total }, (_, index) => {`,
    `    const startMeadow = '<div class="mr-start-meadow" style="--mr-start-bottom:38px" aria-hidden="true"><span></span><i></i></div>';
    return startMeadow + Array.from({ length: total }, (_, index) => {`,
    'starting meadow markup'
  );

  runtime = replaceRequired(
    runtime,
    `    }).join('') + \`<span class="mr-finish-ledge" style="--mr-summit-bottom:\${86 + total * 58}px" aria-hidden="true"><i></i><b>SUMMIT</b></span>\`;`,
    `    }).join('') + \`<span class="mr-finish-ledge mr-summit-plateau" style="--mr-summit-bottom:\${86 + total * 58}px" aria-hidden="true"><span class="mr-summit-turf"></span><i></i><b>SUMMIT</b></span>\`;`,
    'flat grassy summit markup'
  );

  runtime = replaceRequired(
    runtime,
    `  function renderClimber(raw, side, animation) {
    const bottom = 62 + Math.max(0, Number(raw.promptIndex) || 0) * 58;
    return \`
      <div class="mr-climber \${side} \${animation} direction-\${control(raw.lastInput?.control)}" style="--mr-climber-bottom:\${bottom}px" aria-label="\${escapeHtml(raw.name)} climber">`,
    `  function renderClimber(raw, side, animation, total) {
    const index = Math.max(0, Number(raw.promptIndex) || 0);
    const finished = Boolean(raw.finishedAt) || index >= Number(total || 0);
    const bottom = finished ? 148 + Number(total || 0) * 58 : 62 + index * 58;
    const finishClass = finished ? 'finished standing-on-summit' : '';
    return \`
      <div class="mr-climber \${side} \${animation} \${finishClass} direction-\${control(raw.lastInput?.control)}" style="--mr-climber-bottom:\${bottom}px" data-mr-finished="\${finished ? '1' : '0'}" aria-label="\${escapeHtml(raw.name)} climber">`,
    'finished climber summit position'
  );

  runtime = replaceRequired(
    runtime,
    '            ${renderClimber(p, side, animation)}',
    '            ${renderClimber(p, side, animation, total)}',
    'render lane climber total'
  );
}

if (!css.includes(marker)) {
  css += String.raw`

/* MOUNTAIN_RACE_DAYLIGHT_TERRAIN_V15
   Clear daytime sky, brown procedural rock, grassy base camp and summit,
   plus a true standing position for climbers who finish the route. */

[data-mountain-race-mount] {
  background: #70bde9;
}

[data-mountain-race-mount] > .mr-world-layer {
  background:
    radial-gradient(circle at 78% 15%, rgba(255,255,255,.72), transparent 9%),
    linear-gradient(180deg, #54b4ed 0%, #79c9f3 38%, #b8e4f7 72%, #d9eff7 100%);
}

[data-mountain-race-mount] > .mr-world-layer::before {
  inset: 5% -10% 48%;
  opacity: .9;
  background:
    radial-gradient(ellipse at 18% 42%, rgba(255,255,255,.58), transparent 18%),
    radial-gradient(ellipse at 52% 64%, rgba(255,255,255,.48), transparent 22%),
    radial-gradient(ellipse at 84% 34%, rgba(255,255,255,.55), transparent 17%);
  filter: blur(18px);
}

[data-mountain-race-mount] > .mr-world-layer::after {
  height: 28%;
  background:
    radial-gradient(ellipse at 30% 78%, rgba(64,113,69,.24), transparent 36%),
    radial-gradient(ellipse at 74% 76%, rgba(77,124,74,.2), transparent 38%),
    linear-gradient(180deg, transparent, rgba(58,93,65,.16));
  filter: blur(8px);
}

.mr-world-moon,
.mr-world-stars,
.mr-world-snow,
.mr-world-vignette {
  display: none !important;
}

.mr-world-cloud {
  display: block;
  z-index: 6;
  height: 120px;
  opacity: .72;
  background: radial-gradient(ellipse, rgba(255,255,255,.7), rgba(238,248,253,.38) 54%, transparent 74%);
  filter: blur(14px);
}

.mr-world-range-far {
  height: 39%;
  bottom: 28%;
  opacity: .64;
  background:
    linear-gradient(114deg, transparent 0 28%, rgba(231,244,246,.34) 28.5% 30%, transparent 30.5%),
    linear-gradient(180deg, #7896a0 0%, #5f7f7d 50%, #3e655c 100%);
}

.mr-world-range-mid {
  height: 35%;
  bottom: 8%;
  opacity: .86;
  background:
    linear-gradient(112deg, transparent 0 24%, rgba(190,215,202,.28) 24.5% 27%, transparent 27.5%),
    linear-gradient(180deg, #6d826c 0%, #4d694e 48%, #2e4935 100%);
  box-shadow: 0 -18px 50px rgba(83,126,121,.22);
}

.mountain-race-game {
  --mr-rock-black: #2b1b11;
  --mr-rock-dark: #4a2f1e;
  --mr-rock-mid: #765137;
  --mr-rock-light: #a17a55;
  --mr-snow: #75a94e;
  border-color: rgba(91,68,48,.5);
  background:
    linear-gradient(180deg, rgba(188,229,247,.08), rgba(111,171,198,.08) 48%, rgba(59,91,69,.18)),
    radial-gradient(ellipse at 50% 42%, transparent 0 42%, rgba(56,35,22,.12) 78%, rgba(36,21,13,.28) 100%);
  box-shadow:
    0 30px 86px rgba(36,45,39,.34),
    inset 0 1px 0 rgba(255,255,255,.28),
    inset 0 -90px 120px rgba(69,47,28,.18);
}

.mr-titlebar {
  border-color: rgba(72,53,37,.42);
  background:
    linear-gradient(105deg, rgba(68,43,27,.96), rgba(105,75,50,.94) 55%, rgba(57,36,23,.97)),
    linear-gradient(90deg, rgba(255,227,183,.08), transparent 50%);
  box-shadow:
    0 12px 30px rgba(64,43,27,.28),
    inset 0 1px rgba(255,244,221,.18),
    inset 0 -3px rgba(44,25,14,.28);
}

.mr-expedition-heading > p,
.mr-titlebar p { color: #e8cfaa; }
.mr-expedition-meta { color: rgba(242,224,194,.78); }

.mr-race-stage::before {
  opacity: .92;
  background:
    radial-gradient(ellipse at 25% 20%, rgba(206,164,112,.2), transparent 18%),
    radial-gradient(ellipse at 72% 52%, rgba(52,29,15,.22), transparent 20%),
    repeating-linear-gradient(121deg, transparent 0 31px, rgba(46,25,14,.16) 32px 34px, transparent 35px 68px),
    linear-gradient(90deg, #3d2517, #815c3c 46%, #67452d 62%, #2d1b11);
  filter: drop-shadow(0 -16px 28px rgba(55,35,22,.48));
}

.mr-stage-ridge::before {
  background:
    repeating-linear-gradient(112deg, transparent 0 22px, rgba(206,163,110,.12) 23px 25px, transparent 26px 48px),
    linear-gradient(90deg, #342014, #6f4b31 42%, #4f321f 58%, #26170f);
  filter: drop-shadow(0 0 14px rgba(48,29,17,.68));
}

.mr-stage-ridge > i {
  background: linear-gradient(transparent, rgba(231,201,160,.34) 18%, rgba(108,73,47,.2) 84%, transparent);
}

.mr-ridge-beacon {
  background: #f7df86;
  box-shadow: 0 0 10px #efb94d, 0 0 28px rgba(238,175,62,.72), 0 0 58px rgba(235,158,38,.3);
}

.mr-lane.me::before,
.mr-lane.is-me::before,
.mr-lane.opponent::before,
.mr-lane.is-opponent::before {
  background:
    radial-gradient(ellipse at 18% 16%, rgba(218,174,119,.24), transparent 16%),
    radial-gradient(ellipse at 78% 31%, rgba(64,36,19,.24), transparent 20%),
    radial-gradient(ellipse at 34% 63%, rgba(191,139,88,.16), transparent 18%),
    repeating-linear-gradient(116deg, transparent 0 27px, rgba(55,31,17,.18) 28px 31px, transparent 32px 61px),
    repeating-linear-gradient(63deg, transparent 0 35px, rgba(230,188,132,.09) 36px 38px, transparent 39px 72px),
    linear-gradient(103deg, #67452b, #3d2618 39%, #805a3a 63%, #301c11);
  box-shadow:
    inset 18px 0 34px rgba(61,35,20,.22),
    inset -22px 0 38px rgba(38,21,12,.42),
    0 16px 30px rgba(63,43,28,.32);
}

.mr-lane.me::before,
.mr-lane.is-me::before { border-left-color: rgba(112,155,76,.44); }
.mr-lane.opponent::before,
.mr-lane.is-opponent::before { border-right-color: rgba(178,111,65,.34); }

.mr-climb-viewport {
  background:
    linear-gradient(180deg, rgba(125,199,235,.5) 0 15%, rgba(174,219,237,.28) 24%, rgba(92,66,42,.06) 52%, rgba(57,37,23,.2) 100%);
  box-shadow:
    inset 13px 0 26px rgba(69,43,25,.16),
    inset -15px 0 30px rgba(56,33,19,.26),
    0 16px 30px rgba(70,51,34,.24);
}

.mr-mountain-wall {
  background:
    radial-gradient(ellipse at 19% 12%, rgba(224,181,124,.28), transparent 17%),
    radial-gradient(ellipse at 77% 23%, rgba(61,34,18,.3), transparent 21%),
    radial-gradient(ellipse at 38% 47%, rgba(187,133,82,.2), transparent 18%),
    radial-gradient(ellipse at 73% 69%, rgba(55,31,17,.28), transparent 22%),
    repeating-linear-gradient(117deg, rgba(229,190,139,.08) 0 2px, transparent 3px 31px),
    repeating-linear-gradient(61deg, rgba(47,26,14,.2) 0 2px, transparent 3px 37px),
    linear-gradient(104deg, #916a46, #4b301e 36%, #795238 66%, #342015);
  filter: saturate(1.02) contrast(1.08);
  box-shadow:
    inset 19px 0 34px rgba(61,36,20,.22),
    inset -20px 0 36px rgba(43,24,13,.4),
    0 0 24px rgba(74,49,31,.28);
}

.mr-mountain-wall::before {
  background:
    linear-gradient(18deg, transparent 0 26%, rgba(55,30,16,.25) 26.5% 28%, transparent 28.5%),
    linear-gradient(151deg, transparent 0 44%, rgba(232,193,142,.13) 44.5% 46%, transparent 46.5%),
    linear-gradient(32deg, transparent 0 73%, rgba(58,32,17,.24) 73.5% 75%, transparent 75.5%),
    repeating-radial-gradient(ellipse at 40% 50%, rgba(47,27,15,.08) 0 2px, transparent 3px 17px);
  opacity: .95;
}

.mr-mountain-wall::after {
  top: 0;
  left: 5%;
  right: 5%;
  height: 82px;
  clip-path: polygon(0 44%, 8% 25%, 22% 31%, 35% 14%, 50% 20%, 64% 9%, 79% 27%, 91% 18%, 100% 35%, 96% 100%, 3% 100%);
  background:
    repeating-linear-gradient(93deg, #92c966 0 5px, #5b963e 6px 9px, #78b653 10px 14px),
    linear-gradient(180deg, #75b54d 0 34%, #5d3b23 35% 60%, #3e2516 100%);
  filter: drop-shadow(0 6px 5px rgba(64,40,23,.34));
}

.mr-route-ice {
  width: 24%;
  opacity: .34;
  background:
    linear-gradient(90deg, transparent, rgba(213,198,168,.12) 38%, rgba(239,221,187,.2) 48%, rgba(102,72,43,.08) 62%, transparent),
    repeating-linear-gradient(178deg, transparent 0 31px, rgba(238,209,167,.08) 32px 33px, transparent 34px 58px);
}

.mr-rope-line {
  background: repeating-linear-gradient(180deg, #dc8f3f 0 7px, #6c3218 8px 12px, #f0aa58 13px 17px);
}

.mr-rock-hold {
  border-color: rgba(74,43,24,.5);
  background:
    radial-gradient(circle at 27% 25%, rgba(237,202,156,.22), transparent 23%),
    linear-gradient(145deg, #a77b51, #68452d 49%, #382216);
  box-shadow:
    inset 2px 2px 2px rgba(241,211,169,.2),
    inset -3px -4px 5px rgba(49,27,14,.48),
    0 5px 8px rgba(58,36,22,.38);
}

.mr-start-meadow {
  position: absolute;
  z-index: 8;
  left: 50%;
  bottom: var(--mr-start-bottom, 38px);
  width: 88%;
  height: 66px;
  transform: translate(-50%, 50%);
  border-radius: 48% 52% 18px 18px;
  background:
    repeating-linear-gradient(92deg, #8bc05c 0 5px, #5f963f 6px 9px, #76ad4c 10px 14px),
    linear-gradient(180deg, #78ae4e 0 28%, #795237 29% 62%, #422919 100%);
  box-shadow:
    0 8px 0 #372116,
    0 14px 19px rgba(58,39,25,.42),
    inset 0 4px rgba(190,226,139,.22);
  pointer-events: none;
}

.mr-start-meadow::before,
.mr-start-meadow::after,
.mr-start-meadow span,
.mr-start-meadow i {
  content: '';
  position: absolute;
  top: -14px;
  width: 3px;
  height: 22px;
  border-radius: 80% 20% 60% 40%;
  background: #5e9d3b;
  transform-origin: 50% 100%;
}

.mr-start-meadow::before { left: 16%; transform: rotate(-18deg); box-shadow: 16px 5px #7ab94c, 34px 0 #4f8c32, 57px 6px #88c358; }
.mr-start-meadow::after { right: 17%; transform: rotate(16deg); box-shadow: -17px 4px #75ae47, -38px -1px #548f34, -59px 6px #86bd50; }
.mr-start-meadow span { left: 44%; transform: rotate(-8deg); box-shadow: 12px 3px #78b247, 25px 0 #5c9938; }
.mr-start-meadow i { left: 66%; transform: rotate(11deg); box-shadow: 11px 5px #83bd50; }

.mr-finish-ledge.mr-summit-plateau {
  z-index: 9;
  width: 88%;
  height: 58px;
  border: 2px solid #4d321f;
  border-radius: 14px 14px 34% 34%;
  color: #f8f2db;
  background:
    linear-gradient(180deg, #75ad4b 0 22%, #6f4b30 23% 62%, #3d2517 100%);
  box-shadow:
    0 9px 0 #2f1c11,
    0 15px 22px rgba(55,35,22,.42),
    inset 0 4px rgba(194,229,143,.22);
}

.mr-summit-turf {
  position: absolute;
  z-index: 2;
  left: -2%;
  right: -2%;
  top: -8px;
  height: 18px;
  border-radius: 50% 50% 7px 7px;
  background:
    repeating-linear-gradient(94deg, #8ac35b 0 5px, #5f9c3d 6px 9px, #7db84f 10px 14px),
    linear-gradient(180deg, #8bc45c, #5f963e);
  box-shadow: 0 4px rgba(62,91,40,.36);
}

.mr-finish-ledge.mr-summit-plateau b {
  position: relative;
  z-index: 3;
  padding: 3px 8px;
  border-radius: 5px;
  color: #fff8dc;
  background: rgba(65,42,25,.82);
  text-shadow: 0 2px rgba(35,20,11,.72);
}

.mr-finish-ledge.mr-summit-plateau i {
  z-index: 4;
  bottom: 47px;
  background: #694528;
}

.mr-climber.finished,
.mr-climber.standing-on-summit {
  z-index: 14;
  transform: translate(-50%, 50%);
  filter: drop-shadow(0 7px 5px rgba(55,35,22,.48));
}

.mr-climber.finished .left-leg,
.mr-climber.finished .right-leg,
.mr-climber.standing-on-summit .left-leg,
.mr-climber.standing-on-summit .right-leg {
  top: 44px;
  height: 23px;
  transform: rotate(0deg);
}

.mr-climber.finished .left-leg,
.mr-climber.standing-on-summit .left-leg { left: 10px; }
.mr-climber.finished .right-leg,
.mr-climber.standing-on-summit .right-leg { right: 10px; }

.mr-climber.finished.waiting,
.mr-climber.standing-on-summit.waiting {
  animation: none;
}

.mr-climber.finished.celebrate,
.mr-climber.standing-on-summit.celebrate {
  animation: mrSummitStand 1.05s ease-in-out infinite alternate;
}

@keyframes mrSummitStand {
  from { transform: translate(-50%, 50%) translateY(0) rotate(-1deg); }
  to { transform: translate(-50%, 50%) translateY(-4px) rotate(1deg); }
}

.mr-command-deck {
  border-color: rgba(80,55,37,.44);
  background:
    linear-gradient(108deg, rgba(60,39,25,.97), rgba(101,72,48,.95) 52%, rgba(52,33,21,.98)),
    linear-gradient(90deg, rgba(255,225,179,.07), transparent 50%);
  box-shadow: inset 0 1px rgba(255,240,213,.12), 0 15px 30px rgba(62,42,27,.28);
}

.mr-player-card,
.mr-player-strip {
  border-color: rgba(99,70,47,.5);
  background: linear-gradient(180deg, rgba(84,58,39,.98), rgba(50,31,20,.98));
  box-shadow: inset 0 1px rgba(255,232,195,.13), 0 10px 21px rgba(62,41,27,.34);
}

.mr-overlay {
  background: rgba(48,69,58,.58);
}

.mr-overlay-card {
  border-color: rgba(95,68,46,.54);
  background: linear-gradient(180deg, rgba(91,64,43,.98), rgba(49,31,20,.99));
}

@media (max-width: 720px) {
  .mr-world-range-far { height: 33%; bottom: 38%; }
  .mr-world-range-mid { height: 31%; bottom: 20%; }
  .mr-start-meadow { width: 92%; height: 56px; }
  .mr-finish-ledge.mr-summit-plateau { width: 93%; height: 52px; }
  .mr-summit-turf { height: 15px; top: -7px; }
}

@media (max-width: 430px) {
  .mr-world-cloud-b { display: none; }
  .mr-start-meadow::before,
  .mr-start-meadow::after { opacity: .8; }
}
`;
}

html = html.replace(/assets\/mountain-race\/mountain-race\.css(?:\?[^"'<>\s]*)?/g, setTerrainCache);
html = html.replace(/assets\/mountain-race\/mountain-race-multiplayer\.js(?:\?[^"'<>\s]*)?/g, setTerrainCache);

const htmlMarker = `<!-- ${marker} -->`;
if (!html.includes(htmlMarker)) {
  const boundary = html.includes('</body>') ? '</body>' : '</html>';
  assert(html.includes(boundary), 'document closing boundary is missing');
  html = html.replace(boundary, `${htmlMarker}\n${boundary}`);
}

for (const required of [
  marker,
  'mr-start-meadow',
  'mr-summit-plateau',
  'mr-summit-turf',
  'standing-on-summit',
  'renderClimber(p, side, animation, total)',
  'terrain=15'
]) {
  assert(runtime.includes(required) || css.includes(required) || html.includes(required), `generated V15 output is missing ${required}`);
}
assert(runtime.includes('finished ? 148 + Number(total || 0) * 58'), 'finished climber does not stand on the summit plane');
assert(runtime.includes('data-mr-finished='), 'finished climber diagnostic marker is missing');
assert(!runtime.includes('root.innerHTML = `'), 'V14 persistent mount protection was displaced');

await Promise.all([
  writeFile(cssUrl, css),
  writeFile(runtimeUrl, runtime),
  writeFile(indexUrl, html)
]);

console.log('Applied Summit Sprint Daylight Terrain V15: clear blue sky, brown procedural rock, grassy base camp, flat grassy summit, and finished climbers standing on the mountain top without changing authoritative gameplay.');
