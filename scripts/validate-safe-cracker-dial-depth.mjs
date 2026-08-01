import { readFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const faceUrl = new URL('../assets/safe-cracker/textures/dial-reference-face-v5.svg', import.meta.url);
const patchUrl = new URL('./patch-safe-cracker-dial-depth.mjs', import.meta.url);
const [css, client, html, face, patch] = await Promise.all([
  readFile(cssUrl, 'utf8'),
  readFile(clientUrl, 'utf8'),
  readFile(indexUrl, 'utf8'),
  readFile(faceUrl, 'utf8'),
  readFile(patchUrl, 'utf8')
]);

const start = '/* SAFE_CRACKER_DIAL_DEPTH_V3_START */';
const end = '/* SAFE_CRACKER_DIAL_DEPTH_V3_END */';
const startIndex = css.indexOf(start);
const endIndex = css.indexOf(end);
if (startIndex < 0 || endIndex <= startIndex) {
  throw new Error('Safe Cracker dial-depth validation failed: v3 visual-pass markers are missing.');
}
const block = css.slice(startIndex, endIndex + end.length);

const requiredCss = [
  '.safe-cracker-game .sc-dial-wrap::before',
  '.safe-cracker-game .sc-dial-wrap::after',
  '.safe-cracker-game .sc-dial-pointer',
  '.safe-cracker-game .sc-dial-face::before',
  '.safe-cracker-game .sc-dial-face::after',
  '.safe-cracker-game .sc-dial-number > span',
  '.safe-cracker-game .sc-dial-hub::before',
  '.safe-cracker-game .sc-step-controls button',
  "url('/assets/safe-cracker/textures/dial-reference-face-v5.svg?dial=5')",
  'inset: -35px',
  'transform: translateY(-6px) scale(1.04)',
  'top: -54px',
  'width: 31px',
  'height: 57px',
  '--radius: 109px',
  'transform: scaleX(.82)',
  'color: #d9ad5d',
  'border-radius: 0',
  'background: transparent',
  'width: 37%',
  'width: 84px',
  'height: 84px'
];
for (const fragment of requiredCss) {
  if (!block.includes(fragment)) {
    throw new Error(`Safe Cracker dial-depth validation failed: missing v3 reference feature: ${fragment}.`);
  }
}

if (!block.includes('pointer-events: none')) {
  throw new Error('Safe Cracker dial-depth validation failed: dial overlays can intercept input.');
}
if (block.includes('repeating-conic-gradient')) {
  throw new Error('Safe Cracker dial-depth validation failed: flat CSS spoke or dot wheel was reintroduced.');
}
if (/animation(?:-name)?\s*:/i.test(block)) {
  throw new Error('Safe Cracker dial-depth validation failed: static dial styling added animation.');
}
if (/position\s*:\s*fixed/i.test(block) || /backdrop-filter\s*:/i.test(block)) {
  throw new Error('Safe Cracker dial-depth validation failed: dial pass escaped its component boundary.');
}
if (block.includes("url('/assets/safe-cracker/textures/dial-reference-face.svg')")) {
  throw new Error('Safe Cracker dial-depth validation failed: stale unversioned dial asset URL remains active.');
}

const requiredSvg = [
  'id="outer-rib"',
  'id="minor-tick"',
  'id="major-tick"',
  'id="inner-spoke"',
  'id="silver"',
  'id="brush"',
  'id="raised-slope"',
  'r="136.5"',
  'stroke-width="14"',
  'r="129"',
  'r="95"',
  'r="69"',
  'r="63"',
  'M152 3.5 L168 3.5 L166.6 25 L153.4 25 Z',
  'M158.5 68 L161.5 68 L160.8 91 L159.2 91 Z'
];
for (const fragment of requiredSvg) {
  if (!face.includes(fragment)) {
    throw new Error(`Safe Cracker dial-depth validation failed: v5 dimensional dial asset is missing ${fragment}.`);
  }
}

const counts = {
  ribs: (face.match(/href="#outer-rib"/g) || []).length,
  minorTicks: (face.match(/href="#minor-tick"/g) || []).length,
  majorTicks: (face.match(/href="#major-tick"/g) || []).length,
  spokes: (face.match(/href="#inner-spoke"/g) || []).length
};
if (counts.ribs !== 40) {
  throw new Error(`Safe Cracker dial-depth validation failed: expected 40 tactile grip blocks, found ${counts.ribs}.`);
}
if (counts.minorTicks !== 90 || counts.majorTicks !== 10) {
  throw new Error(`Safe Cracker dial-depth validation failed: expected 100 short silver ticks, found ${counts.minorTicks + counts.majorTicks}.`);
}
if (counts.spokes !== 10) {
  throw new Error(`Safe Cracker dial-depth validation failed: expected 10 short raised inner spokes, found ${counts.spokes}.`);
}
if (/<filter\b|feTurbulence|feGaussianBlur|feDropShadow/i.test(face)) {
  throw new Error('Safe Cracker dial-depth validation failed: expensive SVG filters were added to the rotating dial.');
}

const physicalNumberTransform = 'transform: rotate(var(--digit-angle)) translateY(calc(var(--radius) * -1));';
if (!css.includes(physicalNumberTransform)) {
  throw new Error('Safe Cracker dial-depth validation failed: existing physical radial numeral orientation changed.');
}

const gameplayFragments = [
  'const DETENT_DEGREES = 36;',
  'return modulo(-Math.round(rotation / DETENT_DEGREES), 10);',
  'return Array.from({ length: 10 }, (_, digit) => {',
  'const angle = digit * DETENT_DEGREES;',
  'data-sc-step="-1"',
  'data-sc-step="1"',
  'choice: `safecracker:guess:${runtime.selected}`',
  '// SAFE_CRACKER_INPUT_CONTINUITY_V9_START',
  '// SAFE_CRACKER_DIAL_ACTIVITY_V16_START'
];
for (const fragment of gameplayFragments) {
  if (!client.includes(fragment)) {
    throw new Error(`Safe Cracker dial-depth validation failed: gameplay/input contract changed: ${fragment}.`);
  }
}

if (!/safe-cracker\.css\?[^"'\s]*&dial=5/.test(html)) {
  throw new Error('Safe Cracker dial-depth validation failed: dial CSS cache key v5 is missing.');
}
if (css.includes('SAFE_CRACKER_DIAL_DEPTH_V1_START') || css.includes('SAFE_CRACKER_DIAL_DEPTH_V2_START')) {
  throw new Error('Safe Cracker dial-depth validation failed: legacy dial blocks remain.');
}
if (patch.includes("writeFile(new URL('../netlify/functions/")) {
  throw new Error('Safe Cracker dial-depth validation failed: visual patch writes networking files.');
}
if (patch.includes("writeFile(new URL('../assets/roulette/")) {
  throw new Error('Safe Cracker dial-depth validation failed: visual patch writes protected Roulette files.');
}

console.log('Safe Cracker reference-dial depth v3 validation passed: cache-busted black-and-silver dial face, 40 tactile scratched grip blocks, thick brushed-silver numeral bezel, clean black number band, 100 short silver ticks, 10 compact raised inner spokes, reduced layered hub, elevated faceted pointer, existing number orientation, dial retention, gameplay input, and protected Roulette boundaries are intact.');