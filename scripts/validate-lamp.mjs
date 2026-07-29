import { access, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [
  html, injector, turnLock, turnFire, audio, spinPolicy, bindings, config,
  lamp, bootstrap, calibration, lampCss, calibrationHtml, packageSource
] = await Promise.all([
  read('index.html'),
  read('scripts/inject-lamp-assets.mjs'),
  read('assets/roulette/turn-animation.js'),
  read('assets/roulette/turn-fire.js'),
  read('assets/roulette/audio-manager.js'),
  read('assets/roulette/spin-audio-policy.js'),
  read('assets/roulette/audio-bindings.js'),
  read('assets/roulette/lamp-config.js'),
  read('assets/roulette/lamp.js'),
  read('assets/roulette/lamp-bootstrap.js'),
  read('assets/roulette/lamp-calibration.js'),
  read('assets/roulette/lamp.css'),
  read('lamp-calibration.html'),
  read('package.json')
]);

for (const [name, source] of [
  ['turn-animation.js', turnLock],
  ['turn-fire.js', turnFire],
  ['audio-manager.js', audio],
  ['spin-audio-policy.js', spinPolicy],
  ['audio-bindings.js', bindings],
  ['lamp.js', lamp],
  ['lamp-bootstrap.js', bootstrap],
  ['lamp-calibration.js', calibration]
]) new vm.Script(source, { filename: name });

function gitBlobSha(source) {
  const bytes = Buffer.from(source, 'utf8');
  return createHash('sha1')
    .update(Buffer.from(`blob ${bytes.length}\0`, 'utf8'))
    .update(bytes)
    .digest('hex');
}

for (const [name, expected, source] of [
  ['turn-animation.js', '24358e84c147d99e7297089e69ed1abd0802379f', turnLock],
  ['turn-fire.js', '940e824eae39ddc40dda6200f893f97fc365949b', turnFire]
]) {
  const actual = gitBlobSha(source);
  if (actual !== expected) throw new Error(`${name} hash changed: ${actual}`);
}

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(config, sandbox, { filename: 'lamp-config.js' });
if (Object.keys(sandbox.window.RouletteLampConfig?.bindings || {}).length !== 25) {
  throw new Error('The 25 lamp calibration controls are not intact.');
}

const requiredAssets = [
  '/assets/roulette/lamp.css?v=18',
  '/assets/roulette/lamp-config.js?v=19',
  '/assets/roulette/lamp.js?v=20',
  '/assets/roulette/lamp-bootstrap.js?v=19',
  '/assets/roulette/audio-manager.js?v=4',
  '/assets/roulette/spin-audio-policy.js?v=3',
  '/assets/roulette/turn-animation.js?v=5',
  '/assets/roulette/turn-fire.js?v=2',
  '/assets/roulette/audio-bindings.js?v=5',
  'MODULAR_LAMP_ASSETS_START',
  'rrLampCriticalHide'
];
for (const required of requiredAssets) {
  if (!html.includes(required)) throw new Error(`Built page is missing ${required}`);
}

const ordered = [
  '/assets/roulette/audio-manager.js?v=4',
  '/assets/roulette/spin-audio-policy.js?v=3',
  '/assets/roulette/turn-animation.js?v=5',
  '/assets/roulette/turn-fire.js?v=2',
  '/assets/roulette/audio-bindings.js?v=5'
].map(value => injector.indexOf(value));
if (ordered.some(index => index < 0) || ordered.some((index, i) => i && index <= ordered[i - 1])) {
  throw new Error('Roulette audio and protected animation modules are not injected in the required order.');
}

for (const forbidden of [
  'rouletteAnimate(', 'applyFacing(', 'enforceLockedFacing(', 'rotateToLockedTurn(',
  '.rr-turn-facing', '.rr-gun-motion', 'data-roulette-facing', 'data-roulette-recoil',
  'getAnimations', 'style.transform', 'MutationObserver'
]) {
  if (audio.includes(forbidden)) throw new Error(`Audio manager can alter animation state: ${forbidden}`);
  if (spinPolicy.includes(forbidden)) throw new Error(`Audio policy can alter animation state: ${forbidden}`);
  if (bindings.includes(forbidden)) throw new Error(`Audio bindings can alter animation state: ${forbidden}`);
}

for (const required of [
  "room: 'soundsforyou-the-ambience-room-tone-139064.mp3'",
  "hum: 'freesound_community-lamp-electricity-buzzingwav-14609.mp3'",
  "heartbeat: 'pwlpl-heartbeat-tense-377250.mp3'",
  "rumble: 'diff_style-disturbing-low-rumble-183748.mp3'",
  "play('chair'", "play('tap'", "play('tension'",
  'function trackLampSwing()', 'function silenceLegacyRouletteAudio()',
  'global.RouletteAudio = Object.freeze({'
]) if (!audio.includes(required)) throw new Error(`Audio manager is missing ${required}`);

for (const required of [
  'const CHAIN_COOLDOWN = 15000',
  'const CHAIN_STOP_AFTER = 340',
  'function openingSpin(game, state, gameId)',
  'function shotSequence(game, state, gameId)',
  'function syncTurnMovement()',
  "claimAction('turn-move', `${gameId}:${turnId}`, 12000)",
  'volume: 0.052',
  'global.RouletteAudio = Object.freeze({',
  'shotSequence,',
  'turnRotate() { return null; }'
]) if (!spinPolicy.includes(required)) throw new Error(`Audio policy is missing ${required}`);

for (const required of [
  "const TABLE_MOVE = 'freesound_community-wood-chest-slid3-90317.mp3'",
  "const OPENING_SPIN = 'revolver-spinning-on-wood-v4.mp3'",
  "const CHAMBER_SPIN = 'freesound_community-revolver-spin-96947.mp3'",
  'const OPENING_WOOD_SOUND_MS = 7000',
  'const OPENING_SPIN_VOLUME = 0.16',
  'function playOpeningSpinSound()',
  'clip.__rrAuthorizedOpeningSpin = true',
  'function beginOpeningWoodSound()',
  'OPENING_BLOCKED_SOURCES.some(file => src.includes(file))',
  'playOpeningSpinSound()',
  'function playSpinButtonChamber()',
  'clip.__rrAuthorizedSpinButtonChamber = true',
  'nativeMediaPlay || HTMLMediaElement.prototype.__rrOriginalPlay',
  "return /^SPIN(?: (?:CHAMBER|CYLINDER))?$/.test(label)",
  "document.addEventListener('click'",
  'beginOpeningWoodSound()',
  'audio.openingSpin(game, state, gameId)',
  'audio.shotSequence(game, state, gameId)',
  'function syncResultCue()',
  'clip.__rrAuthorizedResultCue = true',
  "victory: 'desifreemusic-impact-strike-cinematic-hit-stinger-466320.mp3'",
  "defeat: 'u_903n3qx7rq-dramatic-sting-118943.mp3'"
]) if (!bindings.includes(required)) throw new Error(`Direct audio routing is missing ${required}`);

if (!bindings.match(/OPENING_BLOCKED_SOURCES = Object\.freeze\(\[\s*TABLE_MOVE,\s*CHAMBER_SPIN,/)) {
  throw new Error('The automatic opening must block the legacy wood and metallic chamber layers.');
}
if ((bindings.match(/__rrAuthorizedOpeningSpin = true/g) || []).length !== 1) {
  throw new Error('The approved opening sound must have exactly one authorized playback path.');
}
if ((bindings.match(/audio\.openingSpin\(/g) || []).length !== 1) {
  throw new Error('The opening wood route must have exactly one wrapper trigger.');
}
if ((bindings.match(/audio\.shotSequence\(/g) || []).length !== 1) {
  throw new Error('Shot audio must have exactly one wrapper trigger.');
}
if ((bindings.match(/document\.addEventListener\('click'/g) || []).length !== 1) {
  throw new Error('The Spin-button metallic cue must have exactly one click path.');
}
if ((bindings.match(/__rrAuthorizedResultCue = true/g) || []).length !== 1) {
  throw new Error('Victory or defeat must use exactly one authorized result path.');
}
for (const forbidden of ['audio.hammer()', 'audio.blank()', 'audio.gunshot()']) {
  if (bindings.includes(forbidden)) throw new Error(`Overlapping shot trigger remains: ${forbidden}`);
}

for (const required of [
  '/assets/roulette/decor/lamp-1.png',
  'const phaseEpoch = Number(global.__rrLampPhaseEpoch) || Date.now()',
  'function phaseMilliseconds(durationSeconds)',
  'function ensureElementTimeline(element, stateKey, signature, frames, timing, phase)',
  'function ensureSwingTimeline(swing, cfg)',
  "setImportant(swing, 'animation', 'none')",
  "'__rrLampSwingTimeline'",
  'function ensureLightTimeline(sceneLight, cfg)',
  "setImportant(sceneLight, 'animation', 'none')",
  "'__rrLampLightTimeline'",
  'animation.currentTime = phase'
]) if (!lamp.includes(required)) throw new Error(`Independent lamp timeline is missing ${required}`);

for (const forbidden of [
  'RouletteAudio', 'rouletteShotSequence', 'rouletteRotateToTurn',
  '.rr-gun-motion', 'scene.gun', 'scene.table'
]) {
  if (lamp.includes(forbidden) || lampCss.includes(forbidden)) {
    throw new Error(`Lamp visuals are coupled to audio or gun state: ${forbidden}`);
  }
}

if (!calibrationHtml.includes('/assets/roulette/lamp.js?v=20') ||
    !calibrationHtml.includes('lampCalibration=20')) {
  throw new Error('Lamp calibration page is not loading independent timeline version 20.');
}

const packageJson = JSON.parse(packageSource);
const expectedBuild = "node scripts/inject-lamp-assets.mjs && npm run validate:lamp && echo 'Static Netlify site - validation complete'";
if (packageJson.scripts?.build !== expectedBuild) throw new Error('Unexpected Netlify build pipeline.');

async function requireMissing(path) {
  try {
    await access(new URL(`../${path}`, import.meta.url));
    throw new Error(`Obsolete file still exists: ${path}`);
  } catch (error) {
    if (error.message === `Obsolete file still exists: ${path}`) throw error;
    if (error.code !== 'ENOENT') throw error;
  }
}
for (const path of [
  'scripts/clean-roulette-scene.mjs', 'assets/roulette/gun-facing.js',
  'assets/roulette/turn-orientation.js', 'assets/roulette/gun-turn-animation.js',
  'assets/roulette/gun-animation-test.js', 'assets/roulette/gun-animation-test.css',
  'gun-animation-test.html'
]) await requireMissing(path);

for (const path of [
  'assets/roulette/decor/lamp-1.png',
  'assets/roulette/decor/workshop-lamp-chain.png',
  'assets/roulette/audio/soundsforyou-the-ambience-room-tone-139064.mp3',
  'assets/roulette/audio/freesound_community-lamp-electricity-buzzingwav-14609.mp3',
  'assets/roulette/audio/oxidvideos-wood-creaks-411791.mp3',
  'assets/roulette/audio/freesound_community-wooden-chair-slide-scrape-on-wood-floor-75857.mp3',
  'assets/roulette/audio/freesound_community-tap-on-wooden-table-44998.mp3',
  'assets/roulette/audio/pwlpl-heartbeat-tense-377250.mp3',
  'assets/roulette/audio/diff_style-disturbing-low-rumble-183748.mp3',
  'assets/roulette/audio/gd_salman-tension-stinger-ambience-355381.mp3',
  'assets/roulette/audio/desifreemusic-impact-strike-cinematic-hit-stinger-466320.mp3',
  'assets/roulette/audio/u_903n3qx7rq-dramatic-sting-118943.mp3',
  'assets/roulette/audio/freesound_community-chain-6073.mp3',
  'assets/roulette/audio/freesound_community-wood-chest-slid3-90317.mp3',
  'assets/roulette/audio/revolver-spinning-on-wood-v4.mp3',
  'assets/roulette/audio/freesound_community-pistol-hammer-cocking-back-4-39887.mp3',
  'assets/roulette/audio/freesound_community-cocking-a-revolver-6279.mp3',
  'assets/roulette/audio/spinopel-dry-fire-gun-364844.mp3',
  'assets/roulette/audio/freesound_community-gun-dry-firing-3-39820.mp3',
  'assets/roulette/audio/freesound_community-single-pistol-gunshot-33-37187.mp3',
  'assets/roulette/audio/freesound_community-revolver-spin-96947.mp3',
  'assets/roulette/audio/freesound_community-revolver-chamber-spin-ratchet-sound-90521.mp3',
  'assets/roulette/audio/freesound_community-revolver-cocking-104722.mp3'
]) await access(new URL(`../${path}`, import.meta.url));

console.log('Validation passed: opening uses the approved revolver-on-wood mix, Spin button uses one metallic chamber spin, result cues are deduplicated, and protected animation hashes are intact.');
