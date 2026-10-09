import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const prototypeUrl = new URL('assets/mountain-race/mountain-race.js', root);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', root);
const indexUrl = new URL('index.html', root);
const previewUrl = new URL('mountain-race-preview.html', root);
const marker = 'MOUNTAIN_RACE_HOLD_CONTACT_V37';
const replace = (source, before, after, label) => {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint V37 could not find ${label}.`);
  return source.replace(before, after);
};

let [runtime, prototype, css, html, preview] = await Promise.all([
  readFile(runtimeUrl, 'utf8'), readFile(prototypeUrl, 'utf8'), readFile(cssUrl, 'utf8'),
  readFile(indexUrl, 'utf8'), readFile(previewUrl, 'utf8')
]);

if (!runtime.includes(marker)) {
  runtime = replace(runtime,
    "    const finishClass = finished ? 'finished standing-on-summit' : '';",
    "    const finishClass = finished ? 'finished standing-on-summit' : '';\n    const contactIndex = Math.max(0, Math.min(Math.max(0, total - 1), index - 1));\n    const contactLeft = finished ? 50 : holdLeft(contactIndex);\n    // MOUNTAIN_RACE_HOLD_CONTACT_V37",
    'multiplayer hold contact coordinate');
  runtime = replace(runtime,
    'style="--mr-climber-bottom:${bottom}px" data-mr-finished=',
    'style="--mr-climber-bottom:${bottom}px;--mr-climber-left:${contactLeft}%" data-mr-finished=',
    'multiplayer climber inline coordinate');
}

if (!prototype.includes(marker)) {
  prototype = replace(prototype,
    "    const latestToken = normalizePrompt(player.lastInput?.control || 'up');",
    "    const latestToken = normalizePrompt(player.lastInput?.control || 'up');\n    const contactIndex = Math.max(0, index - 1);\n    const contactLeft = index > 0 ? holdHorizontal(contactIndex, latestToken) : 50;\n    // MOUNTAIN_RACE_HOLD_CONTACT_V37",
    'prototype hold contact coordinate');
  prototype = replace(prototype,
    'style="--mr-climber-bottom:${bottom}px" aria-label=',
    'style="--mr-climber-bottom:${bottom}px;--mr-climber-left:${contactLeft}%" aria-label=',
    'prototype climber inline coordinate');
}

if (!css.includes(marker)) css += String.raw`

/* MOUNTAIN_RACE_HOLD_CONTACT_V37
   Track the physical route ledge and offset the torso so the authored reaching
   hand, rather than the character center, contacts the symbol-bearing rock. */
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber:not(.finished) {
  left: calc(var(--mr-climber-left, 50%) + var(--mr-v37-hand-anchor, 0px)) !important;
  transition: bottom 620ms cubic-bezier(.18,.72,.2,1), left 620ms cubic-bezier(.18,.72,.2,1) !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber:is(.direction-left,.climb-left) { --mr-v37-hand-anchor: 17px; }
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber:is(.direction-right,.climb-right) { --mr-v37-hand-anchor: -17px; }
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber:is(.direction-up,.climb-up) { --mr-v37-hand-anchor: 0px; }
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber:is(.direction-down,.climb-down,.slip) { --mr-v37-hand-anchor: 0px; }
@media (max-width: 520px) {
  [data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber:is(.direction-left,.climb-left) { --mr-v37-hand-anchor: 13px; }
  [data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber:is(.direction-right,.climb-right) { --mr-v37-hand-anchor: -13px; }
}
`;

html = html.replace(/(?:&visual=\d+)+/g, '&visual=37');
preview = preview.replace(/(?:&visual=\d+)+/g, '&visual=37');
await Promise.all([
  writeFile(runtimeUrl, runtime), writeFile(prototypeUrl, prototype), writeFile(cssUrl, css),
  writeFile(indexUrl, html), writeFile(previewUrl, preview)
]);
console.log('Applied Summit Sprint V37 physical hold contact alignment.');
