import { readFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const patchUrl = new URL('./patch-safe-cracker-dial-layout.mjs', import.meta.url);

const [css, client, html, patch] = await Promise.all([
  readFile(cssUrl, 'utf8'),
  readFile(clientUrl, 'utf8'),
  readFile(indexUrl, 'utf8'),
  readFile(patchUrl, 'utf8')
]);

const start = '/* SAFE_CRACKER_DIAL_LAYOUT_V2_START */';
const end = '/* SAFE_CRACKER_DIAL_LAYOUT_V2_END */';
const startIndex = css.indexOf(start);
const endIndex = css.indexOf(end);
if (startIndex < 0 || endIndex <= startIndex) {
  throw new Error('Safe Cracker dial-layout validation failed: the V2 layout block is missing.');
}
if ((css.match(/SAFE_CRACKER_DIAL_LAYOUT_V2_START/g) || []).length !== 1) {
  throw new Error('Safe Cracker dial-layout validation failed: the V2 layout block must appear exactly once.');
}
if (/SAFE_CRACKER_DIAL_LAYOUT_V1_START/.test(css)) {
  throw new Error('Safe Cracker dial-layout validation failed: the superseded V1 layout block remains.');
}
if (startIndex < css.indexOf('/* SAFE_CRACKER_DIAL_DEPTH_V5_END */')) {
  throw new Error('Safe Cracker dial-layout validation failed: the refinement is not the final dial styling pass.');
}
const block = css.slice(startIndex, endIndex + end.length);

const requiredCss = [
  '.safe-cracker-game .sc-display',
  'margin-bottom: 18px',
  '.safe-cracker-game .sc-dial-wrap::before',
  'inset: -32px',
  '.safe-cracker-game .sc-dial-wrap::after',
  'top: -52px',
  'width: 64px',
  'height: 29px',
  '.safe-cracker-game .sc-dial-pointer',
  'top: -44px',
  'width: 24px',
  'height: 50px',
  'clip-path: polygon(14% 0, 86% 0, 50% 100%)',
  'transform: translateY(0) scale(1.018)',
  '--radius: 96px',
  'width: 32px',
  'height: 32px',
  'font-size: 1.28rem',
  'width: 34%',
  'width: 74px',
  'height: 74px',
  '.safe-cracker-game .sc-step-controls button::before',
  "content: '+'",
  "button[data-sc-step='-1']::before",
  "content: '−'",
  'font-size: 0',
  '.safe-cracker-game .sc-confirm-button',
  'width: min(76%, 300px)',
  'color: #fff6d9',
  'linear-gradient(180deg, #c69b52 0%, #8c6633 48%, #5c3f1c 100%)',
  '0 3px 9px rgba(0,0,0,.34)',
  'opacity: .84',
  '@media (max-width: 700px)',
  'top: -37px',
  'width: 21px',
  'height: 38px',
  '--radius: min(24.5vw, 94px)',
  '@media (max-height: 720px) and (max-width: 700px)',
  '--radius: min(20.5vw, 74px)'
];
for (const fragment of requiredCss) {
  if (!block.includes(fragment)) {
    throw new Error(`Safe Cracker dial-layout validation failed: missing V2 layout feature: ${fragment}.`);
  }
}

if (block.includes('0 6px 0 #1a1007')) {
  throw new Error('Safe Cracker dial-layout validation failed: the heavy Check Number bottom ledge was reintroduced.');
}
if (/animation(?:-name)?\s*:/i.test(block)) {
  throw new Error('Safe Cracker dial-layout validation failed: the static refinement introduced an animation.');
}
if (/position\s*:\s*fixed/i.test(block) || /backdrop-filter\s*:/i.test(block)) {
  throw new Error('Safe Cracker dial-layout validation failed: the refinement escaped the Safe Cracker component.');
}

const assetPath = '/assets/safe-cracker/textures/dial-reference-face-v7.svg?dial=7&layout=3';
if (!client.includes(`src="${assetPath}"`)) {
  throw new Error('Safe Cracker dial-layout validation failed: the mounted plate does not use the layout-v3 asset cache key.');
}
if ((client.match(/class="sc-dial-reference-plate"/g) || []).length !== 1) {
  throw new Error('Safe Cracker dial-layout validation failed: the dial plate is not mounted exactly once.');
}
if (!/safe-cracker\.css\?[^"'\s]*&dial=7[^"'\s]*&layout=3/.test(html)) {
  throw new Error('Safe Cracker dial-layout validation failed: the final stylesheet cache key is missing layout=3.');
}
if (!/safe-cracker\.js\?[^"'\s]*&dial=7[^"'\s]*&layout=3/.test(html)) {
  throw new Error('Safe Cracker dial-layout validation failed: the final runtime cache key is missing layout=3.');
}

const gameplayFragments = [
  'const DETENT_DEGREES = 36;',
  'return modulo(-Math.round(rotation / DETENT_DEGREES), 10);',
  'data-sc-step="-1"',
  'data-sc-step="1"',
  'choice: `safecracker:guess:${runtime.selected}`',
  '// SAFE_CRACKER_INPUT_CONTINUITY_V9_START',
  '// SAFE_CRACKER_DIAL_ACTIVITY_V16_START'
];
for (const fragment of gameplayFragments) {
  if (!client.includes(fragment)) {
    throw new Error(`Safe Cracker dial-layout validation failed: gameplay/input contract changed: ${fragment}.`);
  }
}

if (patch.includes("writeFile(new URL('../netlify/functions/")) {
  throw new Error('Safe Cracker dial-layout validation failed: the visual patch writes networking files.');
}
if (patch.includes("writeFile(new URL('../assets/roulette/")) {
  throw new Error('Safe Cracker dial-layout validation failed: the visual patch writes protected Roulette files.');
}

console.log('Safe Cracker dial-layout v2 validation passed: numerals sit fully inside the black annulus, the lower compact housing contains a larger solid pointer, shadows are softened, step symbols remain centered, the brighter Check Number control has no heavy lower ledge, cache busting is current, V16 retention is intact, and Roulette remains protected.');
