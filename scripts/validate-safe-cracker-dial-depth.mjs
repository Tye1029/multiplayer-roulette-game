import { readFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const [css, client, html] = await Promise.all([
  readFile(cssUrl, 'utf8'),
  readFile(clientUrl, 'utf8'),
  readFile(indexUrl, 'utf8')
]);
const start = '/* SAFE_CRACKER_DIAL_DEPTH_V1_START */';
const end = '/* SAFE_CRACKER_DIAL_DEPTH_V1_END */';
const startIndex = css.indexOf(start);
const endIndex = css.indexOf(end);

if (startIndex < 0 || endIndex <= startIndex) {
  throw new Error('Safe Cracker dial-depth validation failed: visual-pass markers are missing.');
}

const block = css.slice(startIndex, endIndex + end.length);
const requiredFragments = [
  '.safe-cracker-game .sc-dial-wrap',
  '.safe-cracker-game .sc-dial-face::before',
  '.safe-cracker-game .sc-dial-face::after',
  '.safe-cracker-game .sc-dial-number > span',
  '.safe-cracker-game .sc-dial-hub::before',
  '.safe-cracker-game .sc-step-controls button',
  "url('/assets/safe-cracker/textures/dial-machined.svg')",
  'pointer-events: none',
  'repeating-conic-gradient',
  'transparent .58deg 3.6deg',
  '--radius: 105px',
  'width: 45%',
  'width: 88px',
  'clip-path: polygon(13% 0, 87% 0',
  'radial-gradient(circle, transparent 0 74.8%'
];

for (const fragment of requiredFragments) {
  if (!block.includes(fragment)) {
    throw new Error(`Safe Cracker dial-depth validation failed: missing ${fragment}.`);
  }
}

const physicalNumberTransform = 'transform: rotate(var(--digit-angle)) translateY(calc(var(--radius) * -1));';
if (!css.includes(physicalNumberTransform)) {
  throw new Error('Safe Cracker dial-depth validation failed: physical radial numeral orientation is missing.');
}

const gameplayFragments = [
  'const DETENT_DEGREES = 36;',
  'return modulo(-Math.round(rotation / DETENT_DEGREES), 10);',
  'return Array.from({ length: 10 }, (_, digit) => {',
  'const angle = digit * DETENT_DEGREES;',
  'data-sc-step="-1"',
  'data-sc-step="1"'
];
for (const fragment of gameplayFragments) {
  if (!client.includes(fragment)) {
    throw new Error(`Safe Cracker dial-depth validation failed: number/control contract changed: ${fragment}.`);
  }
}

if (!/safe-cracker\.css\?[^"'\s]*&dial=2/.test(html)) {
  throw new Error('Safe Cracker dial-depth validation failed: dial CSS cache key is missing.');
}

const forbiddenWarmMetal = ['#f2d48d', '#fff2bd', '#fff0b6', '#b67e31', '#9a6c2d'];
for (const color of forbiddenWarmMetal) {
  if (block.toLowerCase().includes(color)) {
    throw new Error(`Safe Cracker dial-depth validation failed: warm gold color remains in silver dial pass: ${color}.`);
  }
}

if (/position\s*:\s*fixed/i.test(block)) {
  throw new Error('Safe Cracker dial-depth validation failed: full-screen positioning is not allowed.');
}

if (/animation(?:-name)?\s*:/i.test(block)) {
  throw new Error('Safe Cracker dial-depth validation failed: this static pass must not add animation.');
}

if (/backdrop-filter\s*:/i.test(block)) {
  throw new Error('Safe Cracker dial-depth validation failed: backdrop filters are not allowed.');
}

console.log('Safe Cracker reference-dial validation passed: silver layered rings, 0-9 radial orientation, precision ticks, tactile grip ribs, center knob, and left-minus/right-plus controls are intact.');
