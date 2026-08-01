import { readFile, writeFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const blocks = [
  ['/* SAFE_CRACKER_LIGHT_SOURCE_V1_START */', '/* SAFE_CRACKER_LIGHT_SOURCE_V1_END */'],
  ['/* SAFE_CRACKER_LIGHT_SOURCE_V2_START */', '/* SAFE_CRACKER_LIGHT_SOURCE_V2_END */'],
  ['/* SAFE_CRACKER_LIGHT_SOURCE_V3_START */', '/* SAFE_CRACKER_LIGHT_SOURCE_V3_END */']
];
const start = blocks[2][0];
const end = blocks[2][1];

let css = await readFile(cssUrl, 'utf8');

const lightPass = String.raw`${start}
/* Corrected Pass 3 v3: one broad cool-white scene light overlays the entire
   safe shell. No directional highlight is painted onto the rotating dial face,
   so dial parts move beneath stationary illumination instead of carrying it. */
.safe-cracker-game {
  --sc-scene-key: rgba(232, 243, 251, .135);
  --sc-scene-key-soft: rgba(193, 215, 232, .062);
  --sc-scene-fill: rgba(143, 176, 202, .042);
}

.safe-cracker-game .sc-safe-shell {
  position: relative;
  isolation: isolate;
  background-image:
    url('/assets/safe-cracker/textures/safe-steel-base.svg?v=1'),
    radial-gradient(ellipse at 26% 14%, rgba(221, 231, 234, .1), transparent 38%),
    linear-gradient(145deg, #39444a 0%, #171e22 48%, #0d1215 78%, #293238 100%) !important;
  background-size: 360px 360px, 100% 100%, 100% 100% !important;
  background-repeat: repeat, no-repeat, no-repeat !important;
  background-blend-mode: soft-light, screen, normal !important;
}

.safe-cracker-game .sc-safe-shell::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 40;
  border-radius: 24px;
  pointer-events: none;
  background:
    radial-gradient(ellipse 112% 72% at 34% -4%,
      var(--sc-scene-key) 0%,
      var(--sc-scene-key-soft) 38%,
      rgba(185, 210, 229, .025) 64%,
      transparent 88%),
    radial-gradient(ellipse 82% 68% at 88% 86%,
      var(--sc-scene-fill) 0%,
      rgba(124, 160, 188, .018) 54%,
      transparent 82%);
}

.safe-cracker-game .sc-safe-door {
  background-image:
    url('/assets/safe-cracker/textures/metal-wear.svg?v=1'),
    url('/assets/safe-cracker/textures/safe-steel-base.svg?v=1'),
    radial-gradient(ellipse at 32% 16%, rgba(230, 238, 240, .105), transparent 36%),
    radial-gradient(ellipse at 72% 86%, rgba(0, 0, 0, .085), transparent 50%),
    linear-gradient(145deg, #58656b 0%, #273136 30%, #101619 69%, #354047 100%) !important;
  background-position: center !important;
  background-size: cover, 330px 330px, 100% 100%, 100% 100%, 100% 100% !important;
  background-repeat: no-repeat, repeat, no-repeat, no-repeat, no-repeat !important;
  background-blend-mode: soft-light, overlay, screen, multiply, normal !important;
  box-shadow:
    inset 0 0 0 3px #6f7a83,
    inset 0 0 0 8px #242c33,
    inset 0 2px 0 rgba(231, 241, 249, .07),
    inset 12px 0 22px rgba(214, 231, 243, .025),
    inset -14px -8px 28px rgba(132, 166, 192, .035),
    inset 0 -24px 38px rgba(0, 0, 0, .16),
    inset 0 0 48px rgba(0, 0, 0, .46),
    0 20px 36px rgba(0, 0, 0, .44) !important;
}

.safe-cracker-game .sc-safe-door::before {
  border-top-color: rgba(222, 236, 247, .14) !important;
  border-left-color: rgba(188, 208, 224, .075) !important;
  border-right-color: rgba(15, 23, 29, .25) !important;
  border-bottom-color: rgba(7, 12, 16, .3) !important;
}

.safe-cracker-game .sc-display {
  border-top-color: rgba(145, 168, 185, .5) !important;
  border-left-color: rgba(96, 119, 137, .38) !important;
  border-right-color: #11171b !important;
  border-bottom-color: #090d10 !important;
}

.safe-cracker-game .sc-dial-wrap {
  box-shadow:
    inset 0 13px 18px rgba(0, 0, 0, .21),
    inset 0 -11px 18px rgba(151, 181, 204, .04),
    inset -11px -6px 22px rgba(126, 160, 187, .028),
    0 14px 24px rgba(0, 0, 0, .25) !important;
}

/* Remove the former dial-local lighting layer. The scene overlay above is the
   only directional light and remains fixed while the dial rotates below it. */
.safe-cracker-game .sc-dial::before {
  content: none !important;
}

.safe-cracker-game .sc-dial-face {
  background-image:
    url('/assets/safe-cracker/textures/dial-machined.svg?v=1'),
    radial-gradient(circle at 50% 50%, rgba(153, 168, 178, .08) 0 23%, transparent 25%),
    repeating-conic-gradient(from -2deg, #d2aa5d 0deg 1.5deg, #5c4929 1.5deg 3.3deg, #222a30 3.3deg 36deg),
    radial-gradient(circle, #64717b 0 66%, #1b2228 67% 73%, #a17a35 74% 78%, #1a2025 79%) !important;
  background-size: cover, 100% 100%, 100% 100%, 100% 100% !important;
  background-repeat: no-repeat !important;
  background-blend-mode: soft-light, normal, normal, normal !important;
  border-top-color: #28333b !important;
  border-left-color: #222c33 !important;
  border-right-color: #101519 !important;
  border-bottom-color: #0c1114 !important;
}

.safe-cracker-game .sc-dial-hub {
  background-image:
    url('/assets/safe-cracker/textures/dial-machined.svg?v=1'),
    radial-gradient(circle at 50% 50%, #748089 0%, #323c44 46%, #11171c 74%) !important;
  background-size: cover, 100% 100% !important;
  background-repeat: no-repeat !important;
  background-blend-mode: soft-light, normal !important;
}

.safe-cracker-game .sc-step-controls button {
  background-image:
    url('/assets/safe-cracker/textures/safe-steel-base.svg?v=1'),
    linear-gradient(180deg, rgba(150, 163, 170, .42) 0 9%, transparent 10%),
    linear-gradient(180deg, #4d585e, #252e33 52%, #161d21) !important;
  background-size: 180px 180px, 100% 100%, 100% 100% !important;
  background-repeat: repeat, no-repeat, no-repeat !important;
  background-blend-mode: soft-light, screen, normal !important;
}

.safe-cracker-game .sc-confirm-button {
  background-image:
    url('/assets/safe-cracker/textures/metal-wear.svg?v=1'),
    url('/assets/safe-cracker/textures/safe-steel-base.svg?v=1'),
    linear-gradient(180deg, rgba(255, 239, 196, .14), transparent 12%),
    linear-gradient(180deg, #606a71 0 42%, #4c3920 43% 66%, #20272b 67% 100%) !important;
  background-size: cover, 240px 180px, 100% 100%, 100% 100% !important;
  background-repeat: no-repeat, repeat, no-repeat, no-repeat !important;
  background-blend-mode: soft-light, soft-light, screen, normal !important;
}

.safe-cracker-game .sc-safe-handle,
.safe-cracker-game .sc-bolts i {
  border-color: rgba(31, 42, 50, .94);
}
${end}`;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
for (const [blockStart, blockEnd] of blocks) {
  const blockPattern = new RegExp(`${escapeRegExp(blockStart)}[\\s\\S]*?${escapeRegExp(blockEnd)}\\n?`, 'g');
  css = css.replace(blockPattern, '');
}
css = css.trimEnd() + '\n\n' + lightPass + '\n';
await writeFile(cssUrl, css);

let index = await readFile(indexUrl, 'utf8');
index = index.replace(/&light=\d+/g, '');
index = index.replace(/(safe-cracker\.css[^"']*)/, '$1&light=3');
await writeFile(indexUrl, index);

console.log('Applied Safe Cracker light source v3: one cool-white scene overlay spans the entire safe while all dial-bound directional highlights are removed.');
