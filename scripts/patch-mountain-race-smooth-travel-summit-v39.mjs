import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const prototypeUrl = new URL('assets/mountain-race/mountain-race.js', root);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', root);
const indexUrl = new URL('index.html', root);
const previewUrl = new URL('mountain-race-preview.html', root);
const marker = 'MOUNTAIN_RACE_SMOOTH_TRAVEL_SUMMIT_V39';
const required = (source, before, after, label) => {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint V39 could not find ${label}.`);
  return source.replace(before, after);
};

let [runtime, prototype, css, html, preview] = await Promise.all([
  readFile(runtimeUrl, 'utf8'), readFile(prototypeUrl, 'utf8'), readFile(cssUrl, 'utf8'),
  readFile(indexUrl, 'utf8'), readFile(previewUrl, 'utf8')
]);

if (!runtime.includes(marker)) {
  runtime = runtime.replaceAll('Math.max(0, p.promptIndex - 3) * 72', 'Math.max(0, p.promptIndex - 2) * 92');
  runtime = required(runtime,
    '    const contactLeft = finished ? 50 : holdLeft(contactIndex);',
    "    const contactLeft = finished ? 50 : holdLeft(contactIndex);\n    const previousContactLeft = finished || index < 2 ? contactLeft : holdLeft(contactIndex - 1);",
    'multiplayer previous hold coordinate');
  runtime = required(runtime,
    '    // MOUNTAIN_RACE_ROUTE_SPACING_SLIP_V38',
    '    // MOUNTAIN_RACE_ROUTE_SPACING_SLIP_V38\n    // MOUNTAIN_RACE_SMOOTH_TRAVEL_SUMMIT_V39',
    'multiplayer V39 marker');
  runtime = required(runtime,
    '--mr-climber-left:${contactLeft}%;--mr-slip-fall:${slipFall}px',
    '--mr-climber-left:${contactLeft}%;--mr-previous-climber-left:${previousContactLeft}%;--mr-slip-fall:${slipFall}px',
    'multiplayer previous position style');
}

if (!prototype.includes(marker)) {
  prototype = prototype.replaceAll('Math.max(0, player.promptIndex - 3) * 72', 'Math.max(0, player.promptIndex - 2) * 92');
  prototype = required(prototype,
    '    const contactLeft = index > 0 ? holdHorizontal(contactIndex, latestToken) : 50;',
    "    const contactLeft = index > 0 ? holdHorizontal(contactIndex, latestToken) : 50;\n    const previousContactLeft = index > 1 ? holdHorizontal(contactIndex - 1, latestToken) : contactLeft;",
    'prototype previous hold coordinate');
  prototype = required(prototype,
    '    // MOUNTAIN_RACE_ROUTE_SPACING_SLIP_V38',
    '    // MOUNTAIN_RACE_ROUTE_SPACING_SLIP_V38\n    // MOUNTAIN_RACE_SMOOTH_TRAVEL_SUMMIT_V39',
    'prototype V39 marker');
  prototype = required(prototype,
    '--mr-climber-left:${contactLeft}%;--mr-slip-fall:${slipFall}px',
    '--mr-climber-left:${contactLeft}%;--mr-previous-climber-left:${previousContactLeft}%;--mr-slip-fall:${slipFall}px',
    'prototype previous position style');
}

if (!css.includes(marker)) css += String.raw`

/* MOUNTAIN_RACE_SMOOTH_TRAVEL_SUMMIT_V39
   A rebuilt climber begins at the prior ledge coordinate and continuously
   interpolates to the new physical hold instead of appearing there instantly. */
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber:is(.climb-up,.climb-left,.climb-right,.climb-down) {
  animation: mrV39ClimbBetweenHolds 760ms cubic-bezier(.2,.7,.22,1) both !important;
}
@keyframes mrV39ClimbBetweenHolds {
  0% {
    bottom: calc(var(--mr-climber-bottom) - 92px);
    left: calc(var(--mr-previous-climber-left, var(--mr-climber-left, 50%)) + var(--mr-v37-hand-anchor, 0px));
    transform: translate(-50%, 50%) translate3d(0, 2px, 0) scale(.99);
  }
  28% {
    transform: translate(-50%, 50%) translate3d(0, -5px, 0) scale(1);
  }
  72% {
    bottom: calc(var(--mr-climber-bottom) - 8px);
    left: calc(var(--mr-climber-left, 50%) + var(--mr-v37-hand-anchor, 0px));
    transform: translate(-50%, 50%) translate3d(0, -8px, 0) scale(1.01);
  }
  88% {
    bottom: calc(var(--mr-climber-bottom) + 2px);
    transform: translate(-50%, 50%) translate3d(0, 1px, 0) scale(1);
  }
  100% {
    bottom: var(--mr-climber-bottom);
    left: calc(var(--mr-climber-left, 50%) + var(--mr-v37-hand-anchor, 0px));
    transform: translate(-50%, 50%) translate3d(0, 0, 0) scale(1);
  }
}
`;

html = html.replace(/(?:&visual=\d+)+/g, '&visual=39');
preview = preview.replace(/(?:&visual=\d+)+/g, '&visual=39');
await Promise.all([
  writeFile(runtimeUrl, runtime), writeFile(prototypeUrl, prototype), writeFile(cssUrl, css),
  writeFile(indexUrl, html), writeFile(previewUrl, preview)
]);
console.log('Applied Summit Sprint V39 smooth prior-hold travel and summit symbol framing.');
