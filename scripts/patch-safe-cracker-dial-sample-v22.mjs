import { readFile, writeFile } from 'node:fs/promises';

const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const sections = Object.freeze([
  ['// SAFE_CRACKER_DIAL_SAMPLE_V18_START', '// SAFE_CRACKER_DIAL_SAMPLE_V18_END'],
  ['// SAFE_CRACKER_DIAL_SAMPLE_V19_START', '// SAFE_CRACKER_DIAL_SAMPLE_V19_END'],
  ['// SAFE_CRACKER_DIAL_SAMPLE_V20_START', '// SAFE_CRACKER_DIAL_SAMPLE_V20_END'],
  ['// SAFE_CRACKER_DIAL_SAMPLE_V21_START', '// SAFE_CRACKER_DIAL_SAMPLE_V21_END'],
  ['// SAFE_CRACKER_DIAL_SAMPLE_V22_START', '// SAFE_CRACKER_DIAL_SAMPLE_V22_END'],
  ['// SAFE_CRACKER_DIAL_SAMPLE_V23_START', '// SAFE_CRACKER_DIAL_SAMPLE_V23_END'],
  ['// SAFE_CRACKER_DIAL_PCM_V24_START', '// SAFE_CRACKER_DIAL_PCM_V24_END']
]);
const start = '// SAFE_CRACKER_DIAL_PCM_V24_START';
const end = '// SAFE_CRACKER_DIAL_PCM_V24_END';

