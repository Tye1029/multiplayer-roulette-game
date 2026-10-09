import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', root);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const indexUrl = new URL('index.html', root);
const marker = 'MOUNTAIN_RACE_VISUAL_FOUNDATION_V13';

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint Visual Foundation V13 patch failed: ${message}`);
}

function appendVisualCache(url) {
  if (url.includes('visual=13')) return url;
  return `${url}${url.includes('?') ? '&' : '?'}visual=13`;
}

let [css, runtime, html] = await Promise.all([
  readFile(cssUrl, 'utf8'),
  readFile(runtimeUrl, 'utf8'),
  readFile(indexUrl, 'utf8')
]);

if (!runtime.includes(marker)) {
  const strictToken = "  'use strict';";
  assert(runtime.includes(strictToken), 'multiplayer runtime strict-mode boundary is missing');
  runtime = runtime.replace(strictToken, `${strictToken}\n\n  /* ${marker} */`);

  const titlePattern = /\s*<div><p>FIRST TO THE SUMMIT WINS<\/p><h2>SUMMIT SPRINT<\/h2><\/div>/;
  assert(titlePattern.test(runtime), 'expedition title block was not found');
  runtime = runtime.replace(titlePattern, `
          <div class="mr-expedition-heading">
            <p>ALPINE EXPEDITION · ROUTE 24</p>
            <div class="mr-title-lockup"><span class="mr-expedition-mark" aria-hidden="true"><i></i></span><h2>SUMMIT SPRINT</h2></div>
            <small class="mr-expedition-meta">NORTH FACE · 24 HOLDS · LIVE ASCENT</small>
          </div>`);

  const headerToken = '        <header class="mr-titlebar">';
  assert(runtime.includes(headerToken), 'race titlebar was not found');
  runtime = runtime.replace(headerToken, `        <div class="mr-world-layer" aria-hidden="true">
          <span class="mr-world-moon"></span>
          <span class="mr-world-stars"></span>
          <span class="mr-world-range mr-world-range-far"></span>
          <span class="mr-world-range mr-world-range-mid"></span>
          <span class="mr-world-cloud mr-world-cloud-a"></span>
          <span class="mr-world-cloud mr-world-cloud-b"></span>
          <span class="mr-world-snow mr-world-snow-far"></span>
          <span class="mr-world-snow mr-world-snow-near"></span>
          <span class="mr-world-vignette"></span>
        </div>
${headerToken}`);

  const stageToken = '        <main class="mr-race-stage">';
  assert(runtime.includes(stageToken), 'race stage was not found');
  runtime = runtime.replace(stageToken, `${stageToken}
          <div class="mr-stage-ridge" aria-hidden="true"><span class="mr-ridge-beacon"></span><span class="mr-ridge-label">SUMMIT</span><i></i></div>`);

  const viewportPattern = /(<div class="mr-climb-viewport"[^>]*>\s*)(<div class="mr-mountain-wall"[^>]*>)/;
  assert(viewportPattern.test(runtime), 'climbing viewport/mountain wall boundary was not found');
  runtime = runtime.replace(viewportPattern, `$1<div class="mr-route-depth" aria-hidden="true"><span class="mr-route-ice"></span><span class="mr-route-shadow"></span></div>\n          $2\n            <div class="mr-route-rope" aria-hidden="true"><span class="mr-rope-line"></span><span class="mr-rope-anchor mr-rope-anchor-a"></span><span class="mr-rope-anchor mr-rope-anchor-b"></span><span class="mr-rope-anchor mr-rope-anchor-c"></span></div>`);
}

if (!css.includes(marker)) {
  css += String.raw`

/* ${marker}
   Phase 1: unified alpine world, atmospheric depth, embedded routes,
   expedition HUD framing, and responsive cinematic composition. */

