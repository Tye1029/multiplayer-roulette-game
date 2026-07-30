import { readFile, writeFile } from 'node:fs/promises';

const dataUrl = new URL('../netlify/functions/_data.js', import.meta.url);
const actionUrl = new URL('../netlify/functions/duel-action.js', import.meta.url);

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Safe Cracker direct-completion patch could not find ${label}.`);
  return source.replace(before, after);
}

function replaceInsideFunction(source, functionMarker, before, after, label) {
  const start = source.indexOf(functionMarker);
  if (start < 0) throw new Error(`Safe Cracker direct-completion patch could not find ${label} function.`);
  const nextAsync = source.indexOf('\nasync function ', start + functionMarker.length);
  const nextPlain = source.indexOf('\nfunction ', start + functionMarker.length);
  const candidates = [nextAsync, nextPlain].filter(value => value >= 0);
  const end = candidates.length ? Math.min(...candidates) : source.length;
  const section = source.slice(start, end);
  if (section.includes(after)) return source;
  if (!section.includes(before)) throw new Error(`Safe Cracker direct-completion patch could not find ${label}.`);
  return source.slice(0, start) + section.replace(before, after) + source.slice(end);
}

function replaceSection(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0 || end <= start) throw new Error(`Safe Cracker direct-completion patch could not isolate ${label}.`);
  return source.slice(0, start) + replacement + source.slice(end);
}

let data = await readFile(dataUrl, 'utf8');

const completionBlock = String.raw`// SAFE_CRACKER_DIRECT_COMPLETION_START
async function safeCrackerComplete(game, state, winnerId = '', reason = '') {
  const gameId = mpCleanId(game?.gameId);
  let latest = null;
  try { latest = await duelGetRawStrong(gameId, 1); } catch {}
  if (!latest) {
    try { latest = await duelGetRaw(gameId); } catch {}
  }
  if (latest?.status === 'complete') return latest;

  const baseGame = latest || game;
  const incomingState = safeCrackerEnsureState({ ...baseGame, safecrackerState: state });
  const storedState = latest?.safecrackerState ? safeCrackerEnsureState(latest) : null;
  const finalBase = storedState && int(storedState.revision, 0) > int(incomingState.revision, 0) ? storedState : incomingState;
  const ids = safeCrackerPlayerIds(baseGame);
  let cleanWinner = cleanUserId(winnerId || finalBase.winnerUserId || '');
  if (!ids.includes(cleanWinner)) {
    cleanWinner = ids
      .filter(id => Boolean(finalBase.players?.[id]?.completedAt) || int(finalBase.players?.[id]?.stage, 0) >= SAFE_CRACKER_STAGES)
      .sort((a, b) => String(finalBase.players?.[a]?.completedAt || '').localeCompare(String(finalBase.players?.[b]?.completedAt || '')))[0] || '';
  }
  const tie = !cleanWinner;
  const completionAt = String(
    (cleanWinner && finalBase.players?.[cleanWinner]?.completedAt) ||
    (tie && finalBase.endAt) ||
    baseGame.completedAt ||
    nowIso()
  );
  const finalState = {
    ...finalBase,
    winnerUserId: cleanWinner,
    revision: Math.max(int(finalBase.revision, 0), int(state?.revision, 0)) + 1,
    npcActionAt: null
  };
  const summary = {
    ...safeCrackerSummary(baseGame, finalState, cleanWinner, tie, reason),
    completionAt,
    completionMode: 'direct-v7'
  };

  const completed = await duelCompleteWithResolved(
    { ...baseGame, safecrackerState: finalState, npcActionAt: null, completedAt: completionAt },
    summary
  );

  // Confirmation is useful when available, but it must never block a correct
  // third digit from returning the completed game to the player.
  try {
    const confirmed = await duelGetRawStrong(gameId, 1) || await duelGetRaw(gameId);
    if (confirmed?.status === 'complete') return confirmed;
  } catch {}
  return completed;
}
// SAFE_CRACKER_DIRECT_COMPLETION_END

`;
data = replaceSection(data, 'async function safeCrackerComplete(game, state, winnerId = \'\', reason = \'\') {', 'function safeCrackerCandidateMatches', completionBlock, 'direct Safe Cracker completion');

data = replaceInsideFunction(data, 'async function duelCompleteWithResolved(game, resolved) {', '  const at = nowIso();', '  const at = String(resolved?.completionAt || clean.completedAt || nowIso());', 'stable direct completion timestamp');
await writeFile(dataUrl, data);

let action = await readFile(actionUrl, 'utf8');
action = replaceRequired(action, 'const DUEL_FUNCTION_BUILD = "safecracker-responsive-v4";', 'const DUEL_FUNCTION_BUILD = "safecracker-direct-v7";', 'direct-completion function bundle marker');
await writeFile(actionUrl, action);

console.log('Patched Safe Cracker direct non-blocking completion and deterministic completion timestamps.');
