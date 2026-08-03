import { readFile, writeFile } from 'node:fs/promises';

const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const v18Start = '// SAFE_CRACKER_DIAL_SAMPLE_V18_START';
const v18End = '// SAFE_CRACKER_DIAL_SAMPLE_V18_END';
const v19Start = '// SAFE_CRACKER_DIAL_SAMPLE_V19_START';
const v19End = '// SAFE_CRACKER_DIAL_SAMPLE_V19_END';
const start = '// SAFE_CRACKER_DIAL_SAMPLE_V20_START';
const end = '// SAFE_CRACKER_DIAL_SAMPLE_V20_END';

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

client = removeSection(client, v18Start, v18End);
client = removeSection(client, v19Start, v19End);
client = removeSection(client, start, end);

const patch = String.raw`
  ${start}
  const SAFE_CRACKER_DIAL_SAMPLES_V20 = Object.freeze([
    '/assets/safe-cracker/audio-data-v3/bank-vault-dial-click-1.b64',
    '/assets/safe-cracker/audio-data-v3/bank-vault-dial-click-2.b64',
    '/assets/safe-cracker/audio-data-v3/bank-vault-dial-click-3.b64',
    '/assets/safe-cracker/audio-data-v3/bank-vault-dial-click-4.b64',
    '/assets/safe-cracker/audio-data-v3/bank-vault-dial-click-5.b64',
    '/assets/safe-cracker/audio-data-v3/bank-vault-dial-click-6.b64'
  ]);

  function safeCrackerPrefetchBankVaultDialTextsV20() {
    if (Array.isArray(runtime.safeCrackerBankVaultDialTextsV20) && runtime.safeCrackerBankVaultDialTextsV20.length === SAFE_CRACKER_DIAL_SAMPLES_V20.length) {
      return Promise.resolve(runtime.safeCrackerBankVaultDialTextsV20);
    }
    if (runtime.safeCrackerBankVaultDialTextPromiseV20) return runtime.safeCrackerBankVaultDialTextPromiseV20;
    runtime.safeCrackerBankVaultDialTextPromiseV20 = Promise.all(SAFE_CRACKER_DIAL_SAMPLES_V20.map(url =>
      fetch(url + '?clicks=20', { cache: 'force-cache' }).then(response => {
        if (!response.ok) throw new Error('Bank-vault dial sample request failed at ' + url);
        return response.text();
      })
    ))
      .then(texts => {
        runtime.safeCrackerBankVaultDialTextsV20 = texts;
        return texts;
      })
      .catch(error => {
        console.warn('[Safe Cracker audio] Failed to prefetch v20 bank-vault dial samples', error);
        return [];
      })
      .finally(() => { runtime.safeCrackerBankVaultDialTextPromiseV20 = null; });
    return runtime.safeCrackerBankVaultDialTextPromiseV20;
  }

  function safeCrackerPlayBankVaultDialBufferV20(digit) {
    const context = resumeAudio();
    const buffers = runtime.safeCrackerBankVaultDialBuffersV20;
    if (!context || document.hidden || !Array.isArray(buffers) || !buffers.length) return false;
    const previous = Number(runtime.safeCrackerBankVaultDialIndexV20 ?? -1);
    const index = (previous + 1) % buffers.length;
    runtime.safeCrackerBankVaultDialIndexV20 = index;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffers[index];
    source.playbackRate.setValueAtTime(1, context.currentTime);
    gain.gain.setValueAtTime(1.18, context.currentTime);
    gain.gain.setValueAtTime(1.18, context.currentTime + Math.max(0.02, source.buffer.duration - 0.035));
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + source.buffer.duration);
    source.connect(gain);
    gain.connect(safeCrackerAudioBus(context));
    source.start(context.currentTime);
    return true;
  }

  function safeCrackerDecodeBankVaultDialSamplesV20() {
    const context = resumeAudio();
    if (!context) return Promise.resolve([]);
    if (Array.isArray(runtime.safeCrackerBankVaultDialBuffersV20) && runtime.safeCrackerBankVaultDialBuffersV20.length === SAFE_CRACKER_DIAL_SAMPLES_V20.length) {
      return Promise.resolve(runtime.safeCrackerBankVaultDialBuffersV20);
    }
    if (runtime.safeCrackerBankVaultDialDecodePromiseV20) return runtime.safeCrackerBankVaultDialDecodePromiseV20;
    runtime.safeCrackerBankVaultDialDecodePromiseV20 = safeCrackerPrefetchBankVaultDialTextsV20()
      .then(texts => Promise.all(texts.map(text => context.decodeAudioData(safeCrackerRecordedBytes(text)))))
      .then(buffers => {
        runtime.safeCrackerBankVaultDialBuffersV20 = buffers;
        const pendingAt = Number(runtime.safeCrackerPendingBankVaultDialAtV20 || 0);
        const pendingDigit = runtime.safeCrackerPendingBankVaultDialDigitV20;
        runtime.safeCrackerPendingBankVaultDialAtV20 = 0;
        runtime.safeCrackerPendingBankVaultDialDigitV20 = null;
        if (pendingAt && performance.now() - pendingAt < 650) {
          window.setTimeout(() => {
            if (safeCrackerPlayBankVaultDialBufferV20(pendingDigit)) safeCrackerHaptic(3);
          }, 0);
        }
        return buffers;
      })
      .catch(error => {
        console.warn('[Safe Cracker audio] Failed to decode v20 bank-vault dial samples', error);
        return [];
      })
      .finally(() => { runtime.safeCrackerBankVaultDialDecodePromiseV20 = null; });
    return runtime.safeCrackerBankVaultDialDecodePromiseV20;
  }

  safeCrackerPlayDetent = function safeCrackerPlayReliableBankVaultDetent(digit) {
    const now = performance.now();
    if (now - Number(runtime.safeCrackerBankVaultDialAtV20 || 0) < 24) return;
    runtime.safeCrackerBankVaultDialAtV20 = now;
    if (safeCrackerPlayBankVaultDialBufferV20(digit)) {
      safeCrackerHaptic(3);
      return;
    }
    runtime.safeCrackerPendingBankVaultDialAtV20 = now;
    runtime.safeCrackerPendingBankVaultDialDigitV20 = digit;
    safeCrackerDecodeBankVaultDialSamplesV20();
  };
  playDetent = safeCrackerPlayDetent;

  document.addEventListener('pointerdown', safeCrackerDecodeBankVaultDialSamplesV20, { capture: true, passive: true });
  document.addEventListener('keydown', safeCrackerDecodeBankVaultDialSamplesV20, { capture: true });
  window.setTimeout(safeCrackerPrefetchBankVaultDialTextsV20, 0);
  ${end}
`;

