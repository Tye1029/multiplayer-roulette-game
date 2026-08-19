import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [client, css, index, patch] = await Promise.all([
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/safe-cracker.css', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-visual-stability.mjs', root), 'utf8')
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker visual-stability validation failed: ${message}`);
}

function occurrences(source, value) {
  return source.split(value).length - 1;
}

assert(occurrences(css, '/* SAFE_CRACKER_VISUAL_STABILITY_V5_START */') === 1, 'visual-stability marker must appear exactly once');
assert(occurrences(css, '/* SAFE_CRACKER_VISUAL_STABILITY_V5_END */') === 1, 'visual-stability end marker must appear exactly once');
assert(occurrences(client, '// SAFE_CRACKER_VISUAL_STABILITY_V5_START') === 1, 'visual-stability renderer marker must appear exactly once');
assert(client.includes('function lockedCode(progress = {})'), 'locked-code renderer is missing');
assert(client.includes('lockedCode(me)'), 'top-left player panel does not show locked digits');
assert(client.includes("const stableVisual = runtime.visualGameId === visualGameId"), 'same-board visual stability classification is missing');
assert(client.includes("sc-stable-render"), 'stable renders are not marked');
assert(client.includes("confirmButton.classList.add('busy')"), 'submit button does not update in place');
assert(!client.includes('runtime.busy = true;\n    render(game);'), 'submitting still rebuilds the entire board before the request');
assert(client.includes("choice: `safecracker:guess:${runtime.selected}`"), 'visual polish changed authoritative guess submission');
assert(css.includes("radial-gradient(ellipse at 50% 2%, rgba(255, 202, 119, .34)"), 'visible warm ambient background is missing');
assert(css.includes('.safe-cracker-game::before,\n.safe-cracker-game::after {\n  z-index: 0;'), 'background layers remain hidden behind the game surface');
assert(css.includes('.sc-known-code span.known'), 'locked digit styling is missing');
assert(css.includes('-webkit-tap-highlight-color: transparent'), 'mobile button tap flash suppression is missing');
assert(css.includes(".safe-cracker-game.sc-stable-render[data-sc-status='playing']"), 'repeated playing renders do not suppress structural entrance animations');
assert(css.includes(".safe-cracker-game.sc-stable-render[data-sc-status='complete'] .sc-result-content"), 'completed result rerenders do not preserve their final visual state');
assert(index.includes('/assets/safe-cracker/safe-cracker.css?v=8&polish=2'), 'polished stylesheet URL is not carried into mobile-fit pass');
assert(index.includes('/assets/safe-cracker/safe-cracker.js?v=8&polish=2'), 'polished runtime URL is not carried into mobile-fit pass');
assert(!patch.includes('assets/roulette/turn-animation.js'), 'visual stability patch references the protected turn animation');
assert(!patch.includes('assets/roulette/turn-fire.js'), 'visual stability patch references the protected firing animation');
assert(!patch.includes('netlify/functions/_data.js'), 'visual stability patch must not modify server gameplay logic');

console.log('Safe Cracker visual-stability validation passed: button flashes remain suppressed, warm ambience and locked digits remain visible, and mobile-fit cache busting is current.');
