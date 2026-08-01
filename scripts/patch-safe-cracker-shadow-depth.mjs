import { readFile, writeFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const start = '/* SAFE_CRACKER_SHADOW_DEPTH_V1_START */';
const end = '/* SAFE_CRACKER_SHADOW_DEPTH_V1_END */';

let css = await readFile(cssUrl, 'utf8');

const shadowPass = String.raw`${start}
/* Pass 2 only: localized structural depth and contact shadows.
   Texture assets, light direction, layout, controls and behavior remain unchanged. */
.safe-cracker-game {
  --sc-depth-soft: rgba(0, 0, 0, .16);
  --sc-depth-mid: rgba(0, 0, 0, .29);
  --sc-depth-strong: rgba(0, 0, 0, .48);
  --sc-depth-edge: rgba(255, 255, 255, .075);
}

.safe-cracker-game .sc-safe-door {
  box-shadow:
    inset 0 0 0 3px #6f7a83,
    inset 0 0 0 8px #242c33,
    inset 0 2px 0 rgba(255, 255, 255, .09),
    inset 12px 0 22px rgba(255, 255, 255, .025),
    inset -16px 0 28px rgba(0, 0, 0, .2),
    inset 0 -28px 42px rgba(0, 0, 0, .25),
    inset 0 0 50px rgba(0, 0, 0, .66),
    0 20px 36px rgba(0, 0, 0, .44) !important;
}

.safe-cracker-game .sc-safe-door::before {
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .08),
    inset 0 -10px 16px rgba(0, 0, 0, .2),
    0 1px 0 rgba(0, 0, 0, .46) !important;
}

.safe-cracker-game .sc-display {
  box-shadow:
    inset 0 3px 5px rgba(0, 0, 0, .72),
    inset 0 -9px 14px rgba(0, 0, 0, .34),
    inset 8px 0 12px rgba(0, 0, 0, .18),
    inset -7px 0 10px rgba(255, 255, 255, .025),
    0 3px 0 rgba(120, 132, 138, .12),
    0 7px 13px rgba(0, 0, 0, .3) !important;
}
.safe-cracker-game .sc-display.red {
  box-shadow:
    inset 0 3px 5px rgba(0, 0, 0, .72),
    inset 0 -9px 14px rgba(0, 0, 0, .34),
    inset 0 0 22px rgba(255, 61, 54, .34),
    0 3px 0 rgba(120, 132, 138, .12),
    0 0 13px rgba(255, 61, 54, .24) !important;
}
.safe-cracker-game .sc-display.orange {
  box-shadow:
    inset 0 3px 5px rgba(0, 0, 0, .72),
    inset 0 -9px 14px rgba(0, 0, 0, .34),
    inset 0 0 22px rgba(255, 138, 43, .34),
    0 3px 0 rgba(120, 132, 138, .12),
    0 0 13px rgba(255, 138, 43, .24) !important;
}
.safe-cracker-game .sc-display.yellow {
  box-shadow:
    inset 0 3px 5px rgba(0, 0, 0, .72),
    inset 0 -9px 14px rgba(0, 0, 0, .34),
    inset 0 0 22px rgba(255, 228, 94, .36),
    0 3px 0 rgba(120, 132, 138, .12),
    0 0 15px rgba(255, 228, 94, .3) !important;
}
.safe-cracker-game .sc-display.green {
  box-shadow:
    inset 0 3px 5px rgba(0, 0, 0, .72),
    inset 0 -9px 14px rgba(0, 0, 0, .34),
    inset 0 0 22px rgba(82, 255, 142, .38),
    0 3px 0 rgba(120, 132, 138, .12),
    0 0 17px rgba(82, 255, 142, .34) !important;
}

.safe-cracker-game .sc-dial-wrap {
  border-radius: 50%;
  box-shadow:
    inset 0 14px 18px rgba(0, 0, 0, .3),
    inset 0 -10px 15px rgba(255, 255, 255, .035),
    0 14px 24px rgba(0, 0, 0, .25) !important;
}

.safe-cracker-game .sc-dial-face {
  box-shadow:
    inset 0 0 0 4px #727e87,
    inset 0 7px 10px rgba(255, 255, 255, .065),
    inset 0 -18px 24px rgba(0, 0, 0, .35),
    inset 10px 0 16px rgba(0, 0, 0, .14),
    inset -10px 0 16px rgba(255, 255, 255, .025),
    0 3px 0 rgba(166, 174, 180, .16),
    0 12px 18px rgba(0, 0, 0, .48) !important;
}

.safe-cracker-game .sc-dial-hub {
  box-shadow:
    inset 0 2px 3px rgba(255, 255, 255, .09),
    inset 0 -12px 17px rgba(0, 0, 0, .42),
    inset 8px 0 12px rgba(255, 255, 255, .025),
    inset -8px 0 12px rgba(0, 0, 0, .18),
    0 0 0 3px #8b6c37,
    0 9px 14px rgba(0, 0, 0, .58) !important;
}

.safe-cracker-game .sc-step-controls button:not(:active) {
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .24),
    inset 0 -7px 10px rgba(0, 0, 0, .25),
    0 4px 0 #11161a,
    0 8px 12px rgba(0, 0, 0, .28) !important;
}
.safe-cracker-game .sc-step-controls button:active {
  box-shadow:
    inset 0 2px 5px rgba(0, 0, 0, .38),
    inset 0 1px 0 rgba(255, 255, 255, .09),
    0 1px 0 #11161a !important;
}

.safe-cracker-game .sc-confirm-button:not(:disabled):not(:active) {
  box-shadow:
    inset 0 2px 0 rgba(255, 255, 255, .55),
    inset 0 -8px 12px rgba(75, 42, 5, .22),
    0 8px 0 #4d3010,
    0 13px 20px rgba(0, 0, 0, .48) !important;
}
.safe-cracker-game .sc-confirm-button:not(:disabled):active {
  box-shadow:
    inset 0 3px 7px rgba(80, 45, 6, .36),
    inset 0 1px 0 rgba(255, 255, 255, .28),
    0 2px 0 #4d3010,
    0 5px 9px rgba(0, 0, 0, .45) !important;
}

.safe-cracker-game .sc-safe-handle {
  box-shadow:
    inset 0 2px 3px rgba(255, 255, 255, .08),
    inset 0 -11px 16px rgba(0, 0, 0, .31),
    0 9px 14px rgba(0, 0, 0, .53) !important;
}
.safe-cracker-game .sc-bolts i {
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, .09),
    inset 0 -7px 10px rgba(0, 0, 0, .25),
    0 4px 7px rgba(0, 0, 0, .52) !important;
}
${end}`;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
const blockPattern = new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}\\n?`, 'g');
css = css.replace(blockPattern, '').trimEnd() + '\n\n' + shadowPass + '\n';
await writeFile(cssUrl, css);

let index = await readFile(indexUrl, 'utf8');
index = index.replace(/&shadow=\d+/g, '');
index = index.replace(/(safe-cracker\.css[^"']*)/, '$1&shadow=1');
await writeFile(indexUrl, index);

console.log('Applied Safe Cracker structural shadow pass v1: recessed door, display, dial cavity, hub, controls and hardware now have localized contact depth without lighting, layout or behavior changes.');
