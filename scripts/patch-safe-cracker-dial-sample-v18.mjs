import { readFile, writeFile } from 'node:fs/promises';

const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const start = '// SAFE_CRACKER_DIAL_SAMPLE_V18_START';
const end = '// SAFE_CRACKER_DIAL_SAMPLE_V18_END';

let client = await readFile(clientUrl, 'utf8');
if (!client.includes('// SAFE_CRACKER_DIAL_CLICK_V17_START')) {
  throw new Error('Bank-vault dial samples require the v17 dial ratchet runtime.');
}
if (!client.includes('// SAFE_CRACKER_RECORDED_SOUNDS_V13_START')) {
  throw new Error('Bank-vault dial samples require the recorded audio loader.');
}

if (!client.includes(start)) {
  const patch = String.raw`
  ${start}
  const SAFE_CRACKER_DIAL_SAMPLES_V18 = Object.freeze([
    '/assets/safe-cracker/audio-data-v3/bank-vault-dial-click-1.b64',
    '/assets/safe-cracker/audio-data-v3/bank-vault-dial-click-2.b64',
    '/assets/safe-cracker/audio-data-v3/bank-vault-dial-click-3.b64',
    '/assets/safe-cracker/audio-data-v3/bank-vault-dial-click-4.b64',
    '/assets/safe-cracker/audio-data-v3/bank-vault-dial-click-5.b64',
    '/assets/safe-cracker/audio-data-v3/bank-vault-dial-click-6.b64'
  ]);

  function safeCrackerLoadBankVaultDialSamples() {
    const context = audioContext();
    if (!context) return Promise.resolve([]);
    if (Array.isArray(runtime.safeCrackerBankVaultDialBuffers) && runtime.safeCrackerBankVaultDialBuffers.length === SAFE_CRACKER_DIAL_SAMPLES_V18.length) {
      return Promise.resolve(runtime.safeCrackerBankVaultDialBuffers);
    }
    if (runtime.safeCrackerBankVaultDialPromise) return runtime.safeCrackerBankVaultDialPromise;
    runtime.safeCrackerBankVaultDialPromise = Promise.all(SAFE_CRACKER_DIAL_SAMPLES_V18.map(url =>
      fetch(url + '?clicks=18', { cache: 'force-cache' })
        .then(response => {
          if (!response.ok) throw new Error('Bank-vault dial sample request failed at ' + url);
          return response.text();
        })
        .then(text => context.decodeAudioData(safeCrackerRecordedBytes(text)))
    ))
      .then(buffers => {
        runtime.safeCrackerBankVaultDialBuffers = buffers;
        return buffers;
      })
      .catch(error => {
        console.warn('[Safe Cracker audio] Failed to load bank-vault dial samples', error);
        return [];
      })
      .finally(() => { runtime.safeCrackerBankVaultDialPromise = null; });
    return runtime.safeCrackerBankVaultDialPromise;
  }

  function safeCrackerPlayBankVaultDialSample(digit) {
    const context = resumeAudio();
    const buffers = runtime.safeCrackerBankVaultDialBuffers;
    if (!context || document.hidden || !Array.isArray(buffers) || !buffers.length) {
      safeCrackerLoadBankVaultDialSamples();
      return false;
    }
    const step = Math.abs(Number(digit) || 0);
    const previous = Number(runtime.safeCrackerBankVaultDialIndex || 0);
    const index = (previous + 1 + (step % 2)) % buffers.length;
    runtime.safeCrackerBankVaultDialIndex = index;
    const source = context.createBufferSource();
    const highpass = context.createBiquadFilter();
    const lowpass = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffers[index];
    const rate = 0.985 + (step % 5) * 0.007;
    source.playbackRate.setValueAtTime(rate, context.currentTime);
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(135, context.currentTime);
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(10800, context.currentTime);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.5, context.currentTime + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.13);
    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(safeCrackerAudioBus(context));
    source.start(context.currentTime);
    return true;
  }

  const safeCrackerBankVaultDialFallback = safeCrackerPlayDetent;
  safeCrackerPlayDetent = function safeCrackerPlayRecordedBankVaultDetent(digit) {
    const now = performance.now();
    if (now - Number(runtime.safeCrackerBankVaultDialAt || 0) < 28) return;
    runtime.safeCrackerBankVaultDialAt = now;
    const played = safeCrackerPlayBankVaultDialSample(digit);
    if (!played) safeCrackerBankVaultDialFallback(digit);
    else safeCrackerHaptic(3);
  };
  playDetent = safeCrackerPlayDetent;

  document.addEventListener('pointerdown', safeCrackerLoadBankVaultDialSamples, { capture: true, passive: true });
  document.addEventListener('keydown', safeCrackerLoadBankVaultDialSamples, { capture: true });
  window.setTimeout(safeCrackerLoadBankVaultDialSamples, 0);
  ${end}
`;

  const closing = '\n})();';
  const closingIndex = client.lastIndexOf(closing);
  if (closingIndex < 0) throw new Error('Bank-vault dial sample patch could not find the runtime closure.');
  client = client.slice(0, closingIndex) + patch + client.slice(closingIndex);
}

const required = [
  start,
  'const SAFE_CRACKER_DIAL_SAMPLES_V18 = Object.freeze([',
  'function safeCrackerLoadBankVaultDialSamples()',
  'function safeCrackerPlayBankVaultDialSample(digit)',
  'function safeCrackerPlayRecordedBankVaultDetent(digit)',
  'safeCrackerRecordedBytes(text)',
  'gain.gain.exponentialRampToValueAtTime(0.5',
  'playDetent = safeCrackerPlayDetent;',
  'safeCrackerPlayAuthoritativeCorrectCue',
  'safeCrackerPlayIncorrectRejectCue',
  'choice: `safecracker:guess:${runtime.selected}`'
];
for (const fragment of required) {
  if (!client.includes(fragment)) throw new Error(`Bank-vault dial sample patch is missing ${fragment}.`);
}
if ((client.match(/SAFE_CRACKER_DIAL_SAMPLE_V18_START/g) || []).length !== 1) {
  throw new Error('Bank-vault dial sample marker must appear exactly once.');
}
await writeFile(clientUrl, client);

let html = await readFile(indexUrl, 'utf8');
html = html.replace(/\/assets\/safe-cracker\/safe-cracker\.js\?[^"'\s]*/g, value => {
  const clean = value.replace(/&clicks=\d+/g, '');
  return `${clean}&clicks=18`;
});
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker dial sample v18: six real bank-vault detents replace the generated ratchet while result cues remain unchanged.');
