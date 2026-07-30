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

assert(occurrences(data, '// SAFE_CRACKER_ATOMIC_BOT_STOP_V10_START') === 1, 'atomic bot-stop v10 helper marker must appear exactly once');
assert(occurrences(data, '// SAFE_CRACKER_ATOMIC_APPLY_V10_START') === 1, 'atomic guess-writer v10 marker must appear exactly once');
assert(data.includes("getWithMetadata(key, { consistency: 'strong', type: 'text' })"), 'combined versioned read does not use a strong text payload');
assert(data.includes("const before = await store.getMetadata(key, { consistency: 'strong' });"), 'metadata/data compatibility read is missing its first ETag');
assert(data.includes("const raw = await store.get(key, { consistency: 'strong', type: 'text' });"), 'metadata/data compatibility read is missing its strong payload');
assert(data.includes("const after = await store.getMetadata(key, { consistency: 'strong' });"), 'metadata/data compatibility read is missing its second ETag');
assert(data.includes('beforeEtag && beforeEtag === afterEtag'), 'compatibility read can combine data with a mismatched ETag');
assert(data.includes("throw new Error('Safe Cracker could not obtain a versioned game record'"), 'versioned read failures are still silently converted into unchanged games');
assert(data.includes("setJSON(duelGameKey(gameId), clean, { onlyIfMatch: expectedEtag })"), 'ETag compare-and-set write is missing');
assert(data.includes('if (result?.modified === false)'), 'explicit CAS conflict handling is missing');
assert(data.includes('if (result?.modified !== true)'), 'clients with a void conditional-set result are not verified after writing');
assert(data.includes('confirmedStateRevision >= targetStateRevision'), 'uncertain conditional writes are not confirmed against the target state revision');
assert(data.includes("if (latest.status !== 'playing') return latest;"), 'completed-game guard is missing before guess mutation');
assert(!data.includes('if (!versioned.etag) return latest;'), 'missing ETags still produce fake successful guesses');
assert(data.includes("throw new Error('Safe Cracker could not obtain the storage version required to submit that number.')"), 'missing action ETags do not surface an explicit error');
assert(data.includes("throw new Error('Safe Cracker could not save that number after repeated concurrent updates. Please try it again.')"), 'exhausted CAS retries still return an unchanged 200 response');
assert(data.includes(': (state.npcActionAt || latest.npcActionAt || null)'), 'human guesses erase the pending bot schedule');

const apply = functionSection(data, 'async function safeCrackerApplyGuess(');
assert(apply.includes('const versioned = await safeCrackerReadVersioned(gameId);'), 'guess writer does not begin from a strong versioned read');
assert(apply.includes('const saved = await safeCrackerSaveVersioned(candidate, versioned.etag);'), 'guess writer does not use the atomic save helper');
assert(!apply.includes('duelSaveGame('), 'guess writer still contains an unconditional last-write-wins save');
assert(apply.indexOf("if (latest.status !== 'playing') return latest;") < apply.indexOf('player.attempts ='), 'status guard occurs after the guess mutation');

const advance = functionSection(data, 'async function safeCrackerAdvanceAndSave(');
assert(advance.includes('const versioned = await safeCrackerReadVersioned(gameId);'), 'bot advancement does not use a strong versioned read');
assert(advance.includes('const expectedEtag = versioned.etag;'), 'bot advancement does not retain the read ETag');
assert(advance.includes('safeCrackerSaveVersioned({ ...latest, safecrackerState: state, npcActionAt: null }, expectedEtag)'), 'bot schedule clearing is not atomic');
assert(advance.includes('safeCrackerSaveVersioned({ ...latest, safecrackerState: state, npcActionAt: state.npcActionAt }, expectedEtag)'), 'bot scheduling is not atomic');
assert(!advance.includes('duelSaveGame('), 'bot advancement still contains an unconditional last-write-wins save');
assert(advance.includes("if (!latest || latest.status !== 'playing' || latest.mode !== 'safecracker') return latest || game;"), 'bot advancement can continue from a non-playing game');

assert(action.includes('"X-Safe-Cracker-Bot-Guard": "atomic-cas-v10"'), 'live function bot-guard v10 header is missing');
assert(data.includes('// SAFE_CRACKER_DIRECT_COMPLETION_START'), 'immediate completion safeguard was disturbed');
assert(data.includes('npcActionAt: null'), 'completed games do not clear the NPC schedule');
assert(turnAnimation.length > 0 && turnFire.length > 0, 'protected Roulette assets could not be read');
assert(!patch.includes("writeFile(new URL('../assets/roulette/turn-animation.js'"), 'bot-stop patch writes protected Roulette turn animation');
assert(!patch.includes("writeFile(new URL('../assets/roulette/turn-fire.js'"), 'bot-stop patch writes protected Roulette firing animation');

console.log('Safe Cracker bot-stop validation passed: normal guesses persist through compatible versioned reads, storage failures are explicit, bot writes remain ETag-atomic, and completion cannot be overwritten.');