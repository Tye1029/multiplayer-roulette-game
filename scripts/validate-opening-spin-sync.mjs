import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const frames = new Map(); let serial = 0;
const animation = { currentTime: 0, playbackRate: 1, playState: 'running', effect: { getTiming: () => ({ duration: 5300 }) } };
class AudioFixture {
  constructor(src) { this.src = src; this.duration = 5.3; this.currentTime = 0; this.playbackRate = 1; this.ended = false; this.events = new Map(); this.level = .16; }
  get volume() { return this.level; }
  set volume(value) { assert(Number.isFinite(value) && value >= 0 && value <= 1, 'Invalid media volume'); this.level = value; }
  addEventListener(name, callback) { if (!this.events.has(name)) this.events.set(name, []); this.events.get(name).push(callback); }
  emit(name) { for (const callback of this.events.get(name) || []) callback(); }
}
const context = vm.createContext({ Audio: AudioFixture, URL,
  document: { baseURI: 'https://fixture.invalid/', querySelectorAll: () => [{ querySelector: () => ({ getAnimations: () => [animation] }) }] },
  requestAnimationFrame: callback => { const id = ++serial; frames.set(id, callback); return id; },
  cancelAnimationFrame: id => frames.delete(id)
}); context.window = context;
vm.runInContext(await read('assets/roulette/opening-spin-sync.js'), context);
const clip = new context.Audio('/assets/roulette/audio/revolver-spinning-on-wood-v4.mp3');
clip.emit('loadedmetadata');
assert.equal(clip.playbackRate, 1);
animation.currentTime = 2650; clip.emit('loadedmetadata');
assert.equal(clip.currentTime, 2.65, 'Late audio must catch up to the visual clock');
assert.equal(clip.playbackRate, 1);
animation.currentTime = 0; clip.currentTime = 0; clip.emit('playing');
let previous = .16;
for (const progress of [0, .25, .64, .72, .82, .9, .94, .98, 1]) {
  animation.currentTime = progress * 5300;
  const [id, callback] = frames.entries().next().value; frames.delete(id); callback();
  assert(clip.volume <= previous + 1e-8, 'The slowdown envelope must not grow louder');
  if (progress <= .64) assert.equal(clip.volume, .16, 'Sound faded before the main spin finished');
  previous = clip.volume;
}
assert.equal(clip.volume, 0);
clip.ended = true; clip.emit('ended'); assert.equal(frames.size, 0, 'Finished audio retained an animation loop');
const html = await read('index.html');
const syncIndex = html.indexOf('/assets/roulette/opening-spin-sync.js');
const bindingsIndex = html.indexOf('<script src="/assets/roulette/audio-bindings.js');
assert(syncIndex >= 0 && bindingsIndex > syncIndex, 'Audio synchronization must load before bindings');
console.log('Opening audio passed: exact animation duration, late-load synchronization, continuous bounded slowdown envelope, and cleanup.');
