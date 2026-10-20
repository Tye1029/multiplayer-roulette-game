import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', root);
const indexUrl = new URL('index.html', root);
const previewUrl = new URL('mountain-race-preview.html', root);
const marker = 'MOUNTAIN_RACE_CONTINUOUS_REACH_V36';
let [css, html, preview] = await Promise.all([
  readFile(cssUrl, 'utf8'), readFile(indexUrl, 'utf8'), readFile(previewUrl, 'utf8')
]);

if (!css.includes(marker)) css += String.raw`

/* MOUNTAIN_RACE_CONTINUOUS_REACH_V36
   One opaque decoded sprite layer advances through the six authored poses while
   the whole climber follows a continuous reach, pull and ledge-settle arc. */
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber:is(.climb-up,.climb-left,.climb-right,.climb-down,.slip)::before {
  opacity: 0 !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber:is(.climb-up,.climb-left,.climb-right,.climb-down,.slip) > .mr-motion-frame {
  display: none !important;
  animation: none !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber:is(.climb-up,.climb-left,.climb-right,.climb-down,.slip) > .mr-motion-frame-0 {
  display: block !important;
  opacity: 1 !important;
  animation: mrV36ReachFrames 620ms linear both !important;
  will-change: background-position;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber:is(.climb-up,.climb-left,.climb-right,.climb-down) {
  animation: mrV36ReachTravel 620ms cubic-bezier(.18,.72,.2,1) both !important;
  will-change: transform;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.slip {
  animation: mr-slip 620ms cubic-bezier(.3,.02,.65,1) both !important;
}
@keyframes mrV36ReachFrames {
  0%, 13% { background-position: 0 0; }
  16%, 29% { background-position: 50% 0; }
  32%, 45% { background-position: 100% 0; }
  48%, 61% { background-position: 0 100%; }
  64%, 77% { background-position: 50% 100%; }
  80%, 100% { background-position: 100% 100%; }
}
@keyframes mrV36ReachTravel {
  0% { transform: translate(-50%, 50%) translate3d(0, 5px, 0) scale(.985); }
  18% { transform: translate(calc(-50% + var(--mr-v32-reach, 0px) * .28), 50%) translate3d(0, 1px, 0) scale(1); }
  52% { transform: translate(calc(-50% + var(--mr-v32-reach, 0px)), 50%) translate3d(0, -10px, 0) scale(1.015); }
  78% { transform: translate(calc(-50% + var(--mr-v32-reach, 0px) * .32), 50%) translate3d(0, -3px, 0) scale(1); }
  100% { transform: translate(-50%, 50%) translate3d(0, 0, 0) scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  [data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber:is(.climb-up,.climb-left,.climb-right,.climb-down,.slip),
  [data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber:is(.climb-up,.climb-left,.climb-right,.climb-down,.slip) > .mr-motion-frame-0 {
    animation-duration: 1ms !important;
  }
}
`;

html = html.replace(/(?:&visual=\d+)+/g, '&visual=36');
preview = preview.replace(/(?:&visual=\d+)+/g, '&visual=36');
await Promise.all([writeFile(cssUrl, css), writeFile(indexUrl, html), writeFile(previewUrl, preview)]);
console.log('Applied Summit Sprint V36 single-layer continuous reach and ledge-settle animation.');
