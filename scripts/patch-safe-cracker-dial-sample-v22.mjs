import { readFile, writeFile } from 'node:fs/promises';

const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const sampleUrl = new URL('../assets/safe-cracker/audio-data-v3/bank-vault-dial-click-1.b64', import.meta.url);
const sections = Object.freeze([
  ['// SAFE_CRACKER_DIAL_SAMPLE_V18_START', '// SAFE_CRACKER_DIAL_SAMPLE_V18_END'],
  ['// SAFE_CRACKER_DIAL_SAMPLE_V19_START', '// SAFE_CRACKER_DIAL_SAMPLE_V19_END'],
  ['// SAFE_CRACKER_DIAL_SAMPLE_V20_START', '// SAFE_CRACKER_DIAL_SAMPLE_V20_END'],
  ['// SAFE_CRACKER_DIAL_SAMPLE_V21_START', '// SAFE_CRACKER_DIAL_SAMPLE_V21_END'],
  ['// SAFE_CRACKER_DIAL_SAMPLE_V22_START', '// SAFE_CRACKER_DIAL_SAMPLE_V22_END'],
  ['// SAFE_CRACKER_DIAL_SAMPLE_V23_START', '// SAFE_CRACKER_DIAL_SAMPLE_V23_END']
]);
const start = '// SAFE_CRACKER_DIAL_SAMPLE_V23_START';
const end = '// SAFE_CRACKER_DIAL_SAMPLE_V23_END';

let client = await readFile(clientUrl, 'utf8');
if (!client.includes('// SAFE_CRACKER_RECORDED_SOUNDS_V13_START')) {
  throw new Error('Safe Cracker metallic click v23 requires the recorded sound runtime.');
}
if (!client.includes('// SAFE_CRACKER_DIAL_CLICK_V17_START')) {
  throw new Error('Safe Cracker metallic click v23 requires the protected dial click runtime.');
}

function removeSection(source, begin, finish) {
  const from = source.indexOf(begin);
  if (from < 0) return source;
  const to = source.indexOf(finish, from);
  if (to < 0) throw new Error(`Could not close ${begin}.`);
  return source.slice(0, from) + source.slice(to + finish.length);
}

for (const [begin, finish] of sections) {
  while (client.includes(begin)) client = removeSection(client, begin, finish);
}

const sampleBase64 = (await readFile(sampleUrl, 'utf8')).replace(/\s+/g, '');
if (sampleBase64.length < 7000 || !/^[A-Za-z0-9+/=]+$/.test(sampleBase64)) {
  throw new Error('Safe Cracker metallic click v23 sample payload is missing or malformed.');
}
const sampleDataUri = `data:audio/mpeg;base64,${sampleBase64}`;

