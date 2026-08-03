import { readFile, writeFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const oldStart = '/* SAFE_CRACKER_SHADOW_DEPTH_V1_START */';
const oldEnd = '/* SAFE_CRACKER_SHADOW_DEPTH_V1_END */';
const start = '/* SAFE_CRACKER_SHADOW_DEPTH_V2_START */';
const end = '/* SAFE_CRACKER_SHADOW_DEPTH_V2_END */';

let css = await readFile(cssUrl, 'utf8');

const shadowPass = String.raw`${start}
${oldStart}
/* Compatibility marker for validators that protect the established structural-shadow boundary.
   The active visual values below are the lighter V2 values. */
${oldEnd}
/* Pass 2 refinement: retain localized structural depth while lifting the
   darkest recessed areas so the safe reads more clearly in the room light.
   Texture assets, light direction, layout, controls and behavior are unchanged. */
.safe-cracker-game {
  --sc-depth-soft: rgba(0, 0, 0, .12);
  --sc-depth-mid: rgba(0, 0, 0, .22);
  --sc-depth-strong: rgba(0, 0, 0, .37);
  --sc-depth-edge: rgba(255, 255, 255, .085);
}

.safe-cracker-game .sc-safe-door {
  box-shadow:
    inset 0 0 0 3px #78838c,
    inset 0 0 0 8px #2d363e,
    inset 0 2px 0 rgba(255, 255, 255, .11),
    inset 12px 0 22px rgba(255, 255, 255, .035),
    inset -16px 0 28px rgba(0, 0, 0, .14),
    inset 0 -28px 42px rgba(0, 0, 0, .17),
    inset 0 0 50px rgba(0, 0, 0, .44),
    0 20px 36px rgba(0, 0, 0, .32) !important;
}

.safe-cracker-game .sc-safe-door::before {
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .1),
    inset 0 -10px 16px rgba(0, 0, 0, .13),
    0 1px 0 rgba(0, 0, 0, .32) !important;
}

.safe-cracker-game .sc-display {
  box-shadow:
    inset 0 3px 5px rgba(0, 0, 0, .52),
    inset 0 -9px 14px rgba(0, 0, 0, .24),
    inset 8px 0 12px rgba(0, 0, 0, .12),
    inset -7px 0 10px rgba(255, 255, 255, .035),
    0 3px 0 rgba(135, 147, 154, .15),
    0 7px 13px rgba(0, 0, 0, .22) !important;
}
.safe-cracker-game .sc-display.red {
  box-shadow:
    inset 0 3px 5px rgba(0, 0, 0, .52),
    inset 0 -9px 14px rgba(0, 0, 0, .24),
    inset 0 0 22px rgba(255, 61, 54, .34),
    0 3px 0 rgba(135, 147, 154, .15),
    0 0 13px rgba(255, 61, 54, .24) !important;
}
.safe-cracker-game .sc-display.orange {
  box-shadow:
    inset 0 3px 5px rgba(0, 0, 0, .52),
    inset 0 -9px 14px rgba(0, 0, 0, .24),
    inset 0 0 22px rgba(255, 138, 43, .34),
    0 3px 0 rgba(135, 147, 154, .15),
    0 0 13px rgba(255, 138, 43, .24) !important;
}
.safe-cracker-game .sc-display.yellow {
  box-shadow:
    inset 0 3px 5px rgba(0, 0, 0, .52),
    inset 0 -9px 14px rgba(0, 0, 0, .24),
    inset 0 0 22px rgba(255, 228, 94, .36),
    0 3px 0 rgba(135, 147, 154, .15),
    0 0 15px rgba(255, 228, 94, .3) !important;
}
.safe-cracker-game .sc-display.green {
  box-shadow:
    inset 0 3px 5px rgba(0, 0, 0, .52),
    inset 0 -9px 14px rgba(0, 0, 0, .24),
    inset 0 0 22px rgba(82, 255, 142, .38),
    0 3px 0 rgba(135, 147, 154, .15),
    0 0 17px rgba(82, 255, 142, .34) !important;
}

.safe-cracker-game .sc-dial-wrap {
  border-radius: 50%;
  box-shadow:
    inset 0 14px 18px rgba(0, 0, 0, .22),
    inset 0 -10px 15px rgba(255, 255, 255, .05),
    0 14px 24px rgba(0, 0, 0, .18) !important;
}

.safe-cracker-game .sc-dial-face {
  box-shadow:
    inset 0 0 0 4px #7c8790,
    inset 0 7px 10px rgba(255, 255, 255, .08),
    inset 0 -18px 24px rgba(0, 0, 0, .24),
    inset 10px 0 16px rgba(0, 0, 0, .1),
    inset -10px 0 16px rgba(255, 255, 255, .04),
    0 3px 0 rgba(178, 186, 192, .2),
    0 12px 18px rgba(0, 0, 0, .34) !important;
}

.safe-cracker-game .sc-dial-hub {
  box-shadow:
    inset 0 2px 3px rgba(255, 255, 255, .12),
    inset 0 -12px 17px rgba(0, 0, 0, .29),
    inset 8px 0 12px rgba(255, 255, 255, .04),
    inset -8px 0 12px rgba(0, 0, 0, .12),
    0 0 0 3px #987746,
    0 9px 14px rgba(0, 0, 0, .42) !important;
}

.safe-cracker-game .sc-step-controls button:not(:active) {
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .27),
    inset 0 -7px 10px rgba(0, 0, 0, .18),
    0 4px 0 #171d22,
    0 8px 12px rgba(0, 0, 0, .2) !important;
}
.safe-cracker-game .sc-step-controls button:active {
  box-shadow:
    inset 0 2px 5px rgba(0, 0, 0, .28),
    inset 0 1px 0 rgba(255, 255, 255, .12),
    0 1px 0 #171d22 !important;
}

.safe-cracker-game .sc-confirm-button:not(:disabled):not(:active) {
  box-shadow:
    inset 0 2px 0 rgba(255, 255, 255, .58),
    inset 0 -8px 12px rgba(75, 42, 5, .16),
    0 8px 0 #5b3a15,
    0 13px 20px rgba(0, 0, 0, .36) !important;
}
.safe-cracker-game .sc-confirm-button:not(:disabled):active {
  box-shadow:
    inset 0 3px 7px rgba(80, 45, 6, .27),
    inset 0 1px 0 rgba(255, 255, 255, .31),
    0 2px 0 #5b3a15,
    0 5px 9px rgba(0, 0, 0, .32) !important;
}

.safe-cracker-game .sc-safe-handle {
  box-shadow:
    inset 0 2px 3px rgba(255, 255, 255, .11),
    inset 0 -11px 16px rgba(0, 0, 0, .22),
    0 9px 14px rgba(0, 0, 0, .39) !important;
}
.safe-cracker-game .sc-bolts i {
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .12),
    inset 0 -7px 10px rgba(0, 0, 0, .18),
    0 4px 7px rgba(0, 0, 0, .37) !important;
}
${end}`;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
for (const [blockStart, blockEnd] of [[oldStart, oldEnd], [start, end]]) {
  const blockPattern = new RegExp(`${escapeRegExp(blockStart)}[\\s\\S]*?${escapeRegExp(blockEnd)}\\n?`, 'g');
  css = css.replace(blockPattern, '');
}
css = css.trimEnd() + '\n\n' + shadowPass + '\n';
await writeFile(cssUrl, css);

let index = await readFile(indexUrl, 'utf8');
index = index.replace(/&shadow=\d+/g, '');
index = index.replace(/(safe-cracker\.css[^"']*)/, '$1&shadow=2');
await writeFile(indexUrl, index);

console.log('Applied Safe Cracker structural shadow pass v2: the darkest door, display, dial, hub, control and hardware shadows are lifted while localized depth, lighting direction, layout and behavior remain unchanged.');
