import { readFile, writeFile } from 'node:fs/promises';

const dataUrl = new URL('../netlify/functions/_data.js', import.meta.url);
const actionUrl = new URL('../netlify/functions/duel-action.js', import.meta.url);

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Safe Cracker completion-claim patch could not find ${label}.`);
  return source.replace(before, after);
}

function replaceInsideFunction(source, functionMarker, before, after, label) {
  const start = source.indexOf(functionMarker);
  if (start < 0) throw new Error(`Safe Cracker completion-claim patch could not find ${label} function.`);
  const nextAsync = source.indexOf('\nasync function ', start + functionMarker.length);
  const nextPlain = source.indexOf('\nfunction ', start + functionMarker.length);
  const candidates = [nextAsync, nextPlain].filter(value => value >= 0);
  const end = candidates.length ? Math.min(...candidates) : source.length;
  const section = source.slice(start, end);
  if (section.includes(after)) return source;
  if (!section.includes(before)) throw new Error(`Safe Cracker completion-claim patch could not find ${label}.`);
  return source.slice(0, start) + section.replace(before, after) + source.slice(end);
}

function replaceSection(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0 || end <= start) throw new Error(`Safe Cracker completion-claim patch could not isolate ${label}.`);
  return source.slice(0, start) + replacement + source.slice(end);
}

let data = await readFile(dataUrl, 'utf8');

const completionBlock = String.raw`// SAFE_CRACKER_COMPLETION_CLAIM_START
function safeCrackerCompletionClaimKey(game, state) {
  const gameId = mpCleanId(game?.gameId);
  const roundId = String(state?.roundId || '').replace(/[^A-Za-z0-9._:-]/g, '').slice(0, 120);
  if (!gameId || !roundId) throw new Error('Safe Cracker could not identify the finishing round.');
  return \`duel-safecracker-completion/\${gameId}/\${roundId}.json\`;
}

function safeCrackerNormalizeCompletionClaim(raw, fallback) {
  const source = raw && typeof raw === 'object' ? raw : fallback;
  return {
    claimId: String(source.claimId || fallback.claimId),
    gameId: mpCleanId(source.gameId || fallback.gameId),
    roundId: String(source.roundId || fallback.roundId),
    winnerUserId: cleanUserId(source.winnerUserId || ''),
    at: String(source.at || fallback.at),
    reason: String(source.reason || fallback.reason || ''),
    state: source.state && typeof source.state === 'object' ? source.state : fallback.state
  };
}

async function safeCrackerClaimCompletion(game, state, winnerId = '', reason = '') {
  const cleanWinner = cleanUserId(winnerId);
  const claimId = safeCrackerCompletionClaimKey(game, state);
  const winnerCompletedAt = cleanWinner ? state?.players?.[cleanWinner]?.completedAt : null;
  const at = String(winnerCompletedAt || game?.completedAt || nowIso());
  const finalState = { ...state, winnerUserId: cleanWinner, revision: int(state.revision, 0) + 1, npcActionAt: null };
  const proposed = {
    schemaVersion: 1,
    claimId,
    gameId: mpCleanId(game?.gameId),
    roundId: String(state?.roundId || ''),
    winnerUserId: cleanWinner,
    at,
    reason: String(reason || ''),
    state: finalState
  };
  const store = getUsersStore();
  for (let attempt = 0; attempt < 7; attempt += 1) {
    try {
      const existing = await store.get(claimId, { type: 'json', consistency: 'strong' });
      if (existing) return { claim: safeCrackerNormalizeCompletionClaim(existing, proposed), owner: false };
    } catch {}
    try {
      const written = await store.setJSON(claimId, proposed, { onlyIfNew: true });
      if (written?.modified) return { claim: proposed, owner: true };
    } catch {}
    if (attempt < 6) await sleep(120 + attempt * 120);
  }
  throw new Error('Safe Cracker could not lock the finishing result. Please try again.');
}

async function safeCrackerWaitForClaimedCompletion(gameId, claimId) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const latest = await duelGetRawStrong(gameId, 1) || await duelGetRaw(gameId);
    if (latest?.status === 'complete' && String(latest.result?.completionClaimId || '') === String(claimId || '')) return latest;
    await sleep(180);
  }
  return null;
}

async function safeCrackerComplete(game, state, winnerId = '', reason = '') {
  const { claim, owner } = await safeCrackerClaimCompletion(game, state, winnerId, reason);
  if (!owner) {
    const completed = await safeCrackerWaitForClaimedCompletion(game.gameId, claim.claimId);
    if (completed) return completed;
  }
  const finalState = claim.state;
  const summary = {
    ...safeCrackerSummary(game, finalState, claim.winnerUserId, !claim.winnerUserId, claim.reason),
    completionAt: claim.at,
    completionClaimId: claim.claimId
  };
  return await duelCompleteWithResolved(
    { ...game, safecrackerState: finalState, npcActionAt: null, completedAt: claim.at },
    summary
  );
}
// SAFE_CRACKER_COMPLETION_CLAIM_END

`;
data = replaceSection(data, 'async function safeCrackerComplete(game, state, winnerId = \'\', reason = \'\') {', 'function safeCrackerCandidateMatches', completionBlock, 'atomic Safe Cracker completion claim');

data = replaceInsideFunction(data, 'async function duelCompleteWithResolved(game, resolved) {', '  const at = nowIso();', '  const at = String(resolved?.completionAt || clean.completedAt || nowIso());', 'stable claimed completion timestamp');
await writeFile(dataUrl, data);

let action = await readFile(actionUrl, 'utf8');
action = replaceRequired(action, 'const DUEL_FUNCTION_BUILD = "safecracker-responsive-v4";', 'const DUEL_FUNCTION_BUILD = "safecracker-storage-v5";', 'storage-consistent function bundle marker');
await writeFile(actionUrl, action);

console.log('Patched Safe Cracker atomic completion ownership and deterministic completion timestamps.');
