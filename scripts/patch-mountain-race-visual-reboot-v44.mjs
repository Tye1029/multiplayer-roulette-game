import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const prototypeUrl = new URL('assets/mountain-race/mountain-race.js', root);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', root);
const indexUrl = new URL('index.html', root);
const previewUrl = new URL('mountain-race-preview.html', root);
const marker = 'MOUNTAIN_RACE_VISUAL_REBOOT_V44';

function replaceSection(source, startToken, endToken, replacement, label) {
  const start = source.indexOf(startToken);
  const end = source.indexOf(endToken, start + startToken.length);
  if (start < 0 || end < 0) throw new Error(`Summit Sprint V44 could not find ${label}.`);
  return `${source.slice(0, start)}${replacement.trimEnd()}\n\n${source.slice(end)}`;
}

function required(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint V44 could not find ${label}.`);
  return source.replace(before, after);
}

const sourceOf = fn => fn.toString().split('\n').map(line => `  ${line}`).join('\n');

const runtimeHolds = sourceOf(function renderHolds(currentIndex, total, prompts, reveal, side) {
    const promptMap = new Map();
    prompts.forEach((token, offset) => promptMap.set(currentIndex + offset, control(token)));
    const firstVisible = Math.max(0, currentIndex - 3);
    const lastVisible = Math.min(total - 1, currentIndex + 5);
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
      return `<span class="${classes}" style="--mr-hold-bottom:${86 + index * 92}px;--mr-hold-left:${holdLeft(index)}%" aria-hidden="true"><b>${known ? symbol(known) : ''}</b></span>`;
    }).join('');
    return holds + `<span class="mr-finish-ledge mr-summit-plateau" style="--mr-summit-bottom:${86 + total * 92}px" aria-hidden="true"><i></i><b>SUMMIT</b></span>`;
  });

const runtimeClimber = sourceOf(function renderClimber(raw, side, animation, total) {
    const index = Math.max(0, Number(raw.promptIndex) || 0);
    const finished = Boolean(raw.finishedAt) || index >= Number(total || 0);
    const bottom = finished ? 148 + Number(total || 0) * 92 : 80 + index * 92;
    const contactIndex = Math.max(0, Math.min(Math.max(0, total - 1), index - 1));
    const contactLeft = finished ? 50 : holdLeft(contactIndex);
    const previousContactLeft = finished || index < 2 ? contactLeft : holdLeft(contactIndex - 1);
    const direction = control(raw.lastInput?.control);
    const finishClass = finished ? 'finished standing-on-summit' : '';
    return `
      <div class="mr-climber ${side} ${animation} ${finishClass} direction-${direction}" style="--mr-climber-bottom:${bottom}px;--mr-climber-left:${contactLeft}%;--mr-previous-climber-left:${previousContactLeft}%" data-mr-animation-key="${escapeHtml(raw.lastInput?.at || animation)}-${index}" data-mr-finished="${finished ? '1' : '0'}" aria-label="${escapeHtml(raw.name)} climber">
        <span class="mr-motion-frame mr-motion-frame-0 mr-v44-climber-sprite" aria-hidden="true"></span>
      </div>`;
  });

const runtimeLane = sourceOf(function renderLane(rawPlayer, side, total, prompts, reveal, animation) {
    const p = player(rawPlayer, side === 'me' ? 'YOU' : 'OPPONENT', side === 'me' ? 'YOU' : rawPlayer?.isBot ? 'CPU' : 'P2');
    const cameraIndex = p.lastInput?.correct === false ? Math.min(total, p.promptIndex + 1) : p.promptIndex;
    const cameraLead = Math.max(2, 5 - (Math.min(total, cameraIndex) / Math.max(1, total)) * 3);
    const scroll = Math.max(0, cameraIndex - cameraLead) * 92;
    const progress = total ? Math.min(1, p.promptIndex / total) : 0;
    return `
      <section class="mr-lane ${side}" aria-label="${escapeHtml(p.name)} climbing lane">
        <header class="mr-player-card">
          <span class="mr-player-badge" aria-hidden="true">${escapeHtml(p.badge)}</span>
          <span class="mr-player-copy"><strong>${escapeHtml(p.name)}</strong><small>${p.rejectedInputs} ${p.rejectedInputs === 1 ? 'MISTAKE' : 'MISTAKES'}</small></span>
          <span class="mr-player-progress">${p.finishedAt ? 'SUMMIT REACHED' : `${p.promptIndex} / ${total}`}</span>
        </header>
        <div class="mr-climb-viewport">
          <div class="mr-mountain-wall" style="--mr-wall-scroll:${scroll}px;--mr-wall-height:${Math.max(2508, 300 + total * 92)}px">
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
    const firstVisible = Math.max(0, player.promptIndex - 3);
    const lastVisible = Math.min(total - 1, player.promptIndex + 5);
    const holds = state.sequence.slice(firstVisible, lastVisible + 1).map((token, offset) => {
      const index = firstVisible + offset;
      const isCurrent = index === player.promptIndex && state.status === 'racing';
      const classes = ['mr-rock-hold', isCurrent ? 'current' : '', index < player.promptIndex ? 'passed' : ''].filter(Boolean).join(' ');
      return `<span class="${classes}" style="--mr-hold-bottom:${86 + index * 92}px;--mr-hold-left:${holdHorizontal(index, token)}%" aria-hidden="true"><b>${promptLabel(token)}</b></span>`;
    }).join('');
    return holds + `<span class="mr-finish-ledge mr-summit-plateau" style="--mr-summit-bottom:${86 + total * 92}px" aria-hidden="true"><i></i><b>SUMMIT</b></span>`;
  });

