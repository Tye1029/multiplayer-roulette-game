import { readFile, writeFile } from 'node:fs/promises';

const dataUrl = new URL('../netlify/functions/_data.js', import.meta.url);
const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const stylesUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Safe Cracker start-flow patch could not find ${label}.`);
  return source.replace(before, after);
}

let data = await readFile(dataUrl, 'utf8');

data = replaceRequired(
  data,
  '  const startMs = atMs + DUEL_COUNTDOWN_MS;',
  '  const startMs = atMs + (game?.mode === "safecracker" ? 3000 : DUEL_COUNTDOWN_MS);',
  'Safe Cracker three-second authoritative countdown'
);

data = replaceRequired(
  data,
  `      if (game.mode === "roulette") {
        // Roulette is fully turn based. Confirm the NPC in the same authoritative
        // Ready transaction so adding it cannot stall on a later polling request.`,
  `      if (game.mode === "roulette" || game.mode === "safecracker") {
        // Roulette and Safe Cracker confirm the test opponent in the same
        // authoritative Ready transaction so one human tap starts the countdown.`,
  'single-tap Safe Cracker Remote Bot readiness'
);

data = replaceRequired(
  data,
  '    let latest = await duelGetRawStrong(gameId, 2) || fallback;',
  '    let latest = await duelGetRawStrong(gameId, 2) || await duelGetRaw(gameId) || fallback;',
  'verified guess read fallback'
);

data = replaceRequired(
  data,
  '    const beforeSave = await duelGetRawStrong(gameId, 1);',
  '    const beforeSave = await duelGetRawStrong(gameId, 1) || await duelGetRaw(gameId);',
  'pre-save read fallback'
);

data = replaceRequired(
  data,
  '      const confirmedComplete = await duelGetRawStrong(gameId, 2) || completed;',
  '      const confirmedComplete = await duelGetRawStrong(gameId, 2) || await duelGetRaw(gameId) || completed;',
  'completed write verification fallback'
);

data = replaceRequired(
  data,
  '    const confirmed = await duelGetRawStrong(gameId, 2) || saved;',
  '    const confirmed = await duelGetRawStrong(gameId, 2) || await duelGetRaw(gameId) || saved;',
  'normal write verification fallback'
);

data = replaceRequired(
  data,
  '  return await duelGetRawStrong(gameId, 2) || fallback;',
  '  return await duelGetRawStrong(gameId, 2) || await duelGetRaw(gameId) || fallback;',
  'final verified write fallback'
);

data = replaceRequired(
  data,
  '    let latest = await duelGetRawStrong(gameId, 2);',
  '    let latest = await duelGetRawStrong(gameId, 2) || await duelGetRaw(gameId) || game;',
  'Safe Cracker bot advancement read fallback'
);

data = replaceRequired(
  data,
  '    let game = await duelGetRawStrong(gameId, 2);',
  '    let game = await duelGetRawStrong(gameId, 2) || await duelGetRaw(gameId);',
  'Safe Cracker action read fallback'
);

await writeFile(dataUrl, data);

let client = await readFile(clientUrl, 'utf8');

const countdownHelper = `  // SAFE_CRACKER_START_COUNTDOWN_START
  function safeCrackerStartCountdownLabel(game = runtime.game) {
    const startMs = Date.parse(String(game?.startAt || ''));
    if (!Number.isFinite(startMs)) return '';
    const now = serverNowMs();
    const remaining = startMs - now;
    if (game?.status === 'countdown') {
      if (remaining > 2000) return '3';
      if (remaining > 1000) return '2';
      if (remaining > 0) return '1';
      return 'GO!';
    }
    if (game?.status === 'playing' && now < startMs + 500) return 'GO!';
    return '';
  }
  // SAFE_CRACKER_START_COUNTDOWN_END

`;
if (!client.includes('// SAFE_CRACKER_START_COUNTDOWN_START')) {
  client = replaceRequired(
    client,
    '  function formatTimer(seconds) {',
    `${countdownHelper}  function formatTimer(seconds) {`,
    'Safe Cracker countdown helper insertion point'
  );
}

