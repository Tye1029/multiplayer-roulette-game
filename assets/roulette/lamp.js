(function (global) {
  'use strict';

  const configApi = global.RouletteLampConfig;
  if (!configApi) throw new Error('lamp-config.js must load before lamp.js');

  const lampAsset = '/assets/roulette/decor/lamp-1.png';
  const styleAsset = '/assets/roulette/lamp.css?v=14';
  const styleMarker = 'rrLampExternalStyles';
  const imageId = 'rrLampPng';
  const overlayRootId = 'rrLampVisualOverlayRoot';
  const gunGlintId = 'rrGunGlintOverlay';
  const staleOverlayIds = ['rrLampTrackedLight', 'rrRoomDarknessOverlay'];

  function ensureStyles(doc) {
    let link = doc.getElementById(styleMarker);
    if (!link) {
      link = doc.createElement('link');
      link.id = styleMarker;
      link.rel = 'stylesheet';
      doc.head.append(link);
    }
    if (!link.href.includes('lamp.css?v=14')) link.href = styleAsset;
    return link;
  }

  function queryScene(doc) {
    return {
      game: doc.querySelector('[data-roulette-game]'),
      rig: doc.querySelector('.rr126-lamp-rig'),
      swing: doc.querySelector('.rr126-swing'),
      chain: doc.querySelector('.rr126-chain'),
      sceneLight: doc.querySelector('.rr130-table-illumination'),
      gun: doc.querySelector('.rr-gun-motion')
    };
  }

  function revealNewLamp(swing, image) {
    const reveal = () => {
      swing.dataset.rrLampReady = 'true';
      image.style.setProperty('visibility', 'visible', 'important');
      image.style.setProperty('opacity', '1', 'important');
    };

    if (image.complete && image.naturalWidth > 0) {
      reveal();
    } else {
      swing.dataset.rrLampReady = 'false';
      image.addEventListener('load', reveal, { once: true });
      image.addEventListener('error', () => {
        swing.dataset.rrLampReady = 'false';
      }, { once: true });
    }
  }

  function ensureLampImage(doc, swing) {
    let image = doc.getElementById(imageId);
    if (!image) {
      image = doc.createElement('img');
      image.id = imageId;
      image.alt = '';
      image.decoding = 'async';
      image.draggable = false;
      image.style.setProperty('visibility', 'hidden', 'important');
      swing.append(image);
    }

    if (!image.src.includes('/lamp-1.png')) {
      swing.dataset.rrLampReady = 'false';
      image.src = lampAsset;
    }

    for (const oldImage of swing.querySelectorAll(`:scope > img:not(#${imageId})`)) {
      oldImage.remove();
    }
    for (const oldPart of swing.querySelectorAll(
      '[class*="lamp-body"],[class*="lamp-shade"],[class*="shade-art"],[class*="underside"]'
    )) {
      if (oldPart !== image && !oldPart.contains(image)) oldPart.remove();
    }

    revealNewLamp(swing, image);
    return image;
  }

  function removeStaleOverlays(doc) {
    for (const id of staleOverlayIds) doc.getElementById(id)?.remove();
  }

  function ensureOverlayRoot(doc) {
    let root = doc.getElementById(overlayRootId);
    if (!root) {
      root = doc.createElement('div');
      root.id = overlayRootId;
      root.setAttribute('aria-hidden', 'true');
      (doc.body || doc.documentElement).append(root);
    }
    return root;
  }

  function ensureGunGlint(doc, root) {
    let overlay = doc.getElementById(gunGlintId);
    if (!overlay) {
      overlay = doc.createElement('div');
      overlay.id = gunGlintId;
      root.append(overlay);
    } else if (overlay.parentElement !== root) {
      root.append(overlay);
    }
    return overlay;
  }

  function setImportant(element, property, value) {
    if (element) element.style.setProperty(property, value, 'important');
  }

  function syncOverlayRect(overlay, target, paddingX = 0, paddingY = paddingX) {
    if (!overlay || !target) {
      if (overlay) setImportant(overlay, 'display', 'none');
      return false;
    }

    const rect = target.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      setImportant(overlay, 'display', 'none');
      return false;
    }

    setImportant(overlay, 'display', 'block');
    setImportant(overlay, 'left', `${rect.left - paddingX}px`);
    setImportant(overlay, 'top', `${rect.top - paddingY}px`);
    setImportant(overlay, 'width', `${rect.width + paddingX * 2}px`);
    setImportant(overlay, 'height', `${rect.height + paddingY * 2}px`);
    return true;
  }

  function applyGunGlint(scene, cfg, gunGlint) {
    if (!scene.gun || !gunGlint) {
      if (gunGlint) setImportant(gunGlint, 'display', 'none');
      return false;
    }

    if (cfg.gunGleam <= 0.05) {
      setImportant(gunGlint, 'display', 'none');
      return true;
    }

    const glint = Math.max(0, cfg.gunGleam);
    const rect = scene.gun.getBoundingClientRect();
    const mounted = syncOverlayRect(gunGlint, scene.gun, rect.width * 0.03, rect.height * 0.05);
    if (!mounted) return false;

    const color = `hsla(${cfg.lightHue},${Math.max(55, cfg.lightSaturation)}%,90%,${Math.min(0.72, 0.08 + glint * 0.38)})`;
    setImportant(gunGlint, 'opacity', `${Math.min(0.55, glint * 0.42)}`);
    setImportant(
      gunGlint,
      'background',
      `radial-gradient(ellipse 42% 26% at 58% 35%,${color} 0 4%,transparent 70%)`
    );
    return true;
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
    scene.game.style.setProperty('--rr-light-track-positive', `${cfg.track}%`);
    scene.game.style.setProperty('--rr-light-track-negative', `${-cfg.track}%`);
    scene.game.style.setProperty('--rr-light-track-duration', `${cfg.trackSpeed}s`);
    scene.game.style.setProperty('--rr-room-darkness', `${cfg.wallDark}`);
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
        config: cfg
      };
    }

    const image = ensureLampImage(doc, scene.swing);
    const overlayRoot = ensureOverlayRoot(doc);
    const gunGlint = ensureGunGlint(doc, overlayRoot);

    setImportant(scene.swing, 'left', `${cfg.lampX}%`);
    setImportant(scene.swing, 'top', `calc(20% + ${cfg.lampY}px)`);
    setImportant(scene.swing, 'animation-duration', `${cfg.speed}s`);
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
    const gunMounted = applyGunGlint(scene, cfg, gunGlint);

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
      gunGleam: gunMounted ? gunGlint : null
    };

    const connectedCount = Object.values(targets).filter(Boolean).length;
    return {
      mounted: true,
      image,
      scene,
      overlayRoot,
      gunGlint,
      targets,
      connectedCount,
      totalControls: Object.keys(targets).length,
      config: cfg
    };
  }

  function watch(doc, configProvider, onApply) {
    let stopped = false;
    let timer = null;
    const view = doc.defaultView || global;

    const run = () => {
      if (stopped) return;
      const result = apply(doc, typeof configProvider === 'function' ? configProvider() : configProvider);
      if (typeof onApply === 'function') onApply(result);
    };

    const onResize = () => run();
    view.addEventListener?.('resize', onResize, { passive: true });
    run();
    timer = view.setInterval(run, 1000);

    return () => {
      stopped = true;
      if (timer != null) view.clearInterval(timer);
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
