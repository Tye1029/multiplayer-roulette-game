import { readFile, writeFile } from 'node:fs/promises';

const indexUrl = new URL('../index.html', import.meta.url);
const audioUrl = new URL('../assets/roulette/audio-manager.js', import.meta.url);

let html = await readFile(indexUrl, 'utf8');
let audio = await readFile(audioUrl, 'utf8');

function replaceHtmlOnce(label, before, after) {
  if (html.includes(after)) return;
  const first = html.indexOf(before);
  if (first < 0) {
    console.warn(`Roulette presentation patch skipped ${label}; a later authoritative patch or validator owns the final form.`);
    return;
  }
  if (html.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Roulette presentation patch found more than one ${label}.`);
  }
  html = html.slice(0, first) + after + html.slice(first + before.length);
}

function replaceAudioOnce(label, before, after) {
  if (audio.includes(after)) return;
  const first = audio.indexOf(before);
  if (first < 0) {
    console.warn(`Roulette audio patch skipped ${label}; a later authoritative patch or validator owns the final form.`);
    return;
  }
  if (audio.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Roulette audio patch found more than one ${label}.`);
  }
  audio = audio.slice(0, first) + after + audio.slice(first + before.length);
}

replaceHtmlOnce(
  'the center ONE ROUND ONE LIFE label',
  '<div class="rr-rain"></div><div class="rr-neon">ONE ROUND · ONE LIFE</div><div class="rr-turn-pulse"></div>',
  '<div class="rr-rain"></div><div class="rr-turn-pulse"></div>'
);

replaceHtmlOnce(
  'the countdown explanation at the top',
  "else if(!countdownFinished){status='GET READY';sub='The opening spin begins after the 3-2-1 countdown.';controlNote='Game starts after countdown';}",
  "else if(!countdownFinished){status='GET READY';sub='';controlNote='Game starts after countdown';}"
);

replaceHtmlOnce(
  'the losing taunt in the live table status',
  "if(sub)sub.textContent=localPlayerWasHit?rouletteStableMessage(game):'The shot was fired…';",
  "if(sub)sub.textContent=localPlayerWasHit?'':'The shot was fired…';"
);

replaceHtmlOnce(
  'the losing taunt in the completed table status',
  "sub=meWon?`You won ${money(game.payout||0)}.`:rouletteStableMessage(game);",
  "sub=meWon?`You won ${money(game.payout||0)}.`:'';"
);

replaceHtmlOnce(
  'the arcade roulette countdown tones',
  `        if(label==='DRAW!'){scheduleTone(196,now,.10,'sawtooth',sfxGain,.060,{attack:.002,release:.05,filterFrequency:1200});scheduleTone(587.33,now+.025,.18,'triangle',sfxGain,.085,{attack:.004,release:.09});scheduleTone(880,now+.055,.22,'triangle',sfxGain,.070,{attack:.004,release:.12});}
        else if(label==='GO!'){scheduleTone(523.25,now,.18,'triangle',sfxGain,.050,{attack:.008,release:.08});scheduleTone(783.99,now+.03,.24,'triangle',sfxGain,.038,{attack:.008,release:.12});}
        else{const f=(label==='READY'||label==='3')?330:(label==='SET'||label==='2')?415.30:493.88;scheduleTone(f,now,.16,'triangle',sfxGain,.080,{attack:.004,release:.07});scheduleTone(f/2,now,.13,'sine',sfxGain,.040,{attack:.003,release:.06});}`,
  `        if(game?.mode==='roulette'){
          const fundamental=label==='3'?92.50:label==='2'?82.41:label==='1'?73.42:55;
          const duration=label==='GO!'?.70:.48;
          const bodyLevel=label==='GO!'?.082:.066;
          scheduleTone(fundamental,now,duration,'sine',sfxGain,bodyLevel,{attack:.014,release:duration*.78,filterFrequency:250});
          scheduleTone(fundamental*2,now+.026,duration*.58,'triangle',sfxGain,label==='GO!'?.020:.016,{attack:.006,release:duration*.48,filterFrequency:620});
          if(label==='GO!')scheduleTone(41.20,now+.045,.78,'sine',sfxGain,.052,{attack:.018,release:.66,filterFrequency:170});
        }
        else if(label==='DRAW!'){scheduleTone(196,now,.10,'sawtooth',sfxGain,.060,{attack:.002,release:.05,filterFrequency:1200});scheduleTone(587.33,now+.025,.18,'triangle',sfxGain,.085,{attack:.004,release:.09});scheduleTone(880,now+.055,.22,'triangle',sfxGain,.070,{attack:.004,release:.12});}
        else if(label==='GO!'){scheduleTone(523.25,now,.18,'triangle',sfxGain,.050,{attack:.008,release:.08});scheduleTone(783.99,now+.03,.24,'triangle',sfxGain,.038,{attack:.008,release:.12});}
        else{const f=(label==='READY'||label==='3')?330:(label==='SET'||label==='2')?415.30:493.88;scheduleTone(f,now,.16,'triangle',sfxGain,.080,{attack:.004,release:.07});scheduleTone(f/2,now,.13,'sine',sfxGain,.040,{attack:.003,release:.06});}`
);

