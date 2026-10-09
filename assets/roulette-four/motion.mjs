// One source of truth for motion, audio and control handoff timing.
export const MOTION = Object.freeze({
  openingHold: 750,
  handoffHold: 60,
  hammer: 320,
  spin: 1350,
  spinHold: 50,
  shotHold: 550,
  results: 1500,
});
export function rotationPlan(current, target, opening = false) {
  const distance =
    ((((target - current) % 360) + 360) % 360) + (opening ? 1080 : 0);
  return {
    angle: current + distance,
    duration: opening
      ? Math.round((distance / 1080) * 4200)
      : distance
        ? 820 + (distance / 90 - 1) * 280
        : 0,
  };
}
