import { readFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const css = await readFile(cssUrl, 'utf8');
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
  "url('/assets/safe-cracker/textures/dial-machined.svg')",
  'pointer-events: none',
  'repeating-conic-gradient',
  'radial-gradient(circle, transparent 0 67.5%'
];

for (const fragment of requiredFragments) {
  if (!block.includes(fragment)) {
    throw new Error(`Safe Cracker dial-depth validation failed: missing ${fragment}.`);
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

console.log('Safe Cracker dial-depth visual pass validated: scoped static styling, tactile rings, metal ticks, and no gameplay selectors.');
