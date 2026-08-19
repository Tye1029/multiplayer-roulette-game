import { readFile, writeFile } from 'node:fs/promises';

const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const cssStart = '/* SAFE_CRACKER_VIDEO_CORRECTION_V8_START */';
const cssEnd = '/* SAFE_CRACKER_VIDEO_CORRECTION_V8_END */';
const jsStart = '// SAFE_CRACKER_VIDEO_CORRECTION_V8_START';

function replaceRequired(source, before, after, label) {
  if (after && source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Safe Cracker video-correction patch could not find ${label}.`);
  return source.replace(before, after);
}

let client = await readFile(clientUrl, 'utf8');
if (!client.includes(jsStart)) {
  client = replaceRequired(
    client,
    '    resultPortalFocusTimer: 0',
    "    resultPortalFocusTimer: 0,\n    countdownProgressKey: '',\n    countdownProgressRank: -1,\n    countdownProgressLabel: ''",
    'countdown monotonic runtime state'
  );

  const helpers = [
    `  ${jsStart}`,
    "  function safeCrackerCountdownRank(label) {",
    "    if (label === '3') return 0;",
    "    if (label === '2') return 1;",
    "    if (label === '1') return 2;",
    "    if (label === 'GO!') return 3;",
    '    return -1;',
    '  }',
    '',
    '  function safeCrackerMonotonicCountdownLabel(game = runtime.game) {',
    "    const gameId = String(game?.gameId || '');",
    "    const startAt = String(game?.startAt || stateFor(game)?.startAt || '');",
    "    const key = gameId + ':' + startAt;",
    "    const status = String(game?.status || '');",
    '    if (runtime.countdownProgressKey !== key) {',
    '      runtime.countdownProgressKey = key;',
    '      runtime.countdownProgressRank = -1;',
    "      runtime.countdownProgressLabel = '';",
    '    }',
    "    if (status !== 'countdown' && status !== 'playing') {",
    '      runtime.countdownProgressRank = -1;',
    "      runtime.countdownProgressLabel = '';",
    "      return '';",
    '    }',
    '    const proposed = safeCrackerStartCountdownLabel(game);',
    '    if (!proposed) {',
    "      if (status === 'countdown' && runtime.countdownProgressLabel) return runtime.countdownProgressLabel;",
    "      if (status === 'playing') {",
    '        runtime.countdownProgressRank = 4;',
    "        runtime.countdownProgressLabel = '';",
    '      }',
    "      return '';",
    '    }',
    '    const proposedRank = safeCrackerCountdownRank(proposed);',
    '    if (proposedRank < runtime.countdownProgressRank) return runtime.countdownProgressLabel;',
    '    runtime.countdownProgressRank = proposedRank;',
    '    runtime.countdownProgressLabel = proposed;',
    '    return proposed;',
    '  }',
    '  // SAFE_CRACKER_VIDEO_CORRECTION_V8_END',
    '',
    ''
  ].join('\n');

  client = replaceRequired(
    client,
    '  function resultOverlay(game) {',
    `${helpers}  function resultOverlay(game) {`,
    'video-correction helper insertion'
  );

  client = replaceRequired(
    client,
    '    const startCountdownLabel = safeCrackerStartCountdownLabel(game);',
    '    const startCountdownLabel = safeCrackerMonotonicCountdownLabel(game);',
    'monotonic countdown render label'
  );

  client = replaceRequired(
    client,
    '      const label = safeCrackerStartCountdownLabel(runtime.game);',
    '      const label = safeCrackerMonotonicCountdownLabel(runtime.game);',
    'monotonic countdown ticker label'
  );

  client = replaceRequired(
    client,
    `      <div class="sc-opponent-strip \${escapeHtml(opponent.lastTier || '')}">
        <span class="sc-race-copy"><small>RACE STATUS</small><strong>\${escapeHtml(opponentName || 'Opponent')}</strong></span>`,
    `      <div class="sc-opponent-strip \${escapeHtml(opponent.lastTier || '')}">
        <span class="sc-race-copy"><small>OPPONENT STATUS</small></span>`,
    'duplicate opponent name removal'
  );

  client = replaceRequired(
    client,
    '    const canSubmit = Boolean(game.status === \'playing\' && state.canSubmit && !runtime.busy && Number(me.stage || 0) < STAGES);',
    `    const canSubmit = Boolean(game.status === 'playing' && state.canSubmit && !runtime.busy && Number(me.stage || 0) < STAGES);
    const cooldownActive = Number(state.cooldownMs || 0) > 0;
    const confirmLabel = runtime.busy
      ? 'CHECKING…'
      : game.status === 'countdown'
        ? 'LOCKED'
        : game.status === 'complete'
          ? 'COMPLETE'
          : cooldownActive
            ? 'RESETTING…'
            : canSubmit
              ? 'CHECK NUMBER'
              : 'WAITING';`,
    'purposeful confirm-button labels'
  );

  client = replaceRequired(
    client,
    `<button class="sc-confirm-button" type="button" data-sc-confirm \${canSubmit ? '' : 'disabled'}><span>\${runtime.busy ? 'CHECKING…' : 'CHECK NUMBER'}</span></button>`,
    `<button class="sc-confirm-button" type="button" data-sc-confirm \${canSubmit ? '' : 'disabled'}><span>\${confirmLabel}</span></button>`,
    'confirm-button label rendering'
  );

  client = replaceRequired(
    client,
    '${Number(me.attemptCount || 0)} ATTEMPTS',
    "${Number(me.attemptCount || 0)} ${Number(me.attemptCount || 0) === 1 ? 'ATTEMPT' : 'ATTEMPTS'}",
    'attempt singular/plural copy'
  );
}
await writeFile(clientUrl, client);

const corrections = String.raw`${cssStart}
.safe-cracker-game:has(.sc-display.red) {
  --sc-refine-state-strength: .052;
}

.safe-cracker-game:has(.sc-display.orange) {
  --sc-refine-state-strength: .058;
}

.safe-cracker-game:has(.sc-display.yellow) {
  --sc-refine-state-strength: .064;
}

.safe-cracker-game:has(.sc-display.green) {
  --sc-refine-state-strength: .07;
}

.sc-display.red {
  background: #120907;
  box-shadow: inset 0 0 16px rgba(255,61,54,.2), 0 0 8px rgba(255,61,54,.1);
}

.sc-display.orange {
  background: #120c07;
  box-shadow: inset 0 0 16px rgba(255,138,43,.2), 0 0 8px rgba(255,138,43,.1);
}

.sc-display.yellow {
  background: #121107;
  box-shadow: inset 0 0 16px rgba(255,228,94,.21), 0 0 9px rgba(255,228,94,.11);
}

.sc-display.green {
  background: #07120b;
  box-shadow: inset 0 0 16px rgba(82,255,142,.22), 0 0 9px rgba(82,255,142,.12);
}

.sc-opponent-strip {
  grid-template-columns: minmax(0, .8fr) auto auto;
}

.sc-race-copy {
  min-width: 0;
}

.sc-race-copy small {
  display: block;
  white-space: nowrap;
}

.sc-confirm-button:disabled {
  color: rgba(245, 226, 181, .66);
  text-shadow: 0 1px 2px rgba(0,0,0,.9);
}

.sc-confirm-button.busy {
  color: #f7dfa7;
  border-color: rgba(141,102,45,.72);
  background:
    linear-gradient(180deg, rgba(255,239,196,.08), transparent 12%),
    linear-gradient(180deg, #3e484e, #2b312f 52%, #1c2225);
}

.sc-dial-number {
  transform: rotate(var(--digit-angle)) translateY(calc(var(--radius) * -1));
}

.sc-dial-number > span {
  transform-origin: center;
}

.sc-dial-number.selected > span {
  transform: scale(1.14) translateY(-1px);
}

@media (max-width: 390px) {
  .sc-opponent-strip {
    grid-template-columns: minmax(0, .72fr) auto auto;
    gap: 6px;
  }

  .sc-race-copy small {
    font-size: .44rem;
    letter-spacing: .08em;
  }

  .sc-confirm-button:disabled {
    font-size: .76rem;
  }
}
${cssEnd}`;

let css = await readFile(cssUrl, 'utf8');
const markerPattern = /\/\* SAFE_CRACKER_VIDEO_CORRECTION_V8_START \*\/[\s\S]*?\/\* SAFE_CRACKER_VIDEO_CORRECTION_V8_END \*\/\s*/m;
css = css.replace(markerPattern, '').trimEnd() + `\n\n${corrections}\n`;
await writeFile(cssUrl, css);

let html = await readFile(indexUrl, 'utf8');
html = html.replaceAll('/assets/safe-cracker/safe-cracker.css?v=8&polish=2&fit=2&result=1&final=1&refine=1', '/assets/safe-cracker/safe-cracker.css?v=8&polish=2&fit=2&result=1&final=1&refine=1&correct=1');
html = html.replaceAll('/assets/safe-cracker/safe-cracker.js?v=8&polish=2&fit=2&result=1&final=1&refine=1', '/assets/safe-cracker/safe-cracker.js?v=8&polish=2&fit=2&result=1&final=1&refine=1&correct=1');
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker video corrections: monotonic countdown, real radial dial numerals, restrained state light, cleaner HUD copy, readable controls, and attempt grammar.');