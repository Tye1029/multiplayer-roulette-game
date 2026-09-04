import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = async path => (await readFile(new URL(path, root), 'utf8')).replace(/\r\n/g, '\n');
const release = JSON.parse(await read('assets/safe-cracker/restored-release.json'));
// Pin the complete generated release, including every referenced dial/audio asset.
// The old base JS/CSS can parse successfully while omitting all later features.
for (const [path, expected] of Object.entries(release.sha256)) {
  const content = path.endsWith('.png') ? await readFile(new URL(path, root)) : await read(path);
  const actual = createHash('sha256').update(content).digest('hex');
  assert.equal(actual, expected, `Restored Safe Cracker release changed: ${path}`);
}
const html = await read('index.html');
for (const extension of ['js', 'css']) {
  const url = html.match(new RegExp(`/assets/safe-cracker/safe-cracker\\.${extension}\\?[^"'\\s>]+`))?.[0];
  assert.ok(url?.includes(`&restore=${release.release}`), `Missing ${extension} restoration cache key`);
}
const client = await read('assets/safe-cracker/safe-cracker.js');
const styles = await read('assets/safe-cracker/safe-cracker.css');
for (const match of (client + styles).matchAll(/\/assets\/safe-cracker\/[^'"\s?<>\\)]+/g)) {
  assert.ok(release.sha256[match[0].slice(1)], `Unverified Safe Cracker dependency: ${match[0]}`);
}
for (const marker of ['SAFE_CRACKER_RENDER_STABILITY_V1_START', 'SAFE_CRACKER_ORIGINAL_PCM_V27_START', 'SAFE_CRACKER_INPUT_CONTINUITY_V9_START']) {
  assert.equal(client.split(marker).length - 1, 1, `Missing or duplicate ${marker}`);
}
const data = await read('netlify/functions/_data.js');
for (const fragment of [
  '// SAFE_CRACKER_FEEDBACK_LATENCY_V1_START',
  'const SAFE_CRACKER_VERIFY_MS = 650;',
  'if (!needsMutation) return observed;',
  'const beforeSave = await duelGetRawStrong(gameId, 1) || await duelGetRaw(gameId);',
  'return await safeCrackerComplete(candidate, state, id,',
  "if (game.status === 'complete') response.record = await getUserRecord(viewer);"
]) assert.ok(data.includes(fragment), `Missing authoritative Safe Cracker guard: ${fragment}`);

// These existing validators describe the final presentation and remain read-only.
for (const check of [
  'visual-shell', 'visual-dial', 'visual-hud', 'visual-sequence', 'visual-stability',
  'mobile-fit', 'viewport-fit', 'result-flow', 'final-polish', 'visual-refinement',
  'dial-layout', 'dial-layout-final', 'latch-sequence', 'latch-refinement',
  'screw-refinement', 'control-trim', 'active-render-guard', 'dial-board-retention',
  'dial-sample-v18', 'sample-mix'
]) await import(`./validate-safe-cracker-${check}.mjs`);
await import('./validate-safe-cracker-feedback-endpoint.mjs');
await import('./validate-safe-cracker-game-layout.mjs');
await import('./validate-safe-cracker-rapid-input.mjs');
await import('./validate-safe-cracker-completion-storage.mjs');
console.log(`Verified complete Safe Cracker restored release ${release.release}: ${Object.keys(release.sha256).length} files.`);
