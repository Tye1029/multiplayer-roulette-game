import { readFile, writeFile } from 'node:fs/promises';

const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const stabilityStart = '// SAFE_CRACKER_RUNTIME_STABILITY_V12_START';
const stabilityEnd = '// SAFE_CRACKER_RUNTIME_STABILITY_V12_END';

let client = await readFile(clientUrl, 'utf8');
if (!client.includes('// SAFE_CRACKER_INPUT_CONTINUITY_V9_START')) {
  throw new Error('Safe Cracker runtime stability requires input continuity v9 first.');
}
if (!client.includes('// SAFE_CRACKER_SAMPLE_MIX_V11_START')) {
  throw new Error('Safe Cracker runtime stability requires sample mix v11 first.');
}

if (!client.includes(stabilityStart)) {
  const stabilityPass = String.raw`
  ${stabilityStart}
  const safeCrackerImmediateSampleLoad = safeCrackerLoadSample;
  safeCrackerLoadSample = function safeCrackerLoadSampleSerialized(name) {
    runtime.safeCrackerSampleBuffers ||= Object.create(null);
    runtime.safeCrackerSampleQueuePromises ||= Object.create(null);
    if (runtime.safeCrackerSampleBuffers[name]) return Promise.resolve(runtime.safeCrackerSampleBuffers[name]);
    if (!runtime.safeCrackerSampleGestureUnlocked) return Promise.resolve(null);
    if (runtime.safeCrackerSampleQueuePromises[name]) return runtime.safeCrackerSampleQueuePromises[name];
    const previous = runtime.safeCrackerSampleDecodeChain || Promise.resolve();
    const queued = previous
      .catch(() => null)
      .then(() => safeCrackerImmediateSampleLoad(name))
      .then(buffer => new Promise(resolve => window.setTimeout(() => resolve(buffer), 110)))
      .finally(() => { delete runtime.safeCrackerSampleQueuePromises[name]; });
    runtime.safeCrackerSampleQueuePromises[name] = queued;
    runtime.safeCrackerSampleDecodeChain = queued;
    return queued;
  };

  function safeCrackerUnlockSampleLoading() {
    if (runtime.safeCrackerSampleGestureUnlocked) return;
    runtime.safeCrackerSampleGestureUnlocked = true;
    const begin = () => safeCrackerPrimeSamples();
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(begin, { timeout: 900 });
    } else {
      window.setTimeout(begin, 140);
    }
  }

  document.addEventListener('pointerdown', safeCrackerUnlockSampleLoading, { capture: true, once: true });
  document.addEventListener('keydown', safeCrackerUnlockSampleLoading, { capture: true, once: true });

  function safeCrackerReleaseInterruptedDrag(reason, event = null) {
    if (!runtime.dragging) return false;
    const activePointer = runtime.pointerId;
    const releasedPointer = event?.pointerId;
    if (activePointer !== null && activePointer !== undefined && releasedPointer !== null && releasedPointer !== undefined && activePointer !== releasedPointer) {
      return false;
    }
    runtime.dragging = false;
    runtime.pointerId = null;
    runtime.safeCrackerDragStartedAt = 0;
    if ('lastDragDirection' in runtime) runtime.lastDragDirection = 0;
    document.querySelector('[data-sc-dial]')?.classList.remove('dragging');
    runtime.rotation = nearestRotationForDigit(runtime.selected, runtime.rotation);
    applyDialVisual();
    const pendingGame = runtime.pendingDragGame;
    runtime.pendingDragGame = null;
    if (pendingGame) {
      render(pendingGame);
    } else if (typeof safeCrackerUpdateConfirmControl === 'function') {
      safeCrackerUpdateConfirmControl();
    }
    runtime.safeCrackerLastDragReleaseReason = String(reason || 'unknown');
    return true;
  }

  function safeCrackerTrackDragStart(event) {
    if (!event.target?.closest?.('[data-sc-dial]')) return;
    runtime.safeCrackerDragStartedAt = performance.now();
  }

  document.addEventListener('pointerdown', safeCrackerTrackDragStart, true);
  window.addEventListener('pointerup', event => safeCrackerReleaseInterruptedDrag('global-pointerup', event));
  window.addEventListener('pointercancel', event => safeCrackerReleaseInterruptedDrag('global-pointercancel', event));
  document.addEventListener('lostpointercapture', event => safeCrackerReleaseInterruptedDrag('lost-pointer-capture', event));
  window.addEventListener('blur', () => safeCrackerReleaseInterruptedDrag('window-blur'));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) safeCrackerReleaseInterruptedDrag('document-hidden');
  });

  const safeCrackerStableTimer = updateTimerOnly;
  updateTimerOnly = function safeCrackerStableTimerWrapper() {
    const result = safeCrackerStableTimer();
    const dragAge = performance.now() - Number(runtime.safeCrackerDragStartedAt || 0);
    if (runtime.dragging && runtime.safeCrackerDragStartedAt && dragAge > 6000) {
      safeCrackerReleaseInterruptedDrag('drag-watchdog');
    }
    return result;
  };
  ${stabilityEnd}
`;

  const closing = '\n})();';
  const closingIndex = client.lastIndexOf(closing);
  if (closingIndex < 0) throw new Error('Safe Cracker runtime stability could not find the runtime closure.');
  client = client.slice(0, closingIndex) + stabilityPass + client.slice(closingIndex);
}

const requirements = [
  stabilityStart,
  'function safeCrackerLoadSampleSerialized(name)',
  'runtime.safeCrackerSampleGestureUnlocked',
  'runtime.safeCrackerSampleDecodeChain',
  'function safeCrackerUnlockSampleLoading()',
  'function safeCrackerReleaseInterruptedDrag(reason, event = null)',
  "window.addEventListener('pointerup'",
  "window.addEventListener('pointercancel'",
  "document.addEventListener('lostpointercapture'",
  "window.addEventListener('blur'",
  "safeCrackerReleaseInterruptedDrag('drag-watchdog')",
  'const pendingGame = runtime.pendingDragGame;'
];
for (const signature of requirements) {
  if (!client.includes(signature)) throw new Error(`Safe Cracker runtime stability is missing ${signature}.`);
}
if (!client.includes('choice: `safecracker:guess:${runtime.selected}`')) {
  throw new Error('Safe Cracker runtime stability disturbed authoritative guess submission.');
}
if (client.split(stabilityStart).length - 1 !== 1 || client.split(stabilityEnd).length - 1 !== 1) {
  throw new Error('Safe Cracker runtime stability marker must appear exactly once.');
}
await writeFile(clientUrl, client);

let html = await readFile(indexUrl, 'utf8');
if (!html.includes('&samples=1&stability=1')) {
  html = html.replaceAll('&audio=1&samples=1', '&audio=1&samples=1&stability=1');
}
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker runtime stability v12: sample decoding is gesture-gated and serialized, interrupted mobile drags recover, and queued snapshots cannot leave input stuck.');
