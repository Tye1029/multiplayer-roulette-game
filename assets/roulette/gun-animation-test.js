(function () {
  'use strict';

  const game = document.querySelector('[data-roulette-game]');
  const gun = document.getElementById('testGun');
  const status = document.getElementById('sequenceStatus');
  const overall = document.getElementById('overallResult');
  const turnCountElement = document.getElementById('turnCount');
  const recoilCountElement = document.getElementById('recoilCount');
  const currentStepElement = document.getElementById('currentStep');
  const logElement = document.getElementById('testLog');
  const toggleLoopButton = document.getElementById('toggleLoop');
  const resetButton = document.getElementById('resetTest');
  const manualButtons = Array.from(document.querySelectorAll('[data-test-action]'));

  if (!game || !gun || !status || !overall) return;

  const seenAnimations = new WeakSet();
  let turnCount = 0;
  let recoilCount = 0;
  let turnRevision = 0;
  let shotRevision = 0;
  let automatic = true;
  let loopToken = 0;
  let failures = 0;
  let monitorFrame = 0;
  let manualBusy = false;
  let manualTakeoverPending = false;

  const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

  function writeLog(message, state = '') {
    const item = document.createElement('li');
    item.textContent = `${new Date().toLocaleTimeString()} — ${message}`;
    if (state) item.className = state;
    logElement.prepend(item);
    while (logElement.children.length > 18) logElement.lastElementChild?.remove();
  }

  function updateDiagnostics() {
    turnCountElement.textContent = String(turnCount);
    recoilCountElement.textContent = String(recoilCount);

    if (failures > 0) {
      overall.textContent = 'FAIL';
      overall.className = 'result fail';
    } else if (turnCount >= 2 && recoilCount >= 2) {
      overall.textContent = 'PASS';
      overall.className = 'result pass';
    } else {
      overall.textContent = 'RUNNING';
      overall.className = 'result pending';
    }
  }

  function inspectProductionAnimations() {
    for (const animation of gun.getAnimations()) {
      if (seenAnimations.has(animation)) continue;
      seenAnimations.add(animation);

      let keyframes = [];
      try {
        keyframes = animation.effect?.getKeyframes?.() || [];
      } catch {}

      const serialized = JSON.stringify(keyframes);
      if (/"rotate"/.test(serialized)) {
        turnCount += 1;
        writeLog('Production turn rotation detected.', 'pass');
      }
      if (/"translate"/.test(serialized)) {
        recoilCount += 1;
        writeLog('Production recoil animation detected.', 'pass');
      }
    }
    updateDiagnostics();
    monitorFrame = requestAnimationFrame(inspectProductionAnimations);
  }

  function setStep(label, message) {
    currentStepElement.textContent = label;
    status.textContent = message;
  }

  function setTurn(owner) {
    const opponent = owner === 'opponent';
    turnRevision += 1;
    gun.style.setProperty('--base-angle', opponent ? '180deg' : '0deg');
    game.dataset.currentTurn = owner;
    game.dataset.currentTurnRevision = String(turnRevision);
    setStep(opponent ? 'Opponent turn' : 'Your turn', opponent ? "Opponent's turn" : 'Your turn');
  }

  function fire(owner) {
    const opponent = owner === 'opponent';
    shotRevision += 1;
    gun.dataset.shotRevision = String(shotRevision);
    gun.classList.remove('firing');
    void gun.offsetWidth;
    gun.classList.add('firing');
    setStep(opponent ? 'Opponent fires' : 'You fire', opponent ? 'Opponent fires — BANG' : 'You fire — BANG');
    setTimeout(() => gun.classList.remove('firing'), 360);
  }

  async function expectAnimation(type, action, label, isCancelled = () => false) {
    const before = type === 'turn' ? turnCount : recoilCount;
    action();

    const timeout = type === 'turn' ? 1050 : 800;
    const deadline = performance.now() + timeout;
    while (performance.now() < deadline) {
      if (isCancelled()) return null;
      const current = type === 'turn' ? turnCount : recoilCount;
      if (current > before) {
        writeLog(`${label}: ${type} check passed.`, 'pass');
        return true;
      }
      await wait(40);
    }

    if (isCancelled()) return null;
    failures += 1;
    writeLog(`${label}: no ${type} animation was detected.`, 'fail');
    updateDiagnostics();
    return false;
  }

  async function runAutomaticLoop(token) {
    const cancelled = () => !automatic || token !== loopToken;

    while (!cancelled()) {
      setTurn('local');
      await wait(950);
      if (cancelled()) break;

      await expectAnimation('recoil', () => fire('local'), 'Local firing', cancelled);
      await wait(850);
      if (cancelled()) break;

      await expectAnimation('turn', () => setTurn('opponent'), 'Opponent turn change', cancelled);
      await wait(950);
      if (cancelled()) break;

      await expectAnimation('recoil', () => fire('opponent'), 'Opponent firing', cancelled);
      await wait(850);
      if (cancelled()) break;

      await expectAnimation('turn', () => setTurn('local'), 'Return to local turn', cancelled);
      await wait(1100);
    }
  }

  function startAutomaticLoop() {
    if (manualBusy) return;
    automatic = true;
    manualTakeoverPending = false;
    loopToken += 1;
    toggleLoopButton.textContent = 'Pause automatic loop';
    runAutomaticLoop(loopToken);
  }

  function stopAutomaticLoop() {
    if (automatic) {
      automatic = false;
      loopToken += 1;
      manualTakeoverPending = true;
      writeLog('Automatic loop paused. Waiting for the current animation to settle.');
    }
    toggleLoopButton.textContent = 'Resume automatic loop';
  }

  function setManualControlsDisabled(disabled) {
    manualButtons.forEach(button => { button.disabled = disabled; });
    resetButton.disabled = disabled;
    toggleLoopButton.disabled = disabled;
  }

  async function runManualAction(action) {
    if (manualBusy) {
      writeLog('Manual input ignored because another test action is still running.');
      return;
    }

    stopAutomaticLoop();
    manualBusy = true;
    setManualControlsDisabled(true);

    try {
      if (manualTakeoverPending) {
        manualTakeoverPending = false;
        await wait(950);
      }

      switch (action) {
        case 'local-turn':
          await expectAnimation('turn', () => setTurn('local'), 'Manual local turn');
          break;
        case 'local-fire':
          await expectAnimation('recoil', () => fire('local'), 'Manual local firing');
          break;
        case 'opponent-turn':
          await expectAnimation('turn', () => setTurn('opponent'), 'Manual opponent turn');
          break;
        case 'opponent-fire':
          await expectAnimation('recoil', () => fire('opponent'), 'Manual opponent firing');
          break;
      }

      await wait(380);
    } finally {
      manualBusy = false;
      setManualControlsDisabled(false);
    }
  }

  function resetDiagnostics() {
    stopAutomaticLoop();
    failures = 0;
    turnCount = 0;
    recoilCount = 0;
    turnRevision = 0;
    shotRevision = 0;
    logElement.replaceChildren();
    gun.removeAttribute('data-shot-revision');
    game.removeAttribute('data-current-turn-revision');
    gun.classList.remove('firing');
    setTurn('local');
    updateDiagnostics();
    writeLog('Diagnostics reset. Starting a fresh automatic sequence.');
    setTimeout(startAutomaticLoop, 500);
  }

  toggleLoopButton.addEventListener('click', () => {
    if (automatic) stopAutomaticLoop();
    else startAutomaticLoop();
  });

  resetButton.addEventListener('click', resetDiagnostics);
  manualButtons.forEach(button => {
    button.addEventListener('click', () => runManualAction(button.dataset.testAction));
  });

  window.addEventListener('beforeunload', () => cancelAnimationFrame(monitorFrame), { once: true });

  setTurn('local');
  updateDiagnostics();
  inspectProductionAnimations();
  writeLog('Isolated test initialized. Waiting for production controller events.');
  setTimeout(startAutomaticLoop, 400);
})();
