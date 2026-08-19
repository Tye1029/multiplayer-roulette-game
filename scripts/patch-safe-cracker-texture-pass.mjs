import { readFile, writeFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const blocks = [
  ['/* SAFE_CRACKER_TEXTURE_PASS_V1_START */', '/* SAFE_CRACKER_TEXTURE_PASS_V1_END */'],
  ['/* SAFE_CRACKER_TEXTURE_PASS_V2_START */', '/* SAFE_CRACKER_TEXTURE_PASS_V2_END */'],
  ['/* SAFE_CRACKER_TEXTURE_PASS_V3_START */', '/* SAFE_CRACKER_TEXTURE_PASS_V3_END */']
];
const start = blocks[2][0];
const end = blocks[2][1];

let css = await readFile(cssUrl, 'utf8');

const texturePass = String.raw`${start}
/* A2 image-texture pass: directional steel, irregular wear, and separate
   circular dial machining. The safe-body shadow tones are deliberately lifted
   so recessed metal remains readable without changing layout or behavior. */
.safe-cracker-game .sc-safe-shell {
  background-image:
    url('/assets/safe-cracker/textures/safe-steel-base.svg?v=1'),
    radial-gradient(ellipse at 26% 14%, rgba(226, 235, 238, .16), transparent 42%),
    linear-gradient(145deg, #56636a 0%, #303a3f 48%, #20292e 78%, #465158 100%) !important;
  background-size: 360px 360px, 100% 100%, 100% 100% !important;
  background-repeat: repeat, no-repeat, no-repeat !important;
  background-blend-mode: soft-light, screen, normal !important;
}

.safe-cracker-game .sc-safe-door {
  background-image:
    url('/assets/safe-cracker/textures/metal-wear.svg?v=1'),
    url('/assets/safe-cracker/textures/safe-steel-base.svg?v=1'),
    radial-gradient(ellipse at 32% 16%, rgba(235, 242, 244, .2), transparent 40%),
    radial-gradient(ellipse at 72% 86%, rgba(0, 0, 0, .06), transparent 54%),
    linear-gradient(145deg, #718087 0%, #465259 30%, #283238 69%, #556168 100%) !important;
  background-position: center, center, center, center, center !important;
  background-size: cover, 330px 330px, 100% 100%, 100% 100%, 100% 100% !important;
  background-repeat: no-repeat, repeat, no-repeat, no-repeat, no-repeat !important;
  background-blend-mode: soft-light, overlay, screen, soft-light, normal !important;
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
    linear-gradient(180deg, rgba(255, 239, 196, .2), transparent 12%),
    linear-gradient(180deg, #606a71 0 42%, #4c3920 43% 66%, #20272b 67% 100%) !important;
  background-size: cover, 240px 180px, 100% 100%, 100% 100% !important;
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
index = index.replace(/(safe-cracker\.css[^"']*)/, '$1&texture=3');
await writeFile(indexUrl, index);

console.log('Applied Safe Cracker texture pass v3: the actual shell and door steel gradients are visibly lighter while directional wear, dial machining, layout and behavior remain unchanged.');

await import('./patch-safe-cracker-shadow-depth.mjs');

index = await readFile(indexUrl, 'utf8');
index = index.replace(/&shadow=\d+/g, '');
index = index.replace(/(safe-cracker\.css[^"']*)/, '$1&shadow=3');
await writeFile(indexUrl, index);
console.log('Advanced the Safe Cracker CSS cache boundary to shadow=3 so the visibly lighter steel gradients cannot be hidden by a stale mobile stylesheet.');
