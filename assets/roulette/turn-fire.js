(function () {
  'use strict';

  const api = window.RouletteTurnLock;
  if (!api) throw new Error('Roulette turn lock must load before firing effects.');
  const { lock, ensureLayers, latestGameFor, applyFacing, enforceLockedFacing, rotateToLockedTurn } = api;

  function currentRoot(gameId) {
    return duelActive?.querySelector(
      `[data-roulette-game][data-game-id="${CSS.escape(String(gameId || ''))}"]`
    ) || null;
  }

  rouletteShotSequence = async function (_game, state, gameId) {
    const layers = enforceLockedFacing(gameId) || ensureLayers(currentRoot(gameId));
    if (!layers) return;

    lock.firing = true;
    const lockedTurnId = lock.turnId;
    const lockedAngle = lock.angle;
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
        effects.push(rouletteAnimate(flash, [
          { opacity: 0, transform: 'translate(-50%,-50%) scale(.1)' },
          { opacity: 1, transform: 'translate(-50%,-50%) scale(1.7)', offset: 0.16 },
          { opacity: 0.75, transform: 'translate(-50%,-50%) scale(2.7)', offset: 0.42 },
          { opacity: 0, transform: 'translate(-50%,-50%) scale(4.2)' }
        ], { duration: 380, easing: 'ease-out' }));
      }
      smoke.forEach((particle, index) => {
        effects.push(rouletteAnimate(particle, [
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
        ], {
          duration: 1050 + index * 170,
          delay: index * 55,
          easing: 'cubic-bezier(.2,.55,.2,1)'
        }));
      });
      const recoilMotion = rouletteAnimate(layers.recoil, [
        { transform: 'translate(0,0) rotate(0deg) scale(1)', offset: 0 },
        { transform: 'translate(20px,7px) rotate(10deg) scale(1.035)', offset: 0.2 },
        { transform: 'translate(-5px,-2px) rotate(-2deg) scale(1)', offset: 0.55 },
        { transform: 'translate(0,0) rotate(0deg) scale(1)', offset: 1 }
      ], { duration: 560, easing: 'cubic-bezier(.16,.85,.2,1)' });
      await Promise.all([
        layers.root._rrHammerMotion || Promise.resolve(),
        recoilMotion,
        ...effects
      ]);
    } else {
      rouletteBlankSound();
      navigator.vibrate?.(30);
      await Promise.all([
        layers.root._rrHammerMotion || Promise.resolve(),
        rouletteAnimate(layers.recoil, [
          { transform: 'translateX(0)' },
          { transform: 'translateX(-3px)', offset: 0.42 },
          { transform: 'translateX(0)' }
        ], { duration: 165, easing: 'ease-out' })
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

    // The turn lock is reapplied before controls or queued effects can resume.
    applyFacing(mounted, lockedAngle, lockedTurnId, true);
    lock.firing = false;
    await rouletteWait(live ? 420 : 120);
    layers.root.classList.remove('rr-animation-lock');
    mounted?.root.classList.remove('rr-animation-lock');

    const newest = latestGameFor(gameId, null);
    const newestTurnId = String(newest?.rouletteState?.turnId || '');
    if (newest?.status === 'playing' && newestTurnId && newestTurnId !== lockedTurnId) {
      await rotateToLockedTurn(newest, gameId, newestTurnId, 1020);
    } else {
      enforceLockedFacing(gameId);
    }
  };

})();
