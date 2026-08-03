import { readFile, writeFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const start = '/* SAFE_CRACKER_LATCH_REFINEMENT_V5_START */';
const end = '/* SAFE_CRACKER_LATCH_REFINEMENT_V5_END */';

let css = await readFile(cssUrl, 'utf8');
if (!css.includes('/* SAFE_CRACKER_LATCH_SEQUENCE_V1_START */')) {
  throw new Error('Safe Cracker latch refinement v5 requires the mounted latch sequence.');
}

const refinementCss = String.raw`${start}
/* Screenshot-guided latch refinement: the top pair clears the digital display,
   the middle pair is smaller and pulled outward from the dial, and every latch
   receives a brushed mounting spine plus a recessed Phillips-head screw. */
.safe-cracker-game .sc-bolts {
  top: 0 !important;
  bottom: 0 !important;
  display: block !important;
  justify-content: initial !important;
}

.safe-cracker-game .sc-bolts.left .sc-latch-mount { left: 0; }
.safe-cracker-game .sc-bolts.right .sc-latch-mount { right: 0; }

.safe-cracker-game .sc-latch-mount:nth-child(1) {
  top: calc(18% + 24px);
}

.safe-cracker-game .sc-latch-mount:nth-child(2) {
  top: 50%;
  transform: translateY(-50%) scale(.78);
}

.safe-cracker-game .sc-bolts.left .sc-latch-mount:nth-child(2) { left: -5px; }
.safe-cracker-game .sc-bolts.right .sc-latch-mount:nth-child(2) { right: -5px; }

.safe-cracker-game .sc-latch-mount:nth-child(3) {
  bottom: 18%;
}

/* Vertical steel tongue visible above and below the latch cylinder. */
.safe-cracker-game .sc-latch-spine {
  position: absolute;
  top: -5px;
  bottom: -5px;
  width: 17px;
  z-index: 2;
  display: block;
  border: 2px solid #101619;
  border-radius: 5px;
  background:
    linear-gradient(104deg, transparent 0 19%, rgba(255,255,255,.18) 19.4% 20.2%, transparent 20.7% 58%, rgba(0,0,0,.18) 58.5% 59.5%, transparent 60%),
    repeating-linear-gradient(0deg, rgba(255,255,255,.055) 0 1px, rgba(0,0,0,.045) 1px 2px, transparent 2px 4px),
    linear-gradient(90deg, #20282d 0%, #aab4b8 38%, #667278 62%, #1a2125 100%);
  box-shadow:
    inset 1px 0 1px rgba(255,255,255,.22),
    inset -3px 0 5px rgba(0,0,0,.3),
    0 5px 8px rgba(0,0,0,.44);
}

.safe-cracker-game .sc-bolts.left .sc-latch-spine { left: 7px; }
.safe-cracker-game .sc-bolts.right .sc-latch-spine { right: 7px; }

/* Brushed and lightly scratched steel across the mounting plate and flange. */
.safe-cracker-game .sc-latch-mount::before {
  background:
    linear-gradient(112deg, transparent 0 13%, rgba(255,255,255,.13) 13.4% 14%, transparent 14.5% 48%, rgba(0,0,0,.14) 48.4% 49%, transparent 49.5% 100%),
    repeating-linear-gradient(0deg, rgba(255,255,255,.045) 0 1px, rgba(0,0,0,.035) 1px 2px, transparent 2px 4px),
    linear-gradient(180deg, rgba(255,255,255,.2), transparent 18%),
    linear-gradient(90deg, #20282c 0%, #7c898f 26%, #424d52 54%, #171e22 100%) !important;
}

.safe-cracker-game .sc-bolts.right .sc-latch-mount::before {
  background:
    linear-gradient(68deg, transparent 0 17%, rgba(255,255,255,.13) 17.4% 18%, transparent 18.5% 56%, rgba(0,0,0,.14) 56.4% 57%, transparent 57.5% 100%),
    repeating-linear-gradient(0deg, rgba(255,255,255,.045) 0 1px, rgba(0,0,0,.035) 1px 2px, transparent 2px 4px),
    linear-gradient(180deg, rgba(255,255,255,.2), transparent 18%),
    linear-gradient(270deg, #20282c 0%, #7c898f 26%, #424d52 54%, #171e22 100%) !important;
}

.safe-cracker-game .sc-latch-mount::after {
  background:
    linear-gradient(108deg, transparent 0 22%, rgba(255,255,255,.14) 22.4% 23%, transparent 23.5% 68%, rgba(0,0,0,.13) 68.4% 69%, transparent 69.5%),
    repeating-linear-gradient(0deg, rgba(255,255,255,.05) 0 1px, rgba(0,0,0,.04) 1px 2px, transparent 2px 4px),
    linear-gradient(180deg, rgba(255,255,255,.22), transparent 23%),
    linear-gradient(90deg, #1c2327, #6d797f 48%, #20282c) !important;
}

.safe-cracker-game .sc-bolts.right .sc-latch-mount::after {
  background:
    linear-gradient(72deg, transparent 0 20%, rgba(255,255,255,.14) 20.4% 21%, transparent 21.5% 64%, rgba(0,0,0,.13) 64.4% 65%, transparent 65.5%),
    repeating-linear-gradient(0deg, rgba(255,255,255,.05) 0 1px, rgba(0,0,0,.04) 1px 2px, transparent 2px 4px),
    linear-gradient(180deg, rgba(255,255,255,.22), transparent 23%),
    linear-gradient(270deg, #1c2327, #6d797f 48%, #20282c) !important;
}

/* Separate screw element provides a true Phillips cross instead of a round dot. */
.safe-cracker-game .sc-latch-screw {
  position: absolute;
  top: 11px;
  width: 13px;
  height: 13px;
  z-index: 4;
  display: block;
  border: 1px solid #070a0c;
  border-radius: 50%;
  background: radial-gradient(circle at 34% 27%, #f3f6f7 0 7%, #adb7bb 18%, #657075 39%, #30383c 64%, #111619 82%, #050708 100%);
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

/* Cylinders retain their 3D highlight but gain fine horizontal brushing and scratches. */
.safe-cracker-game .sc-latch-mount > i {
  background:
    linear-gradient(105deg, transparent 0 16%, rgba(255,255,255,.18) 16.4% 17%, transparent 17.5% 44%, rgba(0,0,0,.16) 44.4% 45%, transparent 45.5% 73%, rgba(255,255,255,.1) 73.4% 74%, transparent 74.5%),
    repeating-linear-gradient(0deg, rgba(255,255,255,.07) 0 1px, rgba(0,0,0,.05) 1px 2px, transparent 2px 4px),
    linear-gradient(180deg, rgba(255,255,255,.18), transparent 17%),
    linear-gradient(90deg, #151b1f 0%, #59666c 18%, #c7d0d3 46%, #7f8b90 63%, #252d31 100%) !important;
}

@media (max-width: 700px) {
  .safe-cracker-game .sc-latch-mount:nth-child(1) {
    top: calc(18% + 30px);
  }

  .safe-cracker-game .sc-latch-mount:nth-child(2) {
    top: 50%;
    transform: translateY(-50%) scale(.72);
  }

  .safe-cracker-game .sc-bolts.left .sc-latch-mount:nth-child(2) { left: -5px; }
  .safe-cracker-game .sc-bolts.right .sc-latch-mount:nth-child(2) { right: -5px; }

  .safe-cracker-game .sc-latch-spine {
    top: -4px;
    bottom: -4px;
    width: 14px;
  }

  .safe-cracker-game .sc-bolts.left .sc-latch-spine { left: 6px; }
  .safe-cracker-game .sc-bolts.right .sc-latch-spine { right: 6px; }

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

const oldBlock = new RegExp(`${start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n?`, 'g');
css = css.replace(oldBlock, '').trimEnd() + `\n\n${refinementCss}\n`;
await writeFile(cssUrl, css);

let client = await readFile(clientUrl, 'utf8');
if (!client.includes('// SAFE_CRACKER_LATCH_SEQUENCE_V1_HELPER')) {
  throw new Error('Safe Cracker latch refinement v5 could not find the latch helper.');
}
const mountReturnPattern = /    return `<span class="sc-latch-mount">[^`]*<\/span>`;/;
const mountedReturn = '    return `<span class="sc-latch-mount"><b class="sc-latch-spine" aria-hidden="true"></b><em class="sc-latch-screw" aria-hidden="true"></em><i class="${latchClass}"></i></span>`;';
if (mountReturnPattern.test(client)) {
  client = client.replace(mountReturnPattern, mountedReturn);
} else if (!client.includes('class="sc-latch-spine"') || !client.includes('class="sc-latch-screw"')) {
  throw new Error('Safe Cracker latch refinement v5 could not upgrade the latch mount markup.');
}
await writeFile(clientUrl, client);

let html = await readFile(indexUrl, 'utf8');
html = html.replace(/&latch=\d+/g, '&latch=5');
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker latch refinement v5: top latches clear the display, middle latches shrink away from the dial, and all six mounts gain protruding brushed steel spines, scratched metal surfaces, and Phillips-head screws.');
