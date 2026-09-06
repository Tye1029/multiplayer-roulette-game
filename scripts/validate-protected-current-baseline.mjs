import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root));
const text = async path => (await read(path)).toString('utf8');
const gitBlobHash = buffer => createHash('sha1')
  .update(`blob ${buffer.length}\0`)
  .update(buffer)
  .digest('hex');

const html = await text('index.html');
const data = await text('netlify/functions/_data.js');
const action = await text('netlify/functions/duel-action.js');
const safeCracker = await text('assets/safe-cracker/safe-cracker.js');

for (const required of [
  '/assets/safe-cracker/safe-cracker.css',
  '/assets/safe-cracker/safe-cracker.js',
  '/assets/roulette/turn-animation.js?v=5',
  '/assets/roulette/turn-fire.js?v=2',
  '/assets/roulette/opening-spin-sync.js?v=6&trim=1&clamp=1',
  '// MULTIPLAYER_COHESION_V6'
]) if (!html.includes(required)) throw new Error(`Protected runtime page is missing ${required}`);

for (const required of [
  'safecrackerState',
  'rouletteState',
  'duelCreateRemoteNetworkBotGame',
  'duelGetRawStrong',
  'mountainRaceIntegration'
]) if (!data.includes(required)) throw new Error(`Protected multiplayer server is missing ${required}`);

for (const required of [
  'action === "create-remote-bot"',
  'action === "act"',
  'duelActionGame'
]) if (!action.includes(required)) throw new Error(`Protected multiplayer action handler is missing ${required}`);

for (const required of [
  'actionId',
  'safecrackerState',
  'data-safe-cracker-mount'
]) if (!safeCracker.includes(required)) throw new Error(`Safe Cracker runtime is missing ${required}`);

const protectedHashes = new Map([
  ['assets/roulette/turn-animation.js', new Set(['24358e84c147d99e7297089e69ed1abd0802379f', '6e3c3e20d5b30b1bdecb95959a0f28a88d43232d'])],
  ['assets/roulette/turn-fire.js', new Set(['940e824eae39ddc40dda6200f893f97fc365949b', '7ed8f3c480620ba21ae7d60f6bc6e3d5f45951ee'])]
]);
for (const [path, expected] of protectedHashes) {
  const actual = gitBlobHash(await read(path));
  if (!expected.has(actual)) throw new Error(`Protected file changed unexpectedly: ${path} (${actual})`);
}

await import('./validate-safe-cracker-restored-release.mjs');
await import('./validate-site-asset-loading.mjs');
await import('./validate-idle-debug-rendering.mjs');
console.log('Protected Roulette, Safe Cracker, and shared multiplayer current baseline validated.');
