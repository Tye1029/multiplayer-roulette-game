import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const chunkUrls = Object.freeze([
  new URL('../assets/safe-cracker/audio-data-v4/metallic-click-v27-part-1.b64', import.meta.url),
  new URL('../assets/safe-cracker/audio-data-v4/metallic-click-v27-part-2.b64', import.meta.url),
  new URL('../assets/safe-cracker/audio-data-v4/metallic-click-v27-part-3.b64', import.meta.url),
  new URL('../assets/safe-cracker/audio-data-v4/metallic-click-v27-part-4.b64', import.meta.url),
  new URL('../assets/safe-cracker/audio-data-v4/metallic-click-v27-part-5.b64', import.meta.url),
  new URL('../assets/safe-cracker/audio-data-v4/metallic-click-v27-part-6.b64', import.meta.url)
]);
const sections = Object.freeze([
  ['// SAFE_CRACKER_DIAL_SAMPLE_V18_START', '// SAFE_CRACKER_DIAL_SAMPLE_V18_END'],
  ['// SAFE_CRACKER_DIAL_SAMPLE_V19_START', '// SAFE_CRACKER_DIAL_SAMPLE_V19_END'],
  ['// SAFE_CRACKER_DIAL_SAMPLE_V20_START', '// SAFE_CRACKER_DIAL_SAMPLE_V20_END'],
  ['// SAFE_CRACKER_DIAL_SAMPLE_V21_START', '// SAFE_CRACKER_DIAL_SAMPLE_V21_END'],
  ['// SAFE_CRACKER_DIAL_SAMPLE_V22_START', '// SAFE_CRACKER_DIAL_SAMPLE_V22_END'],
  ['// SAFE_CRACKER_DIAL_SAMPLE_V23_START', '// SAFE_CRACKER_DIAL_SAMPLE_V23_END'],
  ['// SAFE_CRACKER_DIAL_PCM_V24_START', '// SAFE_CRACKER_DIAL_PCM_V24_END'],
  ['// SAFE_CRACKER_UPLOADED_PCM_V25_START', '// SAFE_CRACKER_UPLOADED_PCM_V25_END'],
  ['// SAFE_CRACKER_CLEAN_PCM_V26_START', '// SAFE_CRACKER_CLEAN_PCM_V26_END'],
  ['// SAFE_CRACKER_ORIGINAL_PCM_V27_START', '// SAFE_CRACKER_ORIGINAL_PCM_V27_END']
]);
const start = '// SAFE_CRACKER_ORIGINAL_PCM_V27_START';
const end = '// SAFE_CRACKER_ORIGINAL_PCM_V27_END';
const expectedBase64Length = 37548;
const expectedByteLength = 28160;
const expectedHash = 'f083e8341eaab8dd5c345128a2f084b9e93f7bdc7c48a2ab5b7fb978b38977cc';