const closing = '\n})();';
const closingIndex = client.lastIndexOf(closing);
if (closingIndex < 0) throw new Error('Bank-vault dial sample patch could not find the runtime closure.');
client = client.slice(0, closingIndex) + patch + client.slice(closingIndex);

const required = [
  start,
  'const SAFE_CRACKER_DIAL_SAMPLES_V20 = Object.freeze([',
  'function safeCrackerPrefetchBankVaultDialTextsV20()',
  'function safeCrackerDecodeBankVaultDialSamplesV20()',
  'function safeCrackerPlayBankVaultDialBufferV20(digit)',
  'function safeCrackerPlayReliableBankVaultDetent(digit)',
  'runtime.safeCrackerPendingBankVaultDialAtV20 = now;',
  'performance.now() - pendingAt < 650',
  'gain.gain.setValueAtTime(1.18',
  'playDetent = safeCrackerPlayDetent;',
  'safeCrackerPlayAuthoritativeCorrectCue',
  'safeCrackerPlayIncorrectRejectCue',
  'choice: `safecracker:guess:${runtime.selected}`'
];
for (const fragment of required) {
  if (!client.includes(fragment)) throw new Error(`Bank-vault dial sample patch is missing ${fragment}.`);
}
if ((client.match(/SAFE_CRACKER_DIAL_SAMPLE_V20_START/g) || []).length !== 1) {
  throw new Error('Bank-vault dial sample v20 marker must appear exactly once.');
}
await writeFile(clientUrl, client);

let html = await readFile(indexUrl, 'utf8');
html = html.replace(/\/assets\/safe-cracker\/safe-cracker\.js\?[^"'\s]*/g, value => {
  const clean = value.replace(/&clicks=\d+/g, '');
  return `${clean}&clicks=20`;
});
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker dial sample v20: uploaded vault clicks prefetch before interaction, decode on unlock, queue the first detent, and play at a clearly audible level.');
