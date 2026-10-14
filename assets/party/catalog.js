/* Public board geometry; dice, scores and balances remain server-owned. */
(function (root, factory) {
  const data = factory();
  if (typeof module === "object" && module.exports) module.exports = data;
  else root.PartyCatalog = data;
})(globalThis, () => {
  const characters = [
    {
      id: "raccoon",
      name: "Riff",
      kind: "The music maker",
      color: "#a69bea",
      accent: "#1b9f9c",
      bio: "Headphones on. Game face on.",
    },
    {
      id: "fox",
      name: "Cleo",
      kind: "The daredevil",
      color: "#f89646",
      accent: "#c24590",
      bio: "Big scarf. Bigger shortcuts.",
    },
    {
      id: "frog",
      name: "Moss",
      kind: "The daydreamer",
      color: "#71c887",
      accent: "#f7bd43",
      bio: "Looks relaxed. Plays to win.",
    },
    {
      id: "robot",
      name: "Bolt",
      kind: "The bright spark",
      color: "#54c4d3",
      accent: "#ef8750",
      bio: "A little clumsy. All heart.",
    },
  ];
  const games = [
    {
      id: "climb",
      name: "Rooftop Rally",
      tag: "REFLEXES + COMBOS",
      color: "#ae9fff",
      description: "Find your rhythm. Fly over the rooftops.",
      rules:
        "Match the arrows to climb 24 ledges. Five correct moves in a row earn a bonus. Every six ledges is a checkpoint; mistakes break your combo and drop you toward it.",
      unit: "points",
    },
    {
      id: "putt",
      name: "Sunset Putt",
      tag: "PRECISION",
      color: "#a6e6b5",
      description: "Three courses. Banks, bumps and big shots.",
      rules:
        "Play one shot on each of three different courses. Set aim and power; bank off the walls. Each course adds up to 1,000 points. All three scores count.",
      unit: "points",
    },
    {
      id: "fish",
      name: "Harbor Haul",
      tag: "TIMING + RISK",
      color: "#82d9ef",
      description: "Hook it. Hold your nerve. Bring it home.",
      rules:
        "Pick a safe or deep-water cast. Hook in gold, then reel when tension reaches green. Deep-water fish score more but are harder to catch. Five casts; hooked fish escape after four seconds.",
      unit: "points",
    },
    {
      id: "memory",
      name: "Afterglow",
      tag: "MEMORY + COMBOS",
      color: "#ffb5ca",
      description: "Own the dance floor. Then reverse the beat.",
      rules:
        "Watch the lights, then repeat them. Build a combo for extra points. From five lights, alternate patterns must be repeated in reverse. A mistake costs 50 points and breaks your combo.",
      unit: "points",
    },
  ];
  const skins = [
    {
      id: "classic",
      name: "Originals",
      price: 0,
      color: "#fff",
      description: "The festival crew.",
    },
    {
      id: "sunset",
      name: "Sunset Club",
      price: 60,
      color: "#ffab79",
      description: "Golden-hour jackets.",
    },
    {
      id: "electric",
      name: "Electric Nights",
      price: 120,
      color: "#b49aff",
      description: "After-dark colors.",
    },
    {
      id: "champion",
      name: "Victory Lap",
      price: 240,
      color: "#ffe38d",
      description: "A little golden sparkle.",
    },
  ];
  const items = [
    {
      id: "boost",
      name: "Rocket skates",
      cost: 5,
      description: "Add 3 spaces to your next roll.",
    },
    {
      id: "magnet",
      name: "Coin magnet",
      cost: 5,
      description: "Collect 6 match coins immediately.",
    },
    {
      id: "shield",
      name: "Rain shield",
      cost: 4,
      description: "Block your next coin-loss space.",
    },
    {
      id: "double",
      name: "Double dice",
      cost: 7,
      description: "Roll two dice on this turn.",
    },
  ];
  const types = [
    "start",
    "coins",
    "coins",
    "loss",
    "shop",
    "lucky",
    "junction",
    "coins",
    "trophy",
    "gift",
    "duel",
    "loss",
    "coins",
    "event",
    "coins",
    "shop",
    "trophy",
    "loss",
    "gift",
    "coins",
    "duel",
    "lucky",
    "junction",
    "coins",
    "trophy",
    "loss",
    "event",
    "shop",
    "coins",
    "gift",
    "coins",
    "loss",
  ];
  const spaces = types.map((type, i) => {
    const a = Math.PI * 0.73 + (i / 32) * Math.PI * 2;
    return {
      id: i,
      type,
      x: Math.cos(a) * (12.8 + 1.1 * Math.sin(a * 3)),
      z: Math.sin(a) * (8.4 + 0.7 * Math.cos(a * 2)),
      y: 0.65,
      next: [(i + 1) % 32],
      district:
        i < 11
          ? "Sunset promenade"
          : i < 22
            ? "Carnival gardens"
            : "Lighthouse quay",
    };
  });
  const branch = (from, to, coords, name) => {
    const first = spaces.length;
    spaces[from].next.push(first);
    coords.forEach(([x, z, y, type], i) =>
      spaces.push({
        id: first + i,
        type,
        x,
        z,
        y,
        next: [i === coords.length - 1 ? to : first + i + 1],
        district: name,
      }),
    );
  };
  branch(
    6,
    14,
    [
      [-3, -3, 1.4, "coins"],
      [0, -2, 2.6, "loss"],
      [3, -1, 2.6, "trophy"],
      [6, -2, 1.4, "gift"],
    ],
    "Skybridge",
  );
  branch(
    22,
    30,
    [
      [4, 3, 0.65, "lucky"],
      [1, 3, 0.65, "duel"],
      [-2, 3, 0.65, "shop"],
      [-5, 3, 0.65, "event"],
    ],
    "Festival lane",
  );
  const spaceInfo = {
    start: {
      name: "Welcome plaza",
      icon: "★",
      color: "#ffc954",
      description: "Pass start for 4 coins.",
    },
    coins: {
      name: "Payday",
      icon: "+3",
      color: "#53c4ef",
      description: "Collect 3 coins.",
    },
    loss: {
      name: "Rain cloud",
      icon: "−3",
      color: "#f17c82",
      description: "Lose up to 3 coins. A shield protects you.",
    },
    shop: {
      name: "Item cart",
      icon: "▰",
      color: "#ffbd66",
      description: "Buy one tactical item with match coins.",
    },
    gift: {
      name: "Mystery parcel",
      icon: "✦",
      color: "#c69af2",
      description: "Get a random item, or 4 coins if your pockets are full.",
    },
    lucky: {
      name: "Lucky break",
      icon: "☘",
      color: "#7ed7a5",
      description: "Collect 5–9 coins, sometimes an item too.",
    },
    event: {
      name: "Festival surprise",
      icon: "!",
      color: "#b2a3f7",
      description: "Tide taxi, coin shower, or friendly coin collection.",
    },
    duel: {
      name: "Rival showdown",
      icon: "⚔",
      color: "#ed93c7",
      description: "Pick a rival. A short minigame awards the winner 8 coins.",
    },
    junction: {
      name: "Crossroads",
      icon: "↗",
      color: "#fbe099",
      description: "Choose a promenade or festival shortcut.",
    },
    trophy: {
      name: "Trophy stop",
      icon: "★",
      color: "#ffc954",
      description: "Pass the glowing stop with 10 coins to collect a trophy.",
    },
  };
  const holes = [
    {
      floor: [
        [100, 90],
        [620, 90],
        [620, 630],
        [100, 630],
      ],
      tee: [230, 545],
      cup: [500, 160],
      walls: [
        [
          [100, 340],
          [375, 340],
        ],
      ],
      bumpers: [{ x: 480, y: 385, r: 26 }],
      sand: [{ x: 405, y: 215, w: 175, h: 55 }],
    },
    {
      floor: [
        [100, 90],
        [620, 90],
        [620, 630],
        [100, 630],
      ],
      tee: [490, 550],
      cup: [220, 170],
      walls: [
        [
          [300, 250],
          [620, 250],
        ],
        [
          [100, 430],
          [350, 430],
        ],
      ],
      bumpers: [{ x: 445, y: 350, r: 30 }],
      sand: [{ x: 120, y: 280, w: 110, h: 90 }],
    },
    {
      floor: [
        [100, 90],
        [620, 90],
        [620, 630],
        [100, 630],
      ],
      tee: [180, 550],
      cup: [540, 140],
      walls: [
        [
          [300, 280],
          [300, 500],
        ],
        [
          [420, 90],
          [420, 230],
        ],
      ],
      bumpers: [
        { x: 465, y: 400, r: 32 },
        { x: 185, y: 240, r: 28 },
      ],
      sand: [{ x: 380, y: 500, w: 180, h: 45 }],
    },
  ];
  return {
    characters,
    games,
    skins,
    items,
    spaces,
    spaceInfo,
    holes,
    hole: holes[0],
    trophyStops: [8, 16, 24, 34],
    version: "BOARDWALK_FESTIVAL_V2",
  };
});
