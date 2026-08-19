import { readFile, writeFile } from 'node:fs/promises';

const dataUrl = new URL('../netlify/functions/_data.js', import.meta.url);
const actionUrl = new URL('../netlify/functions/duel-action.js', import.meta.url);

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Safe Cracker direct-completion patch could not find ${label}.`);
  return source.replace(before, after);
}

function functionBounds(source, functionMarker, label) {
  const start = source.indexOf(functionMarker);
  if (start < 0) throw new Error(`Safe Cracker direct-completion patch could not find ${label} function.`);
  const nextAsync = source.indexOf('\nasync function ', start + functionMarker.length);
  const nextPlain = source.indexOf('\nfunction ', start + functionMarker.length);
  const candidates = [nextAsync, nextPlain].filter(value => value >= 0);
  return { start, end: candidates.length ? Math.min(...candidates) : source.length };
}

function replaceInsideFunction(source, functionMarker, before, after, label) {
  const { start, end } = functionBounds(source, functionMarker, label);
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
function safeCrackerCompletedPlayerId(game, state) {
  return safeCrackerPlayerIds(game)
    .filter(id => Boolean(state?.players?.[id]?.completedAt) || int(state?.players?.[id]?.stage, 0) >= SAFE_CRACKER_STAGES)
    .sort((a, b) => String(state?.players?.[a]?.completedAt || '').localeCompare(String(state?.players?.[b]?.completedAt || '')))[0] || '';
}

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
  if (!ids.includes(cleanWinner)) cleanWinner = safeCrackerCompletedPlayerId(baseGame, finalBase);
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
    completionMode: 'direct-v8'
  };

  // The completed object returned here is authoritative for this request. Never
  // replace it with a briefly stale playing snapshot from a follow-up read.
  return await duelCompleteWithResolved(
    { ...baseGame, safecrackerState: finalState, npcActionAt: null, completedAt: completionAt },
    summary
  );
}
// SAFE_CRACKER_DIRECT_COMPLETION_END

`;
data = replaceSection(data, 'async function safeCrackerComplete(game, state, winnerId = \'\', reason = \'\') {', 'function safeCrackerCandidateMatches', completionBlock, 'direct Safe Cracker completion');

const blockingFinish = `      const completed = await safeCrackerComplete(candidate, state, id, ((latest.creator?.userId === id ? latest.creator?.name : latest.joiner?.name) || 'A player') + ' opened the safe first.');
      const confirmedComplete = await duelGetRawStrong(gameId, 1) || await duelGetRaw(gameId) || completed;
      if (confirmedComplete?.status === 'complete') return confirmedComplete;
      fallback = confirmedComplete;
      continue;`;
const immediateFinish = `      return await safeCrackerComplete(candidate, state, id, ((latest.creator?.userId === id ? latest.creator?.name : latest.joiner?.name) || 'A player') + ' opened the safe first.');`;
data = replaceInsideFunction(data, 'async function safeCrackerApplyGuess(game, actorId, guess, actionId = \'\', isBot = false) {', blockingFinish, immediateFinish, 'immediate final-digit return');

const advanceStateLine = `    let state = safeCrackerEnsureState(latest);`;
const advanceRepair = `    let state = safeCrackerEnsureState(latest);
    const alreadyCompletedPlayerId = safeCrackerCompletedPlayerId(latest, state);
    if (alreadyCompletedPlayerId) {
      const playerName = latest.creator?.userId === alreadyCompletedPlayerId ? latest.creator?.name : latest.joiner?.name;
      return await safeCrackerComplete({ ...latest, safecrackerState: state }, state, alreadyCompletedPlayerId, (playerName || 'A player') + ' opened the safe first.');
    }`;
data = replaceInsideFunction(data, 'async function safeCrackerAdvanceAndSave(game) {', advanceStateLine, advanceRepair, 'poll-time stuck completion recovery');

const actionStateLine = `    let state = safeCrackerEnsureState(game);`;
const actionRepair = `    let state = safeCrackerEnsureState(game);
    const alreadyCompletedPlayerId = safeCrackerCompletedPlayerId(game, state);
    if (alreadyCompletedPlayerId) {
      const playerName = game.creator?.userId === alreadyCompletedPlayerId ? game.creator?.name : game.joiner?.name;
      game = await safeCrackerComplete({ ...game, safecrackerState: state }, state, alreadyCompletedPlayerId, (playerName || 'A player') + ' opened the safe first.');
      return { game: duelPublicGame(game, viewer), record: await getUserRecord(viewer), repairedCompletion: true };
    }`;
data = replaceInsideFunction(data, 'async function safeCrackerAction(user, gameId, rawChoice, details = {}) {', actionStateLine, actionRepair, 'action-time stuck completion recovery');

data = replaceInsideFunction(data, 'async function duelCompleteWithResolved(game, resolved) {', '  const at = nowIso();', '  const at = String(resolved?.completionAt || clean.completedAt || nowIso());', 'stable direct completion timestamp');
await writeFile(dataUrl, data);

let action = await readFile(actionUrl, 'utf8');
action = replaceRequired(action, 'const DUEL_FUNCTION_BUILD = "safecracker-responsive-v4";', 'const DUEL_FUNCTION_BUILD = "safecracker-direct-v8";', 'direct-completion function bundle marker');
await writeFile(actionUrl, action);

console.log('Patched Safe Cracker immediate final-digit completion and automatic recovery of stage-three games.');
