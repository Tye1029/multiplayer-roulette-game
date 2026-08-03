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
  ['// SAFE_CRACKER_DIAL_SAMPLE_V23_START', '// SAFE_CRACKER_DIAL_SAMPLE_V23_END'],
  ['// SAFE_CRACKER_DIAL_PCM_V24_START', '// SAFE_CRACKER_DIAL_PCM_V24_END'],
  ['// SAFE_CRACKER_UPLOADED_PCM_V25_START', '// SAFE_CRACKER_UPLOADED_PCM_V25_END'],
  ['// SAFE_CRACKER_CLEAN_PCM_V26_START', '// SAFE_CRACKER_CLEAN_PCM_V26_END']
]);
const start = '// SAFE_CRACKER_CLEAN_PCM_V26_START';
const end = '// SAFE_CRACKER_CLEAN_PCM_V26_END';

let client = await readFile(clientUrl, 'utf8');
if (!client.includes('// SAFE_CRACKER_AUDIO_PASS_V10_START')) {
  throw new Error('Safe Cracker clean PCM v26 requires the WebAudio runtime.');
}
if (!client.includes('// SAFE_CRACKER_DIAL_ACTIVITY_V16_START')) {
  throw new Error('Safe Cracker clean PCM v26 requires the protected dial activity runtime.');
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

const uploadedPcmBase64 = (await readFile(sampleUrl, 'utf8')).replace(/\s+/g, '');
const uploadedPcmBytes = Buffer.from(uploadedPcmBase64, 'base64');
if (uploadedPcmBytes.length < 4600 || uploadedPcmBytes.length > 4800) {
  throw new Error(`Safe Cracker clean PCM v26 source length ${uploadedPcmBytes.length} is outside the recorded-click range.`);
}
if (!/^[A-Za-z0-9+/=]+$/.test(uploadedPcmBase64)) {
  throw new Error('Safe Cracker clean PCM v26 source is not valid transport-safe base64.');
}

const patch = String.raw`
  ${start}
  const SAFE_CRACKER_CLEAN_CLICK_PCM_V26 = ${JSON.stringify(uploadedPcmBase64)};
  const SAFE_CRACKER_CLEAN_CLICK_SOURCE_RATE_V26 = 16000;
  const SAFE_CRACKER_CLEAN_CLICK_RATE_V26 = 32000;

  function safeCrackerBuildCleanClickPcmV26(context) {
    if (runtime.safeCrackerCleanClickPcmV26?.context === context) {
      return runtime.safeCrackerCleanClickPcmV26.buffer;
    }
    const binary = window.atob(SAFE_CRACKER_CLEAN_CLICK_PCM_V26);
    const source = new Float32Array(binary.length);
    let mean = 0;
    for (let index = 0; index < binary.length; index += 1) {
      source[index] = (binary.charCodeAt(index) - 128) / 127;
      mean += source[index];
    }
    mean /= Math.max(1, source.length);
    for (let index = 0; index < source.length; index += 1) source[index] -= mean;

    const cleaned = new Float32Array(source.length);
    for (let index = 0; index < source.length; index += 1) {
      const before = source[Math.max(0, index - 1)];
      const current = source[index];
      const after = source[Math.min(source.length - 1, index + 1)];
      const gentleAverage = (before + current * 2 + after) * 0.25;
      cleaned[index] = current * 0.82 + gentleAverage * 0.18;
    }

    const upsample = SAFE_CRACKER_CLEAN_CLICK_RATE_V26 / SAFE_CRACKER_CLEAN_CLICK_SOURCE_RATE_V26;
    const outputLength = Math.max(1, Math.floor((cleaned.length - 1) * upsample) + 1);
    const buffer = context.createBuffer(1, outputLength, SAFE_CRACKER_CLEAN_CLICK_RATE_V26);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < outputLength; index += 1) {
      const position = index / upsample;
      const left = Math.floor(position);
      const fraction = position - left;
      const p0 = cleaned[Math.max(0, left - 1)];
      const p1 = cleaned[Math.min(cleaned.length - 1, left)];
      const p2 = cleaned[Math.min(cleaned.length - 1, left + 1)];
      const p3 = cleaned[Math.min(cleaned.length - 1, left + 2)];
      const a = -0.5 * p0 + 1.5 * p1 - 1.5 * p2 + 0.5 * p3;
      const b = p0 - 2.5 * p1 + 2 * p2 - 0.5 * p3;
      const c = -0.5 * p0 + 0.5 * p2;
      const d = p1;
      data[index] = Math.max(-1, Math.min(1, ((a * fraction + b) * fraction + c) * fraction + d));
    }

    const fadeIn = Math.max(1, Math.floor(SAFE_CRACKER_CLEAN_CLICK_RATE_V26 * 0.0015));
    const fadeOut = Math.max(1, Math.floor(SAFE_CRACKER_CLEAN_CLICK_RATE_V26 * 0.042));
    for (let index = 0; index < fadeIn; index += 1) {
      const mix = Math.sin((index / fadeIn) * Math.PI * 0.5);
      data[index] *= mix * mix;
    }
    for (let index = 0; index < fadeOut; index += 1) {
      const dataIndex = data.length - fadeOut + index;
      const mix = Math.cos((index / fadeOut) * Math.PI * 0.5);
      data[dataIndex] *= mix * mix;
    }

    runtime.safeCrackerCleanClickPcmV26 = { context, buffer };
    return buffer;
  }

  function safeCrackerUnlockCleanClickPcmV26() {
    const context = resumeAudio();
    if (!context) return;
    safeCrackerBuildCleanClickPcmV26(context);
    try {
      const source = context.createBufferSource();
      source.buffer = context.createBuffer(1, 1, context.sampleRate || 44100);
      source.connect(context.destination);
      source.start(context.currentTime);
    } catch {}
  }

  function safeCrackerFireCleanClickPcmV26() {
    const context = resumeAudio();
    if (!context || document.hidden) return false;
    const fire = () => {
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = safeCrackerBuildCleanClickPcmV26(context);
      source.playbackRate.setValueAtTime(1, context.currentTime);
      gain.gain.setValueAtTime(1.02, context.currentTime);
      source.connect(gain);
      gain.connect(context.destination);
      source.start(context.currentTime);
    };
    if (context.state === 'running') {
      fire();
      return true;
    }
    context.resume().then(fire).catch(() => {});
    return true;
  }

  safeCrackerPlayDetent = function safeCrackerPlayCleanPcmDetentV26(digit) {
    const now = performance.now();
    if (document.hidden || now - Number(runtime.safeCrackerCleanPcmAtV26 || 0) < 26) return;
    runtime.safeCrackerCleanPcmAtV26 = now;
    safeCrackerFireCleanClickPcmV26();
    safeCrackerHaptic(4);
  };
  playDetent = safeCrackerPlayDetent;

  function safeCrackerSmoothRoomToneBufferV26(context) {
    if (runtime.safeCrackerSmoothRoomToneBufferV26?.sampleRate === context.sampleRate) return runtime.safeCrackerSmoothRoomToneBufferV26;
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
    runtime.safeCrackerSmoothRoomToneBufferV26 = buffer;
    return buffer;
  }

  safeCrackerStartRecordedAmbience = function safeCrackerStartSmoothVaultRoomToneV26() {
    if (!safeCrackerRecordedModeActive() || runtime.safeCrackerRecordedAmbience) return;
    const context = resumeAudio();
    if (!context) return;
    const source = context.createBufferSource();
    const highpass = context.createBiquadFilter();
    const lowpass = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = safeCrackerSmoothRoomToneBufferV26(context);
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
    runtime.safeCrackerRecordedAmbience = { source, gain, context, smoothRoomToneV26: true };
  };

  document.addEventListener('pointerdown', safeCrackerUnlockCleanClickPcmV26, { capture: true, passive: true });
  document.addEventListener('touchstart', safeCrackerUnlockCleanClickPcmV26, { capture: true, passive: true });
  document.addEventListener('keydown', safeCrackerUnlockCleanClickPcmV26, { capture: true });
  ${end}
`;

const closing = '\n})();';
const closingIndex = client.lastIndexOf(closing);
if (closingIndex < 0) throw new Error('Safe Cracker clean PCM v26 could not find the runtime closure.');
client = client.slice(0, closingIndex) + patch + client.slice(closingIndex);

const required = [
  start,
  'const SAFE_CRACKER_CLEAN_CLICK_PCM_V26 =',
  'const SAFE_CRACKER_CLEAN_CLICK_SOURCE_RATE_V26 = 16000;',
  'const SAFE_CRACKER_CLEAN_CLICK_RATE_V26 = 32000;',
  'function safeCrackerBuildCleanClickPcmV26(context)',
  'const gentleAverage =',
  'const upsample =',
  'const fadeOut =',
  'function safeCrackerUnlockCleanClickPcmV26()',
  'function safeCrackerFireCleanClickPcmV26()',
  'function safeCrackerPlayCleanPcmDetentV26(digit)',
  'gain.gain.setValueAtTime(1.02',
  'gain.connect(context.destination);',
  'playDetent = safeCrackerPlayDetent;',
  'function safeCrackerStartSmoothVaultRoomToneV26()',
  'safeCrackerPlayAuthoritativeCorrectCue',
  'safeCrackerPlayIncorrectRejectCue',
  'choice: `safecracker:guess:${runtime.selected}`'
];
for (const fragment of required) {
  if (!client.includes(fragment)) throw new Error(`Safe Cracker clean PCM v26 is missing ${fragment}.`);
}
if ((client.match(/SAFE_CRACKER_CLEAN_PCM_V26_START/g) || []).length !== 1) {
  throw new Error('Safe Cracker clean PCM v26 marker must appear exactly once.');
}
await writeFile(clientUrl, client);

let html = await readFile(indexUrl, 'utf8');
html = html.replace(/\/assets\/safe-cracker\/safe-cracker\.js\?[^"'\s]*/g, value => {
  const clean = value.replace(/&clicks=\d+/g, '');
  return `${clean}&clicks=26`;
});
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker clean PCM v26: the same uploaded click is reconstructed as a smoother 32-bit float buffer with gentle interpolation and tapered edges, without compression or synthetic layering.');
