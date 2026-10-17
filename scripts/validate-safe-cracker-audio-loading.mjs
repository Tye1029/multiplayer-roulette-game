import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = (await readFile(new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
function section(start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  assert(from >= 0 && to > from, `Missing audio runtime section: ${start}`);
  return source.slice(from, to);
}
const audioCode = [
  section('  function audioContext()', '  function tierWeight('),
  section('  // SAFE_CRACKER_SAMPLE_MIX_V11_START', '  function safeCrackerPlaySample('),
  section("  window.addEventListener(STATE_EVENT, event => {\n    if (event?.detail?.game?.mode === 'safecracker') safeCrackerPrimeSamples", '  // SAFE_CRACKER_SAMPLE_MIX_V11_END'),
  section('  // SAFE_CRACKER_RECORDED_SOUNDS_V13_START', '  function safeCrackerPlayRecordedSound('),
  section('  function safeCrackerRecordedModeActive()', '  function safeCrackerStopRecordedAmbience()'),
  section('  function safeCrackerRecordedState(', '  // SAFE_CRACKER_RECORDED_SOUNDS_V13_END')
].join('\n');

function fixture(mode = 'roulette') {
  const requests = [], documentEvents = new Map(), windowEvents = new Map(), timers = [];
  const counts = { contexts: 0, resumes: 0, unlocks: 0, decodes: 0 };
  const modeControl = { value: mode };
  const screens = { simpleTestHome: { hidden: true }, duelScreen: { hidden: false } };
  const runtime = { game: null, audioContext: null };
  let mountedBoard = null;
  class AudioContext {
    constructor() { counts.contexts++; this.state = 'suspended'; this.sampleRate = 44100; this.destination = {}; }
    resume() { counts.resumes++; this.state = 'running'; return Promise.resolve(); }
    decodeAudioData() { counts.decodes++; return Promise.resolve({ duration: 1 }); }
    createBuffer() { return {}; }
    createBufferSource() { return { connect() {}, start() { counts.unlocks++; } }; }
  }
  const register = collection => (type, handler) => {
    const list = collection.get(type) || [];
    list.push(handler); collection.set(type, list);
  };
  const document = {
    hidden: false,
    getElementById: id => id === 'duelModeSelect' ? modeControl : screens[id] || null,
    querySelector: () => mountedBoard,
    addEventListener: register(documentEvents)
  };
  const window = {
    AudioContext,
    atob: value => Buffer.from(value, 'base64').toString('binary'),
    setTimeout: handler => timers.push(handler),
    addEventListener: register(windowEvents)
  };
  const navigator = { userActivation: { isActive: false } };
  const sandbox = vm.createContext({
    console, runtime, document, window, navigator, STATE_EVENT: 'safecracker:state',
    fetch: url => { requests.push(url); return Promise.resolve({ ok: true, text: async () => 'SUQz' }); },
    safeCrackerStartRecordedAmbience() {}, safeCrackerStopRecordedAmbience() {}
  });
  vm.runInContext(audioCode, sandbox);
  const emit = (events, type, event = {}) => {
    for (const listener of events.get(type) || []) listener(event);
  };
  const choice = (selectedMode, disabled = false) => ({ target: {
    closest: () => ({ disabled, dataset: { mode: selectedMode } })
  } });
  const settled = () => Promise.all([
    ...Object.values(runtime.safeCrackerSamplePromises || {}),
    ...Object.values(runtime.safeCrackerRecordedPromises || {})
  ]);
  return { requests, counts, modeControl, screens, runtime, window, document, navigator, sandbox,
    choice, settled, initialize: () => timers.forEach(handler => handler()),
    mountBoard: (hidden = false) => { mountedBoard = { closest: () => hidden ? {} : null }; },
    documentEvent: (type, event) => emit(documentEvents, type, event),
    state: game => emit(windowEvents, 'safecracker:state', { detail: { game } }) };
}

const home = fixture();
home.initialize();
home.documentEvent('visibilitychange');
home.documentEvent('pointerdown', { target: { closest: () => null } });
home.documentEvent('keydown', home.choice('fishing'));
home.documentEvent('pointerdown', home.choice('safecracker', true));
assert.equal(home.requests.length, 0, 'Launcher, other games and disabled choices must not fetch Safe Cracker audio');
assert.equal(home.counts.contexts, 0, 'Other pages must not allocate a Safe Cracker audio context');

// Pointer capture runs before the launcher changes the select to Safe Cracker.
home.documentEvent('pointerdown', home.choice('safecracker'));
assert(home.requests.some(url => url.includes('/audio-data/')), 'Safe selection must warm the sample bank');
assert(home.requests.some(url => url.includes('/audio-data-v2/')), 'Safe selection must warm the recorded bank');
assert.equal(home.counts.resumes, 1, 'Audio must unlock synchronously during the safe gesture');
assert.equal(home.counts.unlocks, 1, 'Android requires a silent buffer started in the gesture');
await home.settled();
const requestCount = home.requests.length;
home.modeControl.value = 'safecracker';
home.documentEvent('keydown', { target: { closest: () => null } });
await home.settled();
assert.equal(home.requests.length, requestCount, 'Repeated safe interaction must reuse decoded audio');
assert.equal(home.counts.contexts, 1, 'Sound banks must share one audio context');

for (const screen of ['launcher', 'account']) {
  const inactive = fixture('safecracker');
  inactive.screens.simpleTestHome.hidden = screen !== 'launcher';
  inactive.screens.duelScreen.hidden = true;
  inactive.runtime.game = { mode: 'safecracker', status: 'playing' };
  inactive.mountBoard();
  inactive.initialize();
  inactive.documentEvent('visibilitychange');
  inactive.documentEvent('keydown', { target: { closest: () => null } });
  assert.equal(inactive.requests.length, 0, `${screen}: stale safe selection must not download audio`);
  assert.equal(inactive.counts.contexts, 0, `${screen}: generic interaction must not allocate audio`);
  assert.equal(inactive.sandbox.safeCrackerRecordedModeActive(), false, `${screen}: old safe board must not start ambience`);
  inactive.documentEvent('pointerdown', inactive.choice('safecracker'));
  assert(inactive.requests.length > 0, `${screen}: explicit safe selection must still warm before its view appears`);
  await inactive.settled();
}

const selected = fixture('safecracker');
selected.initialize();
assert(selected.requests.length > 0, 'Already selected safe must preload before Ready');
assert.equal(selected.counts.resumes, 0, 'Background priming must not pretend to unlock browser audio');
await selected.settled();

const restored = fixture('fishing');
restored.screens.simpleTestHome.hidden = false;
restored.screens.duelScreen.hidden = true;
restored.state({ mode: 'safecracker', status: 'ready' });
assert(restored.requests.some(url => url.includes('/audio-data/')), 'A restored Safe Cracker game must preload samples immediately');
assert(restored.requests.some(url => url.includes('/audio-data-v2/')), 'A restored Safe Cracker game must preload recordings immediately');
await restored.settled();

const direct = fixture();
direct.screens.simpleTestHome.hidden = false;
direct.screens.duelScreen.hidden = true;
direct.window.safeCrackerWarmAudio();
assert(direct.requests.some(url => url.includes('/audio-data/')), 'Shared selection warmer must load samples before the safe board mounts');
assert(direct.requests.some(url => url.includes('/audio-data-v2/')), 'Shared selection warmer must load recordings before the safe board mounts');
await direct.settled();

const hidden = fixture('safecracker');
hidden.document.hidden = true;
hidden.window.safeCrackerWarmAudio();
hidden.documentEvent('pointerdown', hidden.choice('safecracker'));
assert.equal(hidden.requests.length, 0, 'A hidden document must not start audio downloads');
assert.equal(hidden.counts.contexts, 0, 'A hidden document must not allocate the audio context');

const ambience = fixture('safecracker');
ambience.runtime.game = { mode: 'safecracker', status: 'playing' };
ambience.mountBoard();
assert.equal(ambience.sandbox.safeCrackerRecordedModeActive(), true);
ambience.mountBoard(true);
assert.equal(ambience.sandbox.safeCrackerRecordedModeActive(), false, 'Hidden old boards must not start ambience');
ambience.mountBoard();
ambience.modeControl.value = 'fishing';
assert.equal(ambience.sandbox.safeCrackerRecordedModeActive(), false, 'Stale Safe game data must not start ambience in another game');

console.log(`Safe Cracker audio loading passed: ${requestCount} sound requests stay deferred outside Safe Cracker; selection/restoration preloads before Ready, gesture unlock and decoded-buffer reuse preserved.`);
