import { readFile, writeFile } from 'node:fs/promises';

const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const cssStart = '/* SAFE_CRACKER_VISUAL_STABILITY_V5_START */';
const cssEnd = '/* SAFE_CRACKER_VISUAL_STABILITY_V5_END */';
const jsStart = '// SAFE_CRACKER_VISUAL_STABILITY_V5_START';

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Safe Cracker visual-stability patch could not find ${label}.`);
  return source.replace(before, after);
}

let client = await readFile(clientUrl, 'utf8');
if (!client.includes(jsStart)) {
  client = replaceRequired(
    client,
    "    countdownSoundKey: ''",
    "    countdownSoundKey: '',\n    visualGameId: '',\n    visualStatus: ''",
    'stable-render runtime state'
  );

  const helpers = [
    `  ${jsStart}`,
    '  function lockedCode(progress = {}) {',
    '    const attempts = Array.isArray(progress?.attempts) ? progress.attempts : [];',
    '    const solved = new Map();',
    '    for (const attempt of attempts) {',
    "      if (!(attempt?.correct || String(attempt?.tier || '') === 'green')) continue;",
    '      const stage = Math.max(0, Math.min(STAGES - 1, Number(attempt.stage || 0)));',
    '      solved.set(stage, Math.max(0, Math.min(9, Number(attempt.guess || 0))));',
    '    }',
    "    const slots = Array.from({ length: STAGES }, (_, index) => solved.has(index)",
    "      ? '<span class=\"known\" aria-label=\"Tumbler ' + (index + 1) + ' locked at ' + solved.get(index) + '\">' + solved.get(index) + '</span>'",
    "      : '<span aria-label=\"Tumbler ' + (index + 1) + ' not locked\">•</span>').join('');",
    "    return '<div class=\"sc-known-code\"><small>LOCKED CODE</small><div>' + slots + '</div></div>';",
    '  }',
    '  // SAFE_CRACKER_VISUAL_STABILITY_V5_END',
    '',
    ''
  ].join('\n');
  client = replaceRequired(client, '  function resultOverlay(game) {', `${helpers}  function resultOverlay(game) {`, 'locked-code helper insertion');

  client = replaceRequired(
    client,
    `    const nextStageKey = stageKey(game);\n    if (runtime.stageKey !== nextStageKey) {`,
    `    const nextStageKey = stageKey(game);\n    const stageChanged = runtime.stageKey !== nextStageKey;\n    const visualGameId = String(game?.gameId || '');\n    const visualStatus = String(game?.status || '');\n    const stableVisual = runtime.visualGameId === visualGameId && runtime.visualStatus === visualStatus && !stageChanged;\n    runtime.visualGameId = visualGameId;\n    runtime.visualStatus = visualStatus;\n    if (stageChanged) {`,
    'stable render classification'
  );

  client = replaceRequired(
    client,
    'class="safe-cracker-game" data-sc-game-id=',
    'class="safe-cracker-game${stableVisual ? \' sc-stable-render\' : \'\'}" data-sc-game-id=',
    'stable render root class'
  );

  client = replaceRequired(
    client,
    `<div class="sc-player-copy"><small>YOU</small><b>\${escapeHtml(myPlayer?.name || 'Player')}</b><div class="sc-progress-lights">\${progressLights(me)}</div></div>`,
    `<div class="sc-player-copy"><small>YOU</small><b>\${escapeHtml(myPlayer?.name || 'Player')}</b>\${lockedCode(me)}<div class="sc-progress-lights">\${progressLights(me)}</div></div>`,
    'top-left locked code readout'
  );

  client = replaceRequired(
    client,
    `    runtime.busy = true;\n    render(game);`,
    `    runtime.busy = true;\n    const confirmButton = document.querySelector('[data-sc-confirm]');\n    if (confirmButton) {\n      confirmButton.disabled = true;\n      confirmButton.classList.add('busy');\n      const confirmLabel = confirmButton.querySelector('span');\n      if (confirmLabel) confirmLabel.textContent = 'CHECKING…';\n    }`,
    'non-rebuilding busy state'
  );
}
await writeFile(clientUrl, client);

const visualStability = String.raw`${cssStart}
.safe-cracker-game {
  isolation: isolate;
  background:
    radial-gradient(ellipse at 50% 2%, rgba(255, 202, 119, .34), transparent 34%),
    radial-gradient(ellipse at 50% 43%, rgba(201, 117, 42, .16), transparent 53%),
    radial-gradient(ellipse at 50% 62%, rgba(91, 117, 124, .14), transparent 48%),
    linear-gradient(180deg, #151b1f 0%, #090d10 52%, #030506 100%);
}

.safe-cracker-game::before,
.safe-cracker-game::after {
  z-index: 0;
}

.safe-cracker-game::before {
  opacity: .82;
  background:
    radial-gradient(ellipse at 50% 8%, rgba(255, 193, 101, .2), transparent 37%),
    linear-gradient(90deg, transparent 49.75%, rgba(255,255,255,.025) 50%, transparent 50.25%),
    repeating-linear-gradient(0deg, rgba(255,255,255,.016) 0 1px, transparent 1px 5px),
    repeating-linear-gradient(90deg, rgba(255,255,255,.012) 0 1px, transparent 1px 7px);
}

.safe-cracker-game > .sc-topbar,
.safe-cracker-game > .sc-opponent-strip,
.safe-cracker-game > .sc-safe-shell {
  position: relative;
  z-index: 1;
}

.sc-safe-shell {
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.12),
    inset 0 0 0 5px rgba(4,7,8,.62),
    inset 0 -26px 60px rgba(0,0,0,.48),
    0 -18px 54px rgba(224, 148, 61, .13),
    0 24px 50px rgba(0,0,0,.42);
}

.sc-known-code {
  margin-top: 6px;
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 6px;
}

.sc-known-code small {
  color: rgba(232, 207, 151, .62);
  font-size: .4rem;
  letter-spacing: .12em;
  white-space: nowrap;
}

.sc-known-code > div {
  display: grid;
  grid-template-columns: repeat(3, 18px);
  gap: 3px;
}

.sc-known-code span {
  height: 20px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(125, 138, 143, .32);
  border-radius: 4px;
  color: rgba(205, 215, 218, .3);
  background: linear-gradient(180deg, rgba(255,255,255,.045), rgba(3,6,7,.72));
  box-shadow: inset 0 0 6px rgba(0,0,0,.72);
  font: 900 .7rem/1 ui-monospace, monospace;
}

.sc-known-code span.known {
  border-color: rgba(82, 255, 142, .58);
  color: #bfffd1;
  background: linear-gradient(180deg, rgba(82,255,142,.13), rgba(4,25,13,.88));
  box-shadow: inset 0 0 7px rgba(82,255,142,.11), 0 0 6px rgba(82,255,142,.13);
}

.sc-confirm-button,
.sc-step-controls button,
.sc-result-actions button {
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.sc-confirm-button:focus:not(:focus-visible),
.sc-step-controls button:focus:not(:focus-visible),
.sc-result-actions button:focus:not(:focus-visible) {
  outline: none;
}

.sc-confirm-button.busy {
  transform: none !important;
  filter: none !important;
}

.safe-cracker-game.sc-stable-render[data-sc-status='playing'] .sc-player-card,
.safe-cracker-game.sc-stable-render[data-sc-status='playing'] .sc-opponent-strip,
.safe-cracker-game.sc-stable-render[data-sc-status='playing'] .sc-safe-shell,
.safe-cracker-game.sc-stable-render[data-sc-status='playing'] .sc-safe-door,
.safe-cracker-game.sc-stable-render[data-sc-status='playing'] .sc-dial-wrap,
.safe-cracker-game.sc-stable-render[data-sc-status='playing'] .sc-attempt-panel {
  animation: none !important;
}

.safe-cracker-game.sc-stable-render[data-sc-status='complete'] .sc-result-card,
.safe-cracker-game.sc-stable-render[data-sc-status='complete'] .sc-result-content,
.safe-cracker-game.sc-stable-render[data-sc-status='complete'] .sc-result-door,
.safe-cracker-game.sc-stable-render[data-sc-status='complete'] .sc-result-door-wheel,
.safe-cracker-game.sc-stable-render[data-sc-status='complete'] .sc-result-door-bolts i,
.safe-cracker-game.sc-stable-render[data-sc-status='complete'] .sc-result-vault-well i,
.safe-cracker-game.sc-stable-render[data-sc-status='complete'] .sc-result-vault-light {
  animation: none !important;
}

.safe-cracker-game.sc-stable-render[data-sc-status='complete'] .sc-result-content {
  opacity: 1;
  transform: none;
}

.safe-cracker-game.sc-stable-render[data-sc-status='complete'] .sc-result-overlay.win .sc-result-door {
  transform: rotateY(-72deg) translateX(-5px);
  filter: brightness(.78);
}

.safe-cracker-game.sc-stable-render[data-sc-status='complete'] .sc-result-overlay.win .sc-result-vault-well i,
.safe-cracker-game.sc-stable-render[data-sc-status='complete'] .sc-result-overlay.win .sc-result-vault-light {
  opacity: .84;
}

@media (max-width: 700px) {
  .sc-known-code {
    grid-template-columns: 1fr;
    gap: 3px;
  }
  .sc-known-code > div {
    grid-template-columns: repeat(3, minmax(16px, 20px));
  }
}
${cssEnd}`;

let css = await readFile(cssUrl, 'utf8');
const markerPattern = /\/\* SAFE_CRACKER_VISUAL_STABILITY_V5_START \*\/[\s\S]*?\/\* SAFE_CRACKER_VISUAL_STABILITY_V5_END \*\/\s*/m;
css = css.replace(markerPattern, '').trimEnd() + `\n\n${visualStability}\n`;
await writeFile(cssUrl, css);

let html = await readFile(indexUrl, 'utf8');
html = html.replaceAll('/assets/safe-cracker/safe-cracker.css?v=8', '/assets/safe-cracker/safe-cracker.css?v=8&polish=1');
html = html.replaceAll('/assets/safe-cracker/safe-cracker.js?v=8', '/assets/safe-cracker/safe-cracker.js?v=8&polish=1');
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker visual stability polish: no submit rebuild flash, visible warm ambience, and locked-code readout.');
