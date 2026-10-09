import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const prototypeUrl = new URL('assets/mountain-race/mountain-race.js', root);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', root);
const indexUrl = new URL('index.html', root);
const previewUrl = new URL('mountain-race-preview.html', root);
const marker = 'MOUNTAIN_RACE_ROUTE_SPACING_SLIP_V38';
const required = (source, before, after, label) => {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint V38 could not find ${label}.`);
  return source.replace(before, after);
};

let [runtime, prototype, css, html, preview] = await Promise.all([
  readFile(runtimeUrl, 'utf8'), readFile(prototypeUrl, 'utf8'), readFile(cssUrl, 'utf8'),
  readFile(indexUrl, 'utf8'), readFile(previewUrl, 'utf8')
]);

if (!runtime.includes(marker)) {
  runtime = runtime.replaceAll('index * 72', 'index * 92').replaceAll('total * 72', 'total * 92').replaceAll('(p.promptIndex - 3) * 72', '(p.promptIndex - 3) * 92');
  runtime = required(runtime,
    "    const bottom = finished ? 148 + Number(total || 0) * 72 : 62 + index * 92;",
    "    const bottom = finished ? 148 + Number(total || 0) * 92 : 20 + index * 92;",
    'lower climber resting position');
  runtime = required(runtime,
    '    // MOUNTAIN_RACE_HOLD_CONTACT_V37',
    "    const slipFall = animation === 'slip' ? 92 : 0;\n    // MOUNTAIN_RACE_HOLD_CONTACT_V37\n    // MOUNTAIN_RACE_ROUTE_SPACING_SLIP_V38",
    'multiplayer slip distance');
  runtime = required(runtime,
    '--mr-climber-left:${contactLeft}%" data-mr-finished=',
    '--mr-climber-left:${contactLeft}%;--mr-slip-fall:${slipFall}px" data-mr-finished=',
    'multiplayer slip style');
}

if (!prototype.includes(marker)) {
  prototype = prototype.replaceAll('index * 72', 'index * 92').replaceAll('total * 72', 'total * 92').replaceAll('(player.promptIndex - 3) * 72', '(player.promptIndex - 3) * 92');
  prototype = required(prototype, '    const bottom = 62 + index * 92;', '    const bottom = 20 + index * 92;', 'prototype lower resting position');
  prototype = required(prototype,
    '    // MOUNTAIN_RACE_HOLD_CONTACT_V37',
    "    const slipFall = player.animation === 'slip' ? 92 : 0;\n    // MOUNTAIN_RACE_HOLD_CONTACT_V37\n    // MOUNTAIN_RACE_ROUTE_SPACING_SLIP_V38",
    'prototype slip distance');
  prototype = required(prototype,
    '--mr-climber-left:${contactLeft}%" aria-label=',
    '--mr-climber-left:${contactLeft}%;--mr-slip-fall:${slipFall}px" aria-label=',
    'prototype slip style');
}

if (!css.includes(marker)) css += String.raw`

/* MOUNTAIN_RACE_ROUTE_SPACING_SLIP_V38
   Targets sit clearly above the climber. A rejected input visibly drops the
   climber one complete route interval to the previously secured ledge. */
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.slip {
  animation: mrV38FallBack 720ms cubic-bezier(.22,.02,.58,1) both !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.slip > .mr-motion-frame-0 {
  animation: mrV36ReachFrames 720ms linear reverse both !important;
}
@keyframes mrV38FallBack {
  0% { transform: translate(-50%, 50%) translate3d(0, calc(-1 * var(--mr-slip-fall, 92px)), 0) rotate(0); }
  18% { transform: translate(-50%, 50%) translate3d(7px, calc(-.78 * var(--mr-slip-fall, 92px)), 0) rotate(7deg); }
  62% { transform: translate(-50%, 50%) translate3d(-4px, calc(-.2 * var(--mr-slip-fall, 92px)), 0) rotate(-4deg); }
  84% { transform: translate(-50%, 50%) translate3d(2px, 3px, 0) rotate(2deg); }
  100% { transform: translate(-50%, 50%) translate3d(0, 0, 0) rotate(0); }
}
`;

html = html.replace(/(?:&visual=\d+)+/g, '&visual=38');
preview = preview.replace(/(?:&visual=\d+)+/g, '&visual=38');
await Promise.all([
  writeFile(runtimeUrl, runtime), writeFile(prototypeUrl, prototype), writeFile(cssUrl, css),
  writeFile(indexUrl, html), writeFile(previewUrl, preview)
]);
console.log('Applied Summit Sprint V38 wider route spacing and one-hold wrong-input fall.');
