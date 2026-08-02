import { readFile, writeFile } from 'node:fs/promises';

const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const start = '// SAFE_CRACKER_RECORDED_SOUNDS_V13_START';
const end = '// SAFE_CRACKER_RECORDED_SOUNDS_V13_END';

let client = await readFile(clientUrl, 'utf8');
if (!client.includes('// SAFE_CRACKER_AUDIO_PASS_V10_START')) {
  throw new Error('Recorded Safe Cracker sounds require audio pass v10.');
}
if (!client.includes('// SAFE_CRACKER_DIAL_ACTIVITY_V16_START')) {
  throw new Error('Recorded Safe Cracker sounds require dial activity v16.');
}

if (!client.includes(start)) {
  const patch = String.raw`
  ${start}
  const SAFE_CRACKER_RECORDED_SOUNDS = Object.freeze({
    intro: '/assets/safe-cracker/audio-data-v13/intro.b64',
    dialA: '/assets/safe-cracker/audio-data-v13/dial-a.b64',
    dialB: '/assets/safe-cracker/audio-data-v13/dial-b.b64',
    submit: '/assets/safe-cracker/audio-data-v13/submit.b64',
    incorrect: '/assets/safe-cracker/audio-data-v13/incorrect.b64',
    latchOpen: '/assets/safe-cracker/audio-data-v13/latch-open.b64',
    safeOpen: '/assets/safe-cracker/audio-data-v13/safe-open.b64',
    ambience: '/assets/safe-cracker/audio-data-v13/ambience.b64'
  });

  function safeCrackerRecordedBytes(text) {
    const clean = String(text || '').replace(/\s+/g, '');
    const binary = window.atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes.buffer;
  }

  function safeCrackerLoadRecordedSound(name) {
    const url = SAFE_CRACKER_RECORDED_SOUNDS[name];
    const context = audioContext();
    if (!url || !context) return Promise.resolve(null);
    runtime.safeCrackerRecordedBuffers ||= Object.create(null);
    runtime.safeCrackerRecordedPromises ||= Object.create(null);
    if (runtime.safeCrackerRecordedBuffers[name]) return Promise.resolve(runtime.safeCrackerRecordedBuffers[name]);
    if (runtime.safeCrackerRecordedPromises[name]) return runtime.safeCrackerRecordedPromises[name];
    const promise = fetch(url + '?recorded=13', { cache: 'force-cache' })
      .then(response => {
        if (!response.ok) throw new Error('Recorded Safe Cracker sound request failed: ' + name);
        return response.text();
      })
      .then(text => context.decodeAudioData(safeCrackerRecordedBytes(text)))
      .then(buffer => {
        runtime.safeCrackerRecordedBuffers[name] = buffer;
        return buffer;
      })
      .catch(error => {
        console.warn('[Safe Cracker audio] Failed to load ' + name, error);
        return null;
      })
      .finally(() => { delete runtime.safeCrackerRecordedPromises[name]; });
    runtime.safeCrackerRecordedPromises[name] = promise;
    return promise;
  }

  function safeCrackerPrimeRecordedSounds() {
    for (const name of Object.keys(SAFE_CRACKER_RECORDED_SOUNDS)) safeCrackerLoadRecordedSound(name);
  }

  function safeCrackerUnlockRecordedAudio() {
    const context = resumeAudio();
    if (!context) return;
    try {
      const source = context.createBufferSource();
      source.buffer = context.createBuffer(1, 1, context.sampleRate || 44100);
      source.connect(context.destination);
      source.start(0);
    } catch {}
    safeCrackerPrimeRecordedSounds();
  }

  function safeCrackerPlayRecordedSound(name, options = {}) {
    const context = resumeAudio();
    const buffer = runtime.safeCrackerRecordedBuffers?.[name];
    if (!context || !buffer || document.hidden) {
      safeCrackerLoadRecordedSound(name);
      return false;
    }
    const delay = Math.max(0, Number(options.delay) || 0);
    const startAt = context.currentTime + delay;
    const playbackRate = Math.max(0.78, Math.min(1.24, Number(options.playbackRate) || 1));
    const targetGain = Math.max(0.0002, Number(options.gain) || 0.2);
    const source = context.createBufferSource();
    const highpass = context.createBiquadFilter();
    const lowpass = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    source.playbackRate.setValueAtTime(playbackRate, startAt);
    source.loop = Boolean(options.loop);
    if (source.loop && buffer.duration > 0.3) {
      source.loopStart = Math.min(0.04, buffer.duration * 0.05);
      source.loopEnd = Math.max(source.loopStart + 0.1, buffer.duration - Math.min(0.04, buffer.duration * 0.05));
    }
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(Math.max(20, Number(options.highpass) || 35), startAt);
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(Math.max(500, Number(options.lowpass) || 12000), startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(targetGain, startAt + Math.max(0.006, Number(options.attack) || 0.014));
    if (!source.loop) {
      const duration = buffer.duration / playbackRate;
      const release = Math.min(0.14, Math.max(0.035, duration * 0.1));
      gain.gain.setValueAtTime(targetGain, Math.max(startAt + 0.02, startAt + duration - release));
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration + 0.018);
    }
    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(safeCrackerAudioBus(context));
    source.start(startAt);
    return { source, gain, context };
  }

  function safeCrackerRecordedModeActive() {
    const game = runtime.game;
    return Boolean(
      !document.hidden &&
      game?.mode === 'safecracker' &&
      game?.status !== 'complete' &&
      document.querySelector('[data-safe-cracker-mount] .safe-cracker-game')
    );
  }

  function safeCrackerStopRecordedAmbience() {
    const current = runtime.safeCrackerRecordedAmbience;
    runtime.safeCrackerRecordedAmbience = null;
    if (!current) return;
    try {
      const now = current.context.currentTime;
      current.gain.gain.cancelScheduledValues(now);
      current.gain.gain.setValueAtTime(Math.max(0.0001, current.gain.gain.value), now);
      current.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
      current.source.stop(now + 0.58);
    } catch {}
  }

  function safeCrackerStartRecordedAmbience() {
    if (!safeCrackerRecordedModeActive() || runtime.safeCrackerRecordedAmbience) return;
    safeCrackerLoadRecordedSound('ambience').then(buffer => {
      if (!buffer || !safeCrackerRecordedModeActive() || runtime.safeCrackerRecordedAmbience) return;
      const playback = safeCrackerPlayRecordedSound('ambience', {
        gain: 0.085,
        loop: true,
        attack: 1.1,
        highpass: 45,
        lowpass: 2450
      });
      if (playback) runtime.safeCrackerRecordedAmbience = playback;
    });
  }

  const safeCrackerRecordedSubmitFallback = safeCrackerPlaySubmit;
  safeCrackerPlaySubmit = function safeCrackerPlayRecordedSubmit() {
    const played = safeCrackerPlayRecordedSound('submit', {
      gain: 0.31,
      playbackRate: 1.03,
      highpass: 80,
      lowpass: 9000
    });
    if (!played) safeCrackerRecordedSubmitFallback();
    else safeCrackerHaptic(8);
  };

  const safeCrackerRecordedDetentFallback = safeCrackerPlayDetent;
  safeCrackerPlayDetent = function safeCrackerPlayRecordedDetent(digit) {
    const now = performance.now();
    if (now - Number(runtime.safeCrackerRecordedDetentAt || 0) < 32) return;
    runtime.safeCrackerRecordedDetentAt = now;
    runtime.safeCrackerRecordedDetentIndex = (Number(runtime.safeCrackerRecordedDetentIndex || 0) + 1) % 2;
    const name = runtime.safeCrackerRecordedDetentIndex ? 'dialA' : 'dialB';
    const rate = 0.96 + (Math.abs(Number(digit) || 0) % 5) * 0.012;
    const played = safeCrackerPlayRecordedSound(name, {
      gain: name === 'dialA' ? 0.24 : 0.27,
      playbackRate: rate,
      highpass: 120,
      lowpass: 7900
    });
    if (!played) safeCrackerRecordedDetentFallback(digit);
    else safeCrackerHaptic(3);
  };
  playDetent = safeCrackerPlayDetent;

  const safeCrackerRecordedTumblerFallback = safeCrackerPlayTumblerLock;
  safeCrackerPlayTumblerLock = function safeCrackerPlayRecordedTumblerLock() {
    const played = safeCrackerPlayRecordedSound('latchOpen', {
      gain: 0.42,
      playbackRate: 1.01,
      highpass: 45,
      lowpass: 9400
    });
    if (!played) safeCrackerRecordedTumblerFallback();
    else safeCrackerHaptic([14, 24, 23]);
  };

  const safeCrackerRecordedFeedbackFallback = safeCrackerPlayFeedback;
  safeCrackerPlayFeedback = function safeCrackerPlayRecordedFeedback(tier) {
    if (tier === 'green') {
      safeCrackerPlayTumblerLock();
      return;
    }
    const settings = tier === 'yellow'
      ? { gain: 0.22, playbackRate: 1.08, haptic: [6, 22, 8], lowpass: 5600 }
      : tier === 'orange'
        ? { gain: 0.27, playbackRate: 0.99, haptic: 7, lowpass: 4700 }
        : { gain: 0.33, playbackRate: 0.91, haptic: 5, lowpass: 4000 };
    const played = safeCrackerPlayRecordedSound('incorrect', {
      gain: settings.gain,
      playbackRate: settings.playbackRate,
      highpass: 55,
      lowpass: settings.lowpass
    });
    if (!played) safeCrackerRecordedFeedbackFallback(tier);
    else safeCrackerHaptic(settings.haptic);
  };
  playFeedback = safeCrackerPlayFeedback;

  const safeCrackerRecordedOpenFallback = safeCrackerPlaySafeOpen;
  safeCrackerPlaySafeOpen = function safeCrackerPlayRecordedSafeOpen() {
    const played = safeCrackerPlayRecordedSound('safeOpen', {
      gain: 0.48,
      highpass: 28,
      lowpass: 9000
    });
    if (!played) safeCrackerRecordedOpenFallback();
  };

  const safeCrackerRecordedCountdownFallback = safeCrackerPlayCountdownLabel;
  safeCrackerPlayCountdownLabel = function safeCrackerPlayRecordedCountdown(label) {
    const normalized = String(label || '').trim().toUpperCase();
    const gameId = String(runtime.game?.gameId || '');
    const numeric = Number(normalized);
    if (gameId && numeric === 3 && runtime.safeCrackerRecordedIntroGameId !== gameId) {
      runtime.safeCrackerRecordedIntroGameId = gameId;
      const played = safeCrackerPlayRecordedSound('intro', {
        gain: 0.4,
        highpass: 32,
        lowpass: 9300
      });
      if (!played) return safeCrackerRecordedCountdownFallback(label);
      safeCrackerHaptic(7);
      return;
    }
    if (runtime.safeCrackerRecordedIntroGameId === gameId && (
      (Number.isFinite(numeric) && numeric >= 1 && numeric <= 2) ||
      normalized.includes('CRACK') ||
      normalized.includes('GO') ||
      normalized.includes('START')
    )) {
      if (normalized.includes('CRACK') || normalized.includes('GO') || normalized.includes('START')) {
        safeCrackerHaptic([8, 22, 12]);
      }
      return;
    }
    return safeCrackerRecordedCountdownFallback(label);
  };

  function safeCrackerRecordedState(game) {
    if (game?.mode !== 'safecracker' || game?.status === 'complete') {
      safeCrackerStopRecordedAmbience();
      return;
    }
    safeCrackerPrimeRecordedSounds();
    safeCrackerStartRecordedAmbience();
  }

  document.addEventListener('pointerdown', () => {
    safeCrackerUnlockRecordedAudio();
    safeCrackerStartRecordedAmbience();
  }, { capture: true, passive: true });
  document.addEventListener('keydown', () => {
    safeCrackerUnlockRecordedAudio();
    safeCrackerStartRecordedAmbience();
  }, { capture: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) safeCrackerStopRecordedAmbience();
    else {
      safeCrackerPrimeRecordedSounds();
      safeCrackerStartRecordedAmbience();
    }
  });
  window.addEventListener(STATE_EVENT, event => safeCrackerRecordedState(event?.detail?.game));
  window.setTimeout(safeCrackerPrimeRecordedSounds, 0);
  ${end}
`;

  const closing = '\n})();';
  const closingIndex = client.lastIndexOf(closing);
  if (closingIndex < 0) throw new Error('Recorded Safe Cracker sound patch could not find the runtime closure.');
  client = client.slice(0, closingIndex) + patch + client.slice(closingIndex);
}

