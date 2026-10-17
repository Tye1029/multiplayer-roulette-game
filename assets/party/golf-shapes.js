/* Party-only course contours. Legacy XAN DUELS courses and physics are unchanged. */
(function (root, factory) {
  const value = factory();
  if (typeof module === "object" && module.exports) module.exports = value;
  else root.PartyGolfShapes = value;
})(globalThis, () => {
  function oval(rect) {
    const bands = 32,
      step = rect.h / bands;
    return Array.from({ length: bands }, (_, i) => {
      const y = ((i + 0.5) / bands) * 2 - 1,
        half = (rect.w / 2) * Math.sqrt(1 - y * y);
      return {
        x: rect.x + rect.w / 2 - half,
        y: rect.y + i * step,
        w: half * 2,
        h: step + 0.001,
      };
    });
  }
  function decorate(source, index) {
    const h = structuredClone(source),
      r = 42 + index * 13;
    h.floor = [];
    for (const [x, y, start] of [
      [650 - r, 70 + r, -Math.PI / 2],
      [650 - r, 650 - r, 0],
      [70 + r, 650 - r, Math.PI / 2],
      [70 + r, 70 + r, Math.PI],
    ])
      for (let n = 0; n <= 8; n++) {
        const a = start + (n * Math.PI) / 16;
        h.floor.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
      }
    h.visualWater = h.water || [];
    h.water = h.visualWater.flatMap(oval);
    h.visualSand = h.sand || [];
    h.sand = h.visualSand.flatMap(oval);
    return h;
  }
  return { decorate, oval };
});
