import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const clientUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const indexUrl = new URL('index.html', root);
const marker = '// MOUNTAIN_RACE_LOAD_PERFORMANCE_V1';
const htmlMarker = '<!-- MOUNTAIN_RACE_LOAD_PERFORMANCE_V1 -->';

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint load-performance patch could not find ${label}.`);
  return source.replace(before, after);
}

let client = await readFile(clientUrl, 'utf8');

if (!client.includes(marker)) {
  client = replaceRequired(
    client,
    '// MOUNTAIN_RACE_VISIBLE_GAMEPLAY_V1',
    `// MOUNTAIN_RACE_VISIBLE_GAMEPLAY_V1\n  ${marker}`,
    'client marker'
  );

  client = replaceRequired(
    client,
    `    pendingInput: null`,
    `    pendingInput: null,
    renderKey: ''`,
    'render signature state'
  );

  client = replaceRequired(
    client,
    `  function state() {
    return runtime.game?.mountainraceState || {};
  }`,
    `  function state() {
    return runtime.game?.mountainraceState || {};
  }

  function meaningfulRenderKey(game) {
    const publicState = game?.mountainraceState || {};
    const me = publicState.me || {};
    const opponent = publicState.opponent || {};
    return JSON.stringify([
      game?.gameId || '',
      game?.status || '',
      publicState.revision ?? '',
      publicState.stepsTotal ?? '',
      Boolean(publicState.canSubmit),
      Array.isArray(publicState.prompts) ? publicState.prompts.join(',') : '',
      me.promptIndex ?? 0,
      me.rejectedInputs ?? 0,
      me.lastInput?.at || '',
      me.lastInput?.correct ?? '',
      opponent.promptIndex ?? 0,
      opponent.rejectedInputs ?? 0,
      opponent.lastInput?.at || '',
      opponent.lastInput?.correct ?? '',
      publicState.winnerId || '',
      Boolean(publicState.viewerWon),
      Boolean(publicState.tie)
    ]);
  }`,
    'meaningful render signature helper'
  );

  client = replaceRequired(
    client,
    `  function adopt(game) {
    if (!game || game.mode !== MODE) return;
    const confirmedInputAt = game.mountainraceState?.me?.lastInput?.at || '';
    if (runtime.pendingInput && confirmedInputAt) runtime.lastMyInputAt = confirmedInputAt;
    runtime.game = game;
    runtime.busy = false;
    runtime.pendingInput = null;
    updateServerClock(game);
    render();
    startTicker();
  }`,
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
    'poll render deduplication'
  );
}

if (!client.includes(marker)) throw new Error('Summit Sprint load-performance client marker is missing.');
if (!client.includes('function meaningfulRenderKey(game)')) throw new Error('Summit Sprint poll render signature is missing.');
if (!client.includes('sameMeaningfulState && runtime.root?.isConnected')) throw new Error('Summit Sprint still rebuilds the entire mountain on unchanged polls.');
await writeFile(clientUrl, client);

let html = await readFile(indexUrl, 'utf8');

html = replaceRequired(
  html,
  `  const start = () => {
    renameNetworkBotLog();
    if (!document.body) return;
    new MutationObserver(renameNetworkBotLog).observe(document.body, { childList: true, subtree: true });
  };`,
  `  const start = () => {
    let attempts = 0;
    const retry = () => {
      renameNetworkBotLog();
      attempts += 1;
      if (attempts < 8) window.setTimeout(retry, 650);
    };
    retry();
  };`,
  'unbounded Network Bot Log observer'
);

if (!html.includes(htmlMarker)) {
  const anchor = html.includes('</body>') ? '</body>' : html.includes('</html>') ? '</html>' : '';
  html = anchor ? html.replace(anchor, `${htmlMarker}\n${anchor}`) : `${html}\n${htmlMarker}\n`;
}

html = html
  .replaceAll('mountain-race-multiplayer.js?v=1&gameplay=3&load=1', 'mountain-race-multiplayer.js?v=1&gameplay=3&load=2')
  .replaceAll('mountain-race-multiplayer.js?v=1&gameplay=3', 'mountain-race-multiplayer.js?v=1&gameplay=3&load=2')
  .replaceAll('&load=2&load=2', '&load=2');

if (html.includes('new MutationObserver(renameNetworkBotLog)')) throw new Error('The Network Bot Log still installs a permanent whole-page observer.');
if (!html.includes('attempts < 8')) throw new Error('The bounded Network Bot Log rename pass is missing.');
if (!html.includes('mountain-race-multiplayer.js?v=1&gameplay=3&load=2')) throw new Error('Fresh Summit Sprint load-performance cache boundary is missing.');
await writeFile(indexUrl, html);

console.log('Fixed Summit Sprint loading performance: removed the permanent whole-page Network Bot Log observer, bounded label discovery, and stopped unchanged network polls from rebuilding the complete mountain DOM.');
await import('./patch-mountain-race-state-sync.mjs');
