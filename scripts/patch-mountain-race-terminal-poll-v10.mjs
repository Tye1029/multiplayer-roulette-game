import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const indexUrl = new URL('index.html', root);
const stateValidatorUrl = new URL('scripts/validate-mountain-race-state-sync.mjs', root);
const rebaseValidatorUrl = new URL('scripts/validate-mountain-race-input-rebase-v8.mjs', root);
const marker = '<!-- MOUNTAIN_RACE_TERMINAL_POLL_V10 -->';

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint terminal-poll patch could not find ${label}.`);
  return source.replace(before, after);
}

function insertFunctionGuard(source, signature, guard, label) {
  if (source.includes(guard)) return source;
  const start = source.indexOf(signature);
  if (start < 0) throw new Error(`Summit Sprint terminal-poll patch could not find ${label}.`);
  const bodyStart = source.indexOf('{', start + signature.length);
  if (bodyStart < 0) throw new Error(`Summit Sprint terminal-poll patch could not parse ${label}.`);
  return source.slice(0, bodyStart + 1) + `\n      ${guard}` + source.slice(bodyStart + 1);
}

let html = await readFile(indexUrl, 'utf8');

html = replaceRequired(
  html,
  `      if(Number(window.__duelMutationRequestsInFlight||0)>0)return;
      if(typeof duelSetPollRate==='function')duelSetPollRate(typeof duelLastActiveGame!=='undefined'?duelLastActiveGame:null);`,
  `      if(Number(window.__duelMutationRequestsInFlight||0)>0)return;
      const activeGame=typeof duelLastActiveGame!=='undefined'?duelLastActiveGame:null;
      if(typeof window.__mountainRacePauseCompletedPolling==='function'&&window.__mountainRacePauseCompletedPolling(activeGame))return;
      if(typeof duelSetPollRate==='function')duelSetPollRate(activeGame);`,
  'mutation polling resume boundary'
);

html = insertFunctionGuard(
  html,
  'async function duelRefresh(',
  'if (typeof window.__mountainRacePauseCompletedPolling === "function" && window.__mountainRacePauseCompletedPolling(duelLastActiveGame || null)) return;',
  'focused refresh function'
);

if (!html.includes(marker)) {
  const anchor = html.includes('</body>') ? '</body>' : html.includes('</html>') ? '</html>' : '';
  html = anchor ? html.replace(anchor, `${marker}\n${anchor}`) : `${html}\n${marker}\n`;
}
html = html
  .replaceAll('mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=9', 'mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=10')
  .replaceAll('&sync=10&sync=10', '&sync=10');

for (const required of [
  marker,
  "window.__mountainRacePauseCompletedPolling(activeGame))return;",
  'window.__mountainRacePauseCompletedPolling(duelLastActiveGame || null)) return;',
  'mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=10'
]) {
  if (!html.includes(required)) throw new Error(`Summit Sprint terminal-poll output is missing ${required}`);
}
await writeFile(indexUrl, html);

for (const validatorUrl of [stateValidatorUrl, rebaseValidatorUrl]) {
  let source = await readFile(validatorUrl, 'utf8');
  source = source
    .replaceAll('mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=9', 'mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=10')
    .replaceAll('&sync=10&sync=10', '&sync=10');
  await writeFile(validatorUrl, source);
}

console.log('Added Summit Sprint Terminal Poll V10: completed Remote Bot races cannot restart polling after an action, and any stray focused refresh stops before issuing a GET.');
