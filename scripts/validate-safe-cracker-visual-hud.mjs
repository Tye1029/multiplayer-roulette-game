import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [client, css, index, patch] = await Promise.all([
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/safe-cracker.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-visual-hud.mjs', root), 'utf8')
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker visual-HUD validation failed: ${message}`);
}

function occurrences(source, value) {
  return source.split(value).length - 1;
}

assert(occurrences(css, '/* SAFE_CRACKER_VISUAL_HUD_V3_START */') === 1, 'visual HUD marker must appear exactly once');
assert(occurrences(css, '/* SAFE_CRACKER_VISUAL_HUD_V3_END */') === 1, 'visual HUD end marker must appear exactly once');
assert(occurrences(client, '// SAFE_CRACKER_HUD_V3_START') === 1, 'HUD renderer marker must appear exactly once');
assert(client.includes('function feedbackMeter(tier = \'\')'), 'feedback proximity meter renderer is missing');
assert(client.includes('class="sc-stage-bolt"'), 'physical tumbler bolt markup is missing');
assert(client.includes('class="sc-display-glass"'), 'industrial display glass markup is missing');
assert(client.includes('class="sc-display-meta"'), 'display metadata row is missing');
assert(client.includes('class="sc-race-progress"'), 'compact opponent race HUD is missing');
assert(client.includes('class="sc-attempt-list"'), 'compact attempt console is missing');
assert(client.includes("choice: `safecracker:guess:${runtime.selected}`"), 'visual HUD pass changed authoritative guess submission');
assert(css.includes('.sc-stage-bolt'), 'physical tumbler bolt styling is missing');
assert(css.includes('.sc-stage-light.locked .sc-stage-bolt'), 'sealed tumbler state is missing');
assert(css.includes('.sc-display-glass::before'), 'industrial scanline treatment is missing');
assert(css.includes('.sc-feedback-meter i.active.green'), 'four-stage feedback meter styling is missing');
assert(css.includes('.sc-timer::before'), 'instrument-style timer label is missing');
assert(css.includes('.sc-race-signal'), 'race status signal styling is missing');
assert(css.includes('@media (max-width: 390px)'), 'small-mobile HUD treatment is missing');
assert(index.includes('/assets/safe-cracker/safe-cracker.css?v=7'), 'visual-HUD stylesheet cache version is not v7');
assert(index.includes('/assets/safe-cracker/safe-cracker.js?v=7'), 'visual-HUD runtime cache version is not v7');
assert(!patch.includes('assets/roulette/turn-animation.js'), 'visual HUD patch references the protected turn animation');
assert(!patch.includes('assets/roulette/turn-fire.js'), 'visual HUD patch references the protected firing animation');
assert(!patch.includes('netlify/functions/_data.js'), 'visual HUD patch must not modify server gameplay logic');

console.log('Safe Cracker visual-HUD validation passed: industrial feedback display, physical progress locks, and compact HUD are present without server or Roulette changes.');
