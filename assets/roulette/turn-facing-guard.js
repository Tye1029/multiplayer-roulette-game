(function (global) {
  'use strict';

  if (global.__rrAuthoritativeFacingGuardV1) return;
  global.__rrAuthoritativeFacingGuardV1 = true;

  const state = {
    scheduled: false,
    timer: 0,
    observer: null,
    inFlightKey: '',
    lastReason: '',
    blockedAnimations: 0
  };

  function currentGame() {
    try {
      if (typeof rouletteLatestGame !== 'undefined' && rouletteLatestGame?.mode === 'roulette') {
        return rouletteLatestGame;
      }
    } catch {}
    try {
      if (typeof duelLastActiveGame !== 'undefined' && duelLastActiveGame?.mode === 'roulette') {
        return duelLastActiveGame;
      }
    } catch {}
    return null;
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
    return Boolean(lock.pendingTurnId && lock.animatingFacing === element);
  }

  function installAnimationGate() {
    try {
      if (typeof rouletteAnimate !== 'function' || rouletteAnimate.__rrAuthoritativeFacingGateV1) return;
      const original = rouletteAnimate;
      const guarded = function (element, frames, timing) {
        if (element?.matches?.('[data-roulette-facing]') && !animationIsAuthorized(element)) {
          state.blockedAnimations += 1;
          scheduleReconcile('blocked-unauthorized-facing-animation');
          return Promise.resolve(null);
        }
        return original.call(this, element, frames, timing);
      };
      Object.defineProperty(guarded, '__rrAuthoritativeFacingGateV1', {
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
    const turnId = String(game?.rouletteState?.turnId || '');
    if (!api || !gameId || game?.status !== 'playing' || !turnId) return;

    const root = currentRoot(gameId);
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
      api.enforceLockedFacing(gameId);
      return;
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
        String(newest?.rouletteState?.turnId || '') === turnId &&
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
