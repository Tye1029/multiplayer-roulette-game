import { readFile, writeFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const start = '/* SAFE_CRACKER_SCREW_REFINEMENT_V1_START */';
const end = '/* SAFE_CRACKER_SCREW_REFINEMENT_V1_END */';

let css = await readFile(cssUrl, 'utf8');
if (!css.includes('/* SAFE_CRACKER_VISUAL_SHELL_V1_START */') || !css.includes('/* SAFE_CRACKER_VISUAL_HUD_V3_START */')) {
  throw new Error('Safe Cracker screw refinement requires the visual shell and industrial display bezel.');
}

const screwCss = String.raw`${start}
/* Replace the former silver corner dots with real Phillips-head hardware.
   The display and door screws share the latch pass's scratched brushed steel,
   with a restrained curved glare rather than a flat white spot. */
.safe-cracker-game .sc-safe-door::after {
  background: linear-gradient(118deg, transparent 0 31%, rgba(255,255,255,.045) 42%, transparent 54%) !important;
}

.safe-cracker-game .sc-door-screws {
  position: absolute;
  z-index: 8;
  inset: 8px;
  pointer-events: none;
}

.safe-cracker-game .sc-display-bezel i,
.safe-cracker-game .sc-door-screws i {
  position: absolute;
  display: block;
  overflow: hidden;
  border: 1px solid #070a0c;
  border-radius: 50%;
  background-color: #7b878c;
  background-image:
    url('./brushed-metal-horizontal-v1.svg?grain=1'),
    linear-gradient(126deg, transparent 0 19%, rgba(255,255,255,.08) 25%, rgba(255,255,255,.56) 36%, rgba(255,255,255,.15) 45%, transparent 57%),
    linear-gradient(158deg, transparent 0 64%, rgba(0,0,0,.18) 64.4% 65.1%, transparent 65.5%),
    radial-gradient(circle at 37% 29%, #f8fbfc 0 6%, #bec8cc 17%, #78858a 39%, #3b4549 65%, #13191c 84%, #060809 100%);
  background-size: 36px 20px, auto, auto, auto;
  background-position: center, center, center, center;
  background-repeat: repeat, no-repeat, no-repeat, no-repeat;
  background-blend-mode: soft-light, screen, normal, normal;
  box-shadow:
    inset 0 1px 1px rgba(255,255,255,.46),
    inset -1px -2px 3px rgba(0,0,0,.5),
    0 2px 3px rgba(0,0,0,.62),
    0 0 4px rgba(225,236,239,.12);
}

.safe-cracker-game .sc-display-bezel i::before,
.safe-cracker-game .sc-display-bezel i::after,
.safe-cracker-game .sc-door-screws i::before,
.safe-cracker-game .sc-door-screws i::after {
  content: '';
  position: absolute;
  z-index: 2;
  left: 50%;
  top: 50%;
  border-radius: 2px;
  background: linear-gradient(180deg, #050708, #252d31 47%, #050708);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.1),
    0 1px 0 rgba(255,255,255,.12);
  transform: translate(-50%, -50%);
}

.safe-cracker-game .sc-door-screws i {
  width: 13px;
  height: 13px;
}

.safe-cracker-game .sc-door-screws i::before { width: 8px; height: 2px; }
.safe-cracker-game .sc-door-screws i::after { width: 2px; height: 8px; }
.safe-cracker-game .sc-door-screws i:nth-child(1) { left: 0; top: 0; }
.safe-cracker-game .sc-door-screws i:nth-child(2) { right: 0; top: 0; }
.safe-cracker-game .sc-door-screws i:nth-child(3) { left: 0; bottom: 0; }
.safe-cracker-game .sc-door-screws i:nth-child(4) { right: 0; bottom: 0; }

.safe-cracker-game .sc-display-bezel i {
  width: 10px;
  height: 10px;
}

.safe-cracker-game .sc-display-bezel i::before { width: 6px; height: 2px; }
.safe-cracker-game .sc-display-bezel i::after { width: 2px; height: 6px; }
.safe-cracker-game .sc-display-bezel i:nth-child(1) { left: 4px; top: 4px; }
.safe-cracker-game .sc-display-bezel i:nth-child(2) { right: 4px; top: 4px; }
.safe-cracker-game .sc-display-bezel i:nth-child(3) { left: 4px; bottom: 4px; }
.safe-cracker-game .sc-display-bezel i:nth-child(4) { right: 4px; bottom: 4px; }

@media (max-width: 700px) {
  .safe-cracker-game .sc-door-screws { inset: 6px; }
  .safe-cracker-game .sc-door-screws i { width: 11px; height: 11px; }
  .safe-cracker-game .sc-door-screws i::before { width: 7px; }
  .safe-cracker-game .sc-door-screws i::after { height: 7px; }
  .safe-cracker-game .sc-display-bezel i { width: 9px; height: 9px; }
  .safe-cracker-game .sc-display-bezel i::before { width: 5px; }
  .safe-cracker-game .sc-display-bezel i::after { height: 5px; }
}
${end}`;

const oldBlock = /\/\* SAFE_CRACKER_SCREW_REFINEMENT_V\d+_START \*\/[\s\S]*?\/\* SAFE_CRACKER_SCREW_REFINEMENT_V\d+_END \*\/\n?/g;
css = css.replace(oldBlock, '').trimEnd() + `\n\n${screwCss}\n`;
await writeFile(cssUrl, css);

let client = await readFile(clientUrl, 'utf8');
if (!client.includes('class="sc-display-bezel"')) {
  throw new Error('Safe Cracker screw refinement could not find the display bezel hardware.');
}
if (!client.includes('class="sc-door-screws"')) {
  const doorPattern = /(<div class="sc-safe-door">)/;
  if (!doorPattern.test(client)) throw new Error('Safe Cracker screw refinement could not find the safe door.');
  client = client.replace(
    doorPattern,
    '$1\n          <div class="sc-door-screws" aria-hidden="true"><i></i><i></i><i></i><i></i></div>'
  );
}
await writeFile(clientUrl, client);

let html = await readFile(indexUrl, 'utf8');
html = html.replace(/&screw=\d+/g, '');
html = html.replace(/(\/assets\/safe-cracker\/safe-cracker\.(?:css|js)\?[^"'\s>]+)/g, '$1&screw=1');
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker screw refinement v1: all display and safe-door corner dots are now scratched brushed-metal Phillips screws with realistic reflective glare.');
