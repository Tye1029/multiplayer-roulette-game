import { readFile, writeFile } from 'node:fs/promises';

const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const cssStart = '/* SAFE_CRACKER_VISUAL_SEQUENCE_V4_START */';
const cssEnd = '/* SAFE_CRACKER_VISUAL_SEQUENCE_V4_END */';
const jsStart = '// SAFE_CRACKER_SEQUENCE_V4_START';

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Safe Cracker visual-sequence patch could not find ${label}.`);
  return source.replace(before, after);
}

function replaceSection(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0 || end <= start) throw new Error(`Safe Cracker visual-sequence patch could not isolate ${label}.`);
  return source.slice(0, start) + replacement + source.slice(end);
}

let client = await readFile(clientUrl, 'utf8');
if (!client.includes(jsStart)) {
  client = replaceRequired(
    client,
    '    lastDragDirection: 0',
    "    lastDragDirection: 0,\n    countdownSoundKey: ''",
    'countdown audio runtime state'
  );

  const sequenceHelpers = [
    `  ${jsStart}`,
    "  function playCountdownBeat(label, game = runtime.game) {",
    "    const cleanLabel = String(label || '');",
    "    const key = String(game?.gameId || '') + ':' + cleanLabel;",
    "    if (!cleanLabel || runtime.countdownSoundKey === key) return;",
    "    runtime.countdownSoundKey = key;",
    "    if (cleanLabel === 'GO!') {",
    "      playTone(112, .12, .065, 'square');",
    "      playTone(330, .18, .052, 'triangle', .045);",
    "      playTone(660, .22, .035, 'sine', .105);",
    "      navigator.vibrate?.([18, 22, 34]);",
    "      return;",
    "    }",
    "    const step = Math.max(1, Math.min(3, Number(cleanLabel) || 1));",
    "    playTone(104 + step * 18, .09, .048, 'square');",
    "    playTone(46 + step * 5, .13, .04, 'triangle', .018);",
    "    navigator.vibrate?.(10 + step * 2);",
    "  }",
    '',
    "  function resultVaultMechanism() {",
    "    return '<div class=\"sc-result-vault\" aria-hidden=\"true\">' +",
    "      '<div class=\"sc-result-vault-well\"><i></i></div>' +",
    "      '<div class=\"sc-result-door\">' +",
    "        '<div class=\"sc-result-door-rim\"></div>' +",
    "        '<div class=\"sc-result-door-bolts\"><i></i><i></i><i></i><i></i></div>' +",
    "        '<div class=\"sc-result-door-wheel\"><i></i><i></i><i></i></div>' +",
    "        '<div class=\"sc-result-door-signal\"></div>' +",
    "      '</div>' +",
    "      '<div class=\"sc-result-vault-light\"></div>' +",
    "    '</div>';",
    "  }",
    '  // SAFE_CRACKER_SEQUENCE_V4_END',
    '',
    ''
  ].join('\n');

  client = replaceRequired(
    client,
    '  function resultOverlay(game) {',
    `${sequenceHelpers}  function resultOverlay(game) {`,
    'sequence helper insertion point'
  );

  const oldCountdownMarkup = "      ${startCountdownLabel ? `<div class=\"sc-start-countdown-overlay\" data-sc-start-countdown><span class=\"${startCountdownLabel === 'GO!' ? 'go' : ''}\">${escapeHtml(startCountdownLabel)}</span></div>` : ''}";
  const newCountdownMarkup = [
    "      ${startCountdownLabel ? `<div class=\"sc-start-countdown-overlay\" data-sc-start-countdown data-sc-countdown-label=\"${escapeHtml(startCountdownLabel)}\">",
    "        <div class=\"sc-countdown-vault\" aria-hidden=\"true\"><i></i><i></i><i></i><i></i><i></i><i></i><div class=\"sc-countdown-ring\"></div></div>",
    "        <div class=\"sc-countdown-copy\"><small>VAULT SEQUENCE</small><span data-sc-countdown-value class=\"${startCountdownLabel === 'GO!' ? 'go' : ''}\">${escapeHtml(startCountdownLabel)}</span><b data-sc-countdown-status>${startCountdownLabel === 'GO!' ? 'DIAL ACTIVE' : 'LOCKS ENGAGING'}</b></div>",
    "      </div>` : ''}"
  ].join('\n');
  client = replaceRequired(client, oldCountdownMarkup, newCountdownMarkup, 'cinematic countdown markup');

  const oldCountdownUpdater = `    const countdown = document.querySelector('[data-sc-start-countdown]');
    if (countdown) {
      const label = safeCrackerStartCountdownLabel(runtime.game);
      if (!label) countdown.remove();
      else {
        const text = countdown.querySelector('span');
        if (text && text.textContent !== label) {
          text.textContent = label;
          text.className = label === 'GO!' ? 'go' : '';
          text.style.animation = 'none';
          void text.offsetWidth;
          text.style.animation = '';
        }
      }
    }`;
  const newCountdownUpdater = `    const countdown = document.querySelector('[data-sc-start-countdown]');
    if (countdown) {
      const label = safeCrackerStartCountdownLabel(runtime.game);
      if (!label) countdown.remove();
      else {
        playCountdownBeat(label, runtime.game);
        countdown.dataset.scCountdownLabel = label;
        const text = countdown.querySelector('[data-sc-countdown-value]');
        const status = countdown.querySelector('[data-sc-countdown-status]');
        if (status) status.textContent = label === 'GO!' ? 'DIAL ACTIVE' : 'LOCKS ENGAGING';
        if (text && text.textContent !== label) {
          text.textContent = label;
          text.className = label === 'GO!' ? 'go' : '';
          text.style.animation = 'none';
          void text.offsetWidth;
          text.style.animation = '';
        }
      }
    }`;
  client = replaceRequired(client, oldCountdownUpdater, newCountdownUpdater, 'countdown audio and live sequence updater');

  const resultOverlay = [
    "  function resultOverlay(game) {",
    "    if (game?.status !== 'complete') return '';",
    '    const state = stateFor(game);',
    "    const myUserId = String(game.isCreator ? game.creator?.userId : game.joiner?.userId || '');",
    '    const won = Boolean(game.winnerUserId && String(game.winnerUserId) === myUserId);',
    '    const tied = Boolean(game.tie);',
    '    playResult(won, tied);',
    "    const resultClass = won ? 'win' : tied ? 'tie' : 'lose';",
    "    const title = tied ? 'VAULT LOCKDOWN' : won ? 'SAFE CRACKED!' : 'YOU LOSE';",
    "    const accessLabel = tied ? 'SEQUENCE EXPIRED' : won ? 'ACCESS GRANTED' : 'ACCESS DENIED';",
    '    const message = tied',
    "      ? 'Neither safe opened before time expired. Both wagers were returned.'",
    '      : won',
    "        ? `You opened your safe first and won ${Number(game.payout || 0).toLocaleString('en-US')} Tickets.`",
    '        : funnyLoss(game.gameId);',
    '    const reveal = state.revealedCodes || {};',
    '    const codes = reveal.my || reveal.opponent',
    "      ? '<div class=\"sc-code-reveal\"><span>Your code <b>' + escapeHtml(reveal.my || '---') + '</b></span><span>Opponent <b>' + escapeHtml(reveal.opponent || '---') + '</b></span></div>'",
    "      : '';",
    "    return '<div class=\"sc-result-overlay ' + resultClass + '\" data-sc-result-sequence>' +",
    "      '<div class=\"sc-result-card\">' +",
    '        resultVaultMechanism() +',
    "        '<div class=\"sc-result-content\">' +",
    "          '<div class=\"sc-result-kicker\">SAFE CRACKER · ' + accessLabel + '</div>' +",
    "          '<h2>' + title + '</h2>' +",
    "          '<p>' + escapeHtml(message) + '</p>' +",
    '          codes +',
    "          '<div class=\"sc-result-actions\">' +",
    "            '<button class=\"gold\" data-sc-rematch type=\"button\">Rematch</button>' +",
    "            '<button class=\"secondary\" data-sc-new-game type=\"button\">Create a New Game</button>' +",
    "          '</div>' +",
    "        '</div>' +",
    "      '</div>' +",
    "    '</div>';",
    '  }',
    '',
    ''
  ].join('\n');
  client = replaceSection(client, '  function resultOverlay(game) {', '  function render(game) {', resultOverlay, 'cinematic result renderer');
}
await writeFile(clientUrl, client);

