(function (global) {
  'use strict';

  if (global.__rrSingleRotationOwnerV3) return;
  global.__rrSingleRotationOwnerV3 = true;

  const diagnostics = Array.isArray(global.__rouletteFacingDiagnostics)
    ? global.__rouletteFacingDiagnostics
    : [];
  global.__rouletteFacingDiagnostics = diagnostics;

  const state = {
    scheduled: false,
    timer: 0,
    observer: null,
    acceptedByGame: new Map(),
    seenTokens: new Set(),
    pendingTransition: null,
    activeTransition: null,
    soundToken: '',
    lastReason: '',
    blockedAnimations: 0,
    cancelledRotations: 0,
    approvedRotations: 0,
    completedRotations: 0,
    turnSoundsStarted: 0
  };

  function recordDiagnostic(event, details = {}) {
    const entry = {
      at: new Date().toISOString(),
      event: String(event || 'unknown'),
      ...details
    };
    diagnostics.push(entry);
    if (diagnostics.length > 120) diagnostics.splice(0, diagnostics.length - 120);
    try {
      global.dispatchEvent(new CustomEvent('roulette-facing-diagnostic', { detail: entry }));
    } catch {}
    return entry;
  }

  function snapshotStamp(game) {
    return {
      gameRevision: Number(game?.revision ?? -1),
      rouletteRevision: Number(game?.rouletteState?.revision ?? -1),
      updatedAt: Date.parse(String(game?.updatedAt || '')) || 0
    };
  }

  function compareSnapshots(left, right) {
    const a = snapshotStamp(left);
    const b = snapshotStamp(right);
    if (a.gameRevision !== b.gameRevision) return a.gameRevision - b.gameRevision;
    if (a.rouletteRevision !== b.rouletteRevision) return a.rouletteRevision - b.rouletteRevision;
    return a.updatedAt - b.updatedAt;
  }

  function visualRuntime() {
    try {
      if (typeof rouletteVisualRuntime !== 'undefined') return rouletteVisualRuntime;
    } catch {}
    return global.rouletteVisualRuntime || null;
  }

  function mountedRoot() {
    try { return duelActive?.querySelector('[data-roulette-game]') || null; } catch { return null; }
  }

  function currentGame() {
    const candidates = [];
    try {
      if (typeof rouletteLatestGame !== 'undefined' && rouletteLatestGame?.mode === 'roulette') {
        candidates.push(rouletteLatestGame);
      }
    } catch {}
    try {
      if (typeof duelLastActiveGame !== 'undefined' && duelLastActiveGame?.mode === 'roulette') {
        candidates.push(duelLastActiveGame);
      }
    } catch {}
    if (!candidates.length) return null;

    const root = mountedRoot();
    const mountedGameId = String(root?.dataset?.gameId || '');
    const sameMountedGame = mountedGameId
      ? candidates.filter(game => String(game?.gameId || '') === mountedGameId)
      : candidates;
    const pool = sameMountedGame.length ? sameMountedGame : candidates;
    return pool.reduce((newest, game) => !newest || compareSnapshots(game, newest) > 0 ? game : newest, null);
  }

  function promoteSnapshot(game) {
    if (!game?.gameId) return;
    try {
      if (
        typeof duelLastActiveGame !== 'undefined' &&
        (!duelLastActiveGame || String(duelLastActiveGame?.gameId || '') !== String(game.gameId) || compareSnapshots(game, duelLastActiveGame) >= 0)
      ) duelLastActiveGame = game;
    } catch {}
    try {
      if (
        typeof rouletteLatestGame !== 'undefined' &&
        (!rouletteLatestGame || String(rouletteLatestGame?.gameId || '') !== String(game.gameId) || compareSnapshots(game, rouletteLatestGame) >= 0)
      ) rouletteLatestGame = game;
    } catch {}
  }

  function currentRoot(gameId) {
    try {
      return duelActive?.querySelector(
        `[data-roulette-game][data-game-id="${CSS.escape(String(gameId || ''))}"]`
      ) || null;
    } catch {
      return null;
    }
  }

  function authoritativeTurnId(game) {
    // The accepted server snapshot is the sole direction authority. Mounted DOM
    // data may be behind during a rerender and is never allowed to choose a turn.
    return String(game?.rouletteState?.turnId || '');
  }

  function normalizedAngle(value) {
    const angle = Number(value) || 0;
    return ((angle % 360) + 360) % 360;
  }

  function angleForTurn(game, turnId) {
    return normalizedAngle(
      String(turnId || '') === String(game?.creator?.userId || '') ? -4 : 176
    );
  }

  function angleDistance(left, right) {
    return Math.abs(((((normalizedAngle(right) - normalizedAngle(left)) % 360) + 540) % 360) - 180);
  }

  function openingIsActive(root, lock) {
    if (lock?.opening) return true;
    if (root?.classList.contains('rr-opening-active')) return true;
    return String(root?.dataset?.rouletteOpening || '') === '1';
  }

  function transitionToken(gameId, fromTurnId, turnId, rouletteRevision) {
    return `${String(gameId || '')}:${String(fromTurnId || '')}>${String(turnId || '')}:${Number(rouletteRevision ?? -1)}`;
  }

  function rememberToken(token) {
    if (!token) return;
    state.seenTokens.add(token);
    if (state.seenTokens.size > 80) {
      const oldest = state.seenTokens.values().next().value;
      state.seenTokens.delete(oldest);
    }
  }

  function observeAcceptedSnapshot(game, turnId) {
    const gameId = String(game?.gameId || '');
    if (!gameId || !turnId) return null;
    const next = {
      gameId,
      turnId,
      status: String(game?.status || ''),
      gameRevision: Number(game?.revision ?? -1),
      rouletteRevision: Number(game?.rouletteState?.revision ?? -1),
      updatedAt: Date.parse(String(game?.updatedAt || '')) || 0
    };
    const previous = state.acceptedByGame.get(gameId) || null;
    if (previous) {
      if (next.gameRevision < previous.gameRevision) return null;
      if (next.gameRevision === previous.gameRevision && next.rouletteRevision < previous.rouletteRevision) return null;
      if (
        next.gameRevision === previous.gameRevision &&
        next.rouletteRevision === previous.rouletteRevision &&
        next.updatedAt < previous.updatedAt
      ) return null;
    }
    state.acceptedByGame.set(gameId, next);
    if (
      !previous ||
      previous.status !== 'playing' ||
      next.status !== 'playing' ||
      !previous.turnId ||
      previous.turnId === next.turnId ||
      next.rouletteRevision <= previous.rouletteRevision
    ) return null;

    const token = transitionToken(gameId, previous.turnId, next.turnId, next.rouletteRevision);
    return { ...next, fromTurnId: previous.turnId, token };
  }

  function setRuntimeFacing(gameId, turnId, angle) {
    const runtime = visualRuntime();
    if (!runtime) return;
    runtime.currentAngle = normalizedAngle(angle);
    runtime.angleHydrated = true;
    runtime.lastTurnId = String(turnId || '');
    runtime.displayTurnId = String(turnId || '');
    runtime.rotationTargetId = '';
    if (!runtime.gameId) runtime.gameId = String(gameId || '');
  }

  function clearProtectedPending(lock) {
    if (!lock) return;
    lock.pendingTurnId = '';
    lock.pendingAngle = lock.angle;
    lock.queuedTurnId = '';
    lock.animatingFacing = null;
  }

  function snapFacing(game, turnId, reason = 'authoritative-snap', shouldLog = false) {
    const api = global.RouletteTurnLock;
    const gameId = String(game?.gameId || '');
    const root = currentRoot(gameId);
    if (!api || !root || !turnId) return false;
    const layers = api.ensureLayers(root);
    if (!layers) return false;
    const targetAngle = angleForTurn(game, turnId);
    const lock = api.lock;
    lock.epoch += 1;
    layers.facing.getAnimations?.().forEach(animation => animation.cancel());
    api.applyFacing(layers, targetAngle, turnId, true);
    lock.gameId = gameId;
    lock.turnId = String(turnId);
    lock.angle = targetAngle;
    clearProtectedPending(lock);
    setRuntimeFacing(gameId, turnId, targetAngle);
    root.dataset.rouletteAuthoritativeTurnId = String(turnId);
    root.dataset.rouletteAuthoritativeAngle = String(targetAngle);
    if (shouldLog) recordDiagnostic('snap', { reason, gameId, turnId: String(turnId), angle: targetAngle });
    return true;
  }

  function cancelTransition(reason, game = currentGame(), turnId = authoritativeTurnId(game)) {
    const api = global.RouletteTurnLock;
    const transition = state.activeTransition || state.pendingTransition;
    if (transition) {
      recordDiagnostic('cancelled', {
        reason,
        token: transition.token,
        gameId: transition.gameId,
        fromTurnId: transition.fromTurnId,
        turnId: transition.turnId,
        authoritativeTurnId: String(turnId || '')
      });
      state.cancelledRotations += 1;
    }
    const lock = api?.lock;
    if (lock) {
      lock.epoch += 1;
      try { api.ensureLayers(currentRoot(lock.gameId))?.facing?.getAnimations?.().forEach(animation => animation.cancel()); } catch {}
      clearProtectedPending(lock);
    }
    state.pendingTransition = null;
    state.activeTransition = null;
    state.soundToken = '';
    if (game?.gameId && turnId) snapFacing(game, turnId, reason, false);
  }

  function animationIsAuthorized(element) {
    const api = global.RouletteTurnLock;
    const lock = api?.lock;
    if (!lock || !element?.matches?.('[data-roulette-facing]')) return true;
    if (lock.opening) return true;
    const active = state.activeTransition;
    const game = currentGame();
    const turnId = authoritativeTurnId(game);
    return Boolean(
      active &&
      lock.pendingTurnId &&
      lock.pendingTurnId === active.turnId &&
      active.turnId === turnId &&
      lock.animatingFacing === element
    );
  }

  function startTurnMovementSound() {
    const active = state.activeTransition;
    const api = global.RouletteTurnLock;
    const lock = api?.lock;
    if (!active || !lock || lock.opening || state.soundToken === active.token) return;
    const game = currentGame();
    if (
      String(game?.gameId || '') !== active.gameId ||
      game?.status !== 'playing' ||
      authoritativeTurnId(game) !== active.turnId
    ) return;
    state.soundToken = active.token;
    const started = global.RouletteAudio?.turnRotate?.({
      gameId: active.gameId,
      fromTurnId: active.fromTurnId,
      turnId: active.turnId,
      epoch: Number(lock.epoch || 0),
      duration: 1020,
      rotationToken: active.token
    });
    if (started === true) state.turnSoundsStarted += 1;
  }

  function installAnimationGate() {
    try {
      if (typeof rouletteAnimate !== 'function' || rouletteAnimate.__rrSingleRotationAnimationGateV3) return;
      const original = rouletteAnimate;
      const guarded = function (element, frames, timing) {
        const isFacing = element?.matches?.('[data-roulette-facing]');
        if (isFacing && !animationIsAuthorized(element)) {
          state.blockedAnimations += 1;
          element.getAnimations?.().forEach(animation => animation.cancel());
          recordDiagnostic('blocked', {
            reason: 'unauthorized-facing-animation',
            gameId: String(currentGame()?.gameId || ''),
            authoritativeTurnId: authoritativeTurnId(currentGame())
          });
          scheduleReconcile('blocked-unauthorized-facing-animation');
          return Promise.resolve(null);
        }
        if (isFacing && !global.RouletteTurnLock?.lock?.opening) startTurnMovementSound();
        return original.call(this, element, frames, timing);
      };
      Object.defineProperty(guarded, '__rrSingleRotationAnimationGateV3', { value: true, configurable: true });
      rouletteAnimate = guarded;
      global.rouletteAnimate = guarded;
    } catch {}
  }

  function installLegacyRotationBlock() {
    try {
      if (typeof rouletteRotateToTurn !== 'function' || rouletteRotateToTurn.__rrLegacyRotationBlockedV3) return;
      const blocked = async function (_game, _state, gameId, options = {}) {
        state.blockedAnimations += 1;
        recordDiagnostic('blocked', {
          reason: 'legacy-rotation-api',
          gameId: String(gameId || currentGame()?.gameId || ''),
          turnId: String(options?.targetTurnId || '')
        });
        scheduleReconcile('blocked-legacy-rotation-api');
        return null;
      };
      Object.defineProperty(blocked, '__rrLegacyRotationBlockedV3', { value: true, configurable: true });
      rouletteRotateToTurn = blocked;
      global.rouletteRotateToTurn = blocked;
    } catch {}
  }

  function installBindGate() {
    try {
      if (typeof rouletteBind !== 'function' || rouletteBind.__rrSingleRotationBindGateV3) return;
      const original = rouletteBind;
      const guarded = function (...args) {
        const runtime = visualRuntime();
        const priorBusy = runtime?.busy;
        if (runtime) runtime.busy = true;
        try {
          return original.apply(this, args);
        } finally {
          if (runtime) runtime.busy = priorBusy;
          scheduleReconcile('roulette-bind-complete');
        }
      };
      Object.defineProperty(guarded, '__rrSingleRotationBindGateV3', { value: true, configurable: true });
      rouletteBind = guarded;
      global.rouletteBind = guarded;
    } catch {}
  }

  function installSingleOwnerGates() {
    installAnimationGate();
    installLegacyRotationBlock();
    installBindGate();
  }

  function lockMatches(gameId, turnId, targetAngle) {
    const lock = global.RouletteTurnLock?.lock;
    return Boolean(
      lock &&
      lock.gameId === String(gameId || '') &&
      lock.turnId === String(turnId || '') &&
      angleDistance(lock.angle, targetAngle) < 0.5 &&
      !lock.pendingTurnId
    );
  }

  async function runPendingTransition() {
    const transition = state.pendingTransition;
    const api = global.RouletteTurnLock;
    const game = currentGame();
    const runtime = visualRuntime();
    if (!transition || !api || !game) return;

    const turnId = authoritativeTurnId(game);
    const lock = api.lock;
    if (
      String(game.gameId || '') !== transition.gameId ||
      game.status !== 'playing' ||
      turnId !== transition.turnId ||
      Number(game?.rouletteState?.revision ?? -1) < transition.rouletteRevision
    ) {
      cancelTransition('transition-no-longer-authoritative', game, turnId);
      return;
    }
    if (openingIsActive(currentRoot(transition.gameId), lock) || lock.firing || runtime?.busy) return;
    if (state.seenTokens.has(transition.token)) {
      recordDiagnostic('blocked', { reason: 'duplicate-rotation-token', ...transition });
      state.pendingTransition = null;
      snapFacing(game, turnId, 'duplicate-token-snap', false);
      return;
    }

    rememberToken(transition.token);
    state.pendingTransition = null;
    state.activeTransition = transition;
    state.soundToken = '';
    state.approvedRotations += 1;
    recordDiagnostic('approved', transition);
    promoteSnapshot(game);

    try {
      await api.rotateToLockedTurn(game, transition.gameId, transition.turnId, 1020);
      const newest = currentGame();
      const newestTurnId = authoritativeTurnId(newest);
      if (
        String(newest?.gameId || '') === transition.gameId &&
        newest?.status === 'playing' &&
        newestTurnId === transition.turnId
      ) {
        state.completedRotations += 1;
        recordDiagnostic('completed', transition);
        snapFacing(newest, newestTurnId, 'rotation-completed', false);
      } else {
        cancelTransition('rotation-finished-after-state-changed', newest, newestTurnId);
      }
    } catch (error) {
      cancelTransition('rotation-threw', currentGame(), authoritativeTurnId(currentGame()));
      recordDiagnostic('blocked', { reason: 'rotation-error', token: transition.token, message: String(error?.message || error) });
    } finally {
      if (state.activeTransition?.token === transition.token) state.activeTransition = null;
      state.soundToken = '';
    }
  }

  async function reconcile(reason = 'poll') {
    state.lastReason = reason;
    installSingleOwnerGates();

    const api = global.RouletteTurnLock;
    const game = currentGame();
    const gameId = String(game?.gameId || '');
    const turnId = authoritativeTurnId(game);
    if (!api || !gameId || !turnId) return;
    promoteSnapshot(game);

    const root = currentRoot(gameId);
    if (!root) return;
    const lock = api.lock;
    const transition = observeAcceptedSnapshot(game, turnId);

    if (game.status !== 'playing') {
      if (state.pendingTransition || state.activeTransition || lock.pendingTurnId) {
        cancelTransition(`status-${String(game.status || 'unknown')}`, game, turnId);
      }
      snapFacing(game, turnId, 'non-playing-final-lock', !lockMatches(gameId, turnId, angleForTurn(game, turnId)));
      return;
    }

    if (openingIsActive(root, lock)) return;

    if (transition) {
      if (state.pendingTransition && state.pendingTransition.token !== transition.token) {
        recordDiagnostic('cancelled', { reason: 'superseded-before-start', ...state.pendingTransition });
        state.cancelledRotations += 1;
      }
      state.pendingTransition = transition;
      recordDiagnostic('requested', transition);
    }

    if (state.pendingTransition) {
      await runPendingTransition();
      return;
    }

    const targetAngle = angleForTurn(game, turnId);
    if (!lockMatches(gameId, turnId, targetAngle)) {
      // A mismatch without a new accepted turn-transition token is a rerender,
      // reload, stale animation, or completion residue. Correct it instantly.
      snapFacing(game, turnId, 'mismatch-without-transition-token', true);
      return;
    }

    api.enforceLockedFacing(gameId);
    root.dataset.rouletteAuthoritativeTurnId = turnId;
    root.dataset.rouletteAuthoritativeAngle = String(targetAngle);
  }

  function scheduleReconcile(reason = 'mutation') {
    state.lastReason = reason;
    if (state.scheduled) return;
    state.scheduled = true;
    requestAnimationFrame(() => {
      state.scheduled = false;
      reconcile(state.lastReason).catch(() => {});
    });
  }

  function start() {
    installSingleOwnerGates();
    scheduleReconcile('start');

    state.timer = global.setInterval(() => scheduleReconcile('single-owner-poll'), 80);
    const Observer = global.MutationObserver;
    const root = document.body || document.documentElement;
    if (Observer && root) {
      state.observer = new Observer(() => scheduleReconcile('scene-mutation'));
      state.observer.observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'data-turn-id', 'data-status', 'data-revision', 'data-roulette-opening']
      });
    }
  }

  global.RouletteFacingGuard = Object.freeze({
    reconcile: () => reconcile('manual'),
    diagnostics() {
      return {
        pendingTransition: state.pendingTransition,
        activeTransition: state.activeTransition,
        lastReason: state.lastReason,
        blockedAnimations: state.blockedAnimations,
        cancelledRotations: state.cancelledRotations,
        approvedRotations: state.approvedRotations,
        completedRotations: state.completedRotations,
        turnSoundsStarted: state.turnSoundsStarted,
        recent: diagnostics.slice(-40),
        timerActive: Boolean(state.timer),
        observerActive: Boolean(state.observer)
      };
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  global.addEventListener('pagehide', () => {
    clearInterval(state.timer);
    state.observer?.disconnect();
  }, { once: true });
})(window);
