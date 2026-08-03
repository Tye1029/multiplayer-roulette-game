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
  ['// SAFE_CRACKER_UPLOADED_PCM_V25_START', '// SAFE_CRACKER_UPLOADED_PCM_V25_END']
]);
const start = '// SAFE_CRACKER_UPLOADED_PCM_V25_START';
const end = '// SAFE_CRACKER_UPLOADED_PCM_V25_END';

let client = await readFile(clientUrl, 'utf8');
if (!client.includes('// SAFE_CRACKER_AUDIO_PASS_V10_START')) {
  throw new Error('Safe Cracker uploaded PCM v25 requires the WebAudio runtime.');
}
if (!client.includes('// SAFE_CRACKER_DIAL_ACTIVITY_V16_START')) {
  throw new Error('Safe Cracker uploaded PCM v25 requires the protected dial activity runtime.');
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
  throw new Error(`Safe Cracker uploaded PCM v25 sample length ${uploadedPcmBytes.length} is outside the recorded-click range.`);
}
if (!/^[A-Za-z0-9+/=]+$/.test(uploadedPcmBase64)) {
  throw new Error('Safe Cracker uploaded PCM v25 sample is not valid transport-safe base64.');
}

const patch = String.raw`
  ${start}
  const SAFE_CRACKER_UPLOADED_CLICK_PCM_V25 = ${JSON.stringify(uploadedPcmBase64)};
  const SAFE_CRACKER_UPLOADED_CLICK_RATE_V25 = 16000;

  function safeCrackerBuildUploadedClickPcmV25(context) {
    if (runtime.safeCrackerUploadedClickPcmV25?.context === context) {
      return runtime.safeCrackerUploadedClickPcmV25.buffer;
    }
    const binary = window.atob(SAFE_CRACKER_UPLOADED_CLICK_PCM_V25);
    const buffer = context.createBuffer(1, binary.length, SAFE_CRACKER_UPLOADED_CLICK_RATE_V25);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < binary.length; index += 1) {
      data[index] = Math.max(-1, Math.min(1, (binary.charCodeAt(index) - 128) / 127));
    }
    runtime.safeCrackerUploadedClickPcmV25 = { context, buffer };
    return buffer;
  }

  function safeCrackerUnlockUploadedClickPcmV25() {
    const context = resumeAudio();
    if (!context) return;
    safeCrackerBuildUploadedClickPcmV25(context);
    try {
      const source = context.createBufferSource();
      source.buffer = context.createBuffer(1, 1, context.sampleRate || 44100);
      source.connect(context.destination);
      source.start(context.currentTime);
    } catch {}
  }

  function safeCrackerFireUploadedClickPcmV25() {
    const context = resumeAudio();
    if (!context || document.hidden) return false;
    const fire = () => {
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = safeCrackerBuildUploadedClickPcmV25(context);
      source.playbackRate.setValueAtTime(1, context.currentTime);
      gain.gain.setValueAtTime(0.98, context.currentTime);
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

  safeCrackerPlayDetent = function safeCrackerPlayUploadedPcmDetentV25(digit) {
    const now = performance.now();
    if (document.hidden || now - Number(runtime.safeCrackerUploadedPcmAtV25 || 0) < 26) return;
    runtime.safeCrackerUploadedPcmAtV25 = now;
    safeCrackerFireUploadedClickPcmV25();
    safeCrackerHaptic(4);
  };
  playDetent = safeCrackerPlayDetent;

  function safeCrackerSmoothRoomToneBufferV25(context) {
    if (runtime.safeCrackerSmoothRoomToneBufferV25?.sampleRate === context.sampleRate) return runtime.safeCrackerSmoothRoomToneBufferV25;
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
    runtime.safeCrackerSmoothRoomToneBufferV25 = buffer;
    return buffer;
  }

  safeCrackerStartRecordedAmbience = function safeCrackerStartSmoothVaultRoomToneV25() {
    if (!safeCrackerRecordedModeActive() || runtime.safeCrackerRecordedAmbience) return;
    const context = resumeAudio();
    if (!context) return;
    const source = context.createBufferSource();
    const highpass = context.createBiquadFilter();
    const lowpass = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = safeCrackerSmoothRoomToneBufferV25(context);
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
    runtime.safeCrackerRecordedAmbience = { source, gain, context, smoothRoomToneV25: true };
  };

  document.addEventListener('pointerdown', safeCrackerUnlockUploadedClickPcmV25, { capture: true, passive: true });
  document.addEventListener('touchstart', safeCrackerUnlockUploadedClickPcmV25, { capture: true, passive: true });
  document.addEventListener('keydown', safeCrackerUnlockUploadedClickPcmV25, { capture: true });
  ${end}
`;

const closing = '\n})();';
const closingIndex = client.lastIndexOf(closing);
if (closingIndex < 0) throw new Error('Safe Cracker uploaded PCM v25 could not find the runtime closure.');
client = client.slice(0, closingIndex) + patch + client.slice(closingIndex);

const required = [
  start,
  'const SAFE_CRACKER_UPLOADED_CLICK_PCM_V25 =',
  'const SAFE_CRACKER_UPLOADED_CLICK_RATE_V25 = 16000;',
  'function safeCrackerBuildUploadedClickPcmV25(context)',
  'window.atob(SAFE_CRACKER_UPLOADED_CLICK_PCM_V25)',
  'context.createBuffer(1, binary.length, SAFE_CRACKER_UPLOADED_CLICK_RATE_V25)',
  'function safeCrackerUnlockUploadedClickPcmV25()',
  'function safeCrackerFireUploadedClickPcmV25()',
  'function safeCrackerPlayUploadedPcmDetentV25(digit)',
  'source.playbackRate.setValueAtTime(1',
  'gain.gain.setValueAtTime(0.98',
  'gain.connect(context.destination);',
  'playDetent = safeCrackerPlayDetent;',
  'function safeCrackerStartSmoothVaultRoomToneV25()',
  'safeCrackerPlayAuthoritativeCorrectCue',
  'safeCrackerPlayIncorrectRejectCue',
  'choice: `safecracker:guess:${runtime.selected}`'
];
for (const fragment of required) {
  if (!client.includes(fragment)) throw new Error(`Safe Cracker uploaded PCM v25 is missing ${fragment}.`);
}
if ((client.match(/SAFE_CRACKER_UPLOADED_PCM_V25_START/g) || []).length !== 1) {
  throw new Error('Safe Cracker uploaded PCM v25 marker must appear exactly once.');
}
await writeFile(clientUrl, client);

let html = await readFile(indexUrl, 'utf8');
html = html.replace(/\/assets\/safe-cracker\/safe-cracker\.js\?[^"'\s]*/g, value => {
  const clean = value.replace(/&clicks=\d+/g, '');
  return `${clean}&clicks=25`;
});
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker uploaded PCM v25: the committed waveform from the user-provided metallic click recording now plays through the proven direct WebAudio buffer route.');
