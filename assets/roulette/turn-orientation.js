(function () {
  'use strict';

  const GAME_SELECTOR = '[data-roulette-game]';
  const GUN_SELECTOR = '.rr-gun-motion';
  const STYLE_ID = 'rrTurnOrientationStyles';
  const OWNER_ATTRIBUTE = 'data-rr-turn-owner';
  const READY_ATTRIBUTE = 'data-rr-turn-ready';
  const OWNER_LOCAL = 'local';
  const OWNER_OPPONENT = 'opponent';

  let gameRoot = null;
  let gameObserver = null;
  let lastOwner = '';
  let lastGun = null;
  let scheduled = false;
  let readyFrame = 0;

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      ${GAME_SELECTOR} ${GUN_SELECTOR} {
        rotate: 0deg !important;
        transform-origin: 50% 50% !important;
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

  function enableTransitionsNextFrame(root) {
    cancelAnimationFrame(readyFrame);
    readyFrame = requestAnimationFrame(() => {
      if (root === gameRoot && root.isConnected) root.setAttribute(READY_ATTRIBUTE, 'true');
    });
  }

  function applyOrientation() {
    scheduled = false;
    if (!gameRoot?.isConnected) return bindGameRoot();

    const gun = gameRoot.querySelector(GUN_SELECTOR);
    const owner = readOwner(gameRoot);
    if (!gun || !owner) return;

    const gunChanged = gun !== lastGun;
    const ownerChanged = owner !== lastOwner;
    if (!gunChanged && !ownerChanged) return;

    if (gunChanged) gameRoot.removeAttribute(READY_ATTRIBUTE);
    gameRoot.setAttribute(OWNER_ATTRIBUTE, owner);

    lastGun = gun;
    lastOwner = owner;

    if (gunChanged) enableTransitionsNextFrame(gameRoot);
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
        'hidden',
        'aria-live',
        'data-is-my-turn',
        'data-current-turn',
        'data-turn-owner'
      ]
    });
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
    window.addEventListener('pageshow', bindGameRoot, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
