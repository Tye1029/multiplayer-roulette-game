import { readFile, writeFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const blocks = [1, 2, 3, 4, 5, 6].map(version => [
  `/* SAFE_CRACKER_LIGHT_SOURCE_V${version}_START */`,
  `/* SAFE_CRACKER_LIGHT_SOURCE_V${version}_END */`
]);
const start = blocks[5][0];
const end = blocks[5][1];

let css = await readFile(cssUrl, 'utf8');

const lightPass = String.raw`${start}
/* Lighting reset v6. One cool white-grey source sits above the complete safe.
   A single stationary overlay supplies the key, soft metal glare, right-side
   bounce and lower falloff. Nothing directional is attached to the dial. */
.safe-cracker-game .sc-safe-shell {
  position: relative;
  isolation: isolate;
  overflow: hidden;
}

.safe-cracker-game .sc-safe-shell::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 40;
  border-radius: inherit;
  pointer-events: none;
  background:
    /* Off-screen overhead source and broad key falloff. */
    radial-gradient(ellipse 62% 54% at 48% -8%,
      rgba(247, 250, 252, .19) 0%,
      rgba(224, 232, 238, .092) 30%,
      rgba(194, 207, 216, .038) 53%,
      rgba(171, 188, 200, .012) 68%,
      transparent 82%),
    /* One soft stationary metal reflection crossing both safe and dial. */
    radial-gradient(ellipse 16% 62% at 42% 43%,
      rgba(244, 248, 250, .062) 0%,
      rgba(219, 229, 235, .029) 36%,
      rgba(190, 205, 214, .009) 64%,
      transparent 78%),
    /* Cool reflected fill reaches the recessed right side from the same room light. */
    radial-gradient(ellipse 48% 72% at 104% 54%,
      rgba(183, 198, 208, .052) 0%,
      rgba(150, 170, 184, .025) 42%,
      rgba(121, 144, 160, .008) 67%,
      transparent 82%),
    /* Preserve depth as the overhead source falls away toward the bottom. */
    linear-gradient(180deg,
      transparent 0%,
      transparent 48%,
      rgba(3, 8, 11, .022) 69%,
      rgba(1, 5, 8, .075) 100%);
  box-shadow:
    inset 0 1px 0 rgba(245, 249, 251, .12),
    inset 0 20px 34px rgba(222, 232, 239, .025);
}

/* The fixed door trim responds to the same overhead source. The right edge is
   not blacked out; it receives a small cool bounce while remaining recessed. */
.safe-cracker-game .sc-safe-door::before {
  border-top-color: rgba(224, 234, 240, .13) !important;
  border-left-color: rgba(184, 199, 209, .07) !important;
  border-right-color: rgba(112, 133, 147, .075) !important;
  border-bottom-color: rgba(8, 13, 17, .34) !important;
}

/* Enforce the lighting ownership boundary. These legacy pseudo-elements were
   the source of the oval artifact and the glare chunk that rotated with the dial. */
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
index = index.replace(/(safe-cracker\.css[^"']*)/, '$1&light=6');
await writeFile(indexUrl, index);

console.log('Applied Safe Cracker lighting reset v6: one stationary cool white-grey source now spans the complete safe and dial, adds restrained continuous glare, softly fills the right recess, and leaves no dial-bound lighting.');
