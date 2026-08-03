import { readFile, writeFile } from 'node:fs/promises';

const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const start = '// SAFE_CRACKER_CLICK_CUES_V16_START';
const end = '// SAFE_CRACKER_CLICK_CUES_V16_END';

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
    const length = Math.max(128, Math.floor(context.sampleRate * 0.05));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      const fast = Math.exp(-index / Math.max(1, context.sampleRate * 0.0026));
      const tail = Math.exp(-index / Math.max(1, context.sampleRate * 0.012));
      const impulse = index < 3 ? (index === 0 ? 1 : -0.65) : 0;
      const grit = (Math.random() * 2 - 1) * (0.58 * fast + 0.14 * tail);
      data[index] = Math.max(-1, Math.min(1, impulse + grit));
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

  function safeCrackerPlayDryMetalImpact(options = {}) {
    const context = resumeAudio();
    if (!context || document.hidden) return false;
    const delay = Math.max(0, Number(options.delay) || 0);
    const duration = Math.max(0.014, Number(options.duration) || 0.032);
    const startAt = context.currentTime + delay;
    const finishAt = startAt + duration;
    const source = context.createBufferSource();
    const highpass = context.createBiquadFilter();
    const primary = context.createBiquadFilter();
    const secondary = context.createBiquadFilter();
    const primaryGain = context.createGain();
    const secondaryGain = context.createGain();

    source.buffer = safeCrackerClickNoiseBuffer(context);
    source.playbackRate.setValueAtTime(
      Math.max(0.82, Math.min(1.28, Number(options.playbackRate) || 1)),
      startAt
    );
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(Math.max(120, Number(options.highpass) || 700), startAt);
    primary.type = 'bandpass';
    primary.frequency.setValueAtTime(Math.max(260, Number(options.frequency) || 3300), startAt);
    primary.Q.setValueAtTime(Math.max(0.6, Number(options.q) || 6.2), startAt);
    secondary.type = 'bandpass';
    secondary.frequency.setValueAtTime(Math.max(300, Number(options.secondaryFrequency) || 5100), startAt);
    secondary.Q.setValueAtTime(Math.max(0.6, Number(options.secondaryQ) || 8), startAt);

    const gainLevel = Math.max(0.002, Number(options.gain) || 0.19);
    const secondaryLevel = Math.max(0.001, Number(options.secondaryGain) || gainLevel * 0.44);
    primaryGain.gain.setValueAtTime(gainLevel, startAt);
    primaryGain.gain.exponentialRampToValueAtTime(0.0001, finishAt);
    secondaryGain.gain.setValueAtTime(secondaryLevel, startAt);
    secondaryGain.gain.exponentialRampToValueAtTime(0.0001, finishAt * 0 + startAt + duration * 0.72);

    source.connect(highpass);
    highpass.connect(primary);
    highpass.connect(secondary);
    primary.connect(primaryGain);
    secondary.connect(secondaryGain);
    primaryGain.connect(safeCrackerAudioBus(context));
    secondaryGain.connect(safeCrackerAudioBus(context));
    source.start(startAt);
    source.stop(finishAt + 0.014);
    return true;
  }

  function safeCrackerPlayMetalDialClick(digit) {
    const step = Math.abs(Number(digit) || 0) % 5;
    const tooth = safeCrackerPlayDryMetalImpact({
      duration: 0.026,
      gain: 0.24,
      highpass: 980,
      frequency: 3400 + step * 42,
      q: 7.4,
      secondaryFrequency: 5850 + step * 48,
      secondaryQ: 9.2,
      secondaryGain: 0.105,
      playbackRate: 0.97 + step * 0.009
    });
    const catchClick = safeCrackerPlayDryMetalImpact({
      delay: 0.018,
      duration: 0.034,
      gain: 0.115,
      highpass: 360,
      frequency: 1320 + step * 26,
      q: 3.8,
      secondaryFrequency: 2360 + step * 31,
      secondaryQ: 5.2,
      secondaryGain: 0.052,
      playbackRate: 0.93 + step * 0.008
    });
    return Boolean(tooth || catchClick);
  }

  function safeCrackerPlayIncorrectRejectCue(tier) {
    const severity = tier === 'yellow' ? 0 : tier === 'orange' ? 1 : 2;
    const metalStop = safeCrackerPlayDryMetalImpact({
      duration: 0.052,
      gain: 0.22 + severity * 0.018,
      highpass: 480,
      frequency: 1760 - severity * 120,
      q: 4.6,
      secondaryFrequency: 3120 - severity * 135,
      secondaryQ: 6.2,
      secondaryGain: 0.085
    });
    const internalKnock = safeCrackerPlayClickTransient({
      delay: 0.09,
      duration: 0.12,
      gain: 0.18 + severity * 0.016,
      highpass: 75,
      frequency: 520 - severity * 55,
      q: 0.82,
      toneFrequency: 195 - severity * 18,
      toneEnd: 76,
      toneGain: 0.105,
      toneType: 'square'
    });
    const rejectClack = safeCrackerPlayDryMetalImpact({
      delay: 0.205,
      duration: 0.058,
      gain: 0.16 + severity * 0.016,
      highpass: 260,
      frequency: 980 - severity * 70,
      q: 3.2,
      secondaryFrequency: 1880 - severity * 90,
      secondaryQ: 4.6,
      secondaryGain: 0.064
    });
    return Boolean(metalStop || internalKnock || rejectClack);
  }

  function safeCrackerPlayCorrectNumberCue() {
    const latchStrike = safeCrackerPlayDryMetalImpact({
      duration: 0.074,
      gain: 0.31,
      highpass: 430,
      frequency: 2180,
      q: 5.8,
      secondaryFrequency: 4460,
      secondaryQ: 8.4,
      secondaryGain: 0.15
    });
    const boltRelease = safeCrackerPlayDryMetalImpact({
      delay: 0.105,
      duration: 0.095,
      gain: 0.22,
      highpass: 180,
      frequency: 910,
      q: 3.1,
      secondaryFrequency: 1720,
      secondaryQ: 4.5,
      secondaryGain: 0.09
    });
    const recordedLatch = safeCrackerPlayRecordedSound('latchOpen', {
      delay: 0.025,
      gain: 0.56,
      playbackRate: 0.98,
      highpass: 48,
      lowpass: 9800
    });
    return Boolean(latchStrike || boltRelease || recordedLatch);
  }

  function safeCrackerPlayAuthoritativeCorrectCue(game, completedStage) {
    const gameId = String(game?.gameId || runtime.game?.gameId || '');
    const stage = Math.max(1, Math.min(3, Number(completedStage) || Number(game?.safecrackerState?.me?.stage || 0)));
    const key = `${gameId}:${stage}`;
    if (!gameId || runtime.safeCrackerCorrectCueKey === key) return false;
    runtime.safeCrackerCorrectCueKey = key;
    const played = safeCrackerPlayCorrectNumberCue();
    if (played) safeCrackerHaptic([18, 32, 28]);
    return played;
  }

  const safeCrackerClickDetentFallback = safeCrackerPlayDetent;
  safeCrackerPlayDetent = function safeCrackerPlayDryRatchetDetent(digit) {
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
    const stage = Number(runtime.game?.safecrackerState?.me?.stage || 0);
    const played = safeCrackerPlayAuthoritativeCorrectCue(runtime.game, stage);
    if (!played && !runtime.safeCrackerCorrectCueKey) safeCrackerClickTumblerFallback();
  };

  const safeCrackerClickFeedbackFallback = safeCrackerPlayFeedback;
  safeCrackerPlayFeedback = function safeCrackerPlayWrongOrCorrectNumberSound(tier) {
    if (tier === 'green') {
      safeCrackerPlayTumblerLock();
      return;
    }
    const settings = tier === 'yellow'
      ? { gain: 0.23, playbackRate: 1.05, haptic: [10, 40, 12], lowpass: 5700 }
      : tier === 'orange'
        ? { gain: 0.29, playbackRate: 0.97, haptic: [12, 46, 14], lowpass: 4800 }
        : { gain: 0.35, playbackRate: 0.88, haptic: [14, 52, 16], lowpass: 4000 };
    const cuePlayed = safeCrackerPlayIncorrectRejectCue(tier);
    const recordedPlayed = safeCrackerPlayRecordedSound('incorrect', {
      gain: settings.gain,
      playbackRate: settings.playbackRate,
      highpass: 42,
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

const originalSubmitFeedback = `      const nextGame = data?.game || runtime.game;
      const result = nextGame?.safecrackerState?.me?.lastResult;
      if (result?.at && result.at !== myState(game)?.lastResult?.at) playFeedback(result.tier);`;
const authoritativeSubmitFeedback = `      const previousStage = Number(myState(game)?.stage || 0);
      const nextGame = data?.game || runtime.game;
      const nextStage = Number(nextGame?.safecrackerState?.me?.stage || 0);
      const result = nextGame?.safecrackerState?.me?.lastResult;
      if (nextStage > previousStage) safeCrackerPlayAuthoritativeCorrectCue(nextGame, nextStage);
      else if (result?.at && result.at !== myState(game)?.lastResult?.at) playFeedback(result.tier);`;
if (client.includes(originalSubmitFeedback)) {
  client = client.replace(originalSubmitFeedback, authoritativeSubmitFeedback);
} else if (!client.includes(authoritativeSubmitFeedback)) {
  throw new Error('Safe Cracker click-cue patch could not attach the correct sound to authoritative stage progress.');
}

const required = [
  start,
  'function safeCrackerClickNoiseBuffer(context)',
  'function safeCrackerPlayClickTransient(options = {})',
  'function safeCrackerPlayDryMetalImpact(options = {})',
  'function safeCrackerPlayMetalDialClick(digit)',
  'function safeCrackerPlayIncorrectRejectCue(tier)',
  'function safeCrackerPlayCorrectNumberCue()',
  'function safeCrackerPlayAuthoritativeCorrectCue(game, completedStage)',
  'function safeCrackerPlayDryRatchetDetent(digit)',
  'function safeCrackerPlayCorrectNumberSound()',
  'function safeCrackerPlayWrongOrCorrectNumberSound(tier)',
  'if (nextStage > previousStage) safeCrackerPlayAuthoritativeCorrectCue(nextGame, nextStage);',
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
if ((client.match(/SAFE_CRACKER_CLICK_CUES_V16_START/g) || []).length !== 1) {
  throw new Error('Safe Cracker click-cue marker must appear exactly once.');
}
await writeFile(clientUrl, client);

let html = await readFile(indexUrl, 'utf8');
html = html.replace(/\/assets\/safe-cracker\/safe-cracker\.js\?[^"'\s]*/g, value => {
  const clean = value.replace(/&clicks=\d+/g, '');
  return `${clean}&clicks=16`;
});
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker click cues v16: dry non-musical dial ratchets and an authoritative correct-number latch cue.');
