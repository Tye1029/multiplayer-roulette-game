import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', root);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const indexUrl = new URL('index.html', root);
const marker = 'MOUNTAIN_RACE_VISUAL_REBUILD_V14';

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint Visual Rebuild V14 patch failed: ${message}`);
}

function setVisualCache(url) {
  if (/([?&])visual=\d+/.test(url)) return url.replace(/([?&])visual=\d+/, '$1visual=14');
  return `${url}${url.includes('?') ? '&' : '?'}visual=14`;
}

let [css, runtime, html] = await Promise.all([
  readFile(cssUrl, 'utf8'),
  readFile(runtimeUrl, 'utf8'),
  readFile(indexUrl, 'utf8')
]);

if (!runtime.includes(marker)) {
  const v13Marker = '  /* MOUNTAIN_RACE_VISUAL_FOUNDATION_V13 */';
  assert(runtime.includes(v13Marker), 'Visual Foundation V13 must run before V14');
  runtime = runtime.replace(v13Marker, `${v13Marker}\n  // ${marker}`);

  const worldStartToken = '        <div class="mr-world-layer" aria-hidden="true">';
  const headerToken = '        <header class="mr-titlebar">';
  const worldStart = runtime.indexOf(worldStartToken);
  const headerStart = runtime.indexOf(headerToken, worldStart);
  assert(worldStart >= 0 && headerStart > worldStart, 'embedded V13 world markup was not found');

  const worldMarkup = runtime.slice(worldStart, headerStart).trim();
  runtime = runtime.slice(0, worldStart) + runtime.slice(headerStart);

  const renderToken = '  function render() {';
  const renderStart = runtime.indexOf(renderToken);
  assert(renderStart >= 0, 'render function was not found');

  const helper = `  const MOUNTAIN_RACE_WORLD_V14 = ${JSON.stringify(worldMarkup)};\n\n  function ensureMountainRaceWorld(root) {\n    let world = root.querySelector(':scope > .mr-world-layer');\n    if (!world) {\n      root.insertAdjacentHTML('afterbegin', MOUNTAIN_RACE_WORLD_V14);\n      world = root.querySelector(':scope > .mr-world-layer');\n    }\n    root.dataset.mrVisualStable = '14';\n    return world;\n  }\n\n`;
  runtime = runtime.slice(0, renderStart) + helper + runtime.slice(renderStart);

  const assignmentToken = '    root.innerHTML = `';
  const assignmentStart = runtime.indexOf(assignmentToken, renderStart + helper.length);
  assert(assignmentStart >= 0, 'whole-root render assignment was not found');
  runtime = runtime.slice(0, assignmentStart)
    + `    ensureMountainRaceWorld(root);\n    const previousGameElement = root.querySelector(':scope > .mountain-race-game');\n    const nextGameMarkup = \``
    + runtime.slice(assignmentStart + assignmentToken.length);

  const templateEnd = runtime.indexOf('`;\n  }', assignmentStart);
  assert(templateEnd >= 0, 'render template closing boundary was not found');
  runtime = runtime.slice(0, templateEnd) + `\`;\n    const template = document.createElement('template');\n    template.innerHTML = nextGameMarkup.trim();\n    const nextGameElement = template.content.firstElementChild;\n    if (!nextGameElement) return;\n    if (previousGameElement) {\n      previousGameElement.className = nextGameElement.className;\n      for (const name of previousGameElement.getAttributeNames()) {\n        if (name !== 'class' && !nextGameElement.hasAttribute(name)) previousGameElement.removeAttribute(name);\n      }\n      for (const attribute of nextGameElement.attributes) {\n        if (attribute.name !== 'class') previousGameElement.setAttribute(attribute.name, attribute.value);\n      }\n      previousGameElement.replaceChildren(...nextGameElement.childNodes);\n    } else {\n      root.append(nextGameElement);\n    }\n  }` + runtime.slice(templateEnd + '`;\n  }'.length);
}

