import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const data = await readFile(new URL('../netlify/functions/_data.js', import.meta.url), 'utf8');
const injector = await readFile(new URL('./inject-lamp-assets.mjs', import.meta.url), 'utf8');

for (const required of [
  'let duelLobbyLoaded = false;',
  'const lobbyRefreshAge = 5000;',
  'const needLobby = !focusedGameOpen && (!duelLobbyLoaded',
  'duelLobbyLoaded = true;',
  'noFocusedGame ? 2000',
  'function rnbSnapshotStamp(game)',
  'function rnbCompareSnapshots(left,right)',
  "line(botLogs,'ignored stale game snapshot'",
  'const adopted=rnbAdoptGame(data.game,true)',
  '<b>Game revision</b>',
  '<b>State revision</b>',
  'gameRevision,stateRevision',
  'let duelCompletedActivityAt = 0;',
  'completedPollRate = Date.now() - duelCompletedActivityAt < 15000 ? 2000 : 5000;',
  'if (!duelScreen || duelScreen.hidden || document.hidden || Number(window.__duelMutationRequestsInFlight || 0) > 0) return;',
  'if(document.hidden)return;',
  'rnbScheduleRematch(g);\n  },1000);',
  'duelCompletedActivityAt = Date.now();',
  'queueMicrotask(() => duelRefresh(true));'
]) {
  if (!html.includes(required)) throw new Error(`Multiplayer client validation is missing ${required}`);
}

for (const forbidden of [
  'const lobbyRefreshAge = focusedGameOpen ? 15000 : 1200;',
  '!duelCachedGames.length || !focusedGameOpen',
  "lastRevision=-1",
  "if(data?.game){rnbAdoptGame(data.game,false);return data.game}",
  "duelRenderActive({...data.game,status:'ready'},true)",
  'completedAwaitingRematch ? 700',
  `if(g?.remoteNetworkTest&&g.status==='complete')g=await rnbFetchAuthoritativeGame`,
  '},650);',
  'if (!duelScreen || duelScreen.hidden) return;'
]) {
  if (html.includes(forbidden)) throw new Error(`Removed multiplayer client behavior remains: ${forbidden}`);
}

for (const required of [
  'isMyTurn:game?.status==="playing"&&cleanUserId(st.turnId)===id',
  'const recordPromise = getUserRecord(viewer);',
  'const batchSize = 8;',
  'Promise.all(entries.slice(offset, offset + batchSize).map',
  'return { games: games.slice(0, 40), record: await recordPromise };'
]) {
  if (!data.includes(required)) throw new Error(`Multiplayer server validation is missing ${required}`);
}

for (const required of [
  "await import('./patch-multiplayer-network-cleanup.mjs');",
  "await import('./patch-multiplayer-polling-load.mjs');"
]) {
  if (!injector.includes(required)) throw new Error(`The multiplayer build pipeline is missing ${required}`);
}

console.log('Multiplayer network validation passed: focused polling is isolated and pauses during mutations, stale bot snapshots are rejected, completed polling backs off, hidden tabs pause, duplicate Remote Bot GETs are removed, and lobby Blob reads are batched.');
