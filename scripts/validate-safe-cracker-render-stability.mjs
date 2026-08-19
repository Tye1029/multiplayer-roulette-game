import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [client, data, action, html, patch, turnAnimation, turnFire, audioBindings] = await Promise.all([
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('netlify/functions/_data.js', root), 'utf8'),
  readFile(new URL('netlify/functions/duel-action.js', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-render-stability.mjs', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root)),
  readFile(new URL('assets/roulette/turn-fire.js', root)),
  readFile(new URL('assets/roulette/audio-bindings.js', root))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker render/feedback validation failed: ${message}`);
}

function occurrences(source, fragment) {
  return source.split(fragment).length - 1;
}

function section(source, startMarker, endMarker, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert(start >= 0 && end > start, `could not isolate ${label}`);
  return source.slice(start, end);
}

const renderStart = '// SAFE_CRACKER_RENDER_STABILITY_V1_START';
const renderEnd = '// SAFE_CRACKER_RENDER_STABILITY_V1_END';
assert(occurrences(client, renderStart) === 1, 'runtime start marker must appear exactly once');
assert(occurrences(client, renderEnd) === 1, 'runtime end marker must appear exactly once');

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
  'if (!reusedMountedBoard) mount.innerHTML = `',
  'if (!reusedMountedBoard) bindControls(mount, game);',
  'choice: `safecracker:guess:${runtime.selected}`'
]) {
  assert(client.includes(fragment), `missing generated runtime fragment: ${fragment}`);
}

assert(occurrences(client, 'mount.innerHTML = `') === 1, 'the board template should have one guarded full-render assignment');
const reuseIndex = client.indexOf('const reusedMountedBoard = safeCrackerUpdateMountedBoard(game);');
const guardedInnerHtmlIndex = client.indexOf('if (!reusedMountedBoard) mount.innerHTML = `', reuseIndex);
const guardedBindIndex = client.indexOf('if (!reusedMountedBoard) bindControls(mount, game);', guardedInnerHtmlIndex);
assert(reuseIndex >= 0 && guardedInnerHtmlIndex > reuseIndex, 'full board replacement is not guarded by reuse detection');
assert(guardedBindIndex > guardedInnerHtmlIndex, 'event controls are not bound only after a full render');
assert(!client.includes('runtime.busy = true;\n    render(game);'), 'submit still forces a pre-request board rebuild');

const latencyStart = '// SAFE_CRACKER_FEEDBACK_LATENCY_V1_START';
const latencyEnd = '// SAFE_CRACKER_FEEDBACK_LATENCY_V1_END';
assert(occurrences(data, latencyStart) === 1, 'feedback-latency start marker must appear exactly once');
assert(occurrences(data, latencyEnd) === 1, 'feedback-latency end marker must appear exactly once');
assert(data.includes('const SAFE_CRACKER_VERIFY_MS = 650;'), 'the accepted server-confirmed verification window changed');

const apply = section(
  data,
  "async function safeCrackerApplyGuess(game, actorId, guess, actionId = '', isBot = false) {",
  'async function safeCrackerAdvanceAndSave(game) {',
  'fast guess writer'
);
assert(apply.includes('const latest = writeAttempt === 0 && fallback'), 'first guess attempt does not reuse the already-authoritative snapshot');
assert(apply.includes('const beforeSave = await duelGetRawStrong(gameId, 1) || await duelGetRaw(gameId);'), 'pre-save winner/revision guard is missing');
assert(apply.includes('const confirmed = await duelGetRawStrong(gameId, 1) || await duelGetRaw(gameId) || saved;'), 'post-save authoritative confirmation is missing');
assert(apply.includes('return await safeCrackerComplete(candidate, state, id,'), 'winning guess no longer uses immediate authoritative completion');
assert(!apply.includes('let latest = await duelGetRawStrong(gameId, 2)'), 'the redundant first strong read remains');
assert(!apply.includes('duelGetRawStrong(gameId, 2)'), 'two-attempt reads remain inside the normal feedback path');

const advance = section(
  data,
  'async function safeCrackerAdvanceAndSave(game) {',
  'async function safeCrackerAction(user, gameId, rawChoice, details = {}) {',
  'nonblocking poll advancement'
);
const observedIndex = advance.indexOf('const observed = await duelGetRawStrong(gameId, 1)');
const needsMutationIndex = advance.indexOf('const needsMutation =');
const lockIndex = advance.indexOf('return await withSafeCrackerLock(gameId');
assert(observedIndex >= 0 && needsMutationIndex > observedIndex && lockIndex > needsMutationIndex, 'polls still enter the mutation lock before determining that work is due');
assert(advance.includes('if (!needsMutation) return observed;'), 'ordinary polling does not bypass the mutation lock');
assert(advance.includes('safeCrackerCompletedPlayerId(observed, observedState)'), 'stuck-completion recovery was not preserved in the poll preflight');

const actionSection = section(data, 'async function safeCrackerAction(user, gameId, rawChoice, details = {}) {', latencyEnd, 'fast action response');
assert(actionSection.includes("feedbackPath: 'fast-authoritative-v1'"), 'action responses do not identify the fast authoritative path');
assert(actionSection.includes('feedbackServerMs: Date.now() - actionStartedAt'), 'server-side feedback timing is not reported');
assert(actionSection.includes('skipBalanceLookup: true'), 'non-final guesses still require an unchanged balance read');
assert(actionSection.includes("if (game.status === 'complete') response.record = await getUserRecord(viewer);"), 'completion no longer refreshes the payout balance');
assert(actionSection.includes('safeCrackerCompletedPlayerId(game, state)'), 'action-time stuck-completion recovery was not preserved');

assert(action.includes('const DUEL_FUNCTION_BUILD = "safecracker-feedback-fast-v10";'), 'function build marker was not advanced');
assert(action.includes('"X-Safe-Cracker-Feedback": "fast-authoritative-v1"'), 'live feedback-path response header is missing');
assert(action.includes('result?.databaseAuthoritative || result?.skipBalanceLookup'), 'duel endpoint still performs the redundant balance read');

assert(/safe-cracker\.css\?[^"'\s]*&render=1/.test(html), 'stylesheet cache key render=1 is missing');
assert(/safe-cracker\.js\?[^"'\s]*&render=1/.test(html), 'runtime cache key render=1 is missing');

assert(!patch.includes("writeFile(new URL('../assets/roulette/"), 'render/feedback patch writes Roulette files');
assert(turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0, 'protected Roulette assets are unreadable');

console.log('Safe Cracker render/feedback validation passed: same-game updates reuse the mounted board, normal polling stays out of the guess lock, the first verified write reuses its strong snapshot, active guesses skip unchanged balance reads, completion remains authoritative, and Roulette is untouched.');
