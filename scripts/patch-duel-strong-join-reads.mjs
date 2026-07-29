import { readFile, writeFile } from 'node:fs/promises';

const dataUrl = new URL('../netlify/functions/_data.js', import.meta.url);
let data = await readFile(dataUrl, 'utf8');

function replaceOnce(source, label, before, after) {
  if (source.includes(after)) return source;
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Strong duel-read patch could not find ${label}.`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Strong duel-read patch found more than one ${label}.`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

data = replaceOnce(
  data,
  'the exact duel reader',
  `async function duelGetRaw(gameId) {
  const id = mpCleanId(gameId);
  if (!id) return null;
  try {
    const raw = await getUsersStore().get(duelGameKey(id), { type: "json" });
    return raw ? duelSanitizeGame(raw) : null;
  } catch {
    return null;
  }
}
`,
  `async function duelGetRaw(gameId, options = {}) {
  const id = mpCleanId(gameId);
  if (!id) return null;
  try {
    const readOptions = { type: "json" };
    if (options?.consistency === "strong") readOptions.consistency = "strong";
    const raw = await getUsersStore().get(duelGameKey(id), readOptions);
    return raw ? duelSanitizeGame(raw) : null;
  } catch {
    return null;
  }
}

async function duelGetRawStrong(gameId, attempts = 3) {
  const total = Math.max(1, Math.min(4, int(attempts, 3)));
  for (let attempt = 0; attempt < total; attempt++) {
    const game = await duelGetRaw(gameId, { consistency: "strong" });
    if (game) return game;
    if (attempt + 1 < total) await sleep(120 * (attempt + 1));
  }
  return null;
}
`
);

data = replaceOnce(
  data,
  'the real-player join lookup',
  `async function duelJoinGame(user, gameId) {
  await duelEnsureSchemaMigration();
  let game = await duelGetRaw(gameId);`,
  `async function duelJoinGame(user, gameId) {
  await duelEnsureSchemaMigration();
  let game = await duelGetRawStrong(gameId);`
);

data = replaceOnce(
  data,
  'the simple NPC lookup',
  `async function duelAddSimpleNpc(user, gameId) {
  const viewer = cleanUserId(user.id);
  let game = await duelGetRaw(gameId);`,
  `async function duelAddSimpleNpc(user, gameId) {
  const viewer = cleanUserId(user.id);
  let game = await duelGetRawStrong(gameId);`
);

data = replaceOnce(
  data,
  'the Remote Bot lookup',
  `async function duelAddRemoteNetworkBot(user, gameId, profile = "normal") {
  const viewer = cleanUserId(user.id);
  let game = await duelGetRaw(gameId);`,
  `async function duelAddRemoteNetworkBot(user, gameId, profile = "normal") {
  const viewer = cleanUserId(user.id);
  let game = await duelGetRawStrong(gameId);`
);

data = replaceOnce(
  data,
  'the Remote Bot retry behavior',
  `  if (!["roulette", "draw", "fishing"].includes(String(game.mode || ""))) throw new Error("Remote Network Bot supports Roulette, Draw, and Fishing.");
  if (game.status !== "waiting" || game.joiner) throw new Error("The Remote Network Bot can only join a waiting duel.");
  const profiles = {
    normal:{label:"Normal",minDelayMs:100,maxDelayMs:400,stallChance:0,duplicateChance:0,reconnectChance:0},
    mobile:{label:"Mobile",minDelayMs:300,maxDelayMs:1500,stallChance:.08,duplicateChance:.02,reconnectChance:.04},
    bad:{label:"Bad Connection",minDelayMs:500,maxDelayMs:3000,stallChance:.18,duplicateChance:.08,reconnectChance:.12},
    stress:{label:"Stress Test",minDelayMs:100,maxDelayMs:3500,stallChance:.25,duplicateChance:.18,reconnectChance:.18}
  };
  const key = Object.prototype.hasOwnProperty.call(profiles, String(profile)) ? String(profile) : "normal";
  const network = profiles[key];
  const botId = `remote-bot-${game.mode}-${crypto.randomBytes(4).toString("hex")}`;`,
  `  if (!["roulette", "draw", "fishing"].includes(String(game.mode || ""))) throw new Error("Remote Network Bot supports Roulette, Draw, and Fishing.");
  const profiles = {
    normal:{label:"Normal",minDelayMs:100,maxDelayMs:400,stallChance:0,duplicateChance:0,reconnectChance:0},
    mobile:{label:"Mobile",minDelayMs:300,maxDelayMs:1500,stallChance:.08,duplicateChance:.02,reconnectChance:.04},
    bad:{label:"Bad Connection",minDelayMs:500,maxDelayMs:3000,stallChance:.18,duplicateChance:.08,reconnectChance:.12},
    stress:{label:"Stress Test",minDelayMs:100,maxDelayMs:3500,stallChance:.25,duplicateChance:.18,reconnectChance:.18}
  };
  const key = Object.prototype.hasOwnProperty.call(profiles, String(profile)) ? String(profile) : "normal";
  const network = profiles[key];
  const existingRemoteBot = String(game.joiner?.userId || "").startsWith("remote-bot-");
  if (existingRemoteBot && game.npcTest) {
    return {game:duelPublicGame(game,viewer),record:await getUserRecord(viewer),remoteNetworkProfile:key,remoteNetworkConfig:network,recoveredExistingBot:true};
  }
  if (game.status !== "waiting" || game.joiner) throw new Error("The Remote Network Bot can only join a waiting duel.");
  const botId = `remote-bot-${game.mode}-${crypto.randomBytes(4).toString("hex")}`;`
);

for (const required of [
  'async function duelGetRawStrong(gameId, attempts = 3)',
  'duelGetRaw(gameId, { consistency: "strong" })',
  'let game = await duelGetRawStrong(gameId);',
  'const existingRemoteBot = String(game.joiner?.userId || "").startsWith("remote-bot-");',
  'recoveredExistingBot:true'
]) {
  if (!data.includes(required)) throw new Error(`Strong duel-read patch is missing ${required}`);
}

await writeFile(dataUrl, data);
console.log('Patched new-duel joins: exact game reads use strong consistency with bounded retries, and Remote Bot attachment is retry-safe.');
