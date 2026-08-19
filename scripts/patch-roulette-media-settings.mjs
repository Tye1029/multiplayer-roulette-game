import { readFile, writeFile } from 'node:fs/promises';

const audioUrl = new URL('../assets/roulette/audio-manager.js', import.meta.url);
let audio = await readFile(audioUrl, 'utf8');

function replaceOnce(label, before, after) {
  if (audio.includes(after)) return;
  const first = audio.indexOf(before);
  if (first < 0) throw new Error(`Roulette media patch could not find ${label}.`);
  if (audio.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Roulette media patch found more than one ${label}.`);
  }
  audio = audio.slice(0, first) + after + audio.slice(first + before.length);
}

replaceOnce(
  'the ambience map insertion point',
  `  const templates = new Map();`,
  `  const LOOP_FILES = new Set(['room', 'hum', 'heartbeat', 'rumble']);
  const loopBuffers = new Map();
  let loopContext = null;

  function suppressBrowserMediaControls() {
    const mediaSession = global.navigator?.mediaSession;
    if (!mediaSession) return;
    try { mediaSession.metadata = null; } catch {}
    try { mediaSession.playbackState = 'none'; } catch {}
    for (const action of [
      'play', 'pause', 'stop', 'seekbackward', 'seekforward',
      'seekto', 'previoustrack', 'nexttrack', 'skipad'
    ]) {
      try { mediaSession.setActionHandler(action, null); } catch {}
    }
  }

  function getLoopContext() {
    if (loopContext && loopContext.state !== 'closed') return loopContext;
    const Context = global.AudioContext || global.webkitAudioContext;
    if (!Context) return null;
    loopContext = new Context({ latencyHint: 'playback' });
    return loopContext;
  }

  async function getLoopBuffer(name, context) {
    if (loopBuffers.has(name)) return loopBuffers.get(name);
    const pending = fetch(source(name), { cache: 'force-cache' })
      .then(response => {
        if (!response.ok) throw new Error(\`Loop audio failed: \${response.status}\`);
        return response.arrayBuffer();
      })
      .then(bytes => context.decodeAudioData(bytes.slice(0)));
    loopBuffers.set(name, pending);
    try {
      return await pending;
    } catch (error) {
      loopBuffers.delete(name);
      throw error;
    }
  }

  function createWebAudioLoop(name) {
    let volume = 0;
    let stopped = false;
    let started = false;
    let sourceNode = null;
    let gainNode = null;

    return {
      __rrWebAudioLoop: true,
      loop: true,
      playsInline: true,
      get volume() { return volume; },
      set volume(value) {
        volume = Math.max(0, Math.min(1, Number(value) || 0));
        if (gainNode && loopContext) {
          try {
            gainNode.gain.cancelScheduledValues(loopContext.currentTime);
            gainNode.gain.setValueAtTime(volume, loopContext.currentTime);
          } catch {}
        }
      },
      async play() {
        if (stopped || started) return;
        const context = getLoopContext();
        if (!context) throw new Error('Web Audio is unavailable for ambience.');
        suppressBrowserMediaControls();
        if (context.state === 'suspended') {
          try { await context.resume(); } catch {}
        }
        const buffer = await getLoopBuffer(name, context);
        if (stopped || started) return;
        sourceNode = context.createBufferSource();
        gainNode = context.createGain();
        sourceNode.buffer = buffer;
        sourceNode.loop = true;
        gainNode.gain.value = volume;
        sourceNode.connect(gainNode).connect(context.destination);
        sourceNode.start(0);
        started = true;
      },
      pause() {
        stopped = true;
        if (sourceNode) {
          try { sourceNode.stop(); } catch {}
          try { sourceNode.disconnect(); } catch {}
        }
        try { gainNode?.disconnect(); } catch {}
      },
      removeAttribute() {}
    };
  }

  global.RouletteSuppressMediaControls = suppressBrowserMediaControls;
  document.addEventListener('play', suppressBrowserMediaControls, true);

  const templates = new Map();`
);

replaceOnce(
  'the HTML media ambience loop',
  `  function startLoop(name) {
    if (!unlocked || !enabled || document.hidden || !FILES[name]) return;
    const existing = loops.get(name);
    if (existing) {
      fade(existing, loopTarget(name), 500);
      return;
    }
    const audio = template(name).cloneNode(true);
    audio.loop = true;
    audio.volume = 0;
    audio.playsInline = true;
    loops.set(name, audio);
    audio.play()
      .then(() => fade(audio, loopTarget(name), 1800))
      .catch(() => loops.delete(name));
  }`,
  `  function startLoop(name) {
    if (!unlocked || !enabled || document.hidden || !FILES[name]) return;
    const existing = loops.get(name);
    if (existing) {
      fade(existing, loopTarget(name), 500);
      return;
    }
    const audio = createWebAudioLoop(name);
    audio.volume = 0;
    loops.set(name, audio);
    audio.play()
      .then(() => {
        if (loops.get(name) === audio) fade(audio, loopTarget(name), 1800);
      })
      .catch(() => {
        if (loops.get(name) === audio) loops.delete(name);
      });
  }`
);

replaceOnce(
  'the ambience preload loop',
  `    for (const name of Object.keys(FILES)) template(name).load();`,
  `    for (const name of Object.keys(FILES)) {
      if (!LOOP_FILES.has(name)) template(name).load();
    }`
);

replaceOnce(
  'the media-safe unlock path',
  `  function unlock() {
    preferAmbientAudioSession();
    if (unlocked) return;`,
  `  function unlock() {
    preferAmbientAudioSession();
    suppressBrowserMediaControls();
    if (unlocked) {
      if (loopContext?.state === 'suspended') loopContext.resume?.().catch?.(() => {});
      return;
    }`
);

replaceOnce(
  'the initial media-session cleanup',
  `  preferAmbientAudioSession();
  silenceLegacyRouletteAudio();`,
  `  preferAmbientAudioSession();
  suppressBrowserMediaControls();
  silenceLegacyRouletteAudio();`
);

await writeFile(audioUrl, audio);
console.log('Moved persistent Roulette ambience to Web Audio and cleared browser media-session controls.');
