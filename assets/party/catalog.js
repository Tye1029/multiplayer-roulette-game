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
      tag: "RIPPLE FISHING",
      color: "#82d9ef",
      description: "Watch the ripples. Strike at the splash.",
      rules:
        "Watch your bobber. Ripples grow before the splash; press Reel while the gold ring appears. Early pulls scare the fish. Six bites, with rarer catches worth more points.",
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
  games.push(
    {
      id: "cascade",
      name: "Coin Cascade",
      tag: "COIN COLLECTION",
      color: "#ffd16d",
      description: "Chase the showers. Keep every coin.",
      rules:
        "Move between three conveyor lanes. Catch coins at the basket line and dodge crates. Gold bundles are worth three. Everyone keeps all the coins they collect.",
      unit: "coins",
      coinGame: true,
    },
    {
      id: "lantern",
      name: "Lantern Landing",
      tag: "REACTION + SURVIVAL",
      color: "#b9a7ff",
      description: "Read the lantern. Find a safe floating platform.",
      rules:
        "Choose the platform matching the lantern before the bell. Wrong platforms sink! Keep moving through eight changing patterns; three misses end your run.",
      unit: "points",
    },
    {
      id: "hop",
      name: "Tidal Hop",
      tag: "JUMP + TIMING",
      color: "#8bd9dc",
      description: "Jump the tide. Land a perfect rhythm.",
      rules:
        "Jump when the rolling wave reaches the gold line. The waves speed up. Precise jumps score more; three splashes end your run.",
      unit: "points",
    },
    {
      id: "dash",
      name: "Market Dash",
      tag: "DODGE + COMBOS",
      color: "#f2a17e",
      description: "Three lanes. A market full of surprises.",
      rules:
        "Move left or right to dodge rolling barrels. Jump low hurdles and duck under bunting at the gold line. Chain clean passes for combo points. Three collisions end your run.",
      unit: "points",
    },
    {
      id: "signal",
      name: "Festival Flash",
      tag: "REACTION + BLUFFS",
      color: "#edadd3",
      description: "Stay cool. Strike on the real signal.",
      rules:
        "Wait for GO, then tap the matching color as fast as you can. Ignore WAIT and the fake signals. A false start loses points. Eight signals decide the winner.",
      unit: "points",
    },
    {
      id: "treasure",
      name: "Treasure Tides",
      tag: "COIN COLLECTION",
      color: "#91d3ad",
      description: "Pick a route. Pocket the treasure.",
      rules:
        "Choose a beach lane before each tide. Read the preview: two-coin prizes, four-coin bundles, or crab traps. Everyone keeps their collected coins; traps stun you for the next wave.",
      unit: "coins",
      coinGame: true,
    },
  );
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
      description: "One use: add 3 spaces to your roll.",
    },
    {
      id: "shield",
      name: "Rain shield",
      cost: 4,
      description: "One use: block the next coin-loss space.",
    },
    {
      id: "double",
      name: "Double dice",
      cost: 7,
      description: "One use: roll two dice this turn.",
    },
    {
      id: "triple",
      name: "Triple dice",
      cost: 12,
      description: "One use: roll three dice this turn.",
    },
    {
      id: "custom",
      name: "Lucky dial",
      cost: 10,
      description: "One use: choose a roll from 1 to 6.",
    },
    {
      id: "swap",
      name: "Switcheroo postcard",
      cost: 8,
      description: "One use: swap board positions with a chosen rival.",
    },
    {
      id: "warp",
      name: "Trophy compass",
      cost: 18,
      description:
        "One use: travel to the current trophy stop. Buying its trophy still costs 10 coins.",
    },
  ];
  const additions = [
    {
      id: "ghost",
      name: "Boo",
      kind: "Sheet kid",
      color: "#fff6df",
      accent: "#8e79cc",
      bio: "Two eye holes. One very unconvincing ghost.",
    },
    {
      id: "skeleton",
      name: "Bones",
      kind: "Dapper skeleton",
      color: "#fff0cb",
      accent: "#393852",
      bio: "Dressed to impress. Rattling with confidence.",
    },
    {
      id: "knight",
      name: "Sir Rowan",
      kind: "Human knight",
      color: "#c6dce6",
      accent: "#348ea8",
      bio: "A brave heart and a slightly oversized helmet.",
    },
    {
      id: "princess",
      name: "Pippa",
      kind: "Princess",
      color: "#af7048",
      accent: "#df77ab",
      bio: "A crown, a competitive streak, and no royal shortcuts.",
    },
  ];
  characters.push(...additions);
  // 38 promenade spaces + three four-space branches. Each branch saves one step.
  const types = [
    "start",
    "coins",
    "loss",
    "gift",
    "shop",
    "coins",
    "junction",
    "coins",
    "loss",
    "duel",
    "trophy",
    "coins",
    "coins",
    "lucky",
    "loss",
    "chance",
    "coins",
    "shop",
    "junction",
    "coins",
    "gift",
    "loss",
    "trophy",
    "coins",
    "event",
    "coins",
    "loss",
    "lucky",
    "shop",
    "coins",
    "junction",
    "coins",
    "duel",
    "loss",
    "trophy",
    "gift",
    "chance",
    "coins",
  ];
  const spaces = types.map((type, i) => {
    const a = Math.PI * 0.73 + (i / types.length) * Math.PI * 2;
    return {
      id: i,
      type,
      x: Math.cos(a) * 19.5,
      z: Math.sin(a) * 14.5,
      y: 0.65,
      next: [(i + 1) % types.length],
      district:
        i < 13
          ? "Sunset promenade"
          : i < 26
            ? "Carnival gardens"
            : "Lighthouse quay",
    };
  });
  const branches = [
    {
      from: 6,
      to: 12,
      name: "Skybridge",
      types: ["coins", "shop", "trophy", "loss"],
      height: 1.5,
    },
    {
      from: 18,
      to: 24,
      name: "Festival lane",
      types: ["coins", "gift", "duel", "loss"],
      height: 0,
    },
    {
      from: 30,
      to: 36,
      name: "Tide gardens",
      types: ["coins", "shop", "lucky", "loss"],
      height: 0,
    },
  ];
  for (const branch of branches) {
    const a = spaces[branch.from],
      b = spaces[branch.to],
      first = spaces.length;
    a.next.push(first);
    branch.types.forEach((type, i) => {
      const t = (i + 1) / 5,
        inset = 1 - Math.sin(t * Math.PI) * 0.11;
      spaces.push({
        id: spaces.length,
        type,
        x: (a.x + (b.x - a.x) * t) * inset,
        z: (a.z + (b.z - a.z) * t) * inset,
        y: 0.65 + Math.sin(t * Math.PI) * branch.height,
        next: [i === 3 ? branch.to : first + i + 1],
        district: branch.name,
      });
    });
  }
  const spaceInfo = {
    chance: {
      name: "Chance parade",
      icon: "↔",
      color: "#fa9dcb",
      description:
        "The parade chooses two players and a coin or trophy exchange. Fortunes can turn!",
    },
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
      description:
        "Stop here even while passing. Meet Poppy and buy one single-use item, or leave.",
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
      description:
        "Pick any rival and stake match coins. In the last three turns, both players may battle for one trophy.",
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
    outerCount: types.length,
    trophyStops: spaces.filter((n) => n.type === "trophy").map((n) => n.id),
    branches,
    tideJunction: 30,
    turnOptions: [10, 20, 30],
    standings(players, mode = "party") {
      const score = (p) => (mode === "duel" ? p.wins : p.trophies);
      return Object.fromEntries(
        players.map((p) => [
          p.id,
          1 +
            players.filter(
              (q) =>
                score(q) > score(p) ||
                (score(q) === score(p) && q.total > p.total),
            ).length,
        ]),
      );
    },
    version: "BOARDWALK_CARNIVAL_V4",
  };
});
