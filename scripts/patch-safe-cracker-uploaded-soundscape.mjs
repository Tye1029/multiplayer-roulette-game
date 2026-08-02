import { readFile, writeFile } from 'node:fs/promises';

const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const start = '// SAFE_CRACKER_UPLOADED_SOUNDSCAPE_V1_START';
const end = '// SAFE_CRACKER_UPLOADED_SOUNDSCAPE_V1_END';

let client = await readFile(clientUrl, 'utf8');
if (!client.includes('// SAFE_CRACKER_AUDIO_PASS_V10_START')) {
  throw new Error('Uploaded Safe Cracker soundscape requires audio pass v10.');
}
if (!client.includes('// SAFE_CRACKER_SAMPLE_MIX_V11_START')) {
  throw new Error('Uploaded Safe Cracker soundscape requires sample mix v11.');
}

if (!client.includes(start)) {
  const soundscape = String.raw`
  ${start}
  const SAFE_CRACKER_UPLOADED_SOUNDSCAPE = Object.freeze({
    intro: '/assets/safe-cracker/audio-data-v2/intro-sequence.b64',
    dialA: '/assets/safe-cracker/audio-data-v2/dial-detent-a.b64',
    dialB: '/assets/safe-cracker/audio-data-v2/dial-detent-b.b64',
    incorrect: '/assets/safe-cracker/audio-data-v2/incorrect-number.b64',
    latchOpen: '/assets/safe-cracker/audio-data-v2/correct-latch-open.b64',
    finalOpen: '/assets/safe-cracker/audio-data-v2/final-vault-open.b64',
    ambience: Object.freeze([
      '/assets/safe-cracker/audio-data-v2/vault-ambience-loop-1.b64',
      '/assets/safe-cracker/audio-data-v2/vault-ambience-loop-2.b64',
      '/assets/safe-cracker/audio-data-v2/vault-ambience-loop-3.b64',
      '/assets/safe-cracker/audio-data-v2/vault-ambience-loop-4.b64'
    ]),
    submit: '/assets/safe-cracker/audio-data-v2/submit-mechanism.b64'
  });

  function safeCrackerLoadUploadedSound(name) {
    const locations = SAFE_CRACKER_UPLOADED_SOUNDSCAPE[name];
    const context = audioContext();
    if (!locations || !context) return Promise.resolve(null);
    const urls = Array.isArray(locations) ? locations : [locations];
    runtime.safeCrackerUploadedBuffers ||= Object.create(null);
    runtime.safeCrackerUploadedPromises ||= Object.create(null);
    if (runtime.safeCrackerUploadedBuffers[name]) return Promise.resolve(runtime.safeCrackerUploadedBuffers[name]);
    if (runtime.safeCrackerUploadedPromises[name]) return runtime.safeCrackerUploadedPromises[name];
    const promise = Promise.all(urls.map(url =>
      fetch(url + '?soundscape=1', { cache: 'force-cache' }).then(response => {
        if (!response.ok) throw new Error('Uploaded sound request failed: ' + name);
        return response.text();
      })
    ))
      .then(parts => context.decodeAudioData(safeCrackerBase64Bytes(parts.join('')).slice(0)))
      .then(buffer => {
        runtime.safeCrackerUploadedBuffers[name] = buffer;
        return buffer;
      })
      .catch(() => null)
      .finally(() => { delete runtime.safeCrackerUploadedPromises[name]; });
    runtime.safeCrackerUploadedPromises[name] = promise;
    return promise;
  }

  function safeCrackerPrimeUploadedSoundscape() {
    for (const name of Object.keys(SAFE_CRACKER_UPLOADED_SOUNDSCAPE)) safeCrackerLoadUploadedSound(name);
  }

  function safeCrackerPlayUploadedSound(name, options = {}) {
    const context = resumeAudio();
    const buffer = runtime.safeCrackerUploadedBuffers?.[name];
    if (!context || !buffer || document.hidden) {
      safeCrackerLoadUploadedSound(name);
      return false;
    }
    const delay = Math.max(0, Number(options.delay) || 0);
    const startAt = context.currentTime + delay;
    const rate = Math.max(0.78, Math.min(1.22, Number(options.playbackRate) || 1));
    const targetGain = Math.max(0.0002, Number(options.gain) || 0.18);
    const source = context.createBufferSource();
    const highpass = context.createBiquadFilter();
    const lowpass = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    source.playbackRate.setValueAtTime(rate, startAt);
    source.loop = Boolean(options.loop);
    if (source.loop && buffer.duration > 0.2) {
      source.loopStart = Math.min(0.05, buffer.duration * 0.08);
      source.loopEnd = Math.max(source.loopStart + 0.08, buffer.duration - Math.min(0.05, buffer.duration * 0.08));
    }
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(Math.max(20, Number(options.highpass) || 35), startAt);
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(Math.max(500, Number(options.lowpass) || 12000), startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(targetGain, startAt + Math.max(0.008, Number(options.attack) || 0.018));
    if (!source.loop) {
      const duration = buffer.duration / rate;
      const release = Math.min(0.16, Math.max(0.045, duration * 0.12));
      gain.gain.setValueAtTime(targetGain, Math.max(startAt + 0.02, startAt + duration - release));
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration + 0.02);
    }
    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(safeCrackerAudioBus(context));
    source.start(startAt);
    return { source, gain, context };
  }

  function safeCrackerSoundscapeIsActive() {
    const game = runtime.game;
    return Boolean(
      !document.hidden &&
      game?.mode === 'safecracker' &&
      game?.status !== 'complete' &&
      document.querySelector('[data-safe-cracker-mount] .safe-cracker-game')
    );
  }

  function safeCrackerStopUploadedAmbience() {
    const ambience = runtime.safeCrackerUploadedAmbience;
    runtime.safeCrackerUploadedAmbience = null;
    if (!ambience) return;
    try {
      const now = ambience.context.currentTime;
      ambience.gain.gain.cancelScheduledValues(now);
      ambience.gain.gain.setValueAtTime(Math.max(0.0001, ambience.gain.gain.value), now);
      ambience.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
      ambience.source.stop(now + 0.48);
    } catch {}
  }

  function safeCrackerStartUploadedAmbience() {
    if (!safeCrackerSoundscapeIsActive() || runtime.safeCrackerUploadedAmbience) return;
    safeCrackerLoadUploadedSound('ambience').then(buffer => {
      if (!buffer || !safeCrackerSoundscapeIsActive() || runtime.safeCrackerUploadedAmbience) return;
      const ambience = safeCrackerPlayUploadedSound('ambience', {
        gain: 0.42,
        loop: true,
        attack: 1.4,
        highpass: 48,
        lowpass: 2200
      });
      if (ambience) runtime.safeCrackerUploadedAmbience = ambience;
    });
  }

  const safeCrackerUploadedSubmitFallback = safeCrackerPlaySubmit;
  safeCrackerPlaySubmit = function safeCrackerPlayUploadedSubmit() {
    const played = safeCrackerPlayUploadedSound('submit', {
      gain: 0.17,
      playbackRate: 1.03,
      highpass: 95,
      lowpass: 8200
    });
    if (!played) safeCrackerUploadedSubmitFallback();
    else safeCrackerHaptic(8);
  };

  const safeCrackerUploadedDetentFallback = safeCrackerPlayDetent;
  safeCrackerPlayDetent = function safeCrackerPlayUploadedDetent(digit) {
    const now = performance.now();
    if (now - Number(runtime.safeCrackerUploadedDetentAt || 0) < 34) return;
    runtime.safeCrackerUploadedDetentAt = now;
    runtime.safeCrackerUploadedDetentIndex = (Number(runtime.safeCrackerUploadedDetentIndex || 0) + 1) % 2;
    const sample = runtime.safeCrackerUploadedDetentIndex ? 'dialA' : 'dialB';
    const rate = 0.96 + (Math.abs(Number(digit) || 0) % 4) * 0.012;
    const played = safeCrackerPlayUploadedSound(sample, {
      gain: sample === 'dialA' ? 0.105 : 0.13,
      playbackRate: rate,
      highpass: 150,
      lowpass: 7200
    });
    if (!played) safeCrackerUploadedDetentFallback(digit);
    else safeCrackerHaptic(3);
  };
  playDetent = safeCrackerPlayDetent;

  const safeCrackerUploadedTumblerFallback = safeCrackerPlayTumblerLock;
  safeCrackerPlayTumblerLock = function safeCrackerPlayUploadedTumblerLock() {
    const played = safeCrackerPlayUploadedSound('latchOpen', {
      gain: 0.29,
      playbackRate: 1.02,
      highpass: 62,
      lowpass: 8800
    });
    if (!played) safeCrackerUploadedTumblerFallback();
    else safeCrackerHaptic([14, 25, 23]);
  };

  const safeCrackerUploadedFeedbackFallback = safeCrackerPlayFeedback;
  safeCrackerPlayFeedback = function safeCrackerPlayUploadedFeedback(tier) {
    if (tier === 'green') {
      safeCrackerPlayTumblerLock();
      return;
    }
    const settings = tier === 'yellow'
      ? { gain: 0.09, playbackRate: 1.08, tone: 360, haptic: [6, 24, 8] }
      : tier === 'orange'
        ? { gain: 0.125, playbackRate: 0.98, tone: 220, haptic: 7 }
        : { gain: 0.16, playbackRate: 0.91, tone: 126, haptic: 5 };
    const played = safeCrackerPlayUploadedSound('incorrect', {
      gain: settings.gain,
      playbackRate: settings.playbackRate,
      highpass: 66,
      lowpass: tier === 'yellow' ? 5200 : 4100
    });
    if (!played) {
      safeCrackerUploadedFeedbackFallback(tier);
      return;
    }
    safeCrackerPlayTone(settings.tone, 0.085, 0.007, 'triangle', 0.03, {
      endFrequency: Math.max(70, settings.tone * 0.82),
      filterFrequency: 1900
    });
    safeCrackerHaptic(settings.haptic);
  };
  playFeedback = safeCrackerPlayFeedback;

  const safeCrackerUploadedOpenFallback = safeCrackerPlaySafeOpen;
  safeCrackerPlaySafeOpen = function safeCrackerPlayUploadedSafeOpen() {
    const played = safeCrackerPlayUploadedSound('finalOpen', {
      gain: 0.31,
      highpass: 38,
      lowpass: 8200
    });
    if (!played) safeCrackerUploadedOpenFallback();
  };

  const safeCrackerUploadedCountdownFallback = safeCrackerPlayCountdownLabel;
  safeCrackerPlayCountdownLabel = function safeCrackerPlayUploadedCountdown(label) {
    const normalized = String(label || '').trim().toUpperCase();
    const gameId = String(runtime.game?.gameId || '');
    const numeric = Number(normalized);
    if (gameId && numeric === 3 && runtime.safeCrackerUploadedIntroGameId !== gameId) {
      runtime.safeCrackerUploadedIntroGameId = gameId;
      const played = safeCrackerPlayUploadedSound('intro', {
        gain: 0.235,
        highpass: 42,
        lowpass: 8400
      });
      if (!played) return safeCrackerUploadedCountdownFallback(label);
      safeCrackerHaptic(7);
      return;
    }
    if (runtime.safeCrackerUploadedIntroGameId === gameId && (
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
    return safeCrackerUploadedCountdownFallback(label);
  };

  function safeCrackerUploadedSoundscapeState(game) {
    if (game?.mode !== 'safecracker' || game?.status === 'complete') {
      safeCrackerStopUploadedAmbience();
      return;
    }
    safeCrackerPrimeUploadedSoundscape();
    safeCrackerStartUploadedAmbience();
  }

  document.addEventListener('pointerdown', () => {
    safeCrackerPrimeUploadedSoundscape();
    safeCrackerStartUploadedAmbience();
  }, { capture: true });
  document.addEventListener('keydown', () => {
    safeCrackerPrimeUploadedSoundscape();
    safeCrackerStartUploadedAmbience();
  }, { capture: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) safeCrackerStopUploadedAmbience();
    else safeCrackerStartUploadedAmbience();
  });
  window.addEventListener(STATE_EVENT, event => safeCrackerUploadedSoundscapeState(event?.detail?.game));
  ${end}
`;

  const closing = '\n})();';
  const closingIndex = client.lastIndexOf(closing);
  if (closingIndex < 0) throw new Error('Uploaded Safe Cracker soundscape could not find the runtime closure.');
  client = client.slice(0, closingIndex) + soundscape + client.slice(closingIndex);
}

