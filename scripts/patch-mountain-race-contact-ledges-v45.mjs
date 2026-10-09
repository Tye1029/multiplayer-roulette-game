import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const prototypeUrl = new URL('assets/mountain-race/mountain-race.js', root);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', root);
const indexUrl = new URL('index.html', root);
const previewUrl = new URL('mountain-race-preview.html', root);
const marker = 'MOUNTAIN_RACE_CONTACT_LEDGES_V45';

function replaceSection(source, startToken, endToken, replacement, label) {
  const start = source.indexOf(startToken);
  const end = source.indexOf(endToken, start + startToken.length);
  if (start < 0 || end < 0) throw new Error(`Summit Sprint V45 could not find ${label}.`);
  return `${source.slice(0, start)}${replacement.trimEnd()}\n\n${source.slice(end)}`;
}

function required(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint V45 could not find ${label}.`);
  return source.replace(before, after);
}

const sourceOf = fn => fn.toString().split('\n').map(line => `  ${line}`).join('\n');

const runtimeHolds = sourceOf(function renderHolds(currentIndex, total, prompts, reveal, side) {
    const promptMap = new Map();
    prompts.forEach((token, offset) => promptMap.set(currentIndex + offset, control(token)));
    const firstVisible = Math.max(0, currentIndex - 2);
    const lastVisible = Math.min(total - 1, currentIndex + 3);
    const holds = Array.from({ length: Math.max(0, lastVisible - firstVisible + 1) }, (_, offset) => {
      const index = firstVisible + offset;
      const known = reveal ? promptMap.get(index) : '';
      const classes = [
        'mr-rock-hold',
        index === currentIndex ? 'current' : '',
        index < currentIndex ? 'passed' : '',
        known ? 'known' : 'unknown',
        known ? `direction-${known}` : ''
      ].filter(Boolean).join(' ');
      return `<span class="${classes}" style="--mr-hold-bottom:${120 + index * 84}px;--mr-hold-left:${holdLeft(index)}%" data-mr-hold-index="${index}" aria-hidden="true"><b>${known ? symbol(known) : ''}</b></span>`;
    }).join('');
    return holds + `<span class="mr-finish-ledge mr-summit-plateau" style="--mr-summit-bottom:${120 + total * 84}px" aria-hidden="true"><i></i><b>SUMMIT</b></span>`;
  });

const runtimeClimber = sourceOf(function renderClimber(raw, side, animation, total) {
    const index = Math.max(0, Number(raw.promptIndex) || 0);
    const finished = Boolean(raw.finishedAt) || index >= Number(total || 0);
    const contactIndex = finished ? Math.max(0, total - 1) : index - 1;
    const previousContactIndex = contactIndex - 1;
    const contactLeft = finished ? 50 : contactIndex >= 0 ? holdLeft(contactIndex) : 50;
    const previousContactLeft = previousContactIndex >= 0 ? holdLeft(previousContactIndex) : 50;
    const travelDirection = contactLeft < previousContactLeft ? 'left' : 'right';
    const gripBottom = finished ? 196 + Number(total || 0) * 84 : contactIndex >= 0 ? 160 + contactIndex * 84 : 76;
    const finishClass = finished ? 'finished standing-on-summit' : '';
    return `
      <div class="mr-climber ${side} ${animation} ${finishClass} direction-${travelDirection}" style="--mr-climber-grip-bottom:${gripBottom}px;--mr-climber-left:${contactLeft}%;--mr-previous-climber-left:${previousContactLeft}%" data-mr-animation-key="${escapeHtml(raw.lastInput?.at || animation)}-${index}" data-mr-contact-index="${contactIndex}" data-mr-finished="${finished ? '1' : '0'}" aria-label="${escapeHtml(raw.name)} climber">
        <span class="mr-motion-frame mr-motion-frame-0 mr-v44-climber-sprite mr-v45-climber-sprite" aria-hidden="true"></span>
      </div>`;
  });

const runtimeLane = sourceOf(function renderLane(rawPlayer, side, total, prompts, reveal, animation) {
    const p = player(rawPlayer, side === 'me' ? 'YOU' : 'OPPONENT', side === 'me' ? 'YOU' : rawPlayer?.isBot ? 'CPU' : 'P2');
    const cameraIndex = Math.max(0, Math.min(total, p.promptIndex));
    const scroll = Math.max(0, cameraIndex - 1) * 84;
    const progress = total ? Math.min(1, p.promptIndex / total) : 0;
    return `
      <section class="mr-lane ${side}" aria-label="${escapeHtml(p.name)} climbing lane">
        <header class="mr-player-card">
          <span class="mr-player-badge" aria-hidden="true">${escapeHtml(p.badge)}</span>
          <span class="mr-player-copy"><strong>${escapeHtml(p.name)}</strong><small>${p.rejectedInputs} ${p.rejectedInputs === 1 ? 'MISTAKE' : 'MISTAKES'}</small></span>
          <span class="mr-player-progress">${p.finishedAt ? 'SUMMIT REACHED' : `${p.promptIndex} / ${total}`}</span>
        </header>
        <div class="mr-climb-viewport">
          <div class="mr-mountain-wall" style="--mr-wall-scroll:${scroll}px;--mr-wall-height:${Math.max(2400, 380 + total * 84)}px">
            <span class="mr-v44-cliff" aria-hidden="true"></span>
            <span class="mr-v44-start" aria-hidden="true"><i></i></span>
            ${renderHolds(p.promptIndex, total, prompts, reveal, side)}
            ${renderClimber(p, side, animation, total)}
            ${animation === 'celebrate' ? winnerConfetti() : ''}
          </div>
          <div class="mr-altitude-meter" aria-hidden="true"><i style="--mr-altitude:${progress}"></i></div>
        </div>
      </section>`;
  });

const prototypeHolds = sourceOf(function renderHolds(state, playerKey) {
    const player = state.players[playerKey];
    const total = state.sequence.length;
    const firstVisible = Math.max(0, player.promptIndex - 2);
    const lastVisible = Math.min(total - 1, player.promptIndex + 3);
    const holds = state.sequence.slice(firstVisible, lastVisible + 1).map((token, offset) => {
      const index = firstVisible + offset;
      const isCurrent = index === player.promptIndex && state.status === 'racing';
      const classes = ['mr-rock-hold', isCurrent ? 'current' : '', index < player.promptIndex ? 'passed' : ''].filter(Boolean).join(' ');
      return `<span class="${classes}" style="--mr-hold-bottom:${120 + index * 84}px;--mr-hold-left:${holdHorizontal(index, token)}%" data-mr-hold-index="${index}" aria-hidden="true"><b>${promptLabel(token)}</b></span>`;
    }).join('');
    return holds + `<span class="mr-finish-ledge mr-summit-plateau" style="--mr-summit-bottom:${120 + total * 84}px" aria-hidden="true"><i></i><b>SUMMIT</b></span>`;
  });

const prototypeClimber = sourceOf(function renderClimber(player, playerKey, sequence) {
    const index = Math.min(TOTAL_HOLDS, Math.max(0, player.promptIndex));
    const finished = Boolean(player.finishedAt) || index >= TOTAL_HOLDS;
    const contactIndex = finished ? Math.max(0, TOTAL_HOLDS - 1) : index - 1;
    const previousContactIndex = contactIndex - 1;
    const contactLeft = finished ? 50 : contactIndex >= 0 ? holdHorizontal(contactIndex, sequence[contactIndex]) : 50;
    const previousContactLeft = previousContactIndex >= 0 ? holdHorizontal(previousContactIndex, sequence[previousContactIndex]) : 50;
    const travelDirection = contactLeft < previousContactLeft ? 'left' : 'right';
    const gripBottom = finished ? 196 + TOTAL_HOLDS * 84 : contactIndex >= 0 ? 160 + contactIndex * 84 : 76;
    return `
      <div class="mr-climber ${playerKey} ${escapeHtml(player.animation)} ${finished ? 'finished standing-on-summit' : ''} direction-${travelDirection}" style="--mr-climber-grip-bottom:${gripBottom}px;--mr-climber-left:${contactLeft}%;--mr-previous-climber-left:${previousContactLeft}%" data-mr-animation-key="${escapeHtml(player.lastInput?.at || player.animation)}-${index}" data-mr-contact-index="${contactIndex}" aria-label="${escapeHtml(player.name)} climber">
        <span class="mr-motion-frame mr-motion-frame-0 mr-v44-climber-sprite mr-v45-climber-sprite" aria-hidden="true"></span>
      </div>`;
  });

const prototypeLane = sourceOf(function renderLane(state, playerKey) {
    const player = state.players[playerKey];
    const total = state.sequence.length;
    const progress = progressOf(player, total);
    const cameraIndex = Math.max(0, Math.min(total, player.promptIndex));
    const scroll = Math.max(0, cameraIndex - 1) * 84;
    const status = player.finishedAt ? 'SUMMIT REACHED' : `${player.promptIndex} / ${total}`;
    const mistakes = player.rejectedInputs;
    return `
      <section class="mr-lane ${playerKey}" aria-label="${escapeHtml(player.name)} climbing lane">
        <header class="mr-player-card">
          <span class="mr-player-badge" aria-hidden="true">${playerKey === 'me' ? 'P1' : 'CPU'}</span>
          <span class="mr-player-copy"><strong>${escapeHtml(player.name)}</strong><small>${mistakes} ${mistakes === 1 ? 'MISTAKE' : 'MISTAKES'}</small></span>
          <span class="mr-player-progress">${status}</span>
        </header>
        <div class="mr-climb-viewport">
          <div class="mr-mountain-wall" style="--mr-wall-scroll:${scroll}px;--mr-wall-height:${Math.max(2400, 380 + total * 84)}px">
            <span class="mr-v44-cliff" aria-hidden="true"></span>
            <span class="mr-v44-start" aria-hidden="true"><i></i></span>
            ${renderHolds(state, playerKey)}
            ${renderClimber(player, playerKey, state.sequence)}
            ${player.animation === 'celebrate' ? winnerConfetti() : ''}
          </div>
          <div class="mr-altitude-meter" aria-hidden="true"><i style="--mr-altitude:${progress}"></i></div>
        </div>
      </section>`;
  });

let [runtime, prototype, css, html, preview] = await Promise.all([
  readFile(runtimeUrl, 'utf8'), readFile(prototypeUrl, 'utf8'), readFile(cssUrl, 'utf8'),
  readFile(indexUrl, 'utf8'), readFile(previewUrl, 'utf8')
]);

if (!runtime.includes(marker)) {
  runtime = replaceSection(runtime, '  function renderHolds(', '  function animationClass(', runtimeHolds, 'multiplayer hold renderer');
  runtime = replaceSection(runtime, '  function renderClimber(', '  function renderLane(', runtimeClimber, 'multiplayer climber renderer');
  runtime = replaceSection(runtime, '  function renderLane(', '  function promptQueue(', runtimeLane, 'multiplayer lane renderer');
  runtime = required(runtime,
    "    root.dataset.mrVisualReboot = '44';\n    // MOUNTAIN_RACE_VISUAL_REBOOT_V44",
    "    root.dataset.mrVisualReboot = '44';\n    root.dataset.mrContactLedges = '45';\n    // MOUNTAIN_RACE_VISUAL_REBOOT_V44\n    // MOUNTAIN_RACE_CONTACT_LEDGES_V45",
    'multiplayer V45 dataset');
}

if (!prototype.includes(marker)) {
  prototype = replaceSection(prototype, '  function renderHolds(', '  function renderClimber(', prototypeHolds, 'prototype hold renderer');
  prototype = replaceSection(prototype, '  function renderClimber(', '  // MOUNTAIN_RACE_REALISTIC_CLIMBERS_V32', prototypeClimber, 'prototype climber renderer');
  prototype = replaceSection(prototype, '  function renderLane(', '  function visiblePrompts(', prototypeLane, 'prototype lane renderer');
  prototype = required(prototype,
    "    root.dataset.mrVisualReboot = '44';\n    // MOUNTAIN_RACE_VISUAL_REBOOT_V44",
    "    root.dataset.mrVisualReboot = '44';\n    root.dataset.mrContactLedges = '45';\n    // MOUNTAIN_RACE_VISUAL_REBOOT_V44\n    // MOUNTAIN_RACE_CONTACT_LEDGES_V45",
    'prototype V45 dataset');
}

if (!css.includes(marker)) css += String.raw`

/* MOUNTAIN_RACE_CONTACT_LEDGES_V45
   Rear-facing climbers share one deterministic grip point with a physical PNG
   ledge. A fixed camera keeps the current prompt and next three prompts visible. */
[data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"] .mr-climb-viewport {
  height: clamp(520px, 58vh, 590px) !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"] .mr-mountain-wall {
  transition: transform 480ms cubic-bezier(.2,.72,.22,1) !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"] .mr-rock-hold {
  width: 120px !important;
  height: 48px !important;
  transform: translate(-50%, 0) !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: url('/assets/mountain-race/images/summit-sprint-reboot-ledge-v45.png') center / 100% 100% no-repeat !important;
  box-shadow: none !important;
  filter: drop-shadow(0 7px 5px rgba(1,9,13,.5)) !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"] .mr-rock-hold.current {
  border: 0 !important;
  box-shadow: none !important;
  filter: drop-shadow(0 0 5px rgba(115,203,255,.95)) drop-shadow(0 8px 5px rgba(1,9,13,.52)) !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"] .mr-lane.opponent .mr-rock-hold.current {
  box-shadow: none !important;
  filter: drop-shadow(0 0 5px rgba(255,171,82,.92)) drop-shadow(0 8px 5px rgba(1,9,13,.52)) !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"] .mr-rock-hold.passed {
  opacity: .72 !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"] .mr-rock-hold b {
  position: absolute !important;
  left: 50% !important;
  top: 1px !important;
  width: 32px !important;
  height: 32px !important;
  transform: translateX(-50%) !important;
  background: rgba(4,20,30,.94) !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"] .mr-climber {
  left: var(--mr-climber-left, 50%) !important;
  bottom: var(--mr-climber-grip-bottom, 76px) !important;
  width: 154px !important;
  height: 205px !important;
  transform: translate(-50%, 64%) !important;
  transform-origin: 50% 64% !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"] .mr-climber.finished {
  left: 50% !important;
  transform: translate(-50%, 80%) !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"] .mr-climber > .mr-motion-frame-0.mr-v44-climber-sprite.mr-v45-climber-sprite {
  display: block !important;
  background-image: url('/assets/mountain-race/images/summit-sprint-climber-back-sheet-v45.png') !important;
  background-size: 400% 200% !important;
  background-position: var(--mr-v45-frame-x, 0%) var(--mr-v45-frame-y, 0%) !important;
  animation: none !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"] .mr-climber.opponent > .mr-motion-frame-0.mr-v44-climber-sprite.mr-v45-climber-sprite {
  background-image: url('/assets/mountain-race/images/summit-sprint-climber-back-opponent-sheet-v45.png') !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"] .mr-climber.direction-left > .mr-motion-frame-0.mr-v44-climber-sprite.mr-v45-climber-sprite {
  transform: scaleX(-1) !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"] .mr-climber.direction-right > .mr-motion-frame-0.mr-v44-climber-sprite.mr-v45-climber-sprite {
  transform: none !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"] .mr-climber:is(.climb-up,.climb-left,.climb-right,.climb-down) > .mr-motion-frame-0.mr-v44-climber-sprite.mr-v45-climber-sprite {
  animation: mrV45ReachFrames 480ms steps(1,end) both !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"] .mr-climber.slip > .mr-motion-frame-0.mr-v44-climber-sprite.mr-v45-climber-sprite {
  animation: mrV45SlipFrames 620ms steps(1,end) both !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"] .mr-climber.celebrate > .mr-motion-frame-0.mr-v44-climber-sprite.mr-v45-climber-sprite {
  --mr-v45-frame-x: 100%;
  --mr-v45-frame-y: 100%;
  animation: mrV45Celebrate 520ms ease-in-out infinite alternate !important;
}
@keyframes mrV45ReachFrames {
  0%, 14% { --mr-v45-frame-x: 0%; --mr-v45-frame-y: 0%; }
  14.01%, 33% { --mr-v45-frame-x: 33.333%; --mr-v45-frame-y: 0%; }
  33.01%, 55% { --mr-v45-frame-x: 66.667%; --mr-v45-frame-y: 0%; }
  55.01%, 76% { --mr-v45-frame-x: 100%; --mr-v45-frame-y: 0%; }
  76.01%, 90% { --mr-v45-frame-x: 66.667%; --mr-v45-frame-y: 0%; }
  90.01%, 100% { --mr-v45-frame-x: 0%; --mr-v45-frame-y: 0%; }
}
@keyframes mrV45SlipFrames {
  0%, 18% { --mr-v45-frame-x: 0%; --mr-v45-frame-y: 0%; }
  18.01%, 78% { --mr-v45-frame-x: 66.667%; --mr-v45-frame-y: 100%; }
  78.01%, 100% { --mr-v45-frame-x: 0%; --mr-v45-frame-y: 0%; }
}
@keyframes mrV45Celebrate {
  from { translate: 0 0; }
  to { translate: 0 -5px; }
}
@media (max-width: 620px) {
  [data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"] .mr-climb-viewport { height: clamp(500px, 61vh, 530px) !important; }
  [data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"] .mr-rock-hold { width: 82px !important; height: 33px !important; }
  [data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"] .mr-rock-hold b { top: -1px !important; width: 27px !important; height: 27px !important; }
  [data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"] .mr-climber { width: 110px !important; height: 147px !important; transform: translate(-50%, 64%) !important; }
  [data-mountain-race-mount][data-mr-visual-reboot="44"][data-mr-contact-ledges="45"] .mr-climber.finished { transform: translate(-50%, 80%) !important; }
}
`;

function updateDocument(source) {
  source = source
    .replace(/^\s*<link rel="preload" as="image" href="\/assets\/mountain-race\/images\/summit-sprint-reboot-climber(?:-opponent)?-sheet-v44\.png" fetchpriority="high">\s*$/gm, '')
    .replace(/(?:&visual=\d+)+/g, '&visual=45');
  if (!source.includes('summit-sprint-reboot-ledge-v45.png')) {
    const preloads = [
      '  <link rel="preload" as="image" href="/assets/mountain-race/images/summit-sprint-reboot-ledge-v45.png" fetchpriority="high">',
      '  <link rel="preload" as="image" href="/assets/mountain-race/images/summit-sprint-climber-back-sheet-v45.png" fetchpriority="high">',
      '  <link rel="preload" as="image" href="/assets/mountain-race/images/summit-sprint-climber-back-opponent-sheet-v45.png" fetchpriority="high">'
    ].join('\n');
    source = source.replace('</head>', `${preloads}\n</head>`);
  }
  return source;
}

html = updateDocument(html);
preview = updateDocument(preview);
await Promise.all([
  writeFile(runtimeUrl, runtime), writeFile(prototypeUrl, prototype), writeFile(cssUrl, css),
  writeFile(indexUrl, html), writeFile(previewUrl, preview)
]);
console.log('Applied Summit Sprint V45 rear-facing climbers, physical contact ledges, and fixed look-ahead camera.');
