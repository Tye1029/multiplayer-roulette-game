import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [client, html, patch, turnAnimation, turnFire, audioBindings] = await Promise.all([
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-render-stability.mjs', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root)),
  readFile(new URL('assets/roulette/turn-fire.js', root)),
  readFile(new URL('assets/roulette/audio-bindings.js', root))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker render-stability validation failed: ${message}`);
}

function occurrences(source, fragment) {
  return source.split(fragment).length - 1;
}

const start = '// SAFE_CRACKER_RENDER_STABILITY_V1_START';
const end = '// SAFE_CRACKER_RENDER_STABILITY_V1_END';
assert(occurrences(client, start) === 1, 'runtime start marker must appear exactly once');
assert(occurrences(client, end) === 1, 'runtime end marker must appear exactly once');

for (const fragment of [
  'function safeCrackerUpdateMountedBoard(game)',
  "mountedGameId !== gameId || status !== 'playing' || mountedStatus !== 'playing'",
  "root.classList.add('sc-stable-render')",
  "root.querySelector('[data-sc-display]')",
  "root.querySelectorAll('.sc-bolts.right .sc-latch-mount > i')",
  "root.querySelector('.sc-attempt-panel')",
  'applyDialVisual();',
  'safeCrackerUpdateConfirmControl();',
  'const reusedMountedBoard = safeCrackerUpdateMountedBoard(game);',
  'if (!reusedMountedBoard) {',
  'choice: `safecracker:guess:${runtime.selected}`'
]) {
  assert(client.includes(fragment), `missing generated runtime fragment: ${fragment}`);
}

assert(occurrences(client, 'mount.innerHTML = `') === 1, 'the board template should have one guarded full-render assignment');
const guardIndex = client.indexOf('if (!reusedMountedBoard) {');
const innerHtmlIndex = client.indexOf('mount.innerHTML = `');
const bindIndex = client.indexOf('bindControls(mount, game);', innerHtmlIndex);
const guardCloseIndex = client.indexOf('    }\n    runtime.feedbackFresh = false;', bindIndex);
assert(guardIndex >= 0 && innerHtmlIndex > guardIndex, 'full board replacement is not guarded by reuse detection');
assert(bindIndex > innerHtmlIndex && guardCloseIndex > bindIndex, 'event controls are not bound only after a full render');
assert(!client.includes('runtime.busy = true;\n    render(game);'), 'submit still forces a pre-request board rebuild');
assert(client.includes("-webkit-tap-highlight-color: transparent") || patch.includes('same-game playing updates'), 'button-flash suppression boundary is missing');

assert(/safe-cracker\.css\?[^"'\s]*&render=1/.test(html), 'stylesheet cache key render=1 is missing');
assert(/safe-cracker\.js\?[^"'\s]*&render=1/.test(html), 'runtime cache key render=1 is missing');

assert(!patch.includes("writeFile(new URL('../netlify/functions/"), 'render-stability patch writes networking files');
assert(!patch.includes("writeFile(new URL('../assets/roulette/"), 'render-stability patch writes Roulette files');
assert(turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0, 'protected Roulette assets are unreadable');

console.log('Safe Cracker render-stability validation passed: same-game playing updates reuse the mounted board, preserve the decoded dial and display layers, update feedback and latches in place, retain authoritative submissions, and leave Roulette/networking untouched.');
