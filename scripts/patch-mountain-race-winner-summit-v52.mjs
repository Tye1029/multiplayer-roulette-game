import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const prototypeUrl = new URL('assets/mountain-race/mountain-race.js', root);
const indexUrl = new URL('index.html', root);
const previewUrl = new URL('mountain-race-preview.html', root);
const marker = 'MOUNTAIN_RACE_WINNER_SUMMIT_V52';

function required(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint V52 could not find ${label}.`);
  return source.replace(before, after);
}

let [runtime, prototype, html, preview] = await Promise.all([
  readFile(runtimeUrl, 'utf8'), readFile(prototypeUrl, 'utf8'),
  readFile(indexUrl, 'utf8'), readFile(previewUrl, 'utf8')
]);

for (const source of [runtime, prototype]) {
  if (!source.includes('MOUNTAIN_RACE_SHARED_MOUNTAIN_V51')) {
    throw new Error('Summit Sprint V52 requires the V51 shared mountain first.');
  }
}

if (!runtime.includes(marker)) {
  runtime = required(runtime,
    "    root.dataset.mrSharedMountain = '51';\n    // MOUNTAIN_RACE_SHARED_MOUNTAIN_V51",
    "    root.dataset.mrSharedMountain = '51';\n    root.dataset.mrWinnerSummit = '52';\n    // MOUNTAIN_RACE_WINNER_SUMMIT_V52\n    // MOUNTAIN_RACE_SHARED_MOUNTAIN_V51",
    'multiplayer V52 dataset');
  runtime = required(runtime,
    '      const finished = Boolean(raw.finishedAt) || index >= Number(total || 0);',
    "      const finished = Boolean(raw.finishedAt) || index >= Number(total || 0) || animation === 'celebrate';",
    'multiplayer declared-winner summit pose');
}

if (!prototype.includes(marker)) {
  prototype = required(prototype,
    "    root.dataset.mrSharedMountain = '51';\n    // MOUNTAIN_RACE_SHARED_MOUNTAIN_V51",
    "    root.dataset.mrSharedMountain = '51';\n    root.dataset.mrWinnerSummit = '52';\n    // MOUNTAIN_RACE_WINNER_SUMMIT_V52\n    // MOUNTAIN_RACE_SHARED_MOUNTAIN_V51",
    'prototype V52 dataset');
  prototype = required(prototype,
    '      const finished = Boolean(player.finishedAt) || index >= TOTAL_HOLDS;',
    "      const finished = Boolean(player.finishedAt) || index >= TOTAL_HOLDS || player.animation === 'celebrate';",
    'prototype declared-winner summit pose');
}

function updateDocument(source) {
  return source.replace(/(?:&visual=\d+)+/g, '&visual=52');
}

html = updateDocument(html);
preview = updateDocument(preview);

await Promise.all([
  writeFile(runtimeUrl, runtime), writeFile(prototypeUrl, prototype),
  writeFile(indexUrl, html), writeFile(previewUrl, preview)
]);

console.log('Applied Summit Sprint V52 declared-winner summit pose for completed-route and timeout victories.');
