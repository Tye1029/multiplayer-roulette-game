import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [client, css, index, patch, data, turnAnimation, turnFire] = await Promise.all([
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/safe-cracker.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-viewport-fit.mjs', root), 'utf8'),
  readFile(new URL('netlify/functions/_data.js', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root)),
  readFile(new URL('assets/roulette/turn-fire.js', root))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker viewport-fit validation failed: ${message}`);
}

function occurrences(source, value) {
  return source.split(value).length - 1;
}

assert(occurrences(css, '/* SAFE_CRACKER_VIEWPORT_FIT_V7_START */') === 1, 'viewport-fit marker must appear exactly once');
assert(occurrences(css, '/* SAFE_CRACKER_VIEWPORT_FIT_V7_END */') === 1, 'viewport-fit end marker must appear exactly once');
assert(occurrences(client, '// SAFE_CRACKER_VIEWPORT_FIT_V7_START') === 1, 'viewport helper marker must appear exactly once');
assert(client.includes('function mountCountdownPortal(game, mount)'), 'countdown viewport portal helper is missing');
assert(client.includes("fresh.setAttribute('data-sc-countdown-portal', '');"), 'countdown is not marked as a viewport portal');
assert(client.includes('document.body.appendChild(fresh);'), 'countdown is not mounted directly under the viewport body');
assert(client.includes('mountCountdownPortal(game, mount);'), 'countdown portal helper is not called after render');
assert(client.includes("document.querySelector('body > [data-sc-start-countdown][data-sc-countdown-portal]')"), 'countdown portal is not reused across polling renders');
assert(!client.includes('scrollIntoView('), 'countdown still scrolls the full game instead of centering its own overlay');
assert(!client.includes('class="sc-attempt-panel"'), 'bottom attempt history remains in the rendered game');
assert(client.includes('function lockedCode(progress = {})'), 'locked-code display was removed');
assert(client.includes("choice: `safecracker:guess:${runtime.selected}`"), 'viewport polish changed authoritative guess submission');
assert(css.includes('grid-template-columns: minmax(0, 1fr);'), 'safe shell does not collapse to one column after history removal');
assert(css.includes('.sc-player-card.me .sc-known-code small {\n    display: none;'), 'mobile locked-code label still crowds the profile panel');
assert(css.includes('grid-template-columns: repeat(3, minmax(0, 1fr));'), 'locked-code digits are not fluid inside the player panel');
assert(css.includes('.sc-attempt-panel {\n  display: none !important;'), 'attempt panel is not defensively hidden');
assert(css.includes(".sc-start-countdown-overlay[data-sc-countdown-portal]"), 'countdown portal viewport selector is missing');
assert(css.includes('height: 100dvh !important;'), 'countdown overlay is not pinned to the viewport height');
assert(css.includes('display: grid !important;'), 'countdown portal is not using a centered viewport grid');
assert(css.includes('place-items: center !important;'), 'countdown mechanism is not centered in the viewport');
assert(css.includes('align-content: center !important;'), 'countdown vertical alignment is not centered');
assert(css.includes('body:has(.sc-start-countdown-overlay[data-sc-countdown-portal])'), 'countdown viewport scroll lock is missing');
assert(css.includes('.sc-step-controls {\n  position: relative;\n  z-index: 20;'), 'step controls are not raised above the dial');
assert(css.includes('margin: 7px 0 7px;'), 'mobile step controls do not have clear spacing below the dial');
assert(index.includes('/assets/safe-cracker/safe-cracker.css?v=8&polish=2&fit=2'), 'viewport-fit stylesheet URL is not cache-busted');
assert(index.includes('/assets/safe-cracker/safe-cracker.js?v=8&polish=2&fit=2'), 'viewport-fit runtime URL is not cache-busted');
assert(data.includes('// SAFE_CRACKER_DIRECT_COMPLETION_START'), 'viewport polish disturbed direct completion');
assert(turnAnimation.length > 0 && turnFire.length > 0, 'protected Roulette assets could not be read');
assert(!patch.includes('netlify/functions/_data.js'), 'viewport-fit patch must not modify server gameplay');
assert(!patch.includes('assets/roulette/turn-animation.js'), 'viewport-fit patch references protected turn animation');
assert(!patch.includes('assets/roulette/turn-fire.js'), 'viewport-fit patch references protected firing animation');

console.log('Safe Cracker viewport-fit validation passed: the countdown mechanism is centered in the phone viewport without scrolling the game, code digits fit, history is removed, and step controls remain clear of the dial.');