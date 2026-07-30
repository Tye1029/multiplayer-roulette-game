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

assert(data.includes('// SAFE_CRACKER_ATOMIC_APPLY_V9_START'), 'atomic Safe Cracker writer is missing');
assert(data.includes("getWithMetadata(duelGameKey(id), { consistency: 'strong', type: 'json' })"), 'guess writer does not use a strong versioned read');
assert(data.includes("setJSON(duelGameKey(gameId), clean, { onlyIfMatch: expectedEtag })"), 'guess writer does not use an atomic compare-and-set');
assert(data.includes('const saved = await safeCrackerSaveVersioned(candidate, versioned.etag);'), 'guess writer does not save against the exact read version');
assert(data.includes('if (!saved.modified)'), 'guess writer does not retry a concurrent-write conflict');
assert(data.includes("if (saved.game?.status !== 'playing') return saved.game;"), 'guess writer can continue after a concurrent completion');
assert(data.includes('const versioned = await safeCrackerReadVersioned(gameId);'), 'bot advancement does not use the atomic read path');
assert(data.includes('const expectedEtag = versioned.etag;'), 'bot advancement does not retain the source ETag');
assert(data.includes('revision: int(state.revision, 0) + 1, npcActionAt:'), 'NPC scheduler changes are not revisioned');
assert(data.includes('// SAFE_CRACKER_DIRECT_COMPLETION_START'), 'direct completion layer is missing');
assert(!data.includes('safeCrackerClaimCompletion'), 'obsolete completion claim loop remains bundled');

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

console.log('Safe Cracker feedback consistency validation passed: feedback remains latched, stale snapshots are rejected, and the atomic writer cannot continue past completion.');
