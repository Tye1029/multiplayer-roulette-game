import { readFile, writeFile } from 'node:fs/promises';

const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const cssStart = '/* SAFE_CRACKER_RESULT_FLOW_V5_START */';
const cssEnd = '/* SAFE_CRACKER_RESULT_FLOW_V5_END */';
const jsStart = '// SAFE_CRACKER_RESULT_FLOW_V5_START';

function replaceRequired(source, before, after, label) {
  if (after && source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Safe Cracker result-flow patch could not find ${label}.`);
  return source.replace(before, after);
}

let client = await readFile(clientUrl, 'utf8');
if (!client.includes(jsStart)) {
  client = replaceRequired(
    client,
    "    countdownPortalGameId: ''",
    "    countdownPortalGameId: '',\n    resultPortalGameId: '',\n    resultPortalTimer: 0,\n    resultSequenceStartedAt: 0",
    'result portal runtime state'
  );

  const helpers = [
    `  ${jsStart}`,
    '  function clearSafeCrackerResultPortal() {',
    '    if (runtime.resultPortalTimer) window.clearTimeout(runtime.resultPortalTimer);',
    '    runtime.resultPortalTimer = 0;',
    "    document.querySelector('body > [data-sc-result-sequence][data-sc-result-portal]')?.remove();",
    "    document.body.classList.remove('sc-result-portal-open');",
    "    runtime.resultPortalGameId = '';",
    '    runtime.resultSequenceStartedAt = 0;',
    '  }',
    '',
    '  function mountSafeCrackerResultPortal(game, mount) {',
    "    const complete = String(game?.status || '') === 'complete';",
    "    const fresh = mount?.querySelector('[data-sc-result-sequence]') || null;",
    "    const existing = document.querySelector('body > [data-sc-result-sequence][data-sc-result-portal]');",
    '    if (!complete) {',
    '      clearSafeCrackerResultPortal();',
    '      return;',
    '    }',
    '    if (!fresh) return;',
    "    const gameId = String(game?.gameId || '');",
    "    const myUserId = String(game?.isCreator ? game?.creator?.userId : game?.joiner?.userId || '');",
    '    const won = Boolean(game?.winnerUserId && String(game.winnerUserId) === myUserId);',
    '    const tied = Boolean(game?.tie);',
    '    const sameSequence = runtime.resultPortalGameId === gameId && runtime.resultSequenceStartedAt > 0;',
    '    if (!sameSequence) {',
    '      runtime.resultPortalGameId = gameId;',
    '      runtime.resultSequenceStartedAt = performance.now();',
    '    }',
    '    const elapsed = Math.max(0, performance.now() - runtime.resultSequenceStartedAt);',
    "    const shell = mount?.querySelector('.sc-safe-shell');",
    '    if (shell) {',
    "      shell.classList.add(won ? 'sc-gameplay-win' : tied ? 'sc-gameplay-tie' : 'sc-gameplay-lose');",
    "      shell.style.setProperty('--sc-result-animation-delay', '-' + Math.min(elapsed, 1200) + 'ms');",
    '    }',
    '    if (existing) {',
    '      fresh.remove();',
    "      if (existing.classList.contains('sc-result-portal-ready')) document.body.classList.add('sc-result-portal-open');",
    '      return;',
    '    }',
    "    fresh.setAttribute('data-sc-result-portal', '');",
    "    fresh.setAttribute('data-sc-result-game-id', gameId);",
    "    fresh.classList.add('sc-result-portal-pending');",
    '    document.body.appendChild(fresh);',
    "    const reducedMotion = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);",
    '    const revealDelay = reducedMotion ? 0 : won ? 1180 : tied ? 420 : 520;',
    '    const remaining = Math.max(0, revealDelay - elapsed);',
    '    if (runtime.resultPortalTimer) window.clearTimeout(runtime.resultPortalTimer);',
    '    runtime.resultPortalTimer = window.setTimeout(() => {',
    "      fresh.classList.remove('sc-result-portal-pending');",
    "      fresh.classList.add('sc-result-portal-ready');",
    "      document.body.classList.add('sc-result-portal-open');",
    '      runtime.resultPortalTimer = 0;',
    '    }, remaining);',
    '  }',
    '  // SAFE_CRACKER_RESULT_FLOW_V5_END',
    '',
    ''
  ].join('\n');

  client = replaceRequired(
    client,
    '  function resultOverlay(game) {',
    `${helpers}  function resultOverlay(game) {`,
    'result portal helper insertion'
  );

  client = replaceRequired(
    client,
    `    mountCountdownPortal(game, mount);\n    bindControls(mount, game);\n    updateTimerOnly();`,
    `    mountCountdownPortal(game, mount);\n    bindControls(mount, game);\n    mountSafeCrackerResultPortal(game, mount);\n    updateTimerOnly();`,
    'post-bind result portal call'
  );
}
await writeFile(clientUrl, client);

const resultFlow = String.raw`${cssStart}
.sc-safe-shell.sc-gameplay-win,
.sc-safe-shell.sc-gameplay-lose,
.sc-safe-shell.sc-gameplay-tie {
  perspective: 1200px;
  overflow: visible;
}

.sc-safe-shell.sc-gameplay-win::before {
  z-index: 1;
  inset: 10px;
  border: 1px solid rgba(255, 211, 124, .42);
  border-radius: 20px;
  background:
    radial-gradient(ellipse at 68% 50%, rgba(255, 239, 181, .96) 0 5%, rgba(255, 187, 72, .72) 18%, rgba(142, 76, 18, .36) 42%, rgba(25, 13, 5, .94) 70%),
    #140b04;
  box-shadow:
    inset 0 0 42px rgba(255, 183, 66, .5),
    0 0 34px rgba(255, 166, 48, .2);
  opacity: 0;
  animation: scGameplayVaultCore 1.05s ease both;
  animation-delay: calc(var(--sc-result-animation-delay, 0ms) + 330ms);
}

.sc-safe-shell.sc-gameplay-win::after {
  z-index: 4;
  inset: -9% -18%;
  border-radius: 32px;
  background:
    radial-gradient(ellipse at 70% 52%, rgba(255, 222, 147, .62), rgba(255, 169, 52, .2) 28%, transparent 62%);
  mix-blend-mode: screen;
  filter: blur(12px);
  opacity: 0;
  animation: scGameplayGoldSpill .82s ease both;
  animation-delay: calc(var(--sc-result-animation-delay, 0ms) + 430ms);
}

.sc-safe-shell.sc-gameplay-win .sc-safe-door,
.sc-safe-shell.sc-gameplay-lose .sc-safe-door,
.sc-safe-shell.sc-gameplay-tie .sc-safe-door {
  position: relative;
  z-index: 2;
  transform-style: preserve-3d;
  backface-visibility: hidden;
}

.sc-safe-shell.sc-gameplay-win .sc-safe-door {
  transform-origin: 4% 50%;
  animation: scGameplaySafeDoorOpen 1.08s cubic-bezier(.18,.76,.2,1) both;
  animation-delay: var(--sc-result-animation-delay, 0ms);
}

.sc-safe-shell.sc-gameplay-win .sc-bolts.left i {
  animation: scGameplayBoltLeft .34s ease both;
  animation-delay: calc(var(--sc-result-animation-delay, 0ms) + 180ms);
}

.sc-safe-shell.sc-gameplay-win .sc-bolts.right i {
  animation: scGameplayBoltRight .34s ease both;
  animation-delay: calc(var(--sc-result-animation-delay, 0ms) + 180ms);
}

.sc-safe-shell.sc-gameplay-lose .sc-safe-door {
  animation: scGameplayDenied .42s ease both;
  animation-delay: var(--sc-result-animation-delay, 0ms);
}

.sc-safe-shell.sc-gameplay-tie .sc-display {
  box-shadow: inset 0 0 24px rgba(255, 198, 68, .3), 0 0 18px rgba(255, 198, 68, .2);
}

body > .sc-result-overlay[data-sc-result-portal] {
  position: fixed !important;
  inset: 0 !important;
  z-index: 100001 !important;
  width: 100vw !important;
  height: 100dvh !important;
  min-height: 100svh;
  margin: 0 !important;
  padding: max(14px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(14px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left)) !important;
  display: grid !important;
  place-items: center !important;
  overflow: hidden !important;
  background:
    radial-gradient(ellipse at 50% 42%, rgba(105, 123, 128, .16), transparent 38%),
    rgba(1, 3, 4, .9) !important;
  backdrop-filter: blur(9px) saturate(.72);
  animation: none !important;
  transition: opacity .24s ease;
}

body > .sc-result-overlay.win[data-sc-result-portal] {
  background:
    radial-gradient(ellipse at 50% 42%, rgba(219, 151, 52, .18), transparent 40%),
    rgba(1, 3, 4, .91) !important;
}

body > .sc-result-overlay[data-sc-result-portal].sc-result-portal-pending {
  opacity: 0;
  pointer-events: none;
  backdrop-filter: none;
}

body > .sc-result-overlay[data-sc-result-portal].sc-result-portal-ready {
  opacity: 1;
  pointer-events: auto;
  animation: scResultPortalBackdropIn .28s ease both !important;
}

body > .sc-result-overlay[data-sc-result-portal] .sc-result-card {
  width: min(92vw, 470px);
  max-height: calc(100dvh - 28px);
  margin: 0;
  padding: 22px 20px 20px;
  overflow: auto;
  border-radius: 20px;
  animation: none !important;
}

body > .sc-result-overlay[data-sc-result-portal].sc-result-portal-ready .sc-result-card {
  animation: scResultPortalCardIn .34s cubic-bezier(.18,.82,.22,1) both !important;
}

body > .sc-result-overlay[data-sc-result-portal] .sc-result-vault {
  display: none !important;
}

body > .sc-result-overlay[data-sc-result-portal] .sc-result-content {
  opacity: 1 !important;
  transform: none !important;
  animation: none !important;
}

body > .sc-result-overlay[data-sc-result-portal] .sc-result-kicker {
  margin-top: 0;
}

body > .sc-result-overlay[data-sc-result-portal] .sc-result-card h2 {
  margin: 8px 0 7px;
}

body > .sc-result-overlay[data-sc-result-portal] .sc-result-card p {
  margin: 0 auto 12px;
}

body > .sc-result-overlay[data-sc-result-portal] .sc-code-reveal {
  margin: 12px 0 15px;
}

body > .sc-result-overlay[data-sc-result-portal] .sc-result-actions {
  margin-top: 4px;
}

body.sc-result-portal-open {
  overflow: hidden !important;
  overscroll-behavior: none;
}

@keyframes scGameplaySafeDoorOpen {
  0%, 18% { transform: rotateY(0deg) translateX(0) scale(1); filter: brightness(1); }
  42% { transform: rotateY(-2deg) translateX(-1px) scale(.998); filter: brightness(1.04); }
  100% { transform: rotateY(-15deg) translateX(-5px) scale(.988); filter: brightness(.83); }
}

@keyframes scGameplayVaultCore {
  0%, 28% { opacity: 0; transform: scale(.96); }
  100% { opacity: 1; transform: scale(1); }
}

@keyframes scGameplayGoldSpill {
  0%, 18% { opacity: 0; transform: scale(.9); }
  100% { opacity: .92; transform: scale(1.03); }
}

@keyframes scGameplayBoltLeft {
  from { transform: translateX(0); }
  to { transform: translateX(-20px); opacity: .42; }
}

@keyframes scGameplayBoltRight {
  from { transform: translateX(0); }
  to { transform: translateX(20px); opacity: .42; }
}

@keyframes scGameplayDenied {
  0%, 100% { transform: translateX(0); }
  24% { transform: translateX(-4px); }
  52% { transform: translateX(4px); }
  76% { transform: translateX(-2px); }
}

@keyframes scResultPortalBackdropIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scResultPortalCardIn {
  0% { opacity: 0; transform: translateY(12px) scale(.965); }
  100% { opacity: 1; transform: none; }
}

@media (max-width: 700px) {
  body > .sc-result-overlay[data-sc-result-portal] .sc-result-card {
    width: calc(100vw - 24px);
    padding: 19px 14px 16px;
  }

  body > .sc-result-overlay[data-sc-result-portal] .sc-result-card h2 {
    font-size: clamp(1.8rem, 9vw, 2.7rem);
  }

  body > .sc-result-overlay[data-sc-result-portal] .sc-code-reveal {
    margin: 10px 0 13px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sc-safe-shell.sc-gameplay-win .sc-safe-door {
    animation: none !important;
    transform: rotateY(-12deg) translateX(-4px) scale(.99);
  }

  .sc-safe-shell.sc-gameplay-win::before,
  .sc-safe-shell.sc-gameplay-win::after {
    animation: none !important;
    opacity: .82;
  }

  body > .sc-result-overlay[data-sc-result-portal].sc-result-portal-ready,
  body > .sc-result-overlay[data-sc-result-portal].sc-result-portal-ready .sc-result-card {
    animation: none !important;
  }
}
${cssEnd}`;

let css = await readFile(cssUrl, 'utf8');
const markerPattern = /\/\* SAFE_CRACKER_RESULT_FLOW_V5_START \*\/[\s\S]*?\/\* SAFE_CRACKER_RESULT_FLOW_V5_END \*\/\s*/m;
css = css.replace(markerPattern, '').trimEnd() + `\n\n${resultFlow}\n`;
await writeFile(cssUrl, css);

let html = await readFile(indexUrl, 'utf8');
html = replaceRequired(
  html,
  "        if (duelActive.querySelector('.duel-end-screen-close')) return;",
  "        if (document.querySelector('.sc-result-overlay[data-sc-result-portal] .duel-end-screen-close') || duelActive.querySelector('.duel-end-screen-close')) return;",
  'portal-aware close-button duplicate guard'
);
html = replaceRequired(
  html,
  "        const target = duelActive.querySelector('.sc-result-card, [data-fishing-result-card], .roulette-result-card, .draw-result-card, [class*=\"result-card\"], .sc-result-overlay > *, [class*=\"result-overlay\"] > *, .duel-arena') || duelActive;",
  "        const target = document.querySelector('body > .sc-result-overlay[data-sc-result-portal] .sc-result-card') || duelActive.querySelector('.sc-result-card, [data-fishing-result-card], .roulette-result-card, .draw-result-card, [class*=\"result-card\"], .sc-result-overlay > *, [class*=\"result-overlay\"] > *, .duel-arena') || duelActive;",
  'portal-aware close-button target'
);
html = replaceRequired(
  html,
  `          event.stopPropagation();\n          duelCloseCompletedScreen(id, false);`,
  `          event.stopPropagation();\n          button.closest('.sc-result-overlay[data-sc-result-portal]')?.remove();\n          document.body.classList.remove('sc-result-portal-open');\n          duelCloseCompletedScreen(id, false);`,
  'result portal cleanup on close'
);
html = html.replaceAll('/assets/safe-cracker/safe-cracker.css?v=8&polish=2&fit=2', '/assets/safe-cracker/safe-cracker.css?v=8&polish=2&fit=2&result=1');
html = html.replaceAll('/assets/safe-cracker/safe-cracker.js?v=8&polish=2&fit=2', '/assets/safe-cracker/safe-cracker.js?v=8&polish=2&fit=2&result=1');
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker result-flow pass: gameplay safe opens with golden light before a compact centered result portal.');
