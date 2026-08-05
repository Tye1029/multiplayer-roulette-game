import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const indexUrl = new URL('index.html', root);
const validatorUrls = [
  new URL('scripts/validate-mountain-race-state-sync.mjs', root),
  new URL('scripts/validate-mountain-race-input-rebase-v8.mjs', root),
  new URL('scripts/validate-mountain-race-fast-ack-v9.mjs', root),
  new URL('scripts/validate-mountain-race-terminal-poll-v10.mjs', root),
  new URL('scripts/validate-mountain-race-lifecycle-guard-v11.mjs', root)
];
const marker = '<!-- MOUNTAIN_RACE_TERMINAL_DRAIN_V12 -->';
const pollStartMarker = '/* MOUNTAIN_RACE_TERMINAL_DRAIN_V12_POLL_START */';
const afterAdoptMarker = '/* MOUNTAIN_RACE_TERMINAL_DRAIN_V12_AFTER_ADOPT */';
const adoptMarker = '/* MOUNTAIN_RACE_TERMINAL_DRAIN_V12_ADOPT */';

function findMatching(source, start, openCharacter, closeCharacter, label) {
  let depth = 0;
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    const nextCharacter = source[index + 1] || '';

    if (lineComment) {
      if (character === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === '*' && nextCharacter === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === '\\') {
        escaped = true;
        continue;
      }
      if (character === quote) quote = '';
      continue;
    }
    if (character === '/' && nextCharacter === '/') {
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === '/' && nextCharacter === '*') {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === "'" || character === '"' || character === '`') {
      quote = character;
      continue;
    }
    if (character === openCharacter) depth += 1;
    if (character === closeCharacter) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  throw new Error(`Summit Sprint terminal-drain patch could not match ${label}.`);
}

function functionBounds(source, signature, label) {
  const start = source.indexOf(signature);
  if (start < 0) throw new Error(`Summit Sprint terminal-drain patch could not find ${label}.`);
  const open = source.indexOf('{', start + signature.length);
  if (open < 0) throw new Error(`Summit Sprint terminal-drain patch could not open ${label}.`);
  const close = findMatching(source, open, '{', '}', label);
  return { start, open, close };
}

function replaceNamedFunction(source, signature, replacement, label) {
  const bounds = functionBounds(source, signature, label);
  return `${source.slice(0, bounds.start)}${replacement}${source.slice(bounds.close + 1)}`;
}

function insertAtFunctionStart(source, signature, insertion, markerText, label) {
  const bounds = functionBounds(source, signature, label);
  const body = source.slice(bounds.open + 1, bounds.close);
  if (body.includes(markerText)) return source;
  return `${source.slice(0, bounds.open + 1)}\n${insertion}${source.slice(bounds.open + 1)}`;
}

function insertAfterCallsInFunction(source, signature, callName, insertion, markerText, label) {
  const bounds = functionBounds(source, signature, label);
  const body = source.slice(bounds.open + 1, bounds.close);
  if (body.includes(markerText)) return source;

  const positions = [];
  let cursor = bounds.open + 1;
  while (cursor < bounds.close) {
    const callStart = source.indexOf(`${callName}(`, cursor);
    if (callStart < 0 || callStart >= bounds.close) break;
    const open = callStart + callName.length;
    const close = findMatching(source, open, '(', ')', `${label} ${callName} call`);
    let statementEnd = close + 1;
    while (statementEnd < bounds.close && /\s/.test(source[statementEnd])) statementEnd += 1;
    if (source[statementEnd] === ';') statementEnd += 1;
    positions.push(statementEnd);
    cursor = statementEnd;
  }

  if (!positions.length) throw new Error(`Summit Sprint terminal-drain patch found no ${callName} calls in ${label}.`);
  let result = source;
  for (const position of positions.reverse()) {
    result = `${result.slice(0, position)}\n${insertion}${result.slice(position)}`;
  }
  return result;
}

let html = await readFile(indexUrl, 'utf8');

