import { readFile, writeFile } from 'node:fs/promises';

const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const stylesUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const dataUrl = new URL('../netlify/functions/_data.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Safe Cracker feedback consistency patch could not find ${label}.`);
  return source.replace(before, after);
}

function replaceSection(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0 || end <= start) throw new Error(`Safe Cracker feedback consistency patch could not isolate ${label}.`);
  return source.slice(0, start) + replacement + source.slice(end);
}

function replaceInsideFunction(source, functionMarker, before, after, label) {
  const start = source.indexOf(functionMarker);
  if (start < 0) throw new Error(`Safe Cracker feedback consistency patch could not find ${label} function.`);
  const nextFunction = source.indexOf('\nasync function ', start + functionMarker.length);
  const end = nextFunction >= 0 ? nextFunction : source.length;
  const section = source.slice(start, end);
  if (section.includes(after)) return source;
  if (!section.includes(before)) throw new Error(`Safe Cracker feedback consistency patch could not find ${label}.`);
  return source.slice(0, start) + section.replace(before, after) + source.slice(end);
}

let client = await readFile(clientUrl, 'utf8');
client = replaceRequired(
  client,
  `    resultSoundKey: '',\n    feedbackTimer: 0`,
  `    resultSoundKey: '',\n    feedbackTimer: 0,\n    feedbackGameId: '',\n    feedbackResult: null,\n    feedbackResultAtMs: 0,\n    feedbackResultKey: '',\n    feedbackFresh: false`,
  'feedback runtime state'
);

const feedbackHelpers = `  // SAFE_CRACKER_FEEDBACK_LATCH_START
  function submittedFeedbackKey(result) {
    if (!result || typeof result !== 'object') return '';
    return [Number(result.stage || 0), Number(result.guess || 0), String(result.tier || ''), String(result.at || '')].join(':');
  }

  function adoptSubmittedFeedback(game) {
    const gameId = String(game?.gameId || '');
    if (runtime.feedbackGameId !== gameId) {
      runtime.feedbackGameId = gameId;
      runtime.feedbackResult = null;
      runtime.feedbackResultAtMs = 0;
      runtime.feedbackResultKey = '';
      runtime.feedbackFresh = false;
    }
    const candidate = game?.safecrackerState?.me?.lastResult;
    if (!candidate || !candidate.tier || !candidate.at) return false;
    const candidateAtMs = Date.parse(String(candidate.at || '')) || 0;
    const candidateKey = submittedFeedbackKey(candidate);
    if (runtime.feedbackResult) {
      if (candidateAtMs < runtime.feedbackResultAtMs) return false;
      if (candidateAtMs === runtime.feedbackResultAtMs && candidateKey === runtime.feedbackResultKey) return false;
      const currentStage = Number(runtime.feedbackResult.stage || 0);
      const candidateStage = Number(candidate.stage || 0);
      if (candidateStage < currentStage && candidateAtMs <= runtime.feedbackResultAtMs) return false;
    }
    runtime.feedbackResult = { ...candidate };
    runtime.feedbackResultAtMs = candidateAtMs;
    runtime.feedbackResultKey = candidateKey;
    runtime.feedbackFresh = true;
    return true;
  }
  // SAFE_CRACKER_FEEDBACK_LATCH_END

`;
if (!client.includes('// SAFE_CRACKER_FEEDBACK_LATCH_START')) {
  client = replaceRequired(client, '  function progressLights(progress = {}) {', `${feedbackHelpers}  function progressLights(progress = {}) {`, 'feedback helper insertion point');
}

client = replaceRequired(
  client,
  `  function render(game) {\n    runtime.game = game;\n    updateClock(game);`,
  `  function render(game) {\n    runtime.game = game;\n    adoptSubmittedFeedback(game);\n    updateClock(game);`,
  'feedback adoption during render'
);
client = replaceRequired(
  client,
  `    const latest = me.lastResult || null;\n    const canSubmit = Boolean(game.status === 'playing' && state.canSubmit && !runtime.busy && Number(me.stage || 0) < STAGES);`,
  `    const latest = runtime.feedbackResult || null;\n    const feedbackFresh = Boolean(runtime.feedbackFresh);\n    const canSubmit = Boolean(game.status === 'playing' && state.canSubmit && !runtime.busy && Number(me.stage || 0) < STAGES);`,
  'latched display result'
);
client = replaceRequired(
  client,
  `          <div class="sc-display \${escapeHtml(displayTier)}" data-sc-display><span>\${escapeHtml(displayText)}</span><small>TUMBLER \${Math.min(STAGES, Number(me.stage || 0) + 1)} OF \${STAGES}</small></div>`,
  `          <div class="sc-display \${escapeHtml(displayTier)}\${feedbackFresh ? ' fresh' : ''}" data-sc-display><span>\${escapeHtml(displayText)}</span><small>TUMBLER \${Math.min(STAGES, Number(me.stage || 0) + 1)} OF \${STAGES}</small></div>`,
  'one-time display feedback class'
);
client = replaceRequired(
  client,
  `    bindControls(mount, game);\n    updateTimerOnly();`,
  `    runtime.feedbackFresh = false;\n    bindControls(mount, game);\n    updateTimerOnly();`,
  'feedback animation consumption'
);
client = replaceRequired(
  client,
  `      const nextGame = data?.game || runtime.game;\n      const result = nextGame?.safecrackerState?.me?.lastResult;\n      if (result?.at && result.at !== myState(game)?.lastResult?.at) playFeedback(result.tier);\n      runtime.busy = false;`,
  `      const nextGame = data?.game || runtime.game;\n      const resultChanged = adoptSubmittedFeedback(nextGame);\n      const result = runtime.feedbackResult;\n      if (resultChanged && result?.tier) playFeedback(result.tier);\n      runtime.busy = false;`,
  'submitted feedback sound latch'
);
await writeFile(clientUrl, client);

