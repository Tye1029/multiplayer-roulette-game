import { readFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const faceUrl = new URL('../assets/safe-cracker/textures/dial-reference-face-v6.svg', import.meta.url);
const patchUrl = new URL('./patch-safe-cracker-dial-depth.mjs', import.meta.url);

const [css, client, html, face, patch] = await Promise.all([
  readFile(cssUrl, 'utf8'),
  readFile(clientUrl, 'utf8'),
  readFile(indexUrl, 'utf8'),
  readFile(faceUrl, 'utf8'),
  readFile(patchUrl, 'utf8')
]);

const start = '/* SAFE_CRACKER_DIAL_DEPTH_V4_START */';
const end = '/* SAFE_CRACKER_DIAL_DEPTH_V4_END */';
const startIndex = css.indexOf(start);
const endIndex = css.indexOf(end);
if (startIndex < 0 || endIndex <= startIndex) {
  throw new Error('Safe Cracker dial-depth validation failed: v4 visual-pass markers are missing.');
}
const block = css.slice(startIndex, endIndex + end.length);

const requiredCss = [
  '.safe-cracker-game .sc-dial-wrap::before',
  '.safe-cracker-game .sc-dial-wrap::after',
  '.safe-cracker-game .sc-dial-pointer',
  '.safe-cracker-game .sc-dial-face::before',
  '.safe-cracker-game .sc-dial-number > span',
  '.safe-cracker-game .sc-dial-hub::before',
  "url('/assets/safe-cracker/textures/dial-reference-face-v6.svg?dial=6')",
  'background-color: #050708',
  'transform: translateY(-8px) scale(1.045)',
  'top: -69px',
  'width: 34px',
  'height: 54px',
  '--radius: 110px',
  '"DIN Condensed"',
  'color: #ddb362',
  'border-radius: 0',
  'background: transparent',
  'width: 35%',
  'width: 78px',
  'height: 78px'
];
for (const fragment of requiredCss) {
  if (!block.includes(fragment)) {
    throw new Error(`Safe Cracker dial-depth validation failed: missing v4 reference feature: ${fragment}.`);
  }
}

if (!block.includes('pointer-events: none')) {
  throw new Error('Safe Cracker dial-depth validation failed: dial overlays can intercept input.');
}
if (block.includes('repeating-conic-gradient')) {
  throw new Error('Safe Cracker dial-depth validation failed: the old flat spoke-wheel gradient was reintroduced.');
}
if (block.includes('dial-reference-face-v5.svg') || block.includes('dial-reference-face.svg')) {
  throw new Error('Safe Cracker dial-depth validation failed: a stale dial-face asset path remains in the final pass.');
}
if (/animation(?:-name)?\s*:/i.test(block)) {
  throw new Error('Safe Cracker dial-depth validation failed: static dial styling added animation.');
}
if (/position\s*:\s*fixed/i.test(block) || /backdrop-filter\s*:/i.test(block)) {
  throw new Error('Safe Cracker dial-depth validation failed: dial pass escaped its component boundary.');
}

const requiredSvg = [
  'id="grip-block"',
  'id="grip-separator"',
  'id="minor-tick"',
  'id="major-tick"',
  'id="inner-divider"',
  'id="silver"',
  'id="fine-brush"',
  'id="number-band"',
  'id="inner-slope"',
  'r="135.5"',
  'stroke-width="15.5"',
  'r="126"',
  'r="91.5"',
  'r="66.5"',
  'r="64"',
  'M151.1 3.3H168.9L166.8 27.2H153.2Z',
  'M158.35 70.5H161.65L160.9 92H159.1Z'
];
for (const fragment of requiredSvg) {
  if (!face.includes(fragment)) {
    throw new Error(`Safe Cracker dial-depth validation failed: rebuilt reference asset is missing ${fragment}.`);
  }
}

const counts = {
  grips: (face.match(/href="#grip-block"/g) || []).length,
  separators: (face.match(/href="#grip-separator"/g) || []).length,
  minorTicks: (face.match(/href="#minor-tick"/g) || []).length,
  majorTicks: (face.match(/href="#major-tick"/g) || []).length,
  dividers: (face.match(/href="#inner-divider"/g) || []).length
};
if (counts.grips !== 40 || counts.separators !== 40) {
  throw new Error(`Safe Cracker dial-depth validation failed: expected 40 raised grip blocks and separators, found ${counts.grips}/${counts.separators}.`);
}
if (counts.minorTicks !== 90 || counts.majorTicks !== 10) {
  throw new Error(`Safe Cracker dial-depth validation failed: expected 100 short silver tick marks, found ${counts.minorTicks + counts.majorTicks}.`);
}
if (counts.dividers !== 10) {
  throw new Error(`Safe Cracker dial-depth validation failed: expected 10 short silver inner dividers, found ${counts.dividers}.`);
}
if (/<filter\b|feTurbulence|feGaussianBlur|feDropShadow/i.test(face)) {
  throw new Error('Safe Cracker dial-depth validation failed: expensive SVG filters were added to the rotating wheel.');
}
const forbiddenWarmFaceColors = ['#ddb362', '#e3b968', '#f0ca77', '#a66f28', '#96601a', '#f4d080', '#d09330'];
for (const color of forbiddenWarmFaceColors) {
  if (face.toLowerCase().includes(color)) {
    throw new Error(`Safe Cracker dial-depth validation failed: warm spoke or numeral coloring leaked into the rotating SVG face: ${color}.`);
  }
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

if (!/safe-cracker\.css\?[^"'\s]*&dial=6/.test(html)) {
  throw new Error('Safe Cracker dial-depth validation failed: dial CSS cache key v6 is missing.');
}
if (/SAFE_CRACKER_DIAL_DEPTH_V[123]_START/.test(css)) {
  throw new Error('Safe Cracker dial-depth validation failed: a legacy dial-depth block remains in the generated stylesheet.');
}
if (patch.includes("writeFile(new URL('../netlify/functions/")) {
  throw new Error('Safe Cracker dial-depth validation failed: visual patch writes networking files.');
}
if (patch.includes("writeFile(new URL('../assets/roulette/")) {
  throw new Error('Safe Cracker dial-depth validation failed: visual patch writes protected Roulette files.');
}

console.log('Safe Cracker reference-dial depth v4 validation passed: deeply protruding wheel, 40 tactile scratched grip blocks with silver separators, thick brushed-silver bezel, wide black numeral annulus, 100 short silver ticks, isolated sloped inner plate, 10 compact silver dividers, smaller layered hub, elevated pointer, existing numeral orientation, dial retention, gameplay, and protected Roulette boundaries are intact.');
