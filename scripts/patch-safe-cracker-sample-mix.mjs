import { readFile, writeFile } from 'node:fs/promises';

const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const mixStart = '// SAFE_CRACKER_SAMPLE_MIX_V11_START';
const mixEnd = '// SAFE_CRACKER_SAMPLE_MIX_V11_END';

let client = await readFile(clientUrl, 'utf8');
if (!client.includes('// SAFE_CRACKER_AUDIO_PASS_V10_START')) {
  throw new Error('Safe Cracker sample mix requires audio pass v10 first.');
}

if (!client.includes(mixStart)) {
  const sampleMix = String.raw`
  ${mixStart}
  const SAFE_CRACKER_SAMPLE_MANIFEST = Object.freeze({
    submitLatch: '/assets/safe-cracker/audio-data/submit-latch.b64',
    tumblerLock: '/assets/safe-cracker/audio-data/tumbler-lock.b64',
    safeUnlock: '/assets/safe-cracker/audio-data/safe-unlock.b64',
    boltMechanism: '/assets/safe-cracker/audio-data/safe-bolt-mechanism.b64',
    safeDoorOpen: '/assets/safe-cracker/audio-data/safe-door-open.b64',
    safeDoorLockdown: '/assets/safe-cracker/audio-data/safe-door-lockdown.b64'
  });

  function safeCrackerBase64Bytes(source) {
    const clean = String(source || '').replace(/\\s+/g, '');
    const binary = window.atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes.buffer;
  }

  function safeCrackerLoadSample(name) {
    const url = SAFE_CRACKER_SAMPLE_MANIFEST[name];
    const context = audioContext();
    if (!url || !context) return Promise.resolve(null);
    runtime.safeCrackerSampleBuffers ||= Object.create(null);
    runtime.safeCrackerSamplePromises ||= Object.create(null);
    if (runtime.safeCrackerSampleBuffers[name]) return Promise.resolve(runtime.safeCrackerSampleBuffers[name]);
    if (runtime.safeCrackerSamplePromises[name]) return runtime.safeCrackerSamplePromises[name];
    const promise = fetch(url, { cache: 'force-cache' })
      .then(response => {
        if (!response.ok) throw new Error('Sample request failed: ' + name);
        return response.text();
      })
      .then(encoded => context.decodeAudioData(safeCrackerBase64Bytes(encoded).slice(0)))
      .then(buffer => {
        runtime.safeCrackerSampleBuffers[name] = buffer;
        return buffer;
      })
      .catch(() => null)
      .finally(() => { delete runtime.safeCrackerSamplePromises[name]; });
    runtime.safeCrackerSamplePromises[name] = promise;
    return promise;
  }

  function safeCrackerPrimeSamples() {
    for (const name of Object.keys(SAFE_CRACKER_SAMPLE_MANIFEST)) safeCrackerLoadSample(name);
  }

  function safeCrackerPlaySample(name, options = {}) {
    const context = resumeAudio();
    const buffer = runtime.safeCrackerSampleBuffers?.[name];
    if (!context || !buffer || document.hidden) {
      safeCrackerLoadSample(name);
      return false;
    }
    const delay = Math.max(0, Number(options.delay) || 0);
    const startAt = context.currentTime + delay;
    const source = context.createBufferSource();
    const gain = context.createGain();
    const highpass = context.createBiquadFilter();
    const lowpass = context.createBiquadFilter();
    source.buffer = buffer;
    source.playbackRate.setValueAtTime(Math.max(0.72, Math.min(1.28, Number(options.playbackRate) || 1)), startAt);
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(Math.max(20, Number(options.highpass) || 35), startAt);
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(Math.max(800, Number(options.lowpass) || 12000), startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, Number(options.gain) || 0.18), startAt + 0.012);
    const releaseAt = startAt + Math.max(0.08, buffer.duration / Math.max(0.72, Number(options.playbackRate) || 1) - 0.05);
    gain.gain.setValueAtTime(Math.max(0.0002, Number(options.gain) || 0.18), Math.max(startAt + 0.013, releaseAt - 0.07));
    gain.gain.exponentialRampToValueAtTime(0.0001, releaseAt + 0.05);
    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(safeCrackerAudioBus(context));
    source.start(startAt);
    return true;
  }

  const safeCrackerSubmitSynth = safeCrackerPlaySubmit;
  safeCrackerPlaySubmit = function safeCrackerPlaySubmitSampleMix() {
    safeCrackerSubmitSynth();
    safeCrackerPlaySample('submitLatch', { gain: 0.18, playbackRate: 1.06, highpass: 105, lowpass: 7200 });
  };

  const safeCrackerTumblerSynth = safeCrackerPlayTumblerLock;
  safeCrackerPlayTumblerLock = function safeCrackerPlayTumblerSampleMix() {
    safeCrackerTumblerSynth();
    safeCrackerPlaySample('tumblerLock', { gain: 0.24, playbackRate: 1.03, highpass: 80, lowpass: 8500 });
  };

  const safeCrackerOpenSynth = safeCrackerPlaySafeOpen;
  safeCrackerPlaySafeOpen = function safeCrackerPlaySafeOpenSampleMix() {
    const unlock = safeCrackerPlaySample('safeUnlock', { gain: 0.27, delay: 0.01, highpass: 42, lowpass: 9300 });
    const bolts = safeCrackerPlaySample('boltMechanism', { gain: 0.19, delay: 0.16, playbackRate: 0.96, highpass: 52, lowpass: 7600 });
    const door = safeCrackerPlaySample('safeDoorOpen', { gain: 0.25, delay: 0.46, playbackRate: 0.97, highpass: 36, lowpass: 9200 });
    if (!unlock && !bolts && !door) {
      safeCrackerOpenSynth();
      return;
    }
    safeCrackerPlayTone(286, 0.4, 0.012, 'triangle', 0.76, { endFrequency: 386, filterFrequency: 3100 });
    safeCrackerPlayTone(568, 0.46, 0.009, 'sine', 0.86, { endFrequency: 704, filterFrequency: 5100 });
  };

  const safeCrackerResultSequenceSynth = safeCrackerPlayResultSequence;
  safeCrackerPlayResultSequence = function safeCrackerPlayResultSequenceSampleMix(game, won, tied) {
    const gameId = String(game?.gameId || '');
    const key = gameId + ':' + (won ? 'win' : tied ? 'tie' : 'lose');
    if (gameId && runtime.safeCrackerSampleResultKey !== key) {
      runtime.safeCrackerSampleResultKey = key;
      if (tied) {
        safeCrackerPlaySample('safeDoorLockdown', { gain: 0.14, delay: 0.04, playbackRate: 0.91, highpass: 34, lowpass: 5600 });
      } else if (!won) {
        safeCrackerPlaySample('safeDoorLockdown', { gain: 0.2, delay: 0.02, playbackRate: 1.02, highpass: 34, lowpass: 6900 });
      }
    }
    return safeCrackerResultSequenceSynth(game, won, tied);
  };
  if (typeof playSafeCrackerResultSequence === 'function') playSafeCrackerResultSequence = safeCrackerPlayResultSequence;

  document.addEventListener('pointerdown', safeCrackerPrimeSamples, { capture: true, once: true });
  document.addEventListener('keydown', safeCrackerPrimeSamples, { capture: true, once: true });
  window.addEventListener(STATE_EVENT, event => {
    if (event?.detail?.game?.mode === 'safecracker') safeCrackerPrimeSamples();
  });
  ${mixEnd}
`;

  const closing = '\n})();';
  const closingIndex = client.lastIndexOf(closing);
  if (closingIndex < 0) throw new Error('Safe Cracker sample mix could not find the runtime closure.');
  client = client.slice(0, closingIndex) + sampleMix + client.slice(closingIndex);
}

