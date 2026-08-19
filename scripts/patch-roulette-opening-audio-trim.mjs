import { readFile, writeFile } from 'node:fs/promises';

const syncUrl = new URL('../assets/roulette/opening-spin-sync.js', import.meta.url);
let sync = await readFile(syncUrl, 'utf8');

function replaceOnce(source, label, before, after) {
  if (source.includes(after)) return source;
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Opening audio trim patch could not find ${label}.`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Opening audio trim patch found more than one ${label}.`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

sync = replaceOnce(
  sync,
  'the rapid fade endpoint',
  '  const RAPID_FADE_END_PROGRESS = 0.53;',
  '  const RAPID_FADE_END_PROGRESS = 0.50;'
);
sync = replaceOnce(
  sync,
  'the settle fade endpoint',
  '  const SETTLE_FADE_END_PROGRESS = 0.66;',
  '  const SETTLE_FADE_END_PROGRESS = 0.58;'
);
sync = replaceOnce(
  sync,
  'the silent endpoint',
  '  const SILENT_PROGRESS = 0.74;',
  '  const SILENT_PROGRESS = 0.646;'
);

for (const required of [
  'const FALLBACK_ANIMATION_MS = 5300;',
  'const RAPID_FADE_START_PROGRESS = 0.40;',
  'const RAPID_FADE_END_PROGRESS = 0.50;',
  'const SETTLE_FADE_END_PROGRESS = 0.58;',
  'const SILENT_PROGRESS = 0.646;'
]) {
  if (!sync.includes(required)) throw new Error(`Opening audio trim is missing ${required}`);
}

await writeFile(syncUrl, sync);
console.log('Trimmed the choosing-first-player spin recording by about 0.5 seconds without changing the 5.3-second visual animation or Spin button audio.');