import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const integrationUrl = new URL('netlify/functions/mountain-race/integration.js', root);
const clientUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const indexUrl = new URL('index.html', root);
const marker = '// MOUNTAIN_RACE_STARTUP_COMPLETION_V7';
const htmlMarker = '<!-- MOUNTAIN_RACE_STARTUP_COMPLETION_V7 -->';

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint startup/completion patch could not find ${label}.`);
  return source.replace(before, after);
}

function replaceFunction(source, signature, replacement, label) {
  const start = source.indexOf(signature);
  if (start < 0) throw new Error(`Summit Sprint startup/completion patch could not find ${label}.`);
  const paramsStart = source.indexOf('(', start);
  if (paramsStart < 0) throw new Error(`Summit Sprint startup/completion patch could not parse ${label}.`);
  let parenDepth = 0;
  let bodyStart = -1;
  let quote = '';
  let escaped = false;
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
  if (bodyStart < 0) throw new Error(`Summit Sprint startup/completion patch could not find ${label} body.`);

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
  throw new Error(`Summit Sprint startup/completion patch could not close ${label}.`);
}

function indentFunction(fn, replacementName, spaces = 2) {
  const renamed = fn.toString().replace(fn.name, replacementName);
  const prefix = ' '.repeat(spaces);
  return renamed.split('\n').map(line => `${prefix}${line}`).join('\n');
}

function generatedSecondsLeft() {
  const publicState = state();
  if (runtime.game?.status === 'complete' || publicState.completedAt) return 0;
  const endAt = Date.parse(String(publicState.endAt || ''));
  return Number.isFinite(endAt) ? Math.max(0, Math.ceil((endAt - serverNowMs()) / 1000)) : 30;
}

async function generatedDuelReadyRetry(gameId) {
  const id = String(gameId || '');
  if (!id) return;
  const mountainRaceReady = id.startsWith('duel-mountainrace-');
  if (duelReadyRequestInFlight.has(id) || duelReadyConfirmed.has(id)) return;
  duelReadyRequestInFlight.add(id);
  duelReadyBusyUntilByGame.set(id, Date.now() + 9000);
  duelResetReadyUi(duelLastActiveGame);
  if (duelFocusedPollController) {
    duelFocusedPollController.abort();
    duelFocusedPollController = null;
  }

  let attempt = 0;
  let lastError = null;
  try {
    while (attempt < 4) {
      try {
        if (mountainRaceReady) {
          let stable = duelLastActiveGame && String(duelLastActiveGame.gameId || '') === id
            ? duelLastActiveGame
            : null;
          const stablePlayers = Boolean(stable?.creator?.userId && stable?.joiner?.userId);
          if (!stable || stable.mode !== 'mountainrace' || !stablePlayers || !['waiting', 'ready', 'countdown', 'playing', 'complete'].includes(String(stable.status || ''))) {
            const probe = await duelRequest('get', { gameId: id }, {
              timeoutMs: 6500,
              errorMessage: 'Summit Sprint is still confirming both climbers.'
            });
            stable = probe?.game || null;
          }

          if (stable?.gameId === id && stable.mode === 'mountainrace') {
            duelLastActiveGame = stable;
            duelRenderActive(stable, true);
            duelSetPollRate(stable);
            if (['countdown', 'playing', 'complete'].includes(String(stable.status || ''))) {
              duelReadyConfirmed.add(id);
              return;
            }
          }

          if (!stable?.creator?.userId || !stable?.joiner?.userId || !['waiting', 'ready'].includes(String(stable.status || ''))) {
            attempt += 1;
            if (attempt < 4) await new Promise(resolve => setTimeout(resolve, 260 + attempt * 220));
            continue;
          }
        }

        const data = await duelRequest('act', { gameId: id, choice: 'ready' }, {
          timeoutMs: 9000,
          errorMessage: 'Unable to confirm Ready.'
        });
        duelReadyConfirmed.add(id);
        if (data?.game) {
          duelLastActiveGame = data.game;
          duelRenderActive(data.game, true);
          duelSetPollRate(data.game);
        }
        return;
      } catch (error) {
        lastError = error;
        attempt += 1;
        if (attempt >= 4) throw error;
        await new Promise(resolve => setTimeout(resolve, mountainRaceReady ? 360 + attempt * 260 : 600 + attempt * 450));
      }
    }
    if (lastError) throw lastError;
  } finally {
    duelReadyRequestInFlight.delete(id);
    duelReadyBusyUntilByGame.delete(id);
    duelResetReadyUi(duelLastActiveGame);
    duelSetPollRate(duelLastActiveGame || null);
  }
}

function generatedMountainRacePauseCompletedPolling(game) {
  if (String(game?.mode || '') !== 'mountainrace' || String(game?.status || '') !== 'complete' || !game?.remoteNetworkTest) return false;
  if (duelPollTimer) clearInterval(duelPollTimer);
  duelPollTimer = null;
  window.__duelPollRate = 0;
  return true;
}

let integration = await readFile(integrationUrl, 'utf8');
if (!integration.includes(marker)) {
  integration = replaceRequired(
    integration,
    '// MOUNTAIN_RACE_CONTINUOUS_SYNC_V6',
    `// MOUNTAIN_RACE_CONTINUOUS_SYNC_V6\n${marker}`,
    'server marker'
  );
  integration = replaceRequired(
    integration,
    `      secondsLeft: Number.isFinite(endAtMs)
        ? Math.max(0, Math.ceil((endAtMs - Date.now()) / 1000))
        : 30,`,
    `      secondsLeft: complete || state.completedAt
        ? 0
        : Number.isFinite(endAtMs)
          ? Math.max(0, Math.ceil((endAtMs - Date.now()) / 1000))
          : 30,`,
    'authoritative completed clock'
  );
}
if (!integration.includes(marker)) throw new Error('Summit Sprint V7 server marker is missing.');
if (!integration.includes('secondsLeft: complete || state.completedAt')) throw new Error('Completed Summit Sprint state still exposes unused race time.');
await writeFile(integrationUrl, integration);

