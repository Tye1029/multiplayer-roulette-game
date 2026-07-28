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

const protectedHashes = new Map([
  ['turn-animation.js', ['24358e84c147d99e7297089e69ed1abd0802379f', turnLock]],
  ['turn-fire.js', ['940e824eae39ddc40dda6200f893f97fc365949b', turnFire]]
]);
for (const [name, [expected, source]] of protectedHashes) {
  const actual = gitBlobSha(source);
  if (actual !== expected) throw new Error(`${name} hash changed: ${actual}`);
}

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(config, sandbox, { filename: 'lamp-config.js' });
if (Object.keys(sandbox.window.RouletteLampConfig?.bindings || {}).length !== 25) {
  throw new Error('The 25 lamp calibration controls are not intact.');
}

for (const required of [
  '/assets/roulette/lamp.css?v=18',
  '/assets/roulette/lamp-config.js?v=19',
  '/assets/roulette/lamp.js?v=20',
  '/assets/roulette/lamp-bootstrap.js?v=19',
  '/assets/roulette/audio-manager.js?v=4',
  '/assets/roulette/spin-audio-policy.js?v=3',
  '/assets/roulette/turn-animation.js?v=5',
  '/assets/roulette/turn-fire.js?v=2',
  '/assets/roulette/audio-bindings.js?v=2',
  'MODULAR_LAMP_ASSETS_START',
  'rrLampCriticalHide'
]) if (!html.includes(required)) throw new Error(`Built page is missing ${required}`);

const audioIndex = injector.indexOf('/assets/roulette/audio-manager.js?v=4');
const policyIndex = injector.indexOf('/assets/roulette/spin-audio-policy.js?v=3');
const turnIndex = injector.indexOf('/assets/roulette/turn-animation.js?v=5');
const fireIndex = injector.indexOf('/assets/roulette/turn-fire.js?v=2');
const bindingIndex = injector.indexOf('/assets/roulette/audio-bindings.js?v=2');
if (!(audioIndex >= 0 && audioIndex < policyIndex && policyIndex < turnIndex && turnIndex < fireIndex && fireIndex < bindingIndex)) {
  throw new Error('Audio policy must load after the manager and before the protected animation modules.');
}
for (const forbidden of ['replaceLegacyRouletteAudio', 'uploadedRouletteAudioFunctions', 'audio-manager.js?v=3']) {
  if (injector.includes(forbidden)) throw new Error(`Fragile audio source rewrite still exists: ${forbidden}`);
}

for (const required of [
  "const styleId = 'rrStrictTurnLockStyles'", 'const lock = {', "pendingTurnId: ''",
  'function setRuntimeLock(gameId, turnId, angle)', 'function applyFacing(layers, angle, turnId',
  'function enforceLockedFacing(gameId)',
  'async function rotateToLockedTurn(game, gameId, requestedTurnId, duration = 1020)',
  'queueTurnRotation(game, gameId, turnId, 1020)',
  '{ transform: `rotate(${from + delta * 0.72}deg)`, offset: 0.72 }',
  '{ transform: `rotate(${from + delta - 9 * sign}deg)`, offset: 0.94 }',
  "easing: 'cubic-bezier(.22,.58,.12,1)'", 'const duration = 5300',
  "{ transform: 'rotate(116deg)', offset: 0.24 }",
  '{ transform: `rotate(${finalAngle + 720}deg)`, offset: 1 }',
  'rouletteSpinSound(1.35)', 'window.RouletteTurnLock = {'
]) if (!turnLock.includes(required)) throw new Error(`Turn animation changed unexpectedly: ${required}`);

for (const required of [
  'const api = window.RouletteTurnLock',
  'rouletteShotSequence = async function (_game, state, gameId)',
  'const lockedTurnId = lock.turnId', 'const lockedAngle = lock.angle',
  'rouletteShotIndexSound()', 'await rouletteWait(255)',
  "const live = state?.lastOutcome === 'live'", 'rouletteGunshotSound()',
  'rouletteBlankSound()', 'const recoilMotion = rouletteAnimate(layers.recoil',
  "{ transform: 'translate(20px,7px) rotate(10deg) scale(1.035)', offset: 0.2 }",
  "duration: 560, easing: 'cubic-bezier(.16,.85,.2,1)'",
  'applyFacing(mounted, lockedAngle, lockedTurnId, true)',
  'await rotateToLockedTurn(newest, gameId, newestTurnId, 1020)',
  'enforceLockedFacing(gameId)'
]) if (!turnFire.includes(required)) throw new Error(`Firing animation changed unexpectedly: ${required}`);

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
  "const cue = finishCue(game, root)",
  "for (const name of ['room', 'hum'])",
  "for (const name of ['heartbeat', 'rumble'])",
  'function trackLampSwing()', 'function silenceLegacyRouletteAudio()',
  'global.RouletteAudio = Object.freeze({'
]) if (!audio.includes(required)) throw new Error(`Audio manager is missing ${required}`);