let styles = await readFile(stylesUrl, 'utf8');
styles = replaceRequired(
  styles,
  `.sc-display.green { color: var(--sc-green); background: #04160b; box-shadow: inset 0 0 22px rgba(82,255,142,.38), 0 0 17px rgba(82,255,142,.34); animation: scGreenConfirm .42s ease; }`,
  `.sc-display.green { color: var(--sc-green); background: #04160b; box-shadow: inset 0 0 22px rgba(82,255,142,.38), 0 0 17px rgba(82,255,142,.34); }\n.sc-display.green.fresh { animation: scGreenConfirm .42s ease; }`,
  'one-time green confirmation animation'
);
await writeFile(stylesUrl, styles);

let data = await readFile(dataUrl, 'utf8');
const verifiedApply = String.raw`async function safeCrackerApplyGuess(game, actorId, guess, actionId = '', isBot = false) {
  // SAFE_CRACKER_VERIFIED_APPLY_START
  const id = cleanUserId(actorId);
  const gameId = mpCleanId(game?.gameId);
  const cleanActionId = String(actionId || '').replace(/[^A-Za-z0-9._:-]/g, '').slice(0, 120);
  if (!id || !gameId) throw new Error('Safe Cracker could not identify that action.');
  let fallback = game;
  for (let writeAttempt = 0; writeAttempt < 4; writeAttempt += 1) {
    let latest = await duelGetRawStrong(gameId, 2) || fallback;
    if (!latest) throw new Error('That Safe Cracker duel was not found.');
    if (latest.mode !== 'safecracker') throw new Error('That duel is not Safe Cracker.');
    if (latest.status !== 'playing') return latest;
    let state = safeCrackerEnsureState(latest);
    if (cleanActionId && state.processedActionIds.includes(cleanActionId)) return latest;
    const player = { ...(state.players?.[id] || {}) };
    if (!player.code) throw new Error('Safe Cracker could not find that player safe.');
    if (int(player.stage, 0) >= SAFE_CRACKER_STAGES) return latest;
    const now = Date.now();
    const nextGuessMs = Date.parse(player.nextGuessAt || '');
    if (!isBot && Number.isFinite(nextGuessMs) && now < nextGuessMs) return latest;
    const stage = int(player.stage, 0);
    const target = int(String(player.code)[stage], 0);
    const distance = safeCrackerCircularDistance(target, guess);
    const tier = safeCrackerTier(distance);
    const correct = tier === 'green';
    const at = new Date(now).toISOString();
    const result = { stage, guess, distance, tier, correct, at };
    player.attempts = [...(Array.isArray(player.attempts) ? player.attempts : []), result].slice(-80);
    player.lastResult = result;
    player.stage = correct ? Math.min(SAFE_CRACKER_STAGES, stage + 1) : stage;
    player.nextGuessAt = new Date(now + SAFE_CRACKER_VERIFY_MS).toISOString();
    if (player.stage >= SAFE_CRACKER_STAGES) player.completedAt = at;
    const baseStateRevision = int(state.revision, 0);
    const processed = cleanActionId ? [...(state.processedActionIds || []), cleanActionId].slice(-80) : (state.processedActionIds || []);
    state = {
      ...state,
      revision: baseStateRevision + 1,
      players: { ...(state.players || {}), [id]: player },
      processedActionIds: processed,
      npcActionAt: isBot && player.stage < SAFE_CRACKER_STAGES ? new Date(now + safeCrackerBotDelay(latest)).toISOString() : state.npcActionAt
    };
    const candidate = { ...latest, safecrackerState: state };
    const beforeSave = await duelGetRawStrong(gameId, 1);
    if (beforeSave) {
      if (beforeSave.status !== 'playing') return beforeSave;
      const beforeState = safeCrackerEnsureState(beforeSave);
      if (cleanActionId && beforeState.processedActionIds.includes(cleanActionId)) return beforeSave;
      if (int(beforeState.revision, 0) > baseStateRevision || int(beforeSave.revision, 0) > int(latest.revision, 0)) {
        fallback = beforeSave;
        continue;
      }
    }
    if (player.stage >= SAFE_CRACKER_STAGES) {
      const completed = await safeCrackerComplete(candidate, state, id, ((latest.creator?.userId === id ? latest.creator?.name : latest.joiner?.name) || 'A player') + ' opened the safe first.');
      const confirmedComplete = await duelGetRawStrong(gameId, 2) || completed;
      if (confirmedComplete?.status === 'complete') return confirmedComplete;
      fallback = confirmedComplete;
      continue;
    }
    const saved = await duelSaveGame(candidate);
    const confirmed = await duelGetRawStrong(gameId, 2) || saved;
    const confirmedState = safeCrackerEnsureState(confirmed);
    const kept = cleanActionId
      ? confirmedState.processedActionIds.includes(cleanActionId)
      : String(confirmedState.players?.[id]?.lastResult?.at || '') === at;
    if (kept) return confirmed;
    fallback = confirmed;
  }
  return await duelGetRawStrong(gameId, 2) || fallback;
  // SAFE_CRACKER_VERIFIED_APPLY_END
}

`;
data = replaceSection(data, 'async function safeCrackerApplyGuess(game, actorId, guess, actionId = \'\', isBot = false) {', 'async function safeCrackerAdvanceAndSave(game) {', verifiedApply, 'verified Safe Cracker guess writer');
data = replaceInsideFunction(data, 'async function safeCrackerAdvanceAndSave(game) {', 'let latest = await duelGetRaw(gameId);', 'let latest = await duelGetRawStrong(gameId, 2);', 'strong Safe Cracker advancement read');
data = replaceInsideFunction(data, 'async function safeCrackerAction(user, gameId, rawChoice, details = {}) {', 'let game = await duelGetRaw(gameId);', 'let game = await duelGetRawStrong(gameId, 2);', 'strong Safe Cracker action read');
data = replaceInsideFunction(data, 'async function safeCrackerAdvanceAndSave(game) {', 'state = { ...state, npcActionAt: null };', 'state = { ...state, revision: int(state.revision, 0) + 1, npcActionAt: null };', 'versioned NPC schedule clearing');
data = replaceInsideFunction(data, 'async function safeCrackerAdvanceAndSave(game) {', `state = { ...state, npcActionAt: new Date(Date.now() + safeCrackerBotDelay(latest)).toISOString() };`, `state = { ...state, revision: int(state.revision, 0) + 1, npcActionAt: new Date(Date.now() + safeCrackerBotDelay(latest)).toISOString() };`, 'versioned NPC scheduling');
await writeFile(dataUrl, data);

