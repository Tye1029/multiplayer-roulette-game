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
      name: "Mountain Climber",
      tag: "REFLEXES + COMBOS",
      color: "#ae9fff",
      description: "Follow the ledges. Race to the mountain summit.",
      rules:
        "Match the arrows shown on your next mountain ledges to climb 24 holds. New five-ledge milestones earn a bonus. Finish order earns separate point bonuses; first place always scores more than later finishers. Every six ledges is a checkpoint; mistakes break your combo and drop you toward it.",
      unit: "points",
    },
    {
      id: "putt",
      name: "Sunset Putt",
      tag: "PRECISION",
      color: "#a6e6b5",
      description: "Three courses. Banks, bumps and big shots.",
      rules:
        "Take turns on three courses. Each player has 30 seconds per course. Drag back from your ball and release to putt; longer drags hit harder. Keep shooting after your ball stops. Use ramps, banks, slopes, moving gates and the hippo shortcut; water costs a stroke. Hole out quickly with fewer shots for more points.",
      unit: "points",
    },
    {
      id: "fish",
      name: "Harbor Haul",
      tag: "RIPPLE FISHING",
      color: "#82d9ef",
      description: "Watch the ripples. Strike at the splash.",
      rules:
        "You have one minute. Watch the ripples by your bobber: larger rings mean larger fish. Reel at the splash. Reel when your bobber dips and the rings flash. An early tug lets you try again on the same bite. Each player keeps one fish. When everyone finishes, the measuring boards reveal whose fish is longest.",
      unit: "cm",
    },
    {
      id: "memory",
      name: "Afterglow",
      tag: "MEMORY + COMBOS",
      color: "#ffb5ca",
      description: "Own the dance floor. Then reverse the beat.",
      rules:
        "Watch the lights, then repeat them. Two special remix rounds ask you to repeat the pattern backwards for double points. The banner tells you when. Any mistake costs only 50 points and breaks your combo. Get ready before every new pattern.",
      unit: "points",
    },
  ];
  games.push(
    {
      id: "lantern",
      name: "Lantern Landing",
      tag: "REACTION + SURVIVAL",
      color: "#b9a7ff",
      description: "Read the host’s card. Find the safe harbor platform.",
      rules:
        "Jump to the final color on the host’s card before the bell. Sometimes the host briefly flashes a decoy, then switches it! The final card always gives you time to react. Other platforms drop and return; later colors shuffle. One wrong landing ends your run.",
      unit: "points",
    },
    {
      id: "hop",
      name: "Tidal Hop",
      tag: "JUMP + TIMING",
      color: "#8bd9dc",
      description: "Hop the driftwood. Find your beach rhythm.",
      rules:
        "Hop over driftwood washing up from the sea. Watch its size and speed and jump before it crosses your gold ring. Each clean jump earns 300 points. A bump makes you dizzy for 2.5 seconds. Three bumps end your run.",
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
  );
  games.push(
    ...(typeof module === "object" && module.exports
      ? require("./festival-catalog")
      : globalThis.PartyFestivalCatalog),
  );
  games.push(
    ...(typeof module === "object" && module.exports
      ? require("./expansion-catalog")
      : globalThis.PartyExpansionCatalog),
  );
  games.push(
    ...(typeof module === "object" && module.exports
      ? require("./midway-catalog")
      : globalThis.PartyMidwayCatalog),
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
      cost: 2,
      description:
        "One use: protect up to 3 coins at the next rain cloud. Costs 2 coins.",
    },
    {
      id: "double",
      name: "Double dice",
      cost: 7,
      description: "One use: roll two dice when used before a roll.",
    },
    {
      id: "triple",
      name: "Triple dice",
      cost: 12,
      description: "One use: roll three dice when used before a roll.",
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
      name: "Trophy taxi",
      cost: 25,
      description:
        "One use: fly straight to the trophy host, then choose whether to buy a trophy for 20 coins. Your dice roll is still available.",
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
  // 34 promenade + 4 skybridge + 4 tide garden + 8 central crossing spaces.
  const types = [
    "start",
    "coins",
    "loss",
    "coins",
    "shop",
    "junction",
    "coins",
    "loss",
    "duel",
    "coins",
    "trophy",
    "coins",
    "lucky",
    "loss",
    "chance",
    "shop",
    "coins",
    "junction",
    "gift",
    "loss",
    "coins",
    "coins",
    "trophy",
    "event",
    "loss",
    "lucky",
    "shop",
    "junction",
    "coins",
    "duel",
    "loss",
    "gift",
    "trophy",
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
        i < 12
          ? "Sunset promenade"
          : i < 24
            ? "Carnival gardens"
            : "Lighthouse quay",
    };
  });
  spaces[21].type = "ferry";
  spaces[26].type = "coins";
  spaces[25].type = "junction";
  spaces[27].type = "coins";
  const branches = [
    {
      from: 5,
      to: 11,
      name: "Skybridge",
      types: ["coins", "gift", "trophy", "loss"],
      height: 0,
    },
    {
      from: 25,
      to: 31,
      name: "Harbor loop",
      points: [
        [22, 8.8],
        [22, 21],
        [5, 21],
        [-2, 19],
      ],
      types: ["coins", "shop", "lucky", "loss"],
      height: 0,
    },
    {
      from: 17,
      to: 1,
      name: "Festival Crossing",
      types: [
        "coins",
        "loss",
        "gift",
        "chance",
        "coins",
        "duel",
        "loss",
        "coins",
      ],
      height: 0,
      central: true,
    },
  ];
  for (const branch of branches) {
    const a = spaces[branch.from],
      b = spaces[branch.to],
      first = spaces.length;
    a.next.push(first);
    branch.types.forEach((type, i) => {
      const t = (i + 1) / (branch.types.length + 1),
        inset = branch.central ? 1 : 1 - Math.sin(t * Math.PI) * 0.11;
      spaces.push({
        id: spaces.length,
        type,
        x: branch.points?.[i]?.[0] ?? (a.x + (b.x - a.x) * t) * inset,
        z: branch.points?.[i]?.[1] ?? (a.z + (b.z - a.z) * t) * inset,
        y: 0.65 + Math.sin(t * Math.PI) * branch.height,
        next: [i === branch.types.length - 1 ? branch.to : first + i + 1],
        district: branch.name,
      });
    });
  }
  const pathDistance = (x, z) =>
    Math.min(
      ...spaces.flatMap((a) =>
        a.next.map((id) => {
          const b = spaces[id],
            dx = b.x - a.x,
            dz = b.z - a.z,
            q = Math.max(
              0,
              Math.min(
                1,
                ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz),
              ),
            );
          return Math.hypot(x - a.x - q * dx, z - a.z - q * dz);
        }),
      ),
    );
  const scenery = [];
  for (const [kind, px, pz, radius] of [
    ["wheel", -7, -1, 3.3],
    ["tent", 7, 2, 3],
    ["pond", 0, 7, 2.3],
    ["lighthouse", 11, 3, 1.6],
    ["arcade", 0, -8, 2.7],
    ["snacks", -11, -4, 1.5],
    ["kites", 6, 8, 1.5],
    ["post", -5, 7, 1.3],
  ]) {
    const candidates = [];
    for (let x = -15; x <= 15; x += 0.5)
      for (let z = -11; z <= 11; z += 0.5)
        if (
          (x / 18) ** 2 + (z / 13) ** 2 < 0.94 &&
          pathDistance(x, z) > radius + 1.45 &&
          scenery.every(
            (p) => Math.hypot(p.x - x, p.z - z) > p.radius + radius + 0.3,
          )
        )
          candidates.push({ x, z, d: Math.hypot(px - x, pz - z) });
    candidates.sort((a, b) => a.d - b.d);
    if (candidates[0])
      scenery.push({ kind, radius, x: candidates[0].x, z: candidates[0].z });
  }
  const ferry = { from: 21, to: 5, cost: 4, duration: 3200 };
  const trophyPedestals = Object.fromEntries(
    spaces
      .filter((n) => n.type === "trophy")
      .map((n) => {
        const candidates = [];
        for (const radius of [2.6, 3, 3.5, 4])
          for (let k = 0; k < 24; k++) {
            const a = (k * Math.PI) / 12,
              x = n.x + Math.cos(a) * radius,
              z = n.z + Math.sin(a) * radius;
            if (
              pathDistance(x, z) > 1.55 &&
              scenery.every((p) => Math.hypot(p.x - x, p.z - z) > p.radius + 1)
            )
              candidates.push({
                x,
                z,
                y: n.y,
                d: radius - Math.hypot(x, z) * 0.01,
              });
          }
        candidates.sort((a, b) => a.d - b.d);
        return [
          n.id,
          candidates[0] || { x: n.x * 1.18, z: n.z * 1.18, y: n.y },
        ];
      }),
  );
  const spaceInfo = {
    ferry: {
      name: "Festival ferry",
      icon: "⚓",
      color: "#61c7ce",
      description:
        "Land here to choose a 4-coin ferry ride to the opposite shore. The ride ends your turn; your next roll starts there.",
    },
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
      description:
        "Get a random item. If your three pockets are full, choose one to replace or leave the gift.",
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
      description:
        "Stop at the glowing host and choose whether to buy a trophy for 20 coins, then finish your roll.",
    },
  };
  const golf =
    typeof module === "object" && module.exports
      ? require("../../shared/games/mini-golf-courses")
      : globalThis.PuttCourses;
  const holes = [
    golf.get("skybridge").holes[0],
    golf.get("harbor").holes[1],
    golf.get("fair").holes[0],
    golf.get("pebble").holes[1],
    golf.get("willow").holes[1],
    golf.get("dunes").holes[0],
    golf.get("tide").holes[1],
    golf.get("fair").holes[1],
    golf.get("clover").holes[2],
  ].map((h, i) =>
    (typeof module === "object" && module.exports
      ? require("./golf-shapes")
      : globalThis.PartyGolfShapes
    ).decorate(h, i),
  );
  const shops = {
    4: {
      name: "Dice & Dash",
      keeper: "Poppy",
      stock: ["double", "triple", "boost", "custom"],
    },
    15: {
      name: "Poppy’s Provisions",
      keeper: "Poppy",
      stock: ["shield", "swap", "boost"],
    },
    39: {
      name: "Golden Getaways",
      keeper: "Poppy",
      stock: ["warp", "custom", "triple", "shield"],
    },
  };
  function distanceTo(from, target) {
    const queue = [[from, 0]],
      seen = new Set();
    for (let i = 0; i < queue.length; i++) {
      const [id, steps] = queue[i];
      if (id === target) return steps;
      if (seen.has(id)) continue;
      seen.add(id);
      for (const next of spaces[id].next) queue.push([next, steps + 1]);
    }
    return Infinity;
  }
  // Preview every possible landing if another junction is reached during this roll.
  function routePreviews(state) {
    if (state.phase !== "choice" || !state.movement) return [];
    const origin = state.players[state.turn].position;
    const exits = (id) => spaces[id].next;
    return exits(origin).map((next, option) => {
      const paths = [];
      function walk(id, left, path) {
        if (paths.length >= 64 || path.length > 30) return;
        if (left <= 0 && !["shop", "trophy"].includes(spaces[id].type)) {
          paths.push(path);
          return;
        }
        for (const to of exits(id))
          walk(to, Math.max(1, left) - 1, [...path, to]);
      }
      walk(next, state.movement.remaining - 1, [origin, next]);
      return {
        next,
        option,
        trophyDistance: 1 + distanceTo(next, state.goal),
        paths,
        landings: [...new Set(paths.map((p) => p.at(-1)))],
      };
    });
  }
  return {
    characters,
    games,
    skins,
    items,
    shops,
    ferry,
    trophyPedestals,
    routePreviews,
    distanceTo,
    spaces,
    spaceInfo,
    holes,
    golfIndex: (putt) =>
      putt?.holes?.[Math.min(2, putt.course || 0)] ??
      Math.min(2, putt?.course || 0),
    hole: holes[0],
    outerCount: types.length,
    trophyStops: spaces.filter((n) => n.type === "trophy").map((n) => n.id),
    branches,
    scenery,
    pathDistance,
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
                (score(q) === score(p) &&
                  (q.total > p.total ||
                    (q.total === p.total &&
                      (q.tokens || 0) > (p.tokens || 0)))),
            ).length,
        ]),
      );
    },
    version: "BOARDWALK_CARNIVAL_V12",
  };
});
