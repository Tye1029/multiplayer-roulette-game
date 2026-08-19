import { readFile, writeFile } from 'node:fs/promises';

const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const start = '// SAFE_CRACKER_DIAL_CLICK_V17_START';
const end = '// SAFE_CRACKER_DIAL_CLICK_V17_END';

let client = await readFile(clientUrl, 'utf8');
if (!client.includes('// SAFE_CRACKER_CLICK_CUES_V16_START')) {
  throw new Error('Safe Cracker dial click v17 requires click cues v16.');
}
if (!client.includes('// SAFE_CRACKER_DIAL_ACTIVITY_V16_START')) {
  throw new Error('Safe Cracker dial click v17 requires dial activity retention v16.');
}

if (!client.includes(start)) {
  const patch = String.raw`
  ${start}
  function safeCrackerRatchetNoiseBuffer(context) {
    if (runtime.safeCrackerRatchetNoiseBuffer?.sampleRate === context.sampleRate) {
      return runtime.safeCrackerRatchetNoiseBuffer;
    }
    const length = Math.max(160, Math.floor(context.sampleRate * 0.065));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      const toothEnvelope = Math.exp(-index / Math.max(1, context.sampleRate * 0.00135));
      const scrapeEnvelope = Math.exp(-index / Math.max(1, context.sampleRate * 0.0095));
      const randomMetal = (Math.random() * 2 - 1) * (0.82 * toothEnvelope + 0.15 * scrapeEnvelope);
      const edge = index === 0 ? 0.98 : index === 1 ? -0.88 : index === 2 ? 0.56 : index === 3 ? -0.27 : 0;
      const chatter = index > 3 && index < Math.floor(context.sampleRate * 0.018) && index % 17 === 0
        ? (index % 34 === 0 ? 0.16 : -0.13) * scrapeEnvelope
        : 0;
      data[index] = Math.max(-1, Math.min(1, edge + randomMetal + chatter));
    }
    runtime.safeCrackerRatchetNoiseBuffer = buffer;
    return buffer;
  }

  function safeCrackerPlayRatchetImpulse(options = {}) {
    const context = resumeAudio();
    if (!context || document.hidden) return false;
    const delay = Math.max(0, Number(options.delay) || 0);
    const duration = Math.max(0.009, Number(options.duration) || 0.022);
    const startAt = context.currentTime + delay;
    const finishAt = startAt + duration;
    const source = context.createBufferSource();
    const highpass = context.createBiquadFilter();
    const bandpass = context.createBiquadFilter();
    const gain = context.createGain();

    source.buffer = safeCrackerRatchetNoiseBuffer(context);
    source.playbackRate.setValueAtTime(
      Math.max(0.78, Math.min(1.34, Number(options.playbackRate) || 1)),
      startAt
    );
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(Math.max(90, Number(options.highpass) || 700), startAt);
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(Math.max(220, Number(options.frequency) || 3200), startAt);
    bandpass.Q.setValueAtTime(Math.max(0.55, Number(options.q) || 4.8), startAt);
    const level = Math.max(0.002, Number(options.gain) || 0.16);
    gain.gain.setValueAtTime(level, startAt);
    gain.gain.exponentialRampToValueAtTime(0.0001, finishAt);

    source.connect(highpass);
    highpass.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(safeCrackerAudioBus(context));
    source.start(startAt);
    source.stop(finishAt + 0.012);
    return true;
  }

  function safeCrackerPlayMechanicalRatchetClick(digit) {
    const step = Math.abs(Number(digit) || 0) % 6;
    const variation = step * 24;
    const toothStrike = safeCrackerPlayRatchetImpulse({
      duration: 0.013,
      gain: 0.335,
      highpass: 1750,
      frequency: 5050 + variation,
      q: 9.4,
      playbackRate: 1.04 + step * 0.006
    });
    const steelScrape = safeCrackerPlayRatchetImpulse({
      delay: 0.004,
      duration: 0.027,
      gain: 0.105,
      highpass: 860,
      frequency: 2860 + variation * 0.7,
      q: 1.65,
      playbackRate: 0.91 + step * 0.005
    });
    const pawlCatch = safeCrackerPlayRatchetImpulse({
      delay: 0.019,
      duration: 0.033,
      gain: 0.205,
      highpass: 310,
      frequency: 1420 + variation * 0.45,
      q: 4.7,
      playbackRate: 0.96 + step * 0.004
    });
    const reboundClick = safeCrackerPlayRatchetImpulse({
      delay: 0.039,
      duration: 0.014,
      gain: 0.092,
      highpass: 1180,
      frequency: 3670 + variation,
      q: 7.1,
      playbackRate: 1.01 + step * 0.005
    });
    return Boolean(toothStrike || steelScrape || pawlCatch || reboundClick);
  }

  const safeCrackerMechanicalDetentFallback = safeCrackerPlayDetent;
  safeCrackerPlayDetent = function safeCrackerPlayMechanicalRatchetDetent(digit) {
    const now = performance.now();
    if (now - Number(runtime.safeCrackerMechanicalDetentAt || 0) < 24) return;
    runtime.safeCrackerMechanicalDetentAt = now;
    const played = safeCrackerPlayMechanicalRatchetClick(digit);
    if (!played) safeCrackerMechanicalDetentFallback(digit);
    else safeCrackerHaptic(4);
  };
  playDetent = safeCrackerPlayDetent;
  ${end}
`;

  const closing = '\n})();';
  const closingIndex = client.lastIndexOf(closing);
  if (closingIndex < 0) throw new Error('Safe Cracker dial click v17 could not find the runtime closure.');
  client = client.slice(0, closingIndex) + patch + client.slice(closingIndex);
}

const required = [
  start,
  'function safeCrackerRatchetNoiseBuffer(context)',
  'function safeCrackerPlayRatchetImpulse(options = {})',
  'function safeCrackerPlayMechanicalRatchetClick(digit)',
  'const toothStrike = safeCrackerPlayRatchetImpulse({',
  'const steelScrape = safeCrackerPlayRatchetImpulse({',
  'const pawlCatch = safeCrackerPlayRatchetImpulse({',
  'const reboundClick = safeCrackerPlayRatchetImpulse({',
  'function safeCrackerPlayMechanicalRatchetDetent(digit)',
  'playDetent = safeCrackerPlayDetent;',
  '// SAFE_CRACKER_CLICK_CUES_V16_START',
  'function safeCrackerPlayAuthoritativeCorrectCue(game, completedStage)',
  'function safeCrackerPlayIncorrectRejectCue(tier)',
  'choice: `safecracker:guess:${runtime.selected}`'
];
for (const fragment of required) {
  if (!client.includes(fragment)) throw new Error(`Safe Cracker dial click v17 is missing ${fragment}.`);
}
if ((client.match(/SAFE_CRACKER_DIAL_CLICK_V17_START/g) || []).length !== 1) {
  throw new Error('Safe Cracker dial click v17 marker must appear exactly once.');
}
await writeFile(clientUrl, client);

let html = await readFile(indexUrl, 'utf8');
html = html.replace(/\/assets\/safe-cracker\/safe-cracker\.js\?[^"'\s]*/g, value => {
  const clean = value.replace(/&clicks=\d+/g, '');
  return `${clean}&clicks=17`;
});
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker dial click v17: sharp tooth strike, steel scrape, pawl catch, and rebound with no musical oscillator layer.');