if (!css.includes(marker)) {
  css += String.raw`

/* MOUNTAIN_RACE_VISUAL_REBUILD_V14
   Visible alpine reconstruction plus a persistent atmosphere compositor.
   The world layer now survives gameplay renders and no live panel uses
   backdrop-filter, preventing Android white-frame flashes. */

[data-mountain-race-mount] {
  position: relative;
  isolation: isolate;
  display: block;
  width: 100%;
  min-height: 720px;
  overflow: hidden;
  border-radius: 26px;
  background: #020713;
  contain: layout paint;
  transform: translateZ(0);
  backface-visibility: hidden;
}

[data-mountain-race-mount] > .mr-world-layer {
  inset: 0;
  z-index: 0;
  overflow: hidden;
  border-radius: inherit;
  background:
    radial-gradient(circle at 77% 12%, rgba(161, 222, 248, .34), transparent 17%),
    radial-gradient(ellipse at 50% 54%, rgba(25, 85, 116, .3), transparent 48%),
    linear-gradient(180deg, #071c34 0%, #09263d 27%, #071724 58%, #02070d 100%);
  transform: translateZ(0);
  backface-visibility: hidden;
}

[data-mountain-race-mount] > .mr-world-layer::before,
[data-mountain-race-mount] > .mr-world-layer::after {
  content: '';
  position: absolute;
  pointer-events: none;
}

[data-mountain-race-mount] > .mr-world-layer::before {
  z-index: 1;
  inset: 8% -12% 38%;
  opacity: .72;
  background:
    radial-gradient(ellipse at 72% 23%, rgba(112, 213, 239, .28), transparent 34%),
    radial-gradient(ellipse at 31% 60%, rgba(59, 153, 189, .18), transparent 40%);
  filter: blur(28px);
}

[data-mountain-race-mount] > .mr-world-layer::after {
  z-index: 8;
  left: -10%;
  right: -10%;
  bottom: -6%;
  height: 38%;
  background:
    radial-gradient(ellipse at 28% 72%, rgba(112, 170, 193, .2), transparent 42%),
    radial-gradient(ellipse at 72% 68%, rgba(90, 150, 178, .16), transparent 46%),
    linear-gradient(180deg, transparent, rgba(0, 5, 11, .76));
  filter: blur(10px);
}

[data-mountain-race-mount] > .mountain-race-game {
  position: relative;
  z-index: 2;
}

.mountain-race-game {
  border-color: rgba(156, 215, 238, .34);
  background:
    linear-gradient(180deg, rgba(2, 10, 21, .18), rgba(1, 7, 14, .48) 56%, rgba(0, 4, 9, .82)),
    radial-gradient(ellipse at 50% 30%, transparent 0 34%, rgba(0, 4, 10, .16) 72%, rgba(0, 2, 6, .54) 100%);
  box-shadow:
    0 30px 86px rgba(0, 0, 0, .62),
    inset 0 1px 0 rgba(216, 246, 255, .12),
    inset 0 -110px 140px rgba(0, 0, 0, .34);
  transform: translateZ(0);
  backface-visibility: hidden;
}

.mr-world-moon {
  z-index: 3;
  width: 132px;
  height: 132px;
  right: 7%;
  top: 4%;
  box-shadow:
    0 0 26px rgba(218, 246, 255, .82),
    0 0 88px rgba(126, 207, 240, .56),
    0 0 180px rgba(73, 166, 211, .34);
  opacity: 1;
}

.mr-world-stars { z-index: 2; opacity: .82; }

.mr-world-range-far {
  z-index: 3;
  height: 54%;
  bottom: 31%;
  opacity: .82;
  background:
    linear-gradient(113deg, transparent 0 24%, rgba(220, 246, 255, .28) 24.5% 26%, transparent 26.5%),
    linear-gradient(244deg, transparent 0 59%, rgba(193, 232, 248, .2) 59.5% 61%, transparent 61.5%),
    linear-gradient(180deg, #285a73 0%, #102e45 46%, #06121f 100%);
  filter: none;
}

.mr-world-range-mid {
  z-index: 4;
  height: 48%;
  bottom: 9%;
  opacity: .96;
  background:
    linear-gradient(111deg, transparent 0 25%, rgba(218, 244, 252, .3) 25.4% 27.5%, transparent 28%),
    linear-gradient(248deg, transparent 0 60%, rgba(180, 222, 239, .18) 60.5% 62%, transparent 62.5%),
    linear-gradient(180deg, #173c52 0%, #091a2a 48%, #020910 100%);
  box-shadow: 0 -22px 70px rgba(77, 166, 204, .22);
}

.mr-world-cloud {
  z-index: 6;
  background: radial-gradient(ellipse, rgba(116, 178, 204, .2), rgba(27, 65, 84, .1) 52%, transparent 74%);
  mix-blend-mode: normal;
  filter: blur(18px);
  will-change: transform;
  backface-visibility: hidden;
}

.mr-world-snow {
  z-index: 7;
  background-image:
    radial-gradient(circle, rgba(189, 226, 240, .62) 0 1px, transparent 1.6px),
    radial-gradient(circle, rgba(150, 204, 226, .48) 0 1.2px, transparent 1.8px),
    radial-gradient(circle, rgba(207, 235, 246, .4) 0 .8px, transparent 1.4px);
  will-change: transform;
  backface-visibility: hidden;
}

.mr-world-snow-far { opacity: .22; }
.mr-world-snow-near { opacity: .3; }
.mr-world-vignette { z-index: 9; }

.mr-titlebar,
.mr-player-card,
.mr-player-strip,
.mr-command-deck,
.mr-overlay,
.mr-overlay-card {
  -webkit-backdrop-filter: none !important;
  backdrop-filter: none !important;
}

.mr-titlebar {
  margin: 12px 14px 10px;
  border-color: rgba(154, 216, 239, .34);
  background:
    linear-gradient(104deg, rgba(3, 14, 26, .97), rgba(9, 35, 53, .89) 58%, rgba(4, 18, 31, .96)),
    linear-gradient(90deg, rgba(88, 180, 215, .08), transparent 48%);
  box-shadow:
    0 14px 34px rgba(0, 0, 0, .42),
    inset 0 1px 0 rgba(223, 248, 255, .12),
    inset 0 -3px 0 rgba(66, 147, 181, .12);
}

.mr-title-lockup h2,
.mr-titlebar h2 {
  font-size: clamp(29px, 5vw, 44px);
  letter-spacing: .075em;
  text-shadow: 0 3px 0 rgba(0, 0, 0, .72), 0 0 30px rgba(89, 189, 229, .38);
}

.mr-expedition-heading > p,
.mr-titlebar p { color: #92d0e8; }
.mr-expedition-meta { color: rgba(198, 232, 244, .78); }

.mr-race-stage {
  gap: 24px;
  min-height: 552px;
  margin: 0 12px;
  padding: 6px 8px 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  overflow: visible;
}

.mr-race-stage::before {
  left: 1%;
  right: 1%;
  bottom: -36px;
  height: 102%;
  opacity: .88;
  background:
    linear-gradient(118deg, transparent 0 35%, rgba(203, 237, 249, .13) 35.4% 36.5%, transparent 37%),
    linear-gradient(242deg, transparent 0 62%, rgba(117, 180, 205, .12) 62.5% 64%, transparent 64.5%),
    linear-gradient(90deg, #07131e, #1e465b 47%, #102b3d 60%, #040b12);
  filter: drop-shadow(0 -18px 36px rgba(0, 0, 0, .7));
}

.mr-stage-ridge {
  z-index: 8;
  top: 48px;
  bottom: 14px;
  width: 70px;
}

.mr-stage-ridge::before {
  inset: 28px 4px 0;
  opacity: 1;
  background:
    linear-gradient(90deg, rgba(4, 10, 16, .12), #020811 38%, #00040a 50%, #071522 68%, rgba(5, 12, 18, .1));
  clip-path: polygon(45% 0, 73% 12%, 61% 24%, 86% 42%, 65% 57%, 82% 74%, 53% 100%, 27% 78%, 39% 58%, 12% 43%, 38% 24%, 24% 11%);
  filter: drop-shadow(0 0 18px rgba(0, 0, 0, .92));
}

.mr-stage-ridge > i {
  width: 2px;
  background: linear-gradient(transparent, rgba(120, 207, 239, .42) 18%, rgba(88, 164, 197, .14) 84%, transparent);
}

.mr-ridge-beacon {
  width: 10px;
  height: 10px;
  background: #ffd28d;
  box-shadow: 0 0 12px #ff9a3d, 0 0 34px rgba(255, 125, 42, .9), 0 0 82px rgba(255, 117, 32, .5);
}

.mr-ridge-label {
  display: block;
  top: -4px;
  padding: 4px 8px;
  font-size: 8px;
  background: rgba(24, 11, 5, .96);
}

.mr-lane {
  overflow: visible;
  background: transparent;
}

.mr-lane.me::before,
.mr-lane.is-me::before,
.mr-lane.opponent::before,
.mr-lane.is-opponent::before {
  inset: 48px -4px 0;
  border-radius: 24px 24px 8px 8px;
  clip-path: polygon(7% 0, 91% 0, 98% 9%, 93% 21%, 99% 34%, 94% 48%, 100% 62%, 94% 77%, 97% 91%, 87% 100%, 12% 100%, 3% 91%, 7% 77%, 1% 63%, 6% 48%, 0 34%, 7% 20%, 2% 8%);
  background:
    linear-gradient(122deg, transparent 0 31%, rgba(194, 230, 243, .12) 31.5% 33%, transparent 33.5%),
    linear-gradient(248deg, transparent 0 61%, rgba(0, 0, 0, .34) 61.5% 64%, transparent 64.5%),
    linear-gradient(100deg, #122d3d, #07141f 38%, #1a3c4e 62%, #040b12);
  box-shadow:
    inset 20px 0 34px rgba(0, 0, 0, .26),
    inset -22px 0 40px rgba(0, 0, 0, .5),
    0 18px 34px rgba(0, 0, 0, .52);
}

.mr-lane.me::before,
.mr-lane.is-me::before {
  border-left: 2px solid rgba(99, 205, 240, .25);
}

.mr-lane.opponent::before,
.mr-lane.is-opponent::before {
  border-right: 2px solid rgba(255, 159, 86, .2);
}

.mr-player-card,
.mr-player-strip {
  min-height: 58px;
  margin: 0 5px -6px;
  border-color: rgba(170, 222, 241, .32);
  background: linear-gradient(180deg, rgba(11, 34, 50, .98), rgba(3, 14, 24, .98));
  box-shadow: inset 0 1px rgba(232, 249, 255, .11), 0 12px 24px rgba(0, 0, 0, .48);
}

.mr-climb-viewport {
  height: 500px;
  border: 0;
  border-radius: 20px 20px 8px 8px;
  clip-path: polygon(5% 0, 95% 0, 100% 7%, 96% 19%, 100% 34%, 96% 49%, 100% 64%, 95% 79%, 98% 92%, 88% 100%, 12% 100%, 2% 92%, 6% 78%, 0 64%, 5% 49%, 0 34%, 5% 19%, 1% 7%);
  background:
    radial-gradient(ellipse at 50% 0, rgba(121, 204, 234, .18), transparent 34%),
    linear-gradient(180deg, rgba(9, 31, 45, .72), rgba(1, 8, 14, .94));
  box-shadow:
    inset 18px 0 34px rgba(0, 0, 0, .24),
    inset -20px 0 38px rgba(0, 0, 0, .5),
    0 20px 38px rgba(0, 0, 0, .38);
}

.mr-climb-viewport::after {
  box-shadow: inset 14px 0 26px rgba(0, 0, 0, .36), inset -14px 0 28px rgba(0, 0, 0, .44);
}

.mr-mountain-wall {
  left: 2%;
  right: 2%;
  border: 0;
  background:
    radial-gradient(ellipse at 19% 14%, rgba(175, 218, 232, .18), transparent 18%),
    radial-gradient(ellipse at 73% 30%, rgba(107, 173, 197, .12), transparent 22%),
    radial-gradient(ellipse at 34% 55%, rgba(183, 223, 235, .1), transparent 21%),
    repeating-linear-gradient(116deg, rgba(208, 237, 247, .055) 0 2px, transparent 3px 34px),
    repeating-linear-gradient(61deg, rgba(0, 0, 0, .22) 0 2px, transparent 3px 39px),
    linear-gradient(104deg, #1c4154, #081721 37%, #17394b 66%, #02080e);
  filter: saturate(.96) contrast(1.08);
}

.mr-route-ice {
  width: 30%;
  opacity: .92;
  background:
    linear-gradient(90deg, transparent, rgba(130, 211, 242, .18) 32%, rgba(218, 249, 255, .42) 48%, rgba(59, 139, 174, .16) 64%, transparent),
    repeating-linear-gradient(178deg, transparent 0 28px, rgba(206, 242, 253, .14) 29px 31px, transparent 32px 56px);
}

.mr-rope-line {
  width: 4px;
  opacity: .92;
  background: repeating-linear-gradient(180deg, #f2a151 0 7px, #7a3519 8px 12px, #ffc173 13px 17px);
  box-shadow: 1px 0 0 rgba(255, 225, 180, .36), 4px 3px 8px rgba(0, 0, 0, .58);
}

.mr-rope-anchor {
  width: 15px;
  height: 15px;
  border-color: #c3d9e1;
  box-shadow: inset 0 0 0 2px #061119, 2px 4px 9px rgba(0, 0, 0, .72);
}

.mr-rock-hold {
  border-color: rgba(198, 231, 242, .3);
  background: linear-gradient(145deg, #91aeb9, #365463 48%, #0b1d27);
}

.mr-rock-hold.current {
  border-color: rgba(255, 205, 129, .96);
  background: linear-gradient(145deg, #ffd899, #b96826 48%, #4b1f09);
  box-shadow:
    inset 2px 2px 2px rgba(255, 248, 222, .32),
    inset -3px -4px 5px rgba(61, 24, 5, .52),
    0 0 0 3px rgba(255, 147, 53, .18),
    0 0 26px rgba(255, 133, 43, .7),
    0 7px 12px rgba(0, 0, 0, .58);
}

.mr-command-deck {
  margin: 14px;
  border-color: rgba(160, 216, 237, .3);
  background:
    linear-gradient(108deg, rgba(3, 14, 25, .98), rgba(10, 35, 50, .96) 52%, rgba(3, 13, 23, .99)),
    linear-gradient(90deg, rgba(92, 184, 219, .06), transparent 50%);
  box-shadow: inset 0 1px rgba(226, 249, 255, .1), 0 18px 36px rgba(0, 0, 0, .5);
}

.mr-prompt.active {
  border-color: #ffd494;
  background: radial-gradient(circle at 50% 23%, rgba(255, 242, 210, .34), transparent 30%), linear-gradient(180deg, #d8862d, #62300c);
  box-shadow: inset 0 1px rgba(255, 255, 255, .28), 0 6px 0 #241005, 0 0 30px rgba(255, 149, 55, .5);
}

.mr-overlay {
  background: rgba(0, 6, 12, .76);
}

.mr-overlay-card {
  background: linear-gradient(180deg, rgba(10, 36, 52, .99), rgba(1, 10, 18, .99));
}

@media (max-width: 720px) {
  [data-mountain-race-mount] {
    min-height: 100dvh;
    border-radius: 0;
  }

  .mr-world-moon {
    width: 82px;
    height: 82px;
    right: 5%;
    top: 3%;
  }

  .mr-world-range-far { height: 48%; bottom: 38%; }
  .mr-world-range-mid { height: 43%; bottom: 19%; }

  .mr-titlebar {
    margin: 7px 7px 6px;
  }

  .mr-title-lockup h2,
  .mr-titlebar h2 { font-size: 24px; }

  .mr-race-stage {
    gap: 11px;
    margin: 0 4px;
    padding-inline: 2px;
  }

  .mr-stage-ridge {
    width: 38px;
    top: 40px;
  }

  .mr-ridge-label { display: none; }
  .mr-climb-viewport { height: min(470px, calc(100dvh - 292px)); min-height: 355px; }
  .mr-player-card, .mr-player-strip { min-height: 46px; margin-inline: 1px; }
  .mr-rope-line { width: 3px; }
  .mr-rope-anchor { width: 11px; height: 11px; }
  .mr-command-deck { margin: 8px 7px 7px; }
}

@media (max-width: 430px) {
  .mr-world-snow-near { display: none; }
  .mr-world-cloud-b { display: none; }
  .mr-race-stage { gap: 7px; }
  .mr-stage-ridge { width: 26px; opacity: .94; }
  .mr-climb-viewport { min-height: 340px; }
}

@media (prefers-reduced-motion: reduce) {
  .mr-world-cloud,
  .mr-world-snow,
  .mr-ridge-beacon {
    animation: none !important;
  }
}
`;
}

