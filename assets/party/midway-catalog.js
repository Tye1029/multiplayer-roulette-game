(function (root, factory) {
  const value = factory();
  if (typeof module === "object" && module.exports) module.exports = value;
  else root.PartyMidwayCatalog = value;
})(globalThis, () =>
  [
    {
      id: "pizza",
      name: "Pier Pizza",
      tag: "BUILD · BAKE · SERVE",
      color: "#efa184",
      description: "A busy little pizzeria. Every order counts.",
      rules:
        "Read your customer's ticket. Choose round, square or heart dough, the requested cheese, and toppings. Bake for five seconds, then carry it to the customer with Serve. Accuracy earns up to 300 points; a fast, accurate delivery adds up to 200. The oven must finish before serving. Build and bake as many orders as you can in 90 seconds.",
      duration: 90000,
      controls: [],
    },
    {
      id: "mine",
      name: "Pocket Prospectors",
      tag: "SHARED MINE · THREE-SLOT CARGO",
      color: "#cda56f",
      description: "Dig deeper, or cash in before the others?",
      rules:
        "Everyone digs the same mine. Tap an adjacent tile or use arrows/WASD to move and dig. Carry at most three minerals. Return to the surface and press Sell to bank points. Copper is worth 25, silver 55, gold 110, ruby 180 and sapphire 300. Deeper rock takes more hits. Minerals go to the first miner to finish digging them; unsold cargo earns nothing when 90 seconds ends. You can pass other miners.",
      duration: 90000,
      controls: [
        ["up", "Up"],
        ["left", "Left"],
        ["down", "Down"],
        ["right", "Right"],
        ["sell", "Sell cargo"],
      ],
    },
    {
      id: "moles",
      name: "Mole Mischief",
      tag: "WHACK · WATCH OUT",
      color: "#9cbe86",
      description: "Brown noses, quick paws. Leave the visitors alone.",
      rules:
        "Tap the brown mole as it pops out of a hole. A hit earns 100 points plus a streak bonus. Ducks and flowers are friendly visitors: hitting one stuns you for 2.5 seconds and breaks your streak. Each visitor can be hit only once. Everyone sees the same sequence for 45 seconds. On a keyboard, use 1–9 in reading order.",
      duration: 45000,
      controls: Array.from({ length: 9 }, (_, i) => [i, String(i + 1)]),
    },
    {
      id: "robots",
      name: "Rivet Rumble",
      tag: "TWO SEMIFINALS · ONE CHAMPION",
      color: "#99b9e1",
      description: "Tap for a flurry. Pop your rival's robot head!",
      rules:
        "Tap Punch or press and release Space as fast as you can for 15 seconds. Two duels run together. The robot with more punches wins and pops its opponent's head; tied totals go to whoever reached the total first, with an exact tie decided by a draw. After the celebration, both winners fight a 15-second final while the others watch. With two players it goes straight to the final; a three-player bracket includes one randomly assigned bye. The champion gets the most points.",
      duration: 43000,
      controls: [["punch", "Punch!"]],
    },
  ].map((g) => ({ ...g, engine: "midway", unit: "points" })),
);
