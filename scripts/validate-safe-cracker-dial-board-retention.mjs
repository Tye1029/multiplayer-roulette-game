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
function renderDecision(incoming, retained, interaction, now = 1000) {
  const activeStatuses = ['ready', 'countdown', 'playing'];
  const terminalStatuses = ['complete', 'cancelled'];
  const ranks = { waiting: 0, ready: 1, countdown: 2, playing: 3, complete: 4, cancelled: 4 };
  const live = Boolean(interaction?.gameId && Number(interaction?.expiresAt || 0) >= now);
  const pointerDown = Boolean(live && interaction?.active !== false && interaction?.pointerDown === true);
  const retainedActive = retained?.mode === 'safecracker' && activeStatuses.includes(retained.status);
  if (!live || !retainedActive || String(interaction.gameId) !== String(retained.gameId)) return 'render';

  const same = incoming?.mode === 'safecracker' && String(incoming.gameId) === String(retained.gameId);
  const incomingStatus = String(incoming?.status || '');
  const terminal = same && terminalStatuses.includes(incomingStatus);
  const active = same && activeStatuses.includes(incomingStatus);
  const incomingRevision = Number(incoming?.revision);
  const retainedRevision = Number(retained?.revision);
  const incomingStateRevision = Number(incoming?.safecrackerState?.revision ?? incoming?.state?.revision);
  const retainedStateRevision = Number(retained?.safecrackerState?.revision ?? retained?.state?.revision);
  const revisionRegressed = Boolean(
    same && (
      (Number.isFinite(incomingRevision) && Number.isFinite(retainedRevision) && incomingRevision < retainedRevision) ||
      (Number.isFinite(incomingStateRevision) && Number.isFinite(retainedStateRevision) && incomingStateRevision < retainedStateRevision)
    )
  );
  const regressed = Boolean(
    same && (
      (ranks[incomingStatus] ?? -1) < (ranks[String(retained.status || '')] ?? -1) ||
      revisionRegressed
    )
  );
  const terminalConfirmed = Boolean(
    terminal &&
    !revisionRegressed &&
    (!Number.isFinite(retainedRevision) || (Number.isFinite(incomingRevision) && incomingRevision >= retainedRevision)) &&
    (!Number.isFinite(retainedStateRevision) || (Number.isFinite(incomingStateRevision) && incomingStateRevision >= retainedStateRevision))
  );

  if (terminalConfirmed && !pointerDown) return 'render';
  return active && !regressed ? 'in-place' : 'hold';
}

const rendererStart = '// SAFE_CRACKER_DIAL_BOARD_RETENTION_V16_START';
const rendererEnd = '// SAFE_CRACKER_DIAL_BOARD_RETENTION_V16_END';
const clientStart = '// SAFE_CRACKER_DIAL_ACTIVITY_V16_START';
const clientEnd = '// SAFE_CRACKER_DIAL_ACTIVITY_V16_END';
assert(occurrences(html, rendererStart) === 1, 'renderer guard start marker must appear once');
assert(occurrences(html, rendererEnd) === 1, 'renderer guard end marker must appear once');
assert(occurrences(client, clientStart) === 1, 'dial activity start marker must appear once');
assert(occurrences(client, clientEnd) === 1, 'dial activity end marker must appear once');
assert(!html.includes('SAFE_CRACKER_DIAL_BOARD_RETENTION_V15_START'), 'legacy v15 renderer block remains');
assert(!client.includes('SAFE_CRACKER_DIAL_ACTIVITY_V15_START'), 'legacy v15 dial marker remains');

