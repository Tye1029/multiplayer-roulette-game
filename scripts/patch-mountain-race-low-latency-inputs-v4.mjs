import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const integrationUrl = new URL('netlify/functions/mountain-race/integration.js', root);
const clientUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const indexUrl = new URL('index.html', root);
const integrationMarker = '// MOUNTAIN_RACE_LOW_LATENCY_INPUTS_V4';
const clientMarker = '// MOUNTAIN_RACE_LOW_LATENCY_INPUTS_V4';
const htmlMarker = '<!-- MOUNTAIN_RACE_LOW_LATENCY_INPUTS_V4 -->';

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint low-latency patch could not find ${label}.`);
  return source.replace(before, after);
}

function replaceFunction(source, signature, replacement, label) {
  const start = source.indexOf(signature);
  if (start < 0) throw new Error(`Summit Sprint low-latency patch could not find ${label}.`);

  const paramsStart = source.indexOf('(', start);
  if (paramsStart < 0) throw new Error(`Summit Sprint low-latency patch could not parse ${label} parameters.`);
  let parenDepth = 0;
  let quote = '';
  let escaped = false;
  let bodyStart = -1;
  for (let index = paramsStart; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '(') parenDepth += 1;
    else if (char === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) {
        bodyStart = source.indexOf('{', index + 1);
        break;
      }
    }
  }
  if (bodyStart < 0) throw new Error(`Summit Sprint low-latency patch could not find ${label} body.`);

  let braceDepth = 0;
  quote = '';
  escaped = false;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') braceDepth += 1;
    else if (char === '}') {
      braceDepth -= 1;
      if (braceDepth === 0) return source.slice(0, start) + replacement + source.slice(index + 1);
    }
  }
  throw new Error(`Summit Sprint low-latency patch could not close ${label}.`);
}

let integration = await readFile(integrationUrl, 'utf8');

if (!integration.includes(integrationMarker)) {
  integration = replaceRequired(
    integration,
    '// MOUNTAIN_RACE_RELIABLE_INPUTS_V3',
    `// MOUNTAIN_RACE_RELIABLE_INPUTS_V3\n${integrationMarker}`,
    'server marker'
  );

  const actionFunction = `  async function action(user, gameId, rawChoice, details = {}) {
    const outcome = await withLock(gameId, async () => {
      const game = await strongRead(gameId);
      return await applyActionUnlocked(user, game, rawChoice, details, {});
    });

    const finalGame = outcome.game;
    const viewer = cleanUserId(user.id);
    const wakeBot = Boolean(finalGame?.status === 'playing' && !outcome.ignoredAction);
    const response = {
      game: publicGame(finalGame, viewer),
      ...(outcome.ignoredAction ? { ignoredAction: true, ignoreReason: outcome.ignoreReason } : {}),
      ...(outcome.replayedAction ? { replayedAction: true } : {}),
      ...(wakeBot ? { wakeBot: true } : {})
    };
    if (finalGame?.status === 'complete') response.record = await getUserRecord(viewer);
    else response.skipBalanceLookup = true;
    return response;
  }`;
  integration = replaceFunction(integration, '  async function action(', actionFunction, 'non-blocking public action endpoint');
}

if (!integration.includes(integrationMarker)) throw new Error('Summit Sprint low-latency integration marker is missing.');
const actionStart = integration.indexOf('  async function action(');
const actionEnd = integration.indexOf('\n  return Object.freeze(', actionStart);
const actionSource = actionStart >= 0 && actionEnd > actionStart ? integration.slice(actionStart, actionEnd) : '';
if (!actionSource.includes('wakeBot: true')) throw new Error('Player responses do not request an asynchronous Network Bot wake.');
if (actionSource.includes('await advance(')) throw new Error('Player input still blocks on the Network Bot driver.');
if (!integration.includes('confirmedState?.processedActionIds.includes(actionId)')) throw new Error('Strong action-id confirmation was removed.');
await writeFile(integrationUrl, integration);

let client = await readFile(clientUrl, 'utf8');

