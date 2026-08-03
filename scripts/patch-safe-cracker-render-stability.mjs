import { readFile, writeFile } from 'node:fs/promises';

const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const marker = '// SAFE_CRACKER_RENDER_STABILITY_V1_START';

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Safe Cracker render-stability patch could not find ${label}.`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Safe Cracker render-stability patch found more than one ${label}.`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

let client = await readFile(clientUrl, 'utf8');

for (const required of [
  '// SAFE_CRACKER_INPUT_CONTINUITY_V9_START',
  '// SAFE_CRACKER_LATCH_SEQUENCE_V1_HELPER',
  'function safeCrackerUpdateConfirmControl()',
  'class="sc-dial-reference-plate"',
  'function lockedCode(progress = {})',
  'function feedbackMeter(tier = \'\')'
]) {
  if (!client.includes(required)) {
    throw new Error(`Safe Cracker render stability requires the final generated runtime fragment: ${required}`);
  }
}

if (!client.includes(marker)) {
  const helper = String.raw`  ${marker}
  function safeCrackerReplaceMarkup(element, markup) {
    if (!element || !markup) return element;
    const template = document.createElement('template');
    template.innerHTML = String(markup).trim();
    const replacement = template.content.firstElementChild;
    if (!replacement) return element;
    element.replaceWith(replacement);
    return replacement;
  }

  function safeCrackerSetText(element, value) {
    if (!element) return;
    const next = String(value ?? '');
    if (element.textContent !== next) element.textContent = next;
  }

  function safeCrackerUpdateMountedBoard(game) {
    const mount = document.querySelector('[data-safe-cracker-mount]');
    const root = mount?.firstElementChild?.matches?.('.safe-cracker-game')
      ? mount.firstElementChild
      : mount?.querySelector?.('.safe-cracker-game');
    const gameId = String(game?.gameId || '');
    const mountedGameId = String(root?.dataset?.scGameId || '');
    const status = String(game?.status || '');
    const mountedStatus = String(root?.dataset?.scStatus || '');

    // Keep the already-painted, decoded dial and display DOM only while the same
    // active board remains in the playing lifecycle. Countdown and terminal
    // transitions still receive a clean full render and fresh event bindings.
    if (!root || !gameId || mountedGameId !== gameId || status !== 'playing' || mountedStatus !== 'playing') return false;

    const state = stateFor(game);
    const me = myState(game);
    const opponent = opponentState(game);
    const stage = Math.max(0, Math.min(STAGES, Number(me?.stage || 0)));
    const latest = runtime.feedbackResult || me?.lastResult || null;
    const displayTier = String(latest?.tier || 'idle');
    const displayText = latest ? tierLabel(latest.tier) : 'TURN THE DIAL';
    const attemptCount = Number(me?.attemptCount || 0);

    root.dataset.scStatus = status;
    root.classList.add('sc-stable-render');

    const meLights = root.querySelector('.sc-player-card.me .sc-progress-lights');
    if (meLights) meLights.innerHTML = progressLights(me);
    const opponentLights = root.querySelector('.sc-player-card.opponent .sc-progress-lights');
    if (opponentLights) opponentLights.innerHTML = progressLights(opponent);

    const playerCopy = root.querySelector('.sc-player-card.me .sc-player-copy');
    const existingCode = playerCopy?.querySelector('.sc-known-code');
    if (existingCode) {
      safeCrackerReplaceMarkup(existingCode, lockedCode(me));
    } else {
      playerCopy?.querySelector('.sc-progress-lights')?.insertAdjacentHTML('beforebegin', lockedCode(me));
    }

    const opponentStrip = root.querySelector('.sc-opponent-strip');
    if (opponentStrip) {
      for (const tier of ['red', 'orange', 'yellow', 'green']) opponentStrip.classList.remove(tier);
      const opponentTier = String(opponent?.lastTier || '');
      if (opponentTier) opponentStrip.classList.add(opponentTier);
      const raceProgress = opponentStrip.querySelector('.sc-race-progress');
      if (raceProgress) raceProgress.innerHTML = `<i aria-hidden="true"></i>${Math.min(STAGES, Number(opponent?.stage || 0))} / ${STAGES} LOCKS`;
      safeCrackerSetText(
        opponentStrip.querySelector('.sc-race-signal'),
        opponent?.completed ? 'SAFE OPEN' : opponentTier ? tierLabel(opponentTier) : 'SEARCHING'
      );
    }

    const display = root.querySelector('[data-sc-display]');
    if (display) {
      for (const tier of ['idle', 'red', 'orange', 'yellow', 'green', 'fresh']) display.classList.remove(tier);
      display.classList.add(displayTier);
      if (runtime.feedbackFresh) {
        void display.offsetWidth;
        display.classList.add('fresh');
      }
      safeCrackerSetText(display.querySelector('.sc-display-status'), displayText);
      safeCrackerSetText(display.querySelector('.sc-display-meta small'), `TUMBLER ${Math.min(STAGES, stage + 1)} OF ${STAGES}`);
      safeCrackerSetText(display.querySelector('.sc-display-meta b'), `${attemptCount} ${attemptCount === 1 ? 'ATTEMPT' : 'ATTEMPTS'}`);
      const meter = display.querySelector('.sc-feedback-meter');
      if (meter) safeCrackerReplaceMarkup(meter, feedbackMeter(displayTier));
    }

    const previousLatchStage = runtime.latchGameId === gameId
      ? Math.max(0, Math.min(STAGES, Number(runtime.latchStage || 0)))
      : 0;
    const releasingLatch = stage > previousLatchStage ? stage : 0;
    root.querySelectorAll('.sc-bolts.right .sc-latch-mount > i').forEach((latch, index) => {
      const latchNumber = index + 1;
      latch.classList.remove('sc-latch-releasing');
      latch.classList.toggle('sc-latch-released', stage >= latchNumber);
      if (releasingLatch === latchNumber) {
        void latch.offsetWidth;
        latch.classList.add('sc-latch-releasing');
      }
    });
    runtime.latchGameId = gameId;
    runtime.latchStage = stage;

    root.querySelector('.sc-safe-shell')?.classList.toggle('open', stage >= STAGES);

    const attemptPanel = root.querySelector('.sc-attempt-panel');
    if (attemptPanel) {
      safeCrackerSetText(attemptPanel.querySelector('h3 span'), `TUMBLER ${Math.min(STAGES, stage + 1)} LOG`);
      safeCrackerSetText(attemptPanel.querySelector('h3 b'), `${attemptCount} TOTAL`);
      const attemptList = attemptPanel.querySelector('.sc-attempt-list');
      if (attemptList) attemptList.innerHTML = attemptRows(me?.attempts || [], stage);
    }

    applyDialVisual();
    safeCrackerUpdateConfirmControl();
    return true;
  }
  // SAFE_CRACKER_RENDER_STABILITY_V1_END

`;

  client = replaceOnce(
    client,
    '  function render(game) {',
    `${helper}  function render(game) {`,
    'render helper insertion point'
  );

  client = replaceOnce(
    client,
    '    mount.innerHTML = `',
    '    const reusedMountedBoard = safeCrackerUpdateMountedBoard(game);\n    if (!reusedMountedBoard) {\n      mount.innerHTML = `',
    'full-board HTML replacement'
  );

  client = replaceOnce(
    client,
    '    runtime.feedbackFresh = false;\n    bindControls(mount, game);\n    updateTimerOnly();',
    '      bindControls(mount, game);\n    }\n    runtime.feedbackFresh = false;\n    updateTimerOnly();',
    'render completion and control binding'
  );
}

await writeFile(clientUrl, client);

let html = await readFile(indexUrl, 'utf8');
html = html.replace(/&render=\d+/g, '');
html = html.replace(/(\/assets\/safe-cracker\/safe-cracker\.(?:css|js)\?[^"'\s>]+)/g, '$1&render=1');
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker render stability v1: same-game playing updates patch the existing painted board in place, preserving the decoded dial and eliminating button-response flashes without changing authoritative gameplay.');
