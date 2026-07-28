import { readFile, writeFile } from 'node:fs/promises';

const indexUrl = new URL('../index.html', import.meta.url);
const audioUrl = new URL('../assets/roulette/audio-manager.js', import.meta.url);
const policyUrl = new URL('../assets/roulette/spin-audio-policy.js', import.meta.url);
const lampUrl = new URL('../assets/roulette/lamp.js', import.meta.url);
const lampCssUrl = new URL('../assets/roulette/lamp.css', import.meta.url);

let html = await readFile(indexUrl, 'utf8');
let audio = await readFile(audioUrl, 'utf8');
let policy = await readFile(policyUrl, 'utf8');
let lamp = await readFile(lampUrl, 'utf8');
let lampCss = await readFile(lampCssUrl, 'utf8');

function replaceOnce(source, label, before, after) {
  if (source.includes(after)) return source;
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Roulette turn/countdown/smoke patch could not find ${label}.`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Roulette turn/countdown/smoke patch found more than one ${label}.`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

policy = replaceOnce(
  policy,
  'the turn movement state fields',
  `  let lastGameId = '';
  let lastTurnId = '';
  let hammerVariant = 0;`,
  `  let lastGameId = '';
  let lastTurnId = '';
  let lastTurnMoveKey = '';
  let hammerVariant = 0;`
);

policy = replaceOnce(
  policy,
  'the unreliable player-only turn movement key',
  `  function syncTurnMovement() {
    const game = currentGame();
    const gameId = String(game?.gameId || '');
    const turnId = String(game?.rouletteState?.turnId || '');
    if (!gameId || game?.status !== 'playing' || !turnId) {
      lastGameId = gameId;
      lastTurnId = turnId;
      return;
    }
    if (
      gameId === lastGameId &&
      lastTurnId &&
      turnId !== lastTurnId &&
      performance.now() >= chamberSpinUntil &&
      claimAction('turn-move', \`${'${gameId}:${turnId}'}\`, 12000)
    ) {
      stopGroup('turn-move', 45);
      playClip(TABLE_MOVE, {
        group: 'turn-move',
        volume: 0.052,
        rate: 1.06,
        start: 0.14,
        duration: 0.82,
        fadeIn: 0.04,
        fadeOut: 0.22
      });
    }
    lastGameId = gameId;
    lastTurnId = turnId;
  }`,
  `  function playTurnMove(game, state, gameId, turnId) {
    const revision = Number(state?.revision ?? game?.revision ?? 0);
    const action = String(state?.lastAction || 'turn');
    const actor = String(state?.lastActorId || '');
    const shots = Number(state?.shotsFired ?? state?.lastShotNumber ?? 0);
    const movementKey = [gameId, revision, action, actor, turnId, shots].join(':');
    if (!gameId || !turnId || movementKey === lastTurnMoveKey) return false;
    if (performance.now() < chamberSpinUntil) return false;
    if (!claimAction('turn-move', movementKey, 4500)) return false;

    lastTurnMoveKey = movementKey;
    stopGroup('turn-move', 30);
    playClip(TABLE_MOVE, {
      group: 'turn-move',
      volume: 0.062,
      rate: 1.08,
      start: 0.12,
      duration: 0.58,
      fadeIn: 0.025,
      fadeOut: 0.24
    });
    return true;
  }

  function syncTurnMovement() {
    const game = currentGame();
    const state = game?.rouletteState || {};
    const gameId = String(game?.gameId || '');
    const turnId = String(state.turnId || '');
    if (!gameId || game?.status !== 'playing' || !turnId) {
      lastGameId = gameId;
      lastTurnId = turnId;
      return;
    }
    if (gameId === lastGameId && lastTurnId && turnId !== lastTurnId) {
      playTurnMove(game, state, gameId, turnId);
    }
    lastGameId = gameId;
    lastTurnId = turnId;
  }`
);

policy = replaceOnce(
  policy,
  'the mix policy diagnostics export',
  `  global.RouletteAudioMixPolicy = Object.freeze({
    openingSpin,
    shotSequence,
    diagnostics() {`,
  `  global.RouletteAudioMixPolicy = Object.freeze({
    openingSpin,
    shotSequence,
    turnMove: playTurnMove,
    diagnostics() {`
);

policy = replaceOnce(
  policy,
  'the turn movement diagnostics fields',
  `        lastGameId,
        lastTurnId,
        chainCooldownMs: CHAIN_COOLDOWN`,
  `        lastGameId,
        lastTurnId,
        lastTurnMoveKey,
        chainCooldownMs: CHAIN_COOLDOWN`
);

audio = replaceOnce(
  audio,
  'the delayed turn wood knock',
  `    if (sameGame && previous.turnId && turnId && previous.turnId !== turnId && status === 'playing') {
      turnRotate(1020);
      scheduleAction('turn-cue', () => play('tap', {
        group: 'turn-cue',
        replaceGroup: true,
        volume: 0.11
      }), 850);
    }`,
  `    if (sameGame && previous.turnId && turnId && previous.turnId !== turnId && status === 'playing') {
      global.RouletteAudioMixPolicy?.turnMove?.(game, state, gameId, turnId);
    }`
);

audio = replaceOnce(
  audio,
  'the countdown sound helper insertion point',
  `  function currentGame() {`,
  `  function countdownCue(label) {
    const cue = String(label || '').toUpperCase();
    if (!['3', '2', '1', 'GO!'].includes(cue)) return false;
    if (!permitAction(\`countdown-${'${cue}'}\`, 260)) return false;

    stopGroup('countdown', 55);
    stopGroup('countdown-body', 55);
    const rate = cue === '3' ? 0.96 : cue === '2' ? 0.88 : cue === '1' ? 0.80 : 0.70;
    const level = cue === 'GO!' ? 0.13 : 0.105;
    play('heartbeat', {
      group: 'countdown',
      replaceGroup: true,
      volume: level,
      rate,
      start: 0.06,
      duration: cue === 'GO!' ? 0.92 : 0.68,
      fadeOut: cue === 'GO!' ? 0.62 : 0.42
    });
    play('rumble', {
      group: 'countdown-body',
      replaceGroup: true,
      volume: cue === 'GO!' ? 0.072 : 0.052,
      rate: Math.max(0.68, rate - 0.08),
      start: 0.12,
      duration: cue === 'GO!' ? 1.05 : 0.72,
      fadeOut: cue === 'GO!' ? 0.74 : 0.48
    });
    return true;
  }

  function currentGame() {`
);

audio = replaceOnce(
  audio,
  'the countdown cue export',
  `    gunshot,
    duckForShot,`,
  `    gunshot,
    countdownCue,
    duckForShot,`
);

html = replaceOnce(
  html,
  'the quiet roulette countdown synthesis',
  `        if(game?.mode==='roulette'){
          const fundamental=label==='3'?92.50:label==='2'?82.41:label==='1'?73.42:55;
          const duration=label==='GO!'?.70:.48;
          const bodyLevel=label==='GO!'?.082:.066;
          scheduleTone(fundamental,now,duration,'sine',sfxGain,bodyLevel,{attack:.014,release:duration*.78,filterFrequency:250});
          scheduleTone(fundamental*2,now+.026,duration*.58,'triangle',sfxGain,label==='GO!'?.020:.016,{attack:.006,release:duration*.48,filterFrequency:620});
          if(label==='GO!')scheduleTone(41.20,now+.045,.78,'sine',sfxGain,.052,{attack:.018,release:.66,filterFrequency:170});
        }`,
  `        if(game?.mode==='roulette'){
          globalThis.RouletteAudio?.countdownCue?.(label);
          const fundamental=label==='3'?146.83:label==='2'?130.81:label==='1'?116.54:82.41;
          const duration=label==='GO!'?.72:.48;
          scheduleTone(fundamental,now,duration,'sine',sfxGain,label==='GO!'?.060:.046,{attack:.012,release:duration*.76,filterFrequency:520});
          scheduleTone(fundamental*2,now+.018,duration*.62,'triangle',sfxGain,label==='GO!'?.024:.020,{attack:.006,release:duration*.50,filterFrequency:1050});
        }`
);

const redCountdownMarker = '<style id="rr-v150-red-countdown-smoke">';
if (!html.includes(redCountdownMarker)) {
  const style = `${redCountdownMarker}
  [data-roulette-game] .rr-scene-countdown .duel-countdown-number,
  [data-roulette-game] .rr-scene-countdown .duel-countdown-number.go{
    color:#b50f18!important;
    text-shadow:0 7px 0 rgba(28,0,0,.76),0 0 20px rgba(190,0,18,.62),0 0 48px rgba(74,0,7,.92)!important;
  }
</style>`;
  if (!html.includes('</head>')) throw new Error('Roulette turn/countdown/smoke patch could not find </head>.');
  html = html.replace('</head>', `${style}\n</head>`);
}

lamp = replaceOnce(
  lamp,
  'the smoke scene query',
  `      chain: doc.querySelector('.rr126-chain'),
      sceneLight: doc.querySelector('.rr130-table-illumination')`,
  `      chain: doc.querySelector('.rr126-chain'),
      sceneLight: doc.querySelector('.rr130-table-illumination'),
      smoke: doc.querySelector('.rr-smoke')`
);

lamp = replaceOnce(
  lamp,
  'the smoke layer helpers',
  `  function ensureLampImage(doc, swing) {`,
  `  function ensureSmokeLayers(doc, smoke) {
    if (!smoke) return { ambient: null, lit: null };
    let ambient = smoke.querySelector('.rr-smoke-ambient');
    if (!ambient) {
      ambient = doc.createElement('span');
      ambient.className = 'rr-smoke-ambient';
      smoke.append(ambient);
    }
    let lit = smoke.querySelector('.rr-smoke-lit');
    if (!lit) {
      lit = doc.createElement('span');
      lit.className = 'rr-smoke-lit';
      smoke.append(lit);
    }
    return { ambient, lit };
  }

  function ensureSmokeTimeline(smokeLit, cfg) {
    if (!smokeLit) return null;
    setImportant(smokeLit, 'animation', 'none');
    const duration = Math.max(0.1, Number(cfg.trackSpeed) || 0.1);
    const distance = Math.max(0, Number(cfg.track) || 0);
    const travel = Math.max(2.5, distance * 0.72);
    const signature = \`${'${duration}'}|${'${distance}'}|smoke-v1\`;
    return ensureElementTimeline(
      smokeLit,
      '__rrLampSmokeTimeline',
      signature,
      [
        { transform: \`translate3d(${'${-travel}'}%,0,0) scale(1.04)\`, opacity: 0.20, offset: 0 },
        { transform: \`translate3d(${'${travel}'}%,0,0) scale(1.08)\`, opacity: 0.38, offset: 0.5 },
        { transform: \`translate3d(${'${-travel}'}%,0,0) scale(1.04)\`, opacity: 0.20, offset: 1 }
      ],
      {
        duration: duration * 1000,
        iterations: Infinity,
        easing: 'ease-in-out',
        fill: 'both'
      },
      phaseMilliseconds(duration)
    );
  }

  function ensureLampImage(doc, swing) {`
);

lamp = replaceOnce(
  lamp,
  'the smoke layer mounting',
  `    const image = ensureLampImage(doc, scene.swing);`,
  `    const image = ensureLampImage(doc, scene.swing);
    const smokeLayers = ensureSmokeLayers(doc, scene.smoke);
    ensureSmokeTimeline(smokeLayers.lit, cfg);`
);

const smokeCssMarker = '/* Lamp-synchronized room smoke. */';
if (!lampCss.includes(smokeCssMarker)) {
  lampCss += `

${smokeCssMarker}
[data-roulette-game] .rr-smoke{
  display:block!important;
  position:absolute!important;
  inset:7% -12% 33%!important;
  z-index:3!important;
  opacity:1!important;
  overflow:hidden!important;
  pointer-events:none!important;
  animation:none!important;
  transform:none!important;
  mix-blend-mode:screen!important;
}
[data-roulette-game] .rr-smoke-ambient,
[data-roulette-game] .rr-smoke-lit{
  position:absolute!important;
  inset:-16% -12%!important;
  display:block!important;
  pointer-events:none!important;
}
[data-roulette-game] .rr-smoke-ambient{
  opacity:.30;
  filter:blur(11px);
  background:
    repeating-linear-gradient(168deg,transparent 0 32px,rgba(176,181,184,.055) 38px 42px,transparent 49px 78px),
    radial-gradient(ellipse 38% 17% at 22% 52%,rgba(191,196,198,.11),transparent 72%),
    radial-gradient(ellipse 46% 20% at 72% 38%,rgba(169,175,178,.09),transparent 74%);
  animation:rrRoomSmokeDrift 13s ease-in-out infinite alternate!important;
}
[data-roulette-game] .rr-smoke-lit{
  opacity:.26;
  filter:blur(13px) saturate(1.08);
  background:
    radial-gradient(ellipse 34% 58% at 50% 48%,rgba(255,218,157,.24) 0,rgba(255,159,65,.12) 38%,transparent 76%),
    repeating-linear-gradient(171deg,transparent 0 27px,rgba(255,214,157,.08) 33px 38px,transparent 45px 72px);
  background-size:125% 100%,100% 100%;
  mix-blend-mode:screen!important;
  will-change:transform,opacity;
}
@keyframes rrRoomSmokeDrift{
  0%{transform:translate3d(-2.5%,2%,0) scale(1.02);opacity:.22}
  50%{transform:translate3d(1.5%,-1%,0) scale(1.07);opacity:.34}
  100%{transform:translate3d(3%,-3%,0) scale(1.04);opacity:.26}
}
@media(max-width:600px){
  [data-roulette-game] .rr-smoke{inset:10% -18% 35%!important}
  [data-roulette-game] .rr-smoke-ambient{opacity:.25}
  [data-roulette-game] .rr-smoke-lit{opacity:.30}
}
@media(prefers-reduced-motion:reduce){
  [data-roulette-game] .rr-smoke-ambient,
  [data-roulette-game] .rr-smoke-lit{animation:none!important;transform:none!important}
}
`;
}

await writeFile(indexUrl, html);
await writeFile(audioUrl, audio);
await writeFile(policyUrl, policy);
await writeFile(lampUrl, lamp);
await writeFile(lampCssUrl, lampCss);
console.log('Patched Roulette: reliable pass rotation audio, no terminal wood knock, red audible countdown, and lamp-synchronized room smoke.');