const patch = `
  ${start}
  const SAFE_CRACKER_METALLIC_CLICK_V23 = ${JSON.stringify(sampleDataUri)};

  function safeCrackerCreateMetallicVoiceV23() {
    const voice = new Audio(SAFE_CRACKER_METALLIC_CLICK_V23);
    voice.preload = 'auto';
    voice.playsInline = true;
    voice.volume = 1;
    voice.playbackRate = 1;
    voice.load();
    return voice;
  }

  function safeCrackerPrepareMetallicVoicesV23() {
    if (Array.isArray(runtime.safeCrackerMetallicVoicesV23) && runtime.safeCrackerMetallicVoicesV23.length === 6) {
      return runtime.safeCrackerMetallicVoicesV23;
    }
    runtime.safeCrackerMetallicVoicesV23 = Array.from({ length: 6 }, () => safeCrackerCreateMetallicVoiceV23());
    runtime.safeCrackerMetallicCursorV23 = 0;
    return runtime.safeCrackerMetallicVoicesV23;
  }

  function safeCrackerUnlockMetallicVoicesV23() {
    const voices = safeCrackerPrepareMetallicVoicesV23();
    if (runtime.safeCrackerMetallicUnlockedV23) return;
    runtime.safeCrackerMetallicUnlockedV23 = true;
    for (const voice of voices) {
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

  function safeCrackerPlayExactMetallicClickV23() {
    const voices = safeCrackerPrepareMetallicVoicesV23();
    const index = Number(runtime.safeCrackerMetallicCursorV23 || 0) % voices.length;
    runtime.safeCrackerMetallicCursorV23 = index + 1;
    const voice = voices[index];
    try {
      voice.pause();
      voice.currentTime = 0;
      voice.volume = 1;
      voice.playbackRate = 1;
      const promise = voice.play();
      if (promise?.catch) {
        promise.catch(() => {
          const retry = safeCrackerCreateMetallicVoiceV23();
          retry.play().catch(() => {});
        });
      }
      return true;
    } catch {
      const retry = safeCrackerCreateMetallicVoiceV23();
      retry.play().catch(() => {});
      return false;
    }
  }

  safeCrackerPlayDetent = function safeCrackerPlayEmbeddedMetallicDetentV23(digit) {
    const now = performance.now();
    if (document.hidden || now - Number(runtime.safeCrackerMetallicAtV23 || 0) < 28) return;
    runtime.safeCrackerMetallicAtV23 = now;
    safeCrackerPlayExactMetallicClickV23();
    safeCrackerHaptic(3);
  };
  playDetent = safeCrackerPlayDetent;

  function safeCrackerSmoothRoomToneBufferV23(context) {
    if (runtime.safeCrackerSmoothRoomToneBufferV23?.sampleRate === context.sampleRate) return runtime.safeCrackerSmoothRoomToneBufferV23;
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
    runtime.safeCrackerSmoothRoomToneBufferV23 = buffer;
    return buffer;
  }

  safeCrackerStartRecordedAmbience = function safeCrackerStartSmoothVaultRoomToneV23() {
    if (!safeCrackerRecordedModeActive() || runtime.safeCrackerRecordedAmbience) return;
    const context = resumeAudio();
    if (!context) return;
    const source = context.createBufferSource();
    const highpass = context.createBiquadFilter();
    const lowpass = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = safeCrackerSmoothRoomToneBufferV23(context);
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
    runtime.safeCrackerRecordedAmbience = { source, gain, context, smoothRoomToneV23: true };
  };

  document.addEventListener('pointerdown', safeCrackerUnlockMetallicVoicesV23, { capture: true, passive: true });
  document.addEventListener('touchstart', safeCrackerUnlockMetallicVoicesV23, { capture: true, passive: true });
  document.addEventListener('keydown', safeCrackerUnlockMetallicVoicesV23, { capture: true });
  safeCrackerPrepareMetallicVoicesV23();
  ${end}
`;

const closing = '\n})();';
const closingIndex = client.lastIndexOf(closing);
if (closingIndex < 0) throw new Error('Safe Cracker metallic click v23 could not find the runtime closure.');
client = client.slice(0, closingIndex) + patch + client.slice(closingIndex);

const required = [
  start,
  'const SAFE_CRACKER_METALLIC_CLICK_V23 = "data:audio/mpeg;base64,',
  'function safeCrackerCreateMetallicVoiceV23()',
  'function safeCrackerPrepareMetallicVoicesV23()',
  'function safeCrackerUnlockMetallicVoicesV23()',
  'function safeCrackerPlayExactMetallicClickV23()',
  'function safeCrackerPlayEmbeddedMetallicDetentV23(digit)',
  'voice.volume = 1;',
  'voice.playbackRate = 1;',
  'playDetent = safeCrackerPlayDetent;',
  'function safeCrackerStartSmoothVaultRoomToneV23()',
  'safeCrackerPlayAuthoritativeCorrectCue',
  'safeCrackerPlayIncorrectRejectCue',
  'choice: `safecracker:guess:${runtime.selected}`'
];
for (const fragment of required) {
  if (!client.includes(fragment)) throw new Error(`Safe Cracker metallic click v23 is missing ${fragment}.`);
}
if ((client.match(/SAFE_CRACKER_DIAL_SAMPLE_V23_START/g) || []).length !== 1) {
  throw new Error('Safe Cracker metallic click v23 marker must appear exactly once.');
}
await writeFile(clientUrl, client);

let html = await readFile(indexUrl, 'utf8');
html = html.replace(/\/assets\/safe-cracker\/safe-cracker\.js\?[^"'\s]*/g, value => {
  const clean = value.replace(/&clicks=\d+/g, '');
  return `${clean}&clicks=23`;
});
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker dial sample v23: one exact 400 ms metallic click is embedded directly for every detent, with no previous sample bank, URL cache, or synthetic ratchet fallback.');
