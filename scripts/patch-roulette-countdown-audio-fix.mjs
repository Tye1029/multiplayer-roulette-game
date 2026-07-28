import { readFile, writeFile } from 'node:fs/promises';

const indexUrl = new URL('../index.html', import.meta.url);
let html = await readFile(indexUrl, 'utf8');

function replaceOnce(label, before, after) {
  if (html.includes(after)) return;
  const first = html.indexOf(before);
  if (first < 0) throw new Error(`Countdown audio fix could not find ${label}.`);
  if (html.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Countdown audio fix found more than one ${label}.`);
  }
  html = html.slice(0, first) + after + html.slice(first + before.length);
}

replaceOnce(
  'the roulette cue hidden behind the Web Audio early return',
  `      try{
        const ctx=getAudioContext();if(!ctx||!sfxGain)return;const now=ctx.currentTime+.012;
        if(game?.mode==='roulette'){
          globalThis.RouletteAudio?.countdownCue?.(label);
          const fundamental=label==='3'?146.83:label==='2'?130.81:label==='1'?116.54:82.41;`,
  `      try{
        // The HTML-audio heartbeat/rumble path must run even when Web Audio has
        // not created or resumed its shared context yet on a mobile browser.
        if(game?.mode==='roulette'){
          globalThis.RouletteAudio?.unlock?.();
          globalThis.RouletteAudio?.countdownCue?.(label);
        }
        const ctx=getAudioContext();
        if(!ctx||!sfxGain)return;
        if(ctx.state==='suspended'){
          const resumePromise=ctx.resume?.();
          resumePromise?.catch?.(()=>{});
        }
        const now=ctx.currentTime+.012;
        if(game?.mode==='roulette'){
          const fundamental=label==='3'?146.83:label==='2'?130.81:label==='1'?116.54:82.41;`
);

const styleMarker = '<style id="rr-v152-deep-red-audible-countdown">';
if (!html.includes(styleMarker)) {
  const style = `${styleMarker}
  [data-roulette-game] .rr-scene-countdown .duel-countdown-number,
  [data-roulette-game] .rr-scene-countdown .duel-countdown-number.go{
    color:#65070b!important;
    -webkit-text-stroke:1px rgba(142,20,27,.38);
    text-shadow:
      0 7px 0 rgba(15,0,1,.92),
      0 0 13px rgba(104,0,8,.72),
      0 0 34px rgba(38,0,3,.96)!important;
    filter:saturate(.9) brightness(.88)!important;
  }
</style>`;
  if (!html.includes('</head>')) throw new Error('Countdown audio fix could not find </head>.');
  html = html.replace('</head>', `${style}\n</head>`);
}

await writeFile(indexUrl, html);
console.log('Fixed roulette countdown audio ordering and applied final-priority deep dark red countdown styling.');
