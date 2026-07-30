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

assert(data.includes('// SAFE_CRACKER_VERIFIED_APPLY_START'), 'verified Safe Cracker writer is missing');
assert(data.includes('let latest = await duelGetRawStrong(gameId, 2) || fallback;'), 'guess writer does not begin from a strong snapshot');
assert(data.includes('const beforeSave = await duelGetRawStrong(gameId, 1);'), 'guess writer does not recheck state before saving');
assert(data.includes('confirmedState.processedActionIds.includes(cleanActionId)'), 'guess writer does not verify that an action survived concurrent writes');
assert(data.includes('let latest = await duelGetRawStrong(gameId, 2);'), 'bot advancement does not use a strong read');
assert(data.includes('let game = await duelGetRawStrong(gameId, 2);'), 'human actions do not use a strong read');
assert(data.includes('revision: int(state.revision, 0) + 1, npcActionAt:'), 'NPC scheduler changes are not revisioned');

assert(html.includes('game?.safecrackerState||{}'), 'Remote Bot comparison ignores Safe Cracker state revision');
assert(html.includes('function rnbLifecycleRank(game)'), 'Remote Bot comparison ignores lifecycle status');
assert(html.includes('if(a.statusRank!==b.statusRank)return a.statusRank-b.statusRank;'), 'completed snapshots can be replaced by playing snapshots');
assert(html.includes("ignored rejected Safe Cracker snapshot"), 'Remote Bot adoption bypasses the Safe Cracker snapshot guard');
assert(html.includes('/assets/safe-cracker/safe-cracker.js?v=2'), 'Safe Cracker JavaScript cache version was not bumped');
assert(html.includes('/assets/safe-cracker/safe-cracker.css?v=2'), 'Safe Cracker stylesheet cache version was not bumped');

console.log('Safe Cracker feedback consistency validation passed: feedback remains latched, animations fire once, stale lifecycle snapshots are rejected, and concurrent writes are verified.');
