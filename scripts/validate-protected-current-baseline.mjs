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
  // User-authorized energy update: preserve live flash through room remounts.
  // Keep the opening/facing ownership and pin both LF and CRLF contents.
  ['assets/roulette/turn-animation.js', new Set(['c4af45a224a072a17bcd02b9c99ed03af868a2e5', 'e6064f455e14bde374216c07d6a1fcb57e6de1bd'])],
  ['assets/roulette/turn-fire.js', new Set(['83478f0635f623618b39ebc474179549cd7a95bf', 'd5975ae1703b2a040ef7932779d51dcfba16b309'])]
]);
for (const [path, expected] of protectedHashes) {
  const actual = gitBlobHash(await read(path));
  if (!expected.has(actual)) throw new Error(`Protected file changed unexpectedly: ${path} (${actual})`);
}

await import('./validate-safe-cracker-restored-release.mjs');
await import('./validate-site-asset-loading.mjs');
await import('./validate-roulette-repair.mjs');
await import('./validate-roulette-scene.mjs');
await import('./validate-roulette-motion.mjs');
await import('./validate-roulette-frontier.mjs');
await import('./validate-roulette-energy.mjs');
await import('./validate-duel-native-blobs.mjs');
await import('./validate-idle-debug-rendering.mjs');
console.log('Protected Roulette, Safe Cracker, and shared multiplayer current baseline validated.');
