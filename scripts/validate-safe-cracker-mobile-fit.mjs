import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [client, css, index, patch, data, turnAnimation, turnFire] = await Promise.all([
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/safe-cracker.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-mobile-fit.mjs', root), 'utf8'),
  readFile(new URL('netlify/functions/_data.js', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root)),
  readFile(new URL('assets/roulette/turn-fire.js', root))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker mobile-fit validation failed: ${message}`);
}

function occurrences(source, value) {
  return source.split(value).length - 1;
}

assert(occurrences(css, '/* SAFE_CRACKER_MOBILE_FIT_V6_START */') === 1, 'mobile-fit marker must appear exactly once');
assert(occurrences(css, '/* SAFE_CRACKER_MOBILE_FIT_V6_END */') === 1, 'mobile-fit end marker must appear exactly once');
assert(client.includes('const stableVisual = runtime.visualGameId === visualGameId && runtime.visualStatus === visualStatus;'), 'same-match stage changes can still restart structural animations');
assert(!client.includes('runtime.visualStatus === visualStatus && !stageChanged'), 'green stage changes still trigger a board re-entry flash');
assert(client.includes('function lockedCode(progress = {})'), 'locked-code display was removed');
assert(client.includes("choice: `safecracker:guess:${runtime.selected}`"), 'mobile polish changed authoritative guess submission');
assert(css.includes('.sc-player-card.me .sc-progress-lights'), 'player duplicate progress boxes are not removed');
assert(css.includes('.sc-player-card.opponent .sc-progress-lights'), 'opponent progress boxes are not explicitly preserved');
assert(css.includes('.sc-safe-handle {\n  display: none !important;'), 'overlapping safe handle is still visible');
assert(css.includes('linear-gradient(90deg, #20282c, #4c3a20 48%, #20282c)'), 'themed steel-and-brass confirmation button is missing');
assert(css.includes('.sc-safe-door {\n    min-height: 448px;'), 'mobile safe cabinet was not compacted');
assert(css.includes('width: min(68vw, 258px);'), 'mobile dial was not compacted');
assert(css.includes('max-height: 88px;'), 'mobile attempt log remains excessively tall');
assert(css.includes('@media (max-width: 700px) and (max-height: 820px)'), 'short-screen layout is missing');
assert(index.includes('/assets/safe-cracker/safe-cracker.css?v=8&polish=2'), 'mobile-fit stylesheet URL is not cache-busted');
assert(index.includes('/assets/safe-cracker/safe-cracker.js?v=8&polish=2'), 'mobile-fit runtime URL is not cache-busted');
assert(data.includes('// SAFE_CRACKER_DIRECT_COMPLETION_START'), 'mobile polish disturbed direct completion');
assert(turnAnimation.length > 0 && turnFire.length > 0, 'protected Roulette assets could not be read');
assert(!patch.includes('netlify/functions/_data.js'), 'mobile-fit patch must not modify server gameplay');
assert(!patch.includes('assets/roulette/turn-animation.js'), 'mobile-fit patch references protected turn animation');
assert(!patch.includes('assets/roulette/turn-fire.js'), 'mobile-fit patch references protected firing animation');

console.log('Safe Cracker mobile-fit validation passed: stage flashes are suppressed, the mobile board is shorter, player duplicate boxes and handle are removed, and the themed confirmation control is present.');