for (const required of [
  'const CHAIN_COOLDOWN = 15000',
  'const CHAIN_STOP_AFTER = 340',
  'this.volume = Math.min(0.006',
  'this.__rrSpinSequenceChamber !== true || now >= chamberSpinUntil',
  'if (options.chamber === true) clip.__rrSpinSequenceChamber = true;',
  'function openingSpin(game, state, gameId)',
  'function shotSequence(game, state, gameId)',
  'audio.duckForShot?.()',
  "const dry = DRY_FIRE[dryVariant++ % DRY_FIRE.length]",
  'function syncTurnMovement()',
  "claimAction('turn-move', `${gameId}:${turnId}`, 12000)",
  'volume: 0.052',
  'openingSpin: ignoredOpeningSpin',
  'hammer: ignoredHammer',
  'gunshot: ignoredGunshot',
  'global.RouletteAudio = Object.freeze({',
  'shotSequence,',
  'turnRotate() { return null; }'
]) if (!spinPolicy.includes(required)) throw new Error(`Audited audio policy is missing ${required}`);

for (const forbidden of [
  "document.addEventListener('click'",
  'audio.hammer()', 'audio.blank()', 'audio.gunshot()',
  "schedule('shot-action', () => playClip(CHAMBER_LOCK",
  "playClip(CHAMBER_RATCHET, {\n        group: 'turn-move'"
]) if (spinPolicy.includes(forbidden) || bindings.includes(forbidden)) {
  throw new Error(`Overlapping or forbidden audio trigger still exists: ${forbidden}`);
}

for (const required of [
  'const originalOpeningSequence = rouletteOpeningSequence',
  'audio.openingSpin(game, state, gameId)',
  'return originalOpeningSequence.apply(this, arguments)',
  'const originalShotSequence = rouletteShotSequence',
  'audio.shotSequence(game, state, gameId)',
  'return originalShotSequence.apply(this, arguments)',
  'silenceLegacy()', 'audio.markBindingsReady()'
]) if (!bindings.includes(required)) throw new Error(`Direct audio binding is missing ${required}`);

if ((bindings.match(/audio\.openingSpin\(/g) || []).length !== 1) {
  throw new Error('Opening audio must have exactly one action-wrapper trigger.');
}
if ((bindings.match(/audio\.shotSequence\(/g) || []).length !== 1) {
  throw new Error('Shot audio must have exactly one action-wrapper trigger.');
}
if ((spinPolicy.match(/playClip\(CHAMBER_LOCK/g) || []).length !== 1) {
  throw new Error('Chamber lock must exist only in the opening Spin sequence.');
}
if ((spinPolicy.match(/playClip\(CHAMBER_SPIN/g) || []).length !== 1) {
  throw new Error('Chamber spin must exist only in the opening Spin sequence.');
}
if ((spinPolicy.match(/playClip\(CHAMBER_RATCHET/g) || []).length !== 1) {
  throw new Error('Chamber ratchet must exist only in the opening Spin sequence.');
}

for (const required of [
  '/assets/roulette/decor/lamp-1.png',
  'const phaseEpoch = Number(global.__rrLampPhaseEpoch) || Date.now()',
  'function phaseMilliseconds(durationSeconds)',
  'function ensureElementTimeline(element, stateKey, signature, frames, timing, phase)',
  'function ensureSwingTimeline(swing, cfg)', "setImportant(swing, 'animation', 'none')",
  "'__rrLampSwingTimeline'", 'function ensureLightTimeline(sceneLight, cfg)',
  "setImportant(sceneLight, 'animation', 'none')", "'__rrLampLightTimeline'",
  'animation.currentTime = phase'
]) if (!lamp.includes(required)) throw new Error(`Independent lamp timeline is missing ${required}`);

for (const forbidden of ['RouletteAudio', 'rouletteShotSequence', 'rouletteRotateToTurn', '.rr-gun-motion', 'scene.gun', 'scene.table']) {
  if (lamp.includes(forbidden) || lampCss.includes(forbidden)) {
    throw new Error(`Lamp visuals are coupled to audio or gun state: ${forbidden}`);
  }
}

if (!calibrationHtml.includes('/assets/roulette/lamp.js?v=20') || !calibrationHtml.includes('lampCalibration=20')) {
  throw new Error('Lamp calibration page is not loading independent timeline version 20.');
}

const packageJson = JSON.parse(packageSource);
const expected = "node scripts/inject-lamp-assets.mjs && npm run validate:lamp && echo 'Static Netlify site - validation complete'";
if (packageJson.scripts?.build !== expected) throw new Error('Unexpected Netlify build pipeline.');

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
  'assets/roulette/audio/freesound_community-pistol-hammer-cocking-back-4-39887.mp3',
  'assets/roulette/audio/freesound_community-cocking-a-revolver-6279.mp3',
  'assets/roulette/audio/spinopel-dry-fire-gun-364844.mp3',
  'assets/roulette/audio/freesound_community-gun-dry-firing-3-39820.mp3',
  'assets/roulette/audio/freesound_community-single-pistol-gunshot-33-37187.mp3',
  'assets/roulette/audio/freesound_community-revolver-spin-96947.mp3',
  'assets/roulette/audio/freesound_community-revolver-chamber-spin-ratchet-sound-90521.mp3',
  'assets/roulette/audio/freesound_community-revolver-cocking-104722.mp3'
]) await access(new URL(`../${path}`, import.meta.url));

console.log('Validation passed: Spin-only chamber audio, one keyed shot path, quiet turn slide, restrained chain, deduplicated state cues, and protected animation hashes are intact.');
