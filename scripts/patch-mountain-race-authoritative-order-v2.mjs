import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const clientUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const indexUrl = new URL('index.html', root);
const clientMarker = '// MOUNTAIN_RACE_AUTHORITATIVE_ORDER_V2';
const htmlMarker = '<!-- MOUNTAIN_RACE_AUTHORITATIVE_ORDER_V2 -->';

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint authoritative-order patch could not find ${label}.`);
  return source.replace(before, after);
}

let client = await readFile(clientUrl, 'utf8');

if (!client.includes(clientMarker)) {
  client = replaceRequired(
    client,
    '  // MOUNTAIN_RACE_STATE_SYNC_V1',
    `  // MOUNTAIN_RACE_STATE_SYNC_V1\n  ${clientMarker}`,
    'client authoritative-order marker'
  );

  client = replaceRequired(
    client,
    `  function acceptsSnapshot(game) {`,
    `  function compareSnapshotVersions(accepted, incoming) {
    const sameRound = !accepted?.roundId || !incoming?.roundId || accepted.roundId === incoming.roundId;
    if (!sameRound) return -1;
    if (incoming.stateRevision !== accepted.stateRevision) return incoming.stateRevision - accepted.stateRevision;
    if (incoming.statusRank !== accepted.statusRank) return incoming.statusRank - accepted.statusRank;
    if (incoming.gameRevision !== accepted.gameRevision) return incoming.gameRevision - accepted.gameRevision;
    return 0;
  }

  function acceptsSnapshot(game) {`,
    'client race-revision comparator'
  );

  client = replaceRequired(
    client,
    `    const stale = incoming.statusRank < accepted.statusRank
      || incoming.gameRevision < accepted.gameRevision
      || incoming.stateRevision < accepted.stateRevision
      || (accepted.roundId && incoming.roundId && accepted.roundId !== incoming.roundId && incoming.statusRank <= accepted.statusRank);`,
    `    const stale = compareSnapshotVersions(accepted, incoming) < 0;`,
    'client independent revision regression check'
  );

  client = replaceRequired(
    client,
    `  window.MountainRaceMultiplayer = Object.freeze({ adopt, render, submit, acceptsSnapshot, snapshotVersion });`,
    `  window.MountainRaceMultiplayer = Object.freeze({ adopt, render, submit, acceptsSnapshot, snapshotVersion, compareSnapshotVersions });`,
    'client ordering diagnostics export'
  );
}

if (!client.includes(clientMarker)) throw new Error('Summit Sprint authoritative-order client marker is missing.');
if (!client.includes('function compareSnapshotVersions(accepted, incoming)')) throw new Error('Summit Sprint client lacks its race-state-first comparator.');
if (!client.includes('const stale = compareSnapshotVersions(accepted, incoming) < 0;')) throw new Error('Summit Sprint client still compares independent revisions as simultaneous requirements.');
await writeFile(clientUrl, client);

let html = await readFile(indexUrl, 'utf8');

if (!html.includes('function mountainRaceCompareVersions(accepted, incoming)')) {
  html = replaceRequired(
    html,
    `    function mountainRaceAcceptSnapshot(game) {`,
    `    function mountainRaceCompareVersions(accepted, incoming) {
      const sameRound = !accepted?.roundId || !incoming?.roundId || accepted.roundId === incoming.roundId;
      if (!sameRound) return -1;
      if (incoming.stateRevision !== accepted.stateRevision) return incoming.stateRevision - accepted.stateRevision;
      if (incoming.statusRank !== accepted.statusRank) return incoming.statusRank - accepted.statusRank;
      if (incoming.gameRevision !== accepted.gameRevision) return incoming.gameRevision - accepted.gameRevision;
      return 0;
    }
    function mountainRaceAcceptSnapshot(game) {`,
    'shared race-state-first comparator'
  );
}

html = replaceRequired(
  html,
  `      if (accepted && (incoming.statusRank < accepted.statusRank
        || incoming.gameRevision < accepted.gameRevision
        || incoming.stateRevision < accepted.stateRevision
        || (accepted.roundId && incoming.roundId && accepted.roundId !== incoming.roundId && incoming.statusRank <= accepted.statusRank))) {`,
  `      if (accepted && mountainRaceCompareVersions(accepted, incoming) < 0) {`,
  'shared independent revision regression check'
);