const requirements = [
  mixStart,
  'function safeCrackerLoadSample(name)',
  'function safeCrackerPlaySample(name, options = {})',
  "safeCrackerPlaySample('submitLatch'",
  "safeCrackerPlaySample('tumblerLock'",
  "safeCrackerPlaySample('safeUnlock'",
  "safeCrackerPlaySample('boltMechanism'",
  "safeCrackerPlaySample('safeDoorOpen'",
  "safeCrackerPlaySample('safeDoorLockdown'"
];
for (const signature of requirements) {
  if (!client.includes(signature)) throw new Error(`Safe Cracker sample mix is missing ${signature}.`);
}
if (!client.includes('choice: `safecracker:guess:${runtime.selected}`')) {
  throw new Error('Safe Cracker sample mix disturbed authoritative guess submission.');
}
if (client.split(mixStart).length - 1 !== 1 || client.split(mixEnd).length - 1 !== 1) {
  throw new Error('Safe Cracker sample mix marker must appear exactly once.');
}
await writeFile(clientUrl, client);

let html = await readFile(indexUrl, 'utf8');
if (!html.includes('&audio=1&samples=1')) {
  html = html.replaceAll(
    '/assets/safe-cracker/safe-cracker.js?v=8&polish=2&fit=2&result=1&final=1&refine=1&correct=1&input=1&audio=1',
    '/assets/safe-cracker/safe-cracker.js?v=8&polish=2&fit=2&result=1&final=1&refine=1&correct=1&input=1&audio=1&samples=1'
  );
}
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker sample mix v11: user-supplied vault sounds are trimmed, normalized, layered, and scoped to submission, tumbler lock, opening, loss, and tie events.');