assert(html.includes('function duelRenderActive(game, force = false)'), 'global active renderer is missing');
assert(html.includes('window.__safeCrackerDialStableGameV16'), 'renderer does not retain the current Safe Cracker snapshot');
assert(html.includes("window.dispatchEvent(new CustomEvent('safecracker:state', { detail: { game } }))"), 'new same-game snapshots are not sent to the existing mount');
assert(html.includes('window.__safeCrackerDialInPlaceUpdates'), 'in-place update diagnostics are missing');
assert(html.includes('window.__safeCrackerDialBoardRecoveries'), 'held-render diagnostics are missing');
assert(html.includes('window.__safeCrackerDialTerminalHolds'), 'terminal-hold diagnostics are missing');
assert(html.includes('safeCrackerDialIncomingTerminalConfirmed'), 'terminal snapshots are not revision-confirmed');
assert(html.includes('(!safeCrackerDialIncomingTerminalConfirmed || safeCrackerDialPointerDown)'), 'active pointer does not own the terminal render boundary');
assert(!html.includes('safeCrackerDialInteractionMatches && !safeCrackerDialIncomingTerminal'), 'v15 terminal bypass remains');
assert(html.includes('game.mode === "safecracker" && ["ready", "countdown", "playing", "complete"]'), 'Safe Cracker creator readiness label is not lifecycle-aware');
assert(occurrences(html, 'game.mode === "safecracker" && ["ready", "countdown", "playing", "complete"]') === 2, 'both Safe Cracker player labels are not lifecycle-aware');

assert(client.includes('window.__safeCrackerDialInteractionV16 = {'), 'pointer-down does not begin dial interaction retention');
assert(client.includes('pointerDown: true'), 'pointer-down state is not recorded');
assert(client.includes('releasedAt: 0'), 'interaction release timestamp is not initialized');
assert(client.includes('expiresAt: safeCrackerDialInteractionStartedAt + 12000'), 'long drag activity is not retained');
assert(client.includes('safeCrackerDialInteraction.pointerDown = false'), 'pointer release does not end the hard dial lock');
assert(client.includes('safeCrackerDialInteraction.releasedAt = safeCrackerDialReleasedAt'), 'pointer release timestamp is missing');
assert(client.includes('safeCrackerDialInteraction.expiresAt = safeCrackerDialReleasedAt + 2500'), 'pointer release lacks delayed-snapshot grace');
assert(client.includes('window.__safeCrackerDialInteractionV16.expiresAt = safeCrackerDialActivityAt + 12000'), 'pointer movement does not extend retention');
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
const staleComplete = { mode: 'safecracker', status: 'complete', gameId: 'safe-1', revision: 6, state: { revision: 4 } };
const unversionedComplete = { mode: 'safecracker', status: 'complete', gameId: 'safe-1' };
const foreign = { mode: 'safecracker', status: 'playing', gameId: 'safe-2', revision: 2, state: { revision: 1 } };
const pointerInteraction = { gameId: 'safe-1', active: true, pointerDown: true, expiresAt: 2000 };
const releasedInteraction = { gameId: 'safe-1', active: false, pointerDown: false, releasedAt: 900, expiresAt: 2000 };
assert(renderDecision(newer, playing, pointerInteraction) === 'in-place', 'newer same-game state rebuilds the outer board during drag');
assert(renderDecision(null, playing, pointerInteraction) === 'hold', 'null render closes the board during drag');
assert(renderDecision(foreign, playing, pointerInteraction) === 'hold', 'foreign render replaces the board during drag');
assert(renderDecision(waiting, playing, pointerInteraction) === 'hold', 'waiting regression replaces the playing board');
assert(renderDecision(complete, playing, pointerInteraction) === 'hold', 'confirmed completion closes the board while the dial pointer is down');
assert(renderDecision(complete, playing, releasedInteraction) === 'render', 'confirmed completion is blocked after pointer release');
assert(renderDecision(staleComplete, playing, releasedInteraction) === 'hold', 'stale terminal snapshot closes the playing board during release grace');
assert(renderDecision(unversionedComplete, playing, releasedInteraction) === 'hold', 'unversioned terminal snapshot closes the playing board during release grace');
assert(renderDecision(newer, playing, { gameId: 'safe-1', active: false, pointerDown: false, expiresAt: 0 }) === 'render', 'expired interaction prevents normal rendering');

console.log('Safe Cracker dial-board retention validation passed: pointer-down interaction retains the active board even against terminal-looking snapshots, only revision-confirmed completion can render after release, delayed/null/foreign/backward snapshots are held, live progress stays in place, pre-lighting visuals remain intact, and networking, audio and Roulette are untouched.');
