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
      const fast = Math.exp(-index / Math.max(1, context.sampleRate * 0.0024));
      const tail = Math.exp(-index / Math.max(1, context.sampleRate * 0.011));
      const impulse = index === 0 ? 0.95 : index === 1 ? -0.72 : index === 2 ? 0.38 : 0;
      const grit = (Math.random() * 2 - 1) * (0.62 * fast + 0.12 * tail);
      data[index] = Math.max(-1, Math.min(1, impulse + grit));
    }
    runtime.safeCrackerClickNoiseBuffer = buffer;
    return buffer;
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
    highpass.frequency.setValueAtTime(Math.max(100, Number(options.highpass) || 700), startAt);
    primary.type = 'bandpass';
    primary.frequency.setValueAtTime(Math.max(240, Number(options.frequency) || 3300), startAt);
    primary.Q.setValueAtTime(Math.max(0.6, Number(options.q) || 6.2), startAt);
    secondary.type = 'bandpass';
    secondary.frequency.setValueAtTime(Math.max(280, Number(options.secondaryFrequency) || 5100), startAt);
    secondary.Q.setValueAtTime(Math.max(0.6, Number(options.secondaryQ) || 8), startAt);

    const gainLevel = Math.max(0.002, Number(options.gain) || 0.19);
    const secondaryLevel = Math.max(0.001, Number(options.secondaryGain) || gainLevel * 0.42);
    primaryGain.gain.setValueAtTime(gainLevel, startAt);
    primaryGain.gain.exponentialRampToValueAtTime(0.0001, finishAt);
    secondaryGain.gain.setValueAtTime(secondaryLevel, startAt);
    secondaryGain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration * 0.72);

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
      duration: 0.024,
      gain: 0.255,
      highpass: 1050,
      frequency: 3520 + step * 38,
      q: 8.1,
      secondaryFrequency: 6120 + step * 44,
      secondaryQ: 10.2,
      secondaryGain: 0.112,
      playbackRate: 0.98 + step * 0.008
    });
    const catchClick = safeCrackerPlayDryMetalImpact({
      delay: 0.017,
      duration: 0.031,
      gain: 0.125,
      highpass: 410,
      frequency: 1380 + step * 24,
      q: 4.1,
      secondaryFrequency: 2480 + step * 28,
      secondaryQ: 5.6,
      secondaryGain: 0.057,
      playbackRate: 0.94 + step * 0.007
    });
    return Boolean(tooth || catchClick);
  }

  function safeCrackerPlayIncorrectRejectCue(tier) {
    const severity = tier === 'yellow' ? 0 : tier === 'orange' ? 1 : 2;
    const stop = safeCrackerPlayDryMetalImpact({
      duration: 0.052,
      gain: 0.245 + severity * 0.018,
      highpass: 450,
      frequency: 1680 - severity * 105,
      q: 4.5,
      secondaryFrequency: 3010 - severity * 120,
      secondaryQ: 6.1,
      secondaryGain: 0.096
    });
    const knock = safeCrackerPlayDryMetalImpact({
      delay: 0.095,
      duration: 0.085,
      gain: 0.225 + severity * 0.016,
      highpass: 115,
      frequency: 620 - severity * 48,
      q: 2.2,
      secondaryFrequency: 1120 - severity * 62,
      secondaryQ: 3.2,
      secondaryGain: 0.088
    });
    const reject = safeCrackerPlayDryMetalImpact({
      delay: 0.205,
      duration: 0.061,
      gain: 0.19 + severity * 0.014,
      highpass: 260,
      frequency: 940 - severity * 64,
      q: 3.3,
      secondaryFrequency: 1840 - severity * 82,
      secondaryQ: 4.7,
      secondaryGain: 0.071
    });
    return Boolean(stop || knock || reject);
  }

  function safeCrackerPlayCorrectNumberCue() {
    const latchStrike = safeCrackerPlayDryMetalImpact({
      duration: 0.074,
      gain: 0.34,
      highpass: 420,
      frequency: 2140,
      q: 5.9,
      secondaryFrequency: 4520,
      secondaryQ: 8.6,
      secondaryGain: 0.165
    });
    const boltRelease = safeCrackerPlayDryMetalImpact({
      delay: 0.108,
      duration: 0.102,
      gain: 0.245,
      highpass: 165,
      frequency: 880,
      q: 3.1,
      secondaryFrequency: 1690,
      secondaryQ: 4.4,
      secondaryGain: 0.102
    });
    const recordedLatch = safeCrackerPlayRecordedSound('latchOpen', {
      delay: 0.025,
      gain: 0.62,
      playbackRate: 0.97,
      highpass: 42,
      lowpass: 9800
    });
    return Boolean(latchStrike || boltRelease || recordedLatch);
  }

  function safeCrackerPlayAuthoritativeCorrectCue(game, completedStage) {
    const gameId = String(game?.gameId || runtime.game?.gameId || '');
    const stage = Math.max(1, Math.min(3, Number(completedStage) || Number(game?.safecrackerState?.me?.stage || 0)));
    const key = gameId + ':' + stage;
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
      ? { gain: 0.24, playbackRate: 1.04, haptic: [10, 40, 12], lowpass: 5700 }
      : tier === 'orange'
        ? { gain: 0.3, playbackRate: 0.96, haptic: [12, 46, 14], lowpass: 4800 }
        : { gain: 0.36, playbackRate: 0.87, haptic: [14, 52, 16], lowpass: 4000 };
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

  const safeCrackerAuthoritativeRenderFallback = render;
  render = function safeCrackerRenderWithAuthoritativeCorrectCue(game) {
    const previousGame = runtime.game;
    const sameGame = Boolean(previousGame?.gameId && String(previousGame.gameId) === String(game?.gameId || ''));
    const previousStage = sameGame ? Number(previousGame?.safecrackerState?.me?.stage || 0) : 0;
    const nextStage = Number(game?.safecrackerState?.me?.stage || 0);
    if (sameGame && nextStage > previousStage) {
      safeCrackerPlayAuthoritativeCorrectCue(game, nextStage);
    }
    return safeCrackerAuthoritativeRenderFallback(game);
  };
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
  'function safeCrackerPlayDryMetalImpact(options = {})',
  'function safeCrackerPlayMetalDialClick(digit)',
  'function safeCrackerPlayIncorrectRejectCue(tier)',
  'function safeCrackerPlayCorrectNumberCue()',
  'function safeCrackerPlayAuthoritativeCorrectCue(game, completedStage)',
  'function safeCrackerPlayDryRatchetDetent(digit)',
  'function safeCrackerPlayCorrectNumberSound()',
  'function safeCrackerPlayWrongOrCorrectNumberSound(tier)',
  'function safeCrackerRenderWithAuthoritativeCorrectCue(game)',
  'if (sameGame && nextStage > previousStage)',
  "safeCrackerPlayRecordedSound('incorrect'",
  "safeCrackerPlayRecordedSound('latchOpen'",
  'playDetent = safeCrackerPlayDetent;',
  'playFeedback = safeCrackerPlayFeedback;',
  '// SAFE_CRACKER_DIAL_ACTIVITY_V16_START',
  'choice: `safecracker:guess:${runtime.selected}`'
];
for (const fragment of required) {
  if (!client.includes(fragment)) throw new Error(`Recorded Safe Cracker click-cue patch is missing ${fragment}.`);
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

console.log('Applied Safe Cracker click cues v16: dry non-musical dial ratchets and an authoritative render-stage latch cue.');
