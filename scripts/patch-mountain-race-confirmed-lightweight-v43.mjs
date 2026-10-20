import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const prototypeUrl = new URL('assets/mountain-race/mountain-race.js', root);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', root);
const indexUrl = new URL('index.html', root);
const previewUrl = new URL('mountain-race-preview.html', root);
const marker = 'MOUNTAIN_RACE_CONFIRMED_LIGHTWEIGHT_V43';
const required = (source, before, after, label) => {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint V43 could not find ${label}.`);
  return source.replace(before, after);
};

let [runtime, prototype, css, html, preview] = await Promise.all([
  readFile(runtimeUrl, 'utf8'), readFile(prototypeUrl, 'utf8'), readFile(cssUrl, 'utf8'),
  readFile(indexUrl, 'utf8'), readFile(previewUrl, 'utf8')
]);

if (!runtime.includes(marker)) {
  runtime = required(runtime,
    '        me.promptIndex = Math.min(total, me.promptIndex + 1);',
    '        me.promptIndex = Math.min(Math.max(0, total - 1), me.promptIndex + 1);',
    'unconfirmed summit guard');
  runtime = required(runtime,
    "    const startMeadow = '<div class=\"mr-start-meadow\" style=\"--mr-start-bottom:38px\" aria-hidden=\"true\"><span></span><i></i></div>';\n    return startMeadow + Array.from({ length: total }, (_, index) => {",
    "    const startMeadow = currentIndex < 5 ? '<div class=\"mr-start-meadow\" style=\"--mr-start-bottom:38px\" aria-hidden=\"true\"><span></span><i></i></div>' : '';\n    const firstVisible = Math.max(0, currentIndex - 3);\n    const lastVisible = Math.min(total - 1, currentIndex + 5);\n    return startMeadow + Array.from({ length: Math.max(0, lastVisible - firstVisible + 1) }, (_, offset) => {\n      const index = firstVisible + offset;",
    'multiplayer nearby holds');
  runtime = required(runtime,
    "    if (!bridge?.submit || runtime.game?.status !== 'playing' || !publicState.canSubmit || runtime.inputQueueBlocked) return;",
    "    if (!bridge?.submit || runtime.game?.status !== 'playing' || !publicState.canSubmit || runtime.inputQueueBlocked || runtime.inputQueue.length || runtime.inputBatchInFlight.length) return;\n    // MOUNTAIN_RACE_CONFIRMED_LIGHTWEIGHT_V43",
    'single unconfirmed input guard');
  runtime = required(runtime,
    "    const controlsEnabled = runtime.game.status === 'playing' && publicState.canSubmit && prompts.length > 0 && !presentation.blocked && !runtime.inputQueueBlocked;",
    "    const controlsEnabled = runtime.game.status === 'playing' && publicState.canSubmit && prompts.length > 0 && !presentation.blocked && !runtime.inputQueueBlocked && runtime.inputQueue.length === 0 && runtime.inputBatchInFlight.length === 0;",
    'pending control disable');
  runtime = required(runtime,
    '    scheduleInputFlush(!item.correct || queuedCount >= 8);',
    '    scheduleInputFlush(true);',
    'immediate single-input flush');
}

if (!prototype.includes(marker)) {
  prototype = required(prototype,
    '    const holds = state.sequence.map((token, index) => {',
    "    const firstVisible = Math.max(0, player.promptIndex - 3);\n    const lastVisible = Math.min(total - 1, player.promptIndex + 5);\n    const holds = state.sequence.slice(firstVisible, lastVisible + 1).map((token, offset) => {\n      const index = firstVisible + offset;\n      // MOUNTAIN_RACE_CONFIRMED_LIGHTWEIGHT_V43",
    'prototype nearby holds');
}

if (!css.includes(marker)) css += String.raw`

/* MOUNTAIN_RACE_CONFIRMED_LIGHTWEIGHT_V43
   Retire decorative animation/filter work; preserve gameplay art and clarity. */
[data-mountain-race-mount][data-mr-generated-assets="29"] :is(.mr-world-cloud,.mr-world-snow,.mr-route-depth,.mr-rope-anchor,.mr-stage-ridge i) {
  display: none !important;
  animation: none !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] :is(.mr-cliff-art,.mr-mountain-wall,.mr-start-art,.mr-finish-ledge,.mr-rock-hold,.mr-climber) {
  filter: none !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] :is(.mr-player-card,.mr-command-deck,.mr-next-moves) {
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-rock-hold.distant {
  visibility: hidden !important;
}
`;

html = html.replace(/(?:&visual=\d+)+/g, '&visual=43');
preview = preview.replace(/(?:&visual=\d+)+/g, '&visual=43');
await Promise.all([
  writeFile(runtimeUrl, runtime), writeFile(prototypeUrl, prototype), writeFile(cssUrl, css),
  writeFile(indexUrl, html), writeFile(previewUrl, preview)
]);
console.log('Applied Summit Sprint V43 confirmed progress and lightweight nearby-scene rendering.');
