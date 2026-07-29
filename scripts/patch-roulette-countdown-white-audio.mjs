import { readFile, writeFile } from 'node:fs/promises';

const indexUrl = new URL('../index.html', import.meta.url);
const audioUrl = new URL('../assets/roulette/audio-manager.js', import.meta.url);

let html = await readFile(indexUrl, 'utf8');
let audio = await readFile(audioUrl, 'utf8');

function replaceOnce(source, label, before, after) {
  if (source.includes(after)) return source;
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Roulette countdown patch could not find ${label}.`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Roulette countdown patch found more than one ${label}.`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

const styleMarker = 'rr-v154-white-countdown-audio';
const style = `<style id="${styleMarker}">
  [data-roulette-game] .rr-scene-countdown .duel-countdown-number,
  [data-roulette-game] .rr-scene-countdown .duel-countdown-number.go {
    color:#fff!important;
    text-shadow:
      0 7px 0 rgba(0,0,0,.68),
      0 0 14px rgba(255,255,255,.55),
      0 0 34px rgba(0,0,0,.9)!important;
  }
</style>`;
const stylePattern = new RegExp(`<style\\s+id=["']${styleMarker}["'][^>]*>[\\s\\S]*?<\\/style>`, 'i');
if (stylePattern.test(html)) html = html.replace(stylePattern, style);
else {
  if (!html.includes('</head>')) throw new Error('Roulette countdown patch could not find </head>.');
  html = html.replace('</head>', `${style}\n</head>`);
}

const soundHook = `      if(game?.mode==='roulette'&&globalThis.RouletteAudio?.countdownCue?.(label))return;`;
if (!html.includes(soundHook)) {
  html = replaceOnce(
    html,
    'the shared countdown sound entry point',
    `      duelSharedCountdownSoundKey=soundKey;
      try{
        const ctx=getAudioContext();if(!ctx||!sfxGain)return;const now=ctx.currentTime+.012;`,
    `      duelSharedCountdownSoundKey=soundKey;
${soundHook}
      try{
        const ctx=getAudioContext();if(!ctx||!sfxGain)return;const now=ctx.currentTime+.012;`
  );
}

const countdownFunction = `  function countdownCue(label) {
    const value = String(label || '');
    if (!['3', '2', '1', 'GO!'].includes(value)) return false;

    clearActionTimers('countdown');
    stopGroup('countdown', 24);

    if (value === 'GO!') {
      const played = play('lock', {
        group: 'countdown',
        replaceGroup: true,
        replaceFade: 20,
        volume: 0.30,
        rate: 1.08,
        duration: 0.72,
        fadeOut: 0.20
      });
      scheduleAction('countdown', () => play('tap', {
        group: 'countdown',
        volume: 0.14,
        rate: 1.20,
        duration: 0.26,
        fadeOut: 0.08
      }), 72);
      return Boolean(played);
    }

    const index = value === '3' ? 0 : value === '2' ? 1 : 2;
    const played = play('tap', {
      group: 'countdown',
      replaceGroup: true,
      replaceFade: 18,
      volume: 0.24 + index * 0.025,
      rate: 0.84 + index * 0.13,
      duration: 0.34,
      fadeOut: 0.10
    });
    return Boolean(played);
  }

`;
if (!audio.includes('  function countdownCue(label) {')) {
  audio = replaceOnce(
    audio,
    'the hammer sound function',
    `  function hammer() {`,
    `${countdownFunction}  function hammer() {`
  );
}

if (!audio.includes('    countdownCue,')) {
  audio = replaceOnce(
    audio,
    'the RouletteAudio export list',
    `    openingSpin,
    turnRotate,
    hammer,`,
    `    openingSpin,
    turnRotate,
    countdownCue,
    hammer,`
  );
}

for (const required of [
  `id="${styleMarker}"`,
  'color:#fff!important',
  soundHook
]) {
  if (!html.includes(required)) throw new Error(`Final countdown HTML is missing ${required}`);
}
for (const required of [
  'function countdownCue(label)',
  "play('tap'",
  "play('lock'",
  'countdownCue,'
]) {
  if (!audio.includes(required)) throw new Error(`Final countdown audio is missing ${required}`);
}

await writeFile(indexUrl, html);
await writeFile(audioUrl, audio);
console.log('Patched Roulette countdown: pure white text and one dedicated sound cue for 3, 2, 1, and GO, with Web Audio fallback preserved.');
