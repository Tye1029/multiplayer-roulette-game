import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [client, css, index, patch, data, turnAnimation, turnFire] = await Promise.all([
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/safe-cracker.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-result-flow.mjs', root), 'utf8'),
  readFile(new URL('netlify/functions/_data.js', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root)),
  readFile(new URL('assets/roulette/turn-fire.js', root))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker result-flow validation failed: ${message}`);
}

function occurrences(source, value) {
  return source.split(value).length - 1;
}

function sha1(buffer) {
  return createHash('sha1').update(buffer).digest('hex');
}

assert(occurrences(client, '// SAFE_CRACKER_RESULT_FLOW_V5_START') === 1, 'result-flow runtime marker must appear exactly once');
assert(occurrences(css, '/* SAFE_CRACKER_RESULT_FLOW_V5_START */') === 1, 'result-flow style marker must appear exactly once');
assert(occurrences(css, '/* SAFE_CRACKER_RESULT_FLOW_V5_END */') === 1, 'result-flow style end marker must appear exactly once');
assert(client.includes('function mountSafeCrackerResultPortal(game, mount)'), 'result portal helper is missing');
assert(client.includes("shell.classList.add(won ? 'sc-gameplay-win' : tied ? 'sc-gameplay-tie' : 'sc-gameplay-lose');"), 'actual gameplay safe is not assigned result animation states');
assert(client.includes("shell.style.setProperty('--sc-result-animation-delay', '-' + Math.min(elapsed, 1200) + 'ms');"), 'safe-opening animation does not preserve progress across polling renders');
assert(client.includes('const revealDelay = reducedMotion ? 0 : won ? 1180 : tied ? 420 : 520;'), 'win card is not delayed until after the safe opening');
assert(client.includes("fresh.setAttribute('data-sc-result-portal', '');"), 'result overlay is not moved into a viewport portal');
assert(client.includes('mountSafeCrackerResultPortal(game, mount);'), 'result portal helper is not called after controls are bound');
assert(client.indexOf('bindControls(mount, game);') < client.indexOf('mountSafeCrackerResultPortal(game, mount);'), 'result buttons would be moved before their handlers are bound');
assert(client.includes("choice: `safecracker:guess:${runtime.selected}`"), 'result-flow pass changed authoritative guess submission');
assert(css.includes('@keyframes scGameplaySafeDoorOpen'), 'gameplay safe-opening animation is missing');
assert(css.includes('@keyframes scGameplayGoldSpill'), 'golden light-spill animation is missing');
assert(css.includes('.sc-safe-shell.sc-gameplay-win::before'), 'golden interior safe core is missing');
assert(css.includes('body > .sc-result-overlay[data-sc-result-portal]'), 'viewport result portal styling is missing');
assert(css.includes('height: 100dvh !important;'), 'result portal is not pinned to the visible viewport');
assert(css.includes('place-items: center !important;'), 'result card is not centered in the viewport');
assert(css.includes('.sc-result-vault {\n  display: none !important;'), 'obsolete miniature result safe remains visible');
assert(css.includes('max-height: calc(100dvh - 28px);'), 'result card can still create excessive vertical space');
assert(css.includes('body.sc-result-portal-open'), 'result portal background scroll lock is missing');
assert(index.includes("document.querySelector('body > .sc-result-overlay[data-sc-result-portal] .sc-result-card')"), 'shared close button does not target the portaled Safe Cracker result card');
assert(index.includes("button.closest('.sc-result-overlay[data-sc-result-portal]')?.remove();"), 'close button does not remove the Safe Cracker result portal');
assert(index.includes('/assets/safe-cracker/safe-cracker.css?v=8&polish=2&fit=2&result=1'), 'result-flow stylesheet is not cache-busted');
assert(index.includes('/assets/safe-cracker/safe-cracker.js?v=8&polish=2&fit=2&result=1'), 'result-flow runtime is not cache-busted');
assert(data.includes('// SAFE_CRACKER_DIRECT_COMPLETION_START'), 'result-flow pass disturbed direct completion');
assert(!patch.includes("writeFile(new URL('../netlify/functions/_data.js'"), 'result-flow patch must not write server gameplay');
assert(!patch.includes("writeFile(new URL('../assets/roulette/turn-animation.js'"), 'result-flow patch must not write protected Roulette turn animation');
assert(!patch.includes("writeFile(new URL('../assets/roulette/turn-fire.js'"), 'result-flow patch must not write protected Roulette firing animation');
assert(sha1(turnAnimation) === '24358e84c147d99e7297089e69ed1abd0802379f', 'protected Roulette turn animation hash changed');
assert(sha1(turnFire) === '940e824eae39ddc40dda6200f893f97fc365949b', 'protected Roulette firing animation hash changed');

console.log('Safe Cracker result-flow validation passed: the gameplay safe opens with golden light before a compact centered result portal, with server and Roulette behavior intact.');
