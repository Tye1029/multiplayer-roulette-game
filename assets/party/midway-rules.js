(function (root, factory) {
  const value = factory();
  if (typeof module === "object" && module.exports) module.exports = value;
  else root.PartyMidwayRules = value;
})(globalThis, () => {
  const ores = [
    { name: "Copper", value: 25, color: "#d88860" },
    { name: "Silver", value: 55, color: "#d3e4ec" },
    { name: "Gold", value: 110, color: "#ffce58" },
    { name: "Ruby", value: 180, color: "#ee7998" },
    { name: "Sapphire", value: 300, color: "#78b9ef" },
  ];
  const shapes = ["Round", "Square", "Heart"],
    cheeses = ["Mozzarella", "Cheddar", "No cheese"],
    toppings = ["Pepperoni", "Mushroom", "Olive", "Pepper"];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function pizzaAccuracy(order, pizza) {
    const wanted = new Set(order.toppings),
      got = new Set(pizza.toppings),
      intersection = [...wanted].filter((x) => got.has(x)).length,
      union = new Set([...wanted, ...got]).size;
    return (
      (order.shape === pizza.shape ? 0.25 : 0) +
      (order.cheese === pizza.cheese ? 0.25 : 0) +
      0.5 * (union ? intersection / union : 1)
    );
  }
  function robotStage(g, now) {
    const age = now - g.start;
    return age < 15000
      ? { index: 0, fighting: age >= 0, end: g.start + 15000 }
      : g.robots.single
        ? { index: 0, fighting: false, end: g.start + 20000 }
        : age < 23000
          ? { index: 0, fighting: false, end: g.start + 23000 }
          : age < 38000
            ? { index: 1, fighting: true, end: g.start + 38000 }
            : { index: 1, fighting: false, end: g.start + 43000 };
  }
  const robotPairs = (g, index) =>
    index === 0 ? g.robots.pairs : g.robots.final ? [g.robots.final] : [];
  return {
    ores,
    shapes,
    cheeses,
    toppings,
    pizzaAccuracy,
    robotStage,
    robotPairs,
    clamp,
    mineWidth: 9,
    mineDepth: 15,
  };
});
