import { readFile, writeFile } from 'node:fs/promises';

const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const cssStart = '/* SAFE_CRACKER_VISUAL_HUD_V3_START */';
const cssEnd = '/* SAFE_CRACKER_VISUAL_HUD_V3_END */';
const jsStart = '// SAFE_CRACKER_HUD_V3_START';

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Safe Cracker visual-HUD patch could not find ${label}.`);
  return source.replace(before, after);
}

function replaceSection(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0 || end <= start) throw new Error(`Safe Cracker visual-HUD patch could not isolate ${label}.`);
  return source.slice(0, start) + replacement + source.slice(end);
}

let client = await readFile(clientUrl, 'utf8');
if (!client.includes(jsStart)) {
  const hudHelpers = String.raw`  ${jsStart}
  function feedbackMeter(tier = '') {
    const order = ['red', 'orange', 'yellow', 'green'];
    const level = order.indexOf(String(tier || ''));
    return `<div class="sc-feedback-meter" aria-hidden="true">${order.map((value, index) => `<i class="${value}${index <= level ? ' lit' : ''}${value === tier ? ' active' : ''}"></i>`).join('')}</div>`;
  }

  function progressLights(progress = {}) {
    const stage = Math.max(0, Math.min(STAGES, Number(progress.stage || 0)));
    return Array.from({ length: STAGES }, (_, index) => {
      const state = index < stage ? 'locked' : index === stage && stage < STAGES ? 'active' : 'pending';
      const label = state === 'locked' ? 'SEALED' : state === 'active' ? 'ACTIVE' : 'LOCKED';
      return `<span class="sc-stage-light ${state}" aria-label="Tumbler ${index + 1}: ${label}"><i class="sc-stage-bolt"></i><b>${index + 1}</b><em>${label}</em></span>`;
    }).join('');
  }
  // SAFE_CRACKER_HUD_V3_END

