(function () {
  'use strict';

  const styleId = 'rrStrictTurnLockStyles';
  const facingSelector = ':scope > [data-roulette-facing]';
  const recoilSelector = ':scope > [data-roulette-recoil]';
  const lock = {
    gameId: '',
    turnId: '',
    angle: -4,
    pendingTurnId: '',
    pendingAngle: -4,
    queuedTurnId: '',
    epoch: 0,
    opening: false,
    firing: false,
    animatingFacing: null
  };

  function installStyles() {
    document.getElementById('rrCleanTurnAnimationStyles')?.remove();
    document.getElementById(styleId)?.remove();
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      html body [data-roulette-game] .rr-gun-motion {
        transform: translate(-50%, -50%) scale(.74) !important;
        transform-origin: 50% 50% !important;
        transform-style: flat !important;
        backface-visibility: visible !important;
        animation: none !important;
        transition: none !important;
        will-change: auto !important;
      }
      html body [data-roulette-game] .rr-turn-facing,
      html body [data-roulette-game] .rr-gun-recoil {
        position: absolute !important;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
        transform-origin: 50% 50% !important;
        pointer-events: none !important;
      }
      html body [data-roulette-game] .rr-turn-facing {
        transform: rotate(-4deg);
        transform-style: flat !important;
        backface-visibility: visible !important;
        transition: none !important;
        will-change: transform;
      }
      html body [data-roulette-game] .rr-gun-recoil {
        transform: none;
        transition: none !important;
        will-change: transform;
      }
      html body [data-roulette-game] .rr-gun-recoil > .rr-revolver,
      html body [data-roulette-game] .rr-gun-recoil .rr-gun-photo {
        animation: none !important;
        transition: none !important;
      }
      html body [data-roulette-game] .rr-gun-recoil > .rr-revolver {
        transform: none !important;
      }
      html body [data-roulette-game] .rr-gun-recoil .rr-gun-photo {
        transform: none !important;
      }
      html body [data-roulette-game].rr-fired {
        animation: none !important;
        transform: none !important;
        transition: none !important;
      }
      html body [data-roulette-game] .rr-table {
        animation: none !important;
        transform: none !important;
        transition: none !important;
      }
      @media (max-width: 560px) {
        html body [data-roulette-game] .rr-gun-motion {
          transform: translate(-50%, -50%) scale(.78) !important;
        }
      }
    `;
    (document.body || document.documentElement).append(style);
  }

  function currentRoot(gameId) {
    return duelActive?.querySelector(
      `[data-roulette-game][data-game-id="${CSS.escape(String(gameId || ''))}"]`
    ) || null;
  }

  function normalizeAngle(angle) {
    const value = Number(angle) || 0;
    return ((value % 360) + 360) % 360;
  }

  function angleForPlayer(game, userId) {
    return normalizeAngle(
      String(userId || '') === String(game?.creator?.userId || '') ? -4 : 176
    );
  }

  function shortestDelta(from, target) {
    let delta = ((((target - from) % 360) + 540) % 360) - 180;
    if (delta === -180) delta = 180;
    return delta;
  }

  function ensureLayers(root) {
    const motion = root?.querySelector('[data-roulette-motion]');
    if (!motion) return null;

    let facing = motion.querySelector(facingSelector);
    if (!facing) {
      facing = document.createElement('div');
      facing.className = 'rr-turn-facing';
      facing.dataset.rouletteFacing = '1';
      motion.append(facing);
    }

    let recoil = facing.querySelector(recoilSelector);
    if (!recoil) {
      recoil = document.createElement('div');
      recoil.className = 'rr-gun-recoil';
      recoil.dataset.rouletteRecoil = '1';
      facing.append(recoil);
    }

    for (const element of Array.from(motion.children)) {
      if (
        element !== facing &&
        element.matches('.rr-revolver,.rr-shot-flash,.rr-shot-smoke')
      ) recoil.append(element);
    }
    for (const element of Array.from(facing.children)) {
      if (
        element !== recoil &&
        element.matches('.rr-revolver,.rr-shot-flash,.rr-shot-smoke')
      ) recoil.append(element);
    }

    return { root, motion, facing, recoil };
  }

  function latestGameFor(gameId, fallback) {
    const latest = rouletteLatestGame;
    if (String(latest?.gameId || '') === String(gameId || '')) return latest;
    return fallback || null;
  }

  function openingIsDone(gameId) {
    return Boolean(
      rouletteVisualRuntime.openingDone ||
      rouletteOpeningCompletedGames?.has?.(String(gameId || ''))
    );
  }

  function setRuntimeLock(gameId, turnId, angle) {
    const normalized = normalizeAngle(angle);
    lock.gameId = String(gameId || '');
    lock.turnId = String(turnId || '');
    lock.angle = normalized;
    lock.pendingTurnId = '';
    lock.pendingAngle = normalized;
    lock.queuedTurnId = '';
    lock.animatingFacing = null;

    rouletteVisualRuntime.currentAngle = normalized;
    rouletteVisualRuntime.angleHydrated = true;
    rouletteVisualRuntime.lastTurnId = lock.turnId;
    rouletteVisualRuntime.displayTurnId = lock.turnId;
    rouletteVisualRuntime.rotationTargetId = '';
  }

  function applyFacing(layers, angle, turnId, cancelAnimation = true) {
    if (!layers) return null;
    const normalized = normalizeAngle(angle);
    if (cancelAnimation) {
      layers.facing.getAnimations?.().forEach(animation => animation.cancel());
    }
    layers.facing.style.transform = `rotate(${normalized}deg)`;
    layers.facing.dataset.rouletteFacingAngle = String(normalized);
    layers.facing.dataset.rouletteFacingTurnId = String(turnId || '');
    layers.root.dataset.rouletteLockedTurnId = String(turnId || '');
    layers.root.dataset.rouletteLockedAngle = String(normalized);
    return layers;
  }

  function enforceLockedFacing(gameId) {
    const layers = ensureLayers(currentRoot(gameId));
    if (!layers) return null;

    if (lock.gameId !== String(gameId || '')) {
      applyFacing(layers, -4, '', true);
      return layers;
    }

    if (lock.pendingTurnId) {
      if (layers.facing !== lock.animatingFacing) {
        // A rerender during the permitted rotation inherits the target angle.
        lock.epoch += 1;
        applyFacing(layers, lock.pendingAngle, lock.pendingTurnId, true);
        setRuntimeLock(gameId, lock.pendingTurnId, lock.pendingAngle);
      }
      return layers;
    }

    applyFacing(layers, lock.angle, lock.turnId, true);
    return layers;
  }

  function queueTurnRotation(game, gameId, turnId, duration) {
    const requested = String(turnId || '');
    if (!requested || lock.queuedTurnId === requested || lock.pendingTurnId === requested) return;
    lock.queuedTurnId = requested;
    rouletteQueueVisual(async () => {
      lock.queuedTurnId = '';
      await rotateToLockedTurn(game, gameId, requested, duration);
    });
  }

  async function rotateToLockedTurn(game, gameId, requestedTurnId, duration = 900) {
    const latest = latestGameFor(gameId, game);
    const authoritativeTurnId = String(latest?.rouletteState?.turnId || '');
    if (
      String(latest?.gameId || '') !== String(gameId || '') ||
      latest?.status !== 'playing' ||
      !authoritativeTurnId ||
      authoritativeTurnId !== String(requestedTurnId || '')
    ) return;

    const target = angleForPlayer(latest, authoritativeTurnId);
    if (
      lock.gameId === String(gameId || '') &&
      lock.turnId === authoritativeTurnId &&
      Math.abs(shortestDelta(lock.angle, target)) < 0.5
    ) {
      applyFacing(ensureLayers(currentRoot(gameId)), target, authoritativeTurnId, true);
      setRuntimeLock(gameId, authoritativeTurnId, target);
      return;
    }
    if (lock.pendingTurnId === authoritativeTurnId) return;

    const layers = ensureLayers(currentRoot(gameId));
    if (!layers) return;

    const mountedAngle = Number(layers.facing.dataset.rouletteFacingAngle);
    const from = Number.isFinite(mountedAngle)
      ? normalizeAngle(mountedAngle)
      : (lock.gameId === String(gameId || '') ? lock.angle : target);
    const delta = shortestDelta(from, target);
    const sign = delta >= 0 ? 1 : -1;
    const epoch = ++lock.epoch;

    lock.gameId = String(gameId || '');
    lock.pendingTurnId = authoritativeTurnId;
    lock.pendingAngle = target;
    lock.animatingFacing = layers.facing;
    rouletteVisualRuntime.rotationTargetId = authoritativeTurnId;
    layers.root.classList.add('rr-animation-lock');
    layers.facing.getAnimations?.().forEach(animation => animation.cancel());

    try {
      if (Math.abs(delta) >= 0.5) {
        // Same Web Animations path and easing as the opening spin.
        await Promise.all([
          rouletteAnimate(
            layers.facing,
            [
              { transform: `rotate(${from}deg)`, offset: 0 },
              { transform: `rotate(${from + delta * 0.72}deg)`, offset: 0.72 },
              { transform: `rotate(${from + delta - 9 * sign}deg)`, offset: 0.94 },
              { transform: `rotate(${from + delta}deg)`, offset: 1 }
            ],
            {
              duration,
              easing: 'cubic-bezier(.22,.58,.12,1)',
              fill: 'forwards'
            }
          ),
          rouletteRotationGlint(
            layers.root.querySelector('.rr-metal-glint'),
            duration,
            0.18
          )
        ]);
      }
    } finally {
      layers.root.classList.remove('rr-animation-lock');
    }

    if (epoch !== lock.epoch) return;

    const newest = latestGameFor(gameId, latest);
    const newestTurnId = String(newest?.rouletteState?.turnId || '');
    if (newest?.status === 'playing' && newestTurnId === authoritativeTurnId) {
      applyFacing(ensureLayers(currentRoot(gameId)), target, authoritativeTurnId, true);
      setRuntimeLock(gameId, authoritativeTurnId, target);
      return;
    }

    lock.pendingTurnId = '';
    lock.animatingFacing = null;
    rouletteVisualRuntime.rotationTargetId = '';
    if (newest?.status === 'playing' && newestTurnId) {
      await rotateToLockedTurn(newest, gameId, newestTurnId, Math.min(700, duration));
    }
  }

  function mountCurrentScene() {
    const game = rouletteLatestGame;
    const gameId = String(game?.gameId || '');
    if (!gameId) return;
    const layers = ensureLayers(currentRoot(gameId));
    if (!layers) return;

    if (lock.opening) {
      if (layers.facing !== lock.animatingFacing && lock.pendingTurnId) {
        applyFacing(layers, lock.pendingAngle, lock.pendingTurnId, true);
      }
      return;
    }

    const turnId = String(game?.rouletteState?.turnId || '');
    if (!openingIsDone(gameId)) {
      if (lock.gameId !== gameId || lock.turnId) {
        lock.gameId = gameId;
        lock.turnId = '';
        lock.angle = normalizeAngle(-4);
        lock.pendingTurnId = '';
        lock.queuedTurnId = '';
      }
      applyFacing(layers, -4, '', true);
      return;
    }

    if (!turnId) {
      enforceLockedFacing(gameId);
      return;
    }

    if (lock.gameId !== gameId || !lock.turnId) {
      const angle = angleForPlayer(game, turnId);
      applyFacing(layers, angle, turnId, true);
      setRuntimeLock(gameId, turnId, angle);
      return;
    }

    if (lock.pendingTurnId) {
      enforceLockedFacing(gameId);
      return;
    }

    if (lock.turnId === turnId) {
      enforceLockedFacing(gameId);
      return;
    }

    // Keep the previous owner locked until the one permitted rotation runs.
    applyFacing(layers, lock.angle, lock.turnId, true);
    if (!rouletteVisualRuntime.busy) queueTurnRotation(game, gameId, turnId, 900);
  }

  installStyles();

  const originalBind = rouletteBind;
  rouletteBind = function (root = duelActive) {
    const result = originalBind(root);
    mountCurrentScene();
    return result;
  };

  rouletteMotionTransform = function (_angle, scale = rouletteMotionScale(), x = '-50%', y = '-50%') {
    return `translate(${x},${y}) scale(${scale})`;
  };

  rouletteOrientToShotActor = async function () {
    // Shot effects are never allowed to alter direction.
  };

  rouletteRotateToTurn = async function (game, state, gameId, options = {}) {
    const latest = latestGameFor(gameId, game);
    const turnId = String(
      options.targetTurnId || latest?.rouletteState?.turnId || state?.turnId || ''
    );
    if (turnId) {
      await rotateToLockedTurn(latest, gameId, turnId, Number(options.duration) || 900);
    }
  };

  rouletteOpeningSequence = async function (game, state, gameId) {
    const layers = ensureLayers(currentRoot(gameId));
    if (!layers) throw new Error('Opening spin scene was not mounted.');

    const epoch = ++lock.epoch;
    lock.gameId = String(gameId || '');
    lock.turnId = '';
    lock.angle = normalizeAngle(-4);
    lock.pendingTurnId = String(state?.openingSpinWinnerId || state?.turnId || '');
    lock.pendingAngle = angleForPlayer(game, lock.pendingTurnId);
    lock.queuedTurnId = '';
    lock.opening = true;
    lock.animatingFacing = layers.facing;

    layers.root.classList.add('rr-animation-lock', 'rr-opening-active');
    layers.root.dataset.rouletteOpening = '1';
    layers.root.querySelectorAll('.rr-btn').forEach(button => { button.disabled = true; });

    const banner = layers.root.querySelector('.rr-opening-banner') || document.createElement('div');
    if (!banner.isConnected) {
      banner.className = 'rr-opening-banner';
      layers.root.append(banner);
    }
    banner.textContent = 'Choosing First Player';

    const finalTurnId = lock.pendingTurnId;
    const finalAngle = lock.pendingAngle;
    const duration = 4700;
    applyFacing(layers, -4, '', true);
    rouletteSpinSound(1.35);

    await Promise.all([
      rouletteAnimate(
        layers.facing,
        [
          { transform: 'rotate(-4deg)', offset: 0 },
          { transform: 'rotate(116deg)', offset: 0.24 },
          { transform: 'rotate(386deg)', offset: 0.55 },
          { transform: `rotate(${finalAngle + 720}deg)`, offset: 0.88 },
          { transform: `rotate(${finalAngle + 711}deg)`, offset: 0.955 },
          { transform: `rotate(${finalAngle + 720}deg)`, offset: 1 }
        ],
        {
          duration,
          easing: 'cubic-bezier(.22,.58,.12,1)',
          fill: 'forwards'
        }
      ),
      rouletteRotationGlint(
        layers.root.querySelector('.rr-metal-glint'),
        duration,
        0.28
      )
    ]);

    if (epoch === lock.epoch) {
      applyFacing(ensureLayers(currentRoot(gameId)), finalAngle, finalTurnId, true);
      setRuntimeLock(gameId, finalTurnId, finalAngle);
    }
    lock.opening = false;

    banner.textContent = String(finalTurnId) === String(game?.creator?.userId || '')
      ? `${String(game?.creator?.name || 'PLAYER 1').toUpperCase()} GOES FIRST`
      : `${String(game?.joiner?.name || 'PLAYER 2').toUpperCase()} GOES FIRST`;
    await rouletteWait(850);
    banner.remove();
    layers.root.classList.remove('rr-animation-lock', 'rr-opening-active');
    layers.root.dataset.rouletteOpening = '0';

    const newest = latestGameFor(gameId, game);
    const newestTurnId = String(newest?.rouletteState?.turnId || '');
    if (newest?.status === 'playing' && newestTurnId && newestTurnId !== lock.turnId) {
      await rotateToLockedTurn(newest, gameId, newestTurnId, 700);
    }
  };

  window.RouletteTurnLock = {
    lock,
    ensureLayers,
    latestGameFor,
    applyFacing,
    enforceLockedFacing,
    rotateToLockedTurn
  };

  window.addEventListener('resize', () => {
    enforceLockedFacing(lock.gameId);
  }, { passive: true });

  mountCurrentScene();
})();
