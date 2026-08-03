import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const deploymentMarker = '<!-- MOUNTAIN_RACE_REMOTE_BOT_ATTACH_V2 -->';
const [data, action, html, patch] = await Promise.all([
  readFile(new URL('netlify/functions/_data.js', root), 'utf8'),
  readFile(new URL('netlify/functions/duel-action.js', root), 'utf8'),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/patch-mountain-race-remote-bot-attach.mjs', root), 'utf8')
]);

const threeGameAllowlist = 'if (!["roulette", "draw", "fishing"].includes(String(game.mode || ""))) throw new Error("Remote Network Bot supports Roulette, Draw, and Fishing.");';
const fourGameAllowlist = 'if (!["roulette", "draw", "fishing", "safecracker"].includes(String(game.mode || ""))) throw new Error("Remote Network Bot supports Roulette, Draw, Fishing, and Safe Cracker.");';
const fiveGameAllowlist = 'if (!["roulette", "draw", "fishing", "safecracker", "mountainrace"].includes(String(game.mode || ""))) throw new Error("Remote Network Bot supports Roulette, Draw, Fishing, Safe Cracker, and Summit Sprint.");';

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint Remote Bot validation failed: ${message}`);
}

function occurrences(source, fragment) {
  return source.split(fragment).length - 1;
}

const directStart = data.indexOf('async function duelAddRemoteNetworkBot(user, gameId, profile = "normal")');
const atomicStart = data.indexOf('async function duelCreateRemoteNetworkBotGame(user, details = {})');
const actionStart = data.indexOf('async function duelActionGame(user, gameId, details = {})', atomicStart);
assert(directStart >= 0, 'direct attachment helper is missing');
assert(atomicStart >= 0 && actionStart > atomicStart, 'atomic attachment helper is missing');

const directSection = data.slice(directStart, atomicStart);
const atomicSection = data.slice(atomicStart, actionStart);
const compactAtomic = atomicSection.replace(/\s+/g, '');

assert(!data.includes(threeGameAllowlist), 'legacy three-game allowlist remains');
assert(!data.includes(fourGameAllowlist), 'legacy four-game allowlist remains');
assert(occurrences(data, fiveGameAllowlist) >= 2, 'both attachment helpers do not share the Summit Sprint allowlist');
assert(directSection.includes(fiveGameAllowlist), 'direct attachment rejects Summit Sprint');
assert(atomicSection.includes(fiveGameAllowlist), 'testing-dock atomic attachment rejects Summit Sprint');
assert(compactAtomic.includes('mountainraceState:null'), 'atomic attachment does not reset Summit Sprint state');
assert(compactAtomic.includes('remoteNetworkTest:true'), 'atomic attachment does not mark the Remote Bot game');
assert(compactAtomic.includes('joiner:bot'), 'atomic attachment does not install the bot as joiner');
assert(compactAtomic.includes('ready:{[game.creator.userId]:false,[bot.userId]:false}'), 'atomic attachment does not create both Ready flags');

assert(data.includes('const isRemoteBot = Boolean(player.isRemoteBot) || userId.startsWith("remote-bot-");'), 'player sanitizer loses Remote Bot identity');
assert(data.includes('    isRemoteBot,'), 'public player snapshot omits Remote Bot identity');
assert(data.includes('remoteNetworkTest: Boolean(game.remoteNetworkTest)'), 'duel sanitizer loses Remote Bot test state');
assert(data.includes('remoteNetworkProfile: ["normal", "mobile", "bad", "stress"]'), 'duel sanitizer loses the selected network profile');
assert(data.includes('remoteNetworkConfig: game.remoteNetworkConfig'), 'duel sanitizer loses network timing settings');

assert(action.includes('duelCreateRemoteNetworkBotGame,'), 'Netlify function does not import the atomic attachment helper');
assert(action.includes('action === "create-remote-bot"'), 'Netlify function does not route the atomic attachment request');
assert(html.includes('async function rnbAttachBotAtomically(gameId,profile)'), 'testing dock lacks its atomic attachment helper');
assert(html.includes("duelRequest('create-remote-bot'"), 'testing dock does not call the atomic attachment endpoint');
assert(html.includes('data-rnb-game="mountainrace"'), 'testing dock lacks the Summit Sprint selector');
assert(html.includes("const mode=String(current?.mode||selectedMode||'roulette')"), 'testing dock does not send the selected Summit Sprint mode');
assert(html.includes(deploymentMarker), 'deployed page lacks the Summit Sprint Remote Bot fix marker');

assert(patch.includes('replaceAll(data, fourGameAllowlist, fiveGameAllowlist)'), 'patch does not sweep every stale four-game allowlist');
assert(patch.includes('ensureAtomicStateReset'), 'patch does not repair the atomic Summit Sprint state reset');
assert(patch.includes('Both direct and atomic Remote Bot attachment paths must support Summit Sprint.'), 'patch lacks a two-path attachment guard');
assert(patch.includes('writeFile(indexUrl, html)'), 'patch does not write its deployment marker');

console.log('Summit Sprint Remote Bot attachment validation passed: the dock calls the atomic endpoint, both server attachment paths accept mountainrace, the bot is installed as joiner with Ready flags, network identity/settings survive persistence, and the deployed page carries the fix marker.');
