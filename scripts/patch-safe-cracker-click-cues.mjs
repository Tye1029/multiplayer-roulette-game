import { readFile, writeFile } from 'node:fs/promises';

const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const start = '// SAFE_CRACKER_CLICK_CUES_V14_START';
const end = '// SAFE_CRACKER_CLICK_CUES_V14_END';

let client = await readFile(clientUrl, 'utf8');
if (!client.includes('// SAFE_CRACKER_RECORDED_SOUNDS_V13_START')) {
  throw new Error('Safe Cracker click cues require the recorded soundscape v13 runtime.');
}
if (!client.includes('// SAFE_CRACKER_DIAL_ACTIVITY_V16_START')) {
  throw new Error('Safe Cracker click cues require dial activity retention v16.');
}

if (!client.includes(start)) {
  const patch = String.raw`
  ${start}
  function safeCrackerClickNoiseBuffer(context) {
    if (runtime.safeCrackerClickNoiseBuffer?.sampleRate === context.sampleRate) {
      return runtime.safeCrackerClickNoiseBuffer;
    }
    const length = Math.max(96, Math.floor(context.sampleRate * 0.034));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      const envelope = Math.exp(-index / Math.max(1, context.sampleRate * 0.0048));
      const grit = (Math.random() * 2 - 1) * 0.72;
      const edge = index % 2 ? -0.28 : 0.28;
      data[index] = (grit + edge) * envelope;
    }
    runtime.safeCrackerClickNoiseBuffer = buffer;
    return buffer;
  }

  function safeCrackerPlayClickTransient(options = {}) {
    const context = resumeAudio();
    if (!context || document.hidden) return false;
    const delay = Math.max(0, Number(options.delay) || 0);
    const duration = Math.max(0.018, Number(options.duration) || 0.045);
    const startAt = context.currentTime + delay;
    const finishAt = startAt + duration;
    const noiseSource = context.createBufferSource();
    const highpass = context.createBiquadFilter();
    const bandpass = context.createBiquadFilter();
    const noiseGain = context.createGain();
    const tone = context.createOscillator();
    const toneGain = context.createGain();

    noiseSource.buffer = safeCrackerClickNoiseBuffer(context);
    noiseSource.playbackRate.setValueAtTime(
      Math.max(0.72, Math.min(1.42, Number(options.playbackRate) || 1)),
      startAt
    );
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(Math.max(80, Number(options.highpass) || 900), startAt);
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(Math.max(180, Number(options.frequency) || 2600), startAt);
    bandpass.Q.setValueAtTime(Math.max(0.2, Number(options.q) || 2.2), startAt);
    const noiseLevel = Math.max(0.002, Number(options.gain) || 0.16);
    noiseGain.gain.setValueAtTime(noiseLevel, startAt);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, finishAt);

    tone.type = options.toneType || 'triangle';
    const toneStart = Math.max(45, Number(options.toneFrequency) || 1450);
    const toneEnd = Math.max(42, Number(options.toneEnd) || 520);
    tone.frequency.setValueAtTime(toneStart, startAt);
    tone.frequency.exponentialRampToValueAtTime(toneEnd, finishAt);
    const toneLevel = Math.max(0.001, Number(options.toneGain) || 0.045);
    toneGain.gain.setValueAtTime(toneLevel, startAt);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, finishAt);

    noiseSource.connect(highpass);
    highpass.connect(bandpass);
    bandpass.connect(noiseGain);
    noiseGain.connect(safeCrackerAudioBus(context));
    tone.connect(toneGain);
    toneGain.connect(safeCrackerAudioBus(context));
    noiseSource.start(startAt);
    noiseSource.stop(finishAt + 0.012);
    tone.start(startAt);
    tone.stop(finishAt + 0.012);
    return true;
  }

  function safeCrackerPlayDialClick(digit) {
    const step = Math.abs(Number(digit) || 0) % 7;
    return safeCrackerPlayClickTransient({
      duration: 0.038,
      gain: 0.18,
      highpass: 1050,
      frequency: 2550 + step * 55,
      q: 2.7,
      playbackRate: 0.94 + step * 0.014,
      toneFrequency: 1620 + step * 34,
      toneEnd: 560 + step * 11,
      toneGain: 0.052,
      toneType: 'square'
    });
  }

  function safeCrackerPlayWrongNumberCue(tier) {
    const severity = tier === 'yellow' ? 0 : tier === 'orange' ? 1 : 2;
    const first = safeCrackerPlayClickTransient({
      duration: 0.082,
      gain: 0.14 + severity * 0.012,
      highpass: 120,
      frequency: 760 - severity * 75,
      q: 1.1,
      toneFrequency: 285 - severity * 28,
      toneEnd: 118 - severity * 10,
      toneGain: 0.085,
      toneType: 'square'
    });
    const second = safeCrackerPlayClickTransient({
      delay: 0.105,
      duration: 0.09,
      gain: 0.12 + severity * 0.012,
      highpass: 110,
      frequency: 620 - severity * 55,
      q: 1,
      toneFrequency: 210 - severity * 20,
      toneEnd: 82,
      toneGain: 0.078,
      toneType: 'sawtooth'
    });
    return Boolean(first || second);
  }

  function safeCrackerPlayCorrectNumberCue() {
    const click = safeCrackerPlayClickTransient({
      duration: 0.055,
      gain: 0.18,
      highpass: 1150,
      frequency: 3150,
      q: 3,
      toneFrequency: 920,
      toneEnd: 1240,
      toneGain: 0.064,
      toneType: 'triangle'
    });
    const ping = safeCrackerPlayClickTransient({
      delay: 0.085,
      duration: 0.14,
      gain: 0.09,
      highpass: 1450,
      frequency: 3950,
      q: 3.8,
      toneFrequency: 1280,
      toneEnd: 1760,
      toneGain: 0.075,
      toneType: 'sine'
    });
    return Boolean(click || ping);
  }

  const safeCrackerClickDetentFallback = safeCrackerPlayDetent;
  safeCrackerPlayDetent = function safeCrackerPlayClickyDetent(digit) {
    const now = performance.now();
    if (now - Number(runtime.safeCrackerClickDetentAt || 0) < 28) return;
    runtime.safeCrackerClickDetentAt = now;
    const played = safeCrackerPlayDialClick(digit);
    if (!played) safeCrackerClickDetentFallback(digit);
    else safeCrackerHaptic(3);
  };
  playDetent = safeCrackerPlayDetent;

  const safeCrackerClickTumblerFallback = safeCrackerPlayTumblerLock;
  safeCrackerPlayTumblerLock = function safeCrackerPlayCorrectNumberSound() {
    const cuePlayed = safeCrackerPlayCorrectNumberCue();
    const recordedPlayed = safeCrackerPlayRecordedSound('latchOpen', {
      gain: 0.34,
      playbackRate: 1.04,
      highpass: 80,
      lowpass: 9400
    });
    if (!cuePlayed && !recordedPlayed) safeCrackerClickTumblerFallback();
    else safeCrackerHaptic([14, 28, 24]);
  };

  const safeCrackerClickFeedbackFallback = safeCrackerPlayFeedback;
  safeCrackerPlayFeedback = function safeCrackerPlayWrongOrCorrectNumberSound(tier) {
    if (tier === 'green') {
      safeCrackerPlayTumblerLock();
      return;
    }
    const settings = tier === 'yellow'
      ? { gain: 0.19, playbackRate: 1.07, haptic: [8, 34, 10], lowpass: 5400 }
      : tier === 'orange'
        ? { gain: 0.24, playbackRate: 0.98, haptic: [10, 38, 12], lowpass: 4600 }
        : { gain: 0.29, playbackRate: 0.9, haptic: [12, 42, 14], lowpass: 3900 };
    const cuePlayed = safeCrackerPlayWrongNumberCue(tier);
    const recordedPlayed = safeCrackerPlayRecordedSound('incorrect', {
      gain: settings.gain,
      playbackRate: settings.playbackRate,
      highpass: 55,
      lowpass: settings.lowpass
    });
    if (!cuePlayed && !recordedPlayed) safeCrackerClickFeedbackFallback(tier);
    else safeCrackerHaptic(settings.haptic);
  };
  playFeedback = safeCrackerPlayFeedback;
  ${end}
`;

  const closing = '\n})();';
  const closingIndex = client.lastIndexOf(closing);
  if (closingIndex < 0) throw new Error('Safe Cracker click-cue patch could not find the runtime closure.');
  client = client.slice(0, closingIndex) + patch + client.slice(closingIndex);
}

