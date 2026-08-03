import { readFile, writeFile } from 'node:fs/promises';

const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const start = '// SAFE_CRACKER_CLICK_CUES_V15_START';
const end = '// SAFE_CRACKER_CLICK_CUES_V15_END';

let client = await readFile(clientUrl, 'utf8');
if (!client.includes('// SAFE_CRACKER_RECORDED_SOUNDS_V13_START')) {
  throw new Error('Safe Cracker click cues require the recorded soundscape v13 runtime.');
}
if (!client.includes('// SAFE_CRACKER_DIAL_ACTIVITY_V16_START')) {
  throw new Error('Safe Cracker click cues require dial activity retention v16.');
}

// Replace the previous click layer instead of stacking another override on top.
client = client.replace(
  /\n?\s*\/\/ SAFE_CRACKER_CLICK_CUES_V14_START[\s\S]*?\/\/ SAFE_CRACKER_CLICK_CUES_V14_END\s*/g,
  '\n'
);

if (!client.includes(start)) {
  const patch = String.raw`
  ${start}
  function safeCrackerClickNoiseBuffer(context) {
    if (runtime.safeCrackerClickNoiseBuffer?.sampleRate === context.sampleRate) {
      return runtime.safeCrackerClickNoiseBuffer;
    }
    const length = Math.max(96, Math.floor(context.sampleRate * 0.042));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      const envelope = Math.exp(-index / Math.max(1, context.sampleRate * 0.0054));
      const grit = (Math.random() * 2 - 1) * 0.66;
      const edge = index % 2 ? -0.34 : 0.34;
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
      Math.max(0.68, Math.min(1.5, Number(options.playbackRate) || 1)),
      startAt
    );
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(Math.max(70, Number(options.highpass) || 900), startAt);
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(Math.max(150, Number(options.frequency) || 2600), startAt);
    bandpass.Q.setValueAtTime(Math.max(0.2, Number(options.q) || 2.2), startAt);
    const noiseLevel = Math.max(0.002, Number(options.gain) || 0.16);
    noiseGain.gain.setValueAtTime(noiseLevel, startAt);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, finishAt);

    tone.type = options.toneType || 'triangle';
    const toneStart = Math.max(42, Number(options.toneFrequency) || 1450);
    const toneEnd = Math.max(40, Number(options.toneEnd) || 520);
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
    noiseSource.stop(finishAt + 0.014);
    tone.start(startAt);
    tone.stop(finishAt + 0.014);
    return true;
  }

  function safeCrackerPlayMetalDialClick(digit) {
    const step = Math.abs(Number(digit) || 0) % 6;
    const tooth = safeCrackerPlayClickTransient({
      duration: 0.027,
      gain: 0.22,
      highpass: 1420,
      frequency: 3380 + step * 72,
      q: 4.4,
      playbackRate: 0.96 + step * 0.018,
      toneFrequency: 2140 + step * 48,
      toneEnd: 860 + step * 14,
      toneGain: 0.062,
      toneType: 'square'
    });
    const ratchetBody = safeCrackerPlayClickTransient({
      delay: 0.009,
      duration: 0.052,
      gain: 0.12,
      highpass: 360,
      frequency: 1430 + step * 34,
      q: 1.9,
      playbackRate: 0.9 + step * 0.012,
      toneFrequency: 650 + step * 18,
      toneEnd: 265 + step * 8,
      toneGain: 0.047,
      toneType: 'triangle'
    });
    return Boolean(tooth || ratchetBody);
  }

  function safeCrackerPlayIncorrectRejectCue(tier) {
    const severity = tier === 'yellow' ? 0 : tier === 'orange' ? 1 : 2;
    const metalStop = safeCrackerPlayClickTransient({
      duration: 0.072,
      gain: 0.19 + severity * 0.014,
      highpass: 260,
      frequency: 1280 - severity * 90,
      q: 1.65,
      toneFrequency: 410 - severity * 34,
      toneEnd: 155 - severity * 12,
      toneGain: 0.098,
      toneType: 'square'
    });
    const lockKnock = safeCrackerPlayClickTransient({
      delay: 0.092,
      duration: 0.115,
      gain: 0.17 + severity * 0.016,
      highpass: 75,
      frequency: 520 - severity * 42,
      q: 0.85,
      toneFrequency: 205 - severity * 18,
      toneEnd: 72,
      toneGain: 0.11,
      toneType: 'sawtooth'
    });
    const rejectClack = safeCrackerPlayClickTransient({
      delay: 0.205,
      duration: 0.058,
      gain: 0.135 + severity * 0.012,
      highpass: 690,
      frequency: 1780 - severity * 65,
      q: 2.35,
      toneFrequency: 570 - severity * 30,
      toneEnd: 210 - severity * 10,
      toneGain: 0.058,
      toneType: 'square'
    });
    return Boolean(metalStop || lockKnock || rejectClack);
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
  safeCrackerPlayDetent = function safeCrackerPlayMetalRatchetDetent(digit) {
    const now = performance.now();
    if (now - Number(runtime.safeCrackerClickDetentAt || 0) < 27) return;
    runtime.safeCrackerClickDetentAt = now;
    const played = safeCrackerPlayMetalDialClick(digit);
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
      ? { gain: 0.25, playbackRate: 1.04, haptic: [10, 38, 12], lowpass: 5200 }
      : tier === 'orange'
        ? { gain: 0.3, playbackRate: 0.96, haptic: [12, 42, 14], lowpass: 4400 }
        : { gain: 0.36, playbackRate: 0.88, haptic: [14, 48, 16], lowpass: 3700 };
    const cuePlayed = safeCrackerPlayIncorrectRejectCue(tier);
    const recordedPlayed = safeCrackerPlayRecordedSound('incorrect', {
      gain: settings.gain,
      playbackRate: settings.playbackRate,
      highpass: 48,
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
  'function safeCrackerPlayMetalDialClick(digit)',
  'function safeCrackerPlayIncorrectRejectCue(tier)',
  'function safeCrackerPlayCorrectNumberCue()',
  'function safeCrackerPlayMetalRatchetDetent(digit)',
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
if ((client.match(/SAFE_CRACKER_CLICK_CUES_V15_START/g) || []).length !== 1) {
  throw new Error('Safe Cracker click-cue marker must appear exactly once.');
}
if (client.includes('// SAFE_CRACKER_CLICK_CUES_V14_START')) {
  throw new Error('The previous Safe Cracker click-cue layer was not removed.');
}
await writeFile(clientUrl, client);

let html = await readFile(indexUrl, 'utf8');
html = html.replace(/\/assets\/safe-cracker\/safe-cracker\.js\?[^"'\s]*/g, value => {
  const clean = value.replace(/&clicks=\d+/g, '');
  return `${clean}&clicks=15`;
});
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker click cues v15: a layered metallic dial ratchet and an unmistakable incorrect-number reject clack.');