let client = await readFile(clientUrl, 'utf8');
if (!client.includes('// SAFE_CRACKER_AUDIO_PASS_V10_START')) {
  throw new Error('Safe Cracker original PCM v27 requires the WebAudio runtime.');
}
if (!client.includes('// SAFE_CRACKER_DIAL_ACTIVITY_V16_START')) {
  throw new Error('Safe Cracker original PCM v27 requires the protected dial activity runtime.');
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

const originalPcmBase64 = (await Promise.all(chunkUrls.map(url => readFile(url, 'utf8'))))
  .map(text => text.replace(/\s+/g, ''))
  .join('');
if (!/^[A-Za-z0-9+/=]+$/.test(originalPcmBase64)) {
  throw new Error('Safe Cracker original PCM v27 chunks are not valid transport-safe base64.');
}
if (originalPcmBase64.length !== expectedBase64Length) {
  throw new Error(`Safe Cracker original PCM v27 base64 length ${originalPcmBase64.length} does not match ${expectedBase64Length}.`);
}
const originalPcmBytes = Buffer.from(originalPcmBase64, 'base64');
const originalPcmHash = createHash('sha256').update(originalPcmBytes).digest('hex');
if (originalPcmBytes.length !== expectedByteLength) {
  throw new Error(`Safe Cracker original PCM v27 byte length ${originalPcmBytes.length} does not match ${expectedByteLength}.`);
}
if (originalPcmHash !== expectedHash) {
  throw new Error(`Safe Cracker original PCM v27 checksum ${originalPcmHash} does not match ${expectedHash}.`);
}

const patch = String.raw`
  ${start}
  const SAFE_CRACKER_ORIGINAL_CLICK_PCM_V27 = ${JSON.stringify(originalPcmBase64)};
  const SAFE_CRACKER_ORIGINAL_CLICK_RATE_V27 = 32000;

  function safeCrackerBuildOriginalClickPcmV27(context) {
    if (runtime.safeCrackerOriginalClickPcmV27?.context === context) {
      return runtime.safeCrackerOriginalClickPcmV27.buffer;
    }
    const binary = window.atob(SAFE_CRACKER_ORIGINAL_CLICK_PCM_V27);
    const frameCount = Math.floor(binary.length / 2);
    const buffer = context.createBuffer(1, frameCount, SAFE_CRACKER_ORIGINAL_CLICK_RATE_V27);
    const data = buffer.getChannelData(0);
    for (let frame = 0; frame < frameCount; frame += 1) {
      const byteIndex = frame * 2;
      const low = binary.charCodeAt(byteIndex);
      const high = binary.charCodeAt(byteIndex + 1);
      let signed = low | (high << 8);
      if (signed & 0x8000) signed -= 0x10000;
      data[frame] = signed / 32768;
    }
    runtime.safeCrackerOriginalClickPcmV27 = { context, buffer };
    return buffer;
  }

  function safeCrackerUnlockOriginalClickPcmV27() {
    const context = resumeAudio();
    if (!context) return;
    safeCrackerBuildOriginalClickPcmV27(context);
    try {
      const source = context.createBufferSource();
      source.buffer = context.createBuffer(1, 1, context.sampleRate || 44100);
      source.connect(context.destination);
      source.start(context.currentTime);
    } catch {}
  }

  function safeCrackerFireOriginalClickPcmV27() {
    const context = resumeAudio();
    if (!context || document.hidden) return false;
    const fire = () => {
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = safeCrackerBuildOriginalClickPcmV27(context);
      source.playbackRate.setValueAtTime(1, context.currentTime);
      gain.gain.setValueAtTime(1.12, context.currentTime);
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

  safeCrackerPlayDetent = function safeCrackerPlayOriginalPcmDetentV27(digit) {
    const now = performance.now();
    if (document.hidden || now - Number(runtime.safeCrackerOriginalPcmAtV27 || 0) < 26) return;
    runtime.safeCrackerOriginalPcmAtV27 = now;
    safeCrackerFireOriginalClickPcmV27();
    safeCrackerHaptic(4);
  };
  playDetent = safeCrackerPlayDetent;

  function safeCrackerSmoothRoomToneBufferV27(context) {
    if (runtime.safeCrackerSmoothRoomToneBufferV27?.sampleRate === context.sampleRate) return runtime.safeCrackerSmoothRoomToneBufferV27;
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
    runtime.safeCrackerSmoothRoomToneBufferV27 = buffer;
    return buffer;
  }

  safeCrackerStartRecordedAmbience = function safeCrackerStartSmoothVaultRoomToneV27() {
    if (!safeCrackerRecordedModeActive() || runtime.safeCrackerRecordedAmbience) return;
    const context = resumeAudio();
    if (!context) return;
    const source = context.createBufferSource();
    const highpass = context.createBiquadFilter();
    const lowpass = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = safeCrackerSmoothRoomToneBufferV27(context);
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
    runtime.safeCrackerRecordedAmbience = { source, gain, context, smoothRoomToneV27: true };
  };

  document.addEventListener('pointerdown', safeCrackerUnlockOriginalClickPcmV27, { capture: true, passive: true });
  document.addEventListener('touchstart', safeCrackerUnlockOriginalClickPcmV27, { capture: true, passive: true });
  document.addEventListener('keydown', safeCrackerUnlockOriginalClickPcmV27, { capture: true });
  ${end}
`;

const closing = '\n})();';
const closingIndex = client.lastIndexOf(closing);
if (closingIndex < 0) throw new Error('Safe Cracker original PCM v27 could not find the runtime closure.');
client = client.slice(0, closingIndex) + patch + client.slice(closingIndex);

const required = [
  start,
  'const SAFE_CRACKER_ORIGINAL_CLICK_PCM_V27 =',
  'const SAFE_CRACKER_ORIGINAL_CLICK_RATE_V27 = 32000;',
  'function safeCrackerBuildOriginalClickPcmV27(context)',
  'const frameCount = Math.floor(binary.length / 2);',
  'let signed = low | (high << 8);',
  'if (signed & 0x8000) signed -= 0x10000;',
  'data[frame] = signed / 32768;',
  'function safeCrackerUnlockOriginalClickPcmV27()',
  'function safeCrackerFireOriginalClickPcmV27()',
  'function safeCrackerPlayOriginalPcmDetentV27(digit)',
  'source.playbackRate.setValueAtTime(1',
  'gain.gain.setValueAtTime(1.12',
  'gain.connect(context.destination);',
  'playDetent = safeCrackerPlayDetent;',
  'function safeCrackerStartSmoothVaultRoomToneV27()',
  'safeCrackerPlayAuthoritativeCorrectCue',
  'safeCrackerPlayIncorrectRejectCue',
  'choice: `safecracker:guess:${runtime.selected}`'
];
for (const fragment of required) {
  if (!client.includes(fragment)) throw new Error(`Safe Cracker original PCM v27 is missing ${fragment}.`);
}
if ((client.match(/SAFE_CRACKER_ORIGINAL_PCM_V27_START/g) || []).length !== 1) {
  throw new Error('Safe Cracker original PCM v27 marker must appear exactly once.');
}
await writeFile(clientUrl, client);

let html = await readFile(indexUrl, 'utf8');
html = html.replace(/\/assets\/safe-cracker\/safe-cracker\.js\?[^"'\s]*/g, value => {
  const clean = value.replace(/&clicks=\d+/g, '');
  return `${clean}&clicks=27`;
});
await writeFile(indexUrl, html);

console.log(`Applied Safe Cracker original PCM v27: ${originalPcmBytes.length} exact 16-bit source bytes (${originalPcmHash}) now play at 32 kHz through the proven direct WebAudio route.`);