.mountain-race-game {
  --mr-night-0: #020711;
  --mr-night-1: #071526;
  --mr-night-2: #0d2940;
  --mr-ice: #9ed7ed;
  --mr-ice-bright: #dff7ff;
  --mr-signal: #ffb85a;
  --mr-signal-hot: #ff7d32;
  isolation: isolate;
  border: 1px solid rgba(169, 218, 238, .24);
  border-radius: 24px;
  background:
    linear-gradient(180deg, rgba(1, 7, 17, .1), rgba(1, 6, 14, .88)),
    radial-gradient(circle at 76% 10%, rgba(143, 204, 233, .18), transparent 32%),
    linear-gradient(180deg, var(--mr-night-2) 0%, var(--mr-night-1) 38%, var(--mr-night-0) 100%);
  box-shadow:
    0 30px 80px rgba(0, 0, 0, .55),
    inset 0 1px 0 rgba(223, 247, 255, .13),
    inset 0 -80px 120px rgba(0, 0, 0, .34);
}

.mountain-race-game::before,
.mountain-race-game::after {
  content: none !important;
}

.mr-world-layer,
.mr-world-layer > span {
  position: absolute;
  pointer-events: none;
  user-select: none;
}

.mr-world-layer {
  inset: 0;
  z-index: -1;
  overflow: hidden;
  border-radius: inherit;
}

