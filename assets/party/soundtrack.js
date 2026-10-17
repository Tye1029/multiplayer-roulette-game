/* Original festival compositions. Sixteen-bar arrangements, four distinct themes. */
(function (root, factory) {
  const score = factory();
  if (typeof module === "object" && module.exports) module.exports = score;
  else root.PartySoundtrack = score;
})(globalThis, function () {
  const themes = [
    {
      name: "Promenade parade",
      key: 60,
      chords: [0, 5, 9, 7, 5, 0, 2, 7],
      motifs: [
        [7, 9, 12, -1, 9, 7, 4, -1],
        [5, -1, 9, 12, 14, -1, 12, 9],
        [9, 12, -1, 16, 14, 12, 9, -1],
        [7, -1, 11, 14, 12, 11, 7, -1],
      ],
    },
    {
      name: "Lantern waltz",
      key: 65,
      chords: [0, 9, 5, 7, 2, 5, 7, 0],
      motifs: [
        [12, -1, 7, 4, -1, 7, 9, -1],
        [9, -1, 12, -1, 16, 14, 12, -1],
        [5, 9, -1, 12, -1, 9, 5, -1],
        [7, 11, 14, -1, 12, -1, 7, -1],
      ],
    },
    {
      name: "Seaside shuffle",
      key: 62,
      chords: [0, 5, 0, 7, 9, 5, 2, 7],
      motifs: [
        [0, 4, -1, 7, 9, -1, 7, 4],
        [5, 9, 12, -1, 9, 5, -1, 9],
        [12, -1, 9, 7, 4, -1, 7, -1],
        [11, 7, -1, 14, -1, 12, 11, 7],
      ],
    },
    {
      name: "Moonlit carousel",
      key: 67,
      chords: [0, 2, 5, 7, 9, 5, 7, 0],
      motifs: [
        [4, -1, 7, -1, 12, 9, 7, -1],
        [2, 5, -1, 9, 12, -1, 9, -1],
        [5, -1, 9, 12, -1, 14, 12, 9],
        [14, 11, -1, 7, 12, -1, 7, -1],
      ],
    },
  ];
  function notes(theme, step) {
    const t = themes[theme % themes.length],
      bar = Math.floor(step / 8) % 16,
      beat = step % 8;
    const chord = t.chords[bar % 8],
      minor = [2, 9].includes(chord),
      root = t.key + chord - 12;
    const answer = bar >= 8,
      bridge = bar === 6 || bar === 14;
    const motif = t.motifs[bar % 4],
      value = motif[answer ? (beat + 4) % 8 : beat],
      events = [];
    if (value >= 0 && !(bridge && beat % 2))
      events.push([
        t.key + value + (answer && bar % 4 === 2 ? 12 : 0),
        bridge ? 0.5 : 0.32,
        0.2,
        theme % 2 ? "triangle" : "sine",
      ]);
    if (beat === 0 || beat === 4)
      events.push([root - 12 + (beat === 4 ? 7 : 0), 0.6, 0.26, "triangle"]);
    if ([2, 6].includes(beat) && bar % 4 !== 3)
      for (const interval of [minor ? 3 : 4, 7])
        events.push([root + interval, 0.21, 0.055, "sine"]);
    // Bell answers appear only at phrase endings; quieter bars leave breathing room.
    if (bar % 4 === 3 && beat === 6)
      events.push([t.key + 19 + (bar === 15 ? 0 : 7), 0.85, 0.085, "sine"]);
    return events;
  }
  return { themes, notes, stepsPerTheme: 128, bpm: 106 };
});
