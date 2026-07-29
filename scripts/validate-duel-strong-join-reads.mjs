import { readFile } from 'node:fs/promises';

const data = await readFile(new URL('../netlify/functions/_data.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const injector = await readFile(new URL('./inject-lamp-assets.mjs', import.meta.url), 'utf8');

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
  'recoveredExistingBot:true'
]) {
  if (!data.includes(required)) throw new Error(`Strong duel-read validation is missing ${required}`);
}

for (const required of [
  'async function rnbAttachBotWithRetry(gameId,profile)',
  'const delays=[0,900,1500,2200,3000,3500];',
  "line(botLogs,'attach retry scheduled'",
  'const data=await rnbAttachBotWithRetry(gameId,profile);',
  'const adopted=rnbAdoptGame(data.game,true)'
]) {
  if (!html.includes(required)) throw new Error(`One-click Remote Bot validation is missing ${required}`);
}

for (const required of [
  "await import('./patch-duel-strong-join-reads.mjs');",
  "await import('./patch-remote-bot-attach-retry.mjs');"
]) {
  if (!injector.includes(required)) throw new Error(`Strong join build is missing ${required}`);
}

console.log('Strong duel-read validation passed: store-level strong exact reads, bounded retries, authoritative snapshot adoption, and one-click Remote Bot recovery are present.');