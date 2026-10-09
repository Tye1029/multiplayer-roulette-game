import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const stateSyncValidatorUrl = new URL('scripts/validate-mountain-race-state-sync.mjs', root);
const gameplayValidatorUrl = new URL('scripts/validate-mountain-race-gameplay-visibility.mjs', root);

let stateSource = await readFile(stateSyncValidatorUrl, 'utf8');
stateSource = stateSource
  .replaceAll('mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=7', 'mountain-race-multiplayer.js?v=1&gameplay=3&load=2&sync=8')
  .replaceAll('&sync=8&sync=8', '&sync=8')
  .replaceAll(
    'me: mergePlayerProgress(previousState.me, incomingState.me)',
    'me: mergePlayerProgress(previousState.me, incomingState.me, { allowBackward: ownSlip })'
  )
  .replaceAll(
    'opponent: mergePlayerProgress(previousState.opponent, incomingState.opponent)',
    'opponent: mergePlayerProgress(previousState.opponent, incomingState.opponent, { allowBackward: opponentSlip })'
  );
await writeFile(stateSyncValidatorUrl, stateSource);

let gameplaySource = await readFile(gameplayValidatorUrl, 'utf8');
gameplaySource = gameplaySource.replaceAll(
  'mergePlayerProgress(previousState.opponent, incomingState.opponent)',
  'mergePlayerProgress(previousState.opponent, incomingState.opponent, { allowBackward: opponentSlip })'
);
await writeFile(gameplayValidatorUrl, gameplaySource);

await import('./validate-mountain-race-input-rebase-v8.mjs');

console.log('Updated Summit Sprint validators for the V8 cache boundary and slip-aware local/opponent merges.');
