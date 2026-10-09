import { readFile, writeFile } from 'node:fs/promises';

const validatorUrl = new URL('validate-mountain-race-multiplayer.mjs', import.meta.url);
let source = await readFile(validatorUrl, 'utf8');

source = source
  .replace("  \"ignoreReason: 'duplicate'\",", "  'replayedAction: true',")
  .replace(
    "assert(response.ignoredAction === true && response.ignoreReason === 'duplicate', 'duplicate action was not identified');",
    "assert(response.replayedAction === true, 'duplicate action was not returned as the already-confirmed move');"
  )
  .replace(
    'stale and duplicate protection, full Remote Network Bot catch-up and completion',
    'stale-prompt protection, replay-safe action ids, full Remote Network Bot pacing and completion'
  );

if (!source.includes("'replayedAction: true'")) throw new Error('Summit Sprint validator still expects duplicate actions to be rejected.');
if (!source.includes('response.replayedAction === true')) throw new Error('Summit Sprint duplicate replay assertion was not updated.');
await writeFile(validatorUrl, source);
console.log('Updated Summit Sprint validation so an already-confirmed action id returns the persisted move instead of appearing as another ignored tap.');
