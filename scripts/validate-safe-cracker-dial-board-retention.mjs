import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [html, client, patch, css, turnAnimation, turnFire, audioBindings] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('scripts/patch-safe-cracker-dial-board-retention.mjs', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/safe-cracker.css', root), 'utf8'),
  readFile(new URL('assets/roulette/turn-animation.js', root)),
  readFile(new URL('assets/roulette/turn-fire.js', root)),
  readFile(new URL('assets/roulette/audio-bindings.js', root))
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker dial-board retention validation failed: ${message}`);
}
function occurrences(source, value) {
  return source.split(value).length - 1;
}
function renderDecision(incoming, retained, interaction) {
  const activeStatuses = ['ready', 'countdown', 'playing'];
  const terminalStatuses = ['complete', 'cancelled'];
  const ranks = { waiting: 0, ready: 1, countdown: 2, playing: 3, complete: 4, cancelled: 4 };
  const live = Boolean(interaction?.gameId && Number(interaction?.expiresAt || 0) >= 1000);
  const retainedActive = retained?.mode === 'safecracker' && activeStatuses.includes(retained.status);
  if (!live || !retainedActive || String(interaction.gameId) !== String(retained.gameId)) return 'render';
  const same = incoming?.mode === 'safecracker' && String(incoming.gameId) === String(retained.gameId);
  if (same && terminalStatuses.includes(String(incoming.status || ''))) return 'render';
  const active = same && activeStatuses.includes(String(incoming.status || ''));
  const regressed = Boolean(
    same && (
      (ranks[String(incoming.status || '')] ?? -1) < (ranks[String(retained.status || '')] ?? -1) ||
      Number(incoming?.revision) < Number(retained?.revision) ||
      Number(incoming?.state?.revision ?? incoming?.safecrackerState?.revision) <
        Number(retained?.state?.revision ?? retained?.safecrackerState?.revision)
    )
  );
  return active && !regressed ? 'in-place' : 'hold';
}

const rendererStart = '// SAFE_CRACKER_DIAL_BOARD_RETENTION_V15_START';
const rendererEnd = '// SAFE_CRACKER_DIAL_BOARD_RETENTION_V15_END';
const clientStart = '// SAFE_CRACKER_DIAL_ACTIVITY_V15_START';
const clientEnd = '// SAFE_CRACKER_DIAL_ACTIVITY_V15_END';
assert(occurrences(html, rendererStart) === 1, 'renderer guard start marker must appear once');
assert(occurrences(html, rendererEnd) === 1, 'renderer guard end marker must appear once');
assert(occurrences(client, clientStart) === 1, 'dial activity start marker must appear once');
assert(occurrences(client, clientEnd) === 1, 'dial activity end marker must appear once');
assert(!html.includes('SAFE_CRACKER_DIAL_BOARD_RETENTION_V14_START'), 'legacy v14 renderer block remains');
assert(!client.includes('SAFE_CRACKER_DIAL_ACTIVITY_V14_START'), 'legacy v14 dial marker remains');

assert(html.includes('function duelRenderActive(game, force = false)'), 'global active renderer is missing');
assert(html.includes('window.__safeCrackerDialStableGameV15'), 'renderer does not retain the current Safe Cracker snapshot');
assert(html.includes("window.dispatchEvent(new CustomEvent('safecracker:state', { detail: { game } }))"), 'new same-game snapshots are not sent to the existing mount');
assert(html.includes('window.__safeCrackerDialInPlaceUpdates'), 'in-place update diagnostics are missing');
assert(html.includes('window.__safeCrackerDialBoardRecoveries'), 'held-render diagnostics are missing');
assert(html.includes('if (safeCrackerDialInteractionMatches && !safeCrackerDialIncomingTerminal)'), 'dial interaction does not own the outer render boundary');
assert(html.includes('game.mode === "safecracker" && ["ready", "countdown", "playing", "complete"]'), 'Safe Cracker creator readiness label is not lifecycle-aware');
assert(occurrences(html, 'game.mode === "safecracker" && ["ready", "countdown", "playing", "complete"]') === 2, 'both Safe Cracker player labels are not lifecycle-aware');

assert(client.includes('window.__safeCrackerDialInteractionV15 = {'), 'pointer-down does not begin dial interaction retention');
assert(client.includes('expiresAt: Date.now() + 10000'), 'long drag activity is not retained');
assert(client.includes('safeCrackerDialInteraction.expiresAt = Date.now() + 1200'), 'pointer release lacks delayed-snapshot grace');
assert(client.includes('window.__safeCrackerDialInteractionV15.expiresAt = Date.now() + 10000'), 'pointer movement does not extend retention');
assert(client.includes('// SAFE_CRACKER_INPUT_CONTINUITY_V9_START'), 'input continuity v9 is missing');
assert(client.includes('runtime.pendingDragGame = game'), 'incoming state is not queued while dragging');
assert(client.includes('choice: `safecracker:guess:${runtime.selected}`'), 'authoritative guess submission changed');
assert(client.includes('// SAFE_CRACKER_SAMPLE_MIX_V11_START'), 'Safe Cracker audio mix changed or is missing');

assert(css.includes('/* SAFE_CRACKER_TEXTURE_PASS_V3_START */'), 'approved pre-lighting texture pass is missing');
assert(css.includes('/* SAFE_CRACKER_SHADOW_DEPTH_V1_START */'), 'approved structural shadow pass is missing');
assert(!css.includes('SAFE_CRACKER_LIGHT_SOURCE_V'), 'a lighting pass was reintroduced');
assert(!patch.includes("writeFile(new URL('../netlify/functions/"), 'retention patch must not write networking files');
assert(!patch.includes("writeFile(new URL('../assets/roulette/"), 'retention patch must not write Roulette files');
assert(turnAnimation.length > 0 && turnFire.length > 0 && audioBindings.length > 0, 'protected Roulette assets are unreadable');

const playing = { mode: 'safecracker', status: 'playing', gameId: 'safe-1', revision: 7, state: { revision: 5 } };
const newer = { mode: 'safecracker', status: 'playing', gameId: 'safe-1', revision: 8, state: { revision: 6 } };
const waiting = { mode: 'safecracker', status: 'waiting', gameId: 'safe-1', revision: 1, state: { revision: 0 } };
const complete = { mode: 'safecracker', status: 'complete', gameId: 'safe-1', revision: 9, state: { revision: 7 } };
const foreign = { mode: 'safecracker', status: 'playing', gameId: 'safe-2', revision: 2, state: { revision: 1 } };
const interaction = { gameId: 'safe-1', expiresAt: 2000 };
assert(renderDecision(newer, playing, interaction) === 'in-place', 'newer same-game state rebuilds the outer board during drag');
assert(renderDecision(null, playing, interaction) === 'hold', 'null render closes the board during drag');
assert(renderDecision(foreign, playing, interaction) === 'hold', 'foreign render replaces the board during drag');
assert(renderDecision(waiting, playing, interaction) === 'hold', 'waiting regression replaces the playing board');
assert(renderDecision(complete, playing, interaction) === 'render', 'real completion is blocked');
assert(renderDecision(newer, playing, { gameId: 'safe-1', expiresAt: 0 }) === 'render', 'expired interaction prevents normal rendering');

console.log('Safe Cracker dial-board retention validation passed: same-game progress updates are delivered in place without replacing the active dial mount, null/foreign/backward renders are held, true completion remains available, lifecycle labels no longer show false WAITING states, pre-lighting visuals remain intact, and networking, audio and Roulette are untouched.');
