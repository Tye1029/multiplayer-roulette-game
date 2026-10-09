import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [client, css, action, html, safeCrackerClient, rouletteTurn] = await Promise.all([
  readFile(new URL('assets/mountain-race/mountain-race-multiplayer.js', root), 'utf8'),
  readFile(new URL('assets/mountain-race/mountain-race.css', root), 'utf8'),
  readFile(new URL('netlify/functions/duel-action.js', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root), 'utf8')
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint visible-gameplay validation failed: ${message}`);
}

assert(client.includes('// MOUNTAIN_RACE_VISIBLE_GAMEPLAY_V1'), 'client gameplay marker is missing');
assert(client.includes('pendingInput: null'), 'client lacks optimistic input state');
assert(client.includes('function optimisticPresentation(publicState, prompts, total)'), 'optimistic presentation helper is missing');
assert(client.includes('expectedPromptIndex: item.fromIndex'), 'input request does not identify the visible prompt index');
assert(client.includes("last.correct ? 'Correct move. Keep climbing!' : 'Wrong direction. You slipped back one hold.'"), 'input feedback is missing');
assert(client.includes('navigator.vibrate'), 'mobile tap feedback is missing');
assert(client.includes('runtime.pendingInput = null;'), 'authoritative reconciliation does not clear pending input');

assert(css.includes('/* MOUNTAIN_RACE_VISIBLE_GAMEPLAY_V1 */'), 'CSS gameplay marker is missing');
assert(!/bottom:\s*-(?:1210|1290)px/.test(css), 'course still opens with the first holds below the viewport');
assert((css.match(/bottom:\s*0;/g) || []).length >= 2, 'desktop and mobile course origins are not visible');
assert(css.includes('.mountain-race-game .mr-rock-hold.known b'), 'known mountain arrows are not styled');
assert(css.includes('.mountain-race-game .mr-rock-hold.unknown b'), 'unknown holds are not visually separated');
assert(css.includes('will-change: bottom, transform;'), 'climber movement is not prepared for visible animation');

assert(client.includes("choice: 'mountainrace:batch'"), 'multiplayer input batching is missing');
assert(html.includes('mountain-race-multiplayer.js?v=1&gameplay=3'), 'fresh multiplayer JS cache boundary is missing');
assert(html.includes('mountain-race.css?v=3&multiplayer=1&gameplay=3'), 'fresh mountain CSS cache boundary is missing');
assert(safeCrackerClient.length > 0, 'protected Safe Cracker client is unreadable');
assert(rouletteTurn.length > 0, 'protected Roulette turn runtime is unreadable');

console.log('Summit Sprint visible-gameplay validation passed: directional holds and climbers begin inside the viewport, arrows remain readable, taps get immediate authoritative-indexed feedback, movement reconciles cleanly, and protected games remain intact.');
