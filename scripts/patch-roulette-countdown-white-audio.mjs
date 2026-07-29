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

function replaceGeneratedBlock(source, startMarker, nextMarker, replacement) {
  const start = source.indexOf(startMarker);
  if (start < 0) return null;
  const end = source.indexOf(nextMarker, start + startMarker.length);
  if (end < 0) throw new Error(`Roulette countdown patch could not find ${nextMarker} after ${startMarker}.`);
  return source.slice(0, start) + replacement + source.slice(end);
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

const countdownBlock = `  let countdownSynthContext = null;

  function countdownSynthAudioContext() {
    if (countdownSynthContext && countdownSynthContext.state !== 'closed') return countdownSynthContext;
    const AudioContextType = global.AudioContext || global.webkitAudioContext;
    if (typeof AudioContextType !== 'function') return null;
    try {
      countdownSynthContext = new AudioContextType({ latencyHint: 'interactive' });
    } catch {
      try { countdownSynthContext = new AudioContextType(); } catch { countdownSynthContext = null; }
    }
    return countdownSynthContext;
  }

  function countdownSynthTone(context, destination, options) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = options.start;
    const duration = options.duration;
    const attack = Math.min(duration * 0.25, options.attack || 0.012);
    const level = Math.max(0.0001, options.level || 0.04);

    oscillator.type = options.type || 'sine';
    oscillator.frequency.setValueAtTime(options.frequency, start);
    if (options.endFrequency && options.endFrequency > 0) {
      oscillator.frequency.exponentialRampToValueAtTime(options.endFrequency, start + duration);
    }
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(level, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.025);
  }

  function countdownSynthClick(context, destination, start, level) {
    const sampleRate = context.sampleRate || 44100;
    const frameCount = Math.max(1, Math.floor(sampleRate * 0.055));
    const buffer = context.createBuffer(1, frameCount, sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < frameCount; index += 1) {
      const envelope = 1 - index / frameCount;
      channel[index] = (Math.random() * 2 - 1) * envelope * envelope;
    }

    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1450, start);
    filter.Q.setValueAtTime(1.8, start);
    gain.gain.setValueAtTime(Math.max(0.0001, level), start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.055);
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    source.start(start);
  }

  function countdownCue(label) {
    const value = String(label || '');
    if (!['3', '2', '1', 'GO!'].includes(value)) return false;
    if (!enabled || !unlocked || document.hidden) return false;

    const context = countdownSynthAudioContext();
    if (!context) return false;

    try {
      if (context.state === 'suspended') context.resume().catch(() => {});
      const now = context.currentTime + 0.014;
      const output = context.createGain();
      output.gain.setValueAtTime(Math.max(0.08, master), now);
      output.connect(context.destination);

      if (value === 'GO!') {
        countdownSynthClick(context, output, now, 0.11);
        countdownSynthTone(context, output, {
          start: now,
          duration: 0.30,
          frequency: 293.66,
          endFrequency: 220,
          type: 'triangle',
          level: 0.105,
          attack: 0.008
        });
        countdownSynthTone(context, output, {
          start: now + 0.065,
          duration: 0.42,
          frequency: 440,
          endFrequency: 659.25,
          type: 'sine',
          level: 0.075,
          attack: 0.012
        });
        countdownSynthTone(context, output, {
          start: now + 0.075,
          duration: 0.34,
          frequency: 880,
          endFrequency: 1174.66,
          type: 'triangle',
          level: 0.026,
          attack: 0.009
        });
      } else {
        const step = value === '3' ? 0 : value === '2' ? 1 : 2;
        const fundamental = [174.61, 207.65, 246.94][step];
        countdownSynthClick(context, output, now, 0.075 + step * 0.008);
        countdownSynthTone(context, output, {
          start: now,
          duration: 0.24,
          frequency: fundamental,
          endFrequency: fundamental * 0.82,
          type: 'triangle',
          level: 0.082,
          attack: 0.007
        });
        countdownSynthTone(context, output, {
          start: now + 0.012,
          duration: 0.19,
          frequency: fundamental * 3,
          endFrequency: fundamental * 2.25,
          type: 'sine',
          level: 0.026,
          attack: 0.005
        });
      }

      global.setTimeout(() => {
        try { output.disconnect(); } catch {}
      }, value === 'GO!' ? 900 : 520);
      return true;
    } catch {
      return false;
    }
  }

`;

const existingGenerated = replaceGeneratedBlock(
  audio,
  '  let countdownSynthContext = null;',
  '  function hammer() {',
  countdownBlock
) || replaceGeneratedBlock(
  audio,
  '  function countdownCue(label) {',
  '  function hammer() {',
  countdownBlock
);

if (existingGenerated) audio = existingGenerated;
else {
  audio = replaceOnce(
    audio,
    'the hammer sound function',
    `  function hammer() {`,
    `${countdownBlock}  function hammer() {`
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

const turnCueBefore = `    if (sameGame && previous.turnId && turnId && previous.turnId !== turnId && status === 'playing') {
      turnRotate(1020);
      scheduleAction('turn-cue', () => play('tap', {
        group: 'turn-cue',
        replaceGroup: true,
        volume: 0.11
      }), 850);
    }`;
const turnCueAfter = `    if (sameGame && previous.turnId && turnId && previous.turnId !== turnId && status === 'playing') {
      clearActionTimers('turn-cue');
      stopGroup('turn-cue', 24);
      turnRotate(1020);
    }`;
if (!audio.includes(turnCueAfter)) {
  audio = replaceOnce(audio, 'the delayed wooden turn cue', turnCueBefore, turnCueAfter);
}

for (const required of [
  `id="${styleMarker}"`,
  'color:#fff!important',
  soundHook
]) {
  if (!html.includes(required)) throw new Error(`Final countdown HTML is missing ${required}`);
}
for (const required of [
  'function countdownSynthAudioContext()',
  'function countdownSynthTone(context, destination, options)',
  'function countdownSynthClick(context, destination, start, level)',
  'function countdownCue(label)',
  "const fundamental = [174.61, 207.65, 246.94][step]",
  'countdownCue,',
  "stopGroup('turn-cue', 24)"
]) {
  if (!audio.includes(required)) throw new Error(`Final countdown audio is missing ${required}`);
}
if (audio.includes("scheduleAction('turn-cue'")) {
  throw new Error('The delayed wooden knock remains in the turn-change audio path.');
}

await writeFile(indexUrl, html);
await writeFile(audioUrl, audio);
console.log('Patched Roulette countdown: pure white text, original custom clockwork synth for 3-2-1-GO, and no delayed wooden turn knock.');
