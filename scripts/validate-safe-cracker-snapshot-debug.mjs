import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(`Safe Cracker snapshot/debug validation failed: ${message}`);
};

assert(html.includes('// SAFE_CRACKER_SNAPSHOT_GUARD_START'), 'snapshot guard marker is missing');
assert(html.includes('window.__safeCrackerAcceptSnapshot = safeCrackerAcceptSnapshot;'), 'snapshot guard is not exported for Remote Bot adoption');
assert(html.includes('got.game.mode === "safecracker" && !safeCrackerAcceptSnapshot(got.game)'), 'focused polling does not reject stale Safe Cracker snapshots');
assert(html.includes('candidate?.mode === "safecracker"'), 'lobby fallback does not reject stale Safe Cracker snapshots');
assert(html.includes('const acceptedGame = data.game && safeCrackerAcceptSnapshot(data.game)'), 'action responses bypass Safe Cracker snapshot acceptance');
assert(html.includes('rnbFetchAuthoritativeGameBeforeSafeCrackerGuard'), 'Remote Bot focused fetch wrapper is missing');
assert(html.includes("if(result?.mode==='safecracker'"), 'Remote Bot focused fetch bypasses Safe Cracker snapshot acceptance');
assert(html.includes("if(game.mode==='safecracker'){"), 'shared mutation wrapper does not guard Safe Cracker snapshots');
assert(html.includes("if(g?.mode)selectedMode=String(g.mode);"), 'debug selected mode is not synced to the active game');
assert(html.includes('function rnbDebugState(g)'), 'redacted Safe Cracker debug state builder is missing');
assert(html.includes("revealedCodes:g.status==='complete'?st.revealedCodes:undefined"), 'debug state can expose combinations before completion');
assert(html.includes('rejectedSnapshots:Number(window.__safeCrackerRejectedSnapshots||0)'), 'debug state does not report rejected stale snapshots');
assert(html.includes("safeCrackerCompleted ? 5000"), 'main Safe Cracker completed polling is not backed off');
assert(html.includes("const interval=g.mode==='safecracker'&&!urgent?5000:650;"), 'Remote Bot completed Safe Cracker polling is not backed off');

const match = html.match(/\/\/ SAFE_CRACKER_SNAPSHOT_GUARD_START([\s\S]*?)\/\/ SAFE_CRACKER_SNAPSHOT_GUARD_END/);
assert(match, 'snapshot guard block could not be extracted');
const context = {
  DUEL_STATUS_RANK: { waiting: 0, ready: 1, countdown: 2, playing: 3, complete: 4, cancelled: 4 },
  window: {}
};
vm.createContext(context);
vm.runInContext(match[0], context, { filename: 'safe-cracker-snapshot-guard.js' });
const accept = context.window.__safeCrackerAcceptSnapshot;
assert(typeof accept === 'function', 'snapshot acceptance function did not initialize');

const game = (status, gameRevision, stateRevision) => ({
  gameId: 'safe-test-1',
  mode: 'safecracker',
  status,
  revision: gameRevision,
  safecrackerState: { revision: stateRevision }
});

assert(accept(game('playing', 20, 16)) === true, 'first playing snapshot was rejected');
assert(accept(game('playing', 19, 15)) === false, 'older playing snapshot was accepted');
assert(accept(game('playing', 21, 17)) === true, 'newer playing snapshot was rejected');
assert(accept(game('complete', 22, 18)) === true, 'completion snapshot was rejected');
assert(accept(game('complete', 21, 17)) === false, 'older completed snapshot was accepted');
assert(accept(game('playing', 23, 19)) === false, 'lifecycle rollback from complete to playing was accepted');
assert(Number(context.window.__safeCrackerRejectedSnapshots || 0) === 3, 'rejected snapshot counter is inaccurate');

console.log('Safe Cracker snapshot/debug validation passed: revisions are monotonic, debug state is synced/redacted, and completed polling backs off.');
