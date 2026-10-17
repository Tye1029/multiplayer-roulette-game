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
  const score = globalThis.PartySoundtrack;
  let theme = 0,
    bag = [];
  let bandActive = false,
    bandKey = "",
    scheduledNotes = new Set();
  function nextTheme() {
    if (!bag.length) {
      bag = [0, 1, 2, 3].filter((n) => n !== theme);
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    theme = bag.pop();
  }
  function init() {
    if (ctx) return;
    ctx = new AudioContext();
    fx = ctx.createGain();
    music = ctx.createGain();
    fx.gain.value = 0.22;
    music.gain.value = 0.065;
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
    const pitches = {
        raccoon: 310,
        fox: 380,
        frog: 225,
        robot: 260,
        ghost: 410,
        skeleton: 205,
        knight: 290,
        princess: 365,
      },
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
    if (["punch", "whack", "dig", "oven", "serve", "headpop"].includes(kind)) {
      if (kind === "punch") {
        noise(at, 0.055, 0.09, 600);
        note(145, at, 0.08, 0.12, fx, "triangle");
      }
      if (kind === "whack") {
        noise(at, 0.09, 0.12, 950);
        note(250, at, 0.1, 0.15, fx, "triangle");
      }
      if (kind === "dig") {
        noise(at, 0.12, 0.11, 1800);
        note(540, at, 0.07, 0.07, fx, "triangle");
      }
      if (kind === "oven") {
        note(380, at, 0.12, 0.07, fx);
        noise(at, 0.2, 0.03, 700);
      }
      if (kind === "serve")
        [660, 880, 1100].forEach((f, i) =>
          note(f, at + i * 0.07, 0.2, 0.1, fx),
        );
      if (kind === "headpop")
        [220, 330, 500, 740, 980].forEach((f, i) =>
          note(f, at + i * 0.045, 0.18, 0.14, fx, "triangle"),
        );
      return;
    }
    if (["yes", "aww", "haha", "yup"].includes(kind)) {
      voice(kind, character);
      return;
    }
    if (kind === "roll") {
      for (let i = 0; i < 11; i++)
        noise(at + i * 0.105, 0.045, 0.28 * (1 - i / 15), 1800 - i * 80);
      return;
    }
    if (
      ["cannon", "pop", "boost", "drum", "jump", "block", "paddle"].includes(
        kind,
      )
    ) {
      if (kind === "cannon") {
        noise(at, 0.18, 0.25, 700);
        note(120, at, 0.17, 0.22, fx, "triangle");
      }
      if (kind === "pop") {
        noise(at, 0.12, 0.19, 2400);
        note(420, at, 0.08, 0.13, fx);
      }
      if (kind === "boost") {
        [220, 330, 440, 660].forEach((f, i) =>
          note(f, at + i * 0.05, 0.13, 0.1, fx, "triangle"),
        );
      }
      if (kind === "drum") {
        noise(at, 0.08, 0.12, 950);
        note(180, at, 0.13, 0.2, fx, "sine");
      }
      if (kind === "jump") {
        note(330, at, 0.1, 0.12, fx);
        note(520, at + 0.06, 0.15, 0.1, fx);
      }
      if (kind === "block") {
        noise(at, 0.1, 0.18, 1100);
        note(270, at, 0.1, 0.1, fx);
      }
      if (kind === "paddle") noise(at, 0.18, 0.13, 1600);
      return;
    }
    if (kind === "crowd") {
      for (let i = 0; i < 18; i++) {
        noise(at + i * 0.055, 0.34, 0.025, 650 + i * 95);
        note(370 + (i % 5) * 65, at + i * 0.06, 0.25, 0.018, fx, "triangle");
      }
      return;
    }
    if (["bounce", "bat", "tool", "zap", "engine"].includes(kind)) {
      noise(at, 0.07, 0.13, kind === "zap" ? 3200 : 800);
      note(
        kind === "bounce" ? 170 : kind === "bat" ? 680 : 240,
        at,
        0.13,
        0.12,
        fx,
        "triangle",
      );
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
    if (
      !ctx ||
      !unlocked ||
      !enabled ||
      !musicOn ||
      bandActive ||
      document.hidden
    )
      return;
    const beat = 60 / score.bpm / 2;
    if (next < ctx.currentTime) next = ctx.currentTime + 0.08;
    while (next < ctx.currentTime + 0.5) {
      if (step % score.stepsPerTheme === 0) nextTheme();
      for (const [midi, len, volume, type] of score.notes(theme, step))
        note(440 * 2 ** ((midi - 69) / 12), next, len, volume, music, type);
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
        on && background ? 0.065 : 0,
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
  function band(state, stamp) {
    bandActive = state?.phase === "playing" && state.game?.id === "band";
    if (!bandActive || !ctx || !unlocked || !enabled || document.hidden) return;
    const g = state.game,
      key = g.start + ":" + g.song;
    if (key !== bandKey) {
      bandKey = key;
      scheduledNotes = new Set();
    }
    for (const n of g.notes || []) {
      const delay = (g.start + n.at - stamp) / 1000;
      if (delay < -0.08 || delay > 0.3 || scheduledNotes.has(n.index)) continue;
      scheduledNotes.add(n.index);
      const at = ctx.currentTime + Math.max(0, delay),
        freq = 440 * 2 ** ((n.midi - 69) / 12);
      // Three original melodies, four audible instruments, all locked to the chart.
      note(freq, at, 0.32, 0.12, fx, "triangle");
      note(freq / 2, at, 0.25, 0.07, fx, "sine");
      if (n.index % 2 === 0) note(freq * 1.5, at, 0.22, 0.035, fx, "triangle");
      noise(at, 0.055, 0.045, n.index % 4 === 0 ? 650 : 2200);
      if (n.index % 4 === 0) note(90, at, 0.18, 0.14, fx, "sine");
    }
  }
  globalThis.PartyAudio = { play, set, voice, band };
})();
