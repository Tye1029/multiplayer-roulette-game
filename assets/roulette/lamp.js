(function (global) {
  'use strict';

  const configApi = global.RouletteLampConfig;
  if (!configApi) throw new Error('lamp-config.js must load before lamp.js');

  const lampAsset = '/assets/roulette/decor/lamp-1.png';
  const styleAsset = '/assets/roulette/lamp.css?v=18';
  const styleMarker = 'rrLampExternalStyles';
  const imageId = 'rrLampPng';
  const staleOverlayIds = ['rrLampTrackedLight', 'rrRoomDarknessOverlay', 'rrGunGlintOverlay', 'rrLampVisualOverlayRoot'];
  const phaseEpoch = Number(global.__rrLampPhaseEpoch) || Date.now();
  global.__rrLampPhaseEpoch = phaseEpoch;

  function ensureStyles(doc) {
    let link = doc.getElementById(styleMarker);
    if (!link) {
      link = doc.createElement('link');
      link.id = styleMarker;
      link.rel = 'stylesheet';
      doc.head.append(link);
    }
    if (!link.href.includes('lamp.css?v=18')) link.href = styleAsset;
    return link;
  }

  function queryScene(doc) {
    return {
      game: doc.querySelector('[data-roulette-game]'),
      rig: doc.querySelector('.rr126-lamp-rig'),
      swing: doc.querySelector('.rr126-swing'),
      chain: doc.querySelector('.rr126-chain'),
      sceneLight: doc.querySelector('.rr130-table-illumination')
    };
  }

  function ensureLampImage(doc, swing) {
    let image = swing.querySelector(`#${imageId}`);
    if (!image) {
      image = doc.createElement('img');
      image.id = imageId;
      image.alt = '';
      image.decoding = 'async';
      image.draggable = false;
      image.src = lampAsset;
      swing.append(image);
    } else if (!image.src.includes('/lamp-1.png')) {
      image.src = lampAsset;
    }
    return image;
  }

  function removeStaleOverlays(doc) {
    for (const id of staleOverlayIds) doc.getElementById(id)?.remove();
  }

  function setImportant(element, property, value) {
    if (element) element.style.setProperty(property, value, 'important');
  }

  function animationDelayFor(duration) {
    const seconds = Math.max(0.1, Number(duration) || 0.1);
    const elapsed = Math.max(0, (Date.now() - phaseEpoch) / 1000);
    return `${-(elapsed % seconds)}s`;
  }

  function applyLightingVariables(scene, cfg) {
    if (!scene.game) return false;

    const centerColor = `hsla(${cfg.lightHue},${cfg.lightSaturation}%,88%,${Math.min(1, cfg.strength)})`;
    const midColor = `hsla(${cfg.lightHue},${Math.max(0, cfg.lightSaturation - 8)}%,58%,${Math.min(0.88, cfg.strength * 0.58)})`;
    const edgeColor = `hsla(${cfg.lightHue},${Math.max(0, cfg.lightSaturation - 22)}%,30%,${Math.min(0.45, cfg.strength * 0.2)})`;
    const background =
      `radial-gradient(ellipse ${cfg.spreadX}% ${cfg.spreadY}% at ${cfg.lightX}% ${cfg.lightY}%,` +
      `${centerColor} 0,${midColor} 38%,${edgeColor} 68%,transparent 94%)`;

    scene.game.style.setProperty('--rr-cal-light-background', background);
    scene.game.style.setProperty('--rr-light-track-distance', `${cfg.track}%`);
    scene.game.style.setProperty('--rr-light-track-duration', `${cfg.trackSpeed}s`);
    scene.game.style.setProperty('--rr-room-darkness', `${cfg.wallDark}`);
    scene.game.style.setProperty('--rr-gun-gleam', `${cfg.gunGleam}`);

    if (scene.sceneLight) {
      setImportant(scene.sceneLight, 'animation-duration', `${cfg.trackSpeed}s`);
      setImportant(scene.sceneLight, 'animation-delay', animationDelayFor(cfg.trackSpeed));
    }
    return Boolean(scene.sceneLight);
  }

  function apply(doc, rawConfig = {}) {
    if (!doc || !doc.head) {
      return { mounted: false, connectedCount: 0, totalControls: Object.keys(configApi.bindings).length, targets: {} };
    }

    ensureStyles(doc);
    removeStaleOverlays(doc);
    const cfg = configApi.normalize(rawConfig);
    const scene = queryScene(doc);

    if (!scene.game || !scene.swing) {
      return {
        mounted: false,
        connectedCount: 0,
        totalControls: Object.keys(configApi.bindings).length,
        targets: {},
        config: cfg,
        scene
      };
    }

    const image = ensureLampImage(doc, scene.swing);

    setImportant(scene.swing, 'left', `${cfg.lampX}%`);
    setImportant(scene.swing, 'top', `calc(20% + ${cfg.lampY}px)`);
    setImportant(scene.swing, 'animation-duration', `${cfg.speed}s`);
    setImportant(scene.swing, 'animation-delay', animationDelayFor(cfg.speed));
    scene.swing.style.setProperty('--rr-lamp-swing-positive', `${cfg.swing}deg`);
    scene.swing.style.setProperty('--rr-lamp-swing-negative', `${-cfg.swing}deg`);

    image.style.setProperty('--rr-lamp-art-x', `${cfg.lampArtX}%`);
    image.style.setProperty('--rr-lamp-art-y', `${cfg.lampArtY}%`);
    image.style.setProperty('--rr-lamp-width', `${cfg.lampWidth}%`);
    image.style.setProperty('--rr-lamp-scale', cfg.lampScale);
    const lampGlow = Math.max(0, cfg.lampGlow);
    const glowColor = `hsla(${cfg.lightHue},${cfg.lightSaturation}%,64%,${Math.min(0.8, 0.12 + lampGlow * 0.42)})`;
    setImportant(
      image,
      'filter',
      `brightness(${1 + lampGlow * 0.12}) drop-shadow(0 0 ${4 + lampGlow * 14}px ${glowColor})`
    );

    if (scene.chain) {
      setImportant(scene.chain, 'left', `${cfg.lampX}%`);
      setImportant(scene.chain, 'height', `${cfg.chainHeight}%`);
      setImportant(scene.chain, 'width', `${cfg.chainWidth}px`);
      setImportant(scene.chain, 'min-width', `${cfg.chainWidth}px`);
      setImportant(scene.chain, 'background-size', `${cfg.chainWidth}px auto`);
      setImportant(scene.chain, 'transform', `translateX(-50%) scaleX(${cfg.chainStretch})`);
      scene.chain.style.setProperty('--rr-chain-left-length', `${cfg.chainLeftLength}%`);
      scene.chain.style.setProperty('--rr-chain-right-length', `${cfg.chainRightLength}%`);
      const chainChildren = Array.from(scene.chain.children);
      if (chainChildren[0]) setImportant(chainChildren[0], 'height', `${cfg.chainLeftLength}%`);
      if (chainChildren[1]) setImportant(chainChildren[1], 'height', `${cfg.chainRightLength}%`);
    }

    if (scene.rig) {
      scene.rig.style.setProperty('--rr-lamp-x', `${cfg.lampX}%`);
      scene.rig.style.setProperty('--rr-lamp-y', `${cfg.lampY}px`);
    }

    const lightMounted = applyLightingVariables(scene, cfg);
    const targets = {
      lampArtX: image,
      lampWidth: image,
      lampArtY: image,
      lampScale: image,
      lampGlow: image,
      lampX: scene.swing,
      lampY: scene.swing,
      chainHeight: scene.chain,
      chainLeftLength: scene.chain,
      chainRightLength: scene.chain,
      chainWidth: scene.chain,
      chainStretch: scene.chain,
      swing: scene.swing,
      speed: scene.swing,
      lightHue: lightMounted ? scene.game : null,
      lightSaturation: lightMounted ? scene.game : null,
      lightX: lightMounted ? scene.game : null,
      lightY: lightMounted ? scene.game : null,
      spreadX: lightMounted ? scene.game : null,
      spreadY: lightMounted ? scene.game : null,
      strength: lightMounted ? scene.game : null,
      track: lightMounted ? scene.game : null,
      trackSpeed: lightMounted ? scene.game : null,
      wallDark: scene.game,
      gunGleam: scene.game
    };

    return {
      mounted: true,
      image,
      scene,
      targets,
      connectedCount: Object.values(targets).filter(Boolean).length,
      totalControls: Object.keys(targets).length,
      config: cfg
    };
  }

  function watch(doc, configProvider, onApply) {
    let stopped = false;
    let applying = false;
    let lastGame = null;
    let lastSwing = null;
    let lastChain = null;
    let lastLight = null;
    const view = doc.defaultView || global;

    const currentConfig = () => (
      typeof configProvider === 'function' ? configProvider() : configProvider
    );

    const run = () => {
      if (stopped || applying) return;
      applying = true;
      try {
        const result = apply(doc, currentConfig());
        lastGame = result.scene?.game || null;
        lastSwing = result.scene?.swing || null;
        lastChain = result.scene?.chain || null;
        lastLight = result.scene?.sceneLight || null;
        if (typeof onApply === 'function') onApply(result);
      } finally {
        applying = false;
      }
    };

    const lampNeedsRepair = () => {
      const scene = queryScene(doc);
      if (scene.game !== lastGame || scene.swing !== lastSwing || scene.chain !== lastChain || scene.sceneLight !== lastLight) return true;
      return Boolean(scene.swing && !scene.swing.querySelector(`#${imageId}`));
    };

    const repairImmediately = () => {
      if (!stopped && !applying && lampNeedsRepair()) run();
    };

    const onResize = () => run();
    const Observer = view.MutationObserver || global.MutationObserver;
    const observer = Observer ? new Observer(repairImmediately) : null;
    const root = doc.body || doc.documentElement;
    if (observer && root) observer.observe(root, { childList: true, subtree: true });
    view.addEventListener?.('resize', onResize, { passive: true });
    run();

    return () => {
      stopped = true;
      observer?.disconnect();
      view.removeEventListener?.('resize', onResize);
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
