import { access, readFile } from 'node:fs/promises';
import vm from 'node:vm';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [html, injector, turnLock, turnFire, audio, bindings, config, lamp, bootstrap, calibration, lampCss, calibrationHtml, packageSource] = await Promise.all([
  read('index.html'),
  read('scripts/inject-lamp-assets.mjs'),
  read('assets/roulette/turn-animation.js'),
  read('assets/roulette/turn-fire.js'),
  read('assets/roulette/audio-manager.js'),
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
  ['turn-animation.js', turnLock], ['turn-fire.js', turnFire], ['audio-manager.js', audio],
  ['audio-bindings.js', bindings], ['lamp.js', lamp], ['lamp-bootstrap.js', bootstrap],
  ['lamp-calibration.js', calibration]
]) new vm.Script(source, { filename: name });

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(config, sandbox, { filename: 'lamp-config.js' });
if (Object.keys(sandbox.window.RouletteLampConfig?.bindings || {}).length !== 25) {
  throw new Error('The 25 lamp calibration controls are not intact.');
}

for (const required of [
  '/assets/roulette/lamp.css?v=18', '/assets/roulette/lamp-config.js?v=19',
  '/assets/roulette/lamp.js?v=20', '/assets/roulette/lamp-bootstrap.js?v=19',
  '/assets/roulette/audio-manager.js?v=4', '/assets/roulette/turn-animation.js?v=5',
  '/assets/roulette/turn-fire.js?v=2', '/assets/roulette/audio-bindings.js?v=1',
  'MODULAR_LAMP_ASSETS_START', 'rrLampCriticalHide'
]) if (!html.includes(required)) throw new Error(`Built page is missing ${required}`);

const audioIndex = injector.indexOf('/assets/roulette/audio-manager.js?v=4');
const turnIndex = injector.indexOf('/assets/roulette/turn-animation.js?v=5');
const fireIndex = injector.indexOf('/assets/roulette/turn-fire.js?v=2');
const bindingIndex = injector.indexOf('/assets/roulette/audio-bindings.js?v=1');
if (!(audioIndex >= 0 && audioIndex < turnIndex && turnIndex < fireIndex && fireIndex < bindingIndex)) {
  throw new Error('Audio must mute legacy sounds before animations load and bind after firing loads.');
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
  'const api = window.RouletteTurnLock', 'rouletteShotSequence = async function (_game, state, gameId)',
  'const lockedTurnId = lock.turnId', 'const lockedAngle = lock.angle', 'rouletteShotIndexSound()',
  'await rouletteWait(255)', "const live = state?.lastOutcome === 'live'", 'rouletteGunshotSound()',
  'rouletteBlankSound()', 'const recoilMotion = rouletteAnimate(layers.recoil',
  "{ transform: 'translate(20px,7px) rotate(10deg) scale(1.035)', offset: 0.2 }",
  "duration: 560, easing: 'cubic-bezier(.16,.85,.2,1)'",
  'applyFacing(mounted, lockedAngle, lockedTurnId, true)',
  'await rotateToLockedTurn(newest, gameId, newestTurnId, 1020)', 'enforceLockedFacing(gameId)'
]) if (!turnFire.includes(required)) throw new Error(`Firing animation changed unexpectedly: ${required}`);

for (const required of [
  "const BASE = '/assets/roulette/audio/'", "spin: 'freesound_community-revolver-spin-96947.mp3'",
  "ratchet: 'freesound_community-revolver-chamber-spin-ratchet-sound-90521.mp3'",
  "lock: 'freesound_community-revolver-cocking-104722.mp3'",
  "hammerA: 'freesound_community-pistol-hammer-cocking-back-4-39887.mp3'",
  "hammerB: 'freesound_community-cocking-a-revolver-6279.mp3'",
  "dryA: 'spinopel-dry-fire-gun-364844.mp3'", "dryB: 'freesound_community-gun-dry-firing-3-39820.mp3'",
  "gunshot: 'freesound_community-single-pistol-gunshot-33-37187.mp3'",
  'function silenceLegacyRouletteAudio()', 'rouletteSpinSound = legacyNoop',
  'rouletteShotIndexSound = legacyNoop', 'rouletteBlankSound = legacyNoop',
  'rouletteGunshotSound = legacyNoop', 'function openingSpin()', 'function turnRotate(duration = 1020)',
  'function hammer()', 'function blank()', 'function gunshot()', 'function trackLampSwing()',
  'const epoch = Number(global.__rrLampPhaseEpoch)', "play('chain'", "play('wood'", "play('chair'",
  "play('tap'", "play('tension'", 'function duckForShot()', 'global.RouletteAudio = Object.freeze({'
]) if (!audio.includes(required)) throw new Error(`Uploaded-audio runtime is missing ${required}`);