.mr-world-moon {
  width: 92px;
  height: 92px;
  right: 9%;
  top: 5%;
  border-radius: 50%;
  background:
    radial-gradient(circle at 35% 31%, rgba(255,255,255,.98) 0 6%, transparent 7%),
    radial-gradient(circle at 58% 61%, rgba(82,128,150,.22) 0 7%, transparent 8%),
    radial-gradient(circle at 44% 47%, #eafaff 0 54%, #b9dce9 74%, #799db2 100%);
  box-shadow:
    0 0 22px rgba(202, 239, 255, .58),
    0 0 70px rgba(132, 201, 230, .38),
    0 0 140px rgba(95, 173, 210, .22);
  opacity: .92;
}

.mr-world-stars {
  inset: 0 0 47% 0;
  opacity: .62;
  background-image:
    radial-gradient(circle, rgba(232,248,255,.9) 0 1px, transparent 1.5px),
    radial-gradient(circle, rgba(151,210,235,.65) 0 1px, transparent 1.4px),
    radial-gradient(circle, rgba(255,255,255,.72) 0 1.2px, transparent 1.8px);
  background-size: 83px 79px, 127px 119px, 173px 151px;
  background-position: 12px 8px, 61px 35px, 101px 19px;
  mask-image: linear-gradient(to bottom, #000, transparent 92%);
}

.mr-world-range {
  left: -5%;
  width: 110%;
  bottom: 25%;
  transform-origin: 50% 100%;
}

.mr-world-range-far {
  height: 40%;
  opacity: .42;
  background: linear-gradient(180deg, #234a60, #091827 74%);
  clip-path: polygon(0 78%, 8% 57%, 17% 70%, 27% 32%, 38% 65%, 48% 42%, 60% 72%, 72% 24%, 82% 58%, 91% 39%, 100% 67%, 100% 100%, 0 100%);
  filter: blur(.3px);
}

.mr-world-range-mid {
  height: 34%;
  bottom: 13%;
  opacity: .78;
  background:
    linear-gradient(116deg, transparent 0 23%, rgba(202,235,246,.2) 24% 26%, transparent 27% 100%),
    linear-gradient(244deg, transparent 0 57%, rgba(207,239,249,.14) 58% 60%, transparent 61% 100%),
    linear-gradient(180deg, #132f42, #030a13 83%);
  clip-path: polygon(0 73%, 12% 40%, 24% 66%, 37% 19%, 50% 62%, 63% 34%, 76% 68%, 89% 27%, 100% 55%, 100% 100%, 0 100%);
  box-shadow: 0 -18px 50px rgba(67, 137, 169, .11);
}

.mr-world-cloud {
  height: 110px;
  width: 70%;
  border-radius: 50%;
  background: radial-gradient(ellipse, rgba(123, 174, 197, .18), rgba(28, 60, 78, .08) 52%, transparent 74%);
  filter: blur(16px);
  mix-blend-mode: screen;
}

.mr-world-cloud-a {
  left: -18%;
  top: 18%;
  animation: mrCloudDriftA 24s ease-in-out infinite alternate;
}

.mr-world-cloud-b {
  right: -24%;
  top: 42%;
  opacity: .68;
  animation: mrCloudDriftB 31s ease-in-out infinite alternate;
}

.mr-world-snow {
  inset: -20%;
  background-image:
    radial-gradient(circle, rgba(239,250,255,.88) 0 1px, transparent 1.6px),
    radial-gradient(circle, rgba(200,235,248,.72) 0 1.2px, transparent 1.8px),
    radial-gradient(circle, rgba(255,255,255,.54) 0 .8px, transparent 1.4px);
  background-size: 79px 83px, 121px 109px, 163px 151px;
  transform: rotate(-7deg);
}

.mr-world-snow-far {
  opacity: .28;
  filter: blur(.45px);
  animation: mrSnowFar 18s linear infinite;
}

.mr-world-snow-near {
  opacity: .48;
  background-size: 137px 131px, 199px 181px, 251px 223px;
  animation: mrSnowNear 11s linear infinite;
}

.mr-world-vignette {
  inset: 0;
  background:
    radial-gradient(ellipse at 50% 44%, transparent 35%, rgba(0,5,12,.26) 72%, rgba(0,3,8,.76) 100%),
    linear-gradient(180deg, transparent 55%, rgba(0,3,8,.46));
}

.mr-titlebar,
.mr-race-stage,
.mr-command-deck,
.mr-overlay {
  position: relative;
  z-index: 2;
}

.mr-titlebar {
  min-height: 82px;
  margin-bottom: 14px;
  padding: 12px 15px 12px 17px;
  border: 1px solid rgba(176, 222, 239, .2);
  border-radius: 15px;
  background:
    linear-gradient(100deg, rgba(4, 14, 25, .9), rgba(8, 27, 43, .68) 64%, rgba(5, 16, 27, .84)),
    repeating-linear-gradient(90deg, transparent 0 34px, rgba(196,230,243,.025) 35px 36px);
  box-shadow:
    0 12px 32px rgba(0,0,0,.3),
    inset 0 1px 0 rgba(220,246,255,.09),
    inset 0 -1px 0 rgba(0,0,0,.5);
  backdrop-filter: blur(12px);
}

.mr-expedition-heading {
  min-width: 0;
}

.mr-expedition-heading > p,
.mr-titlebar p {
  margin: 0 0 3px;
  color: #8fb6c7;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .22em;
}

.mr-title-lockup {
  display: flex;
  align-items: center;
  gap: 9px;
}

.mr-title-lockup h2,
.mr-titlebar h2 {
  margin: 0;
  color: #f1fbff;
  font-size: clamp(23px, 4vw, 34px);
  line-height: .95;
  letter-spacing: .055em;
  text-shadow: 0 2px 0 rgba(0,0,0,.7), 0 0 22px rgba(114,193,225,.25);
}

.mr-expedition-mark {
  position: relative;
  display: grid;
  place-items: center;
  width: 31px;
  height: 31px;
  flex: 0 0 31px;
  border: 1px solid rgba(182,226,242,.38);
  border-radius: 8px;
  background: linear-gradient(145deg, rgba(143,205,231,.18), rgba(4,13,22,.65));
  box-shadow: inset 0 1px rgba(255,255,255,.12), 0 5px 12px rgba(0,0,0,.28);
}

.mr-expedition-mark::before,
.mr-expedition-mark::after,
.mr-expedition-mark i {
  content: '';
  position: absolute;
  bottom: 7px;
  border-style: solid;
  border-color: transparent transparent #a7d8e9 transparent;
}

.mr-expedition-mark::before {
  left: 4px;
  border-width: 0 10px 15px 10px;
}

.mr-expedition-mark::after {
  right: 3px;
  bottom: 7px;
  border-width: 0 7px 11px 7px;
  border-bottom-color: #5d95ae;
}

.mr-expedition-mark i {
  left: 12px;
  bottom: 18px;
  width: 2px;
  height: 7px;
  border: 0;
  background: var(--mr-signal);
  box-shadow: 3px 1px 0 -1px var(--mr-signal-hot);
}

.mr-expedition-meta {
  display: block;
  margin: 5px 0 0 40px;
  color: rgba(183,216,228,.62);
  font-size: 8px;
  font-weight: 700;
  letter-spacing: .18em;
}

.mr-race-clock {
  min-width: 72px;
  border: 1px solid rgba(158,216,237,.3);
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(14,39,56,.88), rgba(3,11,20,.94));
  box-shadow: inset 0 1px rgba(229,249,255,.09), 0 8px 18px rgba(0,0,0,.3);
}

.mr-race-stage {
  isolation: isolate;
  gap: 10px;
  padding: 10px;
  border: 1px solid rgba(145, 199, 222, .18);
  border-radius: 18px;
  background:
    linear-gradient(90deg, rgba(6,19,31,.48), transparent 28% 72%, rgba(6,19,31,.48)),
    linear-gradient(180deg, rgba(17,49,68,.22), rgba(1,7,14,.58));
  box-shadow:
    inset 0 1px 0 rgba(218,243,252,.07),
    inset 0 -36px 60px rgba(0,0,0,.28),
    0 18px 38px rgba(0,0,0,.28);
  overflow: hidden;
}

.mr-stage-ridge {
  position: absolute;
  z-index: 5;
  left: 50%;
  top: 4px;
  bottom: 8px;
  width: 22px;
  transform: translateX(-50%);
  pointer-events: none;
}

.mr-stage-ridge::before {
  content: '';
  position: absolute;
  inset: 28px 6px 0;
  background: linear-gradient(90deg, rgba(0,0,0,.42), #173246 46%, #07111c 54%, rgba(0,0,0,.5));
  clip-path: polygon(48% 0, 82% 12%, 61% 26%, 91% 42%, 58% 58%, 76% 73%, 49% 100%, 21% 77%, 38% 59%, 6% 43%, 38% 25%, 17% 12%);
  opacity: .86;
  filter: drop-shadow(0 0 8px rgba(0,0,0,.72));
}

.mr-stage-ridge > i {
  position: absolute;
  left: 50%;
  top: 42px;
  bottom: 26px;
  width: 1px;
  transform: translateX(-50%);
  background: linear-gradient(transparent, rgba(149,211,235,.22) 16%, rgba(149,211,235,.09) 84%, transparent);
}

.mr-ridge-beacon {
  position: absolute;
  z-index: 2;
  left: 50%;
  top: 10px;
  width: 7px;
  height: 7px;
  transform: translateX(-50%);
  border-radius: 50%;
  background: #ffd08b;
  box-shadow: 0 0 8px #ff9c49, 0 0 22px rgba(255,128,48,.72), 0 0 48px rgba(255,128,48,.32);
  animation: mrBeaconPulse 2.2s ease-in-out infinite;
}

.mr-ridge-label {
  position: absolute;
  z-index: 3;
  top: 0;
  left: 50%;
  transform: translate(-50%, -2px);
  padding: 2px 5px;
  border: 1px solid rgba(255,190,104,.42);
  border-radius: 4px;
  color: #ffd9a5;
  background: rgba(23,12,7,.84);
  font-size: 7px;
  font-weight: 900;
  letter-spacing: .12em;
  box-shadow: 0 4px 10px rgba(0,0,0,.4);
}

.mr-lane {
  position: relative;
  z-index: 2;
  border: 0;
  border-radius: 12px;
  background: transparent;
  box-shadow: none;
  overflow: visible;
}

.mr-lane.me::before,
.mr-lane.is-me::before,
.mr-lane.opponent::before,
.mr-lane.is-opponent::before {
  content: '';
  position: absolute;
  z-index: -1;
  inset: 0;
  border-radius: 12px;
  pointer-events: none;
}

.mr-lane.me::before,
.mr-lane.is-me::before {
  background: linear-gradient(180deg, rgba(53,129,159,.12), rgba(4,14,23,.1));
  box-shadow: inset 1px 0 rgba(124,198,226,.14);
}

.mr-lane.opponent::before,
.mr-lane.is-opponent::before {
  background: linear-gradient(180deg, rgba(177,92,46,.08), rgba(4,14,23,.1));
  box-shadow: inset -1px 0 rgba(234,155,96,.1);
}

.mr-player-card,
.mr-player-strip {
  position: relative;
  z-index: 6;
  min-height: 52px;
  margin: 0 4px -2px;
  border: 1px solid rgba(169,216,234,.2);
  border-radius: 10px 10px 5px 5px;
  background:
    linear-gradient(180deg, rgba(17,43,59,.94), rgba(4,15,25,.94)),
    repeating-linear-gradient(90deg, transparent 0 26px, rgba(255,255,255,.025) 27px 28px);
  box-shadow: inset 0 1px rgba(225,248,255,.08), 0 9px 17px rgba(0,0,0,.28);
  backdrop-filter: blur(9px);
}

.mr-player-card::after,
.mr-player-strip::after {
  content: '';
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: -1px;
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(124,205,235,.7), transparent);
  opacity: .55;
}

.mr-lane.opponent .mr-player-card::after,
.mr-lane.is-opponent .mr-player-strip::after {
  background: linear-gradient(90deg, transparent, rgba(255,157,86,.56), transparent);
}

.mr-player-badge {
  border: 1px solid rgba(201,235,247,.26);
  background: linear-gradient(145deg, rgba(130,199,226,.28), rgba(4,13,23,.82));
  box-shadow: inset 0 1px rgba(255,255,255,.12), 0 4px 10px rgba(0,0,0,.3);
}

.mr-climb-viewport {
  position: relative;
  border: 1px solid rgba(134,188,210,.16);
  border-radius: 8px 8px 13px 13px;
  background:
    radial-gradient(ellipse at 50% 4%, rgba(125,191,219,.16), transparent 38%),
    linear-gradient(180deg, rgba(7,24,37,.72), rgba(1,7,13,.92));
  box-shadow:
    inset 0 1px rgba(222,246,255,.06),
    inset 0 -28px 42px rgba(0,0,0,.34),
    0 8px 20px rgba(0,0,0,.28);
  overflow: hidden;
}

.mr-climb-viewport::before {
  opacity: .24;
}

.mr-climb-viewport::after {
  content: '';
  position: absolute;
  z-index: 5;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  box-shadow: inset 8px 0 18px rgba(0,0,0,.28), inset -8px 0 18px rgba(0,0,0,.28);
}

.mr-route-depth {
  position: absolute;
  z-index: 1;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.mr-route-ice {
  position: absolute;
  top: -8%;
  bottom: -8%;
  width: 22%;
  right: 1%;
  transform: skewX(-7deg);
  background:
    linear-gradient(90deg, transparent, rgba(168,224,244,.16) 38%, rgba(224,249,255,.3) 46%, rgba(77,144,173,.12) 60%, transparent),
    repeating-linear-gradient(178deg, transparent 0 30px, rgba(218,246,255,.09) 31px 32px, transparent 33px 57px);
  filter: blur(.2px);
  opacity: .8;
}

.mr-lane.opponent .mr-route-ice,
.mr-lane.is-opponent .mr-route-ice {
  right: auto;
  left: 1%;
  transform: skewX(7deg);
}

.mr-route-shadow {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(92deg, rgba(0,0,0,.36), transparent 18% 80%, rgba(0,0,0,.31)),
    linear-gradient(180deg, transparent 70%, rgba(0,0,0,.35));
}

.mr-mountain-wall {
  z-index: 2;
  background:
    radial-gradient(ellipse at 26% 18%, rgba(149,190,203,.13), transparent 22%),
    radial-gradient(ellipse at 72% 47%, rgba(126,171,188,.1), transparent 24%),
    repeating-linear-gradient(116deg, rgba(210,235,243,.035) 0 2px, transparent 3px 31px),
    repeating-linear-gradient(61deg, rgba(0,0,0,.16) 0 2px, transparent 3px 37px),
    linear-gradient(104deg, #142a38, #07131f 36%, #102735 66%, #030a12);
  filter: saturate(.82);
}

.mr-mountain-wall::before {
  opacity: .66;
  filter: drop-shadow(0 12px 18px rgba(0,0,0,.45));
}

.mr-route-rope {
  position: absolute;
  z-index: 7;
  inset: 0;
  pointer-events: none;
}

.mr-rope-line {
  position: absolute;
  left: 17%;
  top: 0;
  bottom: 0;
  width: 3px;
  border-radius: 99px;
  background:
    repeating-linear-gradient(180deg, #d88b43 0 7px, #6f351c 8px 12px, #edaa5c 13px 17px);
  box-shadow: 1px 0 0 rgba(255,211,150,.28), 3px 2px 6px rgba(0,0,0,.45);
  opacity: .72;
}

.mr-lane.opponent .mr-rope-line,
.mr-lane.is-opponent .mr-rope-line {
  left: auto;
  right: 17%;
}

.mr-rope-anchor {
  position: absolute;
  left: calc(17% - 5px);
  width: 13px;
  height: 13px;
  border: 2px solid #9bb5bf;
  border-radius: 50% 50% 48% 48%;
  background: #243945;
  box-shadow: inset 0 0 0 2px #09131a, 2px 3px 7px rgba(0,0,0,.55);
}

.mr-lane.opponent .mr-rope-anchor,
.mr-lane.is-opponent .mr-rope-anchor {
  left: auto;
  right: calc(17% - 5px);
}

.mr-rope-anchor-a { bottom: 18%; }
.mr-rope-anchor-b { bottom: 48%; }
.mr-rope-anchor-c { bottom: 77%; }

.mr-rock-hold {
  border-color: rgba(190,222,232,.2);
  background:
    linear-gradient(145deg, rgba(129,162,174,.92), rgba(42,65,76,.96) 48%, rgba(11,24,31,.98));
  box-shadow:
    inset 2px 2px 2px rgba(225,244,250,.18),
    inset -3px -4px 5px rgba(0,0,0,.52),
    0 5px 8px rgba(0,0,0,.45);
}

.mr-rock-hold.current {
  border-color: rgba(255,194,106,.78);
  box-shadow:
    inset 2px 2px 2px rgba(255,239,198,.25),
    inset -3px -4px 5px rgba(65,26,6,.5),
    0 0 0 2px rgba(255,143,54,.14),
    0 0 17px rgba(255,133,47,.48),
    0 6px 10px rgba(0,0,0,.48);
}

.mr-finish-ledge,
.mr-finish-ledger {
  border-color: rgba(255,189,91,.46);
  background: linear-gradient(180deg, rgba(72,45,25,.94), rgba(19,14,12,.98));
  box-shadow: 0 0 18px rgba(255,142,48,.2), 0 8px 16px rgba(0,0,0,.45), inset 0 1px rgba(255,230,187,.12);
}

.mr-command-deck {
  margin-top: 12px;
  border: 1px solid rgba(154,207,227,.18);
  border-radius: 15px;
  background:
    linear-gradient(105deg, rgba(6,19,31,.94), rgba(12,37,52,.88) 52%, rgba(4,14,24,.96)),
    repeating-linear-gradient(90deg, transparent 0 29px, rgba(255,255,255,.022) 30px 31px);
  box-shadow: inset 0 1px rgba(223,247,255,.07), 0 16px 30px rgba(0,0,0,.32);
  backdrop-filter: blur(12px);
}

.mr-prompt-label {
  color: #8eb5c5;
  letter-spacing: .18em;
}

.mr-overlay-card {
  border: 1px solid rgba(182,224,240,.26);
  background:
    linear-gradient(180deg, rgba(13,38,53,.96), rgba(2,10,17,.98)),
    repeating-linear-gradient(90deg, transparent 0 31px, rgba(255,255,255,.025) 32px 33px);
  box-shadow: 0 28px 70px rgba(0,0,0,.65), inset 0 1px rgba(235,250,255,.09);
  backdrop-filter: blur(16px);
}

@keyframes mrCloudDriftA {
  from { transform: translate3d(-3%, -4px, 0) scale(1); }
  to { transform: translate3d(22%, 8px, 0) scale(1.08); }
}

@keyframes mrCloudDriftB {
  from { transform: translate3d(8%, 6px, 0) scale(1.04); }
  to { transform: translate3d(-24%, -5px, 0) scale(.96); }
}

@keyframes mrSnowFar {
  from { transform: translate3d(-3%, -18%, 0) rotate(-7deg); }
  to { transform: translate3d(6%, 17%, 0) rotate(-7deg); }
}

@keyframes mrSnowNear {
  from { transform: translate3d(-5%, -22%, 0) rotate(-9deg); }
  to { transform: translate3d(10%, 20%, 0) rotate(-9deg); }
}

@keyframes mrBeaconPulse {
  0%, 100% { opacity: .72; transform: translateX(-50%) scale(.86); }
  50% { opacity: 1; transform: translateX(-50%) scale(1.18); }
}

@media (max-width: 720px) {
  .mountain-race-game {
    border-radius: 17px;
    padding: 10px;
  }

  .mr-world-moon {
    width: 58px;
    height: 58px;
    right: 7%;
    top: 4%;
  }

  .mr-world-range-far { bottom: 31%; }
  .mr-world-range-mid { bottom: 20%; }
  .mr-world-cloud { opacity: .62; }
  .mr-world-snow-near { opacity: .34; }

  .mr-titlebar {
    min-height: 64px;
    margin-bottom: 8px;
    padding: 8px 9px;
    border-radius: 11px;
  }

  .mr-title-lockup { gap: 6px; }
  .mr-expedition-mark { width: 24px; height: 24px; flex-basis: 24px; border-radius: 6px; }
  .mr-expedition-mark::before { left: 3px; bottom: 5px; border-width: 0 8px 12px 8px; }
  .mr-expedition-mark::after { right: 2px; bottom: 5px; border-width: 0 6px 9px 6px; }
  .mr-expedition-mark i { left: 9px; bottom: 14px; height: 6px; }
  .mr-expedition-heading > p, .mr-titlebar p { font-size: 7px; }
  .mr-expedition-meta { margin-left: 30px; font-size: 6px; letter-spacing: .11em; }

  .mr-race-stage {
    gap: 5px;
    padding: 5px;
    border-radius: 12px;
  }

  .mr-stage-ridge { width: 13px; }
  .mr-ridge-label { display: none; }
  .mr-ridge-beacon { top: 7px; }
  .mr-stage-ridge::before { inset-inline: 3px; }

  .mr-player-card,
  .mr-player-strip {
    min-height: 43px;
    margin-inline: 1px;
    padding-inline: 5px;
  }

  .mr-route-ice { opacity: .56; }
  .mr-rope-line { width: 2px; opacity: .52; }
  .mr-rope-anchor { width: 9px; height: 9px; border-width: 1px; }
  .mr-command-deck { margin-top: 8px; border-radius: 11px; }
}

@media (max-width: 430px) {
  .mr-world-cloud-b,
  .mr-world-snow-far { display: none; }
  .mr-expedition-meta { display: none; }
  .mr-titlebar h2, .mr-title-lockup h2 { font-size: 20px; }
  .mr-race-clock { min-width: 58px; }
  .mr-race-stage { padding-inline: 3px; }
  .mr-stage-ridge { opacity: .66; }
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

html = html.replace(/assets\/mountain-race\/mountain-race\.css(?:\?[^"'<>\s]*)?/g, appendVisualCache);
html = html.replace(/assets\/mountain-race\/mountain-race-multiplayer\.js(?:\?[^"'<>\s]*)?/g, appendVisualCache);

const htmlMarker = `<!-- ${marker} -->`;
if (!html.includes(htmlMarker)) {
  const boundary = html.includes('</body>') ? '</body>' : '</html>';
  assert(html.includes(boundary), 'document closing boundary is missing');
  html = html.replace(boundary, `${htmlMarker}\n${boundary}`);
}

for (const required of [
  marker,
  'mr-world-layer',
  'mr-world-moon',
  'mr-stage-ridge',
  'mr-route-depth',
  'mr-route-rope',
  'mr-rope-anchor-a'
]) {
  assert(runtime.includes(required) || css.includes(required), `generated visual output is missing ${required}`);
}
assert(html.includes('visual=13'), 'visual cache boundary is missing from the page');

await Promise.all([
  writeFile(cssUrl, css),
  writeFile(runtimeUrl, runtime),
  writeFile(indexUrl, html)
]);

console.log('Applied Summit Sprint Visual Foundation V13: a unified moonlit alpine world, layered ranges, moving fog and snow, embedded rope routes, central summit ridge, and expedition HUD now replace the flat boxed-lane presentation without changing gameplay or networking.');
