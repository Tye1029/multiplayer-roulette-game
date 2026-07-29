(function (global) {
  'use strict';

  if (global.__rrAuthoritativeFacingGuardV2) return;
  global.__rrAuthoritativeFacingGuardV2 = true;

  const state = {
    scheduled: false,
    timer: 0,
    observer: null,
    inFlightKey: '',
    lastReason: '',
    blockedAnimations: 0,
    cancelledStaleRotations: 0,
    turnSoundsStarted: 0
  };

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

  function currentRoot(gameId) {
    try {
      return duelActive?.querySelector(
        `[data-roulette-game][data-game-id="${CSS.escape(String(gameId || ''))}"]`
      ) || null;
    } catch {
      return null;
    }
  }

  function authoritativeTurnId(game, root = currentRoot(game?.gameId)) {
    const gameTurnId = String(game?.rouletteState?.turnId || '');
    const rootTurnId = String(root?.dataset?.turnId || '');
    const rootRevision = Number(root?.dataset?.revision ?? -1);
    const gameRevision = Number(game?.rouletteState?.revision ?? -1);
    if (
      rootTurnId &&
      String(root?.dataset?.status || game?.status || '') === 'playing' &&
      rootRevision >= gameRevision
    ) return rootTurnId;
    return gameTurnId;
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

  function animationIsAuthorized(element) {
    const api = global.RouletteTurnLock;
    const lock = api?.lock;
    if (!lock || !element?.matches?.('[data-roulette-facing]')) return true;
    if (lock.opening) return true;
    const game = currentGame();
    const root = currentRoot(game?.gameId);
    const turnId = authoritativeTurnId(game, root);
    return Boolean(
      lock.pendingTurnId &&
      lock.pendingTurnId === turnId &&
      lock.animatingFacing === element
    );
  }

  function startTurnMovementSound() {
    const api = global.RouletteTurnLock;
    const lock = api?.lock;
    if (!lock || lock.opening || !lock.pendingTurnId) return;
    const game = currentGame();
    const gameId = String(game?.gameId || lock.gameId || '');
    const root = currentRoot(gameId);
    const turnId = authoritativeTurnId(game, root);
    if (!gameId || !turnId || turnId !== lock.pendingTurnId) return;
    const started = global.RouletteAudio?.turnRotate?.({
      gameId,
      fromTurnId: String(lock.turnId || ''),
      turnId,
      epoch: Number(lock.epoch || 0),
      duration: 1020
    });
    if (started === true) state.turnSoundsStarted += 1;
  }

  function installAnimationGate() {
    try {
      if (typeof rouletteAnimate !== 'function' || rouletteAnimate.__rrAuthoritativeFacingGateV2) return;
      const original = rouletteAnimate;
      const guarded = function (element, frames, timing) {
        const isFacing = element?.matches?.('[data-roulette-facing]');
        if (isFacing && !animationIsAuthorized(element)) {
          state.blockedAnimations += 1;
          element.getAnimations?.().forEach(animation => animation.cancel());
          scheduleReconcile('blocked-unauthorized-facing-animation');
          return Promise.resolve(null);
        }
        if (isFacing && !global.RouletteTurnLock?.lock?.opening) startTurnMovementSound();
        return original.call(this, element, frames, timing);
      };
      Object.defineProperty(guarded, '__rrAuthoritativeFacingGateV2', {
        value: true,
        configurable: true
      });
      rouletteAnimate = guarded;
      global.rouletteAnimate = guarded;
    } catch {}
  }

  async function reconcile(reason = 'poll') {
    state.lastReason = reason;
    installAnimationGate();

    const api = global.RouletteTurnLock;
    const game = currentGame();
    const gameId = String(game?.gameId || '');
    const root = currentRoot(gameId);
    const turnId = authoritativeTurnId(game, root);
    if (!api || !gameId || game?.status !== 'playing' || !turnId) return;

    if (!root) return;
    const layers = api.ensureLayers(root);
    if (!layers) return;

    const lock = api.lock;
    if (openingIsActive(root, lock)) return;

    // A shot is allowed to finish while still aimed at the shooter. As soon as
    // firing ends, the authoritative turn below is applied and permanently held.
    if (lock.firing) {
      if (lock.gameId === gameId && lock.turnId) api.enforceLockedFacing(gameId);
      return;
    }

    // The protected turn animator is the only code allowed to animate this layer.
    // During that one permitted rotation, enforceLockedFacing also handles a DOM
    // rerender without cancelling the active animation on the original element.
    if (lock.pendingTurnId) {
      if (lock.pendingTurnId === turnId) {
        api.enforceLockedFacing(gameId);
        return;
      }
      // A newer accepted snapshot changed the turn while an older rotation was
      // starting. Cancel that stale movement before it can visibly flip back.
      lock.epoch += 1;
      layers.facing.getAnimations?.().forEach(animation => animation.cancel());
      lock.pendingTurnId = '';
      lock.pendingAngle = lock.angle;
      lock.queuedTurnId = '';
      lock.animatingFacing = null;
      state.inFlightKey = '';
      state.cancelledStaleRotations += 1;
    }

    const targetAngle = angleForTurn(game, turnId);
    const lockIsWrong = (
      lock.gameId !== gameId ||
      lock.turnId !== turnId ||
      angleDistance(lock.angle, targetAngle) >= 0.5
    );

    if (lockIsWrong) {
      const key = `${gameId}:${turnId}`;
      if (state.inFlightKey === key) return;
      state.inFlightKey = key;
      try {
        await api.rotateToLockedTurn(game, gameId, turnId, 1020);
      } finally {
        if (state.inFlightKey === key) state.inFlightKey = '';
      }
      const newest = currentGame();
      if (
        String(newest?.gameId || '') === gameId &&
        authoritativeTurnId(newest, currentRoot(gameId)) === turnId &&
        !api.lock.opening &&
        !api.lock.firing &&
        !api.lock.pendingTurnId
      ) api.enforceLockedFacing(gameId);
      return;
    }

    // This is the hard rule: whenever no approved rotation or shot is running,
    // cancel every transform animation on the facing layer and reapply the exact
    // angle belonging to the authoritative current turn.
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
    installAnimationGate();
    scheduleReconcile('start');

    state.timer = global.setInterval(() => scheduleReconcile('hard-lock-poll'), 80);
    const Observer = global.MutationObserver;
    const root = document.body || document.documentElement;
    if (Observer && root) {
      state.observer = new Observer(() => scheduleReconcile('scene-mutation'));
      state.observer.observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'data-turn-id', 'data-status', 'data-roulette-opening']
      });
    }
  }

  global.RouletteFacingGuard = Object.freeze({
    reconcile: () => reconcile('manual'),
    diagnostics() {
      return {
        inFlightKey: state.inFlightKey,
        lastReason: state.lastReason,
        blockedAnimations: state.blockedAnimations,
        cancelledStaleRotations: state.cancelledStaleRotations,
        turnSoundsStarted: state.turnSoundsStarted,
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