client = replaceRequired(
  client,
  `    const displayText = latest ? tierLabel(latest.tier) : game.status === 'countdown' ? 'GET READY' : 'TURN THE DIAL';
    const opponentName`,
  `    const displayText = latest ? tierLabel(latest.tier) : game.status === 'countdown' ? 'GET READY' : 'TURN THE DIAL';
    const startCountdownLabel = safeCrackerStartCountdownLabel(game);
    const opponentName`,
  'Safe Cracker countdown render label'
);

client = replaceRequired(
  client,
  `    mount.innerHTML = \`<section class="safe-cracker-game" data-sc-game-id="\${escapeHtml(game.gameId || '')}" data-sc-status="\${escapeHtml(game.status || '')}">
      <div class="sc-topbar">`,
  `    mount.innerHTML = \`<section class="safe-cracker-game" data-sc-game-id="\${escapeHtml(game.gameId || '')}" data-sc-status="\${escapeHtml(game.status || '')}">
      \${startCountdownLabel ? \`<div class="sc-start-countdown-overlay" data-sc-start-countdown><span class="\${startCountdownLabel === 'GO!' ? 'go' : ''}">\${escapeHtml(startCountdownLabel)}</span></div>\` : ''}
      <div class="sc-topbar">`,
  'Safe Cracker countdown overlay'
);

client = replaceRequired(
  client,
  `  function updateTimerOnly() {
    const timer = document.querySelector('[data-sc-timer]');
    if (!timer || !runtime.game) return;
    const seconds = secondsLeft(runtime.game);
    timer.textContent = formatTimer(seconds);
    timer.classList.toggle('danger', seconds <= 10 && runtime.game.status === 'playing');
  }`,
  `  function updateTimerOnly() {
    if (!runtime.game) return;
    const timer = document.querySelector('[data-sc-timer]');
    if (timer) {
      const seconds = secondsLeft(runtime.game);
      timer.textContent = formatTimer(seconds);
      timer.classList.toggle('danger', seconds <= 10 && runtime.game.status === 'playing');
    }
    const countdown = document.querySelector('[data-sc-start-countdown]');
    if (countdown) {
      const label = safeCrackerStartCountdownLabel(runtime.game);
      if (!label) countdown.remove();
      else {
        const text = countdown.querySelector('span');
        if (text && text.textContent !== label) {
          text.textContent = label;
          text.className = label === 'GO!' ? 'go' : '';
          text.style.animation = 'none';
          void text.offsetWidth;
          text.style.animation = '';
        }
      }
    }
  }`,
  'Safe Cracker live countdown updater'
);

await writeFile(clientUrl, client);

let styles = await readFile(stylesUrl, 'utf8');
if (!styles.includes('.sc-start-countdown-overlay')) {
  styles += `

.sc-start-countdown-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147482500;
  display: grid;
  place-items: center;
  pointer-events: none;
  background: rgba(2, 5, 8, .18);
}
.sc-start-countdown-overlay span {
  color: var(--sc-brass-light);
  font: 1000 clamp(5rem, 24vw, 10rem)/1 Arial, sans-serif;
  text-shadow: 0 8px 0 rgba(0,0,0,.38), 0 0 32px rgba(244,212,134,.55);
  animation: scStartCountdownPop .28s cubic-bezier(.2,.85,.25,1);
}
.sc-start-countdown-overlay span.go { color: var(--sc-green); }
@keyframes scStartCountdownPop {
  0% { opacity: 0; transform: scale(.52); }
  60% { opacity: 1; transform: scale(1.12); }
  100% { opacity: 1; transform: scale(1); }
}
`;
}
await writeFile(stylesUrl, styles);

let html = await readFile(indexUrl, 'utf8');
html = replaceRequired(
  html,
  `      if(game.mode==='roulette'){
        duelHideCountdownPortal();`,
  `      if(game.mode==='safecracker'){
        duelHideCountdownPortal();
        duelStartLocallyAtAuthoritativeTime(game);
        return true;
      }
      if(game.mode==='roulette'){
        duelHideCountdownPortal();`,
  'dedicated Safe Cracker countdown ownership'
);
html = html.replaceAll('/assets/safe-cracker/safe-cracker.css?v=2', '/assets/safe-cracker/safe-cracker.css?v=3');
html = html.replaceAll('/assets/safe-cracker/safe-cracker.js?v=2', '/assets/safe-cracker/safe-cracker.js?v=3');
await writeFile(indexUrl, html);

console.log('Patched Safe Cracker action availability, one-tap Ready, and dedicated 3-2-1-GO countdown.');
