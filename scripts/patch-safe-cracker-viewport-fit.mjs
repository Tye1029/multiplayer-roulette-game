import { readFile, writeFile } from 'node:fs/promises';

const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const cssStart = '/* SAFE_CRACKER_VIEWPORT_FIT_V7_START */';
const cssEnd = '/* SAFE_CRACKER_VIEWPORT_FIT_V7_END */';
const jsStart = '// SAFE_CRACKER_VIEWPORT_FIT_V7_START';

function replaceRequired(source, before, after, label) {
  if (after && source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Safe Cracker viewport-fit patch could not find ${label}.`);
  return source.replace(before, after);
}

let client = await readFile(clientUrl, 'utf8');
if (!client.includes(jsStart)) {
  client = replaceRequired(
    client,
    "    visualStatus: ''",
    "    visualStatus: '',\n    countdownPortalGameId: ''",
    'countdown portal state'
  );

  const helpers = [
    `  ${jsStart}`,
    '  function mountCountdownPortal(game, mount) {',
    "    const active = String(game?.status || '') === 'countdown';",
    "    const fresh = mount?.querySelector('[data-sc-start-countdown]') || null;",
    "    const existing = document.querySelector('body > [data-sc-start-countdown][data-sc-countdown-portal]');",
    '    if (!active || !fresh) {',
    '      existing?.remove();',
    "      runtime.countdownPortalGameId = '';",
    '      return;',
    '    }',
    "    const gameId = String(game?.gameId || '');",
    '    const syncCountdown = (target, source) => {',
    "      target.dataset.scCountdownLabel = source.dataset.scCountdownLabel || '';",
    "      const sourceValue = source.querySelector('[data-sc-countdown-value]');",
    "      const targetValue = target.querySelector('[data-sc-countdown-value]');",
    '      if (sourceValue && targetValue) {',
    '        targetValue.textContent = sourceValue.textContent;',
    '        targetValue.className = sourceValue.className;',
    '      }',
    "      const sourceStatus = source.querySelector('[data-sc-countdown-status]');",
    "      const targetStatus = target.querySelector('[data-sc-countdown-status]');",
    '      if (sourceStatus && targetStatus) targetStatus.textContent = sourceStatus.textContent;',
    '    };',
    '    if (existing) {',
    '      syncCountdown(existing, fresh);',
    '      fresh.remove();',
    '      runtime.countdownPortalGameId = gameId;',
    '      return;',
    '    }',
    "    fresh.setAttribute('data-sc-countdown-portal', '');",
    '    document.body.appendChild(fresh);',
    '    runtime.countdownPortalGameId = gameId;',
    '  }',
    '  // SAFE_CRACKER_VIEWPORT_FIT_V7_END',
    '',
    ''
  ].join('\n');
  client = replaceRequired(client, '  function resultOverlay(game) {', `${helpers}  function resultOverlay(game) {`, 'countdown portal helper insertion');

  const attemptPanelPattern = /\n\s*<aside class="sc-attempt-panel">[\s\S]*?<\/aside>/m;
  if (!attemptPanelPattern.test(client)) throw new Error('Safe Cracker viewport-fit patch could not find bottom attempt history panel.');
  client = client.replace(attemptPanelPattern, '');

  client = replaceRequired(
    client,
    `    bindControls(mount, game);\n    updateTimerOnly();`,
    `    mountCountdownPortal(game, mount);\n    bindControls(mount, game);\n    updateTimerOnly();`,
    'countdown portal call'
  );
}
await writeFile(clientUrl, client);

const viewportFit = String.raw`${cssStart}
.sc-safe-shell {
  grid-template-columns: minmax(0, 1fr);
  width: min(100%, 620px);
  margin-inline: auto;
}

.sc-attempt-panel {
  display: none !important;
}

.sc-dial-wrap {
  position: relative;
  z-index: 2;
  margin: 0 auto 12px;
}

.sc-step-controls {
  position: relative;
  z-index: 20;
  margin: 5px 0 7px;
}

.sc-step-controls button {
  position: relative;
  z-index: 21;
}

.safe-cracker-game[data-sc-status='countdown'] {
  animation: none !important;
  transform: none !important;
}

.sc-start-countdown-overlay[data-sc-countdown-portal] {
  position: fixed !important;
  inset: 0 !important;
  z-index: 100000 !important;
  width: 100vw !important;
  height: 100dvh !important;
  min-height: 100svh;
  margin: 0 !important;
  padding: 0 !important;
  display: grid !important;
  place-items: center !important;
  align-content: center !important;
  justify-content: center !important;
  overflow: hidden !important;
}

.sc-start-countdown-overlay[data-sc-countdown-portal] .sc-countdown-vault {
  left: 50% !important;
  top: 50% !important;
}

.sc-start-countdown-overlay[data-sc-countdown-portal] .sc-countdown-copy {
  grid-area: 1 / 1;
  align-self: center;
  justify-self: center;
  margin: 0;
}

html:has(.sc-start-countdown-overlay[data-sc-countdown-portal]),
body:has(.sc-start-countdown-overlay[data-sc-countdown-portal]) {
  overflow: hidden !important;
  overscroll-behavior: none;
}

@media (max-width: 700px) {
  .sc-topbar {
    grid-template-columns: minmax(0, 1fr) 60px minmax(0, 1fr);
  }

  .sc-player-card.me {
    min-width: 0;
    overflow: hidden;
  }

  .sc-player-card.me .sc-avatar {
    width: 30px;
    height: 30px;
    flex-basis: 30px;
  }

  .sc-player-card.me .sc-player-copy {
    min-width: 0;
    overflow: hidden;
  }

  .sc-player-card.me .sc-known-code {
    width: 100%;
    margin-top: 3px;
    display: block;
  }

  .sc-player-card.me .sc-known-code small {
    display: none;
  }

  .sc-player-card.me .sc-known-code > div {
    width: min(100%, 50px);
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 2px;
  }

  .sc-player-card.me .sc-known-code span {
    width: auto;
    min-width: 0;
    height: 16px;
    font-size: .56rem;
  }

  .sc-safe-shell {
    padding: 8px;
  }

  .sc-safe-door {
    min-height: 424px;
  }

  .sc-dial-wrap {
    width: min(65vw, 246px);
    height: min(65vw, 246px);
    margin-bottom: 13px;
  }

  .sc-dial-number {
    --radius: min(24vw, 88px);
  }

  .sc-step-controls {
    gap: 12px;
    margin: 7px 0 7px;
  }

  .sc-step-controls button {
    width: 48px;
    height: 33px;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.2), 0 3px 0 #090d0f, 0 6px 9px rgba(0,0,0,.35);
  }

  .sc-confirm-button {
    margin-top: 5px;
    margin-bottom: 8px;
  }
}

@media (max-width: 700px) and (max-height: 820px) {
  .sc-safe-door {
    min-height: 390px;
  }

  .sc-display {
    margin-top: 10px;
  }

  .sc-dial-wrap {
    width: min(58vw, 218px);
    height: min(58vw, 218px);
    margin-bottom: 11px;
  }

  .sc-dial-number {
    --radius: min(21vw, 77px);
  }

  .sc-step-controls {
    margin-top: 6px;
  }
}
${cssEnd}`;

let css = await readFile(cssUrl, 'utf8');
const markerPattern = /\/\* SAFE_CRACKER_VIEWPORT_FIT_V7_START \*\/[\s\S]*?\/\* SAFE_CRACKER_VIEWPORT_FIT_V7_END \*\/\s*/m;
css = css.replace(markerPattern, '').trimEnd() + `\n\n${viewportFit}\n`;
await writeFile(cssUrl, css);

let html = await readFile(indexUrl, 'utf8');
html = html.replaceAll('/assets/safe-cracker/safe-cracker.css?v=8&polish=2', '/assets/safe-cracker/safe-cracker.css?v=8&polish=2&fit=2');
html = html.replaceAll('/assets/safe-cracker/safe-cracker.js?v=8&polish=2', '/assets/safe-cracker/safe-cracker.js?v=8&polish=2&fit=2');
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker viewport-fit polish: countdown portal centered in the phone viewport, fitted code slots, removed history, and clear dial controls.');