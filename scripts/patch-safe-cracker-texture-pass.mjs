import { readFile, writeFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const legacyStart = '/* SAFE_CRACKER_TEXTURE_PASS_V1_START */';
const legacyEnd = '/* SAFE_CRACKER_TEXTURE_PASS_V1_END */';
const start = '/* SAFE_CRACKER_TEXTURE_PASS_V2_START */';
const end = '/* SAFE_CRACKER_TEXTURE_PASS_V2_END */';

let css = await readFile(cssUrl, 'utf8');

const texturePass = String.raw`${start}
/* Visible material pass: brushed steel, restrained wear and machined dial rings.
   Lighting, layout, controls, animation, networking and gameplay remain unchanged. */
.safe-cracker-game {
  --sc-texture-bright: rgba(255, 255, 255, .068);
  --sc-texture-dark: rgba(0, 0, 0, .078);
  --sc-texture-wear: rgba(205, 214, 217, .085);
}

.safe-cracker-game .sc-safe-shell {
  background-image:
    repeating-linear-gradient(91deg, var(--sc-texture-bright) 0 1px, transparent 1px 4px),
    repeating-linear-gradient(0deg, var(--sc-texture-dark) 0 1px, transparent 1px 7px),
    repeating-linear-gradient(17deg, transparent 0 54px, rgba(255, 255, 255, .038) 55px, transparent 56px 96px),
    radial-gradient(ellipse at 24% 18%, var(--sc-texture-wear), transparent 36%),
    radial-gradient(ellipse at 78% 74%, rgba(0, 0, 0, .09), transparent 44%),
    linear-gradient(145deg, #4b565c 0%, #20282d 24%, #10161a 58%, #303a40 100%) !important;
  background-blend-mode: soft-light, multiply, soft-light, soft-light, multiply, normal !important;
}

.safe-cracker-game .sc-safe-door {
  background-image:
    radial-gradient(circle, #c0c9cc 0 2px, #232b2f 3px 6px, transparent 7px),
    radial-gradient(circle, #c0c9cc 0 2px, #232b2f 3px 6px, transparent 7px),
    linear-gradient(90deg, #11171a, #8b979d 47%, #1b2226),
    linear-gradient(90deg, #11171a, #8b979d 47%, #1b2226),
    repeating-linear-gradient(89.5deg, rgba(255, 255, 255, .065) 0 1px, transparent 1px 3px),
    repeating-linear-gradient(0deg, rgba(0, 0, 0, .07) 0 1px, transparent 1px 6px),
    repeating-linear-gradient(14deg, transparent 0 66px, rgba(215, 225, 228, .045) 67px, transparent 68px 112px),
    radial-gradient(ellipse at 32% 16%, rgba(220, 229, 232, .11), transparent 34%),
    radial-gradient(ellipse at 70% 84%, rgba(0, 0, 0, .12), transparent 45%),
    linear-gradient(145deg, #536067 0%, #252e33 28%, #11171b 68%, #354047 100%) !important;
  background-position:
    10px 20%,
    10px 80%,
    8px 17%,
    8px 83%,
    0 0,
    0 0,
    0 0,
    0 0,
    0 0,
    0 0 !important;
  background-size:
    14px 14px,
    14px 14px,
    18px 56px,
    18px 56px,
    auto,
    auto,
    auto,
    auto,
    auto,
    auto !important;
  background-repeat:
    no-repeat,
    no-repeat,
    no-repeat,
    no-repeat,
    repeat,
    repeat,
    repeat,
    no-repeat,
    no-repeat,
    no-repeat !important;
  background-blend-mode:
    normal,
    normal,
    normal,
    normal,
    soft-light,
    multiply,
    soft-light,
    soft-light,
    multiply,
    normal !important;
}

.safe-cracker-game .sc-dial-face {
  background-image:
    repeating-radial-gradient(circle at 50% 50%, rgba(255, 255, 255, .075) 0 1px, rgba(0, 0, 0, .052) 1px 2px, transparent 2px 5px),
    repeating-linear-gradient(94deg, rgba(255, 255, 255, .045) 0 1px, transparent 1px 4px),
    radial-gradient(circle at 38% 28%, rgba(255, 255, 255, .34), transparent 21%),
    radial-gradient(circle, #232b31 0 24%, transparent 25%),
    repeating-conic-gradient(from -2deg, #d2aa5d 0deg 1.5deg, #5c4929 1.5deg 3.3deg, #222a30 3.3deg 36deg),
    radial-gradient(circle, #64717b 0 66%, #1b2228 67% 73%, #a17a35 74% 78%, #1a2025 79%) !important;
  background-blend-mode: soft-light, soft-light, screen, normal, normal, normal !important;
}

.safe-cracker-game .sc-dial-hub {
  background-image:
    repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,.07) 0 1px, transparent 1px 4px),
    radial-gradient(circle at 34% 28%, #929da4, #323c44 45%, #11171c 74%) !important;
  background-blend-mode: soft-light, normal !important;
}

.safe-cracker-game .sc-display {
  background-image:
    repeating-linear-gradient(90deg, rgba(255, 255, 255, .038) 0 1px, transparent 1px 4px),
    linear-gradient(180deg, #3f4a50, #171e22 54%, #0c1114) !important;
  background-blend-mode: soft-light, normal !important;
}

.safe-cracker-game .sc-step-controls button,
.safe-cracker-game .sc-confirm-button {
  background-image:
    repeating-linear-gradient(90deg, rgba(255, 255, 255, .052) 0 1px, transparent 1px 5px),
    linear-gradient(180deg, rgba(145, 158, 165, .42) 0 8%, transparent 9%),
    linear-gradient(180deg, #4d585e, #252e33 52%, #161d21) !important;
  background-blend-mode: soft-light, normal, normal !important;
}

.safe-cracker-game .sc-confirm-button {
  background-image:
    repeating-linear-gradient(90deg, rgba(255, 255, 255, .048) 0 1px, transparent 1px 5px),
    linear-gradient(180deg, rgba(255, 239, 196, .22), transparent 12%),
    linear-gradient(180deg, #5e6870 0 42%, #4b3920 43% 66%, #20272b 67% 100%) !important;
}

@media (prefers-reduced-motion: reduce) {
  .safe-cracker-game .sc-safe-shell,
  .safe-cracker-game .sc-safe-door,
  .safe-cracker-game .sc-dial-face,
  .safe-cracker-game .sc-dial-hub,
  .safe-cracker-game .sc-display,
  .safe-cracker-game .sc-step-controls button,
  .safe-cracker-game .sc-confirm-button {
    transition-duration: 0s !important;
  }
}
${end}`;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
for (const [blockStart, blockEnd] of [[legacyStart, legacyEnd], [start, end]]) {
  const blockPattern = new RegExp(`${escapeRegExp(blockStart)}[\\s\\S]*?${escapeRegExp(blockEnd)}\\n?`, 'g');
  css = css.replace(blockPattern, '');
}
css = css.trimEnd() + '\n\n' + texturePass + '\n';
await writeFile(cssUrl, css);

let index = await readFile(indexUrl, 'utf8');
index = index.replace(/&texture=\d+/g, '');
index = index.replace(/(safe-cracker\.css[^"']*)/, '$1&texture=2');
await writeFile(indexUrl, index);

console.log('Applied Safe Cracker texture pass v2: visibly brushed steel, restrained wear and machined dial rings with no lighting, layout, gameplay, networking or animation changes.');
