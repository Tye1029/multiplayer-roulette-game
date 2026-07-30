import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [data, action, patch, turnAnimation, turnFire] = await Promise.all([
  readFile(new URL('netlify/functions/_data.js', root), 'utf8'),
  readFile(new URL('netlify/functions/duel-action.js', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-bot-stop.mjs', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root)),
  readFile(new URL('assets/roulette/turn-fire.js', root))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker bot-stop validation failed: ${message}`);
}

function occurrences(source, value) {
  return source.split(value).length - 1;
}

function functionSection(source, marker) {
  const start = source.indexOf(marker);
  assert(start >= 0, `${marker} is missing`);
  const nextAsync = source.indexOf('\nasync function ', start + marker.length);
  const nextPlain = source.indexOf('\nfunction ', start + marker.length);
  const candidates = [nextAsync, nextPlain].filter(value => value >= 0);
  return source.slice(start, candidates.length ? Math.min(...candidates) : source.length);
}

assert(occurrences(data, '// SAFE_CRACKER_MUTATION_LOCK_V11_START') === 1, 'mutation-lock helper marker must appear exactly once');
assert(occurrences(data, '// SAFE_CRACKER_LOCKED_APPLY_V11_START') === 1, 'locked guess-writer marker must appear exactly once');
assert(occurrences(data, '// SAFE_CRACKER_POLL_FAIL_OPEN_V11_START') === 1, 'fail-open poll marker must appear exactly once');
assert(!data.includes('SAFE_CRACKER_ATOMIC_BOT_STOP_V10_START'), 'superseded metadata/ETag helper remains bundled');
assert(!data.includes('getWithMetadata('), 'Safe Cracker polling still depends on metadata reads');
assert(!data.includes('getMetadata('), 'Safe Cracker polling still depends on metadata-only reads');
assert(!data.includes('onlyIfMatch:'), 'superseded ETag compare-and-set path remains bundled');

assert(data.includes("setJSON(key, lease, { onlyIfNew: true })"), 'cross-instance mutation lock is not acquired atomically');
assert(data.includes("get(key, { type: 'json', consistency: 'strong' })"), 'mutation lock ownership is not read strongly');
assert(data.includes("if (current?.token === token) return { key, token };"), 'lock acquisition does not confirm ownership');
assert(data.includes("if (current?.token === lock.token) await getUsersStore().delete(lock.key);"), 'lock release can delete another request’s lease');
assert(data.includes('expiresAt <= Date.now()'), 'stale mutation locks cannot recover');

const apply = functionSection(data, 'async function safeCrackerApplyGuess(');
assert(apply.includes('return await safeCrackerWithMutationLock(gameId, async latest => {'), 'human and bot guesses do not share the distributed mutation lock');
assert(apply.includes("if (latest.status !== 'playing') return latest;"), 'completed-game guard is missing before guess mutation');
assert(apply.indexOf("if (latest.status !== 'playing') return latest;") < apply.indexOf('player.attempts ='), 'status guard occurs after the guess mutation');
assert(apply.includes('return await duelSaveGame(candidate);'), 'normal guesses cannot persist');
assert(apply.includes('return await safeCrackerComplete(candidate, state, id,'), 'the third digit does not complete while holding the mutation lock');
assert(apply.includes('npcActionAt: null'), 'legacy persistent NPC scheduling remains in the guess writer');

const advance = functionSection(data, 'async function safeCrackerAdvanceAndSave(');
assert(advance.includes('let latest = await duelGetRawStrong(gameId, 1) || await duelGetRaw(gameId) || game;'), 'poll advancement does not use the proven strong game read');
assert(advance.includes('const dueAt = safeCrackerBotDueAt(latest, state, npcId);'), 'bot timing is not derived without a storage write');
assert(advance.includes('return await safeCrackerApplyGuess(latest, npcId, guess,'), 'due bot actions bypass the shared mutation lock');
assert(!advance.includes('duelSaveGame('), 'ordinary polling still writes scheduling state and can race guesses');
assert(!advance.includes('safeCrackerReadVersioned'), 'ordinary polling still calls the failing versioned reader');

assert(data.includes("console.error('[safecracker] poll advancement failed without blocking the game snapshot:'"), 'poll errors can still turn the countdown GET into HTTP 500');
assert(data.includes('latest = await duelGetRawStrong(latest.gameId, 1) || await duelGetRaw(latest.gameId) || latest;'), 'poll failure does not fall back to the latest playable snapshot');
assert(action.includes('"X-Safe-Cracker-Bot-Guard": "mutation-lock-v11"'), 'live function mutation-lock header is missing');
assert(data.includes('// SAFE_CRACKER_DIRECT_COMPLETION_START'), 'immediate completion safeguard was disturbed');
assert(turnAnimation.length > 0 && turnFire.length > 0, 'protected Roulette assets could not be read');
assert(!patch.includes("writeFile(new URL('../assets/roulette/turn-animation.js'"), 'bot-stop patch writes protected Roulette turn animation');
assert(!patch.includes("writeFile(new URL('../assets/roulette/turn-fire.js'"), 'bot-stop patch writes protected Roulette firing animation');

console.log('Safe Cracker bot-stop validation passed: countdown polling is fail-open, normal guesses persist, all player and bot mutations are serialized, and completed matches cannot be overwritten.');