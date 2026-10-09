import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const prototypeUrl = new URL('assets/mountain-race/mountain-race.js', root);
const indexUrl = new URL('index.html', root);
const previewUrl = new URL('mountain-race-preview.html', root);
const marker = 'MOUNTAIN_RACE_WINNER_CAMERA_V53';

function required(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint V53 could not find ${label}.`);
  return source.replace(before, after);
}

let [runtime, prototype, html, preview] = await Promise.all([
  readFile(runtimeUrl, 'utf8'), readFile(prototypeUrl, 'utf8'),
  readFile(indexUrl, 'utf8'), readFile(previewUrl, 'utf8')
]);

for (const source of [runtime, prototype]) {
  if (!source.includes('MOUNTAIN_RACE_WINNER_SUMMIT_V52')) {
    throw new Error('Summit Sprint V53 requires the V52 winner summit pose first.');
  }
}

if (!runtime.includes(marker)) {
  runtime = required(runtime,
    "    root.dataset.mrWinnerSummit = '52';\n    // MOUNTAIN_RACE_WINNER_SUMMIT_V52",
    "    root.dataset.mrWinnerSummit = '52';\n    root.dataset.mrWinnerCamera = '53';\n    // MOUNTAIN_RACE_WINNER_CAMERA_V53\n    // MOUNTAIN_RACE_WINNER_SUMMIT_V52",
    'multiplayer V53 dataset');
  runtime = required(runtime,
    '      const cameraIndex = Math.max(0, Math.min(total, p.promptIndex));',
    "      const cameraIndex = animation === 'celebrate' ? total : Math.max(0, Math.min(total, p.promptIndex));",
    'multiplayer declared-winner summit camera');
}

if (!prototype.includes(marker)) {
  prototype = required(prototype,
    "    root.dataset.mrWinnerSummit = '52';\n    // MOUNTAIN_RACE_WINNER_SUMMIT_V52",
    "    root.dataset.mrWinnerSummit = '52';\n    root.dataset.mrWinnerCamera = '53';\n    // MOUNTAIN_RACE_WINNER_CAMERA_V53\n    // MOUNTAIN_RACE_WINNER_SUMMIT_V52",
    'prototype V53 dataset');
  prototype = required(prototype,
    '      const cameraIndex = Math.max(0, Math.min(total, player.promptIndex));',
    "      const cameraIndex = player.animation === 'celebrate' ? total : Math.max(0, Math.min(total, player.promptIndex));",
    'prototype declared-winner summit camera');
}

function updateDocument(source) {
  return source.replace(/(?:&visual=\d+)+/g, '&visual=53');
}

html = updateDocument(html);
preview = updateDocument(preview);

await Promise.all([
  writeFile(runtimeUrl, runtime), writeFile(prototypeUrl, prototype),
  writeFile(indexUrl, html), writeFile(previewUrl, preview)
]);

console.log('Applied Summit Sprint V53 declared-winner summit camera for completed-route and timeout victories.');