`;
  client = replaceSection(
    client,
    '  function progressLights(progress = {}) {',
    '  function attemptRows(',
    hudHelpers,
    'physical progress-lock renderer'
  );

  client = replaceRequired(
    client,
    `        <div class="sc-player-card me"><div class="sc-avatar">\${playerAvatar(myPlayer, 'Y')}</div><div><small>YOU</small><b>\${escapeHtml(myPlayer?.name || 'Player')}</b><div class="sc-progress-lights">\${progressLights(me)}</div></div></div>
        <div class="sc-timer" data-sc-timer>\${formatTimer(secondsLeft(game))}</div>
        <div class="sc-player-card opponent"><div><small>OPPONENT</small><b>\${escapeHtml(opponentName || 'Waiting')}</b><div class="sc-progress-lights">\${progressLights(opponent)}</div></div><div class="sc-avatar">\${playerAvatar(opponentPlayer, 'O')}</div></div>`,
    `        <div class="sc-player-card me"><div class="sc-avatar">\${playerAvatar(myPlayer, 'Y')}</div><div class="sc-player-copy"><small>YOU</small><b>\${escapeHtml(myPlayer?.name || 'Player')}</b><div class="sc-progress-lights">\${progressLights(me)}</div></div></div>
        <div class="sc-timer" data-sc-timer>\${formatTimer(secondsLeft(game))}</div>
        <div class="sc-player-card opponent"><div class="sc-player-copy"><small>OPPONENT</small><b>\${escapeHtml(opponentName || 'Waiting')}</b><div class="sc-progress-lights">\${progressLights(opponent)}</div></div><div class="sc-avatar">\${playerAvatar(opponentPlayer, 'O')}</div></div>`,
    'clean player HUD structure'
  );

  client = replaceRequired(
    client,
    `      <div class="sc-opponent-strip \${escapeHtml(opponent.lastTier || '')}">
        <span>\${escapeHtml(opponentName || 'Opponent')}</span>
        <b>\${Math.min(STAGES, Number(opponent.stage || 0))} / \${STAGES} tumblers</b>
        <em>\${opponent.completed ? 'SAFE OPEN' : opponent.lastTier ? tierLabel(opponent.lastTier) : 'Searching...'}</em>
      </div>`,
    `      <div class="sc-opponent-strip \${escapeHtml(opponent.lastTier || '')}">
        <span class="sc-race-copy"><small>RACE STATUS</small><strong>\${escapeHtml(opponentName || 'Opponent')}</strong></span>
        <b class="sc-race-progress"><i aria-hidden="true"></i>\${Math.min(STAGES, Number(opponent.stage || 0))} / \${STAGES} LOCKS</b>
        <em class="sc-race-signal">\${opponent.completed ? 'SAFE OPEN' : opponent.lastTier ? tierLabel(opponent.lastTier) : 'SEARCHING'}</em>
      </div>`,
    'clean opponent race HUD'
  );

  client = replaceRequired(
    client,
    `          <div class="sc-display \${escapeHtml(displayTier)}\${feedbackFresh ? ' fresh' : ''}" data-sc-display><span>\${escapeHtml(displayText)}</span><small>TUMBLER \${Math.min(STAGES, Number(me.stage || 0) + 1)} OF \${STAGES}</small></div>`,
    `          <div class="sc-display \${escapeHtml(displayTier)}\${feedbackFresh ? ' fresh' : ''}" data-sc-display>
            <div class="sc-display-bezel" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
            <div class="sc-display-glass">
              <span class="sc-display-status">\${escapeHtml(displayText)}</span>
              <div class="sc-display-meta"><small>TUMBLER \${Math.min(STAGES, Number(me.stage || 0) + 1)} OF \${STAGES}</small><b>\${Number(me.attemptCount || 0)} ATTEMPTS</b></div>
              \${feedbackMeter(displayTier)}
            </div>
          </div>`,
    'industrial digital feedback display'
  );

  client = replaceRequired(
    client,
    `        <aside class="sc-attempt-panel"><h3>Current tumbler attempts</h3>\${attemptRows(me.attempts || [], me.stage || 0)}</aside>`,
    `        <aside class="sc-attempt-panel"><h3><span>TUMBLER \${Math.min(STAGES, Number(me.stage || 0) + 1)} LOG</span><b>\${Number(me.attemptCount || 0)} TOTAL</b></h3><div class="sc-attempt-list">\${attemptRows(me.attempts || [], me.stage || 0)}</div></aside>`,
    'compact attempt console'
  );
}
await writeFile(clientUrl, client);

const visualHud = String.raw`${cssStart}
.sc-topbar {
  gap: 10px;
  margin-bottom: 10px;
}

.sc-player-card {
  min-height: 78px;
  padding: 9px 11px;
  border-radius: 12px;
  background:
    linear-gradient(180deg, rgba(94,108,113,.16), rgba(7,10,12,.9)),
    repeating-linear-gradient(90deg, rgba(255,255,255,.012) 0 1px, transparent 1px 5px);
}

.sc-player-copy {
  flex: 1 1 auto;
  min-width: 0;
}

.sc-player-card small {
  color: rgba(213,223,226,.54);
  font-size: .54rem;
  letter-spacing: .18em;
}

.sc-player-card b {
  margin-top: 2px;
  color: #edf1f2;
  font-size: .8rem;
  letter-spacing: .015em;
}

.sc-progress-lights {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
  margin-top: 7px;
}

.sc-player-card.opponent .sc-progress-lights {
  justify-content: stretch;
}

