import { access, readFile } from 'node:fs/promises';
import vm from 'node:vm';

const read = filePath => readFile(new URL(`../${filePath}`, import.meta.url), 'utf8');
const [
  configSource,
  runtimeSource,
  calibrationSource,
  bootstrapSource,
  injectorSource,
  cleanupSource,
  packageSource,
  htmlSource,
  calibrationHtmlSource,
  cssSource
] = await Promise.all([
  read('assets/roulette/lamp-config.js'),
  read('assets/roulette/lamp.js'),
  read('assets/roulette/lamp-calibration.js'),
  read('assets/roulette/lamp-bootstrap.js'),
  read('scripts/inject-lamp-assets.mjs'),
  read('scripts/clean-roulette-scene.mjs'),
  read('package.json'),
  read('index.html'),
  read('lamp-calibration.html'),
  read('assets/roulette/lamp.css')
]);

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(configSource, sandbox, { filename: 'lamp-config.js' });
new vm.Script(runtimeSource, { filename: 'lamp.js' });
new vm.Script(calibrationSource, { filename: 'lamp-calibration.js' });
new vm.Script(bootstrapSource, { filename: 'lamp-bootstrap.js' });

const api = sandbox.window.RouletteLampConfig;
if (!api) throw new Error('RouletteLampConfig was not exported');
const keys = Object.keys(api.bindings);
if (keys.length !== 25) throw new Error(`Expected 25 controls, found ${keys.length}`);
for (const key of keys) {
  if (!Object.hasOwn(api.defaults, key)) throw new Error(`Missing default for ${key}`);
  if (!runtimeSource.includes(`cfg.${key}`)) throw new Error(`Runtime does not apply ${key}`);
  if (!runtimeSource.includes(`${key}:`)) throw new Error(`Runtime target map does not include ${key}`);
}

for (const required of [
  '/assets/roulette/lamp-config.js?v=18',
  '/assets/roulette/lamp.js?v=18',
  '/assets/roulette/lamp-calibration.js?v=18',
  '/assets/roulette/lamp-calibration.css?v=18',
  '?lampCalibration=18'
]) {
  if (!calibrationHtmlSource.includes(required)) throw new Error(`Calibration HTML missing ${required}`);
}

for (const required of [
  '/assets/roulette/lamp-config.js?v=18',
  '/assets/roulette/lamp.js?v=18',
  '/assets/roulette/lamp-bootstrap.js?v=18',
  'rrLampCriticalHide',
  'MODULAR_LAMP_ASSETS_START',
  'MODULAR_LAMP_ASSETS_END',
  'top: calc(20% - 26px)',
  'left: 49.75%',
  'width: 12.5px',
  'height: 5%',
  'top: 90.5% !important',
  'width: 94% !important'
]) {
  if (!injectorSource.includes(required)) throw new Error(`Build injector missing ${required}`);
  if (!htmlSource.includes(required)) throw new Error(`Built page missing ${required}`);
}

for (const forbidden of ['gun-facing.js', 'turn-orientation.js', 'gun-turn-animation.js', 'gun-animation-test']) {
  if (injectorSource.includes(forbidden) || htmlSource.includes(forbidden)) {
    throw new Error(`External gun patch is still loaded: ${forbidden}`);
  }
}

for (const required of [
  '/assets/roulette/decor/lamp-1.png',
  "styleAsset = '/assets/roulette/lamp.css?v=18'",
  'const phaseEpoch = Number(global.__rrLampPhaseEpoch) || Date.now()',
  'function animationDelayFor(duration)',
  "setImportant(scene.swing, 'animation-delay', animationDelayFor(cfg.speed))",
  "setImportant(scene.sceneLight, 'animation-delay', animationDelayFor(cfg.trackSpeed))",
  'const repairImmediately = () =>',
  'if (!stopped && !applying && lampNeedsRepair()) run()',
  'scene.chain !== lastChain',
  'scene.sceneLight !== lastLight'
]) {
  if (!runtimeSource.includes(required)) throw new Error(`Replacement-safe lamp runtime missing ${required}`);
}

for (const forbidden of [
  '.rr-gun-motion',
  'getBoundingClientRect',
  'scene.gun',
  'scene.table',
  'data-current-turn',
  'data-shot-revision',
  'requestAnimationFrame(apply',
  'setInterval('
]) {
  if (runtimeSource.includes(forbidden)) throw new Error(`Lamp runtime still interacts with gun/turn state or delays remount repair: ${forbidden}`);
}

for (const required of [
  '/* Permanent self-contained lamp foundation. */',
  'left: 49.75%;',
  'top: calc(20% - 26px);',
  'width: 12.5px;',
  'height: 5%;',
  '--rr-chain-left-length: 70%;',
  '--rr-chain-right-length: 101%;',
  'var(--rr-lamp-art-x, -0.75%)',
  'var(--rr-lamp-art-y, 90.5%)',
  'var(--rr-lamp-width, 94%)',
  'var(--rr-lamp-scale, 1.1)',
  'background-position: calc(50% - var(--rr-light-track-distance',
  'background-position: calc(50% + var(--rr-light-track-distance',
  'transform: none !important',
  '#rrLampTrackedLight',
  '#rrRoomDarknessOverlay'
]) {
  if (!cssSource.includes(required)) throw new Error(`Lamp CSS missing ${required}`);
}
for (const forbidden of ['[data-roulette-game] .rr-gun-motion', '[data-current-turn', '[data-shot-revision']) {
  if (cssSource.includes(forbidden)) throw new Error(`Lamp CSS still styles gun or turn state: ${forbidden}`);
}
if (cssSource.includes('@keyframes rrLampLightTrackExternal {\n  0%, 100% { transform:')) {
  throw new Error('Light tracking still transforms a scene element');
}