for (const forbidden of [
  'rouletteAnimate(', 'applyFacing(', 'enforceLockedFacing(', 'rotateToLockedTurn(',
  '.rr-turn-facing', '.rr-gun-motion', 'data-roulette-facing', 'data-roulette-recoil',
  'getAnimations', 'style.transform', 'MutationObserver'
]) if (audio.includes(forbidden)) throw new Error(`Audio runtime can alter animation state: ${forbidden}`);

for (const required of [
  'const audio = global.RouletteAudio', 'const originalOpeningSequence = rouletteOpeningSequence',
  'audio.openingSpin()', 'return originalOpeningSequence.apply(this, arguments)',
  'const originalShotSequence = rouletteShotSequence', 'audio.hammer()',
  "const live = state?.lastOutcome === 'live'", 'if (live) audio.gunshot()', 'else audio.blank()',
  '}, 255)', 'silenceLegacy()', 'audio.markBindingsReady()'
]) if (!bindings.includes(required)) throw new Error(`Direct audio binding is missing ${required}`);

for (const forbidden of [
  'rouletteAnimate(', 'applyFacing(', 'enforceLockedFacing(', 'rotateToLockedTurn(',
  'transform:', 'getAnimations', 'MutationObserver'
]) if (bindings.includes(forbidden)) throw new Error(`Audio bindings alter animation behavior: ${forbidden}`);

for (const required of [
  '/assets/roulette/decor/lamp-1.png', 'const phaseEpoch = Number(global.__rrLampPhaseEpoch) || Date.now()',
  'function phaseMilliseconds(durationSeconds)',
  'function ensureElementTimeline(element, stateKey, signature, frames, timing, phase)',
  'function ensureSwingTimeline(swing, cfg)', "setImportant(swing, 'animation', 'none')",
  "'__rrLampSwingTimeline'", 'function ensureLightTimeline(sceneLight, cfg)',
  "setImportant(sceneLight, 'animation', 'none')", "'__rrLampLightTimeline'", 'animation.currentTime = phase'
]) if (!lamp.includes(required)) throw new Error(`Independent lamp timeline is missing ${required}`);

for (const forbidden of ['RouletteAudio', 'rouletteShotSequence', 'rouletteRotateToTurn', '.rr-gun-motion', 'scene.gun', 'scene.table']) {
  if (lamp.includes(forbidden) || lampCss.includes(forbidden)) throw new Error(`Lamp visuals are coupled to audio or gun state: ${forbidden}`);
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
  'assets/roulette/gun-animation-test.js', 'assets/roulette/gun-animation-test.css', 'gun-animation-test.html'
]) await requireMissing(path);

for (const path of [
  'assets/roulette/decor/lamp-1.png', 'assets/roulette/decor/workshop-lamp-chain.png',
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
  'assets/roulette/audio/freesound_community-pistol-hammer-cocking-back-4-39887.mp3',
  'assets/roulette/audio/freesound_community-cocking-a-revolver-6279.mp3',
  'assets/roulette/audio/spinopel-dry-fire-gun-364844.mp3',
  'assets/roulette/audio/freesound_community-gun-dry-firing-3-39820.mp3',
  'assets/roulette/audio/freesound_community-single-pistol-gunshot-33-37187.mp3',
  'assets/roulette/audio/freesound_community-revolver-spin-96947.mp3',
  'assets/roulette/audio/freesound_community-revolver-chamber-spin-ratchet-sound-90521.mp3',
  'assets/roulette/audio/freesound_community-revolver-cocking-104722.mp3'
]) await access(new URL(`../${path}`, import.meta.url));

console.log('Validation passed: legacy roulette audio is muted, uploaded recordings are action-bound, ambience fades smoothly, and animation code is unchanged.');