const required = [
  start,
  'const SAFE_CRACKER_UPLOADED_SOUNDSCAPE = Object.freeze({',
  'function safeCrackerLoadUploadedSound(name)',
  'function safeCrackerPlayUploadedSound(name, options = {})',
  'function safeCrackerStartUploadedAmbience()',
  "safeCrackerPlayUploadedSound('intro'",
  "safeCrackerPlayUploadedSound(sample",
  "safeCrackerPlayUploadedSound('incorrect'",
  "safeCrackerPlayUploadedSound('latchOpen'",
  "safeCrackerPlayUploadedSound('finalOpen'",
  "safeCrackerPlayUploadedSound('submit'",
  'safeCrackerPlayUploadedDetent',
  'safeCrackerPlayUploadedFeedback',
  'safeCrackerPlayUploadedTumblerLock',
  'safeCrackerPlayUploadedSafeOpen',
  '// SAFE_CRACKER_DIAL_ACTIVITY_V16_START',
  'choice: `safecracker:guess:${runtime.selected}`'
];
for (const fragment of required) {
  if (!client.includes(fragment)) throw new Error(`Uploaded Safe Cracker soundscape is missing ${fragment}.`);
}
if ((client.match(/SAFE_CRACKER_UPLOADED_SOUNDSCAPE_V1_START/g) || []).length !== 1) {
  throw new Error('Uploaded Safe Cracker soundscape marker must appear exactly once.');
}
await writeFile(clientUrl, client);

let html = await readFile(indexUrl, 'utf8');
html = html.replace(/\/assets\/safe-cracker\/safe-cracker\.js\?[^"'\s]*/g, value => {
  const clean = value.replace(/&soundscape=\d+/g, '');
  return `${clean}&soundscape=1`;
});
await writeFile(indexUrl, html);

console.log('Applied uploaded Safe Cracker soundscape v2: blended intro, alternating physical dial detents, tiered incorrect feedback, synchronized latch release, full vault opening, submit mechanism, and low industrial ambience.');
