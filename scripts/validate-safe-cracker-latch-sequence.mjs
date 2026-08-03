import { readFile } from 'node:fs/promises';

const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const patchUrl = new URL('./patch-safe-cracker-latch-sequence.mjs', import.meta.url);

const [css, client, html, patch] = await Promise.all([
  readFile(cssUrl, 'utf8'),
  readFile(clientUrl, 'utf8'),
  readFile(indexUrl, 'utf8'),
  readFile(patchUrl, 'utf8')
]);

const start = '/* SAFE_CRACKER_LATCH_SEQUENCE_V1_START */';
const end = '/* SAFE_CRACKER_LATCH_SEQUENCE_V1_END */';
const startIndex = css.indexOf(start);
const endIndex = css.indexOf(end);
if (startIndex < 0 || endIndex <= startIndex) {
  throw new Error('Safe Cracker latch validation failed: the latch CSS block is missing.');
}
if ((css.match(/SAFE_CRACKER_LATCH_SEQUENCE_V1_START/g) || []).length !== 1) {
  throw new Error('Safe Cracker latch validation failed: the latch CSS block must appear exactly once.');
}
if (startIndex < css.indexOf('/* SAFE_CRACKER_DIAL_LAYOUT_V3_END */')) {
  throw new Error('Safe Cracker latch validation failed: latch styling is not the final Safe Cracker visual pass.');
}
const block = css.slice(startIndex, endIndex + end.length);

const requiredCss = [
  '.safe-cracker-game .sc-confirm-button',
  'overflow: visible !important',
  'background-color: #aab4b8 !important',
  '#e2e8ea 0%',
  '#68757b 100%',
  'background-clip: padding-box !important',
  'border: 3px solid #050708 !important',
  'filter: none !important',
  '0 5px 10px rgba(0,0,0,.48) !important',
  '.safe-cracker-game .sc-confirm-button > span',
  'color: #ddb362',
  'background: transparent !important',
  '.safe-cracker-game .sc-confirm-button::after',
  "content: '' !important",
  'bottom: -7px',
  'height: 7px',
  'background: #050708 !important',
  'box-shadow: none !important',
  '.safe-cracker-game .sc-confirm-button:active',
  'transform: translateY(4px) !important',
  '0 1px 4px rgba(0,0,0,.42) !important',
  '.safe-cracker-game .sc-confirm-button:active::after',
  'bottom: -3px',
  'height: 3px',
  'Six fixed mounting assemblies',
  '.safe-cracker-game .sc-latch-mount',
  'width: 60px',
  'height: 50px',
  '.safe-cracker-game .sc-latch-mount::before',
  'width: 45px',
  'linear-gradient(90deg, #20282c 0%, #77848a 26%, #3d484e 54%, #171e22 100%)',
  '.safe-cracker-game .sc-bolts.left .sc-latch-mount::before',
  '.safe-cracker-game .sc-bolts.right .sc-latch-mount::before',
  'Inward-facing mounting ear with one recessed screw',
  '.safe-cracker-game .sc-latch-mount::after',
  'radial-gradient(circle at 50% 10px',
  'rgba(255,255,255,.88) 0 1px',
  '#9ba6ab 1.5px 3px',
  '#080b0d 5.5px 6.5px',
  '.safe-cracker-game .sc-bolts.left .sc-latch-mount::after',
  'left: 34px',
  '.safe-cracker-game .sc-bolts.right .sc-latch-mount::after',
  'right: 34px',
  '.safe-cracker-game .sc-latch-mount > i',
  'width: 28px',
  'height: 37px',
  '#c2cbce 46%',
  '.safe-cracker-game .sc-bolts.left .sc-latch-mount > i',
  '.safe-cracker-game .sc-bolts.right .sc-latch-mount > i',
  'transform .82s cubic-bezier(.2,.85,.28,1)',
  'filter .58s ease',
  'opacity .58s ease',
  '.safe-cracker-game .sc-bolts.right i.sc-latch-released',
  'translateX(17px) rotate(7deg)',
  '.safe-cracker-game .sc-bolts.right i.sc-latch-releasing',
  'animation: scSafeCrackerLatchReleaseV1 1.15s',
  '@keyframes scSafeCrackerLatchReleaseV1',
  'width: 51px',
  'translateX(13px) rotate(7deg)'
];
for (const fragment of requiredCss) {
  if (!block.includes(fragment)) {
    throw new Error(`Safe Cracker latch validation failed: missing visual behavior: ${fragment}.`);
  }
}