if (!client.includes(clientMarker)) {
  client = replaceRequired(
    client,
    '  // MOUNTAIN_RACE_RELIABLE_INPUTS_V3',
    `  // MOUNTAIN_RACE_RELIABLE_INPUTS_V3\n  ${clientMarker}`,
    'client marker'
  );

  client = replaceRequired(
    client,
    `    resultRevealReady: false,
    resultRevealTimer: 0`,
    `    resultRevealReady: false,
    resultRevealTimer: 0,
    botWakeTimer: 0,
    botWakeInFlight: false`,
    'bot wake runtime state'
  );

  client = replaceRequired(
    client,
    `  async function submit(rawToken) {`,
    `  function scheduleBotWake() {
    if (runtime.botWakeTimer || runtime.botWakeInFlight || runtime.game?.status !== 'playing') return;
    runtime.botWakeTimer = window.setTimeout(async () => {
      runtime.botWakeTimer = 0;
      const bridge = window.__mountainRaceBridge;
      if (!bridge?.refresh || runtime.game?.status !== 'playing') return;
      runtime.botWakeInFlight = true;
      try {
        await bridge.refresh();
      } catch {
        // Normal focused polling will retry without delaying the confirmed player move.
      } finally {
        runtime.botWakeInFlight = false;
      }
    }, 0);
  }

  async function submit(rawToken) {`,
    'asynchronous bot wake helper'
  );

  client = replaceRequired(
    client,
    `        adopt(data.game, {
          actionResolved: true,
          actionId,
          ignoredAction: Boolean(data.ignoredAction),
          ignoreReason: String(data.ignoreReason || '')
        });
      } else {`,
    `        adopt(data.game, {
          actionResolved: true,
          actionId,
          ignoredAction: Boolean(data.ignoredAction),
          ignoreReason: String(data.ignoreReason || '')
        });
        if (data.wakeBot) scheduleBotWake();
      } else {`,
    'post-confirmation bot wake'
  );

  client = replaceRequired(
    client,
    `      runtime.resultRevealTimer = 0;
      runtime.resultRevealGameId = '';`,
    `      runtime.resultRevealTimer = 0;
      if (runtime.botWakeTimer) window.clearTimeout(runtime.botWakeTimer);
      runtime.botWakeTimer = 0;
      runtime.botWakeInFlight = false;
      runtime.resultRevealGameId = '';`,
    'game-change bot wake cleanup'
  );

  client = replaceRequired(
    client,
    `  window.MountainRaceMultiplayer = Object.freeze({ adopt, render, submit, acceptsSnapshot, snapshotVersion, compareSnapshotVersions });`,
    `  window.MountainRaceMultiplayer = Object.freeze({ adopt, render, submit, acceptsSnapshot, snapshotVersion, compareSnapshotVersions, scheduleBotWake });`,
    'latency diagnostics export'
  );
}

if (!client.includes(clientMarker)) throw new Error('Summit Sprint low-latency client marker is missing.');
if (!client.includes('function scheduleBotWake()')) throw new Error('The client does not wake the bot after returning the confirmed player move.');
if (!client.includes('if (data.wakeBot) scheduleBotWake();')) throw new Error('Confirmed player actions do not schedule the bot wake.');
await writeFile(clientUrl, client);

let html = await readFile(indexUrl, 'utf8');
if (!html.includes(htmlMarker)) {
  const anchor = html.includes('</body>') ? '</body>' : html.includes('</html>') ? '</html>' : '';
  html = anchor ? html.replace(anchor, `${htmlMarker}\n${anchor}`) : `${html}\n${htmlMarker}\n`;
}
html = html
  .replaceAll('mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=3', 'mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=4')
  .replaceAll('&sync=4&sync=4', '&sync=4');
if (!html.includes('mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=4')) throw new Error('Fresh low-latency runtime cache boundary is missing.');
await writeFile(indexUrl, html);

console.log('Reduced Summit Sprint input latency: the response returns immediately after the player action is strongly confirmed, while a separate focused refresh wakes the Network Bot without delaying the next visible arrow.');
