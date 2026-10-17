/* JACKPOT_JUNCTION_V5 — layered reel audio, loaded only at this machine. */
(() => {
  'use strict';
  let context, sampleBytes, sampleBuffer, sampleLoop, audioGeneration=0;
  const motors = [], rollingBuffers = [], braking=[];
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
  function play(b, {volume = .15, loop = false, delay = 0, cutoff = 3500, pan = 0, attack = .008, offset = 0} = {}) {
    const source = context.createBufferSource(), gain = context.createGain(), filter = context.createBiquadFilter(), panner = context.createStereoPanner();
    source.buffer = b;
    source.loop = loop;
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const at = context.currentTime + delay;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(volume, at + attack);
    panner.pan.value = pan;
    source.connect(filter).connect(gain).connect(panner).connect(context.destination);
    const voice = {source, gain, filter};
    voices.add(voice);
    source.onended = () => { voices.delete(voice); source.disconnect(); gain.disconnect(); filter.disconnect(); panner.disconnect(); };
    source.start(at,offset);
    return voice;
  }
  function stopReel(index, immediate = false) {
    const voice = motors[index];
    if (!voice) return;
    motors[index] = null;
    const at = context.currentTime;
    voice.gain.gain.cancelScheduledValues(at);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, at);
    voice.gain.gain.linearRampToValueAtTime(0, at + (immediate ? .005 : .18));
    voice.source.stop(at + (immediate ? .01 : .2));
  }
  function stopMotor(immediate = false) { audioGeneration++; motors.forEach((_, index) => stopReel(index, immediate)); }
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
  // Fetch only on entering this machine. Decoding waits for a user gesture.
  function prepare() {
    sampleBytes ||= fetch('/assets/jackpot-junction/reel-mechanism.mp3?v=JACKPOT_JUNCTION_V5')
      .then(r => { if (!r.ok) throw new Error('Audio unavailable'); return r.arrayBuffer(); })
      .catch(() => { sampleBytes=null; return null; });
    return sampleBytes;
  }
  async function recordedReels(run) {
    try {
      const bytes=await prepare();
      if (!bytes || run!==audioGeneration || !allowed()) return;
      sampleBuffer ||= await context.decodeAudioData(bytes.slice(0));
      if (run!==audioGeneration || !allowed() || braking.some(Boolean)) return;
      // The steady mechanical section becomes a seamless drum loop. Overlap
      // the end and beginning by 25ms, avoiding a click at the loop boundary.
      if(!sampleLoop){
      const rate=sampleBuffer.sampleRate,start=Math.floor(.22*rate),size=Math.floor(.68*rate),fade=Math.floor(.025*rate);
      const loop=context.createBuffer(sampleBuffer.numberOfChannels,size-fade,rate);
      for(let ch=0;ch<loop.numberOfChannels;ch++){
        const input=sampleBuffer.getChannelData(ch),output=loop.getChannelData(ch);
        for(let n=0;n<output.length;n++)output[n]=input[start+n+fade];
        for(let n=0;n<fade;n++){const mix=n/fade;output[output.length-fade+n]=input[start+size-fade+n]*(1-mix)+input[start+n]*mix;}
      }
      sampleLoop=loop;
      }
      for(let i=0;i<3;i++){
        stopReel(i);
        const voice=play(sampleLoop,{loop:true,volume:.46,cutoff:6500,pan:(i-1)*.3,attack:.1,offset:i*.17});
        voice.source.playbackRate.value=.94+i*.06;motors[i]=voice;
      }
    } catch { /* The quiet fallback continues if the optional file cannot load. */ }
  }
  function start() {
    stopMotor(true);
    if (!engine()) return;
    pull();
    const run=audioGeneration;braking.fill(false);
    // A quiet immediate fallback covers slow/offline audio downloads. The
    // sampled mechanism replaces it as soon as decoding is complete.
    for (let i = 0; i < 3; i++) {
      const teeth = 22 + i * 2;
      rollingBuffers[i] ||= buffer(2, t => {
        const tooth = (t * teeth) % 1 / teeth;
        const click = Math.exp(-tooth * 170) * (Math.sin(tooth * 2 * Math.PI * 630) * .36 + Math.sin(tooth * 2 * Math.PI * 1370) * .16);
        const flutter = .7 + .3 * Math.cos(t * 2 * Math.PI * (7 + i));
        const grain = (Math.random() * 2 - 1) * (.12 + .3 * Math.exp(-tooth * 330));
        const bearing = Math.sin(t * 2 * Math.PI * (88 + i * 8)) * .09;
        return (click + grain) * flutter + bearing;
      });
      const voice = play(rollingBuffers[i], {loop: true, volume: .075, cutoff: 2200, pan: (i - 1) * .3, attack: .12});
      voice.source.playbackRate.setValueAtTime(.58, context.currentTime);
      voice.source.playbackRate.exponentialRampToValueAtTime(1, context.currentTime + .24);
      motors[i] = voice;
    }
    recordedReels(run);
  }
  function brake(index) {
    braking[index]=true;
    const voice = motors[index];
    if (!voice) return;
    const at = context.currentTime;
    voice.source.playbackRate.cancelScheduledValues(at);
    voice.source.playbackRate.setValueAtTime(voice.source.playbackRate.value, at);
    voice.source.playbackRate.exponentialRampToValueAtTime(.32, at + .56);
    voice.filter.frequency.setTargetAtTime(1500, at, .2);
    voice.gain.gain.setTargetAtTime(.11, at, .24);
  }
  function reel(index) {
    stopReel(index);
    if (!engine()) return;
    // The pawl clicks into place, then the drum gives a deeper cabinet clunk.
    play(buffer(.32, t => {
      const impact = Math.sin(t * 2 * Math.PI * (145 + index * 16)) * Math.exp(-t * 27) * .58;
      const metal = (Math.sin(t * 2 * Math.PI * 1120) + Math.sin(t * 2 * Math.PI * 1830) * .35) * Math.exp(-t * 85) * .16;
      const catchAt = Math.max(0, t - .035), catchNoise = t > .035 ? (Math.random() * 2 - 1) * Math.exp(-catchAt * 100) * .36 : 0;
      return impact + metal + catchNoise;
    }), {volume: .34, cutoff: 4200, pan: (index - 1) * .3, attack: .002});
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
  window.JackpotAudio = {prepare, start: safe(start), brake: safe(brake), reel: safe(reel), win: safe(win), stop: safe(stopMotor), silence, get spinning() { return motors.some(Boolean); }};
  window.addEventListener('xan-preferences', e => { if (e.detail.muted) silence(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) silence(); });
  window.addEventListener('pagehide', silence);
})();
