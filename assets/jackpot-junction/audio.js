/* JACKPOT_JUNCTION_V2 — generated mechanical audio, loaded only at this machine. */
(() => {
  'use strict';
  let context, motor;
  const voices = new Set();
  const allowed = () => !document.hidden && !window.XanPreferences?.muted;
  function engine() {
    if (!allowed()) return null;
    try {
      context ||= new AudioContext();
      context.resume().catch(() => {});
      return context;
    } catch { return null; }
  }
  function buffer(seconds, sample) {
    const b = context.createBuffer(1, Math.ceil(context.sampleRate * seconds), context.sampleRate);
    const data = b.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = sample(i / context.sampleRate, i / data.length);
    return b;
  }
  function play(b, {volume = .15, loop = false, delay = 0, cutoff = 3500} = {}) {
    const source = context.createBufferSource(), gain = context.createGain(), filter = context.createBiquadFilter();
    source.buffer = b;
    source.loop = loop;
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const at = context.currentTime + delay;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(volume, at + .025);
    source.connect(filter).connect(gain).connect(context.destination);
    const voice = {source, gain, filter};
    voices.add(voice);
    source.onended = () => { voices.delete(voice); source.disconnect(); gain.disconnect(); filter.disconnect(); };
    source.start(at);
    return voice;
  }
  function stopMotor(immediate = false) {
    if (!motor) return;
    const voice = motor;
    motor = null;
    const at = context.currentTime;
    voice.gain.gain.cancelScheduledValues(at);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, at);
    voice.gain.gain.linearRampToValueAtTime(0, at + (immediate ? .005 : .18));
    voice.source.stop(at + (immediate ? .01 : .2));
  }
  function silence() {
    stopMotor(true);
    for (const voice of voices) {
      voice.gain.gain.cancelScheduledValues(context.currentTime);
      voice.gain.gain.value = 0;
      try { voice.source.stop(); } catch {}
    }
    voices.clear();
  }
  function pull() {
    if (!engine()) return;
    // A spring ratchet followed by a low latch clunk, rather than a UI beep.
    play(buffer(.28, t => {
      const ratchet = Math.exp(-((t * 44) % 1) * 15) * Math.exp(-t * 13);
      const latch = t > .14 ? Math.exp(-(t - .14) * 48) : 0;
      return (Math.random() * 2 - 1) * (.65 * ratchet + .45 * latch) + Math.sin(t * 2 * Math.PI * 165) * latch * .5;
    }), {volume: .24, cutoff: 2600});
  }
  function start() {
    stopMotor(true);
    if (!engine()) return;
    pull();
    // Integer periods keep the two-second loop seamless. Three ratchets simulate
    // separate reel gears, under a soft, textured motor whirr.
    motor = play(buffer(2, t => {
      const noise = Math.random() * 2 - 1;
      const gears = [27, 31, 35].reduce((v, hz) => v + Math.exp(-((t * hz) % 1) * 23), 0);
      const hum = Math.sin(t * Math.PI * 2 * 96) * .12 + Math.sin(t * Math.PI * 2 * 192) * .05;
      return noise * (.055 + gears * .23) + hum;
    }), {loop: true, volume: .22, cutoff: 2400});
  }
  function reel(index) {
    if (motor) {
      const at = context.currentTime;
      motor.source.playbackRate.setTargetAtTime(1 - (index + 1) * .17, at, .09);
      motor.gain.gain.setTargetAtTime(.22 - (index + 1) * .055, at, .07);
      if (index === 2) stopMotor();
    }
    if (!engine()) return;
    play(buffer(.22, t => (Math.random() * 2 - 1) * Math.exp(-t * 65) * .7 +
      (Math.sin(t * 2 * Math.PI * (215 - index * 24)) * .55 + Math.sin(t * 2 * Math.PI * 730) * .13) * Math.exp(-t * 33)),
    {volume: .27, cutoff: 3300});
  }
  function win(jackpot) {
    if (!engine()) return;
    // Bell/coin resonances with inharmonic overtones, softly staggered into a chord.
    const notes = jackpot ? [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568] : [783.99, 987.77, 1174.66];
    notes.forEach((hz, i) => play(buffer(1.4, t => {
      const strike = (Math.random() * 2 - 1) * Math.exp(-t * 180) * .24;
      return strike + [1, 2.76, 5.4].reduce((v, ratio, n) => v + Math.sin(t * 2 * Math.PI * hz * ratio) * Math.exp(-t * (5 + n * 4)) / (n * 3 + 2), 0);
    }), {volume: jackpot ? .12 : .10, delay: i * .095, cutoff: 7000}));
  }
  // Optional audio must never interrupt a saved spin or leave controls disabled.
  const safe = fn => (...args) => { try { fn(...args); } catch { silence(); } };
  window.JackpotAudio = {start: safe(start), reel: safe(reel), win: safe(win), stop: safe(stopMotor), silence, get spinning() { return Boolean(motor); }};
  window.addEventListener('xan-preferences', e => { if (e.detail.muted) silence(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) silence(); });
  window.addEventListener('pagehide', silence);
})();
