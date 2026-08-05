import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const clientUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const indexUrl = new URL('index.html', root);
const clientMarker = '// MOUNTAIN_RACE_STATE_SYNC_V1';
const htmlMarker = '<!-- MOUNTAIN_RACE_STATE_SYNC_V1 -->';

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint state-sync patch could not find ${label}.`);
  return source.replace(before, after);
}

let client = await readFile(clientUrl, 'utf8');

if (!client.includes(clientMarker)) {
  client = replaceRequired(
    client,
    '  // MOUNTAIN_RACE_LOAD_PERFORMANCE_V1',
    `  // MOUNTAIN_RACE_LOAD_PERFORMANCE_V1\n  ${clientMarker}`,
    'client state-sync marker'
  );

  client = replaceRequired(
    client,
    `    pendingInput: null,
    renderKey: ''`,
    `    pendingInput: null,
    pendingActionId: '',
    renderKey: '',
    syncNotice: '',
    resultRevealGameId: '',
    resultRevealReady: false,
    resultRevealTimer: 0`,
    'pending action and result reveal state'
  );

  client = replaceRequired(
    client,
    `  function secondsLeft() {`,
    `  function lifecycleRank(status) {
    return ({ waiting: 0, ready: 1, countdown: 2, playing: 3, complete: 4, cancelled: 4 })[String(status || 'waiting')] ?? 0;
  }

  function snapshotVersion(game) {
    return {
      statusRank: lifecycleRank(game?.status),
      gameRevision: Math.max(-1, Number(game?.revision ?? -1)),
      stateRevision: Math.max(-1, Number(game?.mountainraceState?.revision ?? -1)),
      roundId: String(game?.mountainraceState?.roundId || '')
    };
  }

  function acceptsSnapshot(game) {
    if (!runtime.game || String(runtime.game.gameId || '') !== String(game?.gameId || '')) return true;
    const accepted = snapshotVersion(runtime.game);
    const incoming = snapshotVersion(game);
    const stale =
      incoming.statusRank < accepted.statusRank
      || incoming.gameRevision < accepted.gameRevision
      || incoming.stateRevision < accepted.stateRevision
      || (accepted.roundId && incoming.roundId && accepted.roundId !== incoming.roundId && incoming.statusRank <= accepted.statusRank);
    if (stale) {
      window.__mountainRaceRejectedSnapshots = Number(window.__mountainRaceRejectedSnapshots || 0) + 1;
      return false;
    }
    return true;
  }

  function finishPendingAction(actionId = '') {
    if (actionId && runtime.pendingActionId && actionId !== runtime.pendingActionId) return false;
    runtime.busy = false;
    runtime.pendingInput = null;
    runtime.pendingActionId = '';
    return true;
  }

  function restoreAcceptedBoard() {
    const mount = document.querySelector('[data-mountain-race-mount]');
    if (!mount || !runtime.game) return;
    runtime.root = mount;
    if (!mount.querySelector('.mountain-race-game')) render();
  }

  function scheduleResultReveal(previousGame, game) {
    const id = String(game?.gameId || '');
    if (String(game?.status || '') !== 'complete') {
      if (runtime.resultRevealTimer) window.clearTimeout(runtime.resultRevealTimer);
      runtime.resultRevealTimer = 0;
      runtime.resultRevealGameId = id;
      runtime.resultRevealReady = false;
      return;
    }
    if (runtime.resultRevealGameId === id && (runtime.resultRevealReady || runtime.resultRevealTimer)) return;
    if (runtime.resultRevealTimer) window.clearTimeout(runtime.resultRevealTimer);
    runtime.resultRevealGameId = id;
    const transitionedFromRace = Boolean(previousGame && String(previousGame.gameId || '') === id && String(previousGame.status || '') !== 'complete');
    if (!transitionedFromRace) {
      runtime.resultRevealReady = true;
      runtime.resultRevealTimer = 0;
      return;
    }
    runtime.resultRevealReady = false;
    runtime.resultRevealTimer = window.setTimeout(() => {
      runtime.resultRevealTimer = 0;
      if (runtime.game?.gameId !== id || runtime.game?.status !== 'complete') return;
      runtime.resultRevealReady = true;
      render();
    }, 900);
  }

  function secondsLeft() {`,
    'snapshot ordering and pending-action helpers'
  );

  client = replaceRequired(
    client,
    `  function statusText(publicState) {
    if (runtime.pendingInput) {`,
    `  function statusText(publicState) {
    if (runtime.syncNotice) return runtime.syncNotice;
    if (runtime.game?.status === 'complete' && !runtime.resultRevealReady) return 'Summit confirmed — finishing the climb!';
    if (runtime.pendingInput) {`,
    'synchronization status feedback'
  );

  client = replaceRequired(
    client,
    `  function resultOverlay(publicState, me, total) {
    if (runtime.game?.status !== 'complete') return '';`,
    `  function resultOverlay(publicState, me, total) {
    if (runtime.game?.status !== 'complete' || !runtime.resultRevealReady) return '';`,
    'completion reveal delay'
  );

  client = replaceRequired(
    client,
    `    const actionId = \`mr-\${Date.now()}-\${Math.random().toString(36).slice(2, 10)}\`;
    runtime.pendingInput = {`,
    `    const actionId = \`mr-\${Date.now()}-\${Math.random().toString(36).slice(2, 10)}\`;
    runtime.pendingActionId = actionId;
    runtime.syncNotice = '';
    runtime.pendingInput = {`,
    'pending action ownership'
  );

  client = replaceRequired(
    client,
    `      runtime.busy = false;
      if (data?.game) adopt(data.game);
      else {
        runtime.pendingInput = null;
        bridge.refresh?.();
      }`,
    `      if (data?.game) {
        adopt(data.game, {
          actionResolved: true,
          actionId,
          ignoredAction: Boolean(data.ignoredAction),
          ignoreReason: String(data.ignoreReason || '')
        });
      } else {
        finishPendingAction(actionId);
        bridge.refresh?.();
        render();
      }`,
    'action-response reconciliation'
  );

  client = replaceRequired(
    client,
    `    } catch (error) {
      runtime.busy = false;
      runtime.pendingInput = null;
      render();`,
    `    } catch (error) {
      finishPendingAction(actionId);
      render();`,
    'failed-action pending cleanup'
  );

  client = replaceRequired(
    client,
    `  function adopt(game) {
    if (!game || game.mode !== MODE) return;
    const nextRenderKey = meaningfulRenderKey(game);
    const sameMeaningfulState = Boolean(
      runtime.game?.gameId === game.gameId
      && runtime.renderKey === nextRenderKey
      && !runtime.pendingInput
    );
    const confirmedInputAt = game.mountainraceState?.me?.lastInput?.at || '';
    if (runtime.pendingInput && confirmedInputAt) runtime.lastMyInputAt = confirmedInputAt;
    runtime.game = game;
    runtime.busy = false;
    runtime.pendingInput = null;
    updateServerClock(game);
    if (sameMeaningfulState && runtime.root?.isConnected) {
      updateClock();
      startTicker();
      return;
    }
    runtime.renderKey = nextRenderKey;
    render();
    startTicker();
  }`,
    `  function adopt(game, options = {}) {
    if (!game || game.mode !== MODE) return false;
    const previousGame = runtime.game;
    const gameChanged = Boolean(previousGame && String(previousGame.gameId || '') !== String(game.gameId || ''));
    const resolvingPending = Boolean(
      options.actionResolved
      && (!runtime.pendingActionId || !options.actionId || options.actionId === runtime.pendingActionId)
    );

    if (!gameChanged && !acceptsSnapshot(game)) {
      if (resolvingPending) {
        finishPendingAction(options.actionId || '');
        runtime.syncNotice = options.ignoreReason === 'prompt-changed'
          ? 'The course advanced while that move was traveling. Follow the highlighted direction.'
          : '';
        render();
      }
      restoreAcceptedBoard();
      startTicker();
      return false;
    }

    if (gameChanged) {
      finishPendingAction();
      runtime.syncNotice = '';
      runtime.renderKey = '';
      if (runtime.resultRevealTimer) window.clearTimeout(runtime.resultRevealTimer);
      runtime.resultRevealTimer = 0;
      runtime.resultRevealGameId = '';
      runtime.resultRevealReady = false;
    }

    const nextRenderKey = meaningfulRenderKey(game);
    const hadPending = Boolean(runtime.pendingInput || runtime.busy);
    const sameMeaningfulState = Boolean(
      previousGame?.gameId === game.gameId
      && runtime.renderKey === nextRenderKey
      && !hadPending
      && !resolvingPending
    );
    const confirmedInputAt = game.mountainraceState?.me?.lastInput?.at || '';
    if (runtime.pendingInput && confirmedInputAt) runtime.lastMyInputAt = confirmedInputAt;
    runtime.game = game;
    updateServerClock(game);
    scheduleResultReveal(previousGame, game);

    if (resolvingPending) {
      finishPendingAction(options.actionId || '');
      runtime.syncNotice = options.ignoreReason === 'prompt-changed'
        ? 'The course advanced while that move was traveling. Follow the highlighted direction.'
        : options.ignoredAction
          ? 'That duplicate move was ignored. The highlighted direction is current.'
          : '';
    }

    if (sameMeaningfulState && runtime.root?.isConnected) {
      updateClock();
      startTicker();
      return true;
    }
    runtime.renderKey = nextRenderKey;
    render();
    startTicker();
    return true;
  }`,
    'monotonic snapshot adoption and action lock'
  );

  client = replaceRequired(
    client,
    `  window.addEventListener(STATE_EVENT, event => adopt(event?.detail?.game));`,
    `  window.addEventListener(STATE_EVENT, event => adopt(event?.detail?.game, { source: 'state-event' }));`,
    'state-event source separation'
  );

  client = replaceRequired(
    client,
    `  window.MountainRaceMultiplayer = Object.freeze({ adopt, render, submit });`,
    `  window.MountainRaceMultiplayer = Object.freeze({ adopt, render, submit, acceptsSnapshot, snapshotVersion });`,
    'state-sync diagnostics export'
  );
}

