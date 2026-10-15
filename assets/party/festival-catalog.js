/* Original festival games. Public instructions and controls, never hidden outcomes. */
(function (root, factory) {
  const data = factory();
  if (typeof module === "object" && module.exports) module.exports = data;
  else root.PartyFestivalCatalog = data;
})(globalThis, () => {
  const directions = [
    ["left", "← Left"],
    ["right", "Right →"],
  ];
  const colors = [
    [0, "Blue"],
    [1, "Pink"],
    [2, "Mint"],
    [3, "Gold"],
  ];
  const definitions = [
    [
      "simon",
      "Captain's Orders",
      "LISTEN + RESIST",
      "The captain is trying to catch you out.",
      "Only obey commands that start with CAPTAIN SAYS. Ignore convincing fake orders, even when the captain demonstrates them. One answer per order; correct restraint also scores. Commands speed up.",
      [...directions, ["jump", "Jump"], ["duck", "Duck"]],
    ],
    [
      "confetti",
      "Confetti Roulette",
      "RISK + BANK",
      "Three party poppers. One big surprise.",
      "Pick a party popper: two add to your unbanked pot, one bursts and empties it. Bank instead to keep your pot safely, but miss that draw. The sparkling popper pays double. Hidden poppers are freshly mixed each draw; this is a luck game, with no coins staked.",
      [
        [0, "Popper 1"],
        [1, "Popper 2"],
        [2, "Popper 3"],
        ["bank", "Bank pot"],
      ],
    ],
    [
      "kart",
      "Boardwalk Boosters",
      "KART RACING",
      "Three lanes. Boosts with a wild side.",
      "Steer left or right across three lanes. Green boost pads increase speed for three gates; barrels slow you down. Boosting makes steering slower to recover, so plan ahead. The racer covering the most distance wins.",
      directions,
    ],
    [
      "bomb",
      "Bomb Toss",
      "PASS + SURVIVE",
      "A tiny ticking bomb. A very nervous circle.",
      "Toss the cartoon bomb left or right before its fuse burns out. The fuse keeps burning during flight. When it bursts into confetti, the holder loses a heart. Three hearts each; last survivor wins. Everyone gets the same pass cooldown.",
      [
        ["left", "Toss left"],
        ["right", "Toss right"],
      ],
    ],
    [
      "cannon",
      "Coconut Crossfire",
      "AIM + SURVIVE",
      "Four spinning cannons. One splashy showdown.",
      "Your cannon rotates automatically. Tap Fire when its sight points at a rival. Coconuts travel through the arena; colliding shots cancel each other. Three hits knock a player out. Each direct hit scores 250; the last survivor earns a clearly marked bonus. Firing has a 1.8 second reload.",
      [["fire", "Fire!"]],
    ],
    [
      "rope",
      "Skipping Sunset",
      "JUMP ROPE",
      "Keep your feet moving as the rope speeds up.",
      "Jump the low rope and duck the high rope at the gold timing line. The rope accelerates. One missed crossing knocks you out; the last player standing gets a survival bonus. Timing and crossings both count.",
      [
        ["jump", "Jump"],
        ["duck", "Duck"],
      ],
    ],
    [
      "stack",
      "Skyline Stackers",
      "BALANCE + PRECISION",
      "Build the skyline one wobbling block at a time.",
      "Drop the moving block over your tower. Only the overlap stays, so your landing area gets narrower. Centered landings score more. A complete miss ends your tower. Build as many accurate levels as you can before time runs out.",
      [["drop", "Drop block"]],
    ],
    [
      "orchard",
      "Orchard Express",
      "CATCH + SORT",
      "Catch the fruit, then fill the right basket.",
      "First choose the lane under the incoming fruit. When it reaches your basket, sort it by color using Blue, Pink, Mint or Gold. The catch locks before sorting; changing lanes too late cannot rescue a miss. Chain perfect deliveries for bonuses.",
      [["left", "← Catch"], ["right", "Catch →"], ...colors],
    ],
    [
      "maze",
      "Moonlight Maze",
      "ROUTE PLANNING",
      "A tiny maze with a moving destination.",
      "Move one tile at a time through the visible maze to the gold flag. Walls block movement. Reaching a flag moves it to another corner. Quick routes score more; every player receives the same maze. Follow the arrows on your own map.",
      [["up", "↑"], ...directions, ["down", "↓"]],
    ],
    [
      "balloon",
      "Balloon Business",
      "PRESSURE + TIMING",
      "Build a big balloon, then let it fly.",
      "Pump to grow your balloon, then Release to score its size. Air leaks slowly. Beyond the red line each pump may pop it and lose that balloon. Large balloons are worth more, but releasing safely keeps your points. Pumps have a short recovery time.",
      [
        ["pump", "Pump"],
        ["release", "Release"],
      ],
    ],
    [
      "spotlight",
      "Sneaky Spotlight",
      "MOVE + FREEZE",
      "Race to the stage without being spotted.",
      "Tap Run once to keep moving. Tap Freeze to stop before red; amber gives 0.9 seconds of warning. Red catches cost 60 metres and stop you for one second. Tap Run again when green returns. Reach the stage first for the largest finish bonus.",
      [
        ["run", "Run"],
        ["freeze", "Freeze"],
      ],
    ],
    [
      "rhythm",
      "Boardwalk Backbeat",
      "RHYTHM + REMIX",
      "A drum duel with the whole crew.",
      "Strike the shown drum when the note reaches the gold line. Blue means left, Pink means right; gold notes need both in quick succession. Chains add points, but extra hits break your combo. The second half introduces faster syncopated notes.",
      [
        ["left", "Left drum"],
        ["right", "Right drum"],
      ],
    ],
    [
      "boats",
      "Paddle Parade",
      "RHYTHM + STAMINA",
      "Race the current. Brace for the waves.",
      "Alternate left and right strokes to build speed. Repeating one side or paddling without stamina slows you down. Rest briefly to recover, and Brace when a wave reaches your bow. Distance wins; finish order earns different bonuses.",
      [
        ["left", "Left paddle"],
        ["right", "Right paddle"],
        ["brace", "Brace"],
      ],
    ],
    [
      "bakery",
      "Midnight Macarons",
      "RECIPES + MEMORY",
      "A delicious assembly line with surprise orders.",
      "Build the displayed three-color recipe in order, then Serve. Each completed order scores; wrong ingredients spoil that pastry and cost time. Orders briefly hide after the first few deliveries. Memorize before the card turns over.",
      [...colors, ["serve", "Serve"]],
    ],
    [
      "fencing",
      "Rock Paper Scissors",
      "1V1 · READ YOUR RIVAL",
      "Rock. Paper. Scissors. Read your rival.",
      "Rock beats Scissors, Scissors beats Paper, and Paper beats Rock. Choose once per countdown. Both choices stay secret until the reveal. A win scores 300, a tie scores 50. Most points after eight throws wins.",
      [
        ["rock", "Rock"],
        ["paper", "Paper"],
        ["scissors", "Scissors"],
      ],
      true,
    ],
    [
      "tug",
      "Tugboat Trouble",
      "1V1 · POWER + TIMING",
      "Haul your rival past the buoy.",
      "Pull near the gold pulse to move the shared rope toward you. Poor timing drains stamina; Rest recovers it. A three-pull rhythm builds power. Pull the buoy fully to your side to win, or finish with more successful pulls.",
      [
        ["pull", "Pull"],
        ["rest", "Rest"],
      ],
      true,
    ],
    [
      "ricochet",
      "Boardwalk Bullseyes",
      "1V1 · MOVING TARGETS",
      "Loose an arrow. Lead the moving bullseye.",
      "Your sight sweeps across a moving target. Shoot slightly ahead: arrows take 0.42 seconds to arrive. Gold scores 500, cream 300, pink 100; misses score zero. A new arrow is ready every 0.9 seconds.",
      [["fire", "Loose arrow"]],
      true,
    ],
    [
      "volley",
      "Beachside Volley",
      "1V1 · RETURN + PLACE",
      "Defend your lane, then send it somewhere clever.",
      "Choose a lane to cover the incoming ball before it lands. After the catch locks, choose a different lane to aim your return. Misses award your opponent a point. Ten rallies decide the duel.",
      [
        [0, "Left"],
        [1, "Middle"],
        [2, "Right"],
      ],
      true,
    ],
    [
      "draft",
      "Cookie Caper",
      "1V1 · BLUFF + DRAFT",
      "Two hungry rivals. Three tempting trays.",
      "Choose one of three trays each round. Different picks keep their displayed values; matching picks split that tray, rounded down. A golden tray grows if nobody takes it. Read your rival over eight hidden, simultaneous selections.",
      [
        [0, "Tray 1"],
        [1, "Tray 2"],
        [2, "Tray 3"],
      ],
      true,
    ],
    [
      "fuse",
      "Circuit Sprint",
      "1V1 · ROTATE + CONNECT",
      "Repair a toy rocket before your rival.",
      "Rotate the three colored circuit rings to line their arrows with the target arrows, then Launch. Each launch needs a fresh configuration. Wrong launches lose points and reset your streak. Six repaired rockets finish the race; earlier finishers earn more.",
      [
        [0, "Turn blue"],
        [1, "Turn pink"],
        [2, "Turn mint"],
        ["launch", "Launch"],
      ],
      true,
    ],
  ];
  return definitions.map(
    ([id, name, tag, description, rules, controls, duelOnly]) => ({
      id,
      name,
      tag,
      description,
      rules,
      controls,
      duelOnly: !!duelOnly,
      engine: "festival",
      unit: "points",
      color: duelOnly ? "#ffbf98" : "#a8dcd4",
    }),
  );
});
