(function (root, factory) {
  const v = factory();
  if (typeof module === "object" && module.exports) module.exports = v;
  else root.PartyExpansionRules = v;
})(globalThis, () => {
  const songs = [
    {
      name: "Pier Lights",
      bpm: 104,
      root: 60,
      melody: [0, 4, 7, 9, 7, 4, 2, 4, 0, 7, 9, 12, 9, 7, 4, 2],
    },
    {
      name: "Sunshine Shuffle",
      bpm: 116,
      root: 62,
      melody: [0, 2, 4, 7, 4, 2, 9, 7, 4, 7, 12, 9, 7, 4, 2, 0],
    },
    {
      name: "Afterglow Parade",
      bpm: 96,
      root: 57,
      melody: [0, 3, 7, 10, 7, 5, 3, 2, 0, 7, 10, 12, 10, 7, 5, 3],
    },
  ];
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const holes = [
    [-3.6, -1.8, 1.5],
    [3.7, 2.1, 1.5],
  ];
  const hoop = (g, now) => Math.sin((now - g.start) / 1200) * 2.3;
  const ballFlight = 1050;
  const waveJump = (size) =>
    ({ small: 520, medium: 680, large: 860 })[size] || 680;
  const waveLead = (size) => waveJump(size) / 2;
  const mathRound = (g, now) =>
    Math.min(4, Math.max(0, Math.floor((now - g.start) / 13000)));
  const adjacent = (a, b) =>
    Math.abs((a % 3) - (b % 3)) +
      Math.abs(Math.floor(a / 3) - Math.floor(b / 3)) ===
    1;
  const solved = (tiles) => tiles.every((n, i) => n === (i + 1) % 9);
  return {
    songs,
    clamp,
    holes,
    hoop,
    ballFlight,
    waveJump,
    waveLead,
    mathRound,
    adjacent,
    solved,
  };
});
