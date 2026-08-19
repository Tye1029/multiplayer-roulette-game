import { readFile, writeFile } from 'node:fs/promises';

const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const cssStart = '/* SAFE_CRACKER_FINAL_POLISH_V6_START */';
const cssEnd = '/* SAFE_CRACKER_FINAL_POLISH_V6_END */';
const jsStart = '// SAFE_CRACKER_FINAL_POLISH_V6_START';

function replaceRequired(source, before, after, label) {
  if (after && source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Safe Cracker final-polish patch could not find ${label}.`);
  return source.replace(before, after);
}

let client = await readFile(clientUrl, 'utf8');
if (!client.includes(jsStart)) {
  client = replaceRequired(
    client,
    '    resultSequenceStartedAt: 0',
    "    resultSequenceStartedAt: 0,\n    resultSequenceAudioKey: '',\n    resultPortalFocusTimer: 0",
    'final result runtime state'
  );

  const helpers = [
    `  ${jsStart}`,
    '  function playSafeCrackerResultSequence(game, won, tied) {',
    "    const gameId = String(game?.gameId || '');",
    "    const key = gameId + ':' + (won ? 'win' : tied ? 'tie' : 'lose');",
    '    if (!gameId || runtime.resultSequenceAudioKey === key) return;',
    '    runtime.resultSequenceAudioKey = key;',
    '    if (won) {',
    "      playTone(76, .12, .065, 'square', .05);",
    "      playTone(112, .1, .052, 'square', .17);",
    "      playTone(178, .28, .03, 'sawtooth', .31);",
    "      playTone(286, .38, .035, 'triangle', .47);",
    "      playTone(440, .46, .032, 'sine', .56);",
    '      navigator.vibrate?.([18, 38, 18, 62, 34]);',
    '      window.setTimeout(() => playResult(true, false), 480);',
    '      return;',
    '    }',
    '    if (tied) {',
    "      playTone(138, .17, .045, 'square', .05);",
    "      playTone(210, .24, .026, 'triangle', .16);",
    '      navigator.vibrate?.([14, 42, 14]);',
    '      window.setTimeout(() => playResult(false, true), 160);',
    '      return;',
    '    }',
    "    playTone(92, .16, .052, 'square', .04);",
    "    playTone(62, .31, .05, 'sawtooth', .15);",
    '    navigator.vibrate?.([24, 30, 16]);',
    '    window.setTimeout(() => playResult(false, false), 150);',
    '  }',
    '',
    '  function revealSafeCrackerResultPortal(portal, won) {',
    '    if (!portal?.isConnected) return;',
    "    portal.classList.remove('sc-result-portal-pending');",
    "    portal.classList.add('sc-result-portal-ready');",
    "    portal.setAttribute('role', 'dialog');",
    "    portal.setAttribute('aria-modal', 'true');",
    "    portal.setAttribute('aria-label', won ? 'Safe Cracker win result' : 'Safe Cracker result');",
    "    document.body.classList.add('sc-result-portal-open');",
    "    document.body.classList.toggle('sc-result-win-open', Boolean(won));",
    "    const card = portal.querySelector('.sc-result-card');",
    '    if (!card) return;',
    "    card.setAttribute('tabindex', '-1');",
    '    if (runtime.resultPortalFocusTimer) window.clearTimeout(runtime.resultPortalFocusTimer);',
    '    runtime.resultPortalFocusTimer = window.setTimeout(() => {',
    '      try { card.focus({ preventScroll: true }); } catch { card.focus(); }',
    '      runtime.resultPortalFocusTimer = 0;',
    '    }, 70);',
    '  }',
    '',
    "  document.addEventListener('keydown', event => {",
    "    if (event.key !== 'Escape') return;",
    "    const portal = document.querySelector('body > [data-sc-result-sequence][data-sc-result-portal].sc-result-portal-ready');",
    '    if (!portal) return;',
    "    portal.querySelector('.duel-end-screen-close')?.click();",
    '  }, true);',
    '',
    '  const safeCrackerResultPortalObserver = new MutationObserver(() => {',
    "    const portal = document.querySelector('body > [data-sc-result-sequence][data-sc-result-portal]');",
    '    if (!portal) return;',
    "    const mount = document.querySelector('[data-safe-cracker-mount]');",
    '    if (!mount || !mount.isConnected) {',
    '      clearSafeCrackerResultPortal();',
    '      return;',
    '    }',
    "    const hiddenHost = mount.closest('[hidden], [aria-hidden=\"true\"]');",
    '    const style = window.getComputedStyle(mount);',
    "    if (hiddenHost || style.display === 'none' || style.visibility === 'hidden') clearSafeCrackerResultPortal();",
    '  });',
    "  safeCrackerResultPortalObserver.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'aria-hidden'] });",
    '  // SAFE_CRACKER_FINAL_POLISH_V6_END',
    '',
    ''
  ].join('\n');

  client = replaceRequired(
    client,
    '  function clearSafeCrackerResultPortal() {',
    `${helpers}  function clearSafeCrackerResultPortal() {`,
    'final result helper insertion'
  );

  client = replaceRequired(
    client,
    `    if (runtime.resultPortalTimer) window.clearTimeout(runtime.resultPortalTimer);\n    runtime.resultPortalTimer = 0;`,
    `    if (runtime.resultPortalTimer) window.clearTimeout(runtime.resultPortalTimer);\n    if (runtime.resultPortalFocusTimer) window.clearTimeout(runtime.resultPortalFocusTimer);\n    runtime.resultPortalTimer = 0;\n    runtime.resultPortalFocusTimer = 0;`,
    'result portal timer cleanup'
  );

  client = replaceRequired(
    client,
    "    document.body.classList.remove('sc-result-portal-open');",
    "    document.body.classList.remove('sc-result-portal-open', 'sc-result-win-open');",
    'result portal body cleanup'
  );

  client = replaceRequired(
    client,
    '      runtime.resultSequenceStartedAt = performance.now();',
    `      runtime.resultSequenceStartedAt = performance.now();\n      playSafeCrackerResultSequence(game, won, tied);`,
    'synchronized safe-opening audio start'
  );

  client = replaceRequired(
    client,
    "      if (existing.classList.contains('sc-result-portal-ready')) document.body.classList.add('sc-result-portal-open');",
    "      if (existing.classList.contains('sc-result-portal-ready')) { document.body.classList.add('sc-result-portal-open'); document.body.classList.toggle('sc-result-win-open', existing.classList.contains('win')); }",
    'existing result portal body state'
  );

  client = replaceRequired(
    client,
    "    fresh.setAttribute('data-sc-result-game-id', gameId);",
    "    fresh.setAttribute('data-sc-result-game-id', gameId);\n    fresh.setAttribute('aria-live', 'polite');",
    'result portal accessibility attributes'
  );

  client = replaceRequired(
    client,
    `    runtime.resultPortalTimer = window.setTimeout(() => {\n      fresh.classList.remove('sc-result-portal-pending');\n      fresh.classList.add('sc-result-portal-ready');\n      document.body.classList.add('sc-result-portal-open');\n      runtime.resultPortalTimer = 0;\n    }, remaining);`,
    `    runtime.resultPortalTimer = window.setTimeout(() => {\n      revealSafeCrackerResultPortal(fresh, won);\n      runtime.resultPortalTimer = 0;\n    }, remaining);`,
    'result portal reveal and focus sequence'
  );

  client = replaceRequired(
    client,
    '    playResult(won, tied);',
    '    // Result audio is synchronized with the physical safe-opening sequence.',
    'deferred result audio call'
  );

  client = replaceRequired(
    client,
    "    mount.querySelector('[data-sc-rematch]')?.addEventListener('click', () => window.__safeCrackerBridge?.rematch?.());",
    "    mount.querySelector('[data-sc-rematch]')?.addEventListener('click', () => { clearSafeCrackerResultPortal(); window.__safeCrackerBridge?.rematch?.(); });",
    'rematch portal cleanup'
  );

  client = replaceRequired(
    client,
    "    mount.querySelector('[data-sc-new-game]')?.addEventListener('click', () => window.__safeCrackerBridge?.newGame?.());",
    "    mount.querySelector('[data-sc-new-game]')?.addEventListener('click', () => { clearSafeCrackerResultPortal(); window.__safeCrackerBridge?.newGame?.(); });",
    'new-game portal cleanup'
  );
}
await writeFile(clientUrl, client);

const finalPolish = String.raw`${cssStart}
.sc-safe-shell.sc-gameplay-win {
  transform-origin: 50% 52%;
  animation: scGameplaySafeFocus 1.08s cubic-bezier(.2,.72,.2,1) both;
  animation-delay: var(--sc-result-animation-delay, 0ms);
}

.sc-safe-shell.sc-gameplay-win .sc-display,
.sc-safe-shell.sc-gameplay-win .sc-dial-wrap,
.sc-safe-shell.sc-gameplay-win .sc-confirm-button {
  animation: scGameplayGoldenReflection .88s ease both;
  animation-delay: calc(var(--sc-result-animation-delay, 0ms) + 300ms);
}

.sc-safe-shell.sc-gameplay-win .sc-safe-door::after {
  animation: scGameplayDoorEdgeLight .82s ease both;
  animation-delay: calc(var(--sc-result-animation-delay, 0ms) + 350ms);
}

body > .sc-result-overlay.win[data-sc-result-portal] {
  background:
    radial-gradient(ellipse at 50% 48%, rgba(255, 190, 76, .2), transparent 34%),
    linear-gradient(180deg, rgba(1, 3, 4, .58), rgba(1, 3, 4, .74)) !important;
  backdrop-filter: blur(3px) saturate(.88);
}

body > .sc-result-overlay[data-sc-result-portal] .sc-result-card {
  width: min(91vw, 438px);
  max-height: min(calc(100dvh - 24px), 600px);
  padding: 20px 18px 18px;
  border-color: rgba(165, 178, 181, .72);
  background:
    linear-gradient(145deg, rgba(49, 59, 67, .97), rgba(12, 18, 22, .97) 61%, rgba(37, 45, 50, .97));
  box-shadow:
    inset 0 0 0 2px rgba(8, 12, 14, .86),
    inset 0 1px 0 rgba(255,255,255,.13),
    0 22px 65px rgba(0,0,0,.72);
}

body > .sc-result-overlay.win[data-sc-result-portal] .sc-result-card {
  border-color: rgba(255, 211, 124, .72);
  box-shadow:
    inset 0 0 0 2px rgba(56, 34, 8, .82),
    inset 0 0 34px rgba(255, 178, 55, .1),
    0 0 28px rgba(255, 164, 42, .18),
    0 22px 65px rgba(0,0,0,.72);
}

body > .sc-result-overlay[data-sc-result-portal] .sc-result-kicker {
  font-size: .58rem;
  letter-spacing: .2em;
}

body > .sc-result-overlay[data-sc-result-portal] .sc-result-card h2 {
  font-size: clamp(1.9rem, 8vw, 2.75rem);
  line-height: .98;
}

body > .sc-result-overlay[data-sc-result-portal] .sc-result-card p {
  max-width: 36ch;
  line-height: 1.45;
}

body > .sc-result-overlay[data-sc-result-portal] .sc-code-reveal {
  gap: 8px;
}

body > .sc-result-overlay[data-sc-result-portal] .sc-result-actions {
  display: grid;
  grid-template-columns: minmax(0, .86fr) minmax(0, 1.14fr);
  gap: 8px;
}

body > .sc-result-overlay[data-sc-result-portal] .sc-result-actions button {
  min-width: 0;
  min-height: 45px;
  padding-inline: 9px;
  font-size: .69rem;
  letter-spacing: .035em;
}

body.sc-result-win-open .duel-end-screen-close {
  border-color: rgba(255, 219, 144, .82) !important;
  box-shadow: 0 0 15px rgba(255, 180, 58, .22), 0 4px 16px rgba(0,0,0,.5) !important;
}

@keyframes scGameplaySafeFocus {
  0%, 16% { transform: scale(1); filter: brightness(1); }
  100% { transform: scale(1.012); filter: brightness(1.04); }
}

@keyframes scGameplayGoldenReflection {
  0%, 28% { filter: brightness(1) saturate(1); }
  100% { filter: brightness(1.14) saturate(1.12) sepia(.12); }
}

@keyframes scGameplayDoorEdgeLight {
  0%, 28% { filter: none; opacity: .9; }
  100% { filter: drop-shadow(7px 0 8px rgba(255, 189, 73, .34)); opacity: 1; }
}

@media (max-width: 360px) {
  body > .sc-result-overlay[data-sc-result-portal] .sc-result-card {
    width: calc(100vw - 18px);
    padding: 17px 12px 14px;
  }

  body > .sc-result-overlay[data-sc-result-portal] .sc-result-actions {
    grid-template-columns: 1fr;
  }
}

@media (max-height: 690px) {
  body > .sc-result-overlay[data-sc-result-portal] .sc-result-card {
    padding-top: 15px;
    padding-bottom: 13px;
  }

  body > .sc-result-overlay[data-sc-result-portal] .sc-result-card h2 {
    margin: 5px 0 5px;
    font-size: clamp(1.7rem, 7vw, 2.25rem);
  }

  body > .sc-result-overlay[data-sc-result-portal] .sc-result-card p {
    margin-bottom: 8px;
    font-size: .74rem;
  }

  body > .sc-result-overlay[data-sc-result-portal] .sc-code-reveal {
    margin: 8px 0 10px;
  }

  body > .sc-result-overlay[data-sc-result-portal] .sc-result-actions button {
    min-height: 41px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sc-safe-shell.sc-gameplay-win,
  .sc-safe-shell.sc-gameplay-win .sc-display,
  .sc-safe-shell.sc-gameplay-win .sc-dial-wrap,
  .sc-safe-shell.sc-gameplay-win .sc-confirm-button,
  .sc-safe-shell.sc-gameplay-win .sc-safe-door::after {
    animation: none !important;
  }
}
${cssEnd}`;

let css = await readFile(cssUrl, 'utf8');
const markerPattern = /\/\* SAFE_CRACKER_FINAL_POLISH_V6_START \*\/[\s\S]*?\/\* SAFE_CRACKER_FINAL_POLISH_V6_END \*\/\s*/m;
css = css.replace(markerPattern, '').trimEnd() + `\n\n${finalPolish}\n`;
await writeFile(cssUrl, css);

let html = await readFile(indexUrl, 'utf8');
html = html.replaceAll('/assets/safe-cracker/safe-cracker.css?v=8&polish=2&fit=2&result=1', '/assets/safe-cracker/safe-cracker.css?v=8&polish=2&fit=2&result=1&final=1');
html = html.replaceAll('/assets/safe-cracker/safe-cracker.js?v=8&polish=2&fit=2&result=1', '/assets/safe-cracker/safe-cracker.js?v=8&polish=2&fit=2&result=1&final=1');
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker final polish: synchronized mechanical result audio, visible opened-safe ambience, compact mobile result card, accessibility, and portal cleanup.');