const prototypeClimber = sourceOf(function renderClimber(player, playerKey) {
    const index = Math.min(TOTAL_HOLDS, Math.max(0, player.promptIndex));
    const finished = Boolean(player.finishedAt) || index >= TOTAL_HOLDS;
    const bottom = finished ? 148 + TOTAL_HOLDS * 92 : 80 + index * 92;
    const latestToken = normalizePrompt(player.lastInput?.control || 'up');
    const contactIndex = Math.max(0, index - 1);
    const contactLeft = finished ? 50 : index > 0 ? holdHorizontal(contactIndex, latestToken) : 50;
    const previousContactLeft = index > 1 ? holdHorizontal(contactIndex - 1, latestToken) : contactLeft;
    return `
      <div class="mr-climber ${playerKey} ${escapeHtml(player.animation)} ${finished ? 'finished standing-on-summit' : ''} direction-${latestToken}" style="--mr-climber-bottom:${bottom}px;--mr-climber-left:${contactLeft}%;--mr-previous-climber-left:${previousContactLeft}%" data-mr-animation-key="${escapeHtml(player.lastInput?.at || player.animation)}-${index}" aria-label="${escapeHtml(player.name)} climber">
        <span class="mr-motion-frame mr-motion-frame-0 mr-v44-climber-sprite" aria-hidden="true"></span>
      </div>`;
  });

