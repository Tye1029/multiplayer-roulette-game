import { readFile, writeFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const blocks = [
  ['/* SAFE_CRACKER_LIGHT_SOURCE_V1_START */', '/* SAFE_CRACKER_LIGHT_SOURCE_V1_END */'],
  ['/* SAFE_CRACKER_LIGHT_SOURCE_V2_START */', '/* SAFE_CRACKER_LIGHT_SOURCE_V2_END */'],
  ['/* SAFE_CRACKER_LIGHT_SOURCE_V3_START */', '/* SAFE_CRACKER_LIGHT_SOURCE_V3_END */'],
  ['/* SAFE_CRACKER_LIGHT_SOURCE_V4_START */', '/* SAFE_CRACKER_LIGHT_SOURCE_V4_END */']
];
const start = blocks[3][0];
const end = blocks[3][1];

let css = await readFile(cssUrl, 'utf8');

const lightPass = String.raw`${start}
/* One restrained cool-white source falls from above the safe. The key is
   localized instead of washing the full board, with only a faint reflected
   fill reaching the recessed lower area. No light is attached to the dial. */
.safe-cracker-game {
  --sc-scene-key: rgba(232, 243, 251, .135);
  --sc-scene-key-soft: rgba(193, 215, 232, .062);
  --sc-scene-fill: rgba(143, 176, 202, .042);
}

.safe-cracker-game .sc-safe-shell {
  position: relative;
  isolation: isolate;
}

.safe-cracker-game .sc-safe-shell::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 40;
  border-radius: 24px;
  pointer-events: none;
  background:
    radial-gradient(ellipse 58% 43% at 52% -5%,
      rgba(245, 250, 253, .15) 0%,
      rgba(219, 233, 243, .068) 34%,
      rgba(184, 207, 223, .022) 57%,
      transparent 76%),
    radial-gradient(ellipse 42% 31% at 72% 70%,
      rgba(150, 181, 202, .025) 0%,
      transparent 76%),
    linear-gradient(180deg,
      transparent 0%,
      transparent 46%,
      rgba(2, 7, 11, .045) 74%,
      rgba(1, 5, 8, .095) 100%),
    radial-gradient(ellipse 112% 72% at 34% -4%, transparent 0%, transparent 100%),
    radial-gradient(ellipse 82% 68% at 88% 86%, transparent 0%, transparent 100%);
}

.safe-cracker-game .sc-safe-door {
  box-shadow:
    inset 0 0 0 3px #6f7a83,
    inset 0 0 0 8px #242c33,
    inset 0 2px 0 rgba(231, 241, 249, .055),
    inset 8px 0 18px rgba(214, 231, 243, .018),
    inset -12px -8px 24px rgba(132, 166, 192, .025),
    inset 0 -24px 38px rgba(0, 0, 0, .19),
    inset 0 0 48px rgba(0, 0, 0, .46),
    0 20px 36px rgba(0, 0, 0, .44) !important;
}

.safe-cracker-game .sc-safe-door::before {
  border-top-color: rgba(222, 236, 247, .105) !important;
  border-left-color: rgba(188, 208, 224, .055) !important;
  border-right-color: rgba(15, 23, 29, .27) !important;
  border-bottom-color: rgba(7, 12, 16, .32) !important;
}

.safe-cracker-game .sc-display {
  border-top-color: rgba(145, 168, 185, .42) !important;
  border-left-color: rgba(96, 119, 137, .3) !important;
  border-right-color: #11171b !important;
  border-bottom-color: #090d10 !important;
}

.safe-cracker-game .sc-dial-wrap {
  box-shadow:
    inset 0 13px 18px rgba(0, 0, 0, .23),
    inset 0 -11px 18px rgba(151, 181, 204, .026),
    inset -11px -6px 22px rgba(126, 160, 187, .018),
    0 14px 24px rgba(0, 0, 0, .27) !important;
}

/* Disable every legacy dial-local glare pseudo-element. */
.safe-cracker-game .sc-dial::before,
.safe-cracker-game .sc-dial-wrap::after {
  content: none !important;
  display: none !important;
  pointer-events: none;
}

/* Uniform borders are essential here: directional side colors would rotate
   with the transformed dial face and appear as a moving light chunk. */
.safe-cracker-game .sc-dial-face {
  border-color: #151c21 !important;
}

.safe-cracker-game .sc-dial-hub {
  border-color: #171d21 !important;
}

.safe-cracker-game .sc-step-controls button {
  border-top-color: rgba(119, 137, 148, .6) !important;
  border-left-color: rgba(81, 98, 109, .48) !important;
  border-right-color: #11171b !important;
  border-bottom-color: #090d10 !important;
}

.safe-cracker-game .sc-confirm-button {
  border-top-color: rgba(128, 143, 152, .6) !important;
  border-left-color: rgba(91, 105, 114, .48) !important;
  border-right-color: #11171b !important;
  border-bottom-color: #090d10 !important;
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
index = index.replace(/(safe-cracker\.css[^"']*)/, '$1&light=5');
await writeFile(indexUrl, index);

console.log('Applied fictional game UI light pass v4 with a restrained overhead source, soft recessed fill, and no dial-attached glare.');
