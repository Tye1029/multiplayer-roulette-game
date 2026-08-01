import { readFile, writeFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const start = '/* SAFE_CRACKER_TEXTURE_PASS_V1_START */';
const end = '/* SAFE_CRACKER_TEXTURE_PASS_V1_END */';

let css = await readFile(cssUrl, 'utf8');

const texturePass = String.raw`${start}
/* Pass 1 only: low-contrast brushed metal texture. Lighting, layout,
   controls, animation, networking and gameplay remain unchanged. */
.safe-cracker-game {
  --sc-texture-bright: rgba(255, 255, 255, .025);
  --sc-texture-dark: rgba(0, 0, 0, .035);
  --sc-texture-wear: rgba(196, 205, 208, .025);
}

.safe-cracker-game .sc-safe-shell {
  background-image:
    repeating-linear-gradient(91deg, var(--sc-texture-bright) 0 1px, transparent 1px 4px),
    repeating-linear-gradient(0deg, var(--sc-texture-dark) 0 1px, transparent 1px 7px),
    radial-gradient(ellipse at 24% 18%, var(--sc-texture-wear), transparent 34%),
    radial-gradient(ellipse at 78% 74%, rgba(0, 0, 0, .045), transparent 42%),
    linear-gradient(145deg, #4b565c 0%, #20282d 24%, #10161a 58%, #303a40 100%) !important;
  background-blend-mode: soft-light, multiply, soft-light, multiply, normal !important;
}

.safe-cracker-game .sc-safe-door {
  background-image:
    radial-gradient(circle, #b3bdc1 0 2px, #232b2f 3px 6px, transparent 7px),
    radial-gradient(circle, #b3bdc1 0 2px, #232b2f 3px 6px, transparent 7px),
    linear-gradient(90deg, #11171a, #7b878d 47%, #1b2226),
    linear-gradient(90deg, #11171a, #7b878d 47%, #1b2226),
    repeating-linear-gradient(89.5deg, rgba(255, 255, 255, .022) 0 1px, transparent 1px 3px),
    repeating-linear-gradient(0deg, rgba(0, 0, 0, .028) 0 1px, transparent 1px 6px),
    radial-gradient(ellipse at 32% 16%, rgba(205, 214, 217, .028), transparent 31%),
    radial-gradient(ellipse at 70% 84%, rgba(0, 0, 0, .05), transparent 43%),
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
    auto !important;
  background-repeat:
    no-repeat,
    no-repeat,
    no-repeat,
    no-repeat,
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
    multiply,
    normal !important;
}

.safe-cracker-game .sc-display {
  background-image:
    repeating-linear-gradient(90deg, rgba(255, 255, 255, .016) 0 1px, transparent 1px 4px),
    linear-gradient(180deg, #3f4a50, #171e22 54%, #0c1114) !important;
  background-blend-mode: soft-light, normal !important;
}

.safe-cracker-game .sc-step-controls button,
.safe-cracker-game .sc-confirm-button {
  background-image:
    repeating-linear-gradient(90deg, rgba(255, 255, 255, .018) 0 1px, transparent 1px 5px),
    linear-gradient(180deg, rgba(130, 143, 150, .34) 0 8%, transparent 9%),
    linear-gradient(180deg, #4d585e, #252e33 52%, #161d21) !important;
  background-blend-mode: soft-light, normal, normal !important;
}

.safe-cracker-game .sc-confirm-button {
  background-image:
    repeating-linear-gradient(90deg, rgba(255, 255, 255, .016) 0 1px, transparent 1px 5px),
    linear-gradient(180deg, rgba(255, 239, 196, .16), transparent 11%),
    linear-gradient(180deg, #5e6870 0 42%, #4b3920 43% 66%, #20272b 67% 100%) !important;
}

@media (prefers-reduced-motion: reduce) {
  .safe-cracker-game .sc-safe-shell,
  .safe-cracker-game .sc-safe-door,
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
const blockPattern = new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}\\n?`, 'g');
css = css.replace(blockPattern, '').trimEnd() + '\n\n' + texturePass + '\n';
await writeFile(cssUrl, css);

let index = await readFile(indexUrl, 'utf8');
index = index.replace(/&texture=\d+/g, '');
index = index.replace(/(safe-cracker\.css[^"']*)/, '$1&texture=1');
await writeFile(indexUrl, index);

console.log('Applied Safe Cracker texture pass v1: subtle brushed-steel grain and material variation with no lighting, layout, gameplay, networking, or animation changes.');
