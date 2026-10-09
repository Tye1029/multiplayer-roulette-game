import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const read = async path => (await readFile(new URL('../' + path, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
const context = vm.createContext({}); context.window = context;
vm.runInContext(await read('assets/roulette/motion-profile.js'), context);
const motion = context.RouletteMotion;
assert.equal(motion.openingDuration, 5300, 'Opening must match the 5.30-second recording');
for (const target of [356, 176]) {
  const frames = motion.openingFrames(-4, target);
  const angle = frame => Number(frame.transform.match(/rotate\(([^d]+)deg\)/)[1]);
  assert.equal(angle(frames[0]), -4);
  assert.equal((angle(frames.at(-1)) % 360 + 360) % 360, target);
  const travel = angle(frames.at(-1)) - angle(frames[0]);
  assert(travel >= 1080 && travel <= 1260, 'Opening must make three full, uninterrupted revolutions');
  const speeds = frames.slice(1).map((frame, i) => (angle(frame) - angle(frames[i])) / ((frame.offset - frames[i].offset) * motion.openingDuration));
  assert(speeds.every(speed => speed >= 0), 'Opening reverses direction');
  const peak = speeds.indexOf(Math.max(...speeds));
  assert(peak > 0 && peak < speeds.length / 2, 'Opening should accelerate before slowing down');
  for (let i = peak + 1; i < speeds.length; i++) assert(speeds[i] <= speeds[i - 1] + 1e-8, 'Slowdown re-accelerates');
  assert(speeds[0] < Math.max(...speeds) * .05, 'Opening pops into full speed');
  assert(speeds.at(-1) < Math.max(...speeds) * .001, 'Opening stops abruptly');
}

// rAF timestamps can precede performance.now() in their registration callback.
// Run the production fades against a media element that rejects invalid volume.
for (const path of ['assets/roulette/audio-manager.js', 'assets/roulette/spin-audio-policy.js']) {
  const source = await read(path);
  const fade = source.match(/  function fade\([^]*?\n  }\n/)[0];
  for (const [start, end] of [[0, 1], [1, 0]]) {
    let volume = start; const frames = [];
    const media = { get volume() { return volume; }, set volume(value) {
      assert(value >= 0 && value <= 1 && Number.isFinite(value), path + ': invalid volume'); volume = value;
    } };
    const run = vm.runInNewContext('(' + fade + ')', {
      performance: { now: () => 1000 }, requestAnimationFrame: callback => frames.push(callback)
    });
    run(media, end, 100);
    for (const timestamp of [980, 1000, 1050, 1100]) frames.shift()?.(timestamp);
    assert.equal(volume, end);
  }
}

const html = await read('index.html');
assert(html.indexOf('/assets/roulette/motion-profile.js') < html.indexOf('/assets/roulette/turn-animation.js'));
const presentation = await read('games/multiplayer/roulette/presentation.js');
assert(!presentation.includes('rr-seat-chair') && !presentation.includes('rr-seated-body'), 'Removed figures still mount');
const lamp = await read('assets/roulette/lamp.js');
assert(!lamp.includes("'clip-path','polygon("), 'Hard triangular light returned');
const fire = await read('assets/roulette/turn-fire.js');
assert(!fire.includes('await rotateToLockedTurn('), 'Shot feedback must not bypass the facing guard');
const binding = (await read('assets/roulette/audio-bindings.js')).match(/const boundOpeningSequence = (async function \(game, state, gameId\) \{[^]*?\n    });/)[1];
const order = []; let playbackReady;
const startOpening = vm.runInNewContext('(' + binding + ')', {
  global: { RouletteTurnLock: { prepareMedia: async () => order.push('decoded') } },
  beginOpeningWoodSound: () => new Promise(resolve => { order.push('loading-audio'); playbackReady = resolve; }),
  silenceLegacy() {}, originalOpeningSequence: async () => order.push('animation-started')
});
const pendingOpening = startOpening({}, {}, 'fixture');
await new Promise(resolve => setImmediate(resolve));
assert.deepEqual(order, ['decoded', 'loading-audio'], 'Animation started before media playback');
playbackReady(true); await pendingOpening;
assert.deepEqual(order, ['decoded', 'loading-audio', 'animation-started']);
await import('./validate-opening-spin-sync.mjs');
console.log('Roulette motion passed: continuous three-turn opening, correct targets, progressive slowdown, bounded audio fades, single handoff owner, and diffuse lighting.');
