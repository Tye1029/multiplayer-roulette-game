(function () {
  'use strict';

  const GAME_SELECTOR = '[data-roulette-game]';
  const GUN_SELECTOR = '.rr-gun-motion';
  const STYLE_ID = 'rrTurnOrientationStyles';
  const OWNER_ATTRIBUTE = 'data-rr-turn-owner';
  const READY_ATTRIBUTE = 'data-rr-turn-ready';
  const OWNER_LOCAL = 'local';
  const OWNER_OPPONENT = 'opponent';
  const LARGE_ROTATION_DEGREES = 90;
  const MEDIA_TAGS = new Set(['IMG', 'SVG', 'CANVAS', 'PICTURE', 'VIDEO']);

  let gameRoot = null;
  let gameObserver = null;
  let lastOwner = '';
  let lastGun = null;
  let scheduled = false;
  let readyFrame = 0;
  let orientationFrame = 0;

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      ${GAME_SELECTOR} ${GUN_SELECTOR} {
        rotate: 0deg !important;
        transform-box: border-box !important;
        transform-origin: var(--rr-turn-origin-x, 50%) var(--rr-turn-origin-y, 50%) !important;
      }
      ${GAME_SELECTOR}[${OWNER_ATTRIBUTE}="${OWNER_OPPONENT}"] ${GUN_SELECTOR} {
        rotate: 180deg !important;
      }
      ${GAME_SELECTOR}[${READY_ATTRIBUTE}="true"] ${GUN_SELECTOR} {
        transition: rotate 780ms cubic-bezier(.22,.72,.18,1) !important;
        will-change: rotate;
      }
      @media (prefers-reduced-motion: reduce) {
        ${GAME_SELECTOR}[${READY_ATTRIBUTE}="true"] ${GUN_SELECTOR} {
          transition-duration: 1ms !important;
        }
      }
    `;
    document.head.append(style);
  }

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toUpperCase();
  }

  function isVisible(element) {
    if (!element || element.closest('button,a,input,select,textarea')) return false;
    if (!element.getClientRects().length) return false;
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0.01;
  }

  function ownerFromData(root) {
    const dataElements = [root, ...root.querySelectorAll('[data-is-my-turn],[data-current-turn],[data-turn-owner]')];
    for (const element of dataElements) {
      const isMyTurn = element.getAttribute?.('data-is-my-turn');
      if (isMyTurn === 'true') return OWNER_LOCAL;
      if (isMyTurn === 'false') return OWNER_OPPONENT;

      const value = normalizeText(
        element.getAttribute?.('data-current-turn') ||
        element.getAttribute?.('data-turn-owner') ||
        ''
      );
      if (/^(LOCAL|ME|MY|SELF|YOU|YOUR)$/.test(value)) return OWNER_LOCAL;
      if (/^(OPPONENT|REMOTE|OTHER|ENEMY|BOT|NPC)$/.test(value)) return OWNER_OPPONENT;
    }
    return '';
  }

  function scoreStatusText(text) {
    if (!text || text.length > 140) return null;
    if (/^YOUR TURN[.!]?$/.test(text)) return { owner: OWNER_LOCAL, score: 120 };
    if (/\bYOUR TURN\b/.test(text)) return { owner: OWNER_LOCAL, score: 105 };
    if (/\bHAS THE REVOLVER\b/.test(text)) return { owner: OWNER_OPPONENT, score: 115 };
    if (/\bOPPONENT(?:'S)? TURN\b|\bREMOTE PLAYER(?:'S)? TURN\b/.test(text)) {
      return { owner: OWNER_OPPONENT, score: 110 };
    }
    if (/^WAITING FOR (?:THE )?OTHER PLAYER[.!]?$/.test(text)) {
      return { owner: OWNER_OPPONENT, score: 70 };
    }
    return null;
  }

  function ownerFromVisibleStatus(root) {
    const selector = [
      'h1',
      'h2',
      'h3',
      '[role="status"]',
      '[aria-live]',
      '[class*="turn"]',
      '[class*="holder"]',
      '[class*="status"]',
      '[class*="message"]'
    ].join(',');

    let best = null;
    for (const element of root.querySelectorAll(selector)) {
      if (!isVisible(element)) continue;
      const match = scoreStatusText(normalizeText(element.textContent));
      if (match && (!best || match.score > best.score)) best = match;
    }
    return best?.owner || '';
  }

  function readOwner(root) {
    return ownerFromData(root) || ownerFromVisibleStatus(root);
  }

  function rotationFromTransform(transform) {
    const value = String(transform || '');
    let largest = 0;
    for (const match of value.matchAll(/rotate(?:Z)?\(\s*(-?\d+(?:\.\d+)?)deg\s*\)/gi)) {
      largest = Math.max(largest, Math.abs(Number(match[1]) || 0));
    }
    const matrix = value.match(/matrix\(\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?),/i);
    if (matrix) {
      const angle = Math.abs(Math.atan2(Number(matrix[2]), Number(matrix[1])) * 180 / Math.PI);
      largest = Math.max(largest, angle);
    }
    return largest;
  }

  function cancelLegacyFlip(gun) {
    for (const animation of gun.getAnimations()) {
      if (animation.effect?.target !== gun) continue;
      let keyframes = [];
      try {
        keyframes = animation.effect.getKeyframes();
      } catch {
        continue;
      }
      const isLargeTransformFlip = keyframes.some(frame => (
        rotationFromTransform(frame.transform) >= LARGE_ROTATION_DEGREES
      ));
      if (isLargeTransformFlip) animation.cancel();
    }
  }

  function restoreInlineProperty(element, property, value, priority) {
    if (value) element.style.setProperty(property, value, priority);
    else element.style.removeProperty(property);
  }

  function measureVisibleArtworkPivot(gun) {
    const previousRotate = gun.style.getPropertyValue('rotate');
    const previousRotatePriority = gun.style.getPropertyPriority('rotate');
    const previousTransition = gun.style.getPropertyValue('transition');
    const previousTransitionPriority = gun.style.getPropertyPriority('transition');

    gun.style.setProperty('transition', 'none', 'important');
    gun.style.setProperty('rotate', '0deg', 'important');

    const gunRect = gun.getBoundingClientRect();
    if (!gunRect.width || !gunRect.height) {
      restoreInlineProperty(gun, 'rotate', previousRotate, previousRotatePriority);
      restoreInlineProperty(gun, 'transition', previousTransition, previousTransitionPriority);
      return;
    }

    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    let found = false;

    for (const element of gun.querySelectorAll('*')) {
      const isLeafArtwork = MEDIA_TAGS.has(element.tagName) || element.children.length === 0;
      if (!isLeafArtwork || !isVisible(element)) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      left = Math.min(left, rect.left);
      top = Math.min(top, rect.top);
      right = Math.max(right, rect.right);
      bottom = Math.max(bottom, rect.bottom);
      found = true;
    }

    const centerX = found ? (left + right) / 2 : gunRect.left + gunRect.width / 2;
    const centerY = found ? (top + bottom) / 2 : gunRect.top + gunRect.height / 2;
    const originX = Math.max(0, Math.min(gunRect.width, centerX - gunRect.left));
    const originY = Math.max(0, Math.min(gunRect.height, centerY - gunRect.top));

    gun.style.setProperty('--rr-turn-origin-x', `${originX}px`);
    gun.style.setProperty('--rr-turn-origin-y', `${originY}px`);

    restoreInlineProperty(gun, 'rotate', previousRotate, previousRotatePriority);
    restoreInlineProperty(gun, 'transition', previousTransition, previousTransitionPriority);
  }

  function cancelPendingFrames() {
    cancelAnimationFrame(readyFrame);
    cancelAnimationFrame(orientationFrame);
    readyFrame = 0;
    orientationFrame = 0;
  }

  function enableTransitionsNextFrame(root) {
    cancelPendingFrames();
    readyFrame = requestAnimationFrame(() => {
      if (root === gameRoot && root.isConnected) root.setAttribute(READY_ATTRIBUTE, 'true');
    });
  }

  function animateReplacementFromPreviousOwner(root, previousOwner, nextOwner) {
    cancelPendingFrames();
    root.removeAttribute(READY_ATTRIBUTE);
    root.setAttribute(OWNER_ATTRIBUTE, previousOwner);

    readyFrame = requestAnimationFrame(() => {
      if (root !== gameRoot || !root.isConnected) return;
      root.setAttribute(READY_ATTRIBUTE, 'true');
      orientationFrame = requestAnimationFrame(() => {
        if (root === gameRoot && root.isConnected && lastOwner === nextOwner) {
          root.setAttribute(OWNER_ATTRIBUTE, nextOwner);
        }
      });
    });
  }

  function applyOrientation() {
    scheduled = false;
    if (!gameRoot?.isConnected) return bindGameRoot();

    const gun = gameRoot.querySelector(GUN_SELECTOR);
    const owner = readOwner(gameRoot);
    if (!gun || !owner) return;

    cancelLegacyFlip(gun);

    const previousOwner = lastOwner;
    const gunChanged = gun !== lastGun;
    const ownerChanged = owner !== previousOwner;
    if (!gunChanged && !ownerChanged) return;

    measureVisibleArtworkPivot(gun);
    lastGun = gun;
    lastOwner = owner;

    if (gunChanged && ownerChanged && previousOwner) {
      animateReplacementFromPreviousOwner(gameRoot, previousOwner, owner);
      return;
    }

    if (gunChanged) {
      gameRoot.removeAttribute(READY_ATTRIBUTE);
      gameRoot.setAttribute(OWNER_ATTRIBUTE, owner);
      enableTransitionsNextFrame(gameRoot);
      return;
    }

    cancelPendingFrames();
    gameRoot.setAttribute(OWNER_ATTRIBUTE, owner);
  }

  function scheduleOrientation() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(applyOrientation);
  }

  function bindGameRoot() {
    const nextRoot = document.querySelector(GAME_SELECTOR);
    if (nextRoot === gameRoot) return scheduleOrientation();

    gameObserver?.disconnect();
    gameObserver = null;
    cancelPendingFrames();
    gameRoot = nextRoot;
    lastGun = null;
    lastOwner = '';

    if (!gameRoot) return;
    gameRoot.removeAttribute(READY_ATTRIBUTE);
    gameObserver = new MutationObserver(scheduleOrientation);
    gameObserver.observe(gameRoot, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        'class',
        'style',
        'hidden',
        'aria-live',
        'data-is-my-turn',
        'data-current-turn',
        'data-turn-owner'
      ]
    });
    gameRoot.addEventListener('animationstart', scheduleOrientation, true);
    gameRoot.addEventListener('transitionrun', scheduleOrientation, true);
    scheduleOrientation();
  }

  function start() {
    ensureStyles();
    bindGameRoot();
    const pageObserver = new MutationObserver(() => {
      const currentRoot = document.querySelector(GAME_SELECTOR);
      if (currentRoot !== gameRoot) bindGameRoot();
    });
    pageObserver.observe(document.body || document.documentElement, { childList: true, subtree: true });
    window.addEventListener('resize', scheduleOrientation, { passive: true });
    window.addEventListener('pageshow', bindGameRoot, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
