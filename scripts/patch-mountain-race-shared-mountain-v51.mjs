import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const prototypeUrl = new URL('assets/mountain-race/mountain-race.js', root);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', root);
const indexUrl = new URL('index.html', root);
const previewUrl = new URL('mountain-race-preview.html', root);
const marker = 'MOUNTAIN_RACE_SHARED_MOUNTAIN_V51';

function required(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint V51 could not find ${label}.`);
  return source.replace(before, after);
}

let [runtime, prototype, css, html, preview] = await Promise.all([
  readFile(runtimeUrl, 'utf8'), readFile(prototypeUrl, 'utf8'), readFile(cssUrl, 'utf8'),
  readFile(indexUrl, 'utf8'), readFile(previewUrl, 'utf8')
]);

for (const source of [runtime, prototype]) {
  if (!source.includes('MOUNTAIN_RACE_SUMMIT_CONTACT_V50')) {
    throw new Error('Summit Sprint V51 requires the V50 summit contact pass first.');
  }
}

if (!runtime.includes(marker)) {
  runtime = required(runtime,
    "    root.dataset.mrSummitContact = '50';\n    // MOUNTAIN_RACE_SUMMIT_CONTACT_V50",
    "    root.dataset.mrSummitContact = '50';\n    root.dataset.mrSharedMountain = '51';\n    // MOUNTAIN_RACE_SHARED_MOUNTAIN_V51\n    // MOUNTAIN_RACE_SUMMIT_CONTACT_V50",
    'multiplayer V51 dataset');
  runtime = required(runtime,
    "          ${renderLane(opponent, 'opponent', total, [], false, opponentAnimation)}\n        </main>",
    "          ${renderLane(opponent, 'opponent', total, [], false, opponentAnimation)}\n          <span class=\"mr-v51-center-rope\" aria-hidden=\"true\"><i></i></span>\n        </main>",
    'multiplayer center rope');
  runtime = required(runtime,
    '    }, 1750); // MOUNTAIN_RACE_REALISTIC_CLIMBERS_V32: allow the summit celebration to finish',
    '    }, 2600); // MOUNTAIN_RACE_SHARED_MOUNTAIN_V51: keep either summit winner visible before results',
    'multiplayer finish-pose reveal delay');
}

if (!prototype.includes(marker)) {
  prototype = required(prototype,
    "    root.dataset.mrSummitContact = '50';\n    // MOUNTAIN_RACE_SUMMIT_CONTACT_V50",
    "    root.dataset.mrSummitContact = '50';\n    root.dataset.mrSharedMountain = '51';\n    // MOUNTAIN_RACE_SHARED_MOUNTAIN_V51\n    // MOUNTAIN_RACE_SUMMIT_CONTACT_V50",
    'prototype V51 dataset');
  prototype = required(prototype,
    "            ${renderLane(state, 'opponent')}\n          </main>",
    "            ${renderLane(state, 'opponent')}\n            <span class=\"mr-v51-center-rope\" aria-hidden=\"true\"><i></i></span>\n          </main>",
    'prototype center rope');
}

if (!css.includes(marker)) css += String.raw`

/* MOUNTAIN_RACE_SHARED_MOUNTAIN_V51
   One aspect-correct natural cliff fills the complete game shell behind the HUD,
   while the independent lane cameras keep their authoritative climbing motion.
   A live rope divides the routes and both climbers begin on aligned grass footing. */
[data-mountain-race-mount][data-mr-natural-terrain="49"][data-mr-shared-mountain="51"] {
  background:
    linear-gradient(90deg, rgba(5,10,8,.28), transparent 18% 82%, rgba(5,10,8,.3)),
    url('/assets/mountain-race/images/summit-sprint-natural-cliff-v49.png') center 54% / cover no-repeat !important;
}
[data-mountain-race-mount][data-mr-natural-terrain="49"][data-mr-summit-contact="50"][data-mr-shared-mountain="51"] .mountain-race-game {
  width: 100% !important;
  max-width: none !important;
  margin: 0 !important;
  box-sizing: border-box !important;
  background:
    linear-gradient(90deg, rgba(7,13,11,.2), transparent 22% 78%, rgba(7,13,11,.24)),
    linear-gradient(180deg, rgba(8,18,20,.2), rgba(12,18,14,.05) 35%, rgba(5,10,8,.42)),
    url('/assets/mountain-race/images/summit-sprint-natural-cliff-v49.png') center 54% / cover no-repeat !important;
  background-color: #2f3028 !important;
}
[data-mountain-race-mount][data-mr-shared-mountain="51"] .mountain-race-game::before {
  inset: 0 !important;
  z-index: -1 !important;
  background:
    radial-gradient(ellipse at 50% 14%, rgba(218,232,202,.16), transparent 31%),
    linear-gradient(90deg, rgba(3,8,6,.3), transparent 12% 88%, rgba(3,8,6,.32)) !important;
  opacity: 1 !important;
}
[data-mountain-race-mount][data-mr-shared-mountain="51"] .mountain-race-game::after {
  inset: 0 !important;
  z-index: -1 !important;
  height: auto !important;
  clip-path: none !important;
  background: linear-gradient(180deg, rgba(6,12,13,.12), transparent 28% 70%, rgba(4,9,7,.5)) !important;
  filter: none !important;
}
[data-mountain-race-mount][data-mr-shared-mountain="51"] .mr-race-stage {
  gap: 20px !important;
}
[data-mountain-race-mount][data-mr-shared-mountain="51"] .mr-race-stage::before {
  inset: -96px -24px -170px !important;
  height: auto !important;
  clip-path: none !important;
  background: linear-gradient(90deg, rgba(24,20,15,.24), transparent 18% 82%, rgba(24,20,15,.26)) !important;
  filter: none !important;
}
[data-mountain-race-mount][data-mr-shared-mountain="51"] .mr-v51-center-rope {
  position: absolute;
  z-index: 24;
  top: 66px;
  bottom: -22px;
  left: 50%;
  display: block;
  width: 10px;
  transform: translateX(-50%) rotate(.4deg);
  transform-origin: 50% 0;
  border: 1px solid rgba(55,35,17,.72);
  border-radius: 7px;
  background: repeating-linear-gradient(28deg, #59401f 0 4px, #b58a48 4px 8px, #725026 8px 12px);
  box-shadow: inset 2px 0 2px rgba(255,222,155,.3), inset -2px 0 2px rgba(38,22,9,.42), 0 3px 5px rgba(0,0,0,.58);
  pointer-events: none;
  animation: mrV51RopeSway 3.8s ease-in-out infinite alternate;
}
[data-mountain-race-mount][data-mr-shared-mountain="51"] .mr-v51-center-rope::before {
  content: '';
  position: absolute;
  left: 50%;
  top: -7px;
  width: 19px;
  height: 15px;
  transform: translateX(-50%);
  border: 3px solid #7b5729;
  border-radius: 50%;
  background: #352516;
  box-shadow: 0 2px 4px rgba(0,0,0,.55);
}
[data-mountain-race-mount][data-mr-shared-mountain="51"] .mr-v51-center-rope i {
  position: absolute;
  left: 2px;
  bottom: -29px;
  width: 24px;
  height: 44px;
  border: 0 solid #775226;
  border-right-width: 8px;
  border-bottom-width: 8px;
  border-radius: 0 0 22px;
  transform: rotate(16deg);
  filter: drop-shadow(2px 3px 2px rgba(0,0,0,.5));
}
[data-mountain-race-mount][data-mr-natural-terrain="49"][data-mr-shared-mountain="51"] .mr-v44-start {
  bottom: -18px !important;
  width: 78% !important;
  height: 86px !important;
  overflow: visible !important;
}
[data-mountain-race-mount][data-mr-natural-terrain="49"][data-mr-shared-mountain="51"] .mr-v44-start i {
  inset: 3px 12% auto !important;
  height: 20px !important;
  border-radius: 54% 46% 42% 48% !important;
  background:
    radial-gradient(ellipse at 25% 30%, #a8bd58 0 16%, transparent 17%),
    radial-gradient(ellipse at 67% 24%, #91aa4b 0 18%, transparent 19%),
    linear-gradient(180deg, #718f39, #425927 68%, #29391e) !important;
  box-shadow: inset 0 3px rgba(205,218,117,.24), 0 3px 4px rgba(24,28,14,.42) !important;
}
[data-mountain-race-mount][data-mr-shared-mountain="51"] .mr-v44-start i::before {
  content: '';
  position: absolute;
  left: 3%;
  right: 3%;
  top: -10px;
  height: 15px;
  border-radius: 50%;
  background: repeating-linear-gradient(78deg, transparent 0 7px, #9cb44f 7px 9px, transparent 9px 14px);
  filter: drop-shadow(0 2px 1px rgba(31,42,18,.38));
}
[data-mountain-race-mount][data-mr-contact-ledges="45"][data-mr-shared-mountain="51"] .mr-climber[data-mr-contact-index="-1"]:not(.finished) {
  transform: translate(-50%, 15.3%) !important;
  transform-origin: 50% 100% !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"][data-mr-natural-terrain="49"][data-mr-summit-contact="50"][data-mr-shared-mountain="51"] .mr-lane.opponent .mr-climber.finished,
[data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"][data-mr-natural-terrain="49"][data-mr-summit-contact="50"][data-mr-shared-mountain="51"] .mr-lane.opponent .mr-climber.standing-on-summit {
  left: 50% !important;
  transform: translate(-50%, 28%) !important;
  transform-origin: 50% 100% !important;
}
[data-mountain-race-mount][data-mr-shared-mountain="51"] .mr-overlay.complete {
  place-items: end center !important;
  padding: 18px 22px 24px !important;
  background: linear-gradient(180deg, transparent 0 42%, rgba(3,8,11,.28) 55%, rgba(3,8,11,.88) 78%) !important;
  backdrop-filter: none !important;
}
[data-mountain-race-mount][data-mr-shared-mountain="51"] .mr-overlay.complete .mr-overlay-card.result {
  width: min(92%, 660px) !important;
  padding: 17px 22px 16px !important;
}
[data-mountain-race-mount][data-mr-shared-mountain="51"] .mr-overlay.complete .mr-overlay-card.result h1 {
  font-size: clamp(1.55rem, 4vw, 2.8rem) !important;
}
[data-mountain-race-mount][data-mr-shared-mountain="51"] .mr-overlay.complete .mr-overlay-card.result p {
  margin: 8px auto 10px !important;
}
@keyframes mrV51RopeSway {
  from { transform: translateX(-50%) rotate(-.55deg); }
  to { transform: translateX(-50%) rotate(.8deg); }
}
@media (max-width: 620px) {
  [data-mountain-race-mount][data-mr-shared-mountain="51"] .mr-race-stage { gap: 12px !important; }
  [data-mountain-race-mount][data-mr-shared-mountain="51"] .mr-v51-center-rope { top: 70px; width: 7px; bottom: -14px; }
  [data-mountain-race-mount][data-mr-shared-mountain="51"] .mr-v51-center-rope i { width: 18px; height: 34px; border-right-width: 6px; border-bottom-width: 6px; }
  [data-mountain-race-mount][data-mr-natural-terrain="49"][data-mr-shared-mountain="51"] .mr-v44-start { bottom: -14px !important; height: 66px !important; }
  [data-mountain-race-mount][data-mr-natural-terrain="49"][data-mr-shared-mountain="51"] .mr-v44-start i { top: 3px !important; height: 16px !important; }
  [data-mountain-race-mount][data-mr-contact-ledges="45"][data-mr-shared-mountain="51"] .mr-climber[data-mr-contact-index="-1"]:not(.finished) { transform: translate(-50%, 28.3%) !important; }
  [data-mountain-race-mount][data-mr-shared-mountain="51"] .mr-overlay.complete { padding: 10px 10px 14px !important; }
  [data-mountain-race-mount][data-mr-shared-mountain="51"] .mr-overlay.complete .mr-overlay-card.result { padding: 13px 12px 12px !important; }
  [data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"][data-mr-natural-terrain="49"][data-mr-summit-contact="50"][data-mr-shared-mountain="51"] .mr-lane.opponent .mr-climber.finished,
  [data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"][data-mr-natural-terrain="49"][data-mr-summit-contact="50"][data-mr-shared-mountain="51"] .mr-lane.opponent .mr-climber.standing-on-summit { transform: translate(-50%, 40.6%) !important; }
}
`;

css = required(css,
  '[data-mountain-race-mount][data-mr-natural-terrain="49"][data-mr-summit-contact="50"][data-mr-shared-mountain="51"] .mountain-race-game {\n  width: 100% !important;\n  max-width: none !important;\n  margin: 0 !important;\n  background:',
  '[data-mountain-race-mount][data-mr-natural-terrain="49"][data-mr-summit-contact="50"][data-mr-shared-mountain="51"] .mountain-race-game {\n  width: 100% !important;\n  max-width: none !important;\n  margin: 0 !important;\n  box-sizing: border-box !important;\n  background:',
  'full-width shared mountain shell');

if (!css.includes('[data-mr-natural-terrain="49"][data-mr-shared-mountain="51"] {')) {
  css = required(css,
    '/* MOUNTAIN_RACE_SHARED_MOUNTAIN_V51\n   One aspect-correct natural cliff fills the complete game shell behind the HUD,\n   while the independent lane cameras keep their authoritative climbing motion.\n   A live rope divides the routes and both climbers begin on aligned grass footing. */\n',
    '/* MOUNTAIN_RACE_SHARED_MOUNTAIN_V51\n   One aspect-correct natural cliff fills the complete game shell behind the HUD,\n   while the independent lane cameras keep their authoritative climbing motion.\n   A live rope divides the routes and both climbers begin on aligned grass footing. */\n[data-mountain-race-mount][data-mr-natural-terrain="49"][data-mr-shared-mountain="51"] {\n  background:\n    linear-gradient(90deg, rgba(5,10,8,.28), transparent 18% 82%, rgba(5,10,8,.3)),\n    url(\'/assets/mountain-race/images/summit-sprint-natural-cliff-v49.png\') center 54% / cover no-repeat !important;\n}\n',
    'shared mount backdrop');
}

if (!css.includes('[data-mr-shared-mountain="51"] .mr-overlay.complete {')) {
  css = required(css,
    '@keyframes mrV51RopeSway {',
    '[data-mountain-race-mount][data-mr-shared-mountain="51"] .mr-overlay.complete {\n  place-items: end center !important;\n  padding: 18px 22px 24px !important;\n  background: linear-gradient(180deg, transparent 0 42%, rgba(3,8,11,.28) 55%, rgba(3,8,11,.88) 78%) !important;\n  backdrop-filter: none !important;\n}\n[data-mountain-race-mount][data-mr-shared-mountain="51"] .mr-overlay.complete .mr-overlay-card.result {\n  width: min(92%, 660px) !important;\n  padding: 17px 22px 16px !important;\n}\n[data-mountain-race-mount][data-mr-shared-mountain="51"] .mr-overlay.complete .mr-overlay-card.result h1 {\n  font-size: clamp(1.55rem, 4vw, 2.8rem) !important;\n}\n[data-mountain-race-mount][data-mr-shared-mountain="51"] .mr-overlay.complete .mr-overlay-card.result p {\n  margin: 8px auto 10px !important;\n}\n@keyframes mrV51RopeSway {',
    'summit-visible result overlay');
}

if (!css.includes('.mr-overlay.complete { padding: 10px 10px 14px !important; }')) {
  css = required(css,
    '@media (max-width: 620px) {\n  [data-mountain-race-mount][data-mr-shared-mountain="51"] .mr-race-stage',
    '@media (max-width: 620px) {\n  [data-mountain-race-mount][data-mr-shared-mountain="51"] .mr-overlay.complete { padding: 10px 10px 14px !important; }\n  [data-mountain-race-mount][data-mr-shared-mountain="51"] .mr-overlay.complete .mr-overlay-card.result { padding: 13px 12px 12px !important; }\n  [data-mountain-race-mount][data-mr-shared-mountain="51"] .mr-race-stage',
    'mobile summit-visible result overlay');
}

function updateDocument(source) {
  return source.replace(/(?:&visual=\d+)+/g, '&visual=51');
}

html = updateDocument(html);
preview = updateDocument(preview);

await Promise.all([
  writeFile(runtimeUrl, runtime), writeFile(prototypeUrl, prototype), writeFile(cssUrl, css),
  writeFile(indexUrl, html), writeFile(previewUrl, preview)
]);

console.log('Applied Summit Sprint V51 shared full-shell mountain, center rope, aligned grass starts, and longer visible opponent finish pose.');
