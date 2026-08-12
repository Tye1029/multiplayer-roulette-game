import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const indexUrl = new URL('index.html', root);
const validatorUrls = [
  new URL('scripts/validate-mountain-race-state-sync.mjs', root),
  new URL('scripts/validate-mountain-race-input-rebase-v8.mjs', root),
  new URL('scripts/validate-mountain-race-fast-ack-v9.mjs', root),
  new URL('scripts/validate-mountain-race-terminal-poll-v10.mjs', root)
];
const marker = '<!-- MOUNTAIN_RACE_LIFECYCLE_GUARD_V11 -->';

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint lifecycle-guard patch could not find ${label}.`);
  return source.replace(before, after);
}

let html = await readFile(indexUrl, 'utf8');

if (!html.includes('function mountainRaceSharedLifecycleRegression(current,incoming)')) {
  html = replaceRequired(
    html,
    `  function rnbAdoptGame(game,force=false){`,
    `  function mountainRaceSharedLifecycleRegression(current,incoming){
   if(!current||!incoming||String(incoming.mode||'')!=='mountainrace'||String(current.gameId||'')!==String(incoming.gameId||''))return false;
   const ranks={waiting:0,ready:1,countdown:2,playing:3,complete:4,cancelled:4};
   const currentRank=ranks[String(current.status||'waiting')]??0;
   const incomingRank=ranks[String(incoming.status||'waiting')]??0;
   const currentRevision=Number(current.revision??-1);
   const incomingRevision=Number(incoming.revision??-1);
   return incomingRank<currentRank&&incomingRevision<=currentRevision;
  }
  function rnbAdoptGame(game,force=false){`,
    'Remote Bot shared adoption helper'
  );
}

html = replaceRequired(
  html,
  `   if(current&&game.mode!=='mountainrace'&&rnbCompareSnapshots(game,current)<0){`,
  `   const mountainRaceLifecycleRegression=mountainRaceSharedLifecycleRegression(current,game);
   if(current&&((game.mode!=='mountainrace'&&rnbCompareSnapshots(game,current)<0)||mountainRaceLifecycleRegression)){
    if(mountainRaceLifecycleRegression)window.__mountainRaceSharedRejectedSnapshots=Number(window.__mountainRaceSharedRejectedSnapshots||0)+1;`,
  'Mountain Race generic-comparator bypass'
);

if (!html.includes(marker)) {
  const anchor = html.includes('</body>') ? '</body>' : html.includes('</html>') ? '</html>' : '';
  html = anchor ? html.replace(anchor, `${marker}\n${anchor}`) : `${html}\n${marker}\n`;
}

html = html
  .replaceAll('mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=10', 'mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=11')
  .replaceAll('&sync=11&sync=11', '&sync=11');

for (const required of [
  marker,
  'function mountainRaceSharedLifecycleRegression(current,incoming)',
  'incomingRank<currentRank&&incomingRevision<=currentRevision',
  'const mountainRaceLifecycleRegression=mountainRaceSharedLifecycleRegression(current,game);',
  'window.__mountainRaceSharedRejectedSnapshots=Number(window.__mountainRaceSharedRejectedSnapshots||0)+1;',
  'mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=11'
]) {
  if (!html.includes(required)) throw new Error(`Summit Sprint lifecycle-guard output is missing ${required}`);
}
await writeFile(indexUrl, html);

for (const validatorUrl of validatorUrls) {
  let source = await readFile(validatorUrl, 'utf8');
  source = source
    .replaceAll('mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=10', 'mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=11')
    .replaceAll('&sync=11&sync=11', '&sync=11');
  await writeFile(validatorUrl, source);
}

console.log('Added Summit Sprint Lifecycle Guard V11: an older in-flight Ready snapshot cannot overwrite Countdown or Playing, while higher-revision rematches and same-lifecycle component synchronization remain available.');
