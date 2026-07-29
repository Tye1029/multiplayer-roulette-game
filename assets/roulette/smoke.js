(function (global) {
  'use strict';

  if (global.__rrPermanentSmokeV1) return;
  global.__rrPermanentSmokeV1 = true;

  const phaseEpoch = Number(global.__rrLampPhaseEpoch) || Date.now();
  global.__rrLampPhaseEpoch = phaseEpoch;

  let observer = null;
  let scheduled = false;

  function readLampConfig() {
    const api = global.RouletteLampConfig;
    if (!api) return { track: 7.5, trackSpeed: 5.6 };
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(api.storageKey) || localStorage.getItem(api.legacyStorageKey) || 'null');
    } catch {}
    const config = api.normalize(saved || api.defaults);
    return {
      track: Math.max(2.5, Number(config.track) || 7.5),
      trackSpeed: Math.max(1.5, Number(config.trackSpeed) || Number(config.speed) || 5.6)
    };
  }

  function ensureLayer(smoke, className) {
    let layer = smoke.querySelector(`.${className}`);
    if (!layer) {
      layer = document.createElement('span');
      layer.className = className;
      layer.setAttribute('aria-hidden', 'true');
      smoke.append(layer);
    }
    return layer;
  }

  function synchronizeLitSmoke(layer, config) {
    if (!layer?.animate) return;
    const duration = config.trackSpeed;
    const travel = Math.max(3.5, config.track * 0.76);
    const signature = `${duration}|${travel}|permanent-smoke-v1`;
    const previous = layer.__rrPermanentSmokeAnimation;

    if (previous?.signature === signature && previous.animation?.playState !== 'idle') return;
    previous?.animation?.cancel?.();

    const animation = layer.animate([
      { transform: `translate3d(${-travel}%,0,0) scale(1.03)`, opacity: .64, offset: 0 },
      { transform: 'translate3d(0,1%,0) scale(1.09)', opacity: .86, offset: .25 },
      { transform: `translate3d(${travel}%,0,0) scale(1.07)`, opacity: .72, offset: .5 },
      { transform: 'translate3d(0,-1%,0) scale(1.10)', opacity: .88, offset: .75 },
      { transform: `translate3d(${-travel}%,0,0) scale(1.03)`, opacity: .64, offset: 1 }
    ], {
      duration: duration * 1000,
      iterations: Infinity,
      easing: 'ease-in-out',
      fill: 'both'
    });

    try {
      animation.currentTime = Math.max(0, Date.now() - phaseEpoch) % (duration * 1000);
      animation.play();
    } catch {}

    layer.__rrPermanentSmokeAnimation = { signature, animation };
  }

  function mountRoot(root) {
    if (!root) return;
    let smoke = root.querySelector('.rr-smoke');
    if (!smoke) {
      smoke = document.createElement('div');
      smoke.className = 'rr-smoke';
      smoke.setAttribute('aria-hidden', 'true');
      const backwall = root.querySelector('.rr-backwall');
      if (backwall?.nextSibling) root.insertBefore(smoke, backwall.nextSibling);
      else root.prepend(smoke);
    }

    smoke.dataset.rrPermanentSmoke = '1';
    ensureLayer(smoke, 'rr-smoke-ambient');
    const lit = ensureLayer(smoke, 'rr-smoke-lit');
    synchronizeLitSmoke(lit, readLampConfig());
  }

  function mountAll() {
    scheduled = false;
    document.querySelectorAll('[data-roulette-game]').forEach(mountRoot);
  }

  function scheduleMount() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(mountAll);
  }

  function start() {
    mountAll();
    observer = new MutationObserver(scheduleMount);
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
    global.addEventListener('rr-lamp-config-change', mountAll);
    global.addEventListener('resize', scheduleMount, { passive: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  global.addEventListener('pagehide', () => observer?.disconnect(), { once: true });
})(window);