let html = await readFile(indexUrl, 'utf8');
const rnbSnapshotBlock = `  function rnbStateRevision(game){
   const state=game?.rouletteState||game?.drawState||game?.fishingState||game?.safecrackerState||{};
   return Number(state?.revision??-1);
  }
  function rnbLifecycleRank(game){
   const ranks={waiting:0,ready:1,countdown:2,playing:3,complete:4,cancelled:4};
   return Number(ranks[String(game?.status||'waiting')]??0);
  }
  function rnbSnapshotStamp(game){return {statusRank:rnbLifecycleRank(game),gameRevision:Number(game?.revision??-1),stateRevision:rnbStateRevision(game),updatedAt:Date.parse(String(game?.updatedAt||''))||0}}
  function rnbCompareSnapshots(left,right){
   const a=rnbSnapshotStamp(left),b=rnbSnapshotStamp(right);
   if(a.statusRank!==b.statusRank)return a.statusRank-b.statusRank;
   if(a.gameRevision!==b.gameRevision)return a.gameRevision-b.gameRevision;
   if(a.stateRevision!==b.stateRevision)return a.stateRevision-b.stateRevision;
   return a.updatedAt-b.updatedAt;
  }
`;
html = replaceSection(html, '  function rnbStateRevision(game){', '  function rnbCurrentGame(gameId){', rnbSnapshotBlock, 'Remote Bot Safe Cracker snapshot comparison');
html = replaceRequired(
  html,
  `   const current=rnbCurrentGame(game.gameId);\n   if(current&&rnbCompareSnapshots(game,current)<0){`,
  `   const current=rnbCurrentGame(game.gameId);\n   if(game.mode==='safecracker'&&typeof window.__safeCrackerAcceptSnapshot==='function'&&!window.__safeCrackerAcceptSnapshot(game)){\n    line(botLogs,'ignored rejected Safe Cracker snapshot',{gameId:String(game.gameId),incoming:rnbSnapshotStamp(game)});\n    return current;\n   }\n   if(current&&rnbCompareSnapshots(game,current)<0){`,
  'Remote Bot Safe Cracker acceptance guard'
);
html = html.replaceAll('/assets/safe-cracker/safe-cracker.css?v=1', '/assets/safe-cracker/safe-cracker.css?v=2');
html = html.replaceAll('/assets/safe-cracker/safe-cracker.js?v=1', '/assets/safe-cracker/safe-cracker.js?v=2');
await writeFile(indexUrl, html);

console.log('Patched Safe Cracker display feedback latching, one-time feedback animation, lifecycle-aware Remote Bot snapshots, and verified concurrent writes.');