let client = await readFile(clientUrl, 'utf8');
if (!client.includes('// SAFE_CRACKER_AUDIO_PASS_V10_START')) {
  throw new Error('Safe Cracker PCM dial v24 requires the WebAudio runtime.');
}
if (!client.includes('// SAFE_CRACKER_DIAL_ACTIVITY_V16_START')) {
  throw new Error('Safe Cracker PCM dial v24 requires the protected dial activity runtime.');
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

const patch = String.raw`
  ${start}
  function safeCrackerBuildMechanicalPcmV24(context) {
    if (runtime.safeCrackerMechanicalPcmV24?.sampleRate === context.sampleRate) {
      return runtime.safeCrackerMechanicalPcmV24;
    }
    const duration = 0.105;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 0x6d2b79f5;
    let peak = 0.0001;
    const random = () => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return ((seed >>> 0) / 4294967295) * 2 - 1;
    };
    for (let index = 0; index < length; index += 1) {
      const time = index / context.sampleRate;
      const attack = random() * Math.exp(-time * 235) * 0.72;
      const steelA = Math.sin(Math.PI * 2 * 1680 * time) * Math.exp(-time * 82) * 0.34;
      const steelB = Math.sin(Math.PI * 2 * 2860 * time + 0.44) * Math.exp(-time * 118) * 0.23;
      const steelC = Math.sin(Math.PI * 2 * 4180 * time + 1.1) * Math.exp(-time * 155) * 0.13;
      const body = Math.sin(Math.PI * 2 * 238 * time) * Math.exp(-time * 54) * 0.2;
      const catchTime = time - 0.012;
      const catchClick = catchTime > 0
        ? (random() * Math.exp(-catchTime * 275) * 0.42 + Math.sin(Math.PI * 2 * 1120 * catchTime) * Math.exp(-catchTime * 105) * 0.2)
        : 0;
      const reboundTime = time - 0.033;
      const rebound = reboundTime > 0
        ? (random() * Math.exp(-reboundTime * 320) * 0.2 + Math.sin(Math.PI * 2 * 2050 * reboundTime) * Math.exp(-reboundTime * 145) * 0.12)
        : 0;
      const sample = Math.tanh((attack + steelA + steelB + steelC + body + catchClick + rebound) * 1.28);
      data[index] = sample;
      peak = Math.max(peak, Math.abs(sample));
    }
    const scale = 0.88 / peak;
    for (let index = 0; index < data.length; index += 1) data[index] *= scale;
    runtime.safeCrackerMechanicalPcmV24 = buffer;
    return buffer;
  }

  function safeCrackerUnlockMechanicalPcmV24() {
    const context = resumeAudio();
    if (!context) return;
    safeCrackerBuildMechanicalPcmV24(context);
    try {
      const source = context.createBufferSource();
      source.buffer = context.createBuffer(1, 1, context.sampleRate || 44100);
      source.connect(context.destination);
      source.start(context.currentTime);
    } catch {}
  }

  function safeCrackerFireMechanicalPcmV24() {
    const context = resumeAudio();
    if (!context || document.hidden) return false;
    const fire = () => {
      const source = context.createBufferSource();
      const highpass = context.createBiquadFilter();
      const gain = context.createGain();
      source.buffer = safeCrackerBuildMechanicalPcmV24(context);
      highpass.type = 'highpass';
      highpass.frequency.setValueAtTime(65, context.currentTime);
      highpass.Q.setValueAtTime(0.55, context.currentTime);
      gain.gain.setValueAtTime(0.92, context.currentTime);
      source.connect(highpass);
      highpass.connect(gain);
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

  safeCrackerPlayDetent = function safeCrackerPlayMechanicalPcmDetentV24(digit) {
    const now = performance.now();
    if (document.hidden || now - Number(runtime.safeCrackerMechanicalPcmAtV24 || 0) < 26) return;
    runtime.safeCrackerMechanicalPcmAtV24 = now;
    safeCrackerFireMechanicalPcmV24();
    safeCrackerHaptic(4);
  };
  playDetent = safeCrackerPlayDetent;

  function safeCrackerSmoothRoomToneBufferV24(context) {
    if (runtime.safeCrackerSmoothRoomToneBufferV24?.sampleRate === context.sampleRate) return runtime.safeCrackerSmoothRoomToneBufferV24;
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
    runtime.safeCrackerSmoothRoomToneBufferV24 = buffer;
    return buffer;
  }

  safeCrackerStartRecordedAmbience = function safeCrackerStartSmoothVaultRoomToneV24() {
    if (!safeCrackerRecordedModeActive() || runtime.safeCrackerRecordedAmbience) return;
    const context = resumeAudio();
    if (!context) return;
    const source = context.createBufferSource();
    const highpass = context.createBiquadFilter();
    const lowpass = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = safeCrackerSmoothRoomToneBufferV24(context);
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
    runtime.safeCrackerRecordedAmbience = { source, gain, context, smoothRoomToneV24: true };
  };

  document.addEventListener('pointerdown', safeCrackerUnlockMechanicalPcmV24, { capture: true, passive: true });
  document.addEventListener('touchstart', safeCrackerUnlockMechanicalPcmV24, { capture: true, passive: true });
  document.addEventListener('keydown', safeCrackerUnlockMechanicalPcmV24, { capture: true });
  ${end}
`;

const closing = '\n})();';
const closingIndex = client.lastIndexOf(closing);
if (closingIndex < 0) throw new Error('Safe Cracker PCM dial v24 could not find the runtime closure.');
client = client.slice(0, closingIndex) + patch + client.slice(closingIndex);

const required = [
  start,
  'function safeCrackerBuildMechanicalPcmV24(context)',
  'context.createBuffer(1, length, context.sampleRate)',
  'function safeCrackerUnlockMechanicalPcmV24()',
  'function safeCrackerFireMechanicalPcmV24()',
  'function safeCrackerPlayMechanicalPcmDetentV24(digit)',
  'gain.connect(context.destination);',
  'source.start(context.currentTime);',
  'playDetent = safeCrackerPlayDetent;',
  'function safeCrackerStartSmoothVaultRoomToneV24()',
  'safeCrackerPlayAuthoritativeCorrectCue',
  'safeCrackerPlayIncorrectRejectCue',
  'choice: `safecracker:guess:${runtime.selected}`'
];
for (const fragment of required) {
  if (!client.includes(fragment)) throw new Error(`Safe Cracker PCM dial v24 is missing ${fragment}.`);
}
if ((client.match(/SAFE_CRACKER_DIAL_PCM_V24_START/g) || []).length !== 1) {
  throw new Error('Safe Cracker PCM dial v24 marker must appear exactly once.');
}
await writeFile(clientUrl, client);

let html = await readFile(indexUrl, 'utf8');
html = html.replace(/\/assets\/safe-cracker\/safe-cracker\.js\?[^"'\s]*/g, value => {
  const clean = value.replace(/&clicks=\d+/g, '');
  return `${clean}&clicks=24`;
});
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker dial PCM v24: a synchronous browser-generated steel ratchet buffer replaces the silent native MP3 route and plays directly through the active AudioContext.');
