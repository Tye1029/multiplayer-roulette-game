import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const prototypeUrl = new URL('assets/mountain-race/mountain-race.js', root);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', root);
const indexUrl = new URL('index.html', root);
const previewUrl = new URL('mountain-race-preview.html', root);
const marker = 'MOUNTAIN_RACE_CELEBRATION_CONTACT_V57';

function required(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint V57 could not find ${label}.`);
  return source.replace(before, after);
}

let [runtime, prototype, css, html, preview] = await Promise.all([
  readFile(runtimeUrl, 'utf8'), readFile(prototypeUrl, 'utf8'), readFile(cssUrl, 'utf8'),
  readFile(indexUrl, 'utf8'), readFile(previewUrl, 'utf8')
]);

for (const source of [runtime, prototype]) {
  if (!source.includes('MOUNTAIN_RACE_NATURAL_SUMMIT_V56')) {
    throw new Error('Summit Sprint V57 requires the V56 natural summit first.');
  }
}

function updateRuntime(source, prototypeMode) {
  const totalExpression = prototypeMode ? 'TOTAL_HOLDS' : 'Number(total || 0)';
  const datasetBefore = "    root.dataset.mrNaturalSummit = '56';\n    // MOUNTAIN_RACE_NATURAL_SUMMIT_V56";
  const datasetAfter = "    root.dataset.mrNaturalSummit = '56';\n    root.dataset.mrCelebrationContact = '57';\n    // MOUNTAIN_RACE_CELEBRATION_CONTACT_V57\n    // MOUNTAIN_RACE_NATURAL_SUMMIT_V56";
  source = required(source, datasetBefore, datasetAfter, `${prototypeMode ? 'prototype' : 'multiplayer'} V57 dataset`);

  const nextLine = prototypeMode
    ? '      const nextContactLeft = finished ? 50 : index < TOTAL_HOLDS ? holdHorizontal(index, sequence[index]) : contactLeft;'
    : '      const nextContactLeft = finished ? 50 : index < Number(total || 0) ? holdLeft(index) : contactLeft;';
  const reachBlock = `${nextLine}\n      const climberLeft = !finished && contactIndex >= 0 ? contactLeft + (nextContactLeft - contactLeft) * 0.3 : contactLeft;\n      const summitApproach = !finished && index === ${totalExpression} - 1;`;
  source = required(source, nextLine, reachBlock, `${prototypeMode ? 'prototype' : 'multiplayer'} next-hold reach anchor`);

  const gripLine = prototypeMode
    ? '      const gripBottom = finished ? 272 + Math.max(0, TOTAL_HOLDS - 1) * 74 : contactIndex >= 0 ? 228 + contactIndex * 74 : 76;'
    : '      const gripBottom = finished ? 272 + Math.max(0, Number(total || 0) - 1) * 74 : contactIndex >= 0 ? 228 + contactIndex * 74 : 76;';
  source = required(source, gripLine, `${gripLine}\n      const reachBottom = gripBottom + (summitApproach ? 42 : 0);`, `${prototypeMode ? 'prototype' : 'multiplayer'} final summit reach`);

  const classBefore = prototypeMode
    ? "${finished ? 'finished standing-on-summit' : ''} ${startClass} ${startPoseClass} ${readyClass} direction-${travelDirection}"
    : '${finishClass} ${startClass} ${startPoseClass} ${readyClass} direction-${travelDirection}';
  const classAfter = prototypeMode
    ? "${finished ? 'finished standing-on-summit' : ''} ${startClass} ${startPoseClass} ${readyClass} ${summitApproach ? 'summit-reaching' : ''} direction-${travelDirection}"
    : "${finishClass} ${startClass} ${startPoseClass} ${readyClass} ${summitApproach ? 'summit-reaching' : ''} direction-${travelDirection}";
  source = required(source, classBefore, classAfter, `${prototypeMode ? 'prototype' : 'multiplayer'} summit approach class`);
  source = required(source,
    '--mr-climber-grip-bottom:${gripBottom}px;--mr-climber-left:${contactLeft}%',
    '--mr-climber-grip-bottom:${reachBottom}px;--mr-climber-left:${climberLeft}%',
    `${prototypeMode ? 'prototype' : 'multiplayer'} reach position`);

  source = required(source,
    "    return '<div class=\"mr-winner-confetti\" aria-hidden=\"true\">' + Array.from({ length: 20 },",
    "    return '<div class=\"mr-winner-confetti\" style=\"--mr-confetti-bottom:' + (272 + 23 * 74) + 'px\" aria-hidden=\"true\">' + Array.from({ length: 28 },",
    `${prototypeMode ? 'prototype' : 'multiplayer'} summit-anchored confetti`);
  return source;
}

if (!runtime.includes(marker)) runtime = updateRuntime(runtime, false);
if (!prototype.includes(marker)) prototype = updateRuntime(prototype, true);

if (!css.includes(marker)) css += String.raw`

/* MOUNTAIN_RACE_CELEBRATION_CONTACT_V57
   Climbers lean toward the next authoritative ledge, the final reach meets the
   summit lip, and the winner uses a corrected rear-view pose with a repeating
   confetti burst anchored to the current 74px route. */
[data-mountain-race-mount][data-mr-natural-summit="56"][data-mr-celebration-contact="57"] .mr-climber.summit-reaching {
  z-index: 14 !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"][data-mr-celebration-contact="57"] .mr-climber.celebrate > .mr-motion-frame-0.mr-v44-climber-sprite.mr-v45-climber-sprite {
  background-image: url('/assets/mountain-race/images/summit-sprint-celebration-climbers-v57.png') !important;
  background-size: 200% 100% !important;
  background-position: left center !important;
  transform: none !important;
  animation: mrV57WinnerLift 680ms ease-in-out infinite alternate !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"][data-mr-celebration-contact="57"] .mr-climber.celebrate.opponent > .mr-motion-frame-0.mr-v44-climber-sprite.mr-v45-climber-sprite {
  background-position: right center !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"][data-mr-celebration-contact="57"] .mr-winner-confetti {
  z-index: 36 !important;
  left: 50% !important;
  bottom: var(--mr-confetti-bottom) !important;
  width: 240px !important;
  height: 230px !important;
  transform: translateX(-50%) !important;
  overflow: visible !important;
}
[data-mountain-race-mount][data-mr-generated-assets="29"][data-mr-celebration-contact="57"] .mr-winner-confetti i {
  width: 8px !important;
  height: 14px !important;
  animation: mrV57Confetti 1.45s cubic-bezier(.18,.72,.35,1) infinite !important;
  animation-delay: calc(var(--mr-confetti-index) * -53ms) !important;
}
@keyframes mrV57WinnerLift {
  from { translate: 0 0; }
  to { translate: 0 -6px; }
}
@keyframes mrV57Confetti {
  0% { opacity: 0; transform: translate3d(0,-12px,0) rotate(0deg); }
  8% { opacity: 1; }
  78% { opacity: 1; }
  100% { opacity: 0; transform: translate3d(var(--mr-confetti-drift),220px,0) rotate(620deg); }
}
@media (max-width: 620px) {
  [data-mountain-race-mount][data-mr-generated-assets="29"][data-mr-celebration-contact="57"] .mr-winner-confetti {
    width: 180px !important;
    height: 205px !important;
  }
}
`;

function updateDocument(source) {
  source = source.replace(/(?:&visual=\d+)+/g, '&visual=57');
  source = source.replace('mountain-race.js?prototype=1"', 'mountain-race.js?prototype=1&visual=57"');
  if (!source.includes('summit-sprint-celebration-climbers-v57.png')) {
    source = source.replace('</head>', '  <link rel="preload" as="image" href="/assets/mountain-race/images/summit-sprint-celebration-climbers-v57.png" fetchpriority="high">\n</head>');
  }
  return source;
}

html = updateDocument(html);
preview = updateDocument(preview);

await Promise.all([
  writeFile(runtimeUrl, runtime), writeFile(prototypeUrl, prototype), writeFile(cssUrl, css),
  writeFile(indexUrl, html), writeFile(previewUrl, preview)
]);

console.log('Applied Summit Sprint V57 next-hold reach, final summit contact, corrected rear-view celebration, and summit-anchored repeating confetti.');