const visualSequence = String.raw`${cssStart}
.sc-start-countdown-overlay {
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 48%, rgba(221,174,87,.14), transparent 20%),
    radial-gradient(circle at 50% 50%, rgba(13,20,23,.38), rgba(2,4,5,.9) 72%);
  backdrop-filter: blur(5px) saturate(.8);
  perspective: 900px;
  animation: scSequenceBackdropIn .2s ease both;
}

.sc-start-countdown-overlay::before,
.sc-start-countdown-overlay::after {
  content: '';
  position: absolute;
  pointer-events: none;
}

.sc-start-countdown-overlay::before {
  inset: 0;
  opacity: .28;
  background:
    repeating-linear-gradient(0deg, rgba(255,255,255,.025) 0 1px, transparent 1px 5px),
    radial-gradient(ellipse at 50% 16%, rgba(255,216,145,.2), transparent 38%);
}

.sc-start-countdown-overlay::after {
  left: 50%;
  top: 50%;
  width: min(88vw, 530px);
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  border: 1px solid rgba(210,220,222,.1);
  border-radius: 50%;
  box-shadow: 0 0 90px rgba(0,0,0,.72), inset 0 0 70px rgba(0,0,0,.55);
}

.sc-countdown-vault {
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(72vw, 400px);
  aspect-ratio: 1;
  transform: translate(-50%, -50%) rotateX(7deg);
  border: clamp(12px, 3vw, 21px) solid #080c0e;
  border-radius: 50%;
  background:
    radial-gradient(circle at 35% 27%, rgba(255,255,255,.16), transparent 18%),
    repeating-conic-gradient(from 0deg, rgba(255,255,255,.025) 0 1deg, transparent 1deg 12deg),
    radial-gradient(circle, #3d494e 0 56%, #1c2529 57% 68%, #747f83 69% 72%, #141b1e 73% 100%);
  box-shadow:
    inset 0 0 0 4px #859095,
    inset 0 0 0 10px #20292d,
    inset 0 0 55px rgba(0,0,0,.78),
    0 28px 60px rgba(0,0,0,.62);
  animation: scCountdownVaultBreathe .9s ease-in-out infinite alternate;
}

.sc-countdown-vault > i {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 17px;
  height: 48%;
  margin-left: -8.5px;
  transform-origin: 50% 0;
  border: 1px solid #080b0d;
  border-radius: 999px;
  background: linear-gradient(90deg, #151c1f, #8f999d 45%, #303a3e 72%, #101518);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.24), 0 4px 9px rgba(0,0,0,.5);
}
.sc-countdown-vault > i:nth-child(1) { transform: rotate(0deg) translateY(-12%); }
.sc-countdown-vault > i:nth-child(2) { transform: rotate(60deg) translateY(-12%); }
.sc-countdown-vault > i:nth-child(3) { transform: rotate(120deg) translateY(-12%); }
.sc-countdown-vault > i:nth-child(4) { transform: rotate(180deg) translateY(-12%); }
.sc-countdown-vault > i:nth-child(5) { transform: rotate(240deg) translateY(-12%); }
.sc-countdown-vault > i:nth-child(6) { transform: rotate(300deg) translateY(-12%); }

.sc-countdown-ring {
  position: absolute;
  inset: 24%;
  border: 7px solid #0b1012;
  border-radius: 50%;
  background:
    radial-gradient(circle at 36% 29%, rgba(255,255,255,.23), transparent 17%),
    repeating-conic-gradient(from 0deg, #b08a45 0 2deg, #31271a 2deg 5deg, #192125 5deg 30deg),
    radial-gradient(circle, #687378, #222c30 62%, #101619 64%);
  box-shadow: inset 0 0 22px rgba(0,0,0,.76), 0 8px 15px rgba(0,0,0,.55);
  animation: scCountdownRingTurn 2.8s cubic-bezier(.22,.7,.24,1) infinite;
}

.sc-countdown-copy {
  position: relative;
  z-index: 3;
  min-width: min(76vw, 310px);
  display: grid;
  justify-items: center;
  text-align: center;
  filter: drop-shadow(0 12px 15px rgba(0,0,0,.7));
}

.sc-countdown-copy small,
.sc-countdown-copy b {
  padding: 5px 11px;
  border: 1px solid rgba(211,221,224,.16);
  border-radius: 4px;
  color: rgba(224,232,234,.65);
  background: rgba(4,7,8,.72);
  font: 900 .58rem/1 Arial, sans-serif;
  letter-spacing: .22em;
}

.sc-countdown-copy span {
  min-width: 1.3em;
  color: #f1d38a;
  font: 1000 clamp(6rem, 28vw, 11rem)/.88 Arial, sans-serif;
  text-shadow:
    0 4px 0 #5b4019,
    0 10px 18px rgba(0,0,0,.78),
    0 0 26px rgba(239,198,108,.38);
  animation: scSequenceNumberIn .28s cubic-bezier(.16,.8,.2,1);
}

.sc-countdown-copy span.go {
  color: #baffcc;
  text-shadow: 0 4px 0 #174c27, 0 10px 18px rgba(0,0,0,.78), 0 0 34px rgba(82,255,142,.58);
}

.sc-start-countdown-overlay[data-sc-countdown-label='GO!'] .sc-countdown-vault {
  box-shadow: inset 0 0 0 4px #9fa9ad, inset 0 0 0 10px #1d2922, inset 0 0 55px rgba(15,87,40,.5), 0 0 58px rgba(82,255,142,.22), 0 28px 60px rgba(0,0,0,.62);
}

.sc-start-countdown-overlay[data-sc-countdown-label='GO!'] .sc-countdown-ring {
  animation-duration: .48s;
  filter: drop-shadow(0 0 12px rgba(82,255,142,.4));
}

.sc-result-overlay {
  overflow: auto;
  padding: 16px;
  background:
    radial-gradient(ellipse at 50% 38%, rgba(92,111,117,.2), transparent 34%),
    rgba(1,3,4,.9);
  backdrop-filter: blur(8px) saturate(.8);
}

.sc-result-card {
  position: relative;
  width: min(94vw, 520px);
  padding: 17px 20px 23px;
  overflow: hidden;
  border: 1px solid #6e7b80;
  border-radius: 24px;
  background:
    radial-gradient(ellipse at 50% 0%, rgba(255,255,255,.08), transparent 34%),
    repeating-linear-gradient(90deg, rgba(255,255,255,.012) 0 1px, transparent 1px 5px),
    linear-gradient(145deg, #303b40, #101619 60%, #222b2f);
  box-shadow: inset 0 0 0 4px #090d0f, inset 0 0 40px rgba(0,0,0,.58), 0 30px 80px rgba(0,0,0,.76);
  animation: scResultCabinetIn .34s cubic-bezier(.18,.82,.22,1) both;
}

.sc-result-card::before {
  content: '';
  position: absolute;
  inset: 8px;
  border: 1px solid rgba(216,226,229,.09);
  border-radius: 17px;
  pointer-events: none;
}

.sc-result-vault {
  position: relative;
  width: 190px;
  height: 190px;
  margin: 0 auto 4px;
  perspective: 720px;
  isolation: isolate;
}

.sc-result-vault-well,
.sc-result-door {
  position: absolute;
  inset: 10px;
  border-radius: 50%;
}

.sc-result-vault-well {
  overflow: hidden;
  border: 10px solid #090d0f;
  background: radial-gradient(circle at 50% 44%, #3e2a12 0 10%, #160e07 34%, #030404 72%);
  box-shadow: inset 0 0 30px #000, 0 8px 17px rgba(0,0,0,.52);
}

.sc-result-vault-well i {
  position: absolute;
  inset: 16%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255,218,140,.8), rgba(199,119,34,.2) 36%, transparent 70%);
  filter: blur(6px);
  opacity: 0;
}

.sc-result-door {
  z-index: 3;
  transform-origin: 4% 50%;
  border: 9px solid #090d0f;
  background:
    radial-gradient(circle at 32% 24%, rgba(255,255,255,.2), transparent 18%),
    repeating-conic-gradient(from 0deg, rgba(255,255,255,.022) 0 1deg, transparent 1deg 10deg),
    radial-gradient(circle, #59656a 0 60%, #222b2f 61% 74%, #828d91 75% 78%, #151c1f 79%);
  box-shadow: inset 0 0 0 3px #879297, inset 0 0 26px rgba(0,0,0,.7), 0 10px 19px rgba(0,0,0,.58);
  transform-style: preserve-3d;
}

.sc-result-door-rim {
  position: absolute;
  inset: 13px;
  border: 2px solid rgba(224,232,234,.18);
  border-radius: 50%;
  box-shadow: inset 0 0 18px rgba(0,0,0,.55);
}

.sc-result-door-bolts i {
  position: absolute;
  width: 28px;
  height: 10px;
  border: 1px solid #080b0d;
  border-radius: 4px;
  background: linear-gradient(180deg, #9aa4a7, #303a3e 65%, #111719);
  box-shadow: 0 3px 5px rgba(0,0,0,.45);
}
.sc-result-door-bolts i:nth-child(1) { left: -8px; top: 39px; }
.sc-result-door-bolts i:nth-child(2) { right: -8px; top: 39px; }
.sc-result-door-bolts i:nth-child(3) { left: -8px; bottom: 39px; }
.sc-result-door-bolts i:nth-child(4) { right: -8px; bottom: 39px; }

.sc-result-door-wheel {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 58px;
  height: 58px;
  transform: translate(-50%, -50%);
  border: 7px solid #0b1012;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 28%, #9aa4a8, #313b3f 50%, #111719 72%);
  box-shadow: inset 0 0 12px rgba(0,0,0,.7), 0 0 0 3px #99733a, 0 6px 10px rgba(0,0,0,.5);
}

.sc-result-door-wheel i {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 82px;
  height: 9px;
  margin: -4.5px 0 0 -41px;
  border: 1px solid #090d0f;
  border-radius: 999px;
  background: linear-gradient(#909a9e, #30393d 62%, #12181b);
}
.sc-result-door-wheel i:nth-child(2) { transform: rotate(60deg); }
.sc-result-door-wheel i:nth-child(3) { transform: rotate(-60deg); }

.sc-result-door-signal {
  position: absolute;
  right: 24px;
  top: 25px;
  width: 12px;
  height: 12px;
  border: 2px solid #111719;
  border-radius: 50%;
  background: #75221f;
  box-shadow: 0 0 7px rgba(255,61,54,.35);
}

.sc-result-vault-light {
  position: absolute;
  z-index: 2;
  left: 50%;
  top: 50%;
  width: 280px;
  height: 170px;
  transform: translate(-27%, -50%);
  clip-path: polygon(0 24%, 100% 0, 100% 100%, 0 76%);
  background: linear-gradient(90deg, rgba(255,205,123,.55), rgba(255,161,59,.14) 58%, transparent);
  filter: blur(10px);
  opacity: 0;
  pointer-events: none;
}

.sc-result-content {
  position: relative;
  z-index: 5;
  opacity: 0;
  transform: translateY(10px);
  animation: scResultContentIn .38s ease .78s forwards;
}

.sc-result-overlay.win .sc-result-door-wheel { animation: scResultWheelTurn .55s cubic-bezier(.2,.8,.2,1) .08s both; }
.sc-result-overlay.win .sc-result-door-bolts i:nth-child(odd) { animation: scResultBoltLeft .3s ease .42s forwards; }
.sc-result-overlay.win .sc-result-door-bolts i:nth-child(even) { animation: scResultBoltRight .3s ease .42s forwards; }
.sc-result-overlay.win .sc-result-door { animation: scResultDoorOpen .72s cubic-bezier(.18,.72,.2,1) .58s forwards; }
.sc-result-overlay.win .sc-result-vault-well i { animation: scResultWarmCore .45s ease .62s forwards; }
.sc-result-overlay.win .sc-result-vault-light { animation: scResultLightSpill .58s ease .66s forwards; }
.sc-result-overlay.win .sc-result-door-signal { background: #55e889; box-shadow: 0 0 12px rgba(82,255,142,.62); }

.sc-result-overlay.lose .sc-result-door { animation: scResultDenied .46s ease .18s both; }
.sc-result-overlay.lose .sc-result-door-signal { animation: scResultDeniedSignal .7s ease infinite alternate; }
.sc-result-overlay.tie .sc-result-door-signal { background: #c49638; box-shadow: 0 0 11px rgba(255,228,94,.46); animation: scResultTieSignal 1s ease infinite alternate; }

.sc-result-kicker {
  margin-top: 1px;
  color: #e6c579;
  font-size: .64rem;
  letter-spacing: .2em;
}

.sc-result-card h2 { margin-top: 7px; }

@keyframes scSequenceBackdropIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes scCountdownVaultBreathe { from { transform: translate(-50%, -50%) rotateX(7deg) scale(.985); } to { transform: translate(-50%, -50%) rotateX(7deg) scale(1); } }
@keyframes scCountdownRingTurn { 0% { transform: rotate(0); } 68% { transform: rotate(110deg); } 100% { transform: rotate(144deg); } }
@keyframes scSequenceNumberIn { 0% { opacity: 0; transform: scale(.58); filter: blur(5px); } 68% { opacity: 1; transform: scale(1.1); filter: blur(0); } 100% { opacity: 1; transform: scale(1); } }
@keyframes scResultCabinetIn { from { opacity: 0; transform: translateY(12px) scale(.97); } to { opacity: 1; transform: none; } }
@keyframes scResultContentIn { to { opacity: 1; transform: none; } }
@keyframes scResultWheelTurn { from { transform: translate(-50%, -50%) rotate(0); } to { transform: translate(-50%, -50%) rotate(118deg); } }
@keyframes scResultBoltLeft { to { transform: translateX(-20px); opacity: .45; } }
@keyframes scResultBoltRight { to { transform: translateX(20px); opacity: .45; } }
@keyframes scResultDoorOpen { 0% { transform: rotateY(0) translateX(0); } 100% { transform: rotateY(-72deg) translateX(-5px); filter: brightness(.78); } }
@keyframes scResultWarmCore { to { opacity: 1; transform: scale(1.12); } }
@keyframes scResultLightSpill { to { opacity: .84; } }
@keyframes scResultDenied { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 50% { transform: translateX(4px); } 75% { transform: translateX(-2px); } }
@keyframes scResultDeniedSignal { from { background: #6e1c19; box-shadow: 0 0 5px rgba(255,61,54,.25); } to { background: #ff4840; box-shadow: 0 0 15px rgba(255,61,54,.65); } }
@keyframes scResultTieSignal { from { opacity: .55; } to { opacity: 1; } }

@media (max-width: 700px) {
  .sc-countdown-vault { width: min(82vw, 360px); }
  .sc-result-card { padding: 14px 14px 20px; }
  .sc-result-vault { width: 166px; height: 166px; }
  .sc-result-vault-light { width: 230px; height: 145px; }
  .sc-result-content { animation-delay: .7s; }
}

@media (max-height: 640px) and (max-width: 700px) {
  .sc-result-vault { width: 128px; height: 128px; }
  .sc-result-card { padding-top: 10px; }
  .sc-result-card h2 { font-size: clamp(1.7rem, 9vw, 2.5rem); }
  .sc-result-card p { margin-bottom: 10px; font-size: .78rem; }
  .sc-code-reveal { margin: 8px 0 12px; }
}

@media (prefers-reduced-motion: reduce) {
  .sc-result-content,
  .sc-result-door,
  .sc-result-door-wheel,
  .sc-result-door-bolts i,
  .sc-result-vault-well i,
  .sc-result-vault-light {
    animation-delay: 0s !important;
  }
  .sc-result-content { opacity: 1; transform: none; }
  .sc-result-overlay.win .sc-result-door { transform: rotateY(-65deg); }
  .sc-result-overlay.win .sc-result-vault-well i,
  .sc-result-overlay.win .sc-result-vault-light { opacity: .78; }
}
${cssEnd}`;

let css = await readFile(cssUrl, 'utf8');
const markerPattern = /\/\* SAFE_CRACKER_VISUAL_SEQUENCE_V4_START \*\/[\s\S]*?\/\* SAFE_CRACKER_VISUAL_SEQUENCE_V4_END \*\/\s*/m;
css = css.replace(markerPattern, '').trimEnd() + `\n\n${visualSequence}\n`;
await writeFile(cssUrl, css);

let html = await readFile(indexUrl, 'utf8');
html = html.replaceAll('/assets/safe-cracker/safe-cracker.css?v=7', '/assets/safe-cracker/safe-cracker.css?v=8');
html = html.replaceAll('/assets/safe-cracker/safe-cracker.js?v=7', '/assets/safe-cracker/safe-cracker.js?v=8');
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker visual pass 4: cinematic vault countdown, mechanical result sequence, and animated safe opening.');
