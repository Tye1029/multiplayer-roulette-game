import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [client, css, index, patch, data, turnAnimation, turnFire] = await Promise.all([
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/safe-cracker.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-final-polish.mjs', root), 'utf8'),
  readFile(new URL('netlify/functions/_data.js', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root)),
  readFile(new URL('assets/roulette/turn-fire.js', root))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker final-polish validation failed: ${message}`);
}

function occurrences(source, value) {
  return source.split(value).length - 1;
}

assert(occurrences(client, '// SAFE_CRACKER_FINAL_POLISH_V6_START') === 1, 'final-polish runtime marker must appear exactly once');
assert(occurrences(css, '/* SAFE_CRACKER_FINAL_POLISH_V6_START */') === 1, 'final-polish style marker must appear exactly once');
assert(occurrences(css, '/* SAFE_CRACKER_FINAL_POLISH_V6_END */') === 1, 'final-polish style end marker must appear exactly once');
assert(client.includes('function playSafeCrackerResultSequence(game, won, tied)'), 'mechanical result sound sequence is missing');
assert(client.includes("playTone(76, .12, .065, 'square', .05);"), 'first physical bolt sound is missing');
assert(client.includes("playTone(178, .28, .03, 'sawtooth', .31);"), 'safe-door movement sound is missing');
assert(client.includes('window.setTimeout(() => playResult(true, false), 480);'), 'win confirmation tone is not synchronized after the safe opens');
assert(client.includes('function revealSafeCrackerResultPortal(portal, won)'), 'accessible result reveal helper is missing');
assert(client.includes("portal.setAttribute('aria-modal', 'true');"), 'result portal is not exposed as a modal dialog');
assert(client.includes("card.setAttribute('tabindex', '-1');"), 'result card cannot receive focus');
assert(client.includes("if (event.key !== 'Escape') return;"), 'Escape-key result dismissal is missing');
assert(client.includes('const safeCrackerResultPortalObserver = new MutationObserver'), 'stale result portal cleanup observer is missing');
assert(client.includes("clearSafeCrackerResultPortal(); window.__safeCrackerBridge?.rematch?.();"), 'Rematch does not clean up the result portal first');
assert(client.includes("clearSafeCrackerResultPortal(); window.__safeCrackerBridge?.newGame?.();"), 'New Game does not clean up the result portal first');
assert(!client.includes('    playResult(won, tied);'), 'result chord still fires before the safe-opening sequence');
assert(client.includes("choice: `safecracker:guess:${runtime.selected}`"), 'final polish changed authoritative guess submission');
assert(css.includes('@keyframes scGameplaySafeFocus'), 'safe focus animation is missing');
assert(css.includes('@keyframes scGameplayGoldenReflection'), 'golden reflection animation is missing');
assert(css.includes("linear-gradient(180deg, rgba(1, 3, 4, .58), rgba(1, 3, 4, .74))"), 'win overlay is still too opaque to show the opened safe');
assert(css.includes('max-height: min(calc(100dvh - 24px), 600px);'), 'result card is not constrained for compact phones');
assert(css.includes('grid-template-columns: minmax(0, .86fr) minmax(0, 1.14fr);'), 'result actions are not compactly balanced');
assert(css.includes('@media (max-width: 360px)'), 'very-small-phone result layout is missing');
assert(css.includes('@media (max-height: 690px)'), 'short-screen result layout is missing');
assert(index.includes('/assets/safe-cracker/safe-cracker.css?v=8&polish=2&fit=2&result=1&final=1'), 'final-polish stylesheet is not cache-busted');
assert(index.includes('/assets/safe-cracker/safe-cracker.js?v=8&polish=2&fit=2&result=1&final=1'), 'final-polish runtime is not cache-busted');
assert(data.includes('// SAFE_CRACKER_DIRECT_COMPLETION_START'), 'final polish disturbed direct completion');
assert(turnAnimation.length > 0 && turnFire.length > 0, 'protected Roulette assets could not be read');
assert(!patch.includes("writeFile(new URL('../netlify/functions/_data.js'"), 'final-polish patch must not write server gameplay');
assert(!patch.includes("writeFile(new URL('../assets/roulette/turn-animation.js'"), 'final-polish patch must not write protected Roulette turn animation');
assert(!patch.includes("writeFile(new URL('../assets/roulette/turn-fire.js'"), 'final-polish patch must not write protected Roulette firing animation');

console.log('Safe Cracker final-polish validation passed: synchronized mechanical audio, opened-safe ambience, compact accessible results, and cleanup behavior are present without gameplay or Roulette changes.');
