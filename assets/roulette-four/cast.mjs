// Cosmetic cast selection is independent of the chamber, payouts and bot strategy.
const classic = "/assets/roulette-four/images/tv-gamblers-v6.png";
const extra = "/assets/roulette-four/images/tv-gamblers-extra-v7.png";
export const CAST = [
  {
    id: "leather-smoker",
    art: classic,
    rows: 3,
    row: 0,
    col: 0,
    gender: "male",
    smoker: true,
    screen: [39.2, 6.3, 21.2, 15.3, 0],
    hand: [76, 41, 24, 11],
    foot: [29, 84, 19, 16],
    tip: [86.8, 43.5],
  },
  {
    id: "burgundy-smoker",
    art: classic,
    rows: 3,
    row: 0,
    col: 1,
    gender: "female",
    smoker: true,
    screen: [38.2, 6.3, 21.2, 15.3, 0],
    hand: [76, 41, 24, 11],
    foot: [39, 85, 18, 15],
    tip: [84.4, 42.8],
  },
  {
    id: "tracksuit",
    repair: [27, 10, 16, 24],
    art: classic,
    rows: 3,
    row: 1,
    col: 0,
    gender: "male",
    screen: [35.9, 6.3, 22.1, 15.5, 0],
    hand: [68, 43, 16, 14],
    foot: [40, 86, 16, 14],
  },
  {
    id: "black-knit",
    repair: [28, 10, 16, 24],
    art: classic,
    rows: 3,
    row: 1,
    col: 1,
    gender: "female",
    screen: [38, 6.3, 22.1, 15.5, 0],
    hand: [70, 44, 12, 13],
    foot: [40, 84, 19, 16],
  },
  {
    id: "plaid",
    art: classic,
    rows: 3,
    row: 2,
    col: 0,
    gender: "male",
    screen: [37.7, 6.9, 21.8, 15.5, 0],
    hand: [42, 51, 13, 14],
    foot: [22, 83, 19, 17],
  },
  {
    id: "hoodie",
    art: classic,
    rows: 3,
    row: 2,
    col: 1,
    gender: "female",
    screen: [38.2, 6.9, 21.8, 15.5, 0],
    hand: [43, 51, 13, 14],
    foot: [35, 83, 20, 17],
  },
  {
    id: "olive-bomber",
    art: extra,
    rows: 2,
    row: 0,
    col: 0,
    gender: "male",
    screen: [47.4, 6.8, 16.2, 12.3, -4],
    hand: [57, 44, 13, 13],
    foot: [42, 80, 17, 17],
  },
  {
    id: "denim",
    art: extra,
    rows: 2,
    row: 0,
    col: 1,
    gender: "female",
    screen: [44.3, 8, 14.5, 11.2, -2],
    hand: [30, 35, 11, 14],
    foot: [40, 82, 17, 15],
  },
  {
    id: "charcoal-suit",
    repair: [31, 15, 16, 24],
    art: extra,
    rows: 2,
    row: 1,
    col: 0,
    gender: "male",
    cut: 26,
    screen: [45.5, 7.9, 17.4, 12, -11],
    hand: [57, 46, 12, 16],
    foot: [26, 77, 22, 20],
  },
  {
    id: "olive-workshirt",
    art: extra,
    rows: 2,
    row: 1,
    col: 1,
    gender: "female",
    scratch: true,
    cut: 21,
    screen: [47.4, 6.1, 15, 11.2, 3],
    hand: [61, 33, 13, 9],
    foot: [36, 77, 16, 21],
  },
];
export function pickCast(rng = Math.random) {
  const smokers = CAST.filter((c) => c.smoker),
    smoker = smokers[Math.floor(rng() * smokers.length)];
  const rest = CAST.filter((c) => !c.smoker);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  const chosen = [smoker, ...rest.slice(0, 2)];
  for (let i = chosen.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [chosen[i], chosen[j]] = [chosen[j], chosen[i]];
  }
  return chosen;
}
export function castById(id) {
  return CAST.find((c) => c.id === id) || CAST[0];
}
export const TV_FINISHES = ["walnut", "charcoal", "olive"];
// Assign once at table creation; rematches reuse the roster unchanged.
export function assignCast(players, rng = Math.random) {
  const cast = pickCast(rng);
  let i = 0;
  return players.map((p) => {
    if (!p.isBot) return p;
    const c = cast[i++];
    return {
      ...p,
      character: c.id,
      gender: c.gender,
      tvFinish: TV_FINISHES[Math.floor(rng() * TV_FINISHES.length)],
    };
  });
}
