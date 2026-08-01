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
/* UI lighting is isolated from material artwork. One fixed overlay spans the
   game safe, while the texture pass remains the sole owner of all surfaces. */
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

.safe-cracker-game .sc-dial::before {
  content: none !important;
}

.safe-cracker-game .sc-dial-face,
.safe-cracker-game .sc-dial-hub {
  border-top-color: #28333b !important;
  border-left-color: #222c33 !important;
  border-right-color: #101519 !important;
  border-bottom-color: #0c1114 !important;
}

.safe-cracker-game .sc-step-controls button {
  border-top-color: rgba(119, 137, 148, .72) !important;
  border-left-color: rgba(81, 98, 109, .58) !important;
  border-right-color: #11171b !important;
  border-bottom-color: #090d10 !important;
}

.safe-cracker-game .sc-confirm-button {
  border-top-color: rgba(128, 143, 152, .72) !important;
  border-left-color: rgba(91, 105, 114, .58) !important;
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
index = index.replace(/(safe-cracker\.css[^"']*)/, '$1&light=4');
await writeFile(indexUrl, index);

console.log('Applied fictional game UI light pass v4 without replacing material textures.');
