import { readFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const faceUrl = new URL('../assets/safe-cracker/textures/dial-reference-face-v7.svg', import.meta.url);
const patchUrl = new URL('./patch-safe-cracker-dial-depth.mjs', import.meta.url);

const [css, client, html, face, patch] = await Promise.all([
  readFile(cssUrl, 'utf8'),
  readFile(clientUrl, 'utf8'),
  readFile(indexUrl, 'utf8'),
  readFile(faceUrl, 'utf8'),
  readFile(patchUrl, 'utf8')
]);

const start = '/* SAFE_CRACKER_DIAL_DEPTH_V5_START */';
const end = '/* SAFE_CRACKER_DIAL_DEPTH_V5_END */';
const startIndex = css.indexOf(start);
const endIndex = css.indexOf(end);
if (startIndex < 0 || endIndex <= startIndex) {
  throw new Error('Safe Cracker dial-depth validation failed: v5 visual-pass markers are missing.');
}
const block = css.slice(startIndex, endIndex + end.length);

const requiredCss = [
  '.safe-cracker-game .sc-dial-wrap::before',
  '.safe-cracker-game .sc-dial-wrap::after',
  '.safe-cracker-game .sc-dial-pointer',
  '.safe-cracker-game .sc-dial-reference-plate',
  '.safe-cracker-game .sc-dial-number::before',
  '.safe-cracker-game .sc-dial-number > span',
  '.safe-cracker-game .sc-dial-hub::before',
  'background: #050708 !important',
  'background-image: none !important',
  'transform: translateY(-9px) scale(1.048)',
  'top: -71px',
  'width: 34px',
  'height: 55px',
  '--radius: 109px',
  '"DIN Condensed"',
  'color: #ddb362',
  'width: 35%',
  'width: 78px',
  'height: 78px',
  '-webkit-user-drag: none'
];
for (const fragment of requiredCss) {
  if (!block.includes(fragment)) {
    throw new Error(`Safe Cracker dial-depth validation failed: missing v5 feature: ${fragment}.`);
  }
}

const assetPath = '/assets/safe-cracker/textures/dial-reference-face-v7.svg?dial=7';
if (!client.includes('class="sc-dial-reference-plate"')) {
  throw new Error('Safe Cracker dial-depth validation failed: the real dial plate image is not mounted in the rotating face.');
}
if (!client.includes(`src="${assetPath}"`)) {
  throw new Error('Safe Cracker dial-depth validation failed: the rotating face does not use the v7 cache-busted dial asset.');
}
if ((client.match(/class="sc-dial-reference-plate"/g) || []).length !== 1) {
  throw new Error('Safe Cracker dial-depth validation failed: the rotating dial plate must be mounted exactly once.');
}
if (!block.includes('content: none !important')) {
  throw new Error('Safe Cracker dial-depth validation failed: legacy numeral pseudo-spokes are not explicitly disabled.');
}
if (block.includes('repeating-conic-gradient')) {
  throw new Error('Safe Cracker dial-depth validation failed: the old spoke-wheel gradient was reintroduced in the final pass.');
}
if (/animation(?:-name)?\s*:/i.test(block)) {
  throw new Error('Safe Cracker dial-depth validation failed: static dial styling added animation.');
}
if (/position\s*:\s*fixed/i.test(block) || /backdrop-filter\s*:/i.test(block)) {
  throw new Error('Safe Cracker dial-depth validation failed: dial styling escaped its component boundary.');
}

const requiredSvg = [
  'class="grip-blocks" data-count="40"',
  'class="grip-scratches-light"',
  'class="grip-separators" data-count="40"',
  'class="silver-bezel"',
  'class="silver-brush"',
  'class="number-band"',
  'class="minor-ticks" data-count="90"',
  'class="major-ticks" data-count="10"',
  'class="inner-slope"',
  'class="inner-dividers" data-count="10"',
  'class="inner-hub-ring"',
  'r="136"',
  'stroke-width="16"',
  'r="126"',
  'r="93"',
  'r="68"'
];
for (const fragment of requiredSvg) {
  if (!face.includes(fragment)) {
    throw new Error(`Safe Cracker dial-depth validation failed: flattened reference asset is missing ${fragment}.`);
  }
}

const flattenedCounts = [
  'class="grip-blocks" data-count="40"',
  'class="grip-separators" data-count="40"',
  'class="minor-ticks" data-count="90"',
  'class="major-ticks" data-count="10"',
  'class="inner-dividers" data-count="10"'
];
for (const fragment of flattenedCounts) {
  if (!face.includes(fragment)) {
    throw new Error(`Safe Cracker dial-depth validation failed: flattened dial count marker is missing: ${fragment}.`);
  }
}
if (/<use\b|xlink:href|<filter\b|feTurbulence|feGaussianBlur|feDropShadow/i.test(face)) {
  throw new Error('Safe Cracker dial-depth validation failed: the mobile-safe flattened SVG contains reusable or expensive filter nodes.');
}

const physicalNumberTransform = 'transform: rotate(var(--digit-angle)) translateY(calc(var(--radius) * -1));';
if (!css.includes(physicalNumberTransform)) {
  throw new Error('Safe Cracker dial-depth validation failed: the existing radial numeral orientation changed.');
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

if (!/safe-cracker\.css\?[^"'\s]*&dial=7/.test(html)) {
  throw new Error('Safe Cracker dial-depth validation failed: dial CSS cache key v7 is missing.');
}
if (!/safe-cracker\.js\?[^"'\s]*&dial=7/.test(html)) {
  throw new Error('Safe Cracker dial-depth validation failed: dial runtime cache key v7 is missing.');
}
if (/SAFE_CRACKER_DIAL_DEPTH_V[1234]_START/.test(css)) {
  throw new Error('Safe Cracker dial-depth validation failed: a legacy dial-depth block remains in the generated stylesheet.');
}
if (patch.includes("writeFile(new URL('../netlify/functions/")) {
  throw new Error('Safe Cracker dial-depth validation failed: visual patch writes networking files.');
}
if (patch.includes("writeFile(new URL('../assets/roulette/")) {
  throw new Error('Safe Cracker dial-depth validation failed: visual patch writes protected Roulette files.');
}

console.log('Safe Cracker reference-dial depth v5 validation passed: the live rotating face uses one flattened cache-busted SVG image that masks the legacy spoke wheel, with 40 raised scratched grip blocks, a thick brushed-silver bezel, wide black number annulus, 100 short silver ticks, isolated sloped inner plate, 10 short silver dividers, dimensional hub, elevated pointer, existing dial input, V16 retention, and protected Roulette boundaries intact.');
