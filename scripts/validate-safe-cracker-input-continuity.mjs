import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [client, html, data, patch, turnAnimation, turnFire] = await Promise.all([
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('netlify/functions/_data.js', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-input-continuity.mjs', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root)),
  readFile(new URL('assets/roulette/turn-fire.js', root))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker input-continuity validation failed: ${message}`);
}

function occurrences(source, value) {
  return source.split(value).length - 1;
}

assert(occurrences(client, '// SAFE_CRACKER_INPUT_CONTINUITY_V9_START') === 1, 'input-continuity marker must appear exactly once');
assert(client.includes('function safeCrackerCanSubmit(game = runtime.game)'), 'local submission availability helper is missing');
assert(client.includes('function safeCrackerArmLocalCooldown(game, cooldownMs)'), 'local cooldown scheduler is missing');
assert(client.includes('runtime.cooldownUntilMs = Date.now() + remaining + 90;'), 'cooldown does not release from an explicit local deadline');
assert(client.includes('safeCrackerUpdateConfirmControl();'), 'cooldown expiry does not update the existing Check Number control');
assert(client.includes('window.__safeCrackerBridge?.refresh?.();'), 'cooldown expiry does not refresh opponent progress in the background');
assert(client.includes('const canSubmit = safeCrackerCanSubmit(game);'), 'render still depends only on stale server canSubmit state');
assert(client.includes('const cooldownActive = safeCrackerCooldownActive(game);'), 'RESETTING label still depends only on a network snapshot');
assert(client.includes('if (!bridge?.submit || runtime.busy || !safeCrackerCanSubmit(activeGame)) return;'), 'submission gate ignores the locally completed cooldown');
assert(!client.includes("if (cooldown > 0) window.setTimeout(() => window.__safeCrackerBridge?.refresh?.(), cooldown + 30);"), 'old network-dependent cooldown release remains active');

assert(client.includes('if (runtime.dragging) {\n      runtime.pendingDragGame = game;'), 'polling can still rebuild the dial during an active drag');
assert(client.includes('const pendingGame = runtime.pendingDragGame;'), 'queued snapshots are not released after the drag');
assert(client.includes('if (pendingGame) render(pendingGame);'), 'latest queued game is not rendered after pointer release');
assert(client.includes('runtime.rotation = nearestRotationForDigit(runtime.selected, runtime.rotation);'), 'physical detent settling was disturbed');

assert(html.includes('/assets/safe-cracker/safe-cracker.js?v=8&polish=2&fit=2&result=1&final=1&refine=1&correct=1&input=1'), 'input-continuity JavaScript cache bust is missing');
assert(html.includes('/assets/safe-cracker/safe-cracker.css?v=8&polish=2&fit=2&result=1&final=1&refine=1&correct=1&input=1'), 'input-continuity stylesheet cache bust is missing');

assert(data.includes('// SAFE_CRACKER_VERIFIED_APPLY_START'), 'last known-working verified guess writer was not preserved');
assert(!data.includes('SAFE_CRACKER_MUTATION_LOCK_V11_START'), 'failed mutation-lock experiment returned');
assert(!data.includes('SAFE_CRACKER_ATOMIC_BOT_STOP_V10_START'), 'failed metadata/ETag experiment returned');
assert(!data.includes('getWithMetadata('), 'Safe Cracker gameplay depends on the metadata API again');
assert(turnAnimation.length > 0 && turnFire.length > 0, 'protected Roulette assets could not be read');
assert(!patch.includes("writeFile(new URL('../assets/roulette/turn-animation.js'"), 'input patch writes protected Roulette turn animation');
assert(!patch.includes("writeFile(new URL('../assets/roulette/turn-fire.js'"), 'input patch writes protected Roulette firing animation');

console.log('Safe Cracker input-continuity validation passed: local cooldown timing cannot be held by a slow poll, active dial drags cannot be rebuilt, working gameplay storage remains restored, and Roulette assets remain protected.');
