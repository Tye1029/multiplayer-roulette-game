(function () {
  'use strict';

  const GAME_SELECTOR = '[data-roulette-game]';
  const MOTION_SELECTOR = '.rr-gun-motion';
  const ROTOR_ATTRIBUTE = 'data-rr-gun-facing-rotor';
  const OWNER_LOCAL = 'local';
  const OWNER_OPPONENT = 'opponent';
  const EFFECT_WORDS = /(flash|smoke|spark|muzzle|particle|shadow|glow|beam|light|effect)/i;
  const GUN_WORDS = /(gun|revolver|weapon|pistol|firearm)/i;

  let gameRoot = null;
  let gameObserver = null;
  let pageObserver = null;
  let scheduled = false;
  let lastOwner = '';
  let lastMotion = null;
  let lastRotor = null;
  let facingAnimation = null;

  const originalInline = new WeakMap();

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toUpperCase();
  }

  function isVisible(element) {
    if (!element || !element.isConnected) return false;
    if (!element.getClientRects().length) return false;
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0.01;
  }

  function ownerFromData(root) {
    const elements = [root, ...root.querySelectorAll('[data-is-my-turn],[data-current-turn],[data-turn-owner]')];
    for (const element of elements) {
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

  function scoreTurnText(text) {
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
      if (!isVisible(element) || element.closest('button,a,input,select,textarea')) continue;
      const match = scoreTurnText(normalizeText(element.textContent));
      if (match && (!best || match.score > best.score)) best = match;
    }
    return best?.owner || '';
  }

  function readOwner(root) {
    return ownerFromData(root) || ownerFromVisibleStatus(root);
  }

  function isEffectElement(element) {
    return EFFECT_WORDS.test(`${element.id || ''} ${element.className || ''}`);
  }

  function artworkLeaves(motion) {
    return [...motion.querySelectorAll('*')].filter(element => (
      !isEffectElement(element) &&
      isVisible(element) &&
      (element.childElementCount === 0 || /^(IMG|SVG|CANVAS|PICTURE)$/.test(element.tagName))
    ));
  }

  function findLowestCommonAncestor(elements, boundary) {
    if (!elements.length) return null;
    let candidate = elements[0];
    while (candidate && candidate !== boundary) {
      if (elements.every(element => candidate.contains(element))) return candidate;
      candidate = candidate.parentElement;
    }
    return boundary;
  }

  function countArtworkLeaves(element, leaves) {
    return leaves.reduce((count, leaf) => count + Number(element === leaf || element.contains(leaf)), 0);
  }

  function findGunRotor(motion) {
    const leaves = artworkLeaves(motion);
    if (!leaves.length) return motion.firstElementChild || motion;

    const namedCandidates = [...motion.querySelectorAll('*')]
      .filter(element => !isEffectElement(element) && GUN_WORDS.test(`${element.id || ''} ${element.className || ''}`))
      .map(element => ({ element, count: countArtworkLeaves(element, leaves) }))
      .filter(entry => entry.count > 0)
      .sort((a, b) => b.count - a.count);

    if (namedCandidates.length && namedCandidates[0].element !== motion) {
      return namedCandidates[0].element;
    }

    const common = findLowestCommonAncestor(leaves, motion);
    if (common && common !== motion) return common;

    const directCandidates = [...motion.children]
      .filter(element => !isEffectElement(element) && isVisible(element))
      .map(element => ({ element, count: countArtworkLeaves(element, leaves) }))
      .sort((a, b) => b.count - a.count);

    return directCandidates[0]?.element || motion;
  }

  function rememberInline(rotor) {
    if (originalInline.has(rotor)) return;
    originalInline.set(rotor, {
      rotate: rotor.style.getPropertyValue('rotate'),
      rotatePriority: rotor.style.getPropertyPriority('rotate'),
      origin: rotor.style.getPropertyValue('transform-origin'),
      originPriority: rotor.style.getPropertyPriority('transform-origin'),
      willChange: rotor.style.getPropertyValue('will-change'),
      willChangePriority: rotor.style.getPropertyPriority('will-change')
    });
  }

  function restoreProperty(element, property, value, priority) {
    if (value) element.style.setProperty(property, value, priority);
    else element.style.removeProperty(property);
  }

  function releaseRotor(rotor) {
    if (!rotor) return;
    const saved = originalInline.get(rotor);
    if (saved) {
      restoreProperty(rotor, 'rotate', saved.rotate, saved.rotatePriority);
      restoreProperty(rotor, 'transform-origin', saved.origin, saved.originPriority);
      restoreProperty(rotor, 'will-change', saved.willChange, saved.willChangePriority);
      originalInline.delete(rotor);
    } else {
      rotor.style.removeProperty('rotate');
      rotor.style.removeProperty('transform-origin');
      rotor.style.removeProperty('will-change');
    }
    rotor.removeAttribute(ROTOR_ATTRIBUTE);
  }

  function angleForOwner(owner) {
    return owner === OWNER_OPPONENT ? 180 : 0;
  }

  function setFacing(rotor, owner, previousOwner, shouldAnimate) {
    rememberInline(rotor);
    rotor.setAttribute(ROTOR_ATTRIBUTE, 'true');
    rotor.style.setProperty('transform-origin', '50% 50%', 'important');
    rotor.style.setProperty('will-change', 'rotate', 'important');

    const from = angleForOwner(previousOwner || owner);
    const to = angleForOwner(owner);
    rotor.style.setProperty('rotate', `${to}deg`, 'important');

    facingAnimation?.cancel();
    facingAnimation = null;

    if (!shouldAnimate || from === to || typeof rotor.animate !== 'function') return;

    facingAnimation = rotor.animate(
      [{ rotate: `${from}deg` }, { rotate: `${to}deg` }],
      {
        duration: 720,
        easing: 'cubic-bezier(.22,.72,.18,1)',
        fill: 'none'
      }
    );
    facingAnimation.addEventListener('finish', () => { facingAnimation = null; }, { once: true });
    facingAnimation.addEventListener('cancel', () => { facingAnimation = null; }, { once: true });
  }

  function applyFacing() {
    scheduled = false;
    if (!gameRoot?.isConnected) return bindGameRoot();

    const motion = gameRoot.querySelector(MOTION_SELECTOR);
    const owner = readOwner(gameRoot);
    if (!motion || !owner) return;

    const rotor = findGunRotor(motion);
    if (!rotor) return;

    const motionChanged = motion !== lastMotion;
    const rotorChanged = rotor !== lastRotor;
    const ownerChanged = owner !== lastOwner;
    if (!motionChanged && !rotorChanged && !ownerChanged) return;

    const previousOwner = lastOwner;
    if (rotorChanged && lastRotor) releaseRotor(lastRotor);

    lastMotion = motion;
    lastRotor = rotor;
    lastOwner = owner;

    setFacing(rotor, owner, previousOwner, Boolean(previousOwner && ownerChanged));
  }

  function scheduleFacing() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(applyFacing);
  }

  function bindGameRoot() {
    const nextRoot = document.querySelector(GAME_SELECTOR);
    if (nextRoot === gameRoot) return scheduleFacing();

    gameObserver?.disconnect();
    gameObserver = null;
    facingAnimation?.cancel();
    facingAnimation = null;
    releaseRotor(lastRotor);

    gameRoot = nextRoot;
    lastOwner = '';
    lastMotion = null;
    lastRotor = null;

    if (!gameRoot) return;

    gameObserver = new MutationObserver(scheduleFacing);
    gameObserver.observe(gameRoot, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        'class',
        'hidden',
        'aria-live',
        'data-is-my-turn',
        'data-current-turn',
        'data-turn-owner'
      ]
    });
    scheduleFacing();
  }

  function start() {
    bindGameRoot();
    pageObserver = new MutationObserver(() => {
      const currentRoot = document.querySelector(GAME_SELECTOR);
      if (currentRoot !== gameRoot) bindGameRoot();
    });
    pageObserver.observe(document.body || document.documentElement, { childList: true, subtree: true });
    window.addEventListener('pageshow', bindGameRoot, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
