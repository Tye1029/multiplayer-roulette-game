(function () {
  'use strict';

  const styleId = 'rrCleanTurnAnimationStyles';
  const facingSelector = ':scope > [data-roulette-facing]';
  const recoilSelector = ':scope > [data-roulette-recoil]';

  function installStyles() {
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
        will-change: transform;
      }
      html body [data-roulette-game] .rr-gun-recoil {
        transform: none;
        will-change: transform;
      }
      html body [data-roulette-game].rr-fired {
        animation: none !important;
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

  function angleForPlayer(game, userId) {
    return String(userId || '') === String(game?.creator?.userId || '') ? -4 : 176;
  }

  function normalizeAngle(angle) {
    const value = Number(angle) || 0;
    return ((value % 360) + 360) % 360;
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

    const directVisuals = Array.from(motion.children).filter(element =>
      element !== facing &&
      (element.matches('.rr-revolver') || element.matches('.rr-shot-flash') || element.matches('.rr-shot-smoke'))
    );
    for (const element of directVisuals) recoil.append(element);

    const looseVisuals = Array.from(facing.children).filter(element =>
      element !== recoil &&
      (element.matches('.rr-revolver') || element.matches('.rr-shot-flash') || element.matches('.rr-shot-smoke'))
    );
    for (const element of looseVisuals) recoil.append(element);

    return { root, motion, facing, recoil };
  }

  function readFacingAngle(facing, fallback = -4) {
    const stored = Number(facing?.dataset.rouletteFacingAngle);
    return Number.isFinite(stored) ? stored : fallback;
  }

  function settleFacing(gameId, angle, turnId = '') {
    const layers = ensureLayers(currentRoot(gameId));
    if (!layers) return null;
    const normalized = normalizeAngle(angle);
    layers.facing.getAnimations?.().forEach(animation => animation.cancel());
    layers.facing.style.transform = `rotate(${normalized}deg)`;
    layers.facing.dataset.rouletteFacingAngle = String(normalized);
    layers.facing.dataset.rouletteFacingTurnId = String(turnId || '');
    layers.recoil.getAnimations?.().forEach(animation => animation.cancel());
    layers.recoil.style.transform = 'none';
    return layers;
  }

  async function animateFacing(game, gameId, turnId, duration = 900) {
    const latest = rouletteLatestGame || game;
    if (
      String(latest?.gameId || '') !== String(gameId) ||
      latest?.status !== 'playing' ||
      String(latest?.rouletteState?.turnId || '') !== String(turnId || '')
    ) return;

    const layers = ensureLayers(currentRoot(gameId));
    if (!layers) return;

    const target = normalizeAngle(angleForPlayer(latest, turnId));
    const runtimeFallback = Number.isFinite(rouletteVisualRuntime.currentAngle)
      ? normalizeAngle(rouletteVisualRuntime.currentAngle)
      : target;
    const from = readFacingAngle(layers.facing, runtimeFallback);
    const delta = shortestDelta(from, target);
    const epoch = ++rouletteVisualRuntime.rotationEpoch;

    rouletteVisualRuntime.rotationTargetId = String(turnId);
    layers.root.classList.add('rr-animation-lock');
    layers.facing.getAnimations?.().forEach(animation => animation.cancel());

    try {
      if (Math.abs(delta) >= 0.5) {
        await Promise.all([
          rouletteAnimate(
            layers.facing,
            [
              { transform: `rotate(${from}deg)` },
              { transform: `rotate(${from + delta}deg)` }
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
      settleFacing(gameId, target, turnId)?.root.classList.remove('rr-animation-lock');
      layers.root.classList.remove('rr-animation-lock');
    }

    if (epoch !== rouletteVisualRuntime.rotationEpoch) return;
    rouletteVisualRuntime.currentAngle = target;
    rouletteVisualRuntime.angleHydrated = true;
    rouletteVisualRuntime.lastTurnId = String(turnId);
    rouletteVisualRuntime.displayTurnId = String(turnId);
    rouletteVisualRuntime.rotationTargetId = '';

    const newest = rouletteLatestGame;
    const newestTurnId = String(newest?.rouletteState?.turnId || '');
    if (
      String(newest?.gameId || '') === String(gameId) &&
      newest?.status === 'playing' &&
      newestTurnId &&
      newestTurnId !== String(turnId)
    ) {
      await animateFacing(newest, gameId, newestTurnId, Math.min(700, duration));
    }
  }

  function mountCurrentScene() {
    const game = rouletteLatestGame;
    const gameId = String(game?.gameId || '');
    if (!gameId) return;
    const layers = ensureLayers(currentRoot(gameId));
    if (!layers) return;

    const state = game?.rouletteState || {};
    const turnId = String(state.turnId || '');
    const openingDone = Boolean(rouletteVisualRuntime.openingDone || rouletteOpeningCompletedGames?.has?.(gameId));
    let angle = -4;
    let facingTurnId = '';

    if (rouletteVisualRuntime.angleHydrated && Number.isFinite(rouletteVisualRuntime.currentAngle)) {
      angle = rouletteVisualRuntime.currentAngle;
      facingTurnId = String(rouletteVisualRuntime.displayTurnId || rouletteVisualRuntime.lastTurnId || '');
    } else if (openingDone && turnId) {
      angle = angleForPlayer(game, turnId);
      facingTurnId = turnId;
      rouletteVisualRuntime.currentAngle = angle;
      rouletteVisualRuntime.angleHydrated = true;
      rouletteVisualRuntime.lastTurnId = turnId;
      rouletteVisualRuntime.displayTurnId = turnId;
    }

    settleFacing(gameId, angle, facingTurnId);
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
    // Facing is never changed by a firing effect.
  };

  rouletteRotateToTurn = async function (game, state, gameId, options = {}) {
    const latest = rouletteLatestGame || game;
    const turnId = String(options.targetTurnId || latest?.rouletteState?.turnId || state?.turnId || '');
    if (!turnId) return;
    await animateFacing(latest, gameId, turnId, Number(options.duration) || 900);
  };

  rouletteOpeningSequence = async function (game, state, gameId) {
    const layers = ensureLayers(currentRoot(gameId));
    if (!layers) throw new Error('Opening spin scene was not mounted.');

    layers.root.classList.add('rr-animation-lock', 'rr-opening-active');
    layers.root.dataset.rouletteOpening = '1';
    layers.root.querySelectorAll('.rr-btn').forEach(button => { button.disabled = true; });

    const banner = layers.root.querySelector('.rr-opening-banner') || document.createElement('div');
    if (!banner.isConnected) {
      banner.className = 'rr-opening-banner';
      layers.root.append(banner);
    }
    banner.textContent = 'Choosing First Player';

    const finalTurnId = String(state?.openingSpinWinnerId || state?.turnId || '');
    const finalAngle = normalizeAngle(angleForPlayer(game, finalTurnId));
    const duration = 4700;
    const glint = layers.root.querySelector('.rr-metal-glint');

    settleFacing(gameId, -4, '');
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
        { duration, easing: 'cubic-bezier(.22,.58,.12,1)', fill: 'forwards' }
      ),
      rouletteRotationGlint(glint, duration, 0.28)
    ]);

    settleFacing(gameId, finalAngle, finalTurnId);
    rouletteVisualRuntime.currentAngle = finalAngle;
    rouletteVisualRuntime.angleHydrated = true;
    rouletteVisualRuntime.lastTurnId = String(state?.turnId || finalTurnId);
    rouletteVisualRuntime.displayTurnId = rouletteVisualRuntime.lastTurnId;
    rouletteVisualRuntime.rotationTargetId = '';

    banner.textContent = String(state?.turnId || '') === String(game?.creator?.userId || '')
      ? `${String(game?.creator?.name || 'PLAYER 1').toUpperCase()} GOES FIRST`
      : `${String(game?.joiner?.name || 'PLAYER 2').toUpperCase()} GOES FIRST`;
    await rouletteWait(850);
    banner.remove();
    layers.root.classList.remove('rr-animation-lock', 'rr-opening-active');
    layers.root.dataset.rouletteOpening = '0';
  };

  rouletteShotSequence = async function (game, state, gameId) {
    const layers = ensureLayers(currentRoot(gameId));
    if (!layers) return;

    const actorId = String(state?.lastActorId || rouletteVisualRuntime.displayTurnId || state?.turnId || '');
    const actorAngle = normalizeAngle(angleForPlayer(game, actorId));
    settleFacing(gameId, actorAngle, actorId);
    rouletteVisualRuntime.currentAngle = actorAngle;
    rouletteVisualRuntime.angleHydrated = true;
    rouletteVisualRuntime.lastTurnId = actorId;
    rouletteVisualRuntime.displayTurnId = actorId;

    const hammer = layers.root.querySelector('.rr-hammer-photo');
    const cover = layers.root.querySelector('.rr-hammer-cover');
    const glint = layers.root.querySelector('.rr-metal-glint');
    const flash = layers.root.querySelector('.rr-shot-flash');
    const smoke = [...layers.root.querySelectorAll('.rr-shot-smoke i')];

    layers.root.classList.add('rr-animation-lock');
    for (const element of [layers.recoil, hammer, cover, glint, flash, ...smoke].filter(Boolean)) {
      element.getAnimations?.().forEach(animation => animation.cancel());
    }
    layers.recoil.style.transform = 'none';
    if (cover) cover.style.opacity = '0';

    if (hammer) {
      hammer.style.opacity = '1';
      rouletteShotIndexSound();
      layers.root._rrHammerMotion = rouletteAnimate(
        hammer,
        [
          { transform: 'rotate(0deg)', offset: 0 },
          { transform: 'rotate(23deg)', offset: 0.46 },
          { transform: 'rotate(23deg)', offset: 0.6 },
          { transform: 'rotate(-2.5deg)', offset: 0.76 },
          { transform: 'rotate(0deg)', offset: 1 }
        ],
        { duration: 420, easing: 'cubic-bezier(.22,.03,.16,1)', fill: 'none' }
      );
      await rouletteWait(255);
    } else {
      await rouletteWait(255);
    }

    const live = state?.lastOutcome === 'live';
    if (live) {
      rouletteGunshotSound();
      navigator.vibrate?.([90, 35, 220]);
      const effects = [];
      if (flash) {
        effects.push(rouletteAnimate(
          flash,
          [
            { opacity: 0, transform: 'translate(-50%,-50%) scale(.1)' },
            { opacity: 1, transform: 'translate(-50%,-50%) scale(1.7)', offset: 0.16 },
            { opacity: 0.75, transform: 'translate(-50%,-50%) scale(2.7)', offset: 0.42 },
            { opacity: 0, transform: 'translate(-50%,-50%) scale(4.2)' }
          ],
          { duration: 380, easing: 'ease-out' }
        ));
      }
      smoke.forEach((particle, index) => {
        effects.push(rouletteAnimate(
          particle,
          [
            { opacity: 0, transform: 'translate(0,0) scale(.25)' },
            {
              opacity: 0.62,
              transform: `translate(${-18 - index * 7}px,${-8 - index * 5}px) scale(${0.85 + index * 0.14})`,
              offset: 0.24
            },
            {
              opacity: 0,
              transform: `translate(${-55 - index * 18}px,${-32 - index * 13}px) scale(${1.7 + index * 0.26})`
            }
          ],
          { duration: 1050 + index * 170, delay: index * 55, easing: 'cubic-bezier(.2,.55,.2,1)' }
        ));
      });
      const recoilMotion = rouletteAnimate(
        layers.recoil,
        [
          { transform: 'translate(0,0) rotate(0deg) scale(1)', offset: 0 },
          { transform: 'translate(20px,7px) rotate(10deg) scale(1.035)', offset: 0.2 },
          { transform: 'translate(-5px,-2px) rotate(-2deg) scale(1)', offset: 0.55 },
          { transform: 'translate(0,0) rotate(0deg) scale(1)', offset: 1 }
        ],
        { duration: 560, easing: 'cubic-bezier(.16,.85,.2,1)' }
      );
      await Promise.all([layers.root._rrHammerMotion || Promise.resolve(), recoilMotion, ...effects]);
    } else {
      rouletteBlankSound();
      navigator.vibrate?.(30);
      await Promise.all([
        layers.root._rrHammerMotion || Promise.resolve(),
        rouletteAnimate(
          layers.recoil,
          [
            { transform: 'translateX(0)' },
            { transform: 'translateX(-3px)', offset: 0.42 },
            { transform: 'translateX(0)' }
          ],
          { duration: 165, easing: 'ease-out' }
        )
      ]);
    }

    delete layers.root._rrHammerMotion;
    const mounted = ensureLayers(currentRoot(gameId));
    for (const element of new Set([layers.recoil, mounted?.recoil].filter(Boolean))) {
      element.getAnimations?.().forEach(animation => animation.cancel());
      element.style.transform = 'none';
    }
    if (hammer) {
      hammer.style.opacity = '1';
      hammer.style.transform = 'rotate(0deg)';
    }
    if (cover) cover.style.opacity = '0';
    await rouletteWait(live ? 420 : 120);
    layers.root.classList.remove('rr-animation-lock');
    mounted?.root.classList.remove('rr-animation-lock');
  };

  window.addEventListener('resize', mountCurrentScene, { passive: true });
  mountCurrentScene();
})();