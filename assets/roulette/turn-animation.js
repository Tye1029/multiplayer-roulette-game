(function () {
  'use strict';

  const styleId = 'rrCleanTurnAnimationStyles';

  function ensureStyles() {
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      [data-roulette-game] .rr-gun-motion {
        backface-visibility: visible !important;
        transform-style: flat !important;
      }
      [data-roulette-game] .rr-gun-recoil {
        position: absolute;
        inset: 0;
        transform-origin: 50% 50%;
        will-change: transform;
        pointer-events: none;
      }
      [data-roulette-game].rr-fired { animation: none !important; }
    `;
    document.head.append(style);
  }

  function currentRoot(gameId) {
    return duelActive?.querySelector(
      `[data-roulette-game][data-game-id="${CSS.escape(String(gameId || ''))}"]`
    ) || null;
  }

  function ensureRecoilLayer(root) {
    const motion = root?.querySelector('[data-roulette-motion]');
    if (!motion) return null;

    let recoil = motion.querySelector(':scope > [data-roulette-recoil]');
    if (recoil) return recoil;

    recoil = document.createElement('div');
    recoil.className = 'rr-gun-recoil';
    recoil.dataset.rouletteRecoil = '1';

    const revolver = motion.querySelector(':scope > .rr-revolver');
    const flash = motion.querySelector(':scope > .rr-shot-flash');
    const smoke = motion.querySelector(':scope > .rr-shot-smoke');
    const first = revolver || flash || smoke;
    if (first) motion.insertBefore(recoil, first);
    else motion.append(recoil);
    for (const element of [revolver, flash, smoke]) {
      if (element) recoil.append(element);
    }
    return recoil;
  }

  function settleFacing(gameId, angle) {
    const root = currentRoot(gameId);
    const motion = root?.querySelector('[data-roulette-motion]');
    if (!motion) return root;
    motion.getAnimations?.().forEach(animation => animation.cancel());
    motion.style.transform = rouletteMotionTransform(angle, rouletteMotionScale());
    return root;
  }

  ensureStyles();

  rouletteMotionTransform = function (angle, scale = rouletteMotionScale(), x = '-50%', y = '-50%') {
    return `translate(${x},${y}) rotate(${Number(angle) || 0}deg) scale(${scale})`;
  };

  rouletteOrientToShotActor = async function () {
    // Direction belongs exclusively to the authoritative turn animation.
  };

  rouletteRotateToTurn = async function (game, state, gameId, options = {}) {
    const duration = Number(options.duration) || 900;
    const latest = rouletteLatestGame || game;
    if (String(latest?.gameId || '') !== String(gameId) || latest?.status !== 'playing') return;

    const turnId = String(latest?.rouletteState?.turnId || state?.turnId || '');
    if (!turnId) return;

    const root = currentRoot(gameId);
    const motion = root?.querySelector('[data-roulette-motion]');
    const glint = root?.querySelector('.rr-metal-glint');
    if (!root || !motion) return;

    const target = rouletteAngleForPlayer(latest, turnId);
    const from = Number.isFinite(rouletteVisualRuntime.currentAngle)
      ? rouletteVisualRuntime.currentAngle
      : target;
    let delta = ((((target - from) % 360) + 540) % 360) - 180;
    if (delta === -180) delta = 180;

    const epoch = ++rouletteVisualRuntime.rotationEpoch;
    rouletteVisualRuntime.rotationTargetId = turnId;
    root.classList.add('rr-animation-lock');
    motion.getAnimations?.().forEach(animation => animation.cancel());

    try {
      if (Math.abs(delta) >= 0.5) {
        await Promise.all([
          rouletteAnimate(
            motion,
            [
              { transform: rouletteMotionTransform(from, rouletteMotionScale()) },
              { transform: rouletteMotionTransform(from + delta, rouletteMotionScale()) }
            ],
            {
              duration,
              easing: 'cubic-bezier(.22,.58,.12,1)',
              fill: 'forwards'
            }
          ),
          rouletteRotationGlint(glint, duration, 0.18)
        ]);
      }
    } finally {
      settleFacing(gameId, target)?.classList.remove('rr-animation-lock');
      root.classList.remove('rr-animation-lock');
      if (glint) {
        glint.getAnimations?.().forEach(animation => animation.cancel());
        glint.style.opacity = '0';
        glint.style.backgroundPosition = '116% 0';
      }
    }

    if (epoch !== rouletteVisualRuntime.rotationEpoch) return;
    rouletteVisualRuntime.currentAngle = target;
    rouletteVisualRuntime.angleHydrated = true;
    rouletteVisualRuntime.lastTurnId = turnId;
    rouletteVisualRuntime.displayTurnId = turnId;
    rouletteVisualRuntime.rotationTargetId = '';

    const newest = rouletteLatestGame;
    const newestTurnId = String(newest?.rouletteState?.turnId || '');
    if (
      String(newest?.gameId || '') === String(gameId) &&
      newest?.status === 'playing' &&
      newestTurnId &&
      newestTurnId !== turnId
    ) {
      await rouletteRotateToTurn(newest, newest.rouletteState, gameId, {
        duration: Math.min(700, duration)
      });
    }
  };

  rouletteShotSequence = async function (game, state, gameId) {
    const root = currentRoot(gameId);
    const recoil = ensureRecoilLayer(root);
    const hammer = root?.querySelector('.rr-hammer-photo');
    const cover = root?.querySelector('.rr-hammer-cover');
    const glint = root?.querySelector('.rr-metal-glint');
    const flash = root?.querySelector('.rr-shot-flash');
    const smoke = [...(root?.querySelectorAll('.rr-shot-smoke i') || [])];
    if (!root || !recoil) return;

    root.classList.add('rr-animation-lock');
    for (const element of [recoil, hammer, cover, glint, flash, ...smoke].filter(Boolean)) {
      element.getAnimations?.().forEach(animation => animation.cancel());
    }
    recoil.style.transform = 'none';
    if (cover) cover.style.opacity = '0';

    if (hammer) {
      hammer.style.opacity = '1';
      rouletteShotIndexSound();
      root._rrHammerMotion = rouletteAnimate(
        hammer,
        [
          { transform: 'rotate(0deg)', offset: 0 },
          { transform: 'rotate(23deg)', offset: 0.46 },
          { transform: 'rotate(23deg)', offset: 0.6 },
          { transform: 'rotate(-2.5deg)', offset: 0.76 },
          { transform: 'rotate(0deg)', offset: 1 }
        ],
        {
          duration: 420,
          easing: 'cubic-bezier(.22,.03,.16,1)',
          fill: 'none'
        }
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
        effects.push(
          rouletteAnimate(
            flash,
            [
              { opacity: 0, transform: 'translate(-50%,-50%) scale(.1)' },
              { opacity: 1, transform: 'translate(-50%,-50%) scale(1.7)', offset: 0.16 },
              { opacity: 0.75, transform: 'translate(-50%,-50%) scale(2.7)', offset: 0.42 },
              { opacity: 0, transform: 'translate(-50%,-50%) scale(4.2)' }
            ],
            { duration: 380, easing: 'ease-out' }
          )
        );
      }
      smoke.forEach((particle, index) => {
        effects.push(
          rouletteAnimate(
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
            {
              duration: 1050 + index * 170,
              delay: index * 55,
              easing: 'cubic-bezier(.2,.55,.2,1)'
            }
          )
        );
      });
      const recoilMotion = rouletteAnimate(
        recoil,
        [
          { transform: 'translate(0,0) rotate(0deg) scale(1)', offset: 0 },
          { transform: 'translate(20px,7px) rotate(10deg) scale(1.035)', offset: 0.2 },
          { transform: 'translate(-5px,-2px) rotate(-2deg) scale(1)', offset: 0.55 },
          { transform: 'translate(0,0) rotate(0deg) scale(1)', offset: 1 }
        ],
        { duration: 560, easing: 'cubic-bezier(.16,.85,.2,1)' }
      );
      await Promise.all([root._rrHammerMotion || Promise.resolve(), recoilMotion, ...effects]);
    } else {
      rouletteBlankSound();
      navigator.vibrate?.(30);
      await Promise.all([
        root._rrHammerMotion || Promise.resolve(),
        rouletteAnimate(
          recoil,
          [
            { transform: 'translateX(0)' },
            { transform: 'translateX(-3px)', offset: 0.42 },
            { transform: 'translateX(0)' }
          ],
          { duration: 165, easing: 'ease-out' }
        )
      ]);
    }

    delete root._rrHammerMotion;
    const mountedRoot = currentRoot(gameId);
    const mountedRecoil = ensureRecoilLayer(mountedRoot);
    for (const element of new Set([recoil, mountedRecoil].filter(Boolean))) {
      element.getAnimations?.().forEach(animation => animation.cancel());
      element.style.transform = 'none';
    }
    if (hammer) {
      hammer.style.opacity = '1';
      hammer.style.transform = 'rotate(0deg)';
    }
    if (cover) cover.style.opacity = '0';
    await rouletteWait(live ? 420 : 120);
    root.classList.remove('rr-animation-lock');
    mountedRoot?.classList.remove('rr-animation-lock');
  };
})();
