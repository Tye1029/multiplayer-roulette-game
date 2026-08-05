import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const stateSyncValidatorUrl = new URL('scripts/validate-mountain-race-state-sync.mjs', root);

let stateSource = await readFile(stateSyncValidatorUrl, 'utf8');
stateSource = stateSource
  .replaceAll('mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=7', 'mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=8')
  .replaceAll('&sync=8&sync=8', '&sync=8');
await writeFile(stateSyncValidatorUrl, stateSource);

await import('./validate-mountain-race-input-rebase-v8.mjs');

console.log('Updated Summit Sprint validator cache expectations for Input Rebase V8.');
