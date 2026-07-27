(function (global) {
  'use strict';

  const configApi = global.RouletteLampConfig;
  if (!configApi) throw new Error('lamp-config.js must load before lamp.js');

  const lampAsset = '/assets/roulette/decor/lamp-1.png';
  const styleAsset = '/assets/roulette/lamp.css?v=12';
  const styleMarker = 'rrLampExternalStyles';
  const imageId = 'rrLampPng';
  const overlayRootId = 'rrLampVisualOverlayRoot';
  const trackedLightId = 'rrLampTrackedLight';
  const roomOverlayId = 'rrRoomDarknessOverlay';
  const gunGlintId = 'rrGunGlintOverlay';

  function ensureStyles(doc) {
    let link = doc.getElementById(styleMarker);
    if (!link) {
      link = doc.createElement('link');
      link.id = styleMarker;
      link.rel = 'stylesheet';
      doc.head.append(link);
    }
    if (!link.href.includes('lamp.css?v=12')) link.href = styleAsset;
    return link;
  }

  function queryScene(doc) {
    return {
      game: doc.querySelector('[data-roulette-game]'),
      rig: doc.querySelector('.rr126-lamp-rig'),
      swing: doc.querySelector('.rr126-swing'),
      chain: doc.querySelector('.rr126-chain'),
      legacyLight: doc.querySelector('.rr130-table-illumination'),
      table: doc.querySelector('.rr-table'),
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
    if (!image.src.includes('/lamp-1.png')) image.src = lampAsset;

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

  function ensureOverlay(doc, root, id) {
    let overlay = doc.getElementById(id);
    if (!overlay) {
      overlay = doc.createElement('div');
      overlay.id = id;
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

    const glint = Math.max(0, cfg.gunGleam);
    const rect = scene.gun.getBoundingClientRect();
    const paddingX = rect.width * 0.04;
    const paddingY = rect.height * 0.08;
    const mounted = syncOverlayRect(gunGlint, scene.gun, paddingX, paddingY);
    if (!mounted) return false;

    const color = `hsla(${cfg.lightHue},${Math.max(55, cfg.lightSaturation)}%,88%,${Math.min(0.95, 0.12 + glint * 0.5)})`;
    setImportant(gunGlint, 'opacity', `${Math.min(0.9, glint * 0.62)}`);
    setImportant(
      gunGlint,
      'background',
      `linear-gradient(102deg,transparent 0 38%,${color} 48%,transparent 58%),` +
        `radial-gradient(circle at 58% 35%,${color} 0 2%,transparent 13%)`
    );
    return true;
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
    const overlayRoot = ensureOverlayRoot(doc);
    const trackedLight = ensureOverlay(doc, overlayRoot, trackedLightId);
    const roomOverlay = ensureOverlay(doc, overlayRoot, roomOverlayId);
    const gunGlint = ensureOverlay(doc, overlayRoot, gunGlintId);

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

    const tableRect = scene.table?.getBoundingClientRect();
    const tablePaddingX = tableRect ? tableRect.width * 0.08 : 0;
    const tablePaddingY = tableRect ? tableRect.height * 0.08 : 0;
    const lightMounted = syncOverlayRect(trackedLight, scene.table, tablePaddingX, tablePaddingY);
    if (lightMounted) {
      const centerColor = `hsla(${cfg.lightHue},${cfg.lightSaturation}%,88%,${Math.min(1, cfg.strength)})`;
      const midColor = `hsla(${cfg.lightHue},${Math.max(0, cfg.lightSaturation - 8)}%,58%,${Math.min(0.88, cfg.strength * 0.58)})`;
      const edgeColor = `hsla(${cfg.lightHue},${Math.max(0, cfg.lightSaturation - 22)}%,30%,${Math.min(0.45, cfg.strength * 0.2)})`;
      trackedLight.style.setProperty('--rr-light-track-positive', `${cfg.track}%`);
      trackedLight.style.setProperty('--rr-light-track-negative', `${-cfg.track}%`);
      setImportant(trackedLight, 'animation-duration', `${cfg.trackSpeed}s`);
      setImportant(
        trackedLight,
        'background',
        `radial-gradient(ellipse ${cfg.spreadX}% ${cfg.spreadY}% at ${cfg.lightX}% ${cfg.lightY}%,` +
          `${centerColor} 0,${midColor} 38%,${edgeColor} 68%,transparent 94%)`
      );
    }

    const roomMounted = syncOverlayRect(roomOverlay, scene.game);
    if (roomMounted) setImportant(roomOverlay, 'opacity', `${cfg.wallDark}`);
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
      lightHue: lightMounted ? trackedLight : null,
      lightSaturation: lightMounted ? trackedLight : null,
      lightX: lightMounted ? trackedLight : null,
      lightY: lightMounted ? trackedLight : null,
      spreadX: lightMounted ? trackedLight : null,
      spreadY: lightMounted ? trackedLight : null,
      strength: lightMounted ? trackedLight : null,
      track: lightMounted ? trackedLight : null,
      trackSpeed: lightMounted ? trackedLight : null,
      wallDark: roomMounted ? roomOverlay : null,
      gunGleam: gunMounted ? gunGlint : null
    };

    const connectedCount = Object.values(targets).filter(Boolean).length;
    return {
      mounted: true,
      image,
      scene,
      overlayRoot,
      trackedLight,
      roomOverlay,
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
    timer = view.setInterval(run, 750);

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
