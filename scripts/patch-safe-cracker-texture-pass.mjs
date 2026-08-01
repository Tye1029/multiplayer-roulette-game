import { readFile, writeFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const blocks = [1, 2, 3, 4, 5, 6].map(version => [
  `/* SAFE_CRACKER_TEXTURE_PASS_V${version}_START */`,
  `/* SAFE_CRACKER_TEXTURE_PASS_V${version}_END */`
]);
const start = blocks[5][0];
const end = blocks[5][1];

let css = await readFile(cssUrl, 'utf8');

const texturePass = String.raw`${start}
/* Material-only reset. These surfaces contain texture and neutral construction
   shading only. Every directional highlight is owned by one stationary scene
   light added later, never by a rotating dial element. */
.safe-cracker-game .sc-safe-shell {
  background-image:
    url('/assets/safe-cracker/textures/safe-steel-base.svg?v=3'),
    linear-gradient(180deg, #303a40 0%, #1b2328 48%, #10161a 76%, #20292e 100%) !important;
  background-size: 420px 420px, 100% 100% !important;
  background-repeat: repeat, no-repeat !important;
  background-blend-mode: soft-light, normal !important;
}

.safe-cracker-game .sc-safe-door {
  background-image:
    url('/assets/safe-cracker/textures/metal-wear.svg?v=3'),
    url('/assets/safe-cracker/textures/safe-steel-base.svg?v=3'),
    linear-gradient(180deg, #4c585e 0%, #293338 34%, #141b1f 72%, #263137 100%) !important;
  background-position: center, center, center !important;
  background-size: cover, 390px 390px, 100% 100% !important;
  background-repeat: no-repeat, repeat, no-repeat !important;
  background-blend-mode: soft-light, soft-light, normal !important;
}

/* Keep the stationary outer dial construction neutral. Its earlier off-centre
   highlight looked like a separate oval light source. */
.safe-cracker-game .sc-dial-wrap::before {
  background:
    radial-gradient(circle,
      #141b1f 0 70%,
      #737f84 71% 74%,
      #242d31 75% 82%,
      #080c0e 83% 100%) !important;
}

.safe-cracker-game .sc-dial-face {
  background-image:
    url('/assets/safe-cracker/textures/dial-machined.svg?v=3'),
    radial-gradient(circle, #252d32 0 24%, transparent 25%),
    radial-gradient(circle,
      #626e75 0 66%,
      #192126 67% 73%,
      #8e703c 74% 78%,
      #171d21 79%) !important;
  background-position: center !important;
  background-size: cover, 100% 100%, 100% 100% !important;
  background-repeat: no-repeat !important;
  background-blend-mode: soft-light, normal, normal !important;
  border-color: #151c21 !important;
}

.safe-cracker-game .sc-dial-hub {
  background-image:
    url('/assets/safe-cracker/textures/dial-machined.svg?v=3'),
    radial-gradient(circle, #7d888f 0%, #39434a 46%, #11171c 74%) !important;
  background-position: center !important;
  background-size: cover, 100% 100% !important;
  background-repeat: no-repeat !important;
  background-blend-mode: soft-light, normal !important;
  border-color: #171d21 !important;
}

/* Delete all legacy glare attached to the movable dial. Preserve the engraved
   tick layer on .sc-dial-face::before because it is material detail, not light. */
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

.safe-cracker-game .sc-step-controls button {
  background-image:
    url('/assets/safe-cracker/textures/safe-steel-base.svg?v=3'),
    linear-gradient(180deg, #4b565c, #252e33 52%, #161d21) !important;
  background-size: 210px 210px, 100% 100% !important;
  background-repeat: repeat, no-repeat !important;
  background-blend-mode: soft-light, normal !important;
}

.safe-cracker-game .sc-confirm-button {
  background-image:
    url('/assets/safe-cracker/textures/metal-wear.svg?v=3'),
    url('/assets/safe-cracker/textures/safe-steel-base.svg?v=3'),
    linear-gradient(180deg, #5a656b 0 42%, #493821 43% 66%, #20272b 67% 100%) !important;
  background-size: cover, 260px 210px, 100% 100% !important;
  background-repeat: no-repeat, repeat, no-repeat !important;
  background-blend-mode: soft-light, soft-light, normal !important;
}
${end}`;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
for (const [blockStart, blockEnd] of blocks) {
  const blockPattern = new RegExp(`${escapeRegExp(blockStart)}[\\s\\S]*?${escapeRegExp(blockEnd)}\\n?`, 'g');
  css = css.replace(blockPattern, '');
}
css = css.trimEnd() + '\n\n' + texturePass + '\n';
await writeFile(cssUrl, css);

let index = await readFile(indexUrl, 'utf8');
index = index.replace(/&texture=\d+/g, '');
index = index.replace(/(safe-cracker\.css[^"']*)/, '$1&texture=6');
await writeFile(indexUrl, index);

console.log('Applied Safe Cracker material reset v6: directional highlights and attached dial glare are removed, leaving image-based steel, wear and concentric machining ready for one unified stationary scene light.');

await import('./patch-safe-cracker-shadow-depth.mjs');