if (!client.includes(clientMarker)) throw new Error('Summit Sprint state-sync client marker is missing.');
if (!client.includes('pendingActionId:')) throw new Error('Summit Sprint does not retain pending action ownership.');
if (!client.includes('if (!gameChanged && !acceptsSnapshot(game))')) throw new Error('Summit Sprint client still accepts stale snapshots.');
if (!client.includes('options.actionResolved')) throw new Error('Summit Sprint action responses are not separated from background state events.');
if (!client.includes("runtime.game?.status === 'complete' || !runtime.resultRevealReady")) {
  throw new Error('Summit Sprint completion overlay does not wait for the final visual climb.');
}
await writeFile(clientUrl, client);

let html = await readFile(indexUrl, 'utf8');

if (!html.includes('function mountainRaceAcceptSnapshot(game)')) {
  const guardBlock = `
// MOUNTAIN_RACE_SHARED_SNAPSHOT_GUARD_START
    const mountainRaceAcceptedSnapshotByGame = new Map();
    function mountainRaceSnapshotVersion(game) {
      return {
        statusRank: Number(DUEL_STATUS_RANK[String(game?.status || 'waiting')] || 0),
        gameRevision: Math.max(-1, Number(game?.revision ?? -1)),
        stateRevision: Math.max(-1, Number(game?.mountainraceState?.revision ?? -1)),
        roundId: String(game?.mountainraceState?.roundId || '')
      };
    }
    function mountainRaceAcceptSnapshot(game) {
      if (String(game?.mode || '') !== 'mountainrace' || !game?.gameId) return true;
      const id = String(game.gameId);
      const incoming = mountainRaceSnapshotVersion(game);
      const accepted = mountainRaceAcceptedSnapshotByGame.get(id);
      if (accepted && (
        incoming.statusRank < accepted.statusRank
        || incoming.gameRevision < accepted.gameRevision
        || incoming.stateRevision < accepted.stateRevision
        || (accepted.roundId && incoming.roundId && accepted.roundId !== incoming.roundId && incoming.statusRank <= accepted.statusRank)
      )) {
        window.__mountainRaceSharedRejectedSnapshots = Number(window.__mountainRaceSharedRejectedSnapshots || 0) + 1;
        return false;
      }
      mountainRaceAcceptedSnapshotByGame.set(id, incoming);
      return true;
    }
    window.__mountainRaceAcceptSnapshot = mountainRaceAcceptSnapshot;
// MOUNTAIN_RACE_SHARED_SNAPSHOT_GUARD_END`;
  html = replaceRequired(
    html,
    '// SAFE_CRACKER_SNAPSHOT_GUARD_END',
    `// SAFE_CRACKER_SNAPSHOT_GUARD_END\n${guardBlock}`,
    'shared multiplayer snapshot guard anchor'
  );
}

