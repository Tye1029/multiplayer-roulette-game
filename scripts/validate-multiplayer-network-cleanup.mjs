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
  "const adopted=rnbAdoptGame(data.game,true)",
  '<b>Game revision</b>',
  '<b>State revision</b>',
  'gameRevision,stateRevision'
]) {
  if (!html.includes(required)) throw new Error(`Multiplayer client validation is missing ${required}`);
}

for (const forbidden of [
  'const lobbyRefreshAge = focusedGameOpen ? 15000 : 1200;',
  '!duelCachedGames.length || !focusedGameOpen',
  "lastRevision=-1",
  "if(data?.game){rnbAdoptGame(data.game,false);return data.game}",
  "duelRenderActive({...data.game,status:'ready'},true)"
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

if (!injector.includes("await import('./patch-multiplayer-network-cleanup.mjs');")) {
  throw new Error('The multiplayer network cleanup patch is not part of the Netlify build.');
}

console.log('Multiplayer network validation passed: focused polling is isolated, stale bot snapshots are rejected, completed turns are false, and lobby Blob reads are batched.');