.sc-stage-light {
  position: relative;
  width: auto;
  height: 28px;
  min-width: 0;
  padding: 3px 4px 3px 3px;
  display: grid;
  grid-template-columns: 11px minmax(0, 1fr);
  grid-template-rows: 1fr 1fr;
  column-gap: 3px;
  place-items: initial;
  overflow: hidden;
  border: 1px solid #3c484d;
  border-radius: 5px;
  color: rgba(221,229,231,.45);
  background:
    linear-gradient(180deg, rgba(255,255,255,.065), transparent 33%),
    linear-gradient(#20292d, #0a0e10);
  box-shadow: inset 0 0 0 1px rgba(0,0,0,.52), inset 0 -5px 8px rgba(0,0,0,.28);
  font-size: inherit;
}

.sc-stage-light::after {
  content: '';
  position: absolute;
  inset: 2px;
  border: 1px solid rgba(255,255,255,.035);
  border-radius: 3px;
  pointer-events: none;
}

.sc-stage-bolt {
  grid-row: 1 / 3;
  align-self: stretch;
  position: relative;
  width: 9px;
  border: 1px solid #090c0e;
  border-radius: 3px;
  background: linear-gradient(90deg, #1a2225, #879297 48%, #293236);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.2), 0 1px 3px rgba(0,0,0,.55);
  transition: transform .24s cubic-bezier(.2,.8,.2,1), background .18s ease, box-shadow .18s ease;
}

.sc-stage-light b,
.sc-stage-light em {
  min-width: 0;
  align-self: center;
  overflow: hidden;
  text-overflow: clip;
  white-space: nowrap;
}

.sc-stage-light b {
  color: #d7dee0;
  font: 900 .57rem/1 ui-monospace, monospace;
}

.sc-stage-light em {
  color: rgba(213,223,226,.42);
  font: 900 .36rem/1 Arial, sans-serif;
  font-style: normal;
  letter-spacing: .08em;
}

.sc-stage-light.active {
  color: var(--sc-yellow);
  border-color: rgba(232,194,93,.68);
  background: linear-gradient(180deg, rgba(236,199,100,.17), rgba(19,16,7,.92));
  box-shadow: inset 0 0 10px rgba(255,222,113,.08), 0 0 9px rgba(232,194,93,.16);
}

.sc-stage-light.active .sc-stage-bolt {
  background: linear-gradient(90deg, #432f12, #e8c66f 48%, #5d4117);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.34), 0 0 7px rgba(240,202,103,.28);
}

.sc-stage-light.active em { color: #ebcb79; }

.sc-stage-light.locked {
  color: #bfffd2;
  border-color: rgba(76,205,119,.7);
  background: linear-gradient(180deg, rgba(67,202,111,.16), rgba(5,24,13,.94));
  box-shadow: inset 0 0 10px rgba(82,255,142,.09), 0 0 8px rgba(82,255,142,.14);
}

.sc-stage-light.locked .sc-stage-bolt {
  transform: translateY(4px);
  background: linear-gradient(90deg, #153921, #70d994 48%, #174529);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.3), 0 0 8px rgba(82,255,142,.3);
}

.sc-stage-light.locked b,
.sc-stage-light.locked em { color: #a9f5c1; }

.sc-timer {
  position: relative;
  min-width: 88px;
  padding: 20px 11px 9px;
  border: 2px solid #1b2926;
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(255,255,255,.055), transparent 28%),
    #050b08;
  box-shadow:
    inset 0 0 0 2px rgba(0,0,0,.72),
    inset 0 0 17px rgba(82,255,142,.13),
    0 8px 15px rgba(0,0,0,.34);
}

.sc-timer::before {
  content: 'VAULT TIMER';
  position: absolute;
  top: 6px;
  left: 0;
  width: 100%;
  color: rgba(189,218,199,.48);
  font: 900 .38rem/1 Arial, sans-serif;
  letter-spacing: .17em;
  text-shadow: none;
}

.sc-opponent-strip {
  grid-template-columns: minmax(0, 1fr) auto auto;
  min-height: 47px;
  padding: 7px 10px;
  border-radius: 9px;
}

.sc-race-copy {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.sc-race-copy small {
  color: rgba(211,221,224,.43);
  font-size: .45rem;
  font-weight: 900;
  letter-spacing: .17em;
}

.sc-race-copy strong {
  overflow: hidden;
  color: #e8edef;
  font-size: .72rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sc-race-progress {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 7px;
  border: 1px solid rgba(203,215,218,.13);
  border-radius: 6px;
  background: rgba(0,0,0,.27);
  color: #d8b86b !important;
  font-size: .58rem;
  letter-spacing: .045em;
}

.sc-race-progress i {
  width: 7px;
  height: 13px;
  border-radius: 2px;
  background: linear-gradient(90deg, #1d2528, #9aa4a7 50%, #273034);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.18);
}

.sc-race-signal {
  min-width: 92px;
  text-align: right;
  font-size: .56rem;
  letter-spacing: .05em;
}

.sc-display {
  width: min(84%, 350px);
  min-height: 100px;
  margin: 30px auto 14px;
  padding: 8px;
  border: 5px solid #0b0f11;
  border-radius: 11px;
  color: #93a1a7;
  background:
    linear-gradient(145deg, #626c70, #252d31 38%, #111719 100%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.24),
    inset 0 0 0 2px #465156,
    0 8px 16px rgba(0,0,0,.55);
}

.sc-display-bezel {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.sc-display-bezel i {
  position: absolute;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #d1d7d9, #515b5f 55%, #121719 70%);
  box-shadow: 0 1px 2px rgba(0,0,0,.75);
}

.sc-display-bezel i:nth-child(1) { left: 5px; top: 5px; }
.sc-display-bezel i:nth-child(2) { right: 5px; top: 5px; }
.sc-display-bezel i:nth-child(3) { left: 5px; bottom: 5px; }
.sc-display-bezel i:nth-child(4) { right: 5px; bottom: 5px; }

.sc-display-glass {
  position: relative;
  z-index: 1;
  min-height: 76px;
  padding: 12px 14px 9px;
  display: grid;
  align-content: center;
  border: 1px solid rgba(150,169,175,.2);
  border-radius: 5px;
  overflow: hidden;
  background:
    radial-gradient(ellipse at 50% 20%, rgba(134,157,164,.08), transparent 48%),
    linear-gradient(180deg, #071014, #020608);
  box-shadow:
    inset 0 0 24px rgba(0,0,0,.85),
    inset 0 1px 0 rgba(255,255,255,.04);
}

.sc-display-glass::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: .34;
  background: repeating-linear-gradient(0deg, transparent 0 3px, rgba(190,220,227,.045) 3px 4px);
}

.sc-display-glass::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(118deg, transparent 0 30%, rgba(255,255,255,.045) 41%, transparent 52%);
}

.sc-display-status {
  position: relative;
  z-index: 1;
  display: block;
  font: 900 1.08rem/1.05 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  letter-spacing: .105em;
  text-shadow: 0 0 9px currentColor;
}

.sc-display-meta {
  position: relative;
  z-index: 1;
  margin-top: 6px;
  display: flex;
  justify-content: space-between;
  gap: 10px;
  color: rgba(210,222,226,.42);
  font: 900 .47rem/1 Arial, sans-serif;
  letter-spacing: .11em;
}

.sc-display-meta small,
.sc-display-meta b {
  color: inherit;
  font: inherit;
}

.sc-feedback-meter {
  position: relative;
  z-index: 1;
  height: 5px;
  margin-top: 9px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
}

.sc-feedback-meter i {
  border-radius: 999px;
  background: rgba(140,153,158,.13);
  box-shadow: inset 0 1px 2px rgba(0,0,0,.65);
  transition: background .18s ease, box-shadow .18s ease, transform .18s ease;
}

.sc-feedback-meter i.lit.red { background: #7b211d; }
.sc-feedback-meter i.lit.orange { background: #a64d1b; }
.sc-feedback-meter i.lit.yellow { background: #b99f29; }
.sc-feedback-meter i.lit.green { background: #25884a; }
.sc-feedback-meter i.active { transform: scaleY(1.45); box-shadow: 0 0 8px currentColor; }
.sc-feedback-meter i.active.red { color: var(--sc-red); background: var(--sc-red); }
.sc-feedback-meter i.active.orange { color: var(--sc-orange); background: var(--sc-orange); }
.sc-feedback-meter i.active.yellow { color: var(--sc-yellow); background: var(--sc-yellow); }
.sc-feedback-meter i.active.green { color: var(--sc-green); background: var(--sc-green); }

.sc-display.red .sc-display-glass { box-shadow: inset 0 0 26px rgba(255,61,54,.18), inset 0 0 8px rgba(0,0,0,.82); }
.sc-display.orange .sc-display-glass { box-shadow: inset 0 0 26px rgba(255,138,43,.18), inset 0 0 8px rgba(0,0,0,.82); }
.sc-display.yellow .sc-display-glass { box-shadow: inset 0 0 27px rgba(255,228,94,.19), inset 0 0 8px rgba(0,0,0,.82); }
.sc-display.green .sc-display-glass { box-shadow: inset 0 0 29px rgba(82,255,142,.21), inset 0 0 8px rgba(0,0,0,.82); }

.sc-attempt-panel {
  padding: 11px;
  border-radius: 12px;
}

.sc-attempt-panel h3 {
  margin: 0 0 9px;
  padding-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border-bottom: 1px solid rgba(202,214,218,.1);
  color: #dcc17e;
  font-size: .62rem;
  letter-spacing: .1em;
}

.sc-attempt-panel h3 b {
  color: rgba(215,224,227,.42);
  font-size: .48rem;
  letter-spacing: .08em;
}

.sc-attempt-list {
  max-height: 360px;
  overflow: auto;
  scrollbar-width: thin;
  scrollbar-color: #4d5a5f transparent;
}

.sc-attempt-row {
  grid-template-columns: 31px 1fr;
  margin-bottom: 6px;
  padding: 7px;
  border-left-width: 3px;
  background: linear-gradient(90deg, rgba(255,255,255,.055), rgba(255,255,255,.018));
}

.sc-attempt-row span {
  width: 27px;
  height: 27px;
  display: grid;
  place-items: center;
  border: 1px solid currentColor;
  border-radius: 50%;
  background: rgba(0,0,0,.23);
  font-size: .94rem;
}

.sc-attempt-row b { font-size: .55rem; }

@media (max-width: 700px) {
  .sc-topbar { gap: 5px; }
  .sc-player-card { min-height: 70px; padding: 7px; }
  .sc-player-card b { max-width: 86px; font-size: .65rem; }
  .sc-stage-light { height: 25px; grid-template-columns: 8px minmax(0, 1fr); padding: 2px 3px 2px 2px; }
  .sc-stage-bolt { width: 7px; }
  .sc-stage-light b { font-size: .48rem; }
  .sc-stage-light em { font-size: .29rem; letter-spacing: .035em; }
  .sc-timer { min-width: 66px; padding: 19px 5px 8px; font-size: .93rem; }
  .sc-timer::before { font-size: .31rem; letter-spacing: .1em; }
  .sc-opponent-strip { grid-template-columns: minmax(0,1fr) auto; gap: 5px; }
  .sc-race-signal { grid-column: 1 / -1; min-width: 0; text-align: center; }
  .sc-display { width: min(88%, 340px); min-height: 94px; margin-top: 25px; }
  .sc-display-status { font-size: .94rem; }
  .sc-display-meta { font-size: .4rem; }
  .sc-attempt-list { max-height: 170px; }
}

@media (max-width: 390px) {
  .sc-avatar { width: 28px; height: 28px; flex-basis: 28px; }
  .sc-player-card { gap: 4px; }
  .sc-stage-light em { display: none; }
  .sc-stage-light b { grid-row: 1 / 3; }
  .sc-display-meta { letter-spacing: .065em; }
}
${cssEnd}`;

let css = await readFile(cssUrl, 'utf8');
const markerPattern = /\/\* SAFE_CRACKER_VISUAL_HUD_V3_START \*\/[\s\S]*?\/\* SAFE_CRACKER_VISUAL_HUD_V3_END \*\/\s*/m;
css = css.replace(markerPattern, '').trimEnd() + `\n\n${visualHud}\n`;
await writeFile(cssUrl, css);

let html = await readFile(indexUrl, 'utf8');
html = html.replaceAll('/assets/safe-cracker/safe-cracker.css?v=6', '/assets/safe-cracker/safe-cracker.css?v=7');
html = html.replaceAll('/assets/safe-cracker/safe-cracker.js?v=6', '/assets/safe-cracker/safe-cracker.js?v=7');
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker visual pass 3: industrial feedback display, physical tumbler locks, and compact race HUD.');