html = replaceRequired(
  html,
  `      if (game?.mode === "safecracker" && !safeCrackerAcceptSnapshot(game)) return;
      if (game?.mode === "roulette" && !rouletteAcceptSnapshot(game)) return;`,
  `      if (game?.mode === "safecracker" && !safeCrackerAcceptSnapshot(game)) return;
      if (game?.mode === "mountainrace" && !mountainRaceAcceptSnapshot(game)) return;
      if (game?.mode === "roulette" && !rouletteAcceptSnapshot(game)) return;`,
  'active-render Summit Sprint snapshot guard'
);

html = replaceRequired(
  html,
  `              if (got.game.mode === "safecracker" && !safeCrackerAcceptSnapshot(got.game)) {
                active = duelLastActiveGame && String(duelLastActiveGame.gameId) === String(duelCurrentGameId) ? duelLastActiveGame : null;
              } else if (got.game.mode === "roulette" && !rouletteAcceptSnapshot(got.game)) {`,
  `              if (got.game.mode === "safecracker" && !safeCrackerAcceptSnapshot(got.game)) {
                active = duelLastActiveGame && String(duelLastActiveGame.gameId) === String(duelCurrentGameId) ? duelLastActiveGame : null;
              } else if (got.game.mode === "mountainrace" && !mountainRaceAcceptSnapshot(got.game)) {
                active = duelLastActiveGame && String(duelLastActiveGame.gameId) === String(duelCurrentGameId) ? duelLastActiveGame : null;
              } else if (got.game.mode === "roulette" && !rouletteAcceptSnapshot(got.game)) {`,
  'focused GET Summit Sprint snapshot guard'
);

