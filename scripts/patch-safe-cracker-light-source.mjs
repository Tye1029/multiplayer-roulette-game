import { readFile, writeFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const start = '/* SAFE_CRACKER_LIGHT_SOURCE_V1_START */';
const end = '/* SAFE_CRACKER_LIGHT_SOURCE_V1_END */';

let css = await readFile(cssUrl, 'utf8');

const lightPass = String.raw`${start}
/* Pass 3 only: one fixed warm source from the upper-left/upper-center.
   Light is resolved per metal surface; there is no cone, fullscreen overlay,
   animation, geometry change, gameplay change or network change. */
.safe-cracker-game {
  --sc-key-warm: rgba(255, 205, 126, .24);
  --sc-key-warm-soft: rgba(255, 185, 88, .12);
  --sc-key-edge: rgba(255, 226, 174, .075);
  --sc-key-falloff: rgba(0, 0, 0, .18);
}

.safe-cracker-game .sc-safe-shell {
  background-image:
    radial-gradient(ellipse at 28% -8%, var(--sc-key-warm) 0%, var(--sc-key-warm-soft) 26%, transparent 58%),
    linear-gradient(125deg, var(--sc-key-edge) 0%, transparent 43%, var(--sc-key-falloff) 100%),
    url('/assets/safe-cracker/textures/safe-steel-base.svg?v=1'),
    radial-gradient(ellipse at 26% 14%, rgba(221, 231, 234, .1), transparent 38%),
    linear-gradient(145deg, #39444a 0%, #171e22 48%, #0d1215 78%, #293238 100%) !important;
  background-size: 100% 100%, 100% 100%, 360px 360px, 100% 100%, 100% 100% !important;
  background-repeat: no-repeat, no-repeat, repeat, no-repeat, no-repeat !important;
  background-blend-mode: screen, multiply, soft-light, screen, normal !important;
}

.safe-cracker-game .sc-safe-door {
  background-image:
    radial-gradient(ellipse at 27% -2%, rgba(255, 208, 132, .22) 0%, rgba(255, 181, 83, .1) 29%, transparent 57%),
    linear-gradient(128deg, rgba(255, 226, 176, .065) 0%, transparent 46%, rgba(0, 0, 0, .2) 100%),
    url('/assets/safe-cracker/textures/metal-wear.svg?v=1'),
    url('/assets/safe-cracker/textures/safe-steel-base.svg?v=1'),
    radial-gradient(ellipse at 32% 16%, rgba(230, 238, 240, .12), transparent 34%),
    radial-gradient(ellipse at 72% 86%, rgba(0, 0, 0, .16), transparent 46%),
    linear-gradient(145deg, #58656b 0%, #273136 30%, #101619 69%, #354047 100%) !important;
  background-position: center, center, center, center, center, center, center !important;
  background-size: 100% 100%, 100% 100%, cover, 330px 330px, 100% 100%, 100% 100%, 100% 100% !important;
  background-repeat: no-repeat, no-repeat, no-repeat, repeat, no-repeat, no-repeat, no-repeat !important;
  background-blend-mode: screen, multiply, soft-light, overlay, screen, multiply, normal !important;
}

.safe-cracker-game .sc-safe-door::before {
  border-top-color: rgba(255, 213, 143, .18) !important;
  border-left-color: rgba(255, 213, 143, .1) !important;
  border-right-color: rgba(0, 0, 0, .26) !important;
  border-bottom-color: rgba(0, 0, 0, .34) !important;
}

.safe-cracker-game .sc-display {
  border-top-color: rgba(123, 91, 50, .74) !important;
  border-left-color: rgba(91, 70, 45, .58) !important;
  border-right-color: #11161a !important;
  border-bottom-color: #090c0e !important;
}

.safe-cracker-game .sc-dial-face {
  background-image:
    radial-gradient(circle at 30% 17%, rgba(255, 215, 150, .2) 0%, rgba(255, 188, 91, .075) 24%, transparent 49%),
    linear-gradient(132deg, rgba(255, 231, 187, .045) 0%, transparent 47%, rgba(0, 0, 0, .18) 100%),
    url('/assets/safe-cracker/textures/dial-machined.svg?v=1'),
    radial-gradient(circle at 38% 28%, rgba(255,255,255,.3), transparent 20%),
    radial-gradient(circle, #232b31 0 24%, transparent 25%),
    repeating-conic-gradient(from -2deg, #d2aa5d 0deg 1.5deg, #5c4929 1.5deg 3.3deg, #222a30 3.3deg 36deg),
    radial-gradient(circle, #64717b 0 66%, #1b2228 67% 73%, #a17a35 74% 78%, #1a2025 79%) !important;
  background-size: 100% 100%, 100% 100%, cover, 100% 100%, 100% 100%, 100% 100%, 100% 100% !important;
  background-repeat: no-repeat !important;
  background-blend-mode: screen, multiply, soft-light, screen, normal, normal, normal !important;
  border-top-color: #423a2a !important;
  border-left-color: #302d26 !important;
  border-right-color: #101519 !important;
  border-bottom-color: #0c1114 !important;
}

.safe-cracker-game .sc-dial-hub {
  background-image:
    radial-gradient(circle at 29% 18%, rgba(255, 219, 160, .18), transparent 46%),
    linear-gradient(132deg, transparent 38%, rgba(0, 0, 0, .18) 100%),
    url('/assets/safe-cracker/textures/dial-machined.svg?v=1'),
    radial-gradient(circle at 34% 28%, #929da4, #323c44 45%, #11171c 74%) !important;
  background-size: 100% 100%, 100% 100%, cover, 100% 100% !important;
  background-repeat: no-repeat !important;
  background-blend-mode: screen, multiply, soft-light, normal !important;
}

.safe-cracker-game .sc-step-controls button {
  background-image:
    radial-gradient(ellipse at 28% 0%, rgba(255, 218, 157, .14), transparent 58%),
    linear-gradient(135deg, rgba(255, 229, 183, .035), transparent 48%, rgba(0, 0, 0, .15)),
    url('/assets/safe-cracker/textures/safe-steel-base.svg?v=1'),
    linear-gradient(180deg, rgba(150, 163, 170, .42) 0 9%, transparent 10%),
    linear-gradient(180deg, #4d585e, #252e33 52%, #161d21) !important;
  background-size: 100% 100%, 100% 100%, 180px 180px, 100% 100%, 100% 100% !important;
  background-repeat: no-repeat, no-repeat, repeat, no-repeat, no-repeat !important;
  background-blend-mode: screen, multiply, soft-light, screen, normal !important;
}

.safe-cracker-game .sc-confirm-button {
  background-image:
    radial-gradient(ellipse at 27% -4%, rgba(255, 231, 178, .2), transparent 56%),
    linear-gradient(134deg, rgba(255, 232, 188, .045), transparent 48%, rgba(0, 0, 0, .16)),
    url('/assets/safe-cracker/textures/metal-wear.svg?v=1'),
    url('/assets/safe-cracker/textures/safe-steel-base.svg?v=1'),
    linear-gradient(180deg, rgba(255, 239, 196, .2), transparent 12%),
    linear-gradient(180deg, #606a71 0 42%, #4c3920 43% 66%, #20272b 67% 100%) !important;
  background-size: 100% 100%, 100% 100%, cover, 240px 180px, 100% 100%, 100% 100% !important;
  background-repeat: no-repeat, no-repeat, no-repeat, repeat, no-repeat, no-repeat !important;
  background-blend-mode: screen, multiply, soft-light, soft-light, screen, normal !important;
}
${end}`;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
const blockPattern = new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}\\n?`, 'g');
css = css.replace(blockPattern, '').trimEnd() + '\n\n' + lightPass + '\n';
await writeFile(cssUrl, css);

let index = await readFile(indexUrl, 'utf8');
index = index.replace(/&light=\d+/g, '');
index = index.replace(/(safe-cracker\.css[^"']*)/, '$1&light=1');
await writeFile(indexUrl, index);

console.log('Applied Safe Cracker light source v1: one static warm upper-left key with per-surface falloff and no cone, animation, layout or behavior changes.');