const required = [
  start,
  'function safeCrackerClickNoiseBuffer(context)',
  'function safeCrackerPlayClickTransient(options = {})',
  'function safeCrackerPlayDialClick(digit)',
  'function safeCrackerPlayWrongNumberCue(tier)',
  'function safeCrackerPlayCorrectNumberCue()',
  'function safeCrackerPlayClickyDetent(digit)',
  'function safeCrackerPlayCorrectNumberSound()',
  'function safeCrackerPlayWrongOrCorrectNumberSound(tier)',
  "safeCrackerPlayRecordedSound('incorrect'",
  "safeCrackerPlayRecordedSound('latchOpen'",
  'playDetent = safeCrackerPlayDetent;',
  'playFeedback = safeCrackerPlayFeedback;',
  '// SAFE_CRACKER_DIAL_ACTIVITY_V16_START',
  'choice: `safecracker:guess:${runtime.selected}`'
];
for (const fragment of required) {
  if (!client.includes(fragment)) throw new Error(`Safe Cracker click-cue patch is missing ${fragment}.`);
}
if ((client.match(/SAFE_CRACKER_CLICK_CUES_V14_START/g) || []).length !== 1) {
  throw new Error('Safe Cracker click-cue marker must appear exactly once.');
}
await writeFile(clientUrl, client);

let html = await readFile(indexUrl, 'utf8');
html = html.replace(/\/assets\/safe-cracker\/safe-cracker\.js\?[^"'\s]*/g, value => {
  const clean = value.replace(/&clicks=\d+/g, '');
  return `${clean}&clicks=14`;
});
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker click cues v14: crisp dial clicks plus guaranteed distinct wrong and correct number sounds.');
