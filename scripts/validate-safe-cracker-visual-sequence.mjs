import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [client, css, index, patch, data, turnAnimation, turnFire] = await Promise.all([
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/safe-cracker.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-visual-sequence.mjs', root), 'utf8'),
  readFile(new URL('netlify/functions/_data.js', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root)),
  readFile(new URL('assets/roulette/turn-fire.js', root))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker visual-sequence validation failed: ${message}`);
}

function occurrences(source, value) {
  return source.split(value).length - 1;
}

assert(occurrences(css, '/* SAFE_CRACKER_VISUAL_SEQUENCE_V4_START */') === 1, 'visual sequence marker must appear exactly once');
assert(occurrences(css, '/* SAFE_CRACKER_VISUAL_SEQUENCE_V4_END */') === 1, 'visual sequence end marker must appear exactly once');
assert(occurrences(client, '// SAFE_CRACKER_SEQUENCE_V4_START') === 1, 'sequence renderer marker must appear exactly once');
assert(client.includes('function playCountdownBeat(label, game = runtime.game)'), 'mechanical countdown audio helper is missing');
assert(client.includes('data-sc-countdown-value'), 'cinematic countdown value markup is missing');
assert(client.includes('data-sc-countdown-status'), 'countdown mechanism status is missing');
assert(client.includes('function resultVaultMechanism()'), 'result vault mechanism renderer is missing');
assert(client.includes('data-sc-result-sequence'), 'cinematic result sequence marker is missing');
assert(client.includes('class="sc-result-door-bolts"'), 'result locking bolts are missing');
assert(client.includes('class="sc-result-vault-light"'), 'winning vault light spill is missing');
assert(client.includes("choice: `safecracker:guess:${runtime.selected}`"), 'visual sequence pass changed authoritative guess submission');
assert(css.includes('.sc-countdown-vault'), 'countdown vault mechanism styling is missing');
assert(css.includes("[data-sc-countdown-label='GO!']"), 'GO state styling is missing');
assert(css.includes('.sc-result-overlay.win .sc-result-door'), 'winning safe-opening animation is missing');
assert(css.includes('.sc-result-overlay.lose .sc-result-door'), 'loss lockout animation is missing');
assert(css.includes('@keyframes scResultDoorOpen'), 'safe-door opening keyframes are missing');
assert(css.includes('@media (prefers-reduced-motion: reduce)'), 'reduced-motion result treatment is missing');
assert(index.includes('/assets/safe-cracker/safe-cracker.css?v=8'), 'visual-sequence stylesheet cache version is not v8');
assert(index.includes('/assets/safe-cracker/safe-cracker.js?v=8'), 'visual-sequence runtime cache version is not v8');
assert(index.includes('duel-end-screen-close'), 'shared close-X result control is missing');
assert(data.includes('// SAFE_CRACKER_DIRECT_COMPLETION_START'), 'visual pass disturbed direct completion');
assert(!patch.includes('netlify/functions/_data.js'), 'visual sequence patch must not modify server gameplay logic');
assert(!patch.includes('assets/roulette/turn-animation.js'), 'visual sequence patch references the protected turn animation');
assert(!patch.includes('assets/roulette/turn-fire.js'), 'visual sequence patch references the protected firing animation');
assert(turnAnimation.length > 0 && turnFire.length > 0, 'protected Roulette assets could not be read');

console.log('Safe Cracker visual-sequence validation passed: cinematic countdown and safe-opening results are present without server or Roulette changes.');
