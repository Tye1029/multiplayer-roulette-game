import { readFile, writeFile } from 'node:fs/promises';

const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const oldSections = Object.freeze([
  ['// SAFE_CRACKER_DIAL_SAMPLE_V18_START', '// SAFE_CRACKER_DIAL_SAMPLE_V18_END'],
  ['// SAFE_CRACKER_DIAL_SAMPLE_V19_START', '// SAFE_CRACKER_DIAL_SAMPLE_V19_END'],
  ['// SAFE_CRACKER_DIAL_SAMPLE_V20_START', '// SAFE_CRACKER_DIAL_SAMPLE_V20_END'],
  ['// SAFE_CRACKER_DIAL_SAMPLE_V21_START', '// SAFE_CRACKER_DIAL_SAMPLE_V21_END']
]);
const start = '// SAFE_CRACKER_DIAL_SAMPLE_V21_START';
const end = '// SAFE_CRACKER_DIAL_SAMPLE_V21_END';

let client = await readFile(clientUrl, 'utf8');
if (!client.includes('// SAFE_CRACKER_RECORDED_SOUNDS_V13_START')) {
  throw new Error('Safe Cracker dial sample v21 requires the recorded sound runtime.');
}
if (!client.includes('// SAFE_CRACKER_DIAL_CLICK_V17_START')) {
  throw new Error('Safe Cracker dial sample v21 requires the protected dial click runtime.');
}

function removeSection(source, begin, finish) {
  const from = source.indexOf(begin);
  if (from < 0) return source;
  const to = source.indexOf(finish, from);
  if (to < 0) throw new Error(`Could not close ${begin}.`);
  return source.slice(0, from) + source.slice(to + finish.length);
}

for (const [begin, finish] of oldSections) client = removeSection(client, begin, finish);

