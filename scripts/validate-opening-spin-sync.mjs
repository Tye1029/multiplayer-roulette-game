import { readFile } from 'node:fs/promises';

const sync = await readFile(new URL('../assets/roulette/opening-spin-sync.js', import.meta.url), 'utf8');
const inject = await readFile(new URL('./inject-lamp-assets.mjs', import.meta.url), 'utf8');
const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');

for (const required of [
  "const OPENING_SPIN_PATH = '/assets/roulette/audio/revolver-spinning-on-wood-v4.mp3'",
  'const RAPID_FADE_START_PROGRESS = 0.40',
  'const RAPID_FADE_END_PROGRESS = 0.53',
  'const RAPID_FADE_LEVEL = 0.08',
  'const SILENT_PROGRESS = 0.74',
  'function openingVolumeEnvelope(progress)',
  'function findOpeningAnimation()',
  '.getAnimations()',
  "clip.addEventListener('loadedmetadata', synchronize)",
  "clip.addEventListener('playing', startTracking)",
  'remainingAudioSeconds / remainingAnimationSeconds',
  'clip.volume = baseVolume * openingVolumeEnvelope(progress)',
  'requestAnimationFrame(trackEnvelope)',
  'clip.preservesPitch = true',
  'global.Audio = SyncedAudio'
]) {
  if (!sync.includes(required)) {
    throw new Error(`Opening-spin synchronization is missing ${required}`);
  }
}

const syncTag = '<script src="/assets/roulette/opening-spin-sync.js?v=4" defer></script>';
const bindingsTag = '<script src="/assets/roulette/audio-bindings.js?v=5" defer></script>';

for (const source of [inject, index]) {
  const syncIndex = source.indexOf(syncTag);
  const bindingsIndex = source.indexOf(bindingsTag);
  if (syncIndex < 0 || bindingsIndex < 0 || syncIndex > bindingsIndex) {
    throw new Error('Opening-spin synchronization must load before direct audio bindings.');
  }
}

console.log('Opening-spin audio follows the active animation duration, fades slightly earlier through the slowdown, and becomes silent before the final settle.');
