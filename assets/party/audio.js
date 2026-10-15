/* Original procedural festival score and mascot voices; no remote audio. */
(() => {
  let ctx,
    fx,
    music,
    timer,
    unlocked = false,
    enabled = true,
    musicOn = true,
    next = 0,
    step = 0;
  const scale = [0, 2, 4, 7, 9, 12, 14, 16],
    melody = [
      0, 2, 4, 2, 1, 3, 5, 3, 2, 4, 6, 4, 3, 2, 1, 4, 0, 2, 4, 7, 6, 4, 3, 1, 2,
      3, 5, 4, 2, 1, 0, 1,
    ];
  function init() {
    if (ctx) return;
    ctx = new AudioContext();
    fx = ctx.createGain();
    music = ctx.createGain();
    fx.gain.value = 0.22;
    music.gain.value = 0.075;
    fx.connect(ctx.destination);
    music.connect(ctx.destination);
  }
  function note(f, at, len, volume, bus, type = "sine") {
    const o = ctx.createOscillator(),
      g = ctx.createGain();
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(volume, at + 0.007);
    g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    o.connect(g).connect(bus);
    o.start(at);
    o.stop(at + len + 0.03);
  }
  function noise(at, len, vol, frequency = 1600) {
    const b = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate),
      d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++)
      d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = ctx.createBufferSource(),
      f = ctx.createBiquadFilter(),
      g = ctx.createGain();
    s.buffer = b;
    f.type = "lowpass";
    f.frequency.value = frequency;
    g.gain.value = vol;
    s.connect(f).connect(g).connect(fx);
    s.start(at);
  }
  function voice(word = "yup", character = "raccoon") {
    if (!ctx || !enabled) return;
    const pitches = { raccoon: 310, fox: 380, frog: 225, robot: 260 },
      base = pitches[character] || 310;
    const syllables =
      word === "haha"
        ? [
            [0.02, 0.15, 1, 800, 1250],
            [0.23, 0.18, 1.12, 800, 1250],
          ]
        : word === "aww"
          ? [[0, 0.52, 0.8, 650, 1050]]
          : word === "yes"
            ? [
                [0, 0.14, 1.05, 320, 2100],
                [0.13, 0.17, 1.2, 550, 1700],
              ]
            : [
                [0, 0.12, 0.85, 320, 1800],
                [0.1, 0.18, 1.2, 650, 1200],
              ];
    for (const [delay, len, pitch, f1, f2] of syllables) {
      const at = ctx.currentTime + delay,
        source = ctx.createOscillator(),
        gain = ctx.createGain();
      source.type = "sawtooth";
      source.frequency.setValueAtTime(base * pitch, at);
      source.frequency.exponentialRampToValueAtTime(
        base * (word === "aww" ? 0.55 : 1.05),
        at + len,
      );
      gain.gain.setValueAtTime(0.001, at);
      gain.gain.linearRampToValueAtTime(0.18, at + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, at + len);
      for (const hz of [f1, f2]) {
        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = hz;
        filter.Q.value = 7;
        source.connect(filter).connect(gain);
      }
      gain.connect(fx);
      source.start(at);
      source.stop(at + len + 0.02);
    }
    if (word === "yes") noise(ctx.currentTime + 0.28, 0.1, 0.04, 4500);
  }
  function play(kind = "tap", character) {
    if (!unlocked || !enabled || document.hidden) return;
    const at = ctx.currentTime;
    if (["yes", "aww", "haha", "yup"].includes(kind)) {
      voice(kind, character);
      return;
    }
    if (kind === "roll") {
      for (let i = 0; i < 11; i++)
        noise(at + i * 0.105, 0.045, 0.28 * (1 - i / 15), 1800 - i * 80);
      return;
    }
    if (kind === "step") {
      noise(at, 0.04, 0.12, 500);
      return;
    }
    if (kind === "splash") {
      noise(at, 0.3, 0.3, 1800);
      return;
    }
    const notes =
      kind === "win"
        ? [523, 659, 784, 1046]
        : kind === "coin"
          ? [1046, 1397]
          : kind === "error"
            ? [220, 165]
            : kind === "count"
              ? [660]
              : kind === "start"
                ? [523, 659, 1046]
                : [587, 784];
    notes.forEach((n, i) => note(n, at + i * 0.09, 0.24, 0.2, fx));
  }
  function schedule() {
    if (!ctx || !unlocked || !enabled || !musicOn || document.hidden) return;
    const beat = 60 / 106 / 2;
    while (next < ctx.currentTime + 0.5) {
      const bar = Math.floor(step / 8) % 4,
        root = [48, 53, 55, 48][bar],
        m = melody[step % melody.length],
        freq = (n) => 440 * 2 ** ((n - 69) / 12);
      note(freq(root + 12 + scale[m]), next, 0.3, 0.24, music, "sine");
      if (step % 4 === 0)
        note(freq(root - 12), next, 0.48, 0.32, music, "triangle");
      if (step % 2 === 0) {
        note(freq(root + 7), next, 0.18, 0.065, music, "triangle");
        note(freq(root + 4), next, 0.18, 0.065, music, "triangle");
      }
      step++;
      next += beat;
    }
  }
  function set(on, background = true) {
    enabled = on;
    musicOn = background;
    if (ctx) {
      fx.gain.setTargetAtTime(on ? 0.22 : 0, ctx.currentTime, 0.04);
      music.gain.setTargetAtTime(
        on && background ? 0.075 : 0,
        ctx.currentTime,
        0.2,
      );
      if (next < ctx.currentTime) next = ctx.currentTime + 0.08;
    }
  }
  async function unlock() {
    init();
    unlocked = true;
    await ctx.resume();
    if (!timer) timer = setInterval(schedule, 120);
    if (next < ctx.currentTime) next = ctx.currentTime + 0.08;
  }
  document.addEventListener("pointerdown", () => unlock().catch(() => {}));
  document.addEventListener("keydown", () => unlock().catch(() => {}));
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend();
    else {
      next = ctx.currentTime + 0.08;
      ctx.resume();
    }
  });
  globalThis.PartyAudio = { play, set, voice };
})();