html = html.replace(/assets\/mountain-race\/mountain-race\.css(?:\?[^"'<>\s]*)?/g, setVisualCache);
html = html.replace(/assets\/mountain-race\/mountain-race-multiplayer\.js(?:\?[^"'<>\s]*)?/g, setVisualCache);

const htmlMarker = `<!-- ${marker} -->`;
if (!html.includes(htmlMarker)) {
  const boundary = html.includes('</body>') ? '</body>' : '</html>';
  assert(html.includes(boundary), 'document closing boundary is missing');
  html = html.replace(boundary, `${htmlMarker}\n${boundary}`);
}

for (const required of [
  marker,
  'MOUNTAIN_RACE_WORLD_V14',
  'ensureMountainRaceWorld(root)',
  'previousGameElement.replaceChildren',
  'data-mr-visual-stable',
  'visual=14'
]) {
  assert(runtime.includes(required) || css.includes(required) || html.includes(required), `generated V14 output is missing ${required}`);
}
assert(!runtime.includes('root.innerHTML = `'), 'active render still replaces the entire mountain mount');

await Promise.all([
  writeFile(cssUrl, css),
  writeFile(runtimeUrl, runtime),
  writeFile(indexUrl, html)
]);

console.log('Applied Summit Sprint Visual Rebuild V14: the alpine world is now visibly exposed, cliff routes are substantially reconstructed, the atmosphere persists across gameplay renders, and Android white-frame compositor resets are removed without changing gameplay or networking.');
