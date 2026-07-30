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

assert(occurrences(data, '// SAFE_CRACKER_ATOMIC_BOT_STOP_V9_START') === 1, 'atomic bot-stop helper marker must appear exactly once');
assert(occurrences(data, '// SAFE_CRACKER_ATOMIC_APPLY_V9_START') === 1, 'atomic guess-writer marker must appear exactly once');
assert(data.includes("getWithMetadata(duelGameKey(id), { consistency: 'strong', type: 'json' })"), 'strong versioned game read is missing');
assert(data.includes("setJSON(duelGameKey(gameId), clean, { onlyIfMatch: expectedEtag })"), 'ETag compare-and-set write is missing');
assert(data.includes("if (latest.status !== 'playing') return latest;"), 'completed-game guard is missing before guess mutation');
assert(data.includes("if (!saved.modified)"), 'CAS conflict handling is missing');
assert(data.includes("if (saved.game?.status !== 'playing') return saved.game;"), 'CAS conflict does not immediately return the completed authoritative game');

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

assert(action.includes('"X-Safe-Cracker-Bot-Guard": "atomic-cas-v9"'), 'live function bot-guard header is missing');
assert(data.includes('// SAFE_CRACKER_DIRECT_COMPLETION_START'), 'immediate completion safeguard was disturbed');
assert(data.includes('npcActionAt: null'), 'completed games do not clear the NPC schedule');
assert(turnAnimation.length > 0 && turnFire.length > 0, 'protected Roulette assets could not be read');
assert(!patch.includes("writeFile(new URL('../assets/roulette/turn-animation.js'"), 'bot-stop patch writes protected Roulette turn animation');
assert(!patch.includes("writeFile(new URL('../assets/roulette/turn-fire.js'"), 'bot-stop patch writes protected Roulette firing animation');

console.log('Safe Cracker bot-stop validation passed: player and bot guesses plus NPC schedule writes are ETag-atomic, and a completed match cannot be overwritten by a late bot request.');