const styleMarker = '<style id="rr-v149-ui-audio-cleanup">';
if (!html.includes(styleMarker)) {
  const style = `${styleMarker}
  [data-roulette-game] .rr-neon{display:none!important}
  [data-roulette-game] .rr-scene-countdown{transform:translateY(clamp(42px,7.5vh,62px))!important}
  [data-roulette-game] .rr-scene-countdown .duel-countdown-number{
    color:#c7a175!important;
    text-shadow:0 7px 0 rgba(0,0,0,.62),0 0 22px rgba(110,28,8,.48),0 0 46px rgba(0,0,0,.86)!important;
    animation:rrDreadCountdown .48s cubic-bezier(.16,.7,.2,1)!important;
  }
  [data-roulette-game] .rr-scene-countdown .duel-countdown-number.go{color:#ac8463!important}
  @keyframes rrDreadCountdown{
    0%{opacity:0;transform:scale(1.32);filter:blur(3px)}
    42%{opacity:1;transform:scale(.96);filter:blur(0)}
    100%{opacity:1;transform:scale(1);filter:blur(0)}
  }
  @media(max-width:600px){[data-roulette-game] .rr-scene-countdown{transform:translateY(38px)!important}}
</style>`;
  if (!html.includes('</head>')) throw new Error('Roulette presentation patch could not find </head>.');
  html = html.replace('</head>', `${style}\n</head>`);
}

replaceAudioOnce(
  'the quiet ambient loop levels',
  `  const BASE_LOOP_LEVELS = Object.freeze({
    room: 0.052,
    hum: 0.021,
    heartbeat: 0.028,
    rumble: 0.013
  });`,
  `  const BASE_LOOP_LEVELS = Object.freeze({
    room: 0.085,
    hum: 0.032,
    heartbeat: 0.040,
    rumble: 0.022
  });`
);

replaceAudioOnce(
  'the ambient audio-session helper',
  `  const templates = new Map();`,
  `  function preferAmbientAudioSession() {
    try {
      if (global.navigator?.audioSession && 'type' in global.navigator.audioSession) {
        global.navigator.audioSession.type = 'ambient';
      }
    } catch {}
  }

  const templates = new Map();`
);

replaceAudioOnce(
  'the room ambience lifecycle',
  "    roomWanted = ['playing', 'waiting', 'open'].includes(status);",
  "    roomWanted = ['waiting', 'open', 'ready', 'countdown', 'playing', 'complete'].includes(status);"
);

replaceAudioOnce(
  'the audio unlock function',
  `  function unlock() {
    if (unlocked) return;
    unlocked = true;`,
  `  function unlock() {
    preferAmbientAudioSession();
    if (unlocked) return;
    unlocked = true;`
);

replaceAudioOnce(
  'the initial audio-session preference',
  `  silenceLegacyRouletteAudio();
  for (const type of ['pointerdown', 'pointerup', 'touchstart', 'click', 'keydown']) {`,
  `  preferAmbientAudioSession();
  silenceLegacyRouletteAudio();
  for (const type of ['pointerdown', 'pointerup', 'touchstart', 'click', 'keydown']) {`
);

await writeFile(indexUrl, html);
await writeFile(audioUrl, audio);
console.log('Patched Roulette presentation: cleaner table text, lower countdown position, darker countdown tones, stronger ambience, and best-effort ambient device mixing.');
