import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', root);
const indexUrl = new URL('index.html', root);
const previewUrl = new URL('mountain-race-preview.html', root);
const marker = 'MOUNTAIN_RACE_DIRECTIONAL_POSES_V33';

let [css, html, preview] = await Promise.all([
  readFile(cssUrl, 'utf8'), readFile(indexUrl, 'utf8'), readFile(previewUrl, 'utf8')
]);

if (!css.includes(marker)) css += String.raw`

/* MOUNTAIN_RACE_DIRECTIONAL_POSES_V33
   Six-frame generated sheets map authoritative directions to distinct body poses. */
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber::before {
  background-image: url('/assets/mountain-race/images/summit-sprint-climber-blue-v33.png') !important;
  background-size: 300% 200% !important;
  background-position: 0 0 !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.opponent::before {
  background-image: url('/assets/mountain-race/images/summit-sprint-climber-orange-v33.png') !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.direction-up::before,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.climb-up::before { background-position: 0 0 !important; }
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.direction-left::before,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.climb-left::before { background-position: 50% 0 !important; }
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.direction-right::before,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.climb-right::before { background-position: 100% 0 !important; }
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.direction-down::before,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.climb-down::before,
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.slip::before { background-position: 0 100% !important; }
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.waiting:not(.celebrate)::before { background-position: 50% 100% !important; }
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber.celebrate::before { background-position: 100% 100% !important; }
`;

html = html.replace(/(?:&visual=\d+)+/g, '&visual=33');
preview = preview.replace(/(?:&visual=\d+)+/g, '&visual=33');

await Promise.all([writeFile(cssUrl, css), writeFile(indexUrl, html), writeFile(previewUrl, preview)]);
console.log('Applied Summit Sprint V33 directional climbing pose sheets.');