html = replaceRequired(
  html,
  `    window.__mountainRaceAcceptSnapshot = mountainRaceAcceptSnapshot;`,
  `    window.__mountainRaceAcceptSnapshot = mountainRaceAcceptSnapshot;
    window.__mountainRaceCompareVersions = mountainRaceCompareVersions;`,
  'shared comparator diagnostics export'
);

html = replaceRequired(
  html,
  `   if(current&&rnbCompareSnapshots(game,current)<0){`,
  `   if(current&&game.mode!=='mountainrace'&&rnbCompareSnapshots(game,current)<0){`,
  'Network Bot generic comparator bypass'
);

html = replaceRequired(
  html,
  `  function rnbDebugState(g){
   if(!g)return{};
   if(g.mode!=='safecracker')return g.rouletteState||g.drawState||g.fishingState||{};`,
  `  function rnbDebugState(g){
   if(!g)return{};
   if(g.mode==='mountainrace'){
    const st=g.mountainraceState&&typeof g.mountainraceState==='object'?g.mountainraceState:{};
    const climber=value=>value&&typeof value==='object'?{playerId:String(value.playerId||''),name:String(value.name||''),badge:String(value.badge||''),isBot:Boolean(value.isBot),promptIndex:Number(value.promptIndex||0),acceptedInputs:Number(value.acceptedInputs||0),rejectedInputs:Number(value.rejectedInputs||0),lastInput:value.lastInput||null,finishedAt:value.finishedAt||null}:null;
    return{roundId:String(st.roundId||''),revision:Number(st.revision||0),startAt:st.startAt||null,endAt:st.endAt||null,secondsLeft:Number(st.secondsLeft||0),stepsTotal:Number(st.stepsTotal||24),canSubmit:Boolean(st.canSubmit),prompts:Array.isArray(st.prompts)?st.prompts:[],me:climber(st.me),opponent:climber(st.opponent),winnerUserId:String(st.winnerUserId||''),viewerWon:Boolean(st.viewerWon),tie:Boolean(st.tie),networkBotLog:st.networkBotLog||null,completedAt:st.completedAt||null,rejectedSnapshots:Number(window.__mountainRaceRejectedSnapshots||0),sharedRejectedSnapshots:Number(window.__mountainRaceSharedRejectedSnapshots||0)};
   }
   if(g.mode!=='safecracker')return g.rouletteState||g.drawState||g.fishingState||{};`,
  'Summit Sprint debug state export'
);

if (!html.includes(htmlMarker)) {
  const anchor = html.includes('</body>') ? '</body>' : html.includes('</html>') ? '</html>' : '';
  html = anchor ? html.replace(anchor, `${htmlMarker}\n${anchor}`) : `${html}\n${htmlMarker}\n`;
}

html = html
  .replaceAll('mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=1', 'mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=2')
  .replaceAll('&sync=2&sync=2', '&sync=2');

if (!html.includes('function mountainRaceCompareVersions(accepted, incoming)')) throw new Error('Shared Summit Sprint race-state-first comparator is missing.');
if (!html.includes("game.mode!=='mountainrace'&&rnbCompareSnapshots(game,current)<0")) throw new Error('Network Bot still applies the conflicting generic comparator to Summit Sprint.');
if (!html.includes("if(g.mode==='mountainrace')")) throw new Error('Summit Sprint debug exports still hide the authoritative race state.');
if (!html.includes(htmlMarker)) throw new Error('Summit Sprint authoritative-order deployment marker is missing.');
if (!html.includes('mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=2')) throw new Error('Fresh Summit Sprint authoritative-order cache boundary is missing.');
await writeFile(indexUrl, html);

console.log('Fixed Summit Sprint authoritative ordering: race-state revision now decides freshness before the independent game revision, direct action responses can advance the visible prompt in one tap, opponent bot progress is no longer rejected by the generic comparator, and both debug menus include the real mountain-race state.');
