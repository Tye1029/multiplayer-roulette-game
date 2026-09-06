import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');
const template = html.match(/<template id="mountainRaceImagePreloads">([\s\S]*?)<\/template>/);
assert(template, 'Summit image preload template is missing');
const script = html.match(/<script id="game-asset-loading-v1">([\s\S]*?)<\/script>/)?.[1];
assert(script, 'Game asset selection loader is missing');
const imagePaths = [...template[1].matchAll(/href="([^"]+)"/g)].map(match => match[1]);
assert.equal(imagePaths.length, 10, 'All ten current Summit images must remain available');
assert.equal(new Set(imagePaths).size, imagePaths.length, 'Preload template duplicates an image');
assert(!html.replace(template[0], '').includes('rel="preload" as="image" href="/assets/mountain-race/'),
  'Summit images must not preload on unrelated game pages');
let deferredBytes = 0;
for (const path of imagePaths) deferredBytes += (await stat(new URL(path.slice(1), root))).size;

function environment(search = '', selectedMode = 'fishing') {
  const documentEvents = new Map();
  const windowEvents = new Map();
  const requests = [];
  const media = { draw: 0, safe: 0, roulette: 0 };
  const listen = map => (name, callback) => {
    if (!map.has(name)) map.set(name, []);
    map.get(name).push(callback);
  };
  const document = {
    head: { appendChild: fragment => requests.push(...fragment) },
    getElementById: id => id === 'mountainRaceImagePreloads'
      ? { content: { cloneNode: () => [...imagePaths] } }
      : id === 'duelModeSelect' ? { value: selectedMode } : null,
    addEventListener: listen(documentEvents)
  };
  const window = {
    addEventListener: listen(windowEvents),
    duelDrawWarmWesternMusic: () => { media.draw += 1; },
    safeCrackerWarmAudio: () => { media.safe += 1; },
    RouletteAudio: { preload: () => { media.roulette += 1; } }
  };
  vm.runInNewContext(script, { document, window, location: { search }, URLSearchParams });
  const fire = (map, type, event = {}) => (map.get(type) || []).forEach(callback => callback(event));
  return {
    requests, media, window,
    dom: (name, event) => fire(documentEvents, name, event),
    state: game => fire(windowEvents, 'mountainrace:state', { detail: { game } }),
    choice: (mode, disabled = false, bot = false) => fire(documentEvents, 'click', {
      target: { closest: () => ({ disabled, dataset: bot ? { rnbGame: mode } : { mode } }) }
    })
  };
}

for (const mode of ['', 'safecracker', 'fishing', 'roulette', 'blackjackduel']) {
  const test = environment(mode ? `?game=${mode}` : '');
  test.dom('DOMContentLoaded');
  assert.equal(test.requests.length, 0, `${mode || 'Launcher'} loaded Summit imagery`);
  assert.equal(test.media.draw, 0, `${mode || 'Launcher'} loaded Draw music`);
}
const direct = environment('?game=mountainrace');
assert.deepEqual(direct.requests, imagePaths, 'Direct Summit links must preload during parsing');
direct.dom('DOMContentLoaded');
direct.state({ mode: 'mountainrace', status: 'ready' });
direct.state({ mode: 'mountainrace', status: 'playing' });
assert.equal(direct.requests.length, 10, 'URL, Ready, and playing updates duplicate preloads');

