import { readFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const faceUrl = new URL('../assets/safe-cracker/textures/dial-reference-face.svg', import.meta.url);
const [css, client, html, face] = await Promise.all([
  readFile(cssUrl, 'utf8'),
  readFile(clientUrl, 'utf8'),
  readFile(indexUrl, 'utf8'),
  readFile(faceUrl, 'utf8')
]);

const start = '/* SAFE_CRACKER_DIAL_DEPTH_V1_START */';
const end = '/* SAFE_CRACKER_DIAL_DEPTH_V1_END */';
const startIndex = css.indexOf(start);
const endIndex = css.indexOf(end);
if (startIndex < 0 || endIndex <= startIndex) {
  throw new Error('Safe Cracker dial-depth validation failed: visual-pass markers are missing.');
}
const block = css.slice(startIndex, endIndex + end.length);

const requiredCss = [
  '.safe-cracker-game .sc-dial-wrap::before',
  '.safe-cracker-game .sc-dial-wrap::after',
  '.safe-cracker-game .sc-dial-pointer',
  '.safe-cracker-game .sc-dial-face::after',
  '.safe-cracker-game .sc-dial-number > span',
  '.safe-cracker-game .sc-dial-hub::before',
  '.safe-cracker-game .sc-step-controls button',
  "url('/assets/safe-cracker/textures/dial-reference-face.svg')",
  'inset: -29px',
  'inset: -7px',
  'width: 29px',
  'height: 57px',
  '--radius: 112px',
  'width: 39%',
  'width: 108px',
  'height: 58px',
  'transparent .82deg 3.6deg',
  'radial-gradient(circle, transparent 0 73.8%'
];
for (const fragment of requiredCss) {
  if (!block.includes(fragment)) {
    throw new Error(`Safe Cracker dial-depth validation failed: missing structural reference feature: ${fragment}.`);
  }
}

const requiredSvg = [
  'id="outer-rib"',
  'id="spoke"',
  'id="silver"',
  'id="brush"',
  'r="135"',
  'r="104"',
  'r="93"',
  'r="66"',
  'r="55"'
];
for (const fragment of requiredSvg) {
  if (!face.includes(fragment)) {
    throw new Error(`Safe Cracker dial-depth validation failed: reference face asset is missing ${fragment}.`);
  }
}

const ribCount = (face.match(/href="#outer-rib"/g) || []).length;
if (ribCount !== 40) {
  throw new Error(`Safe Cracker dial-depth validation failed: expected 40 tactile grip ribs, found ${ribCount}.`);
}
const spokeCount = (face.match(/href="#spoke"/g) || []).length;
if (spokeCount !== 10) {
  throw new Error(`Safe Cracker dial-depth validation failed: expected 10 short silver inner spokes, found ${spokeCount}.`);
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

if (!/safe-cracker\.css\?[^"'\s]*&dial=3/.test(html)) {
  throw new Error('Safe Cracker dial-depth validation failed: dial CSS cache key v3 is missing.');
}

const forbiddenWarmMetal = ['#f2d48d', '#fff2bd', '#fff0b6', '#b67e31', '#9a6c2d', '#d8aa52', '#c7973b'];
for (const color of forbiddenWarmMetal) {
  if (block.toLowerCase().includes(color) || face.toLowerCase().includes(color)) {
    throw new Error(`Safe Cracker dial-depth validation failed: warm gold remains in the silver/gray dial: ${color}.`);
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
if (!block.includes('pointer-events: none')) {
  throw new Error('Safe Cracker dial-depth validation failed: visual overlays must not intercept input.');
}

console.log('Safe Cracker reference-dial rebuild validation passed: distinct cavity, 40 tactile grip ribs, thick brushed silver bezel, black 0-9 numeral band, 100 short silver ticks, 10 short inner spokes, sloped plate, convex hub, raised pointer, and left-minus/right-plus controls are intact.');
