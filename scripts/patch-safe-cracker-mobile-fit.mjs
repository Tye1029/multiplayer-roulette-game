import { readFile, writeFile } from 'node:fs/promises';

const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const cssStart = '/* SAFE_CRACKER_MOBILE_FIT_V6_START */';
const cssEnd = '/* SAFE_CRACKER_MOBILE_FIT_V6_END */';

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Safe Cracker mobile-fit patch could not find ${label}.`);
  return source.replace(before, after);
}

let client = await readFile(clientUrl, 'utf8');
client = replaceRequired(
  client,
  '    const stableVisual = runtime.visualGameId === visualGameId && runtime.visualStatus === visualStatus && !stageChanged;',
  '    const stableVisual = runtime.visualGameId === visualGameId && runtime.visualStatus === visualStatus;',
  'same-match stage transition stability'
);
await writeFile(clientUrl, client);

const mobileFit = String.raw`${cssStart}
.sc-player-card.me .sc-progress-lights {
  display: none;
}

.sc-safe-handle {
  display: none !important;
}

.sc-confirm-button {
  width: min(76%, 292px);
  min-height: 48px;
  margin: 7px auto 15px;
  overflow: hidden;
  border: 2px solid #171d20;
  border-radius: 8px;
  color: #f5d88e;
  background:
    linear-gradient(180deg, rgba(255,255,255,.14), transparent 31%),
    linear-gradient(90deg, #20282c, #4c3a20 48%, #20282c),
    #242d31;
  box-shadow:
    inset 0 0 0 1px rgba(220,178,91,.45),
    inset 0 -8px 13px rgba(0,0,0,.28),
    0 4px 0 #0b0f11,
    0 8px 13px rgba(0,0,0,.38);
  font-size: .78rem;
  letter-spacing: .13em;
  text-shadow: 0 1px 1px #000, 0 0 8px rgba(238,198,110,.22);
}

.sc-confirm-button::before,
.sc-confirm-button::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 7px;
  height: 20px;
  transform: translateY(-50%);
  border: 1px solid #090c0e;
  border-radius: 2px;
  background: linear-gradient(90deg, #171e21, #a77c39 50%, #20282b);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.18);
}

.sc-confirm-button::before { left: 9px; }
.sc-confirm-button::after { right: 9px; }
.sc-confirm-button span { position: relative; z-index: 1; }

.sc-confirm-button:not(:disabled):active {
  transform: translateY(2px);
  box-shadow:
    inset 0 0 0 1px rgba(220,178,91,.48),
    inset 0 -5px 10px rgba(0,0,0,.32),
    0 2px 0 #0b0f11,
    0 5px 9px rgba(0,0,0,.38);
}

.sc-confirm-button:disabled {
  opacity: .72;
  color: rgba(235,209,146,.62);
  filter: saturate(.55);
}

@media (max-width: 700px) {
  .safe-cracker-game {
    padding: 2px 4px 6px;
  }

  .sc-topbar {
    gap: 4px;
    margin-bottom: 4px;
  }

  .sc-player-card {
    min-height: 58px;
    padding: 5px 6px;
    gap: 4px;
    border-radius: 9px;
  }

  .sc-player-card b {
    max-width: 82px;
    font-size: .62rem;
  }

  .sc-known-code {
    grid-template-columns: auto 1fr;
    gap: 4px;
    margin-top: 3px;
  }

  .sc-known-code small {
    font-size: .34rem;
    letter-spacing: .08em;
  }

  .sc-known-code > div {
    grid-template-columns: repeat(3, 17px);
    gap: 2px;
  }

  .sc-known-code span {
    height: 18px;
    font-size: .62rem;
  }

  .sc-player-card.opponent .sc-progress-lights {
    margin-top: 4px;
  }

  .sc-player-card.opponent .sc-stage-light {
    height: 22px;
  }

  .sc-timer {
    min-width: 62px;
    padding: 17px 5px 7px;
    font-size: .88rem;
  }

  .sc-opponent-strip {
    min-height: 39px;
    margin-bottom: 5px;
    padding: 5px 7px;
    gap: 4px;
  }

  .sc-race-copy small {
    display: none;
  }

  .sc-race-progress {
    padding: 4px 5px;
    font-size: .51rem;
  }

  .sc-race-signal {
    font-size: .49rem;
  }

  .sc-safe-door {
    min-height: 448px;
    border-width: 6px;
    border-radius: 18px;
  }

  .sc-display {
    min-height: 78px;
    margin: 17px auto 8px;
    padding: 6px;
    border-width: 4px;
  }

  .sc-display-glass {
    min-height: 59px;
    padding: 8px 10px 7px;
  }

  .sc-display-status {
    font-size: .84rem;
  }

  .sc-display-meta {
    margin-top: 4px;
    font-size: .36rem;
  }

  .sc-feedback-meter {
    margin-top: 6px;
  }

  .sc-dial-wrap {
    width: min(68vw, 258px);
    height: min(68vw, 258px);
  }

  .sc-dial-number {
    --radius: min(25vw, 92px);
  }

  .sc-step-controls {
    gap: 11px;
    margin: -2px 0 4px;
  }

  .sc-step-controls button {
    width: 47px;
    height: 31px;
  }

  .sc-confirm-button {
    width: min(82%, 286px);
    min-height: 44px;
    margin: 5px auto 11px;
  }

  .sc-attempt-panel {
    margin-top: 5px;
    padding: 7px;
  }

  .sc-attempt-panel h3 {
    margin-bottom: 5px;
    padding-bottom: 5px;
  }

  .sc-attempt-list {
    max-height: 88px;
  }

  .sc-attempt-row {
    margin-bottom: 4px;
    padding: 5px;
  }
}

@media (max-width: 700px) and (max-height: 820px) {
  .sc-safe-door {
    min-height: 414px;
  }

  .sc-display {
    min-height: 72px;
    margin-top: 13px;
  }

  .sc-display-glass {
    min-height: 53px;
  }

  .sc-dial-wrap {
    width: min(62vw, 232px);
    height: min(62vw, 232px);
  }

  .sc-dial-number {
    --radius: min(22.5vw, 82px);
  }

  .sc-attempt-list {
    max-height: 72px;
  }
}
${cssEnd}`;

let css = await readFile(cssUrl, 'utf8');
const markerPattern = /\/\* SAFE_CRACKER_MOBILE_FIT_V6_START \*\/[\s\S]*?\/\* SAFE_CRACKER_MOBILE_FIT_V6_END \*\/\s*/m;
css = css.replace(markerPattern, '').trimEnd() + `\n\n${mobileFit}\n`;
await writeFile(cssUrl, css);

let html = await readFile(indexUrl, 'utf8');
html = html.replaceAll('/assets/safe-cracker/safe-cracker.css?v=8&polish=1', '/assets/safe-cracker/safe-cracker.css?v=8&polish=2');
html = html.replaceAll('/assets/safe-cracker/safe-cracker.js?v=8&polish=1', '/assets/safe-cracker/safe-cracker.js?v=8&polish=2');
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker mobile-fit polish: stable stage changes, compact viewport, player code-only panel, removed handle, and themed confirmation control.');