html = replaceRequired(
  html,
  `              const acceptedRevision = got.syncRevision ?? got.game?.drawState?.revision ?? got.game?.safecrackerState?.revision;`,
  `              const acceptedRevision = got.syncRevision ?? active?.mountainraceState?.revision ?? got.game?.drawState?.revision ?? got.game?.safecrackerState?.revision;`,
  'focused GET accepted Summit Sprint revision'
);

html = replaceRequired(
  html,
  `          if(candidate?.mode === "safecracker" && duelLastActiveGame?.mode === "safecracker") active = safeCrackerAcceptSnapshot(candidate) ? candidate : duelLastActiveGame;
          else if(candidate?.mode === "roulette" && duelLastActiveGame?.mode === "roulette")`,
  `          if(candidate?.mode === "safecracker" && duelLastActiveGame?.mode === "safecracker") active = safeCrackerAcceptSnapshot(candidate) ? candidate : duelLastActiveGame;
          else if(candidate?.mode === "mountainrace" && duelLastActiveGame?.mode === "mountainrace") active = mountainRaceAcceptSnapshot(candidate) ? candidate : duelLastActiveGame;
          else if(candidate?.mode === "roulette" && duelLastActiveGame?.mode === "roulette")`,
  'lobby fallback Summit Sprint snapshot guard'
);

html = replaceRequired(
  html,
  `            const data = await duelRequest("act", { gameId: game.gameId, ...(details || {}) });
            duelLastActiveGame = data.game || duelLastActiveGame;
            if (data.game?.gameId) duelKnownRevisionByGame.set(String(data.game.gameId), String(data.game.mountainraceState?.revision || ""));
            duelRenderActive(data.game, true);
            return data;`,
  `            const data = await duelRequest("act", { gameId: game.gameId, ...(details || {}) });
            const acceptedGame = data.game && mountainRaceAcceptSnapshot(data.game) ? data.game : duelLastActiveGame;
            if (acceptedGame) duelLastActiveGame = acceptedGame;
            if (acceptedGame?.gameId) duelKnownRevisionByGame.set(String(acceptedGame.gameId), String(acceptedGame.mountainraceState?.revision || ""));
            if (acceptedGame) duelRenderActive(acceptedGame, true);
            return { ...data, game: acceptedGame || data.game };`,
  'Summit Sprint action-response snapshot guard'
);

html = replaceRequired(
  html,
  `   const state=game?.rouletteState||game?.drawState||game?.fishingState||game?.safecrackerState||{};`,
  `   const state=game?.rouletteState||game?.drawState||game?.fishingState||game?.safecrackerState||game?.mountainraceState||{};`,
  'Network Bot Summit Sprint revision comparison'
);

html = replaceRequired(
  html,
  `   if(game.mode==='safecracker'&&typeof window.__safeCrackerAcceptSnapshot==='function'&&!window.__safeCrackerAcceptSnapshot(game)){
    line(botLogs,'ignored rejected Safe Cracker snapshot',{gameId:String(game.gameId),incoming:rnbSnapshotStamp(game)});
    return current;
   }
   if(current&&rnbCompareSnapshots(game,current)<0){`,
  `   if(game.mode==='safecracker'&&typeof window.__safeCrackerAcceptSnapshot==='function'&&!window.__safeCrackerAcceptSnapshot(game)){
    line(botLogs,'ignored rejected Safe Cracker snapshot',{gameId:String(game.gameId),incoming:rnbSnapshotStamp(game)});
    return current;
   }
   if(game.mode==='mountainrace'&&typeof window.__mountainRaceAcceptSnapshot==='function'&&!window.__mountainRaceAcceptSnapshot(game)){
    line(botLogs,'ignored rejected Summit Sprint snapshot',{gameId:String(game.gameId),incoming:rnbSnapshotStamp(game)});
    return current;
   }
   if(current&&rnbCompareSnapshots(game,current)<0){`,
  'Network Bot Summit Sprint snapshot guard'
);

if (!html.includes(htmlMarker)) {
  const anchor = html.includes('</body>') ? '</body>' : html.includes('</html>') ? '</html>' : '';
  html = anchor ? html.replace(anchor, `${htmlMarker}\n${anchor}`) : `${html}\n${htmlMarker}\n`;
}

html = html
  .replaceAll('mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=1', 'mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=1')
  .replaceAll('mountain-race-multiplayer.js?v=1&gameplay=3&load=2', 'mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=1')
  .replaceAll('&sync=1&sync=1', '&sync=1');

if (!html.includes('function mountainRaceAcceptSnapshot(game)')) throw new Error('Shared Summit Sprint snapshot guard is missing.');
if (!html.includes('got.game.mode === "mountainrace" && !mountainRaceAcceptSnapshot(got.game)')) throw new Error('Focused polling can still regress Summit Sprint.');
if (!html.includes('const acceptedGame = data.game && mountainRaceAcceptSnapshot(data.game)')) throw new Error('Action responses can still replace Summit Sprint with stale state.');
if (!html.includes('game?.mountainraceState||{}')) throw new Error('Network Bot snapshot ordering ignores Summit Sprint state revisions.');
if (!html.includes('mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=1')) throw new Error('Fresh Summit Sprint state-sync cache boundary is missing.');
await writeFile(indexUrl, html);

console.log('Synchronized Summit Sprint input and visuals: one tap remains locked until its own response, stale GET/action/bot snapshots are rejected everywhere, accepted progress cannot move backward, and the final summit climb is shown before the result card.');
