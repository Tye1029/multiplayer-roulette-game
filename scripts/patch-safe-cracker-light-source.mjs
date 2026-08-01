import { readFile, writeFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const blocks = [1, 2, 3, 4, 5, 6, 7].map(version => [
  `/* SAFE_CRACKER_LIGHT_SOURCE_V${version}_START */`,
  `/* SAFE_CRACKER_LIGHT_SOURCE_V${version}_END */`
]);
const start = blocks[6][0];
const end = blocks[6][1];

let css = await readFile(cssUrl, 'utf8');

const lightPass = String.raw`${start}
/* Lighting reset v7. A clearly visible cool overhead source spans the whole
   safe with only two static gradient layers. The dial rotates beneath this
   stationary light, and mobile removes expensive rotating drop-shadow filters. */
.safe-cracker-game .sc-safe-shell {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  contain: paint;
}

.safe-cracker-game .sc-safe-shell::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 40;
  border-radius: inherit;
  pointer-events: none;
  background:
    radial-gradient(ellipse 76% 56% at 36% -7%,
      rgba(255, 255, 255, .42) 0%,
      rgba(231, 240, 246, .25) 31%,
      rgba(184, 202, 214, .12) 55%,
      rgba(133, 157, 174, .045) 70%,
      transparent 82%),
    linear-gradient(118deg,
      rgba(226, 237, 244, .16) 0%,
      rgba(170, 191, 205, .085) 43%,
      rgba(70, 91, 106, .025) 67%,
      rgba(1, 5, 8, .18) 100%);
}

/* Fixed trim catches the same overhead source while the lower and far-right
   edges remain recessed instead of disappearing into solid black. */
.safe-cracker-game .sc-safe-door::before {
  border-top-color: rgba(242, 248, 251, .24) !important;
  border-left-color: rgba(202, 216, 225, .13) !important;
  border-right-color: rgba(132, 154, 169, .11) !important;
  border-bottom-color: rgba(7, 12, 16, .38) !important;
}

/* Lighting ownership stays outside the rotating dial. */
.safe-cracker-game .sc-dial::before,
.safe-cracker-game .sc-dial::after,
.safe-cracker-game .sc-dial-face::after {
  content: none !important;
  display: none !important;
  background: none !important;
  box-shadow: none !important;
  filter: none !important;
  pointer-events: none !important;
}

.safe-cracker-game .sc-dial-face {
  border-color: #151c21 !important;
}

.safe-cracker-game .sc-dial-hub {
  border-color: #171d21 !important;
}

@media (max-width: 700px) {
  .safe-cracker-game .sc-safe-shell,
  .safe-cracker-game .sc-safe-door,
  .safe-cracker-game .sc-dial-wrap,
  .safe-cracker-game .sc-dial,
  .safe-cracker-game .sc-dial-pointer {
    filter: none !important;
  }
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
index = index.replace(/(safe-cracker\.css[^"']*)/, '$1&light=7');
await writeFile(indexUrl, index);

console.log('Applied Safe Cracker lighting reset v7: a stronger two-layer stationary light is visible across the full safe, and mobile rotating drop-shadow filters are disabled to reduce GPU lag.');
