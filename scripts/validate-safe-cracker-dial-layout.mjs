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

const start = '/* SAFE_CRACKER_DIAL_LAYOUT_V1_START */';
const end = '/* SAFE_CRACKER_DIAL_LAYOUT_V1_END */';
const startIndex = css.indexOf(start);
const endIndex = css.indexOf(end);
if (startIndex < 0 || endIndex <= startIndex) {
  throw new Error('Safe Cracker dial-layout validation failed: the V1 layout block is missing.');
}
if ((css.match(/SAFE_CRACKER_DIAL_LAYOUT_V1_START/g) || []).length !== 1) {
  throw new Error('Safe Cracker dial-layout validation failed: the layout block must appear exactly once.');
}
if (startIndex < css.indexOf('/* SAFE_CRACKER_DIAL_DEPTH_V5_END */')) {
  throw new Error('Safe Cracker dial-layout validation failed: the refinement is not the final dial styling pass.');
}
const block = css.slice(startIndex, endIndex + end.length);

const requiredCss = [
  '.safe-cracker-game .sc-display',
  'margin-bottom: 20px',
  '.safe-cracker-game .sc-dial-wrap::after',
  'top: -58px',
  'width: 64px',
  'height: 29px',
  '.safe-cracker-game .sc-dial-pointer',
  'width: 20px',
  'height: 44px',
  'clip-path: polygon(16% 0, 84% 0, 50% 100%)',
  'transform: translateY(-2px) scale(1.022)',
  '--radius: 103px',
  'width: 34px',
  'height: 34px',
  'font-size: 1.34rem',
  'width: 34%',
  'width: 74px',
  'height: 74px',
  '.safe-cracker-game .sc-step-controls button::before',
  "content: '+'",
  "button[data-sc-step='-1']::before",
  "content: '−'",
  'font-size: 0',
  '.safe-cracker-game .sc-confirm-button',
  'color: #fff1c2',
  'linear-gradient(180deg, #a98243 0%, #74552b 48%, #443016 100%)',
  'opacity: .74',
  '@media (max-width: 700px)',
  'top: -43px',
  'width: 17px',
  'height: 33px',
  '--radius: min(26.5vw, 102px)'
];
for (const fragment of requiredCss) {
  if (!block.includes(fragment)) {
    throw new Error(`Safe Cracker dial-layout validation failed: missing layout feature: ${fragment}.`);
  }
}

if (/animation(?:-name)?\s*:/i.test(block)) {
  throw new Error('Safe Cracker dial-layout validation failed: the static refinement introduced an animation.');
}
if (/position\s*:\s*fixed/i.test(block) || /backdrop-filter\s*:/i.test(block)) {
  throw new Error('Safe Cracker dial-layout validation failed: the refinement escaped the Safe Cracker component.');
}

const assetPath = '/assets/safe-cracker/textures/dial-reference-face-v7.svg?dial=7&layout=2';
if (!client.includes(`src="${assetPath}"`)) {
  throw new Error('Safe Cracker dial-layout validation failed: the mounted plate does not use the layout-v2 asset cache key.');
}
if ((client.match(/class="sc-dial-reference-plate"/g) || []).length !== 1) {
  throw new Error('Safe Cracker dial-layout validation failed: the dial plate is not mounted exactly once.');
}
if (!/safe-cracker\.css\?[^"'\s]*&dial=7[^"'\s]*&layout=2/.test(html)) {
  throw new Error('Safe Cracker dial-layout validation failed: the final stylesheet cache key is missing layout=2.');
}
if (!/safe-cracker\.js\?[^"'\s]*&dial=7[^"'\s]*&layout=2/.test(html)) {
  throw new Error('Safe Cracker dial-layout validation failed: the final runtime cache key is missing layout=2.');
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

console.log('Safe Cracker dial-layout v1 validation passed: numerals sit inward in the black annulus, the smaller straight-sided pointer clears the display, its housing is compact, step symbols are centered, the Check Number control is brighter, cache busting is current, V16 retention is intact, and Roulette remains protected.');
