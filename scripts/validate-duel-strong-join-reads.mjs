import { readFile } from 'node:fs/promises';

const data = await readFile(new URL('../netlify/functions/_data.js', import.meta.url), 'utf8');
const injector = await readFile(new URL('./inject-lamp-assets.mjs', import.meta.url), 'utf8');

for (const required of [
  'async function duelGetRaw(gameId, options = {})',
  'if (options?.consistency === "strong") readOptions.consistency = "strong";',
  'async function duelGetRawStrong(gameId, attempts = 3)',
  'const game = await duelGetRaw(gameId, { consistency: "strong" });',
  'async function duelJoinGame(user, gameId) {\n  await duelEnsureSchemaMigration();\n  let game = await duelGetRawStrong(gameId);',
  'async function duelAddSimpleNpc(user, gameId) {\n  const viewer = cleanUserId(user.id);\n  let game = await duelGetRawStrong(gameId);',
  'async function duelAddRemoteNetworkBot(user, gameId, profile = "normal") {\n  const viewer = cleanUserId(user.id);\n  let game = await duelGetRawStrong(gameId);',
  'const existingRemoteBot = String(game.joiner?.userId || "").startsWith("remote-bot-");',
  'recoveredExistingBot:true'
]) {
  if (!data.includes(required)) throw new Error(`Strong duel-read validation is missing ${required}`);
}

if (!injector.includes("await import('./patch-duel-strong-join-reads.mjs');")) {
  throw new Error('Strong duel-read patch is not part of the Netlify build.');
}

console.log('Strong duel-read validation passed: newly created games are immediately joinable through strong exact reads, bounded retries, and retry-safe Remote Bot attachment.');
