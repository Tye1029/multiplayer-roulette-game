import { readFile, writeFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const blocks = [
  ['/* SAFE_CRACKER_TEXTURE_PASS_V1_START */', '/* SAFE_CRACKER_TEXTURE_PASS_V1_END */'],
  ['/* SAFE_CRACKER_TEXTURE_PASS_V2_START */', '/* SAFE_CRACKER_TEXTURE_PASS_V2_END */'],
  ['/* SAFE_CRACKER_TEXTURE_PASS_V3_START */', '/* SAFE_CRACKER_TEXTURE_PASS_V3_END */'],
  ['/* SAFE_CRACKER_TEXTURE_PASS_V4_START */', '/* SAFE_CRACKER_TEXTURE_PASS_V4_END */']
];
const start = blocks[3][0];
const end = blocks[3][1];

let css = await readFile(cssUrl, 'utf8');

const texturePass = String.raw`${start}
/* A2 surface correction: real texture assets provide brushed steel and
   irregular wear. Rotating dial materials remain directionally neutral,
   and no local glare layer is attached to the dial assembly. */
.safe-cracker-game .sc-safe-shell {
  background-image:
    url('/assets/safe-cracker/textures/safe-steel-base.svg?v=2'),
    radial-gradient(ellipse at 26% 14%, rgba(221, 231, 234, .08), transparent 40%),
    linear-gradient(145deg, #39444a 0%, #171e22 48%, #0d1215 78%, #293238 100%) !important;
  background-size: 420px 420px, 100% 100%, 100% 100% !important;
  background-repeat: repeat, no-repeat, no-repeat !important;
  background-blend-mode: soft-light, screen, normal !important;
}

.safe-cracker-game .sc-safe-door {
  background-image:
    url('/assets/safe-cracker/textures/metal-wear.svg?v=2'),
    url('/assets/safe-cracker/textures/safe-steel-base.svg?v=2'),
    radial-gradient(ellipse at 31% 16%, rgba(230, 238, 240, .1), transparent 37%),
    radial-gradient(ellipse at 74% 88%, rgba(0, 0, 0, .18), transparent 48%),
    linear-gradient(145deg, #566269 0%, #293338 31%, #11171a 70%, #354148 100%) !important;
  background-position: center, center, center, center, center !important;
  background-size: cover, 390px 390px, 100% 100%, 100% 100%, 100% 100% !important;
  background-repeat: no-repeat, repeat, no-repeat, no-repeat, no-repeat !important;
  background-blend-mode: soft-light, soft-light, screen, multiply, normal !important;
}

.safe-cracker-game .sc-dial-face {
  background-image:
    url('/assets/safe-cracker/textures/dial-machined.svg?v=2'),
    radial-gradient(circle, #252d32 0 24%, transparent 25%),
    radial-gradient(circle, #657179 0 66%, #192126 67% 73%, #96743b 74% 78%, #171d21 79%) !important;
  background-position: center !important;
  background-size: cover, 100% 100%, 100% 100% !important;
  background-repeat: no-repeat !important;
  background-blend-mode: soft-light, normal, normal !important;
}

.safe-cracker-game .sc-dial-hub {
  background-image:
    url('/assets/safe-cracker/textures/dial-machined.svg?v=2'),
    radial-gradient(circle, #838e95 0%, #39434a 46%, #11171c 74%) !important;
  background-position: center !important;
  background-size: cover, 100% 100% !important;
  background-repeat: no-repeat !important;
  background-blend-mode: soft-light, normal !important;
}

/* Explicitly remove the former oval glare artifact. Scene lighting is owned
   only by the stationary full-safe light pass. */
.safe-cracker-game .sc-dial-wrap::after {
  content: none !important;
  display: none !important;
  pointer-events: none;
}

.safe-cracker-game .sc-step-controls button {
  background-image:
    url('/assets/safe-cracker/textures/safe-steel-base.svg?v=2'),
    linear-gradient(180deg, rgba(150, 163, 170, .38) 0 9%, transparent 10%),
    linear-gradient(180deg, #4d585e, #252e33 52%, #161d21) !important;
  background-size: 210px 210px, 100% 100%, 100% 100% !important;
  background-repeat: repeat, no-repeat, no-repeat !important;
  background-blend-mode: soft-light, screen, normal !important;
}

.safe-cracker-game .sc-confirm-button {
  background-image:
    url('/assets/safe-cracker/textures/metal-wear.svg?v=2'),
    url('/assets/safe-cracker/textures/safe-steel-base.svg?v=2'),
    linear-gradient(180deg, rgba(255, 239, 196, .18), transparent 12%),
    linear-gradient(180deg, #606a71 0 42%, #4c3920 43% 66%, #20272b 67% 100%) !important;
  background-size: cover, 260px 210px, 100% 100%, 100% 100% !important;
  background-repeat: no-repeat, repeat, no-repeat, no-repeat !important;
  background-blend-mode: soft-light, soft-light, screen, normal !important;
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
index = index.replace(/(safe-cracker\.css[^"']*)/, '$1&texture=4');
await writeFile(indexUrl, index);

console.log('Applied Safe Cracker texture pass v4: brushed image wear and neutral dial machining remain, while the stray dial glare artifact is disabled.');

await import('./patch-safe-cracker-shadow-depth.mjs');
