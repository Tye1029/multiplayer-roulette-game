import { readFile, writeFile } from 'node:fs/promises';

const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const oldStart = '// SAFE_CRACKER_DIAL_SAMPLE_V18_START';
const oldEnd = '// SAFE_CRACKER_DIAL_SAMPLE_V18_END';
const start = '// SAFE_CRACKER_DIAL_SAMPLE_V19_START';
const end = '// SAFE_CRACKER_DIAL_SAMPLE_V19_END';

let client = await readFile(clientUrl, 'utf8');
if (!client.includes('// SAFE_CRACKER_DIAL_CLICK_V17_START')) {
  throw new Error('Bank-vault dial samples require the v17 dial ratchet runtime.');
}
if (!client.includes('// SAFE_CRACKER_RECORDED_SOUNDS_V13_START')) {
  throw new Error('Bank-vault dial samples require the recorded audio loader.');
}

function removeSection(source, begin, finish) {
  const from = source.indexOf(begin);
  if (from < 0) return source;
  const to = source.indexOf(finish, from);
  if (to < 0) throw new Error(`Could not close ${begin}.`);
  return source.slice(0, from) + source.slice(to + finish.length);
}

client = removeSection(client, oldStart, oldEnd);
client = removeSection(client, start, end);

const patch = String.raw`
  ${start}
  const SAFE_CRACKER_DIAL_SAMPLES_V19 = Object.freeze([
    '/assets/safe-cracker/audio-data-v3/bank-vault-dial-click-1.b64',
    '/assets/safe-cracker/audio-data-v3/bank-vault-dial-click-2.b64',
    '/assets/safe-cracker/audio-data-v3/bank-vault-dial-click-3.b64',
    '/assets/safe-cracker/audio-data-v3/bank-vault-dial-click-4.b64',
    '/assets/safe-cracker/audio-data-v3/bank-vault-dial-click-5.b64',
    '/assets/safe-cracker/audio-data-v3/bank-vault-dial-click-6.b64'
  ]);

  function safeCrackerLoadBankVaultDialSamplesV19() {
    const context = audioContext();
    if (!context) return Promise.resolve([]);
    if (Array.isArray(runtime.safeCrackerBankVaultDialBuffersV19) && runtime.safeCrackerBankVaultDialBuffersV19.length === SAFE_CRACKER_DIAL_SAMPLES_V19.length) {
      return Promise.resolve(runtime.safeCrackerBankVaultDialBuffersV19);
    }
    if (runtime.safeCrackerBankVaultDialPromiseV19) return runtime.safeCrackerBankVaultDialPromiseV19;
    runtime.safeCrackerBankVaultDialPromiseV19 = Promise.all(SAFE_CRACKER_DIAL_SAMPLES_V19.map(url =>
      fetch(url + '?clicks=19', { cache: 'force-cache' })
        .then(response => {
          if (!response.ok) throw new Error('Bank-vault dial sample request failed at ' + url);
          return response.text();
        })
        .then(text => context.decodeAudioData(safeCrackerRecordedBytes(text)))
    ))
      .then(buffers => {
        runtime.safeCrackerBankVaultDialBuffersV19 = buffers;
        return buffers;
      })
      .catch(error => {
        console.warn('[Safe Cracker audio] Failed to load v19 bank-vault dial samples', error);
        return [];
      })
      .finally(() => { runtime.safeCrackerBankVaultDialPromiseV19 = null; });
    return runtime.safeCrackerBankVaultDialPromiseV19;
  }

  function safeCrackerPlayBankVaultDialSampleV19(digit) {
    const context = resumeAudio();
    const buffers = runtime.safeCrackerBankVaultDialBuffersV19;
    if (!context || document.hidden || !Array.isArray(buffers) || !buffers.length) {
      safeCrackerLoadBankVaultDialSamplesV19();
      return false;
    }
    const previous = Number(runtime.safeCrackerBankVaultDialIndexV19 ?? -1);
    const index = (previous + 1) % buffers.length;
    runtime.safeCrackerBankVaultDialIndexV19 = index;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffers[index];
    source.playbackRate.setValueAtTime(1, context.currentTime);
    gain.gain.setValueAtTime(0.66, context.currentTime);
    gain.gain.setValueAtTime(0.66, context.currentTime + Math.max(0.02, source.buffer.duration - 0.035));
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + source.buffer.duration);
    source.connect(gain);
    gain.connect(safeCrackerAudioBus(context));
    source.start(context.currentTime);
    return true;
  }

  safeCrackerPlayDetent = function safeCrackerPlayUnfilteredBankVaultDetent(digit) {
    const now = performance.now();
    if (now - Number(runtime.safeCrackerBankVaultDialAtV19 || 0) < 24) return;
    runtime.safeCrackerBankVaultDialAtV19 = now;
    const played = safeCrackerPlayBankVaultDialSampleV19(digit);
    if (played) safeCrackerHaptic(3);
  };
  playDetent = safeCrackerPlayDetent;

  document.addEventListener('pointerdown', safeCrackerLoadBankVaultDialSamplesV19, { capture: true, passive: true });
  document.addEventListener('keydown', safeCrackerLoadBankVaultDialSamplesV19, { capture: true });
  window.setTimeout(safeCrackerLoadBankVaultDialSamplesV19, 0);
  ${end}
`;

const closing = '\n})();';
const closingIndex = client.lastIndexOf(closing);
if (closingIndex < 0) throw new Error('Bank-vault dial sample patch could not find the runtime closure.');
client = client.slice(0, closingIndex) + patch + client.slice(closingIndex);

const required = [
  start,
  'const SAFE_CRACKER_DIAL_SAMPLES_V19 = Object.freeze([',
  'function safeCrackerLoadBankVaultDialSamplesV19()',
  'function safeCrackerPlayBankVaultDialSampleV19(digit)',
  'function safeCrackerPlayUnfilteredBankVaultDetent(digit)',
  'source.playbackRate.setValueAtTime(1',
  'gain.gain.setValueAtTime(0.66',
  'playDetent = safeCrackerPlayDetent;',
  'safeCrackerPlayAuthoritativeCorrectCue',
  'safeCrackerPlayIncorrectRejectCue',
  'choice: `safecracker:guess:${runtime.selected}`'
];
for (const fragment of required) {
  if (!client.includes(fragment)) throw new Error(`Bank-vault dial sample patch is missing ${fragment}.`);
}
if ((client.match(/SAFE_CRACKER_DIAL_SAMPLE_V19_START/g) || []).length !== 1) {
  throw new Error('Bank-vault dial sample v19 marker must appear exactly once.');
}
await writeFile(clientUrl, client);

let html = await readFile(indexUrl, 'utf8');
html = html.replace(/\/assets\/safe-cracker\/safe-cracker\.js\?[^"'\s]*/g, value => {
  const clean = value.replace(/&clicks=\d+/g, '');
  return `${clean}&clicks=19`;
});
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker dial sample v19: longer minimally processed bank-vault clicks play at original speed with no synthetic fallback.');
