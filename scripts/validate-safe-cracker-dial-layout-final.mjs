import { readFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const patchUrl = new URL('./patch-safe-cracker-dial-layout-final.mjs', import.meta.url);

const [css, client, html, patch] = await Promise.all([
  readFile(cssUrl, 'utf8'),
  readFile(clientUrl, 'utf8'),
  readFile(indexUrl, 'utf8'),
  readFile(patchUrl, 'utf8')
]);

const start = '/* SAFE_CRACKER_DIAL_LAYOUT_V3_START */';
const end = '/* SAFE_CRACKER_DIAL_LAYOUT_V3_END */';
const startIndex = css.indexOf(start);
const endIndex = css.indexOf(end);
if (startIndex < 0 || endIndex <= startIndex) {
  throw new Error('Safe Cracker final dial-layout validation failed: the V3 refinement block is missing.');
}
if ((css.match(/SAFE_CRACKER_DIAL_LAYOUT_V3_START/g) || []).length !== 1) {
  throw new Error('Safe Cracker final dial-layout validation failed: the V3 refinement must appear exactly once.');
}
if (startIndex < css.indexOf('/* SAFE_CRACKER_DIAL_LAYOUT_V2_END */')) {
  throw new Error('Safe Cracker final dial-layout validation failed: V3 is not the final Safe Cracker dial styling pass.');
}
const block = css.slice(startIndex, endIndex + end.length);

const requiredCss = [
  '--radius: 91px',
  'width: 30px',
  'height: 30px',
  'font-size: 1.22rem',
  '.safe-cracker-game .sc-dial-wrap::after',
  'top: -46px',
  '.safe-cracker-game .sc-dial-pointer',
  'top: -38px',
  'overflow: hidden',
  'isolation: isolate',
  '-webkit-appearance: none',
  'appearance: none',
  'border: 3px solid #050708 !important',
  'border-bottom-color: #050708 !important',
  'background: linear-gradient(180deg,',
  '#e2e8ea 0%',
  '#c4cdd1 31%',
  '#929fa5 67%',
  '#68757b 100%',
  'color: #ddb362',
  '-1px -1px 0 #050708',
  '1px 1px 0 #050708',
  '0 7px 0 #050708',
  'transition: transform .06s ease, box-shadow .06s ease',
  '.safe-cracker-game .sc-confirm-button:active',
  'transform: translateY(4px) !important',
  '0 3px 0 #050708',
  '.safe-cracker-game .sc-confirm-button::before',
  '.safe-cracker-game .sc-confirm-button::after',
  'content: none !important',
  'display: none !important',
  '--radius: min(23vw, 88px)',
  'top: -31px',
  'top: -25px',
  '--radius: min(19.1vw, 69px)',
  'top: -24px',
  'top: -18px'
];
for (const fragment of requiredCss) {
  if (!block.includes(fragment)) {
    throw new Error(`Safe Cracker final dial-layout validation failed: missing refined feature: ${fragment}.`);
  }
}

const forbiddenCss = [
  '0 7px 0 #030506',
  '0 3px 0 #030506',
  '0 7px 0 #4d3010',
  '0 3px 0 #4d3010',
  '#855515',
  '#c98b29',
  '#c69b52',
  '#8c6633',
  '#5c3f1c',
  'border: 0 !important',
  'inset 0 0 0 2px #e1bd72',
  'border: 3px solid #6f4b1e',
  '0 6px 0 #1a1007'
];
for (const fragment of forbiddenCss) {
  if (block.includes(fragment)) {
    throw new Error(`Safe Cracker final dial-layout validation failed: superseded styling returned: ${fragment}.`);
  }
}
if (/animation(?:-name)?\s*:/i.test(block)) {
  throw new Error('Safe Cracker final dial-layout validation failed: the static refinement introduced animation.');
}
if (/position\s*:\s*fixed/i.test(block) || /backdrop-filter\s*:/i.test(block)) {
  throw new Error('Safe Cracker final dial-layout validation failed: the refinement escaped its component boundary.');
}

const assetPath = '/assets/safe-cracker/textures/dial-reference-face-v7.svg?dial=7&layout=7';
if (!client.includes(`src="${assetPath}"`)) {
  throw new Error('Safe Cracker final dial-layout validation failed: the mounted plate does not use layout=7.');
}
if ((client.match(/class="sc-dial-reference-plate"/g) || []).length !== 1) {
  throw new Error('Safe Cracker final dial-layout validation failed: the dial plate is not mounted exactly once.');
}
if (!client.includes('function safeCrackerUpdateConfirmControl()')) {
  throw new Error('Safe Cracker final dial-layout validation failed: the confirmation-control helper is missing.');
}
if (!client.includes("? 'CHECK NUMBER'")) {
  throw new Error('Safe Cracker final dial-layout validation failed: the cooldown label was not normalized to CHECK NUMBER.');
}
if (/RESETTING(?:…|\.\.\.)/i.test(client)) {
  throw new Error('Safe Cracker final dial-layout validation failed: the RESETTING label remains.');
}
if (!/safe-cracker\.css\?[^"'\s]*&dial=7[^"'\s]*&layout=7/.test(html)) {
  throw new Error('Safe Cracker final dial-layout validation failed: stylesheet cache key layout=7 is missing.');
}
if (!/safe-cracker\.js\?[^"'\s]*&dial=7[^"'\s]*&layout=7/.test(html)) {
  throw new Error('Safe Cracker final dial-layout validation failed: runtime cache key layout=7 is missing.');
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
    throw new Error(`Safe Cracker final dial-layout validation failed: gameplay/input contract changed: ${fragment}.`);
  }
}

if (patch.includes("writeFile(new URL('../netlify/functions/")) {
  throw new Error('Safe Cracker final dial-layout validation failed: the visual patch writes networking files.');
}
if (patch.includes("writeFile(new URL('../assets/roulette/")) {
  throw new Error('Safe Cracker final dial-layout validation failed: the visual patch writes protected Roulette files.');
}

console.log('Safe Cracker confirmation refinement validation passed: no yellow/orange underlayer remains, the gold label has a black outline, the button indents against a black mechanical step, RESETTING is replaced with CHECK NUMBER, cache busting is current, V16 retention is intact, and Roulette remains protected.');
