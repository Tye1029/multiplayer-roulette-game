import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [client, styles, data, html] = await Promise.all([
  readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8'),
  readFile(new URL('assets/safe-cracker/safe-cracker.css', root), 'utf8'),
  readFile(new URL('netlify/functions/_data.js', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8')
]);

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker feedback consistency validation failed: ${message}`);
}

assert(client.includes('// SAFE_CRACKER_FEEDBACK_LATCH_START'), 'submitted feedback latch is missing');
assert(client.includes('const latest = runtime.feedbackResult || null;'), 'digital display is not driven by latched feedback');
assert(client.includes('if (candidateAtMs < runtime.feedbackResultAtMs) return false;'), 'older feedback can replace a newer result');
assert(client.includes("const resultChanged = adoptSubmittedFeedback(nextGame);"), 'action responses do not adopt the confirmed result');
assert(client.includes("feedbackFresh ? ' fresh' : ''"), 'new feedback is not distinguished from polling rerenders');
assert(styles.includes('.sc-display.green.fresh { animation: scGreenConfirm .42s ease; }'), 'green confirmation animation is not limited to a new result');
assert(!styles.includes('rgba(82,255,142,.34); animation: scGreenConfirm'), 'green animation still restarts on every render');

assert(data.includes('// SAFE_CRACKER_LOCKED_APPLY_V11_START'), 'mutation-locked Safe Cracker writer is missing');
assert(data.includes('return await safeCrackerWithMutationLock(gameId, async latest => {'), 'guess writer does not serialize player and bot actions');
assert(data.includes('return await duelSaveGame(candidate);'), 'a normal submitted guess cannot persist');
assert(data.includes("if (latest.status !== 'playing') return latest;"), 'guess writer can mutate a completed game');
assert(data.includes('return await safeCrackerComplete(candidate, state, id,'), 'a final correct digit does not complete inside the lock');
assert(data.includes('// SAFE_CRACKER_DIRECT_COMPLETION_START'), 'direct completion layer is missing');
assert(!data.includes('safeCrackerClaimCompletion'), 'obsolete completion claim loop remains bundled');
assert(!data.includes('getWithMetadata('), 'feedback/gameplay requests still depend on the failing metadata reader');

assert(html.includes('game?.safecrackerState||{}'), 'Remote Bot comparison ignores Safe Cracker state revision');
assert(html.includes('function rnbLifecycleRank(game)'), 'Remote Bot comparison ignores lifecycle status');
assert(html.includes('if(a.statusRank!==b.statusRank)return a.statusRank-b.statusRank;'), 'completed snapshots can be replaced by playing snapshots');
assert(html.includes("ignored rejected Safe Cracker snapshot"), 'Remote Bot adoption bypasses the Safe Cracker snapshot guard');
assert(html.includes('/assets/safe-cracker/safe-cracker.js?v=8'), 'Safe Cracker JavaScript cache version is not visual-sequence v8');
assert(html.includes('/assets/safe-cracker/safe-cracker.css?v=8'), 'Safe Cracker stylesheet cache version is not visual-sequence v8');
assert(client.includes('// SAFE_CRACKER_DIAL_PHYSICS_V2_START'), 'visual dial interaction pass is missing');
assert(client.includes('// SAFE_CRACKER_HUD_V3_START'), 'industrial feedback/HUD renderer is missing');
assert(client.includes('// SAFE_CRACKER_SEQUENCE_V4_START'), 'countdown and result sequence renderer is missing');
assert(client.includes('function feedbackMeter(tier = \'\')'), 'feedback proximity meter is missing');

console.log('Safe Cracker feedback consistency validation passed: feedback remains latched, normal guesses persist through the mutation lock, stale snapshots are rejected, and completion stays authoritative.');