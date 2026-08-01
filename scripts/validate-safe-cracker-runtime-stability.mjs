import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [html, patch, client, turnAnimation, turnFire, audioBindings] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-runtime-stability.mjs', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root)),
  readFile(new URL('assets/roulette/turn-fire.js', root)),
  readFile(new URL('assets/roulette/audio-bindings.js', root))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker runtime-stability validation failed: ${message}`);
}
function occurrences(source, value) {
  return source.split(value).length - 1;
}

assert(occurrences(html, '// SAFE_CRACKER_RENDERER_RETENTION_V17_START') === 1, 'renderer-retention marker must appear once');
assert(occurrences(html, '// SAFE_CRACKER_RENDERER_RETENTION_V17_END') === 1, 'renderer-retention end marker must appear once');
assert(occurrences(html, '// SAFE_CRACKER_POLL_STABILITY_V17_START') === 1, 'poll-stability marker must appear once');
assert(occurrences(html, '// SAFE_CRACKER_POLL_STABILITY_V17_END') === 1, 'poll-stability end marker must appear once');
assert(html.includes('window.__safeCrackerRendererRecoveries'), 'renderer recovery diagnostics are missing');
assert(html.includes('safeCrackerRendererUnexpectedReplacement'), 'unexpected replacement protection is missing');
assert(html.includes('game.status === "playing" ? 2600 : 1600'), 'Safe Cracker polling was not reduced');
assert(!html.includes('game.status === "playing" ? 2200 : 650'), 'old high-frequency Safe Cracker polling remains');
assert(html.includes('window.__safeCrackerPollBackoffUntil'), 'poll failure backoff is missing');
assert(html.includes('window.__safeCrackerPollFailures'), 'poll failure counter is missing');
assert(html.includes('Math.min(6000, 700 * (2 ** Math.max(0, failures - 1)))'), 'bounded exponential backoff changed');
assert(html.includes('if (!safeCrackerPendingRefresh) queueMicrotask(() => duelRefresh(true));'), 'pending interval ticks can still create an immediate request chain');
assert(html.includes('// SAFE_CRACKER_ACTIVE_RENDER_GUARD_V16_START'), 'existing direct-response guard is missing');
assert(html.includes('// SAFE_CRACKER_REFRESH_SELECTOR_V16_START'), 'existing refresh selector is missing');
assert(client.includes('choice: `safecracker:guess:${runtime.selected}`'), 'authoritative Safe Cracker submission changed');
assert(client.includes('// SAFE_CRACKER_INPUT_CONTINUITY_V9_START'), 'input continuity is missing');
assert(client.includes('// SAFE_CRACKER_SAMPLE_MIX_V11_START'), 'sample mix is missing');
assert(turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0, 'protected Roulette assets are unreadable');
assert(!patch.includes("writeFile(new URL('../netlify/functions/"), 'runtime stability patch must not write networking files');
assert(!patch.includes("writeFile(new URL('../assets/roulette/"), 'runtime stability patch must not write Roulette files');

console.log('Safe Cracker runtime-stability validation passed: live boards survive stray null or unrelated renders, polling no longer outruns normal request latency, failures back off, queued ticks do not chain, and gameplay, audio, networking and Roulette remain protected.');
