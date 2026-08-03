import { readFile, writeFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const start = '/* SAFE_CRACKER_LATCH_REFINEMENT_V7_START */';
const end = '/* SAFE_CRACKER_LATCH_REFINEMENT_V7_END */';

let css = await readFile(cssUrl, 'utf8');
if (!css.includes('/* SAFE_CRACKER_LATCH_SEQUENCE_V1_START */')) {
  throw new Error('Safe Cracker latch refinement v7 requires the mounted latch sequence.');
}

const refinementCss = String.raw`${start}
/* Screenshot-guided correction: the upper pair is raised into the clear strip
   between the display and dial, the upper and lower pairs are slightly smaller,
   and every visible metal surface uses sparse scratches over smooth brushed steel
   instead of repetitive banding. Only the existing right cylinders may move. */
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

/* Raise and gently reduce the top pair so it clears both major panels. */
.safe-cracker-game .sc-latch-mount:nth-child(1) {
  top: calc(23% + 4px);
  transform: scale(.9);
}

/* Keep the compact middle pair outboard of the dial. */
.safe-cracker-game .sc-latch-mount:nth-child(2) {
  top: 51%;
  transform: translateY(-50%) scale(.68);
}

.safe-cracker-game .sc-bolts.left .sc-latch-mount:nth-child(2) { left: -11px; }
.safe-cracker-game .sc-bolts.right .sc-latch-mount:nth-child(2) { right: -11px; }

/* Slightly reduce the lower pair without changing its vertical station. */
.safe-cracker-game .sc-latch-mount:nth-child(3) {
  bottom: 17%;
  transform: scale(.9);
}

/* Tall rectangular support fixed beneath each cylinder. Sparse angled scratches
   break up the smooth brushed highlight without creating regular horizontal lines. */
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
  background:
    linear-gradient(112deg, transparent 0 19%, rgba(255,255,255,.2) 19.2% 19.7%, transparent 20% 47%, rgba(0,0,0,.18) 47.2% 47.7%, transparent 48% 100%),
    linear-gradient(164deg, transparent 0 34%, rgba(255,255,255,.11) 34.2% 34.7%, transparent 35% 69%, rgba(0,0,0,.14) 69.2% 69.7%, transparent 70% 100%),
    radial-gradient(ellipse at 38% 24%, rgba(255,255,255,.15), transparent 40%),
    linear-gradient(90deg, #171e22 0%, #6f7b80 24%, #c2c9cb 47%, #6a767b 67%, #171d21 100%);
  box-shadow:
    inset 1px 0 1px rgba(255,255,255,.3),
    inset -3px 0 5px rgba(0,0,0,.36),
    inset 0 -8px 11px rgba(0,0,0,.16),
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
  background:
    linear-gradient(105deg, transparent 0 27%, rgba(255,255,255,.18) 27.3% 27.8%, transparent 28.1% 64%, rgba(0,0,0,.14) 64.3% 64.8%, transparent 65.1%),
    linear-gradient(90deg, #1b2226, #9aa4a8 42%, #4e595e 68%, #161c20);
  box-shadow:
    inset 0 1px 1px rgba(255,255,255,.28),
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

/* Brushed mounting plates with scattered wear marks rather than repeated stripes. */
.safe-cracker-game .sc-latch-mount::before {
  background:
    linear-gradient(111deg, transparent 0 14%, rgba(255,255,255,.17) 14.2% 14.7%, transparent 15% 43%, rgba(0,0,0,.15) 43.2% 43.7%, transparent 44% 78%, rgba(255,255,255,.09) 78.2% 78.7%, transparent 79%),
    linear-gradient(166deg, transparent 0 31%, rgba(0,0,0,.12) 31.2% 31.7%, transparent 32% 67%, rgba(255,255,255,.1) 67.2% 67.7%, transparent 68%),
    radial-gradient(ellipse at 32% 18%, rgba(255,255,255,.16), transparent 38%),
    linear-gradient(90deg, #1b2327 0%, #77858a 27%, #424e53 55%, #151c20 100%) !important;
}

.safe-cracker-game .sc-bolts.right .sc-latch-mount::before {
  background:
    linear-gradient(69deg, transparent 0 14%, rgba(255,255,255,.17) 14.2% 14.7%, transparent 15% 43%, rgba(0,0,0,.15) 43.2% 43.7%, transparent 44% 78%, rgba(255,255,255,.09) 78.2% 78.7%, transparent 79%),
    linear-gradient(14deg, transparent 0 31%, rgba(0,0,0,.12) 31.2% 31.7%, transparent 32% 67%, rgba(255,255,255,.1) 67.2% 67.7%, transparent 68%),
    radial-gradient(ellipse at 68% 18%, rgba(255,255,255,.16), transparent 38%),
    linear-gradient(270deg, #1b2327 0%, #77858a 27%, #424e53 55%, #151c20 100%) !important;
}

.safe-cracker-game .sc-latch-mount::after {
  background:
    linear-gradient(108deg, transparent 0 23%, rgba(255,255,255,.16) 23.2% 23.7%, transparent 24% 58%, rgba(0,0,0,.14) 58.2% 58.7%, transparent 59%),
    linear-gradient(159deg, transparent 0 38%, rgba(255,255,255,.09) 38.2% 38.7%, transparent 39% 76%, rgba(0,0,0,.11) 76.2% 76.7%, transparent 77%),
    radial-gradient(ellipse at 34% 18%, rgba(255,255,255,.14), transparent 42%),
    linear-gradient(90deg, #171e22, #727f84 48%, #1b2327) !important;
}

.safe-cracker-game .sc-bolts.right .sc-latch-mount::after {
  background:
    linear-gradient(72deg, transparent 0 23%, rgba(255,255,255,.16) 23.2% 23.7%, transparent 24% 58%, rgba(0,0,0,.14) 58.2% 58.7%, transparent 59%),
    linear-gradient(21deg, transparent 0 38%, rgba(255,255,255,.09) 38.2% 38.7%, transparent 39% 76%, rgba(0,0,0,.11) 76.2% 76.7%, transparent 77%),
    radial-gradient(ellipse at 66% 18%, rgba(255,255,255,.14), transparent 42%),
    linear-gradient(270deg, #171e22, #727f84 48%, #1b2327) !important;
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
    linear-gradient(118deg, transparent 0 35%, rgba(255,255,255,.16) 35.5% 37%, transparent 37.5% 66%, rgba(0,0,0,.18) 66.5% 68%, transparent 68.5%),
    radial-gradient(circle at 34% 27%, #f3f6f7 0 7%, #adb7bb 18%, #657075 39%, #30383c 64%, #111619 82%, #050708 100%);
  box-shadow:
    inset 0 1px 1px rgba(255,255,255,.34),
    inset 0 -2px 3px rgba(0,0,0,.5),
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

/* Cylinders retain the protected release classes while receiving smooth brushed
   highlights and a few irregular scratches, with no repeating line pattern. */
.safe-cracker-game .sc-latch-mount > i {
  background:
    linear-gradient(104deg, transparent 0 16%, rgba(255,255,255,.2) 16.2% 16.8%, transparent 17.1% 45%, rgba(0,0,0,.16) 45.2% 45.8%, transparent 46.1% 73%, rgba(255,255,255,.11) 73.2% 73.8%, transparent 74.1%),
    linear-gradient(163deg, transparent 0 29%, rgba(0,0,0,.12) 29.2% 29.8%, transparent 30.1% 61%, rgba(255,255,255,.1) 61.2% 61.8%, transparent 62.1%),
    radial-gradient(ellipse at 43% 17%, rgba(255,255,255,.19), transparent 34%),
    linear-gradient(90deg, #12181b 0%, #59666c 17%, #cbd2d4 44%, #838e92 64%, #222a2e 100%) !important;
}

@media (max-width: 700px) {
  .safe-cracker-game .sc-latch-mount:nth-child(1) {
    top: calc(23% + 7px);
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

const oldBlock = /\/\* SAFE_CRACKER_LATCH_REFINEMENT_V(?:5|6|7)_START \*\/[\s\S]*?\/\* SAFE_CRACKER_LATCH_REFINEMENT_V(?:5|6|7)_END \*\/\n?/g;
css = css.replace(oldBlock, '').trimEnd() + `\n\n${refinementCss}\n`;
await writeFile(cssUrl, css);

let client = await readFile(clientUrl, 'utf8');
if (!client.includes('// SAFE_CRACKER_LATCH_SEQUENCE_V1_HELPER')) {
  throw new Error('Safe Cracker latch refinement v7 could not find the latch helper.');
}
const mountReturnPattern = /    return `<span class="sc-latch-mount">[^`]*<\/span>`;/;
const mountedReturn = '    return `<span class="sc-latch-mount"><b class="sc-latch-spine" aria-hidden="true"></b><em class="sc-latch-screw" aria-hidden="true"></em><i class="${latchClass}"></i></span>`;';
if (mountReturnPattern.test(client)) {
  client = client.replace(mountReturnPattern, mountedReturn);
} else if (!client.includes('class="sc-latch-spine"') || !client.includes('class="sc-latch-screw"')) {
  throw new Error('Safe Cracker latch refinement v7 could not upgrade the latch mount markup.');
}
await writeFile(clientUrl, client);

let html = await readFile(indexUrl, 'utf8');
html = html.replace(/&latch=\d+/g, '&latch=7');
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker latch refinement v7: the top pair is raised and slightly smaller, the bottom pair is slightly smaller, all six assemblies use smooth scratched brushed metal without repetitive lines, and only the existing right cylinders animate.');