const patch = String.raw`
  ${start}
  const SAFE_CRACKER_DIAL_SAMPLES_V21 = Object.freeze([
    '/assets/safe-cracker/audio-data-v3/bank-vault-dial-click-1.b64',
    '/assets/safe-cracker/audio-data-v3/bank-vault-dial-click-2.b64',
    '/assets/safe-cracker/audio-data-v3/bank-vault-dial-click-3.b64',
    '/assets/safe-cracker/audio-data-v3/bank-vault-dial-click-4.b64',
    '/assets/safe-cracker/audio-data-v3/bank-vault-dial-click-5.b64',
    '/assets/safe-cracker/audio-data-v3/bank-vault-dial-click-6.b64'
  ]);

  function safeCrackerDialBlobUrlV21(text) {
    const bytes = new Uint8Array(safeCrackerRecordedBytes(text));
    return URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
  }

  function safeCrackerCreateDialVoiceV21(url) {
    const audio = new Audio(url);
    audio.preload = 'auto';
    audio.playsInline = true;
    audio.volume = 0.96;
    audio.playbackRate = 1;
    audio.load();
    return audio;
  }

  function safeCrackerPrefetchDialVoicesV21() {
    if (Array.isArray(runtime.safeCrackerDialVoicesV21) && runtime.safeCrackerDialVoicesV21.length === SAFE_CRACKER_DIAL_SAMPLES_V21.length) {
      return Promise.resolve(runtime.safeCrackerDialVoicesV21);
    }
    if (runtime.safeCrackerDialVoicePromiseV21) return runtime.safeCrackerDialVoicePromiseV21;
    runtime.safeCrackerDialVoicePromiseV21 = Promise.all(SAFE_CRACKER_DIAL_SAMPLES_V21.map(url =>
      fetch(url + '?clicks=21', { cache: 'force-cache' })
        .then(response => {
          if (!response.ok) throw new Error('Bank-vault dial sample request failed at ' + url);
          return response.text();
        })
    ))
      .then(texts => texts.map(text => {
        const url = safeCrackerDialBlobUrlV21(text);
        return {
          url,
          voices: [safeCrackerCreateDialVoiceV21(url), safeCrackerCreateDialVoiceV21(url)],
          cursor: 0
        };
      }))
      .then(entries => {
        runtime.safeCrackerDialVoicesV21 = entries;
        return entries;
      })
      .catch(error => {
        console.warn('[Safe Cracker audio] Failed to prepare native dial samples', error);
        return [];
      })
      .finally(() => { runtime.safeCrackerDialVoicePromiseV21 = null; });
    return runtime.safeCrackerDialVoicePromiseV21;
  }

  function safeCrackerUnlockDialVoicesV21() {
    const entries = runtime.safeCrackerDialVoicesV21;
    if (!Array.isArray(entries) || !entries.length || runtime.safeCrackerDialVoicesUnlockedV21) return;
    runtime.safeCrackerDialVoicesUnlockedV21 = true;
    for (const entry of entries) {
      const voice = entry.voices[0];
      const previousVolume = voice.volume;
      voice.volume = 0.0001;
      try {
        const promise = voice.play();
        if (promise?.then) promise.then(() => {
          voice.pause();
          voice.currentTime = 0;
          voice.volume = previousVolume;
        }).catch(() => { voice.volume = previousVolume; });
      } catch {
        voice.volume = previousVolume;
      }
    }
  }

  function safeCrackerPlayDryDialFallbackV21() {
    safeCrackerPlayNoise(0.018, 0.018, 0, { frequency: 3100, q: 1.9 });
    safeCrackerPlayNoise(0.034, 0.01, 0.012, { frequency: 930, q: 1.15 });
    safeCrackerHaptic(3);
  }

  function safeCrackerPlayNativeDialSampleV21() {
    const entries = runtime.safeCrackerDialVoicesV21;
    if (!Array.isArray(entries) || !entries.length) return false;
    const previous = Number(runtime.safeCrackerDialVoiceIndexV21 ?? -1);
    const index = (previous + 1) % entries.length;
    runtime.safeCrackerDialVoiceIndexV21 = index;
    const entry = entries[index];
    const voice = entry.voices[entry.cursor++ % entry.voices.length];
    try {
      voice.pause();
      voice.currentTime = 0;
      voice.volume = 0.96;
      voice.playbackRate = 1;
      const promise = voice.play();
      if (promise?.catch) promise.catch(() => safeCrackerPlayDryDialFallbackV21());
      return true;
    } catch {
      return false;
    }
  }

  safeCrackerPlayDetent = function safeCrackerPlayNativeBankVaultDetentV21(digit) {
    const now = performance.now();
    if (now - Number(runtime.safeCrackerDialAtV21 || 0) < 25) return;
    runtime.safeCrackerDialAtV21 = now;
    if (safeCrackerPlayNativeDialSampleV21()) {
      safeCrackerHaptic(3);
      return;
    }
    safeCrackerPrefetchDialVoicesV21().then(entries => {
      if (!entries.length) return;
      safeCrackerUnlockDialVoicesV21();
    });
    safeCrackerPlayDryDialFallbackV21();
  };
  playDetent = safeCrackerPlayDetent;

  function safeCrackerSmoothRoomToneBufferV21(context) {
    if (runtime.safeCrackerSmoothRoomToneBufferV21?.sampleRate === context.sampleRate) return runtime.safeCrackerSmoothRoomToneBufferV21;
    const duration = 21;
    const fadeSeconds = 2.5;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const fadeLength = Math.max(1, Math.floor(context.sampleRate * fadeSeconds));
    const raw = new Float32Array(length + fadeLength);
    let brown = 0;
    let slow = 0;
    for (let index = 0; index < raw.length; index += 1) {
      const white = Math.random() * 2 - 1;
      brown = brown * 0.985 + white * 0.015;
      slow = slow * 0.9996 + white * 0.0004;
      raw[index] = brown * 0.72 + slow * 0.28 + white * 0.018;
    }
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = raw[index];
    for (let index = 0; index < fadeLength; index += 1) {
      const mix = index / fadeLength;
      data[index] = raw[length + index] * (1 - mix) + raw[index] * mix;
    }
    let peak = 0.0001;
    for (let index = 0; index < data.length; index += 1) peak = Math.max(peak, Math.abs(data[index]));
    const scale = 0.34 / peak;
    for (let index = 0; index < data.length; index += 1) data[index] *= scale;
    runtime.safeCrackerSmoothRoomToneBufferV21 = buffer;
    return buffer;
  }

  safeCrackerStartRecordedAmbience = function safeCrackerStartSmoothVaultRoomToneV21() {
    if (!safeCrackerRecordedModeActive() || runtime.safeCrackerRecordedAmbience) return;
    const context = resumeAudio();
    if (!context) return;
    const source = context.createBufferSource();
    const highpass = context.createBiquadFilter();
    const lowpass = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = safeCrackerSmoothRoomToneBufferV21(context);
    source.loop = true;
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(32, context.currentTime);
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(720, context.currentTime);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.026, context.currentTime + 2.2);
    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(safeCrackerAudioBus(context));
    source.start(context.currentTime);
    runtime.safeCrackerRecordedAmbience = { source, gain, context, smoothRoomToneV21: true };
  };

  function safeCrackerPrimeDialV21() {
    safeCrackerPrefetchDialVoicesV21().then(() => safeCrackerUnlockDialVoicesV21());
  }

  document.addEventListener('pointerdown', safeCrackerPrimeDialV21, { capture: true, passive: true });
  document.addEventListener('touchstart', safeCrackerPrimeDialV21, { capture: true, passive: true });
  document.addEventListener('keydown', safeCrackerPrimeDialV21, { capture: true });
  safeCrackerPrefetchDialVoicesV21();
  ${end}
`;

