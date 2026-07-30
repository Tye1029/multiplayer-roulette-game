import { readFile } from 'node:fs/promises';

const data = await readFile(new URL('../netlify/functions/_data.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const injector = await readFile(new URL('./inject-lamp-assets.mjs', import.meta.url), 'utf8');
const compatibilityPatch = await readFile(new URL('./patch-remote-bot-attach-retry.mjs', import.meta.url), 'utf8');

for (const required of [
  'async function duelGetRaw(gameId, options = {})',
  'if (options?.consistency === "strong") readOptions.consistency = "strong";',
  'function duelGetStrongStore()',
  'const options = { name: STORE_NAME, consistency: "strong" };',
  'async function duelGetRawStrong(gameId, attempts = 4)',
  'const store = duelGetStrongStore();',
  'async function duelJoinGame(user, gameId) {\n  await duelEnsureSchemaMigration();\n  let game = await duelGetRawStrong(gameId);',
  'async function duelAddSimpleNpc(user, gameId) {\n  const viewer = cleanUserId(user.id);\n  let game = await duelGetRawStrong(gameId);',
  'async function duelAddRemoteNetworkBot(user, gameId, profile = "normal") {\n  const viewer = cleanUserId(user.id);\n  let game = await duelGetRawStrong(gameId);',
  'const existingRemoteBot = String(game.joiner?.userId || "").startsWith("remote-bot-");',
  'recoveredExistingBot:true',
  'async function duelCreateRemoteNetworkBotGame(user, details = {})',
  'duelGetRawStrong(clientGameId, 1)',
  'atomicCreateAndAttach: true'
]) {
  if (!data.includes(required)) throw new Error(`Strong duel-read validation is missing ${required}`);
}

for (const required of [
  'async function rnbAttachBotAtomically(gameId,profile)',
  "duelRequest('create-remote-bot'",
  'const data=await rnbAttachBotAtomically(gameId,profile);',
  'const adopted=rnbAdoptGame(data.game,true)'
]) {
  if (!html.includes(required)) throw new Error(`Atomic Remote Bot validation is missing ${required}`);
}

for (const required of [
  "await import('./patch-duel-strong-join-reads.mjs');",
  "await import('./patch-remote-bot-attach-retry.mjs');"
]) {
  if (!injector.includes(required)) throw new Error(`Strong join build is missing ${required}`);
}

if (!compatibilityPatch.includes("await import('./patch-duel-atomic-bot-and-action-polling.mjs');")) {
  throw new Error('Atomic Remote Bot patch is not chained after the compatibility pass.');
}

console.log('Strong duel-read validation passed: store-level strong exact reads remain available, while Remote Bot attachment now creates or recovers and attaches atomically in one request.');