let client = await readFile(clientUrl, 'utf8');
if (!client.includes(marker)) {
  client = replaceRequired(
    client,
    '  // MOUNTAIN_RACE_CONTINUOUS_SYNC_V6',
    `  // MOUNTAIN_RACE_CONTINUOUS_SYNC_V6\n  ${marker}`,
    'client marker'
  );
  client = replaceFunction(
    client,
    '  function secondsLeft(',
    indentFunction(generatedSecondsLeft, 'secondsLeft'),
    'completed client clock'
  );
  client = replaceRequired(
    client,
    `  scheduleResultReveal(previousGame, mergedGame);
  if (String(mergedGame.status || '') !== 'playing' && runtime.inputQueue.length) clearInputQueue();`,
    `  scheduleResultReveal(previousGame, mergedGame);
  if (String(mergedGame.status || '') === 'complete') window.__mountainRacePauseCompletedPolling?.(mergedGame);
  if (String(mergedGame.status || '') !== 'playing' && runtime.inputQueue.length) clearInputQueue();`,
    'completed polling hook'
  );
}
if (!client.includes(marker)) throw new Error('Summit Sprint V7 client marker is missing.');
if (!client.includes("runtime.game?.status === 'complete' || publicState.completedAt")) throw new Error('Summit Sprint client clock still counts after completion.');
if (!client.includes('window.__mountainRacePauseCompletedPolling?.(mergedGame)')) throw new Error('Summit Sprint completion does not suspend Remote Bot polling.');
await writeFile(clientUrl, client);

let html = await readFile(indexUrl, 'utf8');
if (!html.includes(htmlMarker)) {
  html = replaceFunction(
    html,
    'async function duelReadyRetry(',
    indentFunction(generatedDuelReadyRetry, 'duelReadyRetry', 4),
    'stable Ready retry'
  );

  const pauseFunction = `${indentFunction(generatedMountainRacePauseCompletedPolling, 'mountainRacePauseCompletedPolling', 4)}\n    window.__mountainRacePauseCompletedPolling = mountainRacePauseCompletedPolling;\n\n`;
  html = replaceRequired(
    html,
    '    function duelSetPollRate(game) {',
    `${pauseFunction}    function duelSetPollRate(game) {`,
    'completed polling helper'
  );
  html = replaceRequired(
    html,
    `      let completedPollRate = 2000;`,
    `      if (mountainRacePauseCompletedPolling(game)) {
        duelSetSharedCountdown(game);
        return;
      }
      let completedPollRate = 2000;`,
    'Remote Bot completion poll gate'
  );

  const anchor = html.includes('</body>') ? '</body>' : html.includes('</html>') ? '</html>' : '';
  html = anchor ? html.replace(anchor, `${htmlMarker}\n${anchor}`) : `${html}\n${htmlMarker}\n`;
}
html = html
  .replaceAll('mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=6', 'mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=7')
  .replaceAll('&sync=7&sync=7', '&sync=7');

if (!html.includes(htmlMarker)) throw new Error('Summit Sprint V7 deployment marker is missing.');
if (!html.includes("const probe = await duelRequest('get', { gameId: id }")) throw new Error('Summit Sprint Ready still acts before a stable game probe.');
if (!html.includes('function mountainRacePauseCompletedPolling(game)')) throw new Error('Summit Sprint completed Remote Bot polling gate is missing.');
if (!html.includes('mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=7')) throw new Error('Summit Sprint V7 cache boundary is missing.');
await writeFile(indexUrl, html);

console.log('Added Summit Sprint V7 startup and completion cleanup: Ready waits for a stable two-climber snapshot, completed clocks freeze at zero, and completed Remote Bot races stop focused GET polling while human rematch polling remains available.');