const prototypeLane = sourceOf(function renderLane(state, playerKey) {
    const player = state.players[playerKey];
    const total = state.sequence.length;
    const progress = progressOf(player, total);
    const cameraIndex = player.lastInput?.correct === false ? Math.min(total, player.promptIndex + 1) : player.promptIndex;
    const cameraLead = Math.max(2, 5 - (Math.min(total, cameraIndex) / Math.max(1, total)) * 3);
    const scroll = Math.max(0, cameraIndex - cameraLead) * 92;
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
          <div class="mr-mountain-wall" style="--mr-wall-scroll:${scroll}px;--mr-wall-height:${Math.max(2508, 300 + total * 92)}px">
            <span class="mr-v44-cliff" aria-hidden="true"></span>
            <span class="mr-v44-start" aria-hidden="true"><i></i></span>
            ${renderHolds(state, playerKey)}
            ${renderClimber(player, playerKey)}
            ${player.animation === 'celebrate' ? winnerConfetti() : ''}
          </div>
          <div class="mr-altitude-meter" aria-hidden="true"><i style="--mr-altitude:${progress}"></i></div>
        </div>
      </section>`;
  });

const prototypeRender = sourceOf(function render() {
    if (!runtime.root || !runtime.state) return;
    const state = runtime.state;
    const previousGameElement = runtime.root.querySelector(':scope > .mountain-race-game');
    const nextGameMarkup = `
      <div class="mountain-race-game" data-mode="${MODE}" data-status="${state.status}">
        <header class="mr-titlebar">
          <div><p>FIRST TO THE SUMMIT WINS</p><h2>SUMMIT SPRINT</h2></div>
          <div class="mr-race-clock ${remainingSeconds(state) <= 7 && state.status === 'racing' ? 'urgent' : ''}" aria-label="Race time remaining">
            <small>TIME</small><strong>${String(remainingSeconds(state)).padStart(2, '0')}</strong>
          </div>
        </header>
        <main class="mr-race-stage">
          ${renderLane(state, 'me')}
          ${renderLane(state, 'opponent')}
        </main>
        <section class="mr-command-deck" aria-label="Climbing controls">
          <div class="mr-next-moves">
            <span class="mr-prompt-label">YOUR NEXT MOVES</span>
            <div class="mr-prompt-sequence">${renderPromptQueue(state)}</div>
            <p class="mr-status ${escapeHtml(state.messageTone)}" data-mr-status>${escapeHtml(state.message)}</p>
          </div>
          <div class="mr-direction-pad" aria-label="Direction pad">
            ${renderControlButton('up')}
            ${renderControlButton('left')}
            ${renderControlButton('down')}
            ${renderControlButton('right')}
          </div>
        </section>
        ${renderOverlay(state)}
      </div>`;
    const template = document.createElement('template');
    template.innerHTML = nextGameMarkup.trim();
    const nextGameElement = template.content.firstElementChild;
    if (!nextGameElement) return;
    if (previousGameElement) {
      previousGameElement.className = nextGameElement.className;
      for (const name of previousGameElement.getAttributeNames()) {
        if (name !== 'class' && !nextGameElement.hasAttribute(name)) previousGameElement.removeAttribute(name);
      }
      for (const attribute of nextGameElement.attributes) {
        if (attribute.name !== 'class') previousGameElement.setAttribute(attribute.name, attribute.value);
      }
      morphMountainNode(previousGameElement, nextGameElement);
    } else {
      runtime.root.append(nextGameElement);
    }
  });

let [runtime, prototype, css, html, preview] = await Promise.all([
  readFile(runtimeUrl, 'utf8'), readFile(prototypeUrl, 'utf8'), readFile(cssUrl, 'utf8'),
  readFile(indexUrl, 'utf8'), readFile(previewUrl, 'utf8')
]);

if (!runtime.includes(marker)) {
  runtime = replaceSection(runtime, '  function renderHolds(', '  function animationClass(', runtimeHolds, 'multiplayer hold renderer');
  runtime = replaceSection(runtime, '  function renderClimber(', '  function winnerConfetti(', runtimeClimber, 'multiplayer climber renderer');
  runtime = replaceSection(runtime, '  function renderLane(', '  function promptQueue(', runtimeLane, 'multiplayer lane renderer');
  runtime = required(runtime,
    "    root.dataset.mrGeneratedAssets = '29';",
    "    root.dataset.mrGeneratedAssets = '29';\n    root.dataset.mrVisualReboot = '44';\n    // MOUNTAIN_RACE_VISUAL_REBOOT_V44",
    'multiplayer reboot dataset');
  runtime = required(runtime,
    "    const controlsEnabled = runtime.game.status === 'playing' && publicState.canSubmit && prompts.length > 0 && !presentation.blocked && !runtime.inputQueueBlocked && runtime.inputQueue.length === 0 && runtime.inputBatchInFlight.length === 0;",
    "    const controlsEnabled = runtime.game.status === 'playing' && publicState.canSubmit && prompts.length > 0 && !presentation.blocked && !runtime.inputQueueBlocked;",
    'non-blocking controls');
  runtime = required(runtime,
    "    if (!bridge?.submit || runtime.game?.status !== 'playing' || !publicState.canSubmit || runtime.inputQueueBlocked || runtime.inputQueue.length || runtime.inputBatchInFlight.length) return;\n    // MOUNTAIN_RACE_CONFIRMED_LIGHTWEIGHT_V43",
    "    if (!bridge?.submit || runtime.game?.status !== 'playing' || !publicState.canSubmit || runtime.inputQueueBlocked) return;\n    // MOUNTAIN_RACE_CONFIRMED_LIGHTWEIGHT_V43\n    // Correct moves remain bufferable while earlier actions are in flight.",
    'non-blocking submit guard');
  runtime = runtime
    .replace('    ensureMountainRaceRasterAssetsV16(root);', '    void 0; // V44 retired generated raster canvases')
    .replace('    ensureMountainRaceEnvironmentV17(root);', '    void 0; // V44 retired decorative environment layers')
    .replace('    ensureConceptTargetV18(root);', '    void 0; // V44 retired legacy concept layers')
    .replace('    ensureConceptDetailV19(root);', '    void 0; // V44 retired runtime canvas textures');
  runtime = required(runtime,
    '      const duration = celebrating ? 900 : slipping ? 720 : 680;',
    '      const duration = celebrating ? 1050 : slipping ? 620 : 520;',
    'persistent motion timing');
}

if (!prototype.includes(marker)) {
  prototype = replaceSection(prototype, '  function renderHolds(', '  function renderClimber(', prototypeHolds, 'prototype hold renderer');
  prototype = replaceSection(prototype, '  function renderClimber(', '  // MOUNTAIN_RACE_REALISTIC_CLIMBERS_V32', prototypeClimber, 'prototype climber renderer');
  prototype = replaceSection(prototype, '  function renderLane(', '  function visiblePrompts(', prototypeLane, 'prototype lane renderer');
  prototype = replaceSection(prototype, '  function render()', '  function announce(', prototypeRender, 'prototype persistent renderer');
  prototype = required(prototype,
    "    root.dataset.mrGeneratedAssets = '29';",
    "    root.dataset.mrGeneratedAssets = '29';\n    root.dataset.mrVisualReboot = '44';\n    // MOUNTAIN_RACE_VISUAL_REBOOT_V44",
    'prototype reboot dataset');
  prototype = required(prototype,
    '      const duration = celebrating ? 900 : slipping ? 720 : 680;',
    '      const duration = celebrating ? 1050 : slipping ? 620 : 520;',
    'prototype motion timing');
  prototype = required(prototype,
    '      setPlayerAnimation(playerKey, `climb-${token}`, 250);',
    '      setPlayerAnimation(playerKey, `climb-${token}`, 520);',
    'prototype reach duration');
  prototype = required(prototype,
    "      setPlayerAnimation(playerKey, 'slip', 420);",
    "      setPlayerAnimation(playerKey, 'slip', 620);",
    'prototype slip duration');
}

if (!css.includes(marker)) css += String.raw`

/* MOUNTAIN_RACE_VISUAL_REBOOT_V44
   One lightweight background, one reusable cliff, one persistent sprite sheet,
   and live DOM holds replace the stacked V20-V43 presentation layers. */
[data-mountain-race-mount][data-mr-visual-reboot="44"] {
  --mr-v44-blue: #21a8ff;
  --mr-v44-orange: #ff9b38;
  position: relative !important;
  isolation: isolate;
  overflow: hidden !important;
  border-radius: 22px;
  background: #9eddf6 url('/assets/mountain-race/images/summit-sprint-reboot-background-v44.png') center 46% / cover no-repeat !important;
  color: #f7fbff;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"] > .mr-world-layer {
  position: absolute !important;
  inset: 0 !important;
  z-index: 0 !important;
  display: block !important;
  opacity: 1 !important;
  transform: none !important;
  background: url('/assets/mountain-race/images/summit-sprint-reboot-background-v44.png') center 46% / cover no-repeat !important;
  filter: none !important;
  animation: none !important;
  pointer-events: none;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"] > .mr-world-layer > * { display: none !important; }
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mountain-race-game {
  position: relative !important;
  z-index: 2 !important;
  width: min(100%, 960px) !important;
  margin: 0 auto !important;
  padding: clamp(7px, 1.3vw, 13px) !important;
  border: 0 !important;
  background: linear-gradient(180deg, rgba(7,25,40,.18), rgba(4,15,24,.32)) !important;
  box-shadow: none !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"] :is(.mr-route-depth,.mr-route-rope,.mr-cliff-art,.mr-start-art,.mr-hold-art,.mr-summit-art,.mr-stage-ridge,.mr-start-meadow) {
  display: none !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-titlebar {
  width: 100% !important;
  min-height: 64px !important;
  margin: 0 0 8px !important;
  padding: 9px 86px 9px 16px !important;
  border: 1px solid rgba(255,255,255,.2) !important;
  border-radius: 15px !important;
  background: rgba(5,24,38,.86) !important;
  box-shadow: 0 7px 18px rgba(5,18,29,.22) !important;
  backdrop-filter: none !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-titlebar h2 {
  color: #fff !important;
  font-size: clamp(24px, 4vw, 38px) !important;
  line-height: .95 !important;
  letter-spacing: .045em !important;
  text-shadow: 0 2px 4px rgba(0,0,0,.35) !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-titlebar :is(p,small) { color: #bfeaff !important; }
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-race-clock {
  top: 8px !important;
  right: 10px !important;
  width: 65px !important;
  height: 48px !important;
  border: 1px solid rgba(255,255,255,.24) !important;
  border-radius: 11px !important;
  background: rgba(3,15,24,.9) !important;
  box-shadow: none !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-race-stage {
  display: grid !important;
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  gap: clamp(6px, 1.2vw, 11px) !important;
  width: 100% !important;
  padding: 0 !important;
  background: transparent !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-race-stage::before { content: none !important; }
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-lane {
  min-width: 0 !important;
  overflow: hidden !important;
  border: 1px solid rgba(255,255,255,.22) !important;
  border-radius: 15px !important;
  background: rgba(7,27,39,.23) !important;
  box-shadow: 0 8px 18px rgba(4,16,25,.2) !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-player-card {
  position: relative !important;
  z-index: 40 !important;
  min-height: 48px !important;
  padding: 7px 8px !important;
  border: 0 !important;
  border-bottom: 1px solid rgba(255,255,255,.2) !important;
  border-radius: 0 !important;
  background: rgba(5,24,37,.9) !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-lane.me .mr-player-card { box-shadow: inset 4px 0 var(--mr-v44-blue) !important; }
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-lane.opponent .mr-player-card { box-shadow: inset -4px 0 var(--mr-v44-orange) !important; }
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-player-badge {
  width: 34px !important;
  height: 34px !important;
  border: 0 !important;
  background: var(--mr-v44-blue) !important;
  box-shadow: none !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-lane.opponent .mr-player-badge { background: var(--mr-v44-orange) !important; }
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-player-copy strong { color: #fff !important; }
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-player-copy small { color: #b7d4df !important; }
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-player-progress { color: #eefaff !important; }
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-climb-viewport {
  position: relative !important;
  height: clamp(410px, 55vh, 525px) !important;
  min-height: 0 !important;
  overflow: hidden !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: linear-gradient(180deg, rgba(133,210,242,.12), rgba(8,29,42,.2)) !important;
  box-shadow: none !important;
  contain: layout paint;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-climb-viewport::before,
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-climb-viewport::after { content: none !important; display: none !important; }
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-mountain-wall {
  position: absolute !important;
  left: 50% !important;
  right: auto !important;
  bottom: 0 !important;
  width: min(96%, 410px) !important;
  height: var(--mr-wall-height, 2508px) !important;
  overflow: visible !important;
  transform: translate(-50%, var(--mr-wall-scroll, 0px)) !important;
  transition: transform 520ms cubic-bezier(.2,.76,.22,1) !important;
  border: 0 !important;
  border-radius: 0 !important;
  clip-path: none !important;
  background: #26343a !important;
  box-shadow: 0 0 18px rgba(2,10,15,.32) !important;
  filter: none !important;
  contain: layout style paint;
  will-change: transform;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-mountain-wall::before,
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-mountain-wall::after { content: none !important; display: none !important; }
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-v44-cliff {
  position: absolute;
  inset: -52px 0 -34px;
  z-index: 1;
  display: block !important;
  background: url('/assets/mountain-race/images/summit-sprint-reboot-cliff-v44.png') center center / auto 100% no-repeat;
  pointer-events: none;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-lane.opponent .mr-v44-cliff { transform: scaleX(-1); }
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-v44-start {
  position: absolute;
  left: 50%;
  bottom: -17px;
  z-index: 5;
  display: block !important;
  width: 78%;
  height: 78px;
  transform: translateX(-50%);
  border: 1px solid rgba(255,255,255,.22);
  border-radius: 50% 50% 18% 18%;
  background: linear-gradient(180deg, #7ba844 0 16%, #4b6337 17% 26%, #344047 27% 100%);
  box-shadow: 0 10px 13px rgba(1,9,13,.34);
}
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-v44-start i {
  position: absolute;
  inset: -7px 8% auto;
  height: 14px;
  border-radius: 50%;
  background: #9fc95b;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-rock-hold {
  position: absolute !important;
  left: var(--mr-hold-left, 50%) !important;
  bottom: var(--mr-hold-bottom, 86px) !important;
  z-index: 12 !important;
  display: grid !important;
  place-items: center !important;
  width: 94px !important;
  height: 45px !important;
  transform: translate(-50%, 50%) !important;
  overflow: visible !important;
  border: 1px solid rgba(220,233,236,.34) !important;
  border-radius: 46% 42% 35% 39% !important;
  background: linear-gradient(155deg, #78878b, #3f4b50 56%, #222d31) !important;
  box-shadow: inset 0 5px 7px rgba(255,255,255,.13), inset 0 -8px 9px rgba(0,0,0,.2), 0 7px 8px rgba(1,9,13,.42) !important;
  filter: none !important;
  opacity: 1 !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-rock-hold::before,
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-rock-hold::after { content: none !important; display: none !important; }
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-rock-hold.passed { opacity: .58 !important; }
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-rock-hold.current {
  border-color: #fff !important;
  box-shadow: inset 0 5px 7px rgba(255,255,255,.18), 0 0 0 3px rgba(33,168,255,.38), 0 8px 10px rgba(1,9,13,.46) !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-lane.opponent .mr-rock-hold.current { box-shadow: inset 0 5px 7px rgba(255,255,255,.18), 0 0 0 3px rgba(255,155,56,.34), 0 8px 10px rgba(1,9,13,.46) !important; }
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-rock-hold b {
  position: relative !important;
  z-index: 2 !important;
  display: grid !important;
  place-items: center !important;
  width: 31px !important;
  height: 31px !important;
  border: 1px solid rgba(255,255,255,.6) !important;
  border-radius: 50% !important;
  background: rgba(4,20,30,.9) !important;
  color: #fff !important;
  box-shadow: 0 2px 5px rgba(0,0,0,.4) !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-rock-hold b svg { width: 18px !important; height: 18px !important; }
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-rock-hold.unknown b { opacity: .12 !important; }
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-finish-ledge {
  position: absolute !important;
  left: 50% !important;
  right: auto !important;
  bottom: var(--mr-summit-bottom) !important;
  z-index: 10 !important;
  display: block !important;
  width: 76% !important;
  height: 72px !important;
  transform: translate(-50%, 50%) !important;
  overflow: visible !important;
  border: 1px solid rgba(255,255,255,.28) !important;
  border-radius: 50% 50% 22% 22% !important;
  background: linear-gradient(180deg, #91b752 0 14%, #576d3d 15% 24%, #4f5c60 25%, #28343a 100%) !important;
  box-shadow: 0 10px 12px rgba(1,9,13,.4) !important;
  filter: none !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-finish-ledge > i {
  position: absolute !important;
  left: 12% !important;
  right: 12% !important;
  top: -7px !important;
  display: block !important;
  height: 13px !important;
  border-radius: 50% !important;
  background: #acd56a !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-finish-ledge > b {
  position: absolute !important;
  left: 50% !important;
  top: 13px !important;
  display: block !important;
  transform: translateX(-50%) !important;
  color: #fff !important;
  font-size: 10px !important;
  letter-spacing: .18em !important;
  text-shadow: 0 2px 3px rgba(0,0,0,.6) !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-climber {
  --mr-v44-hand-anchor: -45px;
  position: absolute !important;
  left: calc(var(--mr-climber-left, 50%) + var(--mr-v44-hand-anchor)) !important;
  bottom: var(--mr-climber-bottom, 20px) !important;
  z-index: 24 !important;
  display: block !important;
  width: 154px !important;
  height: 205px !important;
  transform: translate(-50%, 50%) !important;
  transform-origin: 50% 72% !important;
  transition: none !important;
  animation: none !important;
  filter: drop-shadow(0 7px 5px rgba(0,0,0,.42)) !important;
  will-change: translate, rotate;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-climber.direction-left { --mr-v44-hand-anchor: 45px; }
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-climber.finished { --mr-v44-hand-anchor: 0px; left: 50% !important; }
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-climber::before,
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-climber::after,
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-climber > * { display: none !important; }
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-climber > .mr-v44-climber-sprite {
  position: absolute !important;
  inset: 0 !important;
  z-index: 2 !important;
  display: block !important;
  opacity: 1 !important;
  background-image: url('/assets/mountain-race/images/summit-sprint-reboot-climber-sheet-v44.png') !important;
  background-size: 400% 200% !important;
  background-position: var(--mr-v44-frame-x, 0%) var(--mr-v44-frame-y, 0%) !important;
  background-repeat: no-repeat !important;
  animation: none !important;
  pointer-events: none;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-climber.direction-left > .mr-v44-climber-sprite { transform: scaleX(-1); }
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-climber.opponent > .mr-v44-climber-sprite {
  background-image: url('/assets/mountain-race/images/summit-sprint-reboot-climber-opponent-sheet-v44.png') !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-climber:is(.climb-up,.climb-left,.climb-right,.climb-down) > .mr-motion-frame-0.mr-v44-climber-sprite {
  display: block !important;
  background-image: url('/assets/mountain-race/images/summit-sprint-reboot-climber-sheet-v44.png') !important;
  background-position: var(--mr-v44-frame-x, 0%) var(--mr-v44-frame-y, 0%) !important;
  animation: mrV44ReachFrames 520ms steps(1,end) both !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-climber.opponent:is(.climb-up,.climb-left,.climb-right,.climb-down) > .mr-motion-frame-0.mr-v44-climber-sprite {
  background-image: url('/assets/mountain-race/images/summit-sprint-reboot-climber-opponent-sheet-v44.png') !important;
  animation: mrV44ReachFrames 520ms steps(1,end) both !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-climber.slip > .mr-motion-frame-0.mr-v44-climber-sprite {
  display: block !important;
  background-image: url('/assets/mountain-race/images/summit-sprint-reboot-climber-sheet-v44.png') !important;
  background-position: var(--mr-v44-frame-x, 0%) var(--mr-v44-frame-y, 0%) !important;
  animation: mrV44SlipFrames 620ms steps(1,end) both !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-climber.opponent.slip > .mr-motion-frame-0.mr-v44-climber-sprite {
  background-image: url('/assets/mountain-race/images/summit-sprint-reboot-climber-opponent-sheet-v44.png') !important;
  animation: mrV44SlipFrames 620ms steps(1,end) both !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-climber.celebrate > .mr-motion-frame-0.mr-v44-climber-sprite {
  display: block !important;
  background-image: url('/assets/mountain-race/images/summit-sprint-reboot-climber-sheet-v44.png') !important;
  --mr-v44-frame-x: 100%;
  --mr-v44-frame-y: 100%;
  background-position: var(--mr-v44-frame-x) var(--mr-v44-frame-y) !important;
  animation: mrV44Celebrate 520ms ease-in-out infinite alternate !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-climber.opponent.celebrate > .mr-motion-frame-0.mr-v44-climber-sprite {
  background-image: url('/assets/mountain-race/images/summit-sprint-reboot-climber-opponent-sheet-v44.png') !important;
}
@keyframes mrV44ReachFrames {
  0%, 13% { --mr-v44-frame-x: 0%; --mr-v44-frame-y: 0%; }
  13.01%, 29% { --mr-v44-frame-x: 33.333%; --mr-v44-frame-y: 0%; }
  29.01%, 46% { --mr-v44-frame-x: 66.667%; --mr-v44-frame-y: 0%; }
  46.01%, 66% { --mr-v44-frame-x: 100%; --mr-v44-frame-y: 0%; }
  66.01%, 84% { --mr-v44-frame-x: 0%; --mr-v44-frame-y: 100%; }
  84.01%, 100% { --mr-v44-frame-x: 33.333%; --mr-v44-frame-y: 100%; }
}
@keyframes mrV44SlipFrames {
  0%, 24% { --mr-v44-frame-x: 33.333%; --mr-v44-frame-y: 100%; }
  24.01%, 78% { --mr-v44-frame-x: 66.667%; --mr-v44-frame-y: 100%; }
  78.01%, 100% { --mr-v44-frame-x: 0%; --mr-v44-frame-y: 0%; }
}
@keyframes mrV44Celebrate {
  from { transform: translateY(0) scale(1); }
  to { transform: translateY(-5px) scale(1.025); }
}
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-winner-confetti { z-index: 35 !important; }
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-altitude-meter { display: none !important; }
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-command-deck {
  display: grid !important;
  grid-template-columns: minmax(0, 1fr) auto !important;
  gap: 10px !important;
  margin: 8px 0 0 !important;
  padding: 9px 10px !important;
  border: 1px solid rgba(255,255,255,.2) !important;
  border-radius: 15px !important;
  background: rgba(5,24,37,.9) !important;
  box-shadow: 0 7px 18px rgba(5,18,29,.22) !important;
  backdrop-filter: none !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-next-moves { background: transparent !important; border: 0 !important; box-shadow: none !important; backdrop-filter: none !important; }
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-prompt { border-color: rgba(255,255,255,.24) !important; background: rgba(8,37,54,.92) !important; box-shadow: none !important; }
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-prompt.active { border-color: #73cbff !important; background: #0f668f !important; }
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-control {
  border: 1px solid rgba(255,255,255,.23) !important;
  background: #163c50 !important;
  box-shadow: 0 4px 0 #092432 !important;
  filter: none !important;
}
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-control:not(:disabled):active { transform: translateY(3px) !important; box-shadow: 0 1px 0 #092432 !important; }
[data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-control:disabled { opacity: .42 !important; }
@media (max-width: 620px) {
  [data-mountain-race-mount][data-mr-visual-reboot="44"] { border-radius: 14px; }
  [data-mountain-race-mount][data-mr-visual-reboot="44"] .mountain-race-game { padding: 5px !important; }
  [data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-titlebar { min-height: 56px !important; padding: 7px 68px 7px 11px !important; border-radius: 11px !important; }
  [data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-titlebar h2 { font-size: clamp(21px, 7vw, 29px) !important; }
  [data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-expedition-meta { display: none !important; }
  [data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-race-clock { width: 54px !important; height: 42px !important; top: 7px !important; right: 7px !important; }
  [data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-race-stage { gap: 4px !important; }
  [data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-lane { border-radius: 10px !important; }
  [data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-player-card { min-height: 43px !important; padding: 5px !important; }
  [data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-player-badge { width: 28px !important; height: 28px !important; font-size: 8px !important; }
  [data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-player-copy strong { max-width: 72px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 10px !important; }
  [data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-player-copy small { font-size: 7px !important; }
  [data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-player-progress { font-size: 8px !important; }
  [data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-climb-viewport { height: clamp(365px, 57vh, 445px) !important; }
  [data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-mountain-wall { width: 96% !important; }
  [data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-rock-hold { width: 66px !important; height: 35px !important; }
  [data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-rock-hold b { width: 25px !important; height: 25px !important; }
  [data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-rock-hold b svg { width: 15px !important; height: 15px !important; }
  [data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-climber { --mr-v44-hand-anchor: -30px; width: 102px !important; height: 136px !important; }
  [data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-climber.direction-left { --mr-v44-hand-anchor: 30px; }
  [data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-climber.finished { --mr-v44-hand-anchor: 0px; }
  [data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-finish-ledge { height: 58px !important; }
  [data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-command-deck { grid-template-columns: 1fr !important; gap: 6px !important; padding: 7px !important; border-radius: 11px !important; }
}
@media (prefers-reduced-motion: reduce) {
  [data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-mountain-wall { transition-duration: 1ms !important; }
  [data-mountain-race-mount][data-mr-visual-reboot="44"] .mr-climber > .mr-v44-climber-sprite { animation-duration: 1ms !important; }
}
`;

function updateDocument(source) {
  source = source
    .replace(/^\s*<link rel="preload" as="image" href="\/assets\/mountain-race\/images\/summit-sprint-(?:sky-v29|cliff-left-v29|cliff-right-v29)\.png" fetchpriority="high">\s*$/gm, '')
    .replace(/(?:&visual=\d+)+/g, '&visual=44');
  if (!source.includes('summit-sprint-reboot-background-v44.png')) {
    const preloads = [
      '  <link rel="preload" as="image" href="/assets/mountain-race/images/summit-sprint-reboot-background-v44.png" fetchpriority="high">',
      '  <link rel="preload" as="image" href="/assets/mountain-race/images/summit-sprint-reboot-cliff-v44.png" fetchpriority="high">',
      '  <link rel="preload" as="image" href="/assets/mountain-race/images/summit-sprint-reboot-climber-sheet-v44.png" fetchpriority="high">',
      '  <link rel="preload" as="image" href="/assets/mountain-race/images/summit-sprint-reboot-climber-opponent-sheet-v44.png" fetchpriority="high">'
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
console.log('Applied Summit Sprint V44 lightweight visual and animation-first reboot.');
