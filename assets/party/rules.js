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
  const hopRadius = (size) =>
    ({ small: 0.3, medium: 0.48, large: 0.68 })[size] || 0.48;
  const hopDuration = (size) =>
    ({ small: 600, medium: 820, large: 1040 })[size] || 820;
  function hopHeight(age, size) {
    const q = clamp(age / hopDuration(size));
    const peak = { small: 1.5, medium: 1.95, large: 2.4 }[size] || 1.95;
    return 4 * q * (1 - q) * peak;
  }
  function hopClear(beat, contactAt, jumpAt) {
    const reach = (hopRadius(beat.size) + 0.22) / (beat.speed || 0.009);
    return [contactAt - reach, contactAt + reach].every(
      (at) =>
        hopHeight(at - jumpAt, beat.size) >= hopRadius(beat.size) * 2 + 0.04,
    );
  }
  return {
    hopRadius,
    hopDuration,
    hopHeight,
    hopClear,
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