const helper = `    function mountainRacePauseCompletedPolling(game) {
      const remembered = window.__mountainRaceLastCompletedGame || null;
      const incomingId = String(game?.gameId || '');
      const rememberedId = String(remembered?.gameId || '');
      const incomingTerminal = Boolean(
        game
        && game.mode === 'mountainrace'
        && game.remoteNetworkTest
        && ['complete', 'cancelled'].includes(String(game.status || ''))
      );

      if (!incomingTerminal && game?.mode === 'mountainrace' && remembered && incomingId && incomingId === rememberedId) {
        const incomingRevision = Number(game.revision ?? -1);
        const rememberedRevision = Number(remembered.revision ?? -1);
        const incomingRoundId = String(game.mountainraceState?.roundId || '');
        const rememberedRoundId = String(remembered.mountainraceState?.roundId || '');
        const newerRound = incomingRevision > rememberedRevision
          || (incomingRoundId && rememberedRoundId && incomingRoundId !== rememberedRoundId);
        if (newerRound) window.__mountainRaceLastCompletedGame = null;
      }

      const terminalGame = incomingTerminal
        ? game
        : (remembered && incomingId && incomingId === rememberedId ? remembered : null);
      if (!terminalGame || !terminalGame.remoteNetworkTest) return false;

      window.__mountainRaceLastCompletedGame = terminalGame;
      duelLastActiveGame = terminalGame;
      rnbGame = terminalGame;
      if (duelPollTimer) {
        clearInterval(duelPollTimer);
        duelPollTimer = null;
      }
      try {
        if (typeof rnbTimer !== 'undefined' && rnbTimer) clearTimeout(rnbTimer);
      } catch {}
      try {
        if (typeof rnbCountdownTimer !== 'undefined' && rnbCountdownTimer) clearInterval(rnbCountdownTimer);
      } catch {}
      window.__duelPollRate = 0;
      return true;
    }`;

html = replaceNamedFunction(
  html,
  'function mountainRacePauseCompletedPolling(game)',
  helper,
  'Mountain Race terminal polling helper'
);

html = insertAtFunctionStart(
  html,
  'function rnbAdoptGame(',
  `   ${adoptMarker}\n   if(game&&game.mode==='mountainrace'&&['complete','cancelled'].includes(String(game.status||'')))window.__mountainRacePauseCompletedPolling?.(game);`,
  adoptMarker,
  'Remote Bot game adoption'
);

html = insertAtFunctionStart(
  html,
  'async function rnbPollOnce(',
  `   ${pollStartMarker}\n   if(window.__mountainRacePauseCompletedPolling?.(rnbGame||duelLastActiveGame||window.__mountainRaceLastCompletedGame||null))return;`,
  pollStartMarker,
  'Remote Bot poll loop'
);

html = insertAfterCallsInFunction(
  html,
  'async function rnbPollOnce(',
  'rnbAdoptGame',
  `   ${afterAdoptMarker}\n   if(window.__mountainRacePauseCompletedPolling?.(rnbGame||duelLastActiveGame||window.__mountainRaceLastCompletedGame||null))return;`,
  afterAdoptMarker,
  'Remote Bot poll loop'
);

if (!html.includes(marker)) {
  const anchor = html.includes('</body>') ? '</body>' : html.includes('</html>') ? '</html>' : '';
  html = anchor ? html.replace(anchor, `${marker}\n${anchor}`) : `${html}\n${marker}\n`;
}

html = html
  .replaceAll('mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=11', 'mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=12')
  .replaceAll('&sync=12&sync=12', '&sync=12');

for (const required of [
  marker,
  pollStartMarker,
  afterAdoptMarker,
  adoptMarker,
  'window.__mountainRaceLastCompletedGame = terminalGame;',
  'rnbGame = terminalGame;',
  "typeof rnbTimer !== 'undefined'",
  "typeof rnbCountdownTimer !== 'undefined'",
  'mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=12'
]) {
  if (!html.includes(required)) throw new Error(`Summit Sprint terminal-drain output is missing ${required}`);
}
await writeFile(indexUrl, html);

for (const validatorUrl of validatorUrls) {
  let source = await readFile(validatorUrl, 'utf8');
  source = source
    .replaceAll('mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=11', 'mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=12')
    .replaceAll('&sync=12&sync=12', '&sync=12');
  await writeFile(validatorUrl, source);
}

console.log('Added Summit Sprint Terminal Drain V12: terminal state now reaches the Remote Bot scheduler immediately, clears its pending wake timers, blocks new terminal polls, and exits an in-flight poll after its GET adopts a completed race before any no-op wake ACT can be sent.');
