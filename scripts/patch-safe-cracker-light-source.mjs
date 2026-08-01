import { readFile, writeFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const blocks = [
  ['/* SAFE_CRACKER_LIGHT_SOURCE_V1_START */', '/* SAFE_CRACKER_LIGHT_SOURCE_V1_END */'],
  ['/* SAFE_CRACKER_LIGHT_SOURCE_V2_START */', '/* SAFE_CRACKER_LIGHT_SOURCE_V2_END */']
];
const start = blocks[1][0];
const end = blocks[1][1];

let css = await readFile(cssUrl, 'utf8');

const lightPass = String.raw`${start}
/* Corrected Pass 3: one cool white overhead key with a soft reflected fill.
   The dial light is stationary while the textured dial face rotates beneath it,
   so illumination no longer turns into yellow wedges attached to dial sections. */
.safe-cracker-game {
  --sc-key-cool: rgba(226, 239, 250, .18);
  --sc-key-cool-soft: rgba(181, 207, 228, .095);
  --sc-fill-cool: rgba(132, 169, 199, .065);
  --sc-key-edge: rgba(242, 248, 253, .06);
  --sc-key-falloff: rgba(0, 0, 0, .105);
}

.safe-cracker-game .sc-safe-shell {
  background-image:
    radial-gradient(ellipse at 34% -10%, var(--sc-key-cool) 0%, var(--sc-key-cool-soft) 29%, transparent 61%),
    radial-gradient(ellipse at 84% 78%, var(--sc-fill-cool) 0%, transparent 54%),
    linear-gradient(128deg, var(--sc-key-edge) 0%, transparent 49%, var(--sc-key-falloff) 100%),
    url('/assets/safe-cracker/textures/safe-steel-base.svg?v=1'),
    radial-gradient(ellipse at 26% 14%, rgba(221, 231, 234, .1), transparent 38%),
    linear-gradient(145deg, #39444a 0%, #171e22 48%, #0d1215 78%, #293238 100%) !important;
  background-size: 100% 100%, 100% 100%, 100% 100%, 360px 360px, 100% 100%, 100% 100% !important;
  background-repeat: no-repeat, no-repeat, no-repeat, repeat, no-repeat, no-repeat !important;
  background-blend-mode: normal, normal, multiply, soft-light, screen, normal !important;
}

.safe-cracker-game .sc-safe-door {
  background-image:
    radial-gradient(ellipse at 33% -5%, rgba(229, 241, 251, .17) 0%, rgba(181, 207, 227, .08) 31%, transparent 62%),
    radial-gradient(ellipse at 82% 75%, rgba(139, 176, 205, .075) 0%, transparent 52%),
    linear-gradient(130deg, rgba(244, 249, 253, .05) 0%, transparent 50%, rgba(0, 0, 0, .095) 100%),
    url('/assets/safe-cracker/textures/metal-wear.svg?v=1'),
    url('/assets/safe-cracker/textures/safe-steel-base.svg?v=1'),
    radial-gradient(ellipse at 32% 16%, rgba(230, 238, 240, .12), transparent 34%),
    radial-gradient(ellipse at 72% 86%, rgba(0, 0, 0, .1), transparent 48%),
    linear-gradient(145deg, #58656b 0%, #273136 30%, #101619 69%, #354047 100%) !important;
  background-position: center, center, center, center, center, center, center, center !important;
  background-size: 100% 100%, 100% 100%, 100% 100%, cover, 330px 330px, 100% 100%, 100% 100%, 100% 100% !important;
  background-repeat: no-repeat, no-repeat, no-repeat, no-repeat, repeat, no-repeat, no-repeat, no-repeat !important;
  background-blend-mode: normal, normal, multiply, soft-light, overlay, screen, multiply, normal !important;
  box-shadow:
    inset 0 0 0 3px #6f7a83,
    inset 0 0 0 8px #242c33,
    inset 0 2px 0 rgba(239, 247, 253, .085),
    inset 12px 0 22px rgba(220, 235, 246, .03),
    inset -14px -8px 28px rgba(139, 174, 199, .04),
    inset 0 -25px 40px rgba(0, 0, 0, .19),
    inset 0 0 50px rgba(0, 0, 0, .54),
    0 20px 36px rgba(0, 0, 0, .44) !important;
}

.safe-cracker-game .sc-safe-door::before {
  border-top-color: rgba(226, 239, 249, .16) !important;
  border-left-color: rgba(195, 214, 229, .09) !important;
  border-right-color: rgba(15, 23, 29, .28) !important;
  border-bottom-color: rgba(7, 12, 16, .34) !important;
}

.safe-cracker-game .sc-display {
  border-top-color: rgba(151, 174, 190, .56) !important;
  border-left-color: rgba(101, 124, 141, .42) !important;
  border-right-color: #11171b !important;
  border-bottom-color: #090d10 !important;
}

.safe-cracker-game .sc-dial-wrap {
  box-shadow:
    inset 0 13px 18px rgba(0, 0, 0, .24),
    inset 0 -11px 18px rgba(157, 188, 211, .05),
    inset -11px -6px 22px rgba(126, 160, 187, .035),
    0 14px 24px rgba(0, 0, 0, .25) !important;
}

.safe-cracker-game .sc-dial {
  isolation: isolate;
}

.safe-cracker-game .sc-dial::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 2;
  border-radius: 50%;
  pointer-events: none;
  background:
    radial-gradient(ellipse at 31% 16%, rgba(235, 245, 252, .145) 0%, rgba(190, 214, 232, .065) 30%, transparent 61%),
    radial-gradient(ellipse at 79% 81%, rgba(133, 169, 197, .055) 0%, transparent 49%),
    linear-gradient(133deg, rgba(247, 251, 254, .035) 0%, transparent 48%, rgba(0, 0, 0, .07) 100%);
  box-shadow:
    inset 0 1px 0 rgba(239, 247, 253, .07),
    inset -10px -11px 24px rgba(124, 157, 183, .025);
}

.safe-cracker-game .sc-dial-face {
  background-image:
    url('/assets/safe-cracker/textures/dial-machined.svg?v=1'),
    radial-gradient(circle at 38% 28%, rgba(255,255,255,.3), transparent 20%),
    radial-gradient(circle, #232b31 0 24%, transparent 25%),
    repeating-conic-gradient(from -2deg, #d2aa5d 0deg 1.5deg, #5c4929 1.5deg 3.3deg, #222a30 3.3deg 36deg),
    radial-gradient(circle, #64717b 0 66%, #1b2228 67% 73%, #a17a35 74% 78%, #1a2025 79%) !important;
  background-size: cover, 100% 100%, 100% 100%, 100% 100%, 100% 100% !important;
  background-repeat: no-repeat !important;
  background-blend-mode: soft-light, screen, normal, normal, normal !important;
  border-top-color: #28333b !important;
  border-left-color: #222c33 !important;
  border-right-color: #101519 !important;
  border-bottom-color: #0c1114 !important;
}

.safe-cracker-game .sc-dial-hub {
  background-image:
    url('/assets/safe-cracker/textures/dial-machined.svg?v=1'),
    radial-gradient(circle at 34% 28%, #929da4, #323c44 45%, #11171c 74%) !important;
  background-size: cover, 100% 100% !important;
  background-repeat: no-repeat !important;
  background-blend-mode: soft-light, normal !important;
}

.safe-cracker-game .sc-step-controls button {
  background-image:
    radial-gradient(ellipse at 30% 0%, rgba(232, 243, 251, .105), transparent 61%),
    linear-gradient(137deg, rgba(246, 250, 253, .025), transparent 51%, rgba(0, 0, 0, .105)),
    url('/assets/safe-cracker/textures/safe-steel-base.svg?v=1'),
    linear-gradient(180deg, rgba(150, 163, 170, .42) 0 9%, transparent 10%),
    linear-gradient(180deg, #4d585e, #252e33 52%, #161d21) !important;
  background-size: 100% 100%, 100% 100%, 180px 180px, 100% 100%, 100% 100% !important;
  background-repeat: no-repeat, no-repeat, repeat, no-repeat, no-repeat !important;
  background-blend-mode: normal, multiply, soft-light, screen, normal !important;
}

.safe-cracker-game .sc-confirm-button {
  background-image:
    radial-gradient(ellipse at 30% -4%, rgba(235, 244, 251, .12), transparent 61%),
    linear-gradient(136deg, rgba(248, 251, 253, .025), transparent 50%, rgba(0, 0, 0, .105)),
    url('/assets/safe-cracker/textures/metal-wear.svg?v=1'),
    url('/assets/safe-cracker/textures/safe-steel-base.svg?v=1'),
    linear-gradient(180deg, rgba(255, 239, 196, .16), transparent 12%),
    linear-gradient(180deg, #606a71 0 42%, #4c3920 43% 66%, #20272b 67% 100%) !important;
  background-size: 100% 100%, 100% 100%, cover, 240px 180px, 100% 100%, 100% 100% !important;
  background-repeat: no-repeat, no-repeat, no-repeat, repeat, no-repeat, no-repeat !important;
  background-blend-mode: normal, multiply, soft-light, soft-light, screen, normal !important;
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
index = index.replace(/(safe-cracker\.css[^"']*)/, '$1&light=2');
await writeFile(indexUrl, index);

console.log('Applied Safe Cracker light source v2: cool white overhead light, partial reflected fill in recessed shadows, and stationary dial illumination over the rotating face.');