const closing = '\n})();';
const closingIndex = client.lastIndexOf(closing);
if (closingIndex < 0) throw new Error('Safe Cracker dial sample v21 could not find the runtime closure.');
client = client.slice(0, closingIndex) + patch + client.slice(closingIndex);

const required = [
  start,
  'const SAFE_CRACKER_DIAL_SAMPLES_V21 = Object.freeze([',
  'function safeCrackerPrefetchDialVoicesV21()',
  'function safeCrackerUnlockDialVoicesV21()',
  'function safeCrackerPlayNativeDialSampleV21()',
  'function safeCrackerPlayNativeBankVaultDetentV21(digit)',
  'new Audio(url)',
  "new Blob([bytes], { type: 'audio/mpeg' })",
  'voice.volume = 0.96',
  'safeCrackerPlayDryDialFallbackV21()',
  'function safeCrackerSmoothRoomToneBufferV21(context)',
  'function safeCrackerStartSmoothVaultRoomToneV21()',
  'gain.gain.exponentialRampToValueAtTime(0.026',
  'playDetent = safeCrackerPlayDetent;',
  'safeCrackerPlayAuthoritativeCorrectCue',
  'safeCrackerPlayIncorrectRejectCue',
  'choice: `safecracker:guess:${runtime.selected}`'
];
for (const fragment of required) {
  if (!client.includes(fragment)) throw new Error(`Safe Cracker dial sample v21 is missing ${fragment}.`);
}
if ((client.match(/SAFE_CRACKER_DIAL_SAMPLE_V21_START/g) || []).length !== 1) {
  throw new Error('Safe Cracker dial sample v21 marker must appear exactly once.');
}
await writeFile(clientUrl, client);

let html = await readFile(indexUrl, 'utf8');
html = html.replace(/\/assets\/safe-cracker\/safe-cracker\.js\?[^"'\s]*/g, value => {
  const clean = value.replace(/&clicks=\d+/g, '');
  return `${clean}&clicks=21`;
});
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker dial sample v21: native preloaded vault clicks guarantee audible detents and a smooth transient-free room tone replaces the repeating ambience impacts.');
