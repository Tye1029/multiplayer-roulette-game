(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  if (params.has('lampCalibration')) return;

  const GAME_SELECTOR = '[data-roulette-game]';
  const GUN_SELECTOR = '.rr-gun-motion';
  const TURN_PHRASE = /(your turn|opponent(?:'s)? turn|enemy(?:'s)? turn|waiting for (?:the )?(?:other player|opponent)|(?:creator|joiner|player\s*[12])(?:'s)? turn)/i;
  const SHOT_PHRASE = /(bang|gunshot|fired|fires|shoots|shot|click|empty chamber|survived|eliminated|was killed|is dead)/i;
  const TURN_DATA_KEY = /(current.*turn|turn.*(?:user|player|owner)|active.*player|current.*player|shooter)/i;
  const TURN_ELEMENT_SELECTOR = [
    '[data-turn]',
    '[data-current-turn]',
    '[data-active-player]',
    '[data-shooter]',
    '[aria-current="true"]',
    '[class*="turn"][class*="active"]',
    '[class*="current-turn"]',
    '[id*="turn"]',
    '[class*="turn"]'
  ].join(',');
  const STATUS_ELEMENT_SELECTOR = '[class*="status"],[id*="status"],[class*="message"],[id*="message"]';

  let game = null;
  let gun = null;
  let previousAngle = 0;
  let turnSignature = '';
  let shotSignature = '';
  let initialized = false;
  let scheduled = false;
  let turnAnimation = null;
  let recoilAnimation = null;
  let turnSequence = 0;

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 180);
  }

  function elementIdentity(element) {
    if (!element) return '';
    const parts = [element.id, element.className];
    for (const name of ['data-turn', 'data-current-turn', 'data-active-player', 'data-shooter', 'data-user-id', 'data-player-id', 'aria-current']) {
      const value = element.getAttribute?.(name);
      if (value) parts.push(`${name}:${value}`);
    }
    const text = normalizeText(element.textContent);
    const phrase = text.match(TURN_PHRASE)?.[0];
    if (phrase) parts.push(phrase.toLowerCase());
    return parts.filter(Boolean).join(':');
  }

  function readTurnSignature(root) {
    if (!root) return '';
    const values = [];

    for (const [key, value] of Object.entries(root.dataset || {})) {
      if (TURN_DATA_KEY.test(key) && value != null && value !== '') values.push(`${key}:${value}`);
    }

    const candidates = root.querySelectorAll(TURN_ELEMENT_SELECTOR);
    for (let index = 0; index < Math.min(candidates.length, 24); index += 1) {
      const candidate = candidates[index];
      const identity = elementIdentity(candidate);
      if (identity) values.push(identity);
    }

    if (!values.length) {
      const statusCandidates = root.querySelectorAll(STATUS_ELEMENT_SELECTOR);
      for (let index = 0; index < Math.min(statusCandidates.length, 20); index += 1) {
        const text = normalizeText(statusCandidates[index].textContent);
        const phrase = text.match(TURN_PHRASE)?.[0];
        if (phrase) values.push(phrase.toLowerCase());
      }
    }

    return [...new Set(values)].sort().join('|');
  }

  function readShotSignature(root, gunElement) {
    const values = [];
    if (gunElement) {
      const gunState = `${gunElement.id || ''} ${gunElement.className || ''}`;
      const stateMatch = gunState.match(/(?:shooting|firing|recoil|hammer|bang|click|shot)/i)?.[0];
      if (stateMatch) values.push(stateMatch.toLowerCase());
      for (const [key, value] of Object.entries(gunElement.dataset || {})) {
        if (/(shot|fire|shoot|recoil|hammer|result|revision)/i.test(key)) values.push(`${key}:${value}`);
      }
    }

    if (root) {
      const candidates = root.querySelectorAll(STATUS_ELEMENT_SELECTOR);
      for (let index = 0; index < Math.min(candidates.length, 24); index += 1) {
        const text = normalizeText(candidates[index].textContent);
        const match = text.match(SHOT_PHRASE)?.[0];
        if (match) values.push(`${match.toLowerCase()}:${text}`);
      }
    }

    return [...new Set(values)].sort().join('|');
  }

  function readAngle(element) {
    if (!element) return 0;
    const transform = getComputedStyle(element).transform;
    if (!transform || transform === 'none') return 0;

    try {
      const Matrix = window.DOMMatrixReadOnly || window.DOMMatrix || window.WebKitCSSMatrix;
      if (Matrix) {
        const matrix = new Matrix(transform);
        return Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
      }
    } catch {}

    const match = transform.match(/^matrix\(([^)]+)\)$/);
    if (!match) return 0;
    const values = match[1].split(',').map(Number);
    return Math.atan2(values[1], values[0]) * 180 / Math.PI;
  }

  function normalizeDelta(value) {
    let delta = value;
    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;
    return delta;
  }

  function playTurnAnimation(element, oldAngle, newAngle, forceHalfTurn) {
    if (!element?.animate) return;
    turnAnimation?.cancel();

    let delta = normalizeDelta(oldAngle - newAngle);
    if (forceHalfTurn && Math.abs(delta) < 25) {
      turnSequence += 1;
      delta = turnSequence % 2 ? -180 : 180;
    }
    if (Math.abs(delta) < 1) return;

    const overshoot = delta > 0 ? -4 : 4;
    try {
      turnAnimation = element.animate([
        { rotate: `${delta}deg`, scale: '0.985', offset: 0 },
        { rotate: `${overshoot}deg`, scale: '1.008', offset: 0.84 },
        { rotate: '0deg', scale: '1', offset: 1 }
      ], {
        duration: 760,
        easing: 'cubic-bezier(.22,.72,.18,1)',
        fill: 'none'
      });
    } catch {
      turnAnimation = null;
    }
  }

  function playRecoilAnimation(element) {
    if (!element?.animate) return;
    recoilAnimation?.cancel();
    try {
      recoilAnimation = element.animate([
        { translate: '0 0', scale: '1', offset: 0 },
        { translate: '-3.5% 1.5%', scale: '1.018', offset: 0.28 },
        { translate: '1% -0.4%', scale: '0.996', offset: 0.62 },
        { translate: '0 0', scale: '1', offset: 1 }
      ], {
        duration: 300,
        easing: 'cubic-bezier(.2,.8,.2,1)',
        fill: 'none'
      });
    } catch {
      recoilAnimation = null;
    }
  }

  function synchronize() {
    scheduled = false;
    const nextGame = document.querySelector(GAME_SELECTOR);
    const nextGun = nextGame?.querySelector(GUN_SELECTOR) || document.querySelector(GUN_SELECTOR);
    const nextTurnSignature = readTurnSignature(nextGame);
    const nextShotSignature = readShotSignature(nextGame, nextGun);
    const nextAngle = readAngle(nextGun);

    if (!initialized) {
      game = nextGame;
      gun = nextGun;
      turnSignature = nextTurnSignature;
      shotSignature = nextShotSignature;
      previousAngle = nextAngle;
      initialized = true;
      return;
    }

    const gameChanged = nextGame !== game;
    const gunChanged = nextGun !== gun;
    const turnChanged = Boolean(nextTurnSignature && nextTurnSignature !== turnSignature);
    const shotChanged = Boolean(nextShotSignature && nextShotSignature !== shotSignature);

    if (nextGun && (turnChanged || (gunChanged && gun))) {
      playTurnAnimation(nextGun, previousAngle, nextAngle, turnChanged || gameChanged);
    }
    if (nextGun && shotChanged) playRecoilAnimation(nextGun);

    game = nextGame;
    gun = nextGun;
    turnSignature = nextTurnSignature || turnSignature;
    shotSignature = nextShotSignature || '';
    previousAngle = nextAngle;
  }

  function scheduleSynchronize() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => requestAnimationFrame(synchronize));
  }

  function start() {
    synchronize();
    const observer = new MutationObserver(scheduleSynchronize);
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'data-turn', 'data-current-turn', 'data-active-player', 'data-shooter', 'data-user-id', 'data-player-id', 'aria-current']
    });
    window.addEventListener('resize', scheduleSynchronize, { passive: true });
    window.addEventListener('pageshow', scheduleSynchronize, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
