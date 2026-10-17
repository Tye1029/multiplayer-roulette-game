import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const clientUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', root);
const actionUrl = new URL('netlify/functions/duel-action.js', root);
const indexUrl = new URL('index.html', root);

const clientMarker = '// MOUNTAIN_RACE_VISIBLE_GAMEPLAY_V1';
const cssMarker = '/* MOUNTAIN_RACE_VISIBLE_GAMEPLAY_V1 */';

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint visible-gameplay patch could not find ${label}.`);
  return source.replace(before, after);
}

let client = await readFile(clientUrl, 'utf8');

if (!client.includes(clientMarker)) {
  client = replaceRequired(
    client,
    "  'use strict';",
    `  'use strict';\n\n  ${clientMarker}`,
    'client marker'
  );

  client = replaceRequired(
    client,
    `    lastMyInputAt: '',
    lastOpponentInputAt: ''`,
    `    lastMyInputAt: '',
    lastOpponentInputAt: '',
    pendingInput: null`,
    'pending-input runtime state'
  );

  client = replaceRequired(
    client,
    `  function holdLeft(index) {`,
    `  function optimisticPresentation(publicState, prompts, total) {
    const authoritativeMe = player(publicState.me, 'YOU', 'YOU');
    const pending = runtime.pendingInput;
    if (!pending || pending.fromIndex !== authoritativeMe.promptIndex) {
      return {
        authoritativeMe,
        me: authoritativeMe,
        prompts,
        animation: '',
        tone: ''
      };
    }

    const correct = Boolean(pending.correct);
    return {
      authoritativeMe,
      me: {
        ...authoritativeMe,
        promptIndex: correct
          ? Math.min(total, authoritativeMe.promptIndex + 1)
          : authoritativeMe.promptIndex,
        lastInput: {
          control: pending.token,
          correct,
          at: pending.at
        }
      },
      prompts: correct ? prompts.slice(1) : prompts,
      animation: correct ? \`climb-\${pending.token}\` : 'slip',
      tone: correct ? 'correct' : 'wrong'
    };
  }

  function holdLeft(index) {`,
    'optimistic gameplay presentation helper'
  );

  client = replaceRequired(
    client,
    `  function statusText(publicState) {
    if (runtime.busy) return 'Checking that hold…';`,
    `  function statusText(publicState) {
    if (runtime.pendingInput) {
      return runtime.pendingInput.correct
        ? 'Correct direction — climbing now!'
        : 'Wrong direction — slipping!';
    }
    if (runtime.busy) return 'Confirming the move…';`,
    'instant input feedback text'
  );

  client = replaceRequired(
    client,
    `    const prompts = Array.isArray(publicState.prompts) ? publicState.prompts.map(control).slice(0, 4) : [];
    const me = player(publicState.me, 'YOU', 'YOU');
    const opponent = player(publicState.opponent, 'OPPONENT', publicState.opponent?.isBot ? 'CPU' : 'P2');
    const meAnimation = animationClass(me, runtime.lastMyInputAt, publicState.viewerWon && runtime.game.status === 'complete');
    const opponentAnimation = animationClass(opponent, runtime.lastOpponentInputAt, !publicState.viewerWon && !publicState.tie && runtime.game.status === 'complete');
    if (me.lastInput?.at) runtime.lastMyInputAt = me.lastInput.at;
    if (opponent.lastInput?.at) runtime.lastOpponentInputAt = opponent.lastInput.at;
    const controlsEnabled = runtime.game.status === 'playing' && publicState.canSubmit && !runtime.busy;
    const tone = me.lastInput ? (me.lastInput.correct ? 'correct' : 'wrong') : 'neutral';`,
    `    const authoritativePrompts = Array.isArray(publicState.prompts) ? publicState.prompts.map(control).slice(0, 4) : [];
    const presentation = optimisticPresentation(publicState, authoritativePrompts, total);
    const prompts = presentation.prompts;
    const authoritativeMe = presentation.authoritativeMe;
    const me = presentation.me;
    const opponent = player(publicState.opponent, 'OPPONENT', publicState.opponent?.isBot ? 'CPU' : 'P2');
    const meAnimation = presentation.animation || animationClass(authoritativeMe, runtime.lastMyInputAt, publicState.viewerWon && runtime.game.status === 'complete');
    const opponentAnimation = animationClass(opponent, runtime.lastOpponentInputAt, !publicState.viewerWon && !publicState.tie && runtime.game.status === 'complete');
    if (authoritativeMe.lastInput?.at) runtime.lastMyInputAt = authoritativeMe.lastInput.at;
    if (opponent.lastInput?.at) runtime.lastOpponentInputAt = opponent.lastInput.at;
    const controlsEnabled = runtime.game.status === 'playing' && publicState.canSubmit && !runtime.busy;
    const tone = presentation.tone || (authoritativeMe.lastInput ? (authoritativeMe.lastInput.correct ? 'correct' : 'wrong') : 'neutral');`,
    'optimistic render state'
  );

  const oldSubmit = `  async function submit(rawToken) {
    const publicState = state();
    const bridge = window.__mountainRaceBridge;
    if (!bridge?.submit || runtime.busy || runtime.game?.status !== 'playing' || !publicState.canSubmit) return;
    runtime.busy = true;
    render();
    try {
      const token = control(rawToken);
      const actionId = \`mr-\${Date.now()}-\${Math.random().toString(36).slice(2, 10)}\`;
      const data = await bridge.submit({ choice: \`mountainrace:input:\${token}\`, actionId });
      runtime.busy = false;
      if (data?.game) adopt(data.game);
      else bridge.refresh?.();
    } catch (error) {
      runtime.busy = false;
      const status = runtime.root?.querySelector('[data-mr-status]');
      if (status) {
        status.className = 'mr-status wrong';
        status.textContent = String(error?.message || 'Unable to submit that move.');
      }
      render();
    }
  }`;

  const newSubmit = `  async function submit(rawToken) {
    const publicState = state();
    const bridge = window.__mountainRaceBridge;
    if (!bridge?.submit || runtime.busy || runtime.game?.status !== 'playing' || !publicState.canSubmit) return;

    const prompts = Array.isArray(publicState.prompts) ? publicState.prompts.map(control) : [];
    if (!prompts.length) {
      bridge.refresh?.();
      return;
    }

    const token = control(rawToken);
    const expected = prompts[0];
    const fromIndex = Math.max(0, Math.trunc(Number(publicState.me?.promptIndex) || 0));
    const actionId = \`mr-\${Date.now()}-\${Math.random().toString(36).slice(2, 10)}\`;
    runtime.pendingInput = {
      token,
      expected,
      correct: token === expected,
      fromIndex,
      at: \`pending-\${actionId}\`
    };
    runtime.busy = true;
    if (navigator.vibrate) navigator.vibrate(token === expected ? 18 : [22, 30, 22]);
    render();

    try {
      const data = await bridge.submit({
        choice: \`mountainrace:input:\${token}\`,
        actionId,
        expectedPromptIndex: fromIndex
      });
      runtime.busy = false;
      if (data?.game) adopt(data.game);
      else {
        runtime.pendingInput = null;
        bridge.refresh?.();
      }
    } catch (error) {
      runtime.busy = false;
      runtime.pendingInput = null;
      render();
      const status = runtime.root?.querySelector('[data-mr-status]');
      if (status) {
        status.className = 'mr-status wrong';
        status.textContent = String(error?.message || 'Unable to submit that move.');
      }
    }
  }`;

  client = replaceRequired(client, oldSubmit, newSubmit, 'authoritative optimistic submit flow');

  client = replaceRequired(
    client,
    `  function adopt(game) {
    if (!game || game.mode !== MODE) return;
    runtime.game = game;
    runtime.busy = false;
    updateServerClock(game);
    render();
    startTicker();
  }`,
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
    'optimistic reconciliation'
  );
}

if (!client.includes(clientMarker)) throw new Error('Summit Sprint client marker is missing.');
if (!client.includes('expectedPromptIndex: fromIndex')) throw new Error('Summit Sprint input requests do not identify the visible prompt index.');
if (!client.includes('Correct direction — climbing now!')) throw new Error('Summit Sprint instant correct-input feedback is missing.');
await writeFile(clientUrl, client);

let css = await readFile(cssUrl, 'utf8');
css = replaceRequired(css, '  bottom: -1210px;\n  height: 1700px;', '  bottom: 0;\n  height: 1700px;', 'desktop course origin');
css = replaceRequired(css, '    bottom: -1290px;\n    left: 2%;', '    bottom: 0;\n    left: 2%;', 'mobile course origin');

if (!css.includes(cssMarker)) {
  const gameplayCss = `${cssMarker}
.mountain-race-game .mr-rock-hold.known b {
  opacity: 1;
  color: #fffdf3;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 1.24rem;
  font-weight: 900;
  filter: drop-shadow(0 2px 1px rgba(0,0,0,.8));
}

.mountain-race-game .mr-rock-hold.unknown b {
  opacity: .18;
}

.mountain-race-game .mr-climber {
  will-change: bottom, transform;
}

@media (max-width: 760px) {
  .mountain-race-game .mr-rock-hold.known b {
    font-size: 1.08rem;
  }
}`;
  const anchor = '@media (prefers-reduced-motion: reduce) {';
  if (!css.includes(anchor)) throw new Error('Summit Sprint CSS reduced-motion anchor is missing.');
  css = css.replace(anchor, `${gameplayCss}\n\n${anchor}`);
}

if (/bottom:\s*-(?:1210|1290)px/.test(css)) throw new Error('Summit Sprint still starts at the summit instead of the first hold.');
if (!css.includes('.mr-rock-hold.known b')) throw new Error('Summit Sprint mountain arrows are not visibly styled.');
await writeFile(cssUrl, css);

let action = await readFile(actionUrl, 'utf8');
action = replaceRequired(
  action,
  'expectedTurnId: body.expectedTurnId, expectedVisualKey: body.expectedVisualKey, asTestPlayer:',
  'expectedTurnId: body.expectedTurnId, expectedVisualKey: body.expectedVisualKey, expectedPromptIndex: body.expectedPromptIndex, asTestPlayer:',
  'expected prompt index routing'
);
if (!action.includes('expectedPromptIndex: body.expectedPromptIndex')) throw new Error('Summit Sprint prompt index is not routed to the server.');
await writeFile(actionUrl, action);

let html = await readFile(indexUrl, 'utf8');
html = html
  .replaceAll('mountain-race-multiplayer.js?v=1&gameplay=2', 'mountain-race-multiplayer.js?v=1&gameplay=3')
  .replaceAll('mountain-race-multiplayer.js?v=1', 'mountain-race-multiplayer.js?v=1&gameplay=3')
  .replaceAll('mountain-race.css?v=3&multiplayer=1&gameplay=2', 'mountain-race.css?v=3&multiplayer=1&gameplay=3')
  .replaceAll('mountain-race.css?v=3&multiplayer=1', 'mountain-race.css?v=3&multiplayer=1&gameplay=3');

// Collapse a repeated cache token if the build is intentionally run twice.
html = html
  .replaceAll('&gameplay=3&gameplay=3', '&gameplay=3')
  .replaceAll('&gameplay=3&gameplay=2', '&gameplay=3');

if (!html.includes('mountain-race-multiplayer.js?v=1&gameplay=3')) throw new Error('Summit Sprint JS cache boundary was not advanced.');
if (!html.includes('mountain-race.css?v=3&multiplayer=1&gameplay=3')) throw new Error('Summit Sprint CSS cache boundary was not advanced.');
await writeFile(indexUrl, html);

console.log('Fixed Summit Sprint visible gameplay: the first directional holds and climbers start inside the viewport, mountain arrows are readable, correct taps animate immediately, stale prompts are identified, and server confirmation reconciles the optimistic move.');
