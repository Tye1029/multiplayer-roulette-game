/* Visible geometry and timing shared by the renderer and authoritative server. */
(function (root, factory) {
  const rules = factory();
  if (typeof module === "object" && module.exports) module.exports = rules;
  else root.PartyRules = rules;
})(globalThis, () => {
  const TAU = Math.PI * 2;
  const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
  const cannon = {
    radius: 6.8,
    bodyRadius: 0.58,
    shotRadius: 0.18,
    speed: 0.011,
    reload: 1800,
    life: 1800,
    muzzle: 1.32,
    turnSpeed: 0.00075,
    recoil: 260,
  };
  function cannonPosition(g, i) {
    const ids = g.active || g.progress.map((_, j) => j),
      a = (ids.indexOf(i) * TAU) / ids.length;
    return { x: Math.cos(a) * cannon.radius, z: Math.sin(a) * cannon.radius };
  }
  function cannonAngle(g, i, now) {
    const ids = g.active || g.progress.map((_, j) => j),
      v = g.progress[i];
    const tick = now - (v.fireAt ? clamp(now - v.fireAt, 0, cannon.recoil) : 0);
    return (
      ((tick - g.start - (v.aimPaused || 0)) * cannon.turnSpeed +
        (ids.indexOf(i) * TAU) / ids.length +
        Math.PI) %
      TAU
    );
  }
  function segmentHit(x, z, dx, dz, radius, span) {
    const a = dx * dx + dz * dz,
      b = 2 * (x * dx + z * dz),
      c = x * x + z * z - radius * radius;
    if (c <= 0) return 0;
    const disc = b * b - 4 * a * c;
    if (!a || disc < 0) return null;
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    return t >= 0 && t <= span ? t : null;
  }
  const archery = { flight: 420, radius: 0.9, cooldown: 900 };
  const arrowAim = (g, now) => Math.sin((now - g.start) / 1050) * 3.4;
  const arrowTarget = (g, now) => Math.sin((now - g.start) / 1700 + 0.8) * 2.8;
  function arrowScore(x, target) {
    const d = Math.abs(x - target);
    return d <= 0.22 ? 500 : d <= 0.52 ? 300 : d <= archery.radius ? 100 : 0;
  }
  function spotlight(g, now) {
    const elapsed = now - g.start,
      beats = g.beats || (g.cue ? [g.cue] : []);
    const b = beats.find((x) => elapsed <= x.at + x.window) || beats.at(-1);
    if (!b) return { color: "green", remaining: 0, index: 0 };
    const dt = elapsed - b.at;
    return {
      color: dt < -900 ? "green" : dt < 0 ? "amber" : "red",
      remaining: Math.max(
        0,
        dt < -900 ? -900 - dt : dt < 0 ? -dt : b.window - dt,
      ),
      index: b.index,
    };
  }
  const lanternPositions = [
    [-3.4, -3.4],
    [3.4, -3.4],
    [-3.4, 3.4],
    [3.4, 3.4],
  ];
  function lanternTile(beat) {
    return (beat.layout || [0, 1, 2, 3]).indexOf(beat.color);
  }
  return {
    memoryReady: 1200,
    memoryBeat: 650,
    memoryFlash: 460,
    fishSpecies: [
      "Sunlit perch",
      "Coral snapper",
      "Blue tang",
      "Silver trout",
      "Moon puffer",
      "Festival koi",
    ],
    clamp,
    cannon,
    cannonPosition,
    cannonAngle,
    segmentHit,
    archery,
    arrowAim,
    arrowTarget,
    arrowScore,
    spotlight,
    lanternPositions,
    lanternTile,
    bombFlight: 700,
    bombPause: 1200,
  };
});
