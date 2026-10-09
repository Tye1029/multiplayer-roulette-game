const BASE = '/assets/roulette/audio/';
const FILES = {
  wood: 'revolver-spinning-on-wood-v4.mp3',
  spin: 'freesound_community-revolver-chamber-spin-ratchet-sound-90521.mp3',
  hammer: 'freesound_community-pistol-hammer-cocking-back-4-39887.mp3',
  dry: 'freesound_community-gun-dry-firing-3-39820.mp3',
  live: 'freesound_community-single-pistol-gunshot-33-37187.mp3'
};
export function createTableAudio(trace) {
  let ctx, loading, muted = false, epoch = 0;
  const buffers = new Map(), active = new Set();
  async function unlock() {
    try {
      ctx ||= new (window.AudioContext || window.webkitAudioContext)();
      await ctx.resume();
      loading ||= Promise.all(Object.entries(FILES).map(async ([key, file]) => {
        try {
          const response = await fetch(BASE + file, { signal: AbortSignal.timeout(6000) });
          if (!response.ok) throw Error('Audio request failed');
          const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
          const samples = buffer.getChannelData(0); let first = 0;
          while (first < samples.length && Math.abs(samples[first]) < .012) first++;
          buffers.set(key, { buffer, offset: Math.max(0, first / buffer.sampleRate - .006) });
        } catch { trace('audio-unavailable', { sound: key }); }
      }));
      await loading;
    } catch { trace('audio-unavailable', { sound: 'context' }); }
  }
  function stop() { epoch++; for (const source of active) { try { source.stop(); } catch {} } active.clear(); }
  function play(key, { duration = 500, delay = 0, volume = .3, loop = false } = {}) {
    if (muted || document.hidden || ctx?.state !== 'running') return;
    const item = buffers.get(key); if (!item) { trace('audio-not-ready', { sound: key }); return; }
    const source = ctx.createBufferSource(), gain = ctx.createGain(), at = ctx.currentTime + delay / 1000;
    const length = Math.min(duration / 1000, loop ? Infinity : item.buffer.duration - item.offset);
    source.buffer = item.buffer; source.loop = loop;
    if (key === 'wood' && duration > 1000) {
      source.playbackRate.setValueAtTime(1.1, at);
      source.playbackRate.linearRampToValueAtTime(.6, at + length);
    }
    source.connect(gain); gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(volume, at + .008);
    gain.gain.setValueAtTime(volume, at + Math.max(.01, length - .09)); gain.gain.linearRampToValueAtTime(0, at + length);
    source.start(at, item.offset); source.stop(at + length + .01); active.add(source);
    source.onended = () => { active.delete(source); source.disconnect(); gain.disconnect(); };
    trace('audio-cue', { sound: key, delayMs: delay, durationMs: Math.round(length * 1000) });
  }
  function tone(live, delay = 255) {
    if (muted || document.hidden || ctx?.state !== 'running') return;
    const source = ctx.createOscillator(), gain = ctx.createGain(), at = ctx.currentTime + delay / 1000;
    source.type = 'sawtooth'; source.frequency.setValueAtTime(live ? 1100 : 250, at);
    source.frequency.exponentialRampToValueAtTime(live ? 70 : 110, at + .25);
    gain.gain.setValueAtTime(.055, at); gain.gain.exponentialRampToValueAtTime(.001, at + .28);
    source.connect(gain); gain.connect(ctx.destination); source.start(at); source.stop(at + .3);
    active.add(source); source.onended = () => { active.delete(source); source.disconnect(); gain.disconnect(); };
    trace('audio-cue', { sound: live ? 'laser-fire' : 'laser-dry', delayMs: delay });
  }
  return { unlock, stop, play, tone, mute(value) { muted = value; if (value) stop(); },
    status: () => ({ state: ctx?.state || 'uninitialized', loaded: [...buffers.keys()], active: active.size, muted, epoch }) };
}
