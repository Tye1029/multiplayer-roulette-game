import { readFile, writeFile } from 'node:fs/promises';

const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const jsStart = '// SAFE_CRACKER_INPUT_CONTINUITY_V9_START';

function replaceRequired(source, before, after, label) {
  if (after && source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Safe Cracker input-continuity patch could not find ${label}.`);
  return source.replace(before, after);
}

let client = await readFile(clientUrl, 'utf8');
if (!client.includes(jsStart)) {
  client = replaceRequired(
    client,
    "    countdownProgressLabel: ''",
    "    countdownProgressLabel: '',\n    cooldownGameId: '',\n    cooldownUntilMs: 0,\n    cooldownReleaseTimer: 0,\n    pendingDragGame: null",
    'input-continuity runtime state'
  );

  const helpers = [
    `  ${jsStart}`,
    '  function safeCrackerResetLocalCooldown() {',
    '    if (runtime.cooldownReleaseTimer) window.clearTimeout(runtime.cooldownReleaseTimer);',
    '    runtime.cooldownReleaseTimer = 0;',
    "    runtime.cooldownGameId = '';",
    '    runtime.cooldownUntilMs = 0;',
    '  }',
    '',
    '  function safeCrackerLocalCooldownReleased(game = runtime.game) {',
    "    const gameId = String(game?.gameId || '');",
    '    return Boolean(',
    '      gameId &&',
    '      runtime.cooldownGameId === gameId &&',
    '      runtime.cooldownUntilMs > 0 &&',
    '      Date.now() >= runtime.cooldownUntilMs',
    '    );',
    '  }',
    '',
    '  function safeCrackerCooldownActive(game = runtime.game) {',
    "    const gameId = String(game?.gameId || '');",
    '    if (gameId && runtime.cooldownGameId === gameId && runtime.cooldownUntilMs > 0) {',
    '      return Date.now() < runtime.cooldownUntilMs;',
    '    }',
    '    return Number(stateFor(game)?.cooldownMs || 0) > 0;',
    '  }',
    '',
    '  function safeCrackerCanSubmit(game = runtime.game) {',
    '    const state = stateFor(game);',
    '    const me = myState(game);',
    '    const serverReady = Boolean(state?.canSubmit);',
    '    const locallyReleased = safeCrackerLocalCooldownReleased(game);',
    '    return Boolean(',
    "      game?.status === 'playing' &&",
    '      !runtime.busy &&',
    '      Number(me?.stage || 0) < STAGES &&',
    '      (serverReady || locallyReleased)',
    '    );',
    '  }',
    '',
    '  function safeCrackerUpdateConfirmControl() {',
    "    const button = document.querySelector('[data-sc-confirm]');",
    '    if (!button || !runtime.game) return;',
    '    const game = runtime.game;',
    '    const available = safeCrackerCanSubmit(game);',
    '    const cooling = safeCrackerCooldownActive(game);',
    '    const label = button.querySelector(\'span\');',
    '    button.disabled = !available;',
    "    button.classList.toggle('busy', runtime.busy);",
    '    if (!label) return;',
    "    label.textContent = runtime.busy",
    "      ? 'CHECKING…'",
    "      : game.status === 'countdown'",
    "        ? 'LOCKED'",
    "        : game.status === 'complete'",
    "          ? 'COMPLETE'",
    '          : cooling',
    "            ? 'RESETTING…'",
    '            : available',
    "              ? 'CHECK NUMBER'",
    "              : 'WAITING';",
    '  }',
    '',
    '  function safeCrackerArmLocalCooldown(game, cooldownMs) {',
    "    const gameId = String(game?.gameId || '');",
    '    if (!gameId) return;',
    '    if (runtime.cooldownReleaseTimer) window.clearTimeout(runtime.cooldownReleaseTimer);',
    '    const remaining = Math.max(0, Number(cooldownMs || 0));',
    '    runtime.cooldownGameId = gameId;',
    '    runtime.cooldownUntilMs = Date.now() + remaining + 90;',
    '    runtime.cooldownReleaseTimer = window.setTimeout(() => {',
    '      runtime.cooldownReleaseTimer = 0;',
    '      if (runtime.cooldownGameId !== gameId) return;',
    '      safeCrackerUpdateConfirmControl();',
    '      // Refresh in the background for opponent progress, but local input no longer',
    '      // waits for this request to finish before becoming usable again.',
    '      window.__safeCrackerBridge?.refresh?.();',
    '    }, remaining + 95);',
    '  }',
    '  // SAFE_CRACKER_INPUT_CONTINUITY_V9_END',
    '',
    ''
  ].join('\n');

  client = replaceRequired(
    client,
    '  function resultOverlay(game) {',
    `${helpers}  function resultOverlay(game) {`,
    'input-continuity helper insertion'
  );

  client = replaceRequired(
    client,
    '  function render(game) {\n    runtime.game = game;',
    `  function render(game) {
    const incomingGameId = String(game?.gameId || '');
    if (runtime.cooldownGameId && runtime.cooldownGameId !== incomingGameId) safeCrackerResetLocalCooldown();
    if (game?.status === 'complete') safeCrackerResetLocalCooldown();
    runtime.game = game;`,
    'cooldown lifecycle reset'
  );

  client = replaceRequired(
    client,
    `    const canSubmit = Boolean(game.status === 'playing' && state.canSubmit && !runtime.busy && Number(me.stage || 0) < STAGES);
    const cooldownActive = Number(state.cooldownMs || 0) > 0;`,
    `    const canSubmit = safeCrackerCanSubmit(game);
    const cooldownActive = safeCrackerCooldownActive(game);`,
    'local cooldown render state'
  );

  client = replaceRequired(
    client,
    `        animateDialSettle(releasedRotation, runtime.rotation, runtime.lastDragDirection);
        runtime.lastDragDirection = 0;
        event.preventDefault();`,
    `        animateDialSettle(releasedRotation, runtime.rotation, runtime.lastDragDirection);
        runtime.lastDragDirection = 0;
        const pendingGame = runtime.pendingDragGame;
        runtime.pendingDragGame = null;
        if (pendingGame) render(pendingGame);
        event.preventDefault();`,
    'queued polling snapshot release after drag'
  );

  client = replaceRequired(
    client,
    `    const bridge = window.__safeCrackerBridge;
    const state = stateFor(game);
    if (!bridge?.submit || runtime.busy || game.status !== 'playing' || !state.canSubmit) return;`,
    `    const bridge = window.__safeCrackerBridge;
    const activeGame = runtime.game || game;
    if (!bridge?.submit || runtime.busy || !safeCrackerCanSubmit(activeGame)) return;`,
    'local cooldown submission gate'
  );

  client = replaceRequired(
    client,
    `      const nextGame = data?.game || runtime.game;
      const result = nextGame?.safecrackerState?.me?.lastResult;
      if (result?.at && result.at !== myState(game)?.lastResult?.at) playFeedback(result.tier);
      runtime.busy = false;
      render(nextGame);
      const cooldown = Number(nextGame?.safecrackerState?.cooldownMs || 0);
      if (cooldown > 0) window.setTimeout(() => window.__safeCrackerBridge?.refresh?.(), cooldown + 30);`,
    `      const nextGame = data?.game || runtime.game || activeGame;
      const result = nextGame?.safecrackerState?.me?.lastResult;
      if (result?.at && result.at !== myState(activeGame)?.lastResult?.at) playFeedback(result.tier);
      runtime.busy = false;
      safeCrackerArmLocalCooldown(nextGame, Number(nextGame?.safecrackerState?.cooldownMs || 0));
      render(nextGame);
      safeCrackerUpdateConfirmControl();`,
    'network-independent cooldown release'
  );

  client = replaceRequired(
    client,
    `  window.addEventListener(STATE_EVENT, event => {
    const game = event?.detail?.game;
    if (!game || game.mode !== 'safecracker') return;
    render(game);
    startTicker();
  });`,
    `  window.addEventListener(STATE_EVENT, event => {
    const game = event?.detail?.game;
    if (!game || game.mode !== 'safecracker') return;
    if (runtime.dragging) {
      runtime.pendingDragGame = game;
      runtime.game = game;
      updateClock(game);
      startTicker();
      return;
    }
    render(game);
    startTicker();
  });`,
    'non-destructive polling during dial drag'
  );
}

await writeFile(clientUrl, client);

let html = await readFile(indexUrl, 'utf8');
html = html.replaceAll(
  '/assets/safe-cracker/safe-cracker.css?v=8&polish=2&fit=2&result=1&final=1&refine=1&correct=1',
  '/assets/safe-cracker/safe-cracker.css?v=8&polish=2&fit=2&result=1&final=1&refine=1&correct=1&input=1'
);
html = html.replaceAll(
  '/assets/safe-cracker/safe-cracker.js?v=8&polish=2&fit=2&result=1&final=1&refine=1&correct=1',
  '/assets/safe-cracker/safe-cracker.js?v=8&polish=2&fit=2&result=1&final=1&refine=1&correct=1&input=1'
);
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker input continuity v9: cooldown release is local and polling cannot rebuild the dial during an active drag.');
