import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const source = await readFile(new URL('assets/safe-cracker/safe-cracker.js', root), 'utf8');
const frames = new Map();
let id = 0;
const context = vm.createContext({
  runtime: {dragging: true}, document: {hidden: false}, Date, Math,
  window: {innerWidth: 390, innerHeight: 844, devicePixelRatio: 2,
    requestAnimationFrame(fn) {frames.set(++id, fn); return id;},
    cancelAnimationFrame(key) {frames.delete(key);}}
});
vm.runInContext(source.split('// SAFE_CRACKER_FRAME_TIMING_V24_START')[1].split('// SAFE_CRACKER_FRAME_TIMING_V24_END')[0], context);
const advance = time => {
  const callbacks = [...frames.values()]; frames.clear();
  callbacks.forEach(fn => fn(time));
};
assert.equal(frames.size, 0, 'Diagnostics must have no idle frame loop');
context.safeCrackerStartFrameProbe();
for (let i = 1; i <= 31; i++) advance(i * 1000 / 60);
context.safeCrackerStopFrameProbe();
assert.equal(frames.size, 0, 'Release must cancel the probe');
let sample = context.window.__safeCrackerFrameDiagnostics.at(-1);
assert.equal(sample.frames, 30);
assert.equal(sample.estimatedFps, 60);
assert.equal(sample.p95FrameMs, 16.7);
assert.equal(sample.viewport.width, 390);
context.safeCrackerStartFrameProbe();
for (let i = 1; i <= 20; i++) advance(i * 1000 / 20);
context.document.hidden = true;
advance(20000);
assert.equal(frames.size, 0, 'Hidden pages must stop without counting the hidden gap');
sample = context.window.__safeCrackerFrameDiagnostics.at(-1);
assert.equal(sample.estimatedFps, 20);
context.document.hidden = false;
for (let gesture = 0; gesture < 8; gesture++) {
  context.safeCrackerStartFrameProbe();
  for (let i = 1; i <= 260; i++) advance(i * 1000 / 60);
  assert.equal(frames.size, 0, 'A long gesture must stop at its bounded sample size');
}
assert.equal(context.window.__safeCrackerFrameDiagnostics.length, 6, 'Copied diagnostics must remain bounded');
assert.equal(context.window.__safeCrackerFrameDiagnostics.at(-1).frames, 240);
context.safeCrackerStartFrameProbe(); advance(1); context.safeCrackerStopFrameProbe();
assert.equal(context.window.__safeCrackerFrameDiagnostics.length, 6, 'Very short clicks must not replace useful measurements');

const template = await readFile(new URL('shared/site/index.template.html', root), 'utf8');
const reportContext = vm.createContext({Date, JSON, String, Array,
  selectedMode: 'safecracker', duelLastActiveGame: null, rouletteLatestGame: null,
  rnbDebugState: () => ({}), logs: [], botLogs: [], startupLogs: [],
  RNB_LOG_LIMIT: 100, RNB_STARTUP_LOG_LIMIT: 100, window: context.window});
vm.runInContext(template.match(/function debugSnapshot\(kind\)\{[^\n]+/)[0], reportContext);
const report = JSON.parse(reportContext.debugSnapshot('game'));
assert.equal(report.frameDiagnostics.length, 6, 'Reports must retain frame measurements after leaving the game');
assert.equal(report.frameDiagnostics.at(-1).estimatedFps, 60);
reportContext.selectedMode = 'fishing';
assert.equal(JSON.parse(reportContext.debugSnapshot('game')).frameDiagnostics, undefined, 'Safe diagnostics must stay scoped');

const png = await readFile(new URL('assets/safe-cracker/images/dial-reference-face.png', root));
assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
assert.equal(png.readUInt32BE(16), 640);
assert.equal(png.readUInt32BE(20), 640);
assert.equal((source.match(/images\/dial-reference-face\.png\?dial=24/g) || []).length, 2, 'Warm and mounted art must use the same bitmap');
assert.ok(source.includes("if (runtime.game?.status !== 'countdown') return;"), 'Dial mutations must not schedule countdown scans');
console.log('Safe frame timing passed: measured cadence, release/hidden cancellation, bounded samples, and decoded 640px dial bitmap.');