const obsoleteSceneBlockIds = [
  'rr-v114-image2-lamp-rig','rr-v115-lamp-and-light-runtime','rr-v126-split-lamp-rig','rr-v127-lamp-layer-fix',
  'rr-v130-table-surface-lighting','rr-v134-clean-reactive-lighting','rr-v135-overhead-table-light-fix',
  'rr-v136-center-bright-full-table-extension','rr-v136-table-edge-layer','rr-v137-reference-centered-textured-lighting',
  'rr-v139-visible-reference-lighting','rr-v140-lighting-debug-rebuild','rr-v140-lighting-debug-tools',
  'rr-v141-debug-bootstrap','rr-v141-debug-visible-fix','rr-v142-warm-rough-table-authoritative',
  'rr-v143-clean-moving-light-authoritative','rr-v143-remove-debug-ui','rr-v144-targeted-light-balance',
  'rr-v145-single-driver-light-sync','rr-v145-single-driver-light-sync-script','rr-v146-lamp-art-cleanup',
  'rr-v147-halo-bulb-direction-fix','rr-v148-final-lamp-asset-cleanup','rr-live-lamp-calibration-style',
  'rr-live-lamp-calibration-script','rr-live-lamp-calibration-overrides'
];
for (const id of obsoleteSceneBlockIds) {
  if (!cleanupSource.includes(`'${id}'`)) throw new Error(`Cleanup script does not own obsolete block: ${id}`);
  if (htmlSource.includes(`id="${id}"`) || htmlSource.includes(`id='${id}'`)) {
    throw new Error(`Obsolete scene override survived the build: ${id}`);
  }
}

for (const required of [
  'rotate(${Number(angle)||0}deg) scale(${scale})',
  'const animatedTarget=from+delta;',
  '{transform:rouletteMotionTransform(from,scale)}',
  '{transform:rouletteMotionTransform(animatedTarget,scale)}',
  "{duration,easing:'cubic-bezier(.22,.58,.12,1)',fill:'forwards'}",
  'const mountedRoot=duelActive?.querySelector',
  "const mountedMotion=mountedRoot?.querySelector('[data-roulette-motion]')",
  'const applyAngleToMountedGun=angle=>',
  'if(finalMotion)finalMotion.style.transform=rouletteMotionTransform(angle,rouletteMotionScale())',
  "mountedRoot?.classList.remove('rr-animation-lock')",
  'Shot effects never rotate the revolver.'
]) {
  if (!htmlSource.includes(required)) throw new Error(`Replacement-safe core turn rotation missing ${required}`);
}
for (const forbidden of [
  'scale(${-scale},${scale})',
  "rouletteAnimate(motion,[{opacity:1},{opacity:.12}]",
  "rouletteAnimate(motion,[{opacity:.12},{opacity:1}]",
  'rouletteOrientToShotActor(',
  'shot actor orientation locked',
  'data-rr-gun-facing-rotor',
  '--rr-turn-origin-x',
  '--rr-turn-origin-y'
]) {
  if (htmlSource.includes(forbidden)) throw new Error(`Old gun transition behavior survived cleanup: ${forbidden}`);
}

const packageJson = JSON.parse(packageSource);
const expectedBuild = "node scripts/clean-roulette-scene.mjs && node scripts/inject-lamp-assets.mjs && npm run validate:lamp && echo 'Static Netlify site - validation complete'";
if (packageJson.scripts?.build !== expectedBuild) throw new Error('Netlify build pipeline changed unexpectedly');
if (packageJson.scripts?.['clean:lamp']) throw new Error('Broad deployment-time lamp deletion must remain disabled');

await access(new URL('../assets/roulette/decor/lamp-1.png', import.meta.url));
await access(new URL('../assets/roulette/decor/workshop-lamp-chain.png', import.meta.url));
await access(new URL('../scripts/clean-roulette-scene.mjs', import.meta.url));

async function requireMissing(filePath) {
  try {
    await access(new URL(`../${filePath}`, import.meta.url));
    throw new Error(`Obsolete diagnostic or gun patch file still exists: ${filePath}`);
  } catch (error) {
    if (error.message === `Obsolete diagnostic or gun patch file still exists: ${filePath}`) throw error;
    if (error.code !== 'ENOENT') throw error;
  }
}
for (const filePath of [
  'assets/roulette/gun-facing.js','assets/roulette/turn-orientation.js','assets/roulette/gun-turn-animation.js',
  'assets/roulette/gun-animation-test.js','assets/roulette/gun-animation-test.css','gun-animation-test.html',
  'assets/roulette/decor/workshop-lamp-body-game-small-2.png'
]) await requireMissing(filePath);

if (!calibrationSource.includes('lampApi.watch')) throw new Error('Calibration controller is not watching lamp remounts');
if (!bootstrapSource.includes("params.has('lampCalibration')") || !bootstrapSource.includes('lampApi.watch')) {
  throw new Error('Normal-page lamp bootstrap is not isolated from calibration mode');
}

console.log(`Validation passed: ${keys.length}/${keys.length} lamp controls bound; gun direction and lamp phase survive scene-node replacement.`);
