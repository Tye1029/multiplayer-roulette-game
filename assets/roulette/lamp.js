(function (global) {
  'use strict';

  const configApi = global.RouletteLampConfig;
  if (!configApi) {
    throw new Error('lamp-config.js must load before lamp.js');
  }

  const lampAsset = '/assets/roulette/decor/lamp-1.png';
  const styleAsset = '/assets/roulette/lamp.css?v=10';
  const styleMarker = 'rrLampExternalStyles';
  const imageId = 'rrLampPng';

  function ensureStyles(doc) {
    let link = doc.getElementById(styleMarker);
    if (!link) {
      link = doc.createElement('link');
      link.id = styleMarker;
      link.rel = 'stylesheet';
      link.href = styleAsset;
      doc.head.append(link);
    }
    return link;
  }

  function queryScene(doc) {
    return {
      game: doc.querySelector('[data-roulette-game]'),
      rig: doc.querySelector('.rr126-lamp-rig'),
      swing: doc.querySelector('.rr126-swing'),
      chain: doc.querySelector('.rr126-chain'),
      light: doc.querySelector('.rr130-table-illumination'),
      gun: doc.querySelector('.rr-gun-motion')
    };
  }

  function ensureLampImage(doc, swing) {
    let image = doc.getElementById(imageId);
    if (!image) {
      image = doc.createElement('img');
      image.id = imageId;
      image.alt = '';
      image.decoding = 'async';
      image.draggable = false;
      swing.append(image);
    }

    if (!image.src.includes('/lamp-1.png')) {
      image.src = lampAsset;
    }

    for (const oldImage of swing.querySelectorAll(`img:not(#${imageId})`)) {
      oldImage.style.setProperty('display', 'none', 'important');
    }

    for (const oldPart of swing.querySelectorAll(
      '[class*="lamp-body"],[class*="lamp-shade"],[class*="shade-art"],[class*="underside"]'
    )) {
      if (oldPart !== image && !oldPart.contains(image)) {
        oldPart.style.setProperty('display', 'none', 'important');
      }
    }

    return image;
  }

  function setImportant(element, property, value) {
    if (element) element.style.setProperty(property, value, 'important');
  }

  function apply(doc, rawConfig = {}) {
    if (!doc || !doc.head) {
      return { mounted: false, connectedCount: 0, totalControls: Object.keys(configApi.bindings).length, targets: {} };
    }

    ensureStyles(doc);
    const cfg = configApi.normalize(rawConfig);
    const scene = queryScene(doc);

    if (!scene.game || !scene.swing) {
      return {
        mounted: false,
        connectedCount: 0,
        totalControls: Object.keys(configApi.bindings).length,
        targets: {},
        config: cfg
      };
    }

    const image = ensureLampImage(doc, scene.swing);

    setImportant(scene.swing, 'left', `${cfg.lampX}%`);
    setImportant(scene.swing, 'top', `calc(20% + ${cfg.lampY}px)`);
    setImportant(scene.swing, 'animation-duration', `${cfg.speed}s`);
    scene.swing.style.setProperty('--rr-lamp-swing-positive', `${cfg.swing}deg`);
    scene.swing.style.setProperty('--rr-lamp-swing-negative', `${-cfg.swing}deg`);

    image.style.setProperty('--rr-lamp-art-x', `${cfg.lampArtX}%`);
    image.style.setProperty('--rr-lamp-art-y', `${cfg.lampArtY}%`);
    image.style.setProperty('--rr-lamp-width', `${cfg.lampWidth}%`);
    image.style.setProperty('--rr-lamp-scale', cfg.lampScale);
    image.style.setProperty('--rr-lamp-glow', cfg.lampGlow);
    const lampGlow = Math.max(0, cfg.lampGlow);
    setImportant(
      image,
      'filter',
      `brightness(${1 + lampGlow * 0.12}) ` +
        `drop-shadow(0 0 ${4 + lampGlow * 14}px rgba(255,169,64,${Math.min(0.8, 0.12 + lampGlow * 0.42)}))`
    );

    if (scene.chain) {
      setImportant(scene.chain, 'left', `${cfg.lampX}%`);
      setImportant(scene.chain, 'height', `${cfg.chainHeight}%`);
      setImportant(scene.chain, 'width', `${cfg.chainWidth}px`);
      setImportant(scene.chain, 'min-width', `${cfg.chainWidth}px`);
      setImportant(scene.chain, 'transform', `translateX(-50%) scaleX(${cfg.chainStretch})`);
    }

    if (scene.rig) {
      scene.rig.style.setProperty('--rr-lamp-x', `${cfg.lampX}%`);
      scene.rig.style.setProperty('--rr-lamp-y', `${cfg.lampY}px`);
    }

    if (scene.light) {
      scene.light.style.setProperty('--rr-light-track-positive', `${cfg.track}%`);
      scene.light.style.setProperty('--rr-light-track-negative', `${-cfg.track}%`);
      setImportant(scene.light, 'animation-duration', `${cfg.speed}s`);
      setImportant(
        scene.light,
        'background',
        `radial-gradient(ellipse ${cfg.spreadX}% ${cfg.spreadY}% at ${cfg.lightX}% ${cfg.lightY}%,` +
          `rgba(255,226,166,${cfg.strength}) 0,` +
          `rgba(255,145,48,${cfg.strength * 0.55}) 38%,` +
          `rgba(150,43,5,${cfg.strength * 0.15}) 68%,transparent 94%)`
      );
    }

    scene.game.style.setProperty('--rr-room-darkness', cfg.wallDark);

    if (scene.gun) {
      setImportant(
        scene.gun,
        'filter',
        `brightness(${1.01 + cfg.gunGleam * 0.12}) contrast(1.08) ` +
          `drop-shadow(0 12px 12px #000b) ` +
          `drop-shadow(0 -2px ${8 + cfg.gunGleam * 24}px rgba(255,145,44,${Math.min(0.9, cfg.gunGleam)}))`
      );
    }

    const targets = {
      lampArtX: image,
      lampWidth: image,
      lampArtY: image,
      lampScale: image,
      lampGlow: image,
      lampX: scene.swing,
      lampY: scene.swing,
      chainHeight: scene.chain,
      chainWidth: scene.chain,
      chainStretch: scene.chain,
      swing: scene.swing,
      speed: scene.light || scene.swing,
      lightX: scene.light,
      lightY: scene.light,
      spreadX: scene.light,
      spreadY: scene.light,
      strength: scene.light,
      track: scene.light,
      wallDark: scene.game,
      gunGleam: scene.gun
    };

    const connectedCount = Object.values(targets).filter(Boolean).length;
    return {
      mounted: true,
      image,
      scene,
      targets,
      connectedCount,
      totalControls: Object.keys(targets).length,
      config: cfg
    };
  }

  function watch(doc, configProvider, onApply) {
    let stopped = false;
    let scheduled = false;

    const run = () => {
      if (stopped) return;
      scheduled = false;
      const result = apply(doc, typeof configProvider === 'function' ? configProvider() : configProvider);
      if (typeof onApply === 'function') onApply(result);
    };

    const schedule = () => {
      if (scheduled || stopped) return;
      scheduled = true;
      const view = doc.defaultView || global;
      const requestFrame = view.requestAnimationFrame || (callback => view.setTimeout(callback, 16));
      requestFrame.call(view, run);
    };

    const Observer = doc.defaultView?.MutationObserver || global.MutationObserver;
    if (!Observer) {
      schedule();
      return () => { stopped = true; };
    }

    const observer = new Observer(schedule);
    observer.observe(doc.documentElement, { childList: true, subtree: true });
    schedule();

    return () => {
      stopped = true;
      observer.disconnect();
    };
  }

  global.RouletteLamp = Object.freeze({
    lampAsset,
    styleAsset,
    ensureStyles,
    queryScene,
    apply,
    watch
  });
})(window);
