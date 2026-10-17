import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', root);
const indexUrl = new URL('index.html', root);
const previewUrl = new URL('mountain-race-preview.html', root);
const marker = 'MOUNTAIN_RACE_MOTION_FRAMES_V34';

let [css, html, preview] = await Promise.all([
  readFile(cssUrl, 'utf8'), readFile(indexUrl, 'utf8'), readFile(previewUrl, 'utf8')
]);

if (!css.includes(marker)) css += String.raw`

/* MOUNTAIN_RACE_MOTION_FRAMES_V34
   Six generated in-between frames play for each authoritative direction. */
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.climb-up::before {
  background-image: url('/assets/mountain-race/images/summit-sprint-climber-blue-up-v34.png') !important;
  animation: mrV34PoseFrames 540ms steps(1, end) both !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.climb-left::before {
  background-image: url('/assets/mountain-race/images/summit-sprint-climber-blue-left-v34.png') !important;
  animation: mrV34PoseFrames 540ms steps(1, end) both !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.climb-right::before {
  background-image: url('/assets/mountain-race/images/summit-sprint-climber-blue-right-v34.png') !important;
  animation: mrV34PoseFrames 540ms steps(1, end) both !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.climb-down::before,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.slip::before {
  background-image: url('/assets/mountain-race/images/summit-sprint-climber-blue-down-v34.png') !important;
  animation: mrV34PoseFrames 540ms steps(1, end) both !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.opponent.climb-up::before { background-image: url('/assets/mountain-race/images/summit-sprint-climber-orange-up-v34.png') !important; }
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.opponent.climb-left::before { background-image: url('/assets/mountain-race/images/summit-sprint-climber-orange-left-v34.png') !important; }
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.opponent.climb-right::before { background-image: url('/assets/mountain-race/images/summit-sprint-climber-orange-right-v34.png') !important; }
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.opponent.climb-down::before,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.opponent.slip::before { background-image: url('/assets/mountain-race/images/summit-sprint-climber-orange-down-v34.png') !important; }

@keyframes mrV34PoseFrames {
  0%, 16.65% { background-position: 0 0; }
  16.66%, 33.31% { background-position: 50% 0; }
  33.32%, 49.97% { background-position: 100% 0; }
  49.98%, 66.63% { background-position: 0 100%; }
  66.64%, 83.29% { background-position: 50% 100%; }
  83.30%, 100% { background-position: 100% 100%; }
}
`;

html = html.replace(/(?:&visual=\d+)+/g, '&visual=34');
preview = preview.replace(/(?:&visual=\d+)+/g, '&visual=34');
await Promise.all([writeFile(cssUrl, css), writeFile(indexUrl, html), writeFile(previewUrl, preview)]);
console.log('Applied Summit Sprint V34 six-frame directional motion sequences.');
