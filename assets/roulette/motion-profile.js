(function (global) {
  'use strict';
  // Integral of 20*t*(1-t)^3: velocity rises smoothly, then friction brings
  // the gun to rest without reversing or changing speed at keyframe joins.
  function progress(value) {
    const t = Math.max(0, Math.min(1, Number(value) || 0));
    return 10*t*t - 20*t*t*t + 15*t*t*t*t - 4*t*t*t*t*t;
  }
  function openingFrames(from, target) {
    const delta = ((target - from) % 360 + 360) % 360;
    const travel = 1080 + delta;
    return Array.from({ length: 161 }, (_, index) => {
      const offset = index / 160;
      return { transform: `rotate(${from + travel * progress(offset)}deg)`, offset };
    });
  }
  global.RouletteMotion = Object.freeze({ openingDuration: 5300, turnDuration: 1020, progress, openingFrames });
})(window);
