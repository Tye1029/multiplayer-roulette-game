import { readFile, writeFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const start = '/* SAFE_CRACKER_LATCH_REFINEMENT_V9_START */';
const end = '/* SAFE_CRACKER_LATCH_REFINEMENT_V9_END */';

let css = await readFile(cssUrl, 'utf8');
if (!css.includes('/* SAFE_CRACKER_LATCH_SEQUENCE_V1_START */')) {
  throw new Error('Safe Cracker latch refinement v9 requires the mounted latch sequence.');
}

const refinementCss = String.raw`${start}
/* Web-reference-guided metal pass: brushed stainless steel reads through fine
   directional grain, scattered micro-scratches, broad soft reflection, and one
   restrained specular streak. The upper pair moves only a few pixels higher.
   Existing right-side cylinder release behavior remains the only latch motion. */
.safe-cracker-game .sc-bolts {
  top: 0 !important;
  bottom: 0 !important;
  display: block !important;
  justify-content: initial !important;
}

.safe-cracker-game .sc-latch-mount {
  position: absolute !important;
}

.safe-cracker-game .sc-bolts.left .sc-latch-mount {
  left: 0;
  transform-origin: left center;
}

.safe-cracker-game .sc-bolts.right .sc-latch-mount {
  right: 0;
  transform-origin: right center;
}

/* Tiny upward correction while keeping clear space above the dial. */
.safe-cracker-game .sc-latch-mount:nth-child(1) {
  top: calc(22% + 2px);
  transform: scale(.9);
}

.safe-cracker-game .sc-latch-mount:nth-child(2) {
  top: 51%;
  transform: translateY(-50%) scale(.68);
}

.safe-cracker-game .sc-bolts.left .sc-latch-mount:nth-child(2) { left: -11px; }
.safe-cracker-game .sc-bolts.right .sc-latch-mount:nth-child(2) { right: -11px; }

.safe-cracker-game .sc-latch-mount:nth-child(3) {
  bottom: 17%;
  transform: scale(.9);
}

/* Fixed vertical supports use a real procedural brushed-grain SVG rather than
   obvious repeated CSS stripes. Sparse angled marks add rough shop wear. */
.safe-cracker-game .sc-latch-spine {
  position: absolute;
  top: -14px;
  bottom: -14px;
  width: 18px;
  z-index: 2;
  display: block;
  overflow: visible;
  border: 2px solid #0d1215;
  border-radius: 4px;
  background-color: #68747a;
  background-image:
    url('./brushed-metal-vertical-v1.svg?grain=1'),
    linear-gradient(112deg, transparent 0 19%, rgba(255,255,255,.2) 19.25% 19.8%, transparent 20.1% 65%, rgba(0,0,0,.2) 65.25% 65.8%, transparent 66.1%),
    linear-gradient(98deg, transparent 0 23%, rgba(255,255,255,.04) 28%, rgba(255,255,255,.44) 39%, rgba(255,255,255,.1) 49%, transparent 61%),
    linear-gradient(90deg, #11181c 0%, #515e64 14%, #9ca8ad 31%, #d8dfe1 43%, #9aa5aa 55%, #59666c 72%, #151c20 100%);
  background-size: 64px 160px, auto, auto, auto;
  background-position: center, center, center, center;
  background-repeat: repeat, no-repeat, no-repeat, no-repeat;
  background-blend-mode: soft-light, normal, screen, normal;
  box-shadow:
    inset 1px 0 2px rgba(255,255,255,.38),
    inset -3px 0 5px rgba(0,0,0,.34),
    inset 0 0 10px rgba(255,255,255,.06),
    0 5px 8px rgba(0,0,0,.48);
}

.safe-cracker-game .sc-bolts.left .sc-latch-spine { left: 5px; }
.safe-cracker-game .sc-bolts.right .sc-latch-spine { right: 5px; }

.safe-cracker-game .sc-latch-spine::before,
.safe-cracker-game .sc-latch-spine::after {
  content: '';
  position: absolute;
  left: 50%;
  width: 24px;
  height: 7px;
  border: 2px solid #0b1012;
  background-color: #6d797f;
  background-image:
    url('./brushed-metal-horizontal-v1.svg?grain=1'),
    linear-gradient(107deg, transparent 0 27%, rgba(255,255,255,.46) 35%, rgba(255,255,255,.09) 43%, transparent 51%),
    linear-gradient(90deg, #161d21 0%, #77848a 23%, #d5dcde 44%, #849096 64%, #171f23 100%);
  background-size: 96px 42px, auto, auto;
  background-position: center, center, center;
  background-repeat: repeat, no-repeat, no-repeat;
  background-blend-mode: soft-light, screen, normal;
  box-shadow:
    inset 0 1px 1px rgba(255,255,255,.34),
    inset 0 -2px 3px rgba(0,0,0,.34),
    0 2px 3px rgba(0,0,0,.42);
  transform: translateX(-50%);
}

.safe-cracker-game .sc-latch-spine::before {
  top: 13px;
  border-radius: 5px 5px 2px 2px;
}

.safe-cracker-game .sc-latch-spine::after {
  bottom: 13px;
  border-radius: 2px 2px 5px 5px;
}

/* Backplates use horizontal grain, dull roughness, and a soft reflected window. */
.safe-cracker-game .sc-latch-mount::before {
  background-color: #667278;
  background-image:
    url('./brushed-metal-horizontal-v1.svg?grain=1'),
    linear-gradient(111deg, transparent 0 14%, rgba(255,255,255,.18) 14.25% 14.8%, transparent 15.1% 48%, rgba(0,0,0,.17) 48.25% 48.8%, transparent 49.1% 78%, rgba(255,255,255,.09) 78.25% 78.8%, transparent 79.1%),
    linear-gradient(105deg, transparent 0 19%, rgba(255,255,255,.03) 24%, rgba(255,255,255,.36) 35%, rgba(255,255,255,.08) 47%, transparent 59%),
    linear-gradient(90deg, #151d21 0%, #56636a 18%, #9ba7ac 34%, #d6dde0 43%, #8d999f 57%, #48545a 75%, #141b1f 100%) !important;
  background-size: 128px 72px, auto, auto, auto;
  background-position: center, center, center, center;
  background-repeat: repeat, no-repeat, no-repeat, no-repeat;
  background-blend-mode: soft-light, normal, screen, normal;
  box-shadow:
    inset 1px 0 2px rgba(255,255,255,.28),
    inset 0 1px 1px rgba(255,255,255,.2),
    inset -4px 0 7px rgba(0,0,0,.31),
    0 6px 9px rgba(0,0,0,.42) !important;
}

.safe-cracker-game .sc-bolts.right .sc-latch-mount::before {
  background-image:
    url('./brushed-metal-horizontal-v1.svg?grain=1'),
    linear-gradient(69deg, transparent 0 14%, rgba(255,255,255,.18) 14.25% 14.8%, transparent 15.1% 48%, rgba(0,0,0,.17) 48.25% 48.8%, transparent 49.1% 78%, rgba(255,255,255,.09) 78.25% 78.8%, transparent 79.1%),
    linear-gradient(75deg, transparent 0 19%, rgba(255,255,255,.03) 24%, rgba(255,255,255,.36) 35%, rgba(255,255,255,.08) 47%, transparent 59%),
    linear-gradient(270deg, #151d21 0%, #56636a 18%, #9ba7ac 34%, #d6dde0 43%, #8d999f 57%, #48545a 75%, #141b1f 100%) !important;
}

/* Inward mounting ears mirror the same rough grain and restrained reflection. */
.safe-cracker-game .sc-latch-mount::after {
  background-color: #626e74;
  background-image:
    url('./brushed-metal-horizontal-v1.svg?grain=1'),
    linear-gradient(108deg, transparent 0 23%, rgba(255,255,255,.17) 23.25% 23.8%, transparent 24.1% 60%, rgba(0,0,0,.15) 60.25% 60.8%, transparent 61.1%),
    linear-gradient(112deg, transparent 0 20%, rgba(255,255,255,.34) 32%, rgba(255,255,255,.07) 44%, transparent 56%),
    linear-gradient(90deg, #141b1f 0%, #5e6b72 24%, #cbd3d6 46%, #758188 66%, #182024 100%) !important;
  background-size: 96px 56px, auto, auto, auto;
  background-position: center, center, center, center;
  background-repeat: repeat, no-repeat, no-repeat, no-repeat;
  background-blend-mode: soft-light, normal, screen, normal;
  box-shadow:
    inset 0 1px 2px rgba(255,255,255,.28),
    inset -3px 0 5px rgba(0,0,0,.28),
    0 4px 6px rgba(0,0,0,.46) !important;
}

.safe-cracker-game .sc-bolts.right .sc-latch-mount::after {
  background-image:
    url('./brushed-metal-horizontal-v1.svg?grain=1'),
    linear-gradient(72deg, transparent 0 23%, rgba(255,255,255,.17) 23.25% 23.8%, transparent 24.1% 60%, rgba(0,0,0,.15) 60.25% 60.8%, transparent 61.1%),
    linear-gradient(68deg, transparent 0 20%, rgba(255,255,255,.34) 32%, rgba(255,255,255,.07) 44%, transparent 56%),
    linear-gradient(270deg, #141b1f 0%, #5e6b72 24%, #cbd3d6 46%, #758188 66%, #182024 100%) !important;
}

.safe-cracker-game .sc-latch-screw {
  position: absolute;
  top: 11px;
  width: 13px;
  height: 13px;
  z-index: 4;
  display: block;
  border: 1px solid #070a0c;
  border-radius: 50%;
  background:
    linear-gradient(128deg, transparent 0 27%, rgba(255,255,255,.52) 35%, rgba(255,255,255,.1) 44%, transparent 52%),
    radial-gradient(circle at 34% 27%, #fff 0 7%, #c7d0d3 17%, #78848a 39%, #394247 65%, #111619 84%, #050708 100%);
  box-shadow:
    inset 0 1px 1px rgba(255,255,255,.4),
    inset 0 -2px 3px rgba(0,0,0,.48),
    0 2px 3px rgba(0,0,0,.52);
}

.safe-cracker-game .sc-bolts.left .sc-latch-screw { left: 38px; }
.safe-cracker-game .sc-bolts.right .sc-latch-screw { right: 38px; }

.safe-cracker-game .sc-latch-screw::before,
.safe-cracker-game .sc-latch-screw::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  border-radius: 2px;
  background: linear-gradient(180deg, #070a0c, #30383c 48%, #080b0d);
  box-shadow: 0 1px 0 rgba(255,255,255,.12);
  transform: translate(-50%, -50%);
}

.safe-cracker-game .sc-latch-screw::before { width: 8px; height: 2px; }
.safe-cracker-game .sc-latch-screw::after { width: 2px; height: 8px; }

/* Cylinders use the horizontal asset at a tighter scale to resemble machined
   brushing. A broad soft highlight plus a narrow specular streak avoids the
   flat white stripe from the previous pass and reads as curved steel. */
.safe-cracker-game .sc-latch-mount > i {
  overflow: hidden;
  background-color: #6b777d;
  background-image:
    url('./brushed-metal-horizontal-v1.svg?grain=1'),
    linear-gradient(104deg, transparent 0 16%, rgba(255,255,255,.2) 16.25% 16.8%, transparent 17.1% 46%, rgba(0,0,0,.16) 46.25% 46.8%, transparent 47.1% 73%, rgba(255,255,255,.1) 73.25% 73.8%, transparent 74.1%),
    linear-gradient(98deg, transparent 0 18%, rgba(255,255,255,.02) 24%, rgba(255,255,255,.19) 33%, rgba(255,255,255,.52) 41%, rgba(255,255,255,.14) 49%, transparent 62%),
    linear-gradient(90deg, #0f1518 0%, #455157 12%, #7f8b91 25%, #cbd3d6 37%, #edf1f2 43%, #a7b2b7 53%, #667278 68%, #273035 84%, #101619 100%) !important;
  background-size: 112px 42px, auto, auto, auto;
  background-position: center, center, center, center;
  background-repeat: repeat, no-repeat, no-repeat, no-repeat;
  background-blend-mode: soft-light, normal, screen, normal;
  box-shadow:
    inset 1px 0 2px rgba(255,255,255,.4),
    inset -4px 0 6px rgba(0,0,0,.31),
    inset 0 0 10px rgba(255,255,255,.06),
    0 7px 9px rgba(0,0,0,.54) !important;
}

.safe-cracker-game .sc-latch-mount > i::after {
  content: '';
  position: absolute;
  inset: 2px 3px;
  border-radius: inherit;
  pointer-events: none;
  background: linear-gradient(94deg,
    transparent 0 23%,
    rgba(255,255,255,.04) 29%,
    rgba(255,255,255,.28) 39%,
    rgba(255,255,255,.07) 49%,
    transparent 65%);
  mix-blend-mode: screen;
  opacity: .72;
}

@media (max-width: 700px) {
  .safe-cracker-game .sc-latch-mount:nth-child(1) {
    top: calc(22% + 4px);
    transform: scale(.86);
  }

  .safe-cracker-game .sc-latch-mount:nth-child(2) {
    top: 51%;
    transform: translateY(-50%) scale(.62);
  }

  .safe-cracker-game .sc-bolts.left .sc-latch-mount:nth-child(2) { left: -9px; }
  .safe-cracker-game .sc-bolts.right .sc-latch-mount:nth-child(2) { right: -9px; }

  .safe-cracker-game .sc-latch-mount:nth-child(3) {
    bottom: 17%;
    transform: scale(.86);
  }

  .safe-cracker-game .sc-latch-spine {
    top: -11px;
    bottom: -11px;
    width: 15px;
  }

  .safe-cracker-game .sc-bolts.left .sc-latch-spine { left: 5px; }
  .safe-cracker-game .sc-bolts.right .sc-latch-spine { right: 5px; }

  .safe-cracker-game .sc-latch-spine::before,
  .safe-cracker-game .sc-latch-spine::after {
    width: 20px;
    height: 6px;
  }

  .safe-cracker-game .sc-latch-spine::before { top: 11px; }
  .safe-cracker-game .sc-latch-spine::after { bottom: 11px; }

  .safe-cracker-game .sc-latch-screw {
    top: 9px;
    width: 11px;
    height: 11px;
  }

  .safe-cracker-game .sc-bolts.left .sc-latch-screw { left: 31px; }
  .safe-cracker-game .sc-bolts.right .sc-latch-screw { right: 31px; }
  .safe-cracker-game .sc-latch-screw::before { width: 7px; }
  .safe-cracker-game .sc-latch-screw::after { height: 7px; }
}
${end}`;

const oldBlock = /\/\* SAFE_CRACKER_LATCH_REFINEMENT_V(?:5|6|7|8|9)_START \*\/[\s\S]*?\/\* SAFE_CRACKER_LATCH_REFINEMENT_V(?:5|6|7|8|9)_END \*\/\n?/g;
css = css.replace(oldBlock, '').trimEnd() + `\n\n${refinementCss}\n`;
await writeFile(cssUrl, css);

let client = await readFile(clientUrl, 'utf8');
if (!client.includes('// SAFE_CRACKER_LATCH_SEQUENCE_V1_HELPER')) {
  throw new Error('Safe Cracker latch refinement v9 could not find the latch helper.');
}
const mountReturnPattern = /    return `<span class="sc-latch-mount">[^`]*<\/span>`;/;
const mountedReturn = '    return `<span class="sc-latch-mount"><b class="sc-latch-spine" aria-hidden="true"></b><em class="sc-latch-screw" aria-hidden="true"></em><i class="${latchClass}"></i></span>`;';
if (mountReturnPattern.test(client)) {
  client = client.replace(mountReturnPattern, mountedReturn);
} else if (!client.includes('class="sc-latch-spine"') || !client.includes('class="sc-latch-screw"')) {
  throw new Error('Safe Cracker latch refinement v9 could not upgrade the latch mount markup.');
}
await writeFile(clientUrl, client);

let html = await readFile(indexUrl, 'utf8');
html = html.replace(/&latch=\d+/g, '&latch=9');
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker latch refinement v9: the top pair is a few pixels higher, all six assemblies use procedural rough brushed-metal grain based on web references, reflections are softer and more realistic, and only the existing right cylinders animate.');
