import { readFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const faceUrl = new URL('../assets/safe-cracker/textures/dial-reference-face.svg', import.meta.url);
const patchUrl = new URL('./patch-safe-cracker-dial-depth.mjs', import.meta.url);
const [css, client, html, face, patch] = await Promise.all([
  readFile(cssUrl, 'utf8'),
  readFile(clientUrl, 'utf8'),
  readFile(indexUrl, 'utf8'),
  readFile(faceUrl, 'utf8'),
  readFile(patchUrl, 'utf8')
]);

const start = '/* SAFE_CRACKER_DIAL_DEPTH_V2_START */';
const end = '/* SAFE_CRACKER_DIAL_DEPTH_V2_END */';
const startIndex = css.indexOf(start);
const endIndex = css.indexOf(end);
if (startIndex < 0 || endIndex <= startIndex) {
  throw new Error('Safe Cracker dial-depth validation failed: v2 visual-pass markers are missing.');
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
  "url('/assets/safe-cracker/textures/dial-reference-face.svg')",
  'inset: -34px',
  'transform: translateY(-5px) scale(1.045)',
  'top: -58px',
  'width: 32px',
  'height: 53px',
  '--radius: 108px',
  '"Roboto Condensed"',
  'color: #d8b36c',
  'border-radius: 0',
  'background: transparent',
  'width: 40%',
  'width: 92px',
  'height: 92px'
];
for (const fragment of requiredCss) {
  if (!block.includes(fragment)) {
    throw new Error(`Safe Cracker dial-depth validation failed: missing v2 reference feature: ${fragment}.`);
  }
}

if (!block.includes('pointer-events: none')) {
  throw new Error('Safe Cracker dial-depth validation failed: dial overlays can intercept input.');
}
if (block.includes('repeating-conic-gradient')) {
  throw new Error('Safe Cracker dial-depth validation failed: flat CSS dot/tick ring was reintroduced.');
}
if (/animation(?:-name)?\s*:/i.test(block)) {
  throw new Error('Safe Cracker dial-depth validation failed: static dial styling added animation.');
}
if (/position\s*:\s*fixed/i.test(block) || /backdrop-filter\s*:/i.test(block)) {
  throw new Error('Safe Cracker dial-depth validation failed: dial pass escaped its component boundary.');
}

const requiredSvg = [
  'id="outer-rib"',
  'id="minor-tick"',
  'id="major-tick"',
  'id="inner-spoke"',
  'id="silver-bezel"',
  'id="ring-grain"',
  'id="raised-slope"',
  'r="136"',
  'stroke-width="14"',
  'r="129"',
  'r="101"',
  'r="69"',
  'r="56"',
  'M151 4 L169 4 L167.2 29 L152.8 29 Z',
  'M158.4 64 L161.6 64 L160.9 89.5 L159.1 89.5 Z'
];
for (const fragment of requiredSvg) {
  if (!face.includes(fragment)) {
    throw new Error(`Safe Cracker dial-depth validation failed: dimensional dial asset is missing ${fragment}.`);
  }
}

const counts = {
  ribs: (face.match(/href="#outer-rib"/g) || []).length,
  minorTicks: (face.match(/href="#minor-tick"/g) || []).length,
  majorTicks: (face.match(/href="#major-tick"/g) || []).length,
  spokes: (face.match(/href="#inner-spoke"/g) || []).length
};
if (counts.ribs !== 40) {
  throw new Error(`Safe Cracker dial-depth validation failed: expected 40 raised grip blocks, found ${counts.ribs}.`);
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

if (!/safe-cracker\.css\?[^"'\s]*&dial=4/.test(html)) {
  throw new Error('Safe Cracker dial-depth validation failed: dial CSS cache key v4 is missing.');
}
if (css.includes('SAFE_CRACKER_DIAL_DEPTH_V1_START')) {
  throw new Error('Safe Cracker dial-depth validation failed: legacy v1 dial block remains.');
}
if (patch.includes("writeFile(new URL('../netlify/functions/")) {
  throw new Error('Safe Cracker dial-depth validation failed: visual patch writes networking files.');
}
if (patch.includes("writeFile(new URL('../assets/roulette/")) {
  throw new Error('Safe Cracker dial-depth validation failed: visual patch writes protected Roulette files.');
}

console.log('Safe Cracker reference-dial depth v2 validation passed: protruding wheel depth, 40 raised scratched grip blocks, thick brushed-silver numeral bezel, black number band, 100 short silver ticks, 10 compact raised inner spokes, dimensional black-and-silver hub, elevated faceted pointer, existing numeral orientation, gameplay input, dial retention, and protected Roulette boundaries are intact.');