const forbiddenCss = [
  '#ffe19a',
  '#c98b29',
  '#855515',
  '#4d3010',
  '#c69b52',
  '#8c6633',
  '#5c3f1c',
  '0 7px 0',
  '0 6px 0',
  'animation: scSafeCrackerLatchReleaseV1 .58s',
  'animation: scSafeCrackerLatchReleaseV1 .82s',
  'transform .58s cubic-bezier(.2,.85,.28,1)'
];
for (const fragment of forbiddenCss) {
  if (block.includes(fragment)) {
    throw new Error(`Safe Cracker latch validation failed: superseded latch/button styling remains: ${fragment}.`);
  }
}
if (/position\s*:\s*fixed/i.test(block) || /backdrop-filter\s*:/i.test(block)) {
  throw new Error('Safe Cracker latch validation failed: the visual pass escaped the Safe Cracker component.');
}

const requiredClient = [
  '// SAFE_CRACKER_LATCH_SEQUENCE_V1_RUNTIME',
  "latchGameId: ''",
  'latchStage: 0',
  '// SAFE_CRACKER_LATCH_SEQUENCE_V1_HELPER',
  'function safeCrackerLatchMount(latchClass = \'\')',
  'class="sc-latch-mount"',
  'function safeCrackerStaticLatchBank(side)',
  'data-sc-mounted-latches="true"',
  'function safeCrackerLatchBank(game, me)',
  'const latchStage = Math.max(0, Math.min(STAGES, Number(me?.stage || 0)))',
  'latchStage > runtime.latchStage',
  'const latchClass = index => [',
  'data-sc-latch-stage=',
  'safeCrackerLatchMount(latchClass(1))',
  'safeCrackerLatchMount(latchClass(2))',
  'safeCrackerLatchMount(latchClass(3))',
  "safeCrackerStaticLatchBank('left')",
  'safeCrackerLatchBank(game, me)',
  '// SAFE_CRACKER_INPUT_CONTINUITY_V9_START',
  '// SAFE_CRACKER_DIAL_ACTIVITY_V16_START',
  'choice: `safecracker:guess:${runtime.selected}`'
];
for (const fragment of requiredClient) {
  if (!client.includes(fragment)) {
    throw new Error(`Safe Cracker latch validation failed: missing runtime behavior: ${fragment}.`);
  }
}
if ((client.match(/data-sc-mounted-latches=/g) || []).length !== 2) {
  throw new Error('Safe Cracker latch validation failed: both three-latch mounting banks are not generated exactly once.');
}
if ((client.match(/\$\{safeCrackerStaticLatchBank\('left'\)\}/g) || []).length !== 1) {
  throw new Error('Safe Cracker latch validation failed: the mounted left latch bank is not inserted exactly once.');
}
if ((client.match(/\$\{safeCrackerLatchBank\(game, me\)\}/g) || []).length !== 1) {
  throw new Error('Safe Cracker latch validation failed: the staged right latch bank is not mounted exactly once.');
}
if (/RESETTING(?:…|\.\.\.)/i.test(client)) {
  throw new Error('Safe Cracker latch validation failed: RESETTING still appears on the Check Number control.');
}
if (!/safe-cracker\.css\?[^"'\s]*&layout=7[^"'\s]*&latch=4/.test(html)) {
  throw new Error('Safe Cracker latch validation failed: stylesheet latch cache key is missing latch=4.');
}
if (!/safe-cracker\.js\?[^"'\s]*&layout=7[^"'\s]*&latch=4/.test(html)) {
  throw new Error('Safe Cracker latch validation failed: runtime latch cache key is missing latch=4.');
}

if (patch.includes("writeFile(new URL('../netlify/functions/")) {
  throw new Error('Safe Cracker latch validation failed: the visual patch writes networking files.');
}
if (patch.includes("writeFile(new URL('../assets/roulette/")) {
  throw new Error('Safe Cracker latch validation failed: the visual patch writes protected Roulette files.');
}

console.log('Safe Cracker latch sequence validation passed: all six latch cylinders sit in fixed beveled backplates with inward side flanges and recessed screws, only the latch bodies move during the established release sequence, and networking/Roulette remain untouched.');