for (const bot of [false, true]) {
  const test = environment();
  test.choice('mountainrace', true, bot);
  assert.equal(test.requests.length, 0, 'Disabled game buttons must not load artwork');
  test.choice('mountainrace', false, bot);
  assert.deepEqual(test.requests, imagePaths, 'Choosing Summit must preload before Ready');
  test.choice('mountainrace', false, bot);
  assert.equal(test.requests.length, 10, 'Repeated selection duplicates preloads');
}
const select = environment();
select.dom('change', { target: { id: 'duelModeSelect', value: 'mountainrace' } });
assert.deepEqual(select.requests, imagePaths, 'Mode dropdown does not warm Summit');
const restored = environment();
restored.state({ mode: 'mountainrace', status: 'ready' });
assert.deepEqual(restored.requests, imagePaths, 'Restored matches must warm their scene');
assert.match(html, /function duelRenderActive\(game, force = false\) \{\s*\/\/[^\n]*\n\s*window\.DuelAssetLoader\?\.warm\(game\?\.mode\);/,
  'Joined/restored matches must warm assets before mounting their Ready board');
const explicitSafe = environment('?game=safecracker', 'mountainrace');
explicitSafe.dom('DOMContentLoaded');
assert.equal(explicitSafe.requests.length, 0, 'A restored dropdown value overrode the URL choice');
assert(explicitSafe.media.safe > 0, 'Safe Cracker audio must prime at selection');
const emptyHome = environment('', 'roulette');
emptyHome.dom('DOMContentLoaded');
assert.equal(emptyHome.media.roulette, 0, 'Hidden default dropdown preloaded Roulette on the launcher');
const earlyRestore = environment();
delete earlyRestore.window.RouletteAudio;
earlyRestore.window.DuelAssetLoader.warm('roulette');
let lateWarm = 0;
earlyRestore.window.RouletteAudio = { preload: () => { lateWarm += 1; } };
earlyRestore.dom('DOMContentLoaded');
assert.equal(lateWarm, 1, 'A restored selection was lost before deferred audio scripts initialized');

// Execute the real Draw constructor and warmer: no source at boot, one load on
// selection, and no duplicate reload when rendering/polling the same game.
const drawSource = html.match(/const duelDrawWesternMusic = new Audio\([\s\S]*?(?=    function duelDrawFadeWesternMusic)/)?.[0];
assert(drawSource, 'Draw music initialization is missing');
const audioRequests = [];
class Audio {
  constructor(source) { this.src = source || ''; }
  getAttribute(name) { return name === 'src' ? this.src : null; }
  load() { audioRequests.push(this.src); }
  pause() {}
}
const draw = vm.createContext({ Audio });
vm.runInContext(drawSource, draw);
assert.equal(vm.runInContext('duelDrawWesternMusic.src', draw), '', 'Draw music downloads at boot');
assert.equal(vm.runInContext('duelDrawWesternMusic.preload', draw), 'none');
vm.runInContext('duelDrawWarmWesternMusic(); duelDrawWarmWesternMusic();', draw);
assert.deepEqual(audioRequests, ['assets/draw-western-theme.mp3']);
const fadeSource = html.match(/    function duelDrawFadeWesternMusic\([\s\S]*?(?=    function duelDrawSyncWesternMusic)/)?.[0];
assert(fadeSource, 'Draw music fade function is missing');
let frames = 0;
Object.assign(draw, {
  performance: { now: () => 0 },
  requestAnimationFrame: () => { frames += 1; return frames; },
  cancelAnimationFrame() {}
});
vm.runInContext(fadeSource, draw);
vm.runInContext('duelDrawFadeWesternMusic(0, 420, true); duelDrawFadeWesternMusic(0, 420, true);', draw);
assert.equal(frames, 0, 'Inactive Draw music must not schedule a new animation on every game update');
vm.runInContext('duelDrawFadeWesternMusic(0.09, 1200);', draw);
assert.equal(frames, 1, 'An actual music volume change must still animate');
const chooseDraw = environment();
chooseDraw.choice('draw');
assert.equal(chooseDraw.media.draw, 1, 'Draw selection does not warm its music');

const [managerSource, reactionSource, bindingsSource] = await Promise.all([
  readFile(new URL('assets/roulette/audio-manager.js', root), 'utf8'),
  readFile(new URL('assets/roulette/reaction-audio.js', root), 'utf8'),
  readFile(new URL('assets/roulette/audio-bindings.js', root), 'utf8')
]);
function bindingFunction(name) {
  const value = bindingsSource.match(new RegExp(`  function ${name}\\([\\s\\S]*?(?=\\n  function )`))?.[0];
  assert(value, `Missing audio binding ${name}`);
  return value;
}
function rouletteEnvironment({ mode = 'safecracker', homeVisible = false } = {}) {
  const listeners = new Map();
  const loaded = [], constructed = [], fetched = [], played = [];
  const timeouts = new Map();
  let timerId = 0;
  const page = { mode, homeVisible, boardVisible: false };
  const document = {
    hidden: false,
    getElementById: id => id === 'duelModeSelect' ? { value: page.mode }
      : id === 'simpleTestHome' ? { hidden: !page.homeVisible }
      : id === 'duelScreen' ? { hidden: false } : null,
    querySelector: () => page.boardVisible ? { closest: () => null } : null,
    addEventListener: (name, callback) => {
      if (!listeners.has(name)) listeners.set(name, []);
      listeners.get(name).push(callback);
    },
    removeEventListener: (name, callback) => {
      listeners.set(name, (listeners.get(name) || []).filter(item => item !== callback));
    }
  };
  class Media {
    constructor(src = '') {
      this.src = src; this.volume = 1; this.readyState = 1; this.duration = 2;
      if (src) constructed.push(src);
    }
    load() { loaded.push(this.src); }
    play() { played.push(this.src); return Promise.resolve(); }
    pause() {}
    cloneNode() { return new Media(this.src); }
    addEventListener() {}
    removeAttribute() {}
  }
  const context = vm.createContext({
    document, Audio: Media, HTMLMediaElement: { prototype: {} },
    performance: { now: () => 10000 }, CSS: { escape: value => value },
    localStorage: { getItem: () => '' },
    requestAnimationFrame: () => 1,
    setTimeout: (callback, delay) => { const id = ++timerId; timeouts.set(id, { callback, delay }); return id; },
    clearTimeout: id => timeouts.delete(id), setInterval: () => 1, clearInterval() {},
    addEventListener() {},
    fetch: path => { fetched.push(path); return Promise.resolve({ ok: true, text: () => Promise.resolve('SUQz') }); },
    rouletteShotSequence: () => 'original-shot',
    rouletteLatestGame: null, duelLastActiveGame: null
  });
  context.window = context;
  vm.runInContext(managerSource, context);
  vm.runInContext(reactionSource, context);
  const resultFiles = bindingsSource.match(/  const RESULT_FILES = Object\.freeze\(\{[\s\S]*?\}\);/)?.[0];
  assert(resultFiles, 'Result sound mapping is missing');
  // Execute the actual gesture handler and its real silent media primer. The
  // result rendering/animation code is outside this loading test's scope.
  vm.runInContext(`
    const audio = window.RouletteAudio;
    const BASE = '/assets/roulette/audio/';
    ${resultFiles}
    const resultAudioPool = Object.create(null);
    let resultAudioPrimed = false;
    let nativeMediaPlay = Audio.prototype.play;
    let activeResultClip = null;
    function cancelResultFade() {}
    function resultVolume() { return 0.2; }
    function nearestInteractive(target) { return target; }
    function isSpinControl(target) { return Boolean(target?.spin); }
    let spinPlays = 0;
    function playSpinButtonChamber() { spinPlays += 1; }
    ${bindingFunction('makeResultClip')}
    ${bindingFunction('primeResultAudio')}
    ${bindingFunction('handleSpinGesture')}
    document.addEventListener('pointerdown', handleSpinGesture, true);
    document.addEventListener('click', handleSpinGesture, true);
  `, context);
  const fire = (type, choice = '', disabled = false, bot = false) => {
    const event = { target: { closest: () => choice
      ? { disabled, dataset: bot ? { rnbGame: choice } : { mode: choice } } : null } };
    for (const callback of [...(listeners.get(type) || [])]) callback(event);
  };
  return { page, context, loaded, constructed, fetched, played, timeouts, fire };
}

for (const mode of ['safecracker', 'fishing', 'blackjackduel', 'mountainrace', 'draw']) {
  const test = rouletteEnvironment({ mode });
  for (const type of ['pointerdown', 'pointerup', 'touchstart', 'click', 'keydown']) test.fire(type);
  assert.equal(test.constructed.length, 0, `${mode} created unused Roulette media`);
  assert.equal(test.fetched.length, 0, `${mode} fetched Roulette reaction chunks`);
  assert.equal(test.context.RouletteAudio.diagnostics().unlocked, false);
  // Those unrelated gestures must not consume Roulette's later mobile unlock.
  test.page.mode = 'roulette';
  test.fire('touchstart');
  assert.equal(test.context.RouletteAudio.diagnostics().unlocked, true);
  assert.equal(test.loaded.length, 19, 'Mobile Roulette gesture did not prime its full sound library');
  test.fire('pointerdown');
  assert.equal(test.loaded.length, 19, 'Repeated Roulette gestures reloaded sound templates');
  assert.equal(test.fetched.length, 13, 'Reaction chunks should load once, only for Roulette');
  assert.equal(vm.runInContext('resultAudioPrimed', test.context), true,
    'Roulette pointer gesture must still silently unlock both result clips');
  assert(test.played.filter(src => /impact-strike|dramatic-sting/.test(src)).length === 2);
}
const untouchedHome = rouletteEnvironment({ mode: 'roulette', homeVisible: true });
untouchedHome.fire('pointerdown');
untouchedHome.fire('keydown');
assert.equal(untouchedHome.constructed.length, 0, 'Launcher default mode caused Roulette media downloads');
untouchedHome.fire('pointerdown', 'safecracker');
assert.equal(untouchedHome.constructed.length, 0, 'Safe launcher choice primed Roulette');
untouchedHome.fire('pointerdown', 'roulette', true);
assert.equal(untouchedHome.constructed.length, 0, 'Disabled Roulette choice primed audio');
untouchedHome.fire('keydown', 'roulette');
assert.equal(untouchedHome.loaded.length, 19, 'Keyboard launcher choice failed to unlock Roulette');
const botChoice = rouletteEnvironment({ mode: 'safecracker', homeVisible: true });
botChoice.fire('pointerdown', 'roulette', false, true);
assert.equal(botChoice.loaded.length, 19, 'Bot choice must prime before the dropdown changes');
const ready = rouletteEnvironment();
ready.context.RouletteAudio.preload('roulette');
assert.equal(ready.loaded.length, 19, 'Restored Ready game did not preload its audio');
assert.equal(ready.context.RouletteAudio.diagnostics().unlocked, false,
  'Preloading outside a gesture must not consume mobile unlock');
ready.page.boardVisible = true;
ready.fire('pointerup');
assert.equal(ready.context.RouletteAudio.diagnostics().unlocked, true,
  'Restored visible Roulette board must unlock even if the setup dropdown is stale');
ready.context.RouletteAudio.hammer();
ready.context.RouletteAudio.blank();
ready.context.RouletteAudio.gunshot();
assert(ready.played.some(src => src.includes('hammer-cocking')), 'Hammer cue stopped playing');
assert(ready.played.some(src => src.includes('dry-fire')), 'Blank cue stopped playing');
assert(ready.played.some(src => src.includes('single-pistol')), 'Gunshot cue stopped playing');
const reactionTimersBefore = ready.timeouts.size;
assert.equal(ready.context.rouletteShotSequence(
  { mode: 'roulette', gameId: 'test-roulette', revision: 8 },
  { lastOutcome: 'live', shotsFired: 4 }, 'test-roulette'
), 'original-shot', 'Reaction wrapper must preserve the original shot return');
const reactionTimer = [...ready.timeouts.values()].find(timer => timer.delay === 720);
assert(reactionTimer && ready.timeouts.size > reactionTimersBefore, 'Fatal-shot reaction was not scheduled');
reactionTimer.callback();
for (let tick = 0; tick < 10; tick += 1) await Promise.resolve();
assert(ready.played.some(src => src.startsWith('data:audio/mpeg;base64,')), 'The actual chair-fall reaction did not play');

console.log(`Site asset loading validated: ${imagePaths.length} Summit images (${deferredBytes.toLocaleString()} bytes) and Draw music load only for their game; URL/selection/restored Ready, duplicate guards, scoped Roulette/reaction/result audio, mobile unlock, and shot cues passed.`);
