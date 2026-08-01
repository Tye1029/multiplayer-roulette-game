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
function chooseDuringDial(incoming, retained, interaction) {
  const activeStatuses = ['ready', 'countdown', 'playing'];
  const terminalStatuses = ['complete', 'cancelled'];
  const ranks = { waiting: 0, ready: 1, countdown: 2, playing: 3, complete: 4, cancelled: 4 };
  const live = Boolean(interaction?.gameId && Number(interaction?.expiresAt || 0) >= 1000);
  const retainedActive = retained?.mode === 'safecracker' && activeStatuses.includes(retained.status);
  if (!live || !retainedActive || String(interaction.gameId) !== String(retained.gameId)) return incoming;
  const same = incoming?.mode === 'safecracker' && String(incoming.gameId) === String(retained.gameId);
  const terminal = same && terminalStatuses.includes(String(incoming.status || ''));
  if (terminal) return incoming;
  const missingOrForeign = !incoming || String(incoming?.gameId || '') !== String(retained.gameId);
  const regressed = Boolean(
    same && (
      (ranks[String(incoming.status || '')] ?? -1) < (ranks[String(retained.status || '')] ?? -1) ||
      Number(incoming?.revision) < Number(retained?.revision) ||
      Number(incoming?.state?.revision ?? incoming?.safecrackerState?.revision) < Number(retained?.state?.revision ?? retained?.safecrackerState?.revision)
    )
  );
  return missingOrForeign || regressed ? retained : incoming;
}

const rendererStart = '// SAFE_CRACKER_DIAL_BOARD_RETENTION_V14_START';
const rendererEnd = '// SAFE_CRACKER_DIAL_BOARD_RETENTION_V14_END';
const clientStart = '// SAFE_CRACKER_DIAL_ACTIVITY_V14_START';
const clientEnd = '// SAFE_CRACKER_DIAL_ACTIVITY_V14_END';
assert(occurrences(html, rendererStart) === 1, 'renderer guard start marker must appear once');
assert(occurrences(html, rendererEnd) === 1, 'renderer guard end marker must appear once');
assert(occurrences(client, clientStart) === 1, 'dial activity start marker must appear once');
assert(occurrences(client, clientEnd) === 1, 'dial activity end marker must appear once');
assert(html.includes('function duelRenderActive(game, force = false)'), 'global active renderer is missing');
assert(html.includes('window.__safeCrackerDialStableGameV14'), 'renderer does not retain an independent Safe Cracker snapshot');
assert(html.includes('safeCrackerDialMissingOrForeign || safeCrackerDialRegressed'), 'null, foreign, and regressed renders are not blocked during dial interaction');
assert(html.includes('window.__safeCrackerDialBoardRecoveries'), 'renderer recovery diagnostics are missing');
assert(html.includes("safeCrackerDialTerminalStatuses = ['complete', 'cancelled']"), 'real completion or cancellation cannot clear retention');
assert(client.includes('window.__safeCrackerDialInteractionV14 = {'), 'pointer-down does not start dial interaction retention');
assert(client.includes('expiresAt: Date.now() + 10000'), 'long drag activity is not retained');
assert(client.includes('safeCrackerDialInteraction.expiresAt = Date.now() + 1200'), 'pointer release lacks delayed-render grace');
assert(client.includes('window.__safeCrackerDialInteractionV14.expiresAt = Date.now() + 10000'), 'pointer movement does not extend retention');
assert(client.includes('// SAFE_CRACKER_INPUT_CONTINUITY_V9_START'), 'input continuity v9 is missing');
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
assert(chooseDuringDial(null, playing, interaction) === playing, 'null render closes the board during dial interaction');
assert(chooseDuringDial(foreign, playing, interaction) === playing, 'foreign render replaces the board during dial interaction');
assert(chooseDuringDial(waiting, playing, interaction) === playing, 'backward lifecycle render replaces the live board');
assert(chooseDuringDial(newer, playing, interaction) === newer, 'newer same-game playing snapshot is blocked');
assert(chooseDuringDial(complete, playing, interaction) === complete, 'real completion is blocked');
assert(chooseDuringDial(null, playing, { gameId: 'safe-1', expiresAt: 0 }) === null, 'expired interaction retains the board forever');

console.log('Safe Cracker dial-board retention validation passed: dial interaction survives null, foreign and backward renders, accepts newer state and real completion, preserves the pre-lighting visuals, and leaves networking, audio and Roulette untouched.');
