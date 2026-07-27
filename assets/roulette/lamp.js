(function (global) {
  'use strict';

  const configApi = global.RouletteLampConfig;
  if (!configApi) throw new Error('lamp-config.js must load before lamp.js');

  const lampAsset = '/assets/roulette/decor/lamp-1.png';
  const styleAsset = '/assets/roulette/lamp.css?v=11';
  const styleMarker = 'rrLampExternalStyles';
  const imageId = 'rrLampPng';
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
    if (!link.href.includes('lamp.css?v=11')) link.href = styleAsset;
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

  function ensureTrackedLight(doc, scene) {
    let light = doc.getElementById(trackedLightId);
    const host = scene.table || scene.game;
    if (!light) {
      light = doc.createElement('div');
      light.id = trackedLightId;
    }
    if (light.parentElement !== host) host.append(light);
    if (scene.table) {
      const position = doc.defaultView?.getComputedStyle(scene.table).position;
      if (!position || position === 'static') scene.table.style.setProperty('position', 'relative', 'important');
    }
    return light;
  }

  function ensureRoomOverlay(doc, game) {
    let overlay = doc.getElementById(roomOverlayId);
    if (!overlay) {
      overlay = doc.createElement('div');
      overlay.id = roomOverlayId;
    }
    if (overlay.parentElement !== game) game.prepend(overlay);
    return overlay;
  }

  function ensureGunGlint(doc, gun) {
    if (!gun) return null;
    let overlay = doc.getElementById(gunGlintId);
    if (!overlay) {
      overlay = doc.createElement('div');
      overlay.id = gunGlintId;
    }
    if (overlay.parentElement !== gun) gun.append(overlay);
    return overlay;
  }

  function setImportant(element, property, value) {
    if (element) element.style.setProperty(property, value, 'important');
  }

  function applyGunVisuals(scene, cfg, glintOverlay) {
    if (!scene.gun) return [];
    const glint = Math.max(0, cfg.gunGleam);
    const color = `hsla(${cfg.lightHue},${Math.max(55, cfg.lightSaturation)}%,88%,${Math.min(0.95, 0.18 + glint * 0.48)})`;
    const visuals = Array.from(scene.gun.querySelectorAll('img,svg,canvas,picture,[class*="sprite"],[class*="art"]'));
    const targets = visuals.length ? visuals : [scene.gun];

    for (const target of targets) {
      setImportant(
        target,
        'filter',
        `brightness(${1 + glint * 0.22}) contrast(${1.04 + glint * 0.08}) saturate(${1 + glint * 0.12}) ` +
          `drop-shadow(0 10px 12px rgba(0,0,0,.72)) ` +
          `drop-shadow(0 -2px ${6 + glint * 20}px ${color})`
      );
    }

    if (glintOverlay) {
      setImportant(glintOverlay, 'opacity', `${Math.min(0.9, glint * 0.62)}`);
      setImportant(
        glintOverlay,
        'background',
        `linear-gradient(102deg,transparent 0 37%,${color} 47%,transparent 58%),` +
          `radial-gradient(circle at 58% 35%,${color} 0 2%,transparent 13%)`
      );
    }
    return targets;
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
    const trackedLight = ensureTrackedLight(doc, scene);
    const roomOverlay = ensureRoomOverlay(doc, scene.game);
    const gunGlint = ensureGunGlint(doc, scene.gun);

    setImportant(scene.swing, 'left', `${cfg.lampX}%`);
    setImportant(scene.swing, 'top', `calc(20% + ${cfg.lampY}px)`);
    setImportant(scene.swing, 'animation-duration', `${cfg.speed}s`);
    setImportant(scene.swing, 'animation-delay', '0s');
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

    const centerColor = `hsla(${cfg.lightHue},${cfg.lightSaturation}%,88%,${Math.min(1, cfg.strength)})`;
    const midColor = `hsla(${cfg.lightHue},${Math.max(0, cfg.lightSaturation - 8)}%,58%,${Math.min(0.88, cfg.strength * 0.58)})`;
    const edgeColor = `hsla(${cfg.lightHue},${Math.max(0, cfg.lightSaturation - 22)}%,30%,${Math.min(0.45, cfg.strength * 0.2)})`;
    trackedLight.style.setProperty('--rr-light-track-positive', `${cfg.track}%`);
    trackedLight.style.setProperty('--rr-light-track-negative', `${-cfg.track}%`);
    setImportant(trackedLight, 'animation-duration', `${cfg.trackSpeed}s`);
    setImportant(trackedLight, 'animation-delay', '0s');
    setImportant(
      trackedLight,
      'background',
      `radial-gradient(ellipse ${cfg.spreadX}% ${cfg.spreadY}% at ${cfg.lightX}% ${cfg.lightY}%,` +
        `${centerColor} 0,${midColor} 38%,${edgeColor} 68%,transparent 94%)`
    );

    setImportant(roomOverlay, 'opacity', `${cfg.wallDark}`);
    const gunVisuals = applyGunVisuals(scene, cfg, gunGlint);

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
      lightHue: trackedLight,
      lightSaturation: trackedLight,
      lightX: trackedLight,
      lightY: trackedLight,
      spreadX: trackedLight,
      spreadY: trackedLight,
      strength: trackedLight,
      track: trackedLight,
      trackSpeed: trackedLight,
      wallDark: roomOverlay,
      gunGleam: gunGlint || gunVisuals[0] || null
    };

    const connectedCount = Object.values(targets).filter(Boolean).length;
    return {
      mounted: true,
      image,
      scene,
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
