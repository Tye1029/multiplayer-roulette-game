import { readFile, writeFile } from 'node:fs/promises';

const dataUrl = new URL('../netlify/functions/_data.js', import.meta.url);
const actionUrl = new URL('../netlify/functions/duel-action.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const deploymentMarker = '<!-- MOUNTAIN_RACE_REMOTE_BOT_ATTACH_V2 -->';

const threeGameAllowlist = 'if (!["roulette", "draw", "fishing"].includes(String(game.mode || ""))) throw new Error("Remote Network Bot supports Roulette, Draw, and Fishing.");';
const fourGameAllowlist = 'if (!["roulette", "draw", "fishing", "safecracker"].includes(String(game.mode || ""))) throw new Error("Remote Network Bot supports Roulette, Draw, Fishing, and Safe Cracker.");';
const fiveGameAllowlist = 'if (!["roulette", "draw", "fishing", "safecracker", "mountainrace"].includes(String(game.mode || ""))) throw new Error("Remote Network Bot supports Roulette, Draw, Fishing, Safe Cracker, and Summit Sprint.");';

function occurrences(source, fragment) {
  return source.split(fragment).length - 1;
}

function replaceAll(source, search, replacement) {
  return source.includes(search) ? source.split(search).join(replacement) : source;
}

let [data, action, html] = await Promise.all([
  readFile(dataUrl, 'utf8'),
  readFile(actionUrl, 'utf8'),
  readFile(indexUrl, 'utf8')
]);

// Two server paths can attach a Remote Network Bot: the direct waiting-game
// helper and the atomic create/recover-and-attach helper used by the testing
// dock. Both must accept Summit Sprint. The older patch updated only the first
// matching allowlist, leaving the atomic path unable to join mountain races.
data = replaceAll(data, threeGameAllowlist, fiveGameAllowlist);
data = replaceAll(data, fourGameAllowlist, fiveGameAllowlist);

// Keep every Remote Bot reset path aligned with the complete supported-state
// set. This covers both the direct and atomic attachment helpers.
data = data.replace(
  /blackjackState:null,drawState:null,fishingState:null,rouletteState:null,(?:safecrackerState:null,)?(?:mountainraceState:null,)?/g,
  'blackjackState:null,drawState:null,fishingState:null,rouletteState:null,safecrackerState:null,mountainraceState:null,'
);

// Preserve Remote Bot identity through the shared player sanitizer. The id
// prefix remains a fallback, but the explicit flag is now also available to
// the public game snapshot and rematch logic.
const oldNpcDetection = '  const isNpc = Boolean(player.isNpc) || userId.startsWith("npc-");';
const newNpcDetection = '  const isRemoteBot = Boolean(player.isRemoteBot) || userId.startsWith("remote-bot-");\n  const isNpc = Boolean(player.isNpc) || userId.startsWith("npc-") || isRemoteBot;';
if (!data.includes(newNpcDetection)) {
  if (!data.includes(oldNpcDetection)) throw new Error('Summit Sprint Remote Bot patch could not find player NPC detection.');
  data = data.replace(oldNpcDetection, newNpcDetection);
}

const oldPlayerFlags = '    isNpc,\n    isTestPlayer: Boolean(player.isTestPlayer),';
const newPlayerFlags = '    isNpc,\n    isRemoteBot,\n    isTestPlayer: Boolean(player.isTestPlayer),';
if (!data.includes(newPlayerFlags)) {
  if (!data.includes(oldPlayerFlags)) throw new Error('Summit Sprint Remote Bot patch could not find public player flags.');
  data = data.replace(oldPlayerFlags, newPlayerFlags);
}

// duelSaveGame sanitizes before persistence. Preserve the selected network
// profile so Summit Sprint keeps its configured latency, stalls, retries, and
// reconnect behavior after the bot is attached and after later strong reads.
const oldGameNetworkFields = '    npcTest: Boolean(game.npcTest),\n    testPlayerMode: Boolean(game.testPlayerMode),';
const newGameNetworkFields = `    npcTest: Boolean(game.npcTest),
    remoteNetworkTest: Boolean(game.remoteNetworkTest),
    remoteNetworkProfile: ["normal", "mobile", "bad", "stress"].includes(String(game.remoteNetworkProfile || "")) ? String(game.remoteNetworkProfile) : "",
    remoteNetworkConfig: game.remoteNetworkConfig && typeof game.remoteNetworkConfig === "object" ? {
      label: String(game.remoteNetworkConfig.label || "").slice(0, 40),
      minDelayMs: Math.max(100, int(game.remoteNetworkConfig.minDelayMs, 100)),
      maxDelayMs: Math.max(Math.max(100, int(game.remoteNetworkConfig.minDelayMs, 100)), int(game.remoteNetworkConfig.maxDelayMs, 400)),
      stallChance: Math.max(0, Math.min(1, Number(game.remoteNetworkConfig.stallChance) || 0)),
      duplicateChance: Math.max(0, Math.min(1, Number(game.remoteNetworkConfig.duplicateChance) || 0)),
      reconnectChance: Math.max(0, Math.min(1, Number(game.remoteNetworkConfig.reconnectChance) || 0))
    } : null,
    testPlayerMode: Boolean(game.testPlayerMode),`;
if (!data.includes(newGameNetworkFields)) {
  if (!data.includes(oldGameNetworkFields)) throw new Error('Summit Sprint Remote Bot patch could not find duel network fields.');
  data = data.replace(oldGameNetworkFields, newGameNetworkFields);
}

const atomicStart = data.indexOf('async function duelCreateRemoteNetworkBotGame(user, details = {})');
const atomicEnd = data.indexOf('async function duelActionGame(user, gameId, details = {})', atomicStart);
if (atomicStart < 0 || atomicEnd <= atomicStart) throw new Error('Summit Sprint Remote Bot patch could not isolate the atomic attachment helper.');
const atomicSection = data.slice(atomicStart, atomicEnd);

if (data.includes(threeGameAllowlist) || data.includes(fourGameAllowlist)) {
  throw new Error('A legacy Remote Bot allowlist still blocks Summit Sprint.');
}
if (occurrences(data, fiveGameAllowlist) < 2) {
  throw new Error('Both direct and atomic Remote Bot attachment paths must support Summit Sprint.');
}
if (!atomicSection.includes(fiveGameAllowlist)) {
  throw new Error('The atomic Remote Bot attachment path still rejects Summit Sprint.');
}
if (!atomicSection.includes('mountainraceState:null')) {
  throw new Error('The atomic Remote Bot attachment path does not reset Summit Sprint state.');
}
if (!data.includes('remoteNetworkTest: Boolean(game.remoteNetworkTest)') || !data.includes('remoteNetworkConfig: game.remoteNetworkConfig')) {
  throw new Error('Remote Bot network settings are not preserved by duel sanitization.');
}
if (!action.includes('duelCreateRemoteNetworkBotGame') || !action.includes('action === "create-remote-bot"')) {
  throw new Error('The Netlify action endpoint is missing the atomic Remote Bot handler.');
}
if (!html.includes("duelRequest('create-remote-bot'") || !html.includes('data-rnb-game="mountainrace"')) {
  throw new Error('The Remote Bot dock is not wired to the Summit Sprint atomic attachment path.');
}

if (!html.includes(deploymentMarker)) {
  if (!html.includes('</body>')) throw new Error('Summit Sprint Remote Bot patch could not mark the deployed page.');
  html = html.replace('</body>', `${deploymentMarker}\n</body>`);
}

await Promise.all([
  writeFile(dataUrl, data),
  writeFile(indexUrl, html)
]);
console.log('Fixed Summit Sprint Remote Bot joining: both direct and atomic attachment paths accept mountain races, preserve bot identity/network settings, and reset mountain state safely.');