const required = [
  start,
  'const SAFE_CRACKER_RECORDED_SOUNDS = Object.freeze({',
  'function safeCrackerLoadRecordedSound(name)',
  'function safeCrackerUnlockRecordedAudio()',
  'function safeCrackerPlayRecordedSound(name, options = {})',
  "safeCrackerPlayRecordedSound('submit'",
  "safeCrackerPlayRecordedSound(name, {",
  "safeCrackerPlayRecordedSound('incorrect'",
  "safeCrackerPlayRecordedSound('latchOpen'",
  "safeCrackerPlayRecordedSound('safeOpen'",
  "safeCrackerPlayRecordedSound('intro'",
  'playDetent = safeCrackerPlayDetent;',
  'playFeedback = safeCrackerPlayFeedback;',
  '// SAFE_CRACKER_DIAL_ACTIVITY_V16_START',
  'choice: `safecracker:guess:${runtime.selected}`'
];
for (const fragment of required) {
  if (!client.includes(fragment)) throw new Error(`Recorded Safe Cracker sound patch is missing ${fragment}.`);
}
if ((client.match(/SAFE_CRACKER_RECORDED_SOUNDS_V13_START/g) || []).length !== 1) {
  throw new Error('Recorded Safe Cracker sound marker must appear exactly once.');
}
await writeFile(clientUrl, client);

let html = await readFile(indexUrl, 'utf8');
html = html.replace(/\/assets\/safe-cracker\/safe-cracker\.js\?[^"'\s]*/g, value => {
  const clean = value.replace(/&recorded=\d+/g, '');
  return `${clean}&recorded=13`;
});
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker recorded soundscape v13 with real uploaded samples and Android audio unlock.');
