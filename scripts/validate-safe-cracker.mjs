import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const paths = {
  index: new URL('index.html', root),
  data: new URL('netlify/functions/_data.js', root),
  client: new URL('assets/safe-cracker/safe-cracker.js', root),
  styles: new URL('assets/safe-cracker/safe-cracker.css', root),
  patch: new URL('scripts/patch-safe-cracker.mjs', root),
  turnAnimation: new URL('assets/roulette/turn-animation.js', root),
  turnFire: new URL('assets/roulette/turn-fire.js', root)
};

function assert(condition, message) {
  if (!condition) throw new Error(`Safe Cracker validation failed: ${message}`);
}

function occurrences(source, value) {
  return source.split(value).length - 1;
}

function gitBlobSha(buffer) {
  const header = Buffer.from(`blob ${buffer.length}\0`);
  return createHash('sha1').update(header).update(buffer).digest('hex');
}

const [index, data, client, styles, patch, turnAnimation, turnFire] = await Promise.all([
  readFile(paths.index, 'utf8'),
  readFile(paths.data, 'utf8'),
  readFile(paths.client, 'utf8'),
  readFile(paths.styles, 'utf8'),
  readFile(paths.patch, 'utf8'),
  readFile(paths.turnAnimation),
  readFile(paths.turnFire)
]);

assert(gitBlobSha(turnAnimation) === '24358e84c147d99e7297089e69ed1abd0802379f', 'protected assets/roulette/turn-animation.js changed');
assert(gitBlobSha(turnFire) === '940e824eae39ddc40dda6200f893f97fc365949b', 'protected assets/roulette/turn-fire.js changed');

assert(occurrences(data, '// SAFE_CRACKER_SERVER_START') === 1, 'server patch marker must appear exactly once');
assert(occurrences(index, '<!-- SAFE_CRACKER_ASSETS_START -->') === 1, 'asset marker must appear exactly once');
assert(data.includes('function safeCrackerInitialState'), 'authoritative state generator is missing');
assert(data.includes('function safeCrackerPublicState'), 'public state redaction is missing');
assert(data.includes('async function safeCrackerAction'), 'authoritative dial action is missing');
assert(data.includes('async function safeCrackerAdvanceAndSave'), 'timeout and bot advancement is missing');
assert(data.includes('safecrackerState: game.safecrackerState'), 'Safe Cracker state is not preserved by duel sanitization');
assert(data.includes('return await safeCrackerAction(actorUser, gameId, rawChoice, details);'), 'Safe Cracker actions are not routed');
assert(data.includes('safecrackerState = safeCrackerInitialState(next, startMs)'), 'codes are not initialized from the authoritative countdown');
assert(data.includes('Remote Network Bot supports Roulette, Draw, Fishing, and Safe Cracker.'), 'Remote Network Bot support is missing');
assert(data.includes('["draw","fishing","roulette","blackjack","safecracker"].includes(clean.mode)'), 'Safe Cracker is not isolated from generic NPC completion');
assert(!data.includes('revealedCodes: { my:'), 'active responses must not unconditionally expose combinations');
assert(data.includes("revealedCodes: complete ? { my:"), 'completed matches must provide transparent code reveal');

assert(index.includes('/assets/safe-cracker/safe-cracker.css?v=1'), 'Safe Cracker stylesheet is not injected');
assert(index.includes('/assets/safe-cracker/safe-cracker.js?v=1'), 'Safe Cracker runtime is not injected');
assert(index.includes('data-safe-cracker-mount'), 'Safe Cracker UI mount is missing');
assert(index.includes('window.__safeCrackerBridge'), 'Safe Cracker client bridge is missing');
assert(!index.includes('id="safeGuessInput"'), 'temporary three-digit text input still exists');
assert(!index.includes('Closest safecracker wins.'), 'temporary closest-guess description still exists');

assert(client.includes("choice: `safecracker:guess:${runtime.selected}`"), 'dial submission is not connected to the authoritative action');
assert(client.includes("addEventListener('pointermove'"), 'finger-tracked dial movement is missing');
assert(client.includes('setPointerCapture'), 'dial pointer capture is missing');
assert(client.includes('playDetent'), 'mechanical dial click audio is missing');
assert(client.includes('opponent.lastTier'), 'opponent progress feedback is missing');
assert(client.includes('funnyLosses'), 'rotating funny loss messages are missing');
assert(styles.includes('.sc-dial'), 'dial styling is missing');
assert(styles.includes('touch-action: none'), 'dial must block page scrolling while rotating');
assert(styles.includes('.sc-result-overlay'), 'win/loss presentation is missing');

assert(!patch.includes("writeFile(new URL('../assets/roulette/turn-animation.js'"), 'patch must never write the protected turn animation');
assert(!patch.includes("writeFile(new URL('../assets/roulette/turn-fire.js'"), 'patch must never write the protected firing animation');

console.log('Safe Cracker validation passed: authoritative race, finger dial, feedback, bots, rematches, persistence, and protected Roulette hashes are intact.');
