import { readFile, writeFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const start = '/* SAFE_CRACKER_LATCH_REFINEMENT_V6_START */';
const end = '/* SAFE_CRACKER_LATCH_REFINEMENT_V6_END */';

let css = await readFile(cssUrl, 'utf8');
if (!css.includes('/* SAFE_CRACKER_LATCH_SEQUENCE_V1_START */')) {
  throw new Error('Safe Cracker latch refinement v6 requires the mounted latch sequence.');
}

const refinementCss = String.raw`${start}
/* Close-up reference pass: all six assemblies use fixed brushed steel mounting
   hardware. The top pair sits fully below the display, the middle pair is
   smaller and farther outboard, and only the existing right-side cylinders
   are allowed to move during release. */
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

/* Drop the upper pair below the display, including the taller support tongue. */
.safe-cracker-game .sc-latch-mount:nth-child(1) {
  top: calc(25% + 10px);
}

/* Pull the center pair away from the dial and reduce its overall footprint. */
.safe-cracker-game .sc-latch-mount:nth-child(2) {
  top: 51%;
  transform: translateY(-50%) scale(.68);
}

.safe-cracker-game .sc-bolts.left .sc-latch-mount:nth-child(2) { left: -11px; }
.safe-cracker-game .sc-bolts.right .sc-latch-mount:nth-child(2) { right: -11px; }

.safe-cracker-game .sc-latch-mount:nth-child(3) {
  bottom: 17%;
}

/* Tall rectangular steel support directly under each cylinder. It extends
   above and below the barrel and remains attached to the safe at all times. */
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
    linear-gradient(102deg, transparent 0 16%, rgba(255,255,255,.2) 16.4% 17.1%, transparent 17.6% 46%, rgba(0,0,0,.2) 46.4% 47.2%, transparent 47.8% 73%, rgba(255,255,255,.1) 73.4% 74%, transparent 74.6%),
    linear-gradient(78deg, transparent 0 28%, rgba(0,0,0,.15) 28.4% 29%, transparent 29.6% 64%, rgba(255,255,255,.12) 64.4% 65%, transparent 65.6%),
    repeating-linear-gradient(0deg, rgba(255,255,255,.065) 0 1px, rgba(0,0,0,.05) 1px 2px, transparent 2px 4px),
    linear-gradient(90deg, #171e22 0%, #6f7b80 24%, #c2c9cb 47%, #6a767b 67%, #171d21 100%);
  box-shadow:
    inset 1px 0 1px rgba(255,255,255,.3),
    inset -3px 0 5px rgba(0,0,0,.36),
    inset 0 -8px 11px rgba(0,0,0,.16),
    0 5px 8px rgba(0,0,0,.48);
}

.safe-cracker-game .sc-bolts.left .sc-latch-spine { left: 5px; }
.safe-cracker-game .sc-bolts.right .sc-latch-spine { right: 5px; }

/* Short collar lips make the support look inserted through the cylinder body,
   matching the stepped top and bottom shoulders in the close-up reference. */
.safe-cracker-game .sc-latch-spine::before,
.safe-cracker-game .sc-latch-spine::after {
  content: '';
  position: absolute;
  left: 50%;
  width: 24px;
  height: 7px;
  border: 2px solid #0b1012;
  background:
    repeating-linear-gradient(0deg, rgba(255,255,255,.06) 0 1px, rgba(0,0,0,.045) 1px 2px, transparent 2px 4px),
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

/* Brushed and scratched steel across the backplate and inward mounting ear. */
.safe-cracker-game .sc-latch-mount::before {
  background:
    linear-gradient(111deg, transparent 0 12%, rgba(255,255,255,.15) 12.4% 13%, transparent 13.6% 39%, rgba(0,0,0,.16) 39.4% 40.1%, transparent 40.7% 72%, rgba(255,255,255,.08) 72.4% 73%, transparent 73.6%),
    linear-gradient(69deg, transparent 0 26%, rgba(0,0,0,.13) 26.4% 27%, transparent 27.6% 61%, rgba(255,255,255,.11) 61.4% 62%, transparent 62.6%),
    repeating-linear-gradient(0deg, rgba(255,255,255,.055) 0 1px, rgba(0,0,0,.045) 1px 2px, transparent 2px 4px),
    linear-gradient(180deg, rgba(255,255,255,.22), transparent 18%),
    linear-gradient(90deg, #1b2327 0%, #77858a 27%, #424e53 55%, #151c20 100%) !important;
}

.safe-cracker-game .sc-bolts.right .sc-latch-mount::before {
  background:
    linear-gradient(69deg, transparent 0 12%, rgba(255,255,255,.15) 12.4% 13%, transparent 13.6% 39%, rgba(0,0,0,.16) 39.4% 40.1%, transparent 40.7% 72%, rgba(255,255,255,.08) 72.4% 73%, transparent 73.6%),
    linear-gradient(111deg, transparent 0 26%, rgba(0,0,0,.13) 26.4% 27%, transparent 27.6% 61%, rgba(255,255,255,.11) 61.4% 62%, transparent 62.6%),
    repeating-linear-gradient(0deg, rgba(255,255,255,.055) 0 1px, rgba(0,0,0,.045) 1px 2px, transparent 2px 4px),
    linear-gradient(180deg, rgba(255,255,255,.22), transparent 18%),
    linear-gradient(270deg, #1b2327 0%, #77858a 27%, #424e53 55%, #151c20 100%) !important;
}

.safe-cracker-game .sc-latch-mount::after {
  background:
    linear-gradient(108deg, transparent 0 18%, rgba(255,255,255,.15) 18.4% 19%, transparent 19.6% 48%, rgba(0,0,0,.15) 48.4% 49%, transparent 49.6% 76%, rgba(255,255,255,.08) 76.4% 77%, transparent 77.6%),
    repeating-linear-gradient(0deg, rgba(255,255,255,.06) 0 1px, rgba(0,0,0,.045) 1px 2px, transparent 2px 4px),
    linear-gradient(180deg, rgba(255,255,255,.23), transparent 23%),
    linear-gradient(90deg, #171e22, #727f84 48%, #1b2327) !important;
}

.safe-cracker-game .sc-bolts.right .sc-latch-mount::after {
  background:
    linear-gradient(72deg, transparent 0 18%, rgba(255,255,255,.15) 18.4% 19%, transparent 19.6% 48%, rgba(0,0,0,.15) 48.4% 49%, transparent 49.6% 76%, rgba(255,255,255,.08) 76.4% 77%, transparent 77.6%),
    repeating-linear-gradient(0deg, rgba(255,255,255,.06) 0 1px, rgba(0,0,0,.045) 1px 2px, transparent 2px 4px),
    linear-gradient(180deg, rgba(255,255,255,.23), transparent 23%),
    linear-gradient(270deg, #171e22, #727f84 48%, #1b2327) !important;
}

/* Separate screw element provides a recessed Phillips head and worn metal face. */
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

/* The cylinders keep the existing release classes and timing; this pass only
   changes their surface finish to match the worn brushed-metal reference. */
.safe-cracker-game .sc-latch-mount > i {
  background:
    linear-gradient(105deg, transparent 0 13%, rgba(255,255,255,.2) 13.4% 14.1%, transparent 14.7% 39%, rgba(0,0,0,.17) 39.4% 40.1%, transparent 40.7% 66%, rgba(255,255,255,.11) 66.4% 67.1%, transparent 67.7%),
    linear-gradient(77deg, transparent 0 22%, rgba(0,0,0,.13) 22.4% 23%, transparent 23.6% 55%, rgba(255,255,255,.1) 55.4% 56%, transparent 56.6%),
    repeating-linear-gradient(0deg, rgba(255,255,255,.075) 0 1px, rgba(0,0,0,.055) 1px 2px, transparent 2px 4px),
    linear-gradient(180deg, rgba(255,255,255,.2), transparent 17%),
    linear-gradient(90deg, #12181b 0%, #59666c 17%, #cbd2d4 44%, #838e92 64%, #222a2e 100%) !important;
}

@media (max-width: 700px) {
  .safe-cracker-game .sc-latch-mount:nth-child(1) {
    top: calc(25% + 14px);
  }

  .safe-cracker-game .sc-latch-mount:nth-child(2) {
    top: 51%;
    transform: translateY(-50%) scale(.62);
  }

  .safe-cracker-game .sc-bolts.left .sc-latch-mount:nth-child(2) { left: -9px; }
  .safe-cracker-game .sc-bolts.right .sc-latch-mount:nth-child(2) { right: -9px; }

  .safe-cracker-game .sc-latch-mount:nth-child(3) {
    bottom: 17%;
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

const oldBlock = /\/\* SAFE_CRACKER_LATCH_REFINEMENT_V(?:5|6)_START \*\/[\s\S]*?\/\* SAFE_CRACKER_LATCH_REFINEMENT_V(?:5|6)_END \*\/\n?/g;
css = css.replace(oldBlock, '').trimEnd() + `\n\n${refinementCss}\n`;
await writeFile(cssUrl, css);

let client = await readFile(clientUrl, 'utf8');
if (!client.includes('// SAFE_CRACKER_LATCH_SEQUENCE_V1_HELPER')) {
  throw new Error('Safe Cracker latch refinement v6 could not find the latch helper.');
}
const mountReturnPattern = /    return `<span class="sc-latch-mount">[^`]*<\/span>`;/;
const mountedReturn = '    return `<span class="sc-latch-mount"><b class="sc-latch-spine" aria-hidden="true"></b><em class="sc-latch-screw" aria-hidden="true"></em><i class="${latchClass}"></i></span>`;';
if (mountReturnPattern.test(client)) {
  client = client.replace(mountReturnPattern, mountedReturn);
} else if (!client.includes('class="sc-latch-spine"') || !client.includes('class="sc-latch-screw"')) {
  throw new Error('Safe Cracker latch refinement v6 could not upgrade the latch mount markup.');
}
await writeFile(clientUrl, client);

let html = await readFile(indexUrl, 'utf8');
html = html.replace(/&latch=\d+/g, '&latch=6');
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker latch refinement v6: all six assemblies now match the close-up with taller fixed support tongues, scratched brushed metal, a lower top pair, a smaller outboard middle pair, and unchanged right-cylinder-only release motion.');
