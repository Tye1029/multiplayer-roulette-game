import { readFile, writeFile } from 'node:fs/promises';

const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const audioStart = '// SAFE_CRACKER_AUDIO_PASS_V10_START';
const audioEnd = '// SAFE_CRACKER_AUDIO_PASS_V10_END';

let client = await readFile(clientUrl, 'utf8');

if (!client.includes(audioStart)) {
  const audioPass = String.raw`
  ${audioStart}
  function safeCrackerAudioBus(context) {
    if (runtime.safeCrackerAudioBus?.context === context) return runtime.safeCrackerAudioBus.input;
    const input = context.createGain();
    const compressor = context.createDynamicsCompressor();
    input.gain.value = 0.72;
    compressor.threshold.value = -20;
    compressor.knee.value = 18;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.18;
    input.connect(compressor);
    compressor.connect(context.destination);
    runtime.safeCrackerAudioBus = { context, input, compressor };
    return input;
  }

  function safeCrackerNoiseBuffer(context) {
    if (runtime.safeCrackerNoiseBuffer?.sampleRate === context.sampleRate) return runtime.safeCrackerNoiseBuffer;
    const length = Math.max(1, Math.floor(context.sampleRate * 0.5));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = Math.random() * 2 - 1;
    runtime.safeCrackerNoiseBuffer = buffer;
    return buffer;
  }

  function safeCrackerPlayTone(frequency, duration, gainValue, type = 'triangle', delay = 0, options = {}) {
    const context = resumeAudio();
    if (!context || document.hidden) return;
    const startAt = context.currentTime + Math.max(0, Number(delay) || 0);
    const length = Math.max(0.025, Number(duration) || 0.05);
    const attack = Math.min(length * 0.45, Math.max(0.002, Number(options.attack) || 0.005));
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(40, Number(frequency) || 40), startAt);
    if (Number.isFinite(options.endFrequency)) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, options.endFrequency), startAt + length);
    }
    if (Number.isFinite(options.detune)) oscillator.detune.setValueAtTime(options.detune, startAt);
    filter.type = options.filterType || 'lowpass';
    filter.frequency.setValueAtTime(Math.max(80, Number(options.filterFrequency) || 6400), startAt);
    filter.Q.setValueAtTime(Math.max(0.0001, Number(options.q) || 0.7), startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, Number(gainValue) || 0.0002), startAt + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + length);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(safeCrackerAudioBus(context));
    oscillator.start(startAt);
    oscillator.stop(startAt + length + 0.04);
  }

  function safeCrackerPlayNoise(duration, gainValue, delay = 0, options = {}) {
    const context = resumeAudio();
    if (!context || document.hidden) return;
    const startAt = context.currentTime + Math.max(0, Number(delay) || 0);
    const length = Math.max(0.012, Number(duration) || 0.03);
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = safeCrackerNoiseBuffer(context);
    filter.type = options.filterType || 'bandpass';
    filter.frequency.setValueAtTime(Math.max(80, Number(options.frequency) || 1800), startAt);
    if (Number.isFinite(options.endFrequency)) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(80, options.endFrequency), startAt + length);
    }
    filter.Q.setValueAtTime(Math.max(0.0001, Number(options.q) || 1.1), startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, Number(gainValue) || 0.0002), startAt + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + length);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(safeCrackerAudioBus(context));
    source.start(startAt);
    source.stop(startAt + length + 0.02);
  }

  function safeCrackerHaptic(pattern) {
    if (document.hidden || typeof navigator.vibrate !== 'function') return;
    const now = performance.now();
    if (now - Number(runtime.safeCrackerLastHapticAt || 0) < 28) return;
    runtime.safeCrackerLastHapticAt = now;
    try { navigator.vibrate(pattern); } catch {}
  }

  function safeCrackerPlayMetalTick(pitch = 240, strength = 1, delay = 0) {
    const amount = Math.max(0.25, Math.min(1.25, Number(strength) || 1));
    safeCrackerPlayNoise(0.024, 0.012 * amount, delay, { frequency: 1350 + pitch * 2.2, q: 1.4 });
    safeCrackerPlayTone(pitch, 0.038, 0.021 * amount, 'square', delay, {
      endFrequency: Math.max(70, pitch * 0.72),
      filterFrequency: 2400 + pitch * 2,
      q: 1.8
    });
    safeCrackerPlayTone(pitch * 2.36, 0.052, 0.007 * amount, 'triangle', delay + 0.004, {
      endFrequency: pitch * 1.84,
      filterFrequency: 5200,
      q: 2.2
    });
  }

  function safeCrackerPlayDetent(digit) {
    const weight = knownClickWeight(digit);
    const pitch = 188 + Number(digit || 0) * 3 + weight * 58;
    safeCrackerPlayMetalTick(pitch, 0.72 + weight * 0.32);
    if (weight > 0.54) {
      safeCrackerPlayTone(480 + weight * 210, 0.048, 0.004 + weight * 0.009, 'sine', 0.008, {
        endFrequency: 430 + weight * 180,
        filterFrequency: 3600
      });
    }
    safeCrackerHaptic(weight > 0.9 ? 9 : weight > 0.64 ? 6 : 3);
  }

  function safeCrackerPlaySubmit() {
    safeCrackerPlayNoise(0.035, 0.016, 0, { frequency: 1650, q: 0.9 });
    safeCrackerPlayTone(146, 0.075, 0.034, 'square', 0, { endFrequency: 104, filterFrequency: 2100, q: 1.2 });
    safeCrackerPlayTone(310, 0.055, 0.012, 'triangle', 0.018, { endFrequency: 248, filterFrequency: 3400 });
    safeCrackerHaptic(9);
  }

  function safeCrackerPlayTumblerLock() {
    safeCrackerPlayMetalTick(218, 1.08, 0);
    safeCrackerPlayNoise(0.11, 0.018, 0.045, { frequency: 780, endFrequency: 410, q: 0.65 });
    safeCrackerPlayTone(112, 0.14, 0.041, 'square', 0.052, { endFrequency: 78, filterFrequency: 1250, q: 1.1 });
    safeCrackerPlayMetalTick(286, 0.86, 0.15);
    safeCrackerPlayTone(440, 0.16, 0.018, 'sine', 0.19, { endFrequency: 522, filterFrequency: 4200 });
    safeCrackerHaptic([13, 24, 22]);
  }

  function safeCrackerPlayFeedback(tier) {
    if (tier === 'green') {
      safeCrackerPlayTumblerLock();
      return;
    }
    if (tier === 'yellow') {
      safeCrackerPlayMetalTick(334, 0.85, 0);
      safeCrackerPlayMetalTick(402, 0.7, 0.075);
      safeCrackerPlayTone(610, 0.12, 0.018, 'sine', 0.11, { endFrequency: 684, filterFrequency: 4600 });
      safeCrackerHaptic([7, 28, 10]);
      return;
    }
    if (tier === 'orange') {
      safeCrackerPlayMetalTick(248, 0.7, 0);
      safeCrackerPlayTone(292, 0.095, 0.017, 'triangle', 0.065, { endFrequency: 244, filterFrequency: 2600 });
      safeCrackerHaptic(7);
      return;
    }
    safeCrackerPlayNoise(0.07, 0.014, 0, { frequency: 540, q: 0.72 });
    safeCrackerPlayTone(112, 0.16, 0.035, 'square', 0, { endFrequency: 76, filterFrequency: 980, q: 0.8 });
    safeCrackerHaptic(5);
  }

  function safeCrackerPlayButton(kind = 'secondary') {
    if (kind === 'primary') {
      safeCrackerPlayMetalTick(274, 0.76, 0);
      safeCrackerPlayTone(392, 0.07, 0.01, 'triangle', 0.025, { endFrequency: 438, filterFrequency: 3600 });
      safeCrackerHaptic(7);
      return;
    }
    safeCrackerPlayMetalTick(212, 0.52, 0);
    safeCrackerHaptic(4);
  }

  function safeCrackerPlayCountdownLabel(label) {
    const normalized = String(label || '').trim().toUpperCase();
    const gameId = String(runtime.game?.gameId || '');
    if (!gameId || !normalized) return;
    const key = gameId + ':' + normalized;
    if (runtime.safeCrackerCountdownAudioKey === key) return;
    runtime.safeCrackerCountdownAudioKey = key;
    const number = Number(normalized);
    if (Number.isFinite(number) && number >= 1 && number <= 3) {
      const pitch = 154 + (3 - number) * 34;
      safeCrackerPlayMetalTick(pitch, 0.72, 0);
      safeCrackerPlayTone(72, 0.11, 0.018, 'sine', 0, { endFrequency: 58, filterFrequency: 520 });
      safeCrackerHaptic(number === 1 ? 10 : 6);
      return;
    }
    if (normalized.includes('CRACK') || normalized.includes('GO') || normalized.includes('START')) {
      safeCrackerPlayNoise(0.05, 0.017, 0, { frequency: 1900, q: 1.1 });
      safeCrackerPlayTone(126, 0.12, 0.035, 'square', 0, { endFrequency: 176, filterFrequency: 1900 });
      safeCrackerPlayTone(420, 0.13, 0.018, 'triangle', 0.055, { endFrequency: 560, filterFrequency: 4400 });
      safeCrackerHaptic([9, 26, 13]);
    }
  }

  function safeCrackerScanCountdown() {
    const value = document.querySelector('[data-sc-countdown-value]');
    if (!value) return;
    safeCrackerPlayCountdownLabel(value.textContent);
  }

  function safeCrackerUpdateUrgency() {
    const game = runtime.game;
    if (!game || game.status !== 'playing') {
      runtime.safeCrackerUrgencyKey = '';
      return;
    }
    const seconds = secondsLeft(game);
    if (seconds > 10 || seconds <= 0) {
      if (seconds > 10) runtime.safeCrackerUrgencyKey = '';
      return;
    }
    const key = String(game.gameId || '') + ':' + seconds;
    if (runtime.safeCrackerUrgencyKey === key) return;
    runtime.safeCrackerUrgencyKey = key;
    const urgent = seconds <= 5;
    safeCrackerPlayTone(urgent ? 184 + (5 - seconds) * 18 : 132, 0.045, urgent ? 0.018 : 0.011, 'square', 0, {
      endFrequency: urgent ? 152 + (5 - seconds) * 15 : 108,
      filterFrequency: urgent ? 2200 : 1350,
      q: 1.15
    });
    safeCrackerPlayNoise(0.018, urgent ? 0.008 : 0.0045, 0, { frequency: urgent ? 2100 : 1200, q: 1.3 });
    if (seconds <= 3) {
      safeCrackerPlayTone(urgent ? 268 : 210, 0.032, 0.009, 'triangle', 0.07, { endFrequency: 232, filterFrequency: 2900 });
      safeCrackerHaptic(seconds === 1 ? 11 : 6);
    }
  }

  function safeCrackerPlaySafeOpen() {
    safeCrackerPlayMetalTick(168, 1.08, 0.025);
    safeCrackerPlayMetalTick(196, 1.04, 0.15);
    safeCrackerPlayNoise(0.34, 0.025, 0.24, { frequency: 980, endFrequency: 320, q: 0.55 });
    safeCrackerPlayTone(84, 0.38, 0.047, 'sawtooth', 0.26, { endFrequency: 54, filterFrequency: 880, q: 0.72 });
    safeCrackerPlayNoise(0.16, 0.024, 0.61, { frequency: 410, q: 0.65 });
    safeCrackerPlayTone(62, 0.22, 0.052, 'square', 0.63, { endFrequency: 46, filterFrequency: 620, q: 0.7 });
    safeCrackerPlayTone(286, 0.42, 0.018, 'triangle', 0.72, { endFrequency: 392, filterFrequency: 3200 });
    safeCrackerPlayTone(568, 0.48, 0.014, 'sine', 0.82, { endFrequency: 710, filterFrequency: 5200 });
  }

  function safeCrackerPlayResult(won, tied) {
    const gameId = String(runtime.game?.gameId || '');
    const key = gameId + ':' + (won ? 'win' : tied ? 'tie' : 'lose');
    if (!gameId || runtime.resultSoundKey === key) return;
    runtime.resultSoundKey = key;
    if (won) {
      safeCrackerPlayTone(196, 0.18, 0.032, 'triangle', 0, { endFrequency: 220, filterFrequency: 3000 });
      safeCrackerPlayTone(294, 0.22, 0.028, 'triangle', 0.08, { endFrequency: 330, filterFrequency: 3400 });
      safeCrackerPlayTone(440, 0.28, 0.026, 'sine', 0.17, { endFrequency: 494, filterFrequency: 4600 });
      safeCrackerPlayTone(659, 0.42, 0.022, 'sine', 0.27, { endFrequency: 784, filterFrequency: 6000 });
      return;
    }
    if (tied) {
      safeCrackerPlayMetalTick(174, 0.62, 0);
      safeCrackerPlayTone(220, 0.18, 0.024, 'triangle', 0.06, { endFrequency: 196, filterFrequency: 2300 });
      safeCrackerPlayTone(174, 0.22, 0.021, 'triangle', 0.24, { endFrequency: 154, filterFrequency: 1900 });
      return;
    }
    safeCrackerPlayNoise(0.1, 0.015, 0, { frequency: 460, q: 0.7 });
    safeCrackerPlayTone(146, 0.18, 0.032, 'sawtooth', 0, { endFrequency: 104, filterFrequency: 1200 });
    safeCrackerPlayTone(82, 0.42, 0.043, 'square', 0.12, { endFrequency: 48, filterFrequency: 720, q: 0.65 });
  }

  function safeCrackerPlayResultSequence(game, won, tied) {
    const gameId = String(game?.gameId || '');
    const key = gameId + ':' + (won ? 'win' : tied ? 'tie' : 'lose');
    if (!gameId || runtime.resultSequenceAudioKey === key) return;
    runtime.resultSequenceAudioKey = key;
    if (won) {
      safeCrackerPlaySafeOpen();
      safeCrackerHaptic([14, 28, 14, 54, 28]);
      window.setTimeout(() => playResult(true, false), 820);
      return;
    }
    if (tied) {
      safeCrackerPlayMetalTick(154, 0.82, 0.04);
      safeCrackerPlayMetalTick(142, 0.72, 0.2);
      safeCrackerPlayTone(104, 0.26, 0.028, 'square', 0.28, { endFrequency: 72, filterFrequency: 980 });
      safeCrackerHaptic([9, 34, 9]);
      window.setTimeout(() => playResult(false, true), 310);
      return;
    }
    safeCrackerPlayNoise(0.25, 0.016, 0.04, { frequency: 620, endFrequency: 260, q: 0.55 });
    safeCrackerPlayTone(72, 0.3, 0.035, 'square', 0.08, { endFrequency: 49, filterFrequency: 650 });
    safeCrackerPlayMetalTick(126, 0.64, 0.31);
    safeCrackerHaptic([16, 30, 12]);
    window.setTimeout(() => playResult(false, false), 380);
  }

  const safeCrackerSubmitGuessWithAudio = submitGuess;
  submitGuess = async function safeCrackerSubmitGuessAudioWrapper(game) {
    const activeGame = runtime.game || game;
    const state = stateFor(activeGame);
    const canSubmit = typeof safeCrackerCanSubmit === 'function'
      ? safeCrackerCanSubmit(activeGame)
      : Boolean(activeGame?.status === 'playing' && state?.canSubmit && !runtime.busy);
    if (!canSubmit) return safeCrackerSubmitGuessWithAudio(game);
    safeCrackerPlaySubmit();
    const result = await safeCrackerSubmitGuessWithAudio(game);
    window.requestAnimationFrame(() => {
      const display = document.querySelector('[data-sc-display]');
      const text = String(display?.querySelector('span')?.textContent || '').trim().toUpperCase();
      const normalRed = text === 'TOO FAR AWAY';
      if (display?.classList.contains('red') && text && !normalRed) {
        safeCrackerPlayNoise(0.055, 0.012, 0, { frequency: 720, q: 0.8 });
        safeCrackerPlayTone(96, 0.16, 0.028, 'square', 0, { endFrequency: 62, filterFrequency: 820 });
        safeCrackerHaptic([8, 26, 8]);
      }
    });
    return result;
  };

  const safeCrackerTimerWithAudio = updateTimerOnly;
  updateTimerOnly = function safeCrackerTimerAudioWrapper() {
    const result = safeCrackerTimerWithAudio();
    safeCrackerUpdateUrgency();
    return result;
  };

  playTone = safeCrackerPlayTone;
  playDetent = safeCrackerPlayDetent;
  playFeedback = safeCrackerPlayFeedback;
  playResult = safeCrackerPlayResult;
  if (typeof playSafeCrackerResultSequence === 'function') playSafeCrackerResultSequence = safeCrackerPlayResultSequence;

  document.addEventListener('click', event => {
    const button = event.target?.closest?.('button');
    if (!button || button.disabled || button.matches('[data-sc-step], [data-sc-confirm]')) return;
    const safeScope = button.closest('[data-safe-cracker-mount], [data-sc-result-portal], .sth-game[data-mode="safecracker"], [data-sc-start-countdown]');
    if (!safeScope) return;
    safeCrackerPlayButton(button.matches('.gold, [data-sc-rematch], [data-sc-new-game]') ? 'primary' : 'secondary');
  }, true);

  const safeCrackerCountdownObserver = new MutationObserver(() => {
    if (runtime.safeCrackerCountdownScanQueued) return;
    runtime.safeCrackerCountdownScanQueued = true;
    window.requestAnimationFrame(() => {
      runtime.safeCrackerCountdownScanQueued = false;
      safeCrackerScanCountdown();
    });
  });
  safeCrackerCountdownObserver.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  window.addEventListener(STATE_EVENT, event => {
    const game = event?.detail?.game;
    if (!game || game.mode !== 'safecracker') return;
    if (game.status !== 'countdown') runtime.safeCrackerCountdownAudioKey = '';
    window.requestAnimationFrame(safeCrackerScanCountdown);
  });
  ${audioEnd}
`;

  const closing = '\n})();';
  const closingIndex = client.lastIndexOf(closing);
  if (closingIndex < 0) throw new Error('Safe Cracker audio patch could not find the runtime closure.');
  client = client.slice(0, closingIndex) + audioPass + client.slice(closingIndex);
}

const audioRequirements = [
  ['audio pass marker', audioStart],
  ['dial detents', 'function safeCrackerPlayDetent(digit)'],
  ['number submission', 'function safeCrackerPlaySubmit()'],
  ['proximity feedback', 'function safeCrackerPlayFeedback(tier)'],
  ['tumbler lock', 'function safeCrackerPlayTumblerLock()'],
  ['countdown', 'function safeCrackerScanCountdown()'],
  ['timer urgency', 'function safeCrackerUpdateUrgency()'],
  ['safe opening', 'function safeCrackerPlaySafeOpen()'],
  ['win loss and tie', 'function safeCrackerPlayResult(won, tied)'],
  ['buttons', "document.addEventListener('click', event => {"],
  ['haptics', 'function safeCrackerHaptic(pattern)']
];
for (const [label, signature] of audioRequirements) {
  if (!client.includes(signature)) throw new Error(`Safe Cracker audio validation failed for ${label}.`);
}
if (!client.includes('choice: `safecracker:guess:${runtime.selected}`')) {
  throw new Error('Safe Cracker audio patch disturbed authoritative guess submission.');
}
if (client.split(audioStart).length - 1 !== 1 || client.split(audioEnd).length - 1 !== 1) {
  throw new Error('Safe Cracker audio patch marker must appear exactly once.');
}
await writeFile(clientUrl, client);

let html = await readFile(indexUrl, 'utf8');
html = html.replaceAll(
  '/assets/safe-cracker/safe-cracker.js?v=8&polish=2&fit=2&result=1&final=1&refine=1&correct=1&input=1',
  '/assets/safe-cracker/safe-cracker.js?v=8&polish=2&fit=2&result=1&final=1&refine=1&correct=1&input=1&audio=1'
);
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker audio pass v10: mechanical detents, submission, proximity, tumbler, countdown, urgency, vault, results, buttons, and haptics.');
