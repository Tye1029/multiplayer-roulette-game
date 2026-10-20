/* Presentation clocks only. Scores, physics and accepted actions stay on the server. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PartyPresentation = api;
})(globalThis, () => {
  const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
  function clock() {
    let target = 0,
      offset = 0,
      previous = 0,
      last = 0,
      ready = false;
    return {
      sample(server, sent, received) {
        if (!Number.isFinite(server) || received - sent > 2000) return;
        const sample = server - (sent + received) / 2;
        target = ready ? target * 0.85 + sample * 0.15 : sample;
        if (!ready) offset = target;
        ready = true;
      },
      now(local) {
        const dt = previous ? Math.max(0, local - previous) : 0;
        previous = local;
        // Slew clock corrections instead of jumping ongoing animation curves.
        offset += clamp(target - offset, -dt * 0.04, dt * 0.04);
        return (last = Math.max(last, local + offset));
      },
      info: () => ({ offset, target }),
    };
  }
  function eventStart(cache, key, serverAt, stamp, catchup = 80) {
    if (!serverAt) return 0;
    const entry = cache[key];
    if (!entry || entry.serverAt !== serverAt)
      cache[key] = { serverAt, at: Math.max(serverAt, stamp - catchup) };
    return cache[key].at;
  }
  function shotFrame(shot, age) {
    const frames = shot.frames;
    const splash = shot.events?.find((e) => e.type === "splash" && age >= e.at);
    if (splash && age < shot.duration) {
      // A penalty returns the ball after it disappears under water. Never draw
      // a fictitious straight-line flight back across the course.
      const fade = age - splash.at,
        returnAge = age - (shot.duration - 180);
      return returnAge < 0
        ? [
            age,
            splash.x,
            splash.y,
            1 - clamp(fade / 240),
            -clamp(fade / 240) * 6,
          ]
        : [age, ...shot.position, clamp(returnAge / 180), 0];
    }
    if (age <= frames[0][0]) return [...frames[0]];
    if (age >= frames.at(-1)[0]) return [...frames.at(-1)];
    let j = 1;
    while (frames[j][0] < age) j++;
    const a = frames[j - 1],
      b = frames[j],
      q = (age - a[0]) / (b[0] - a[0]);
    return a.map((n, k) => n + (b[k] - n) * q);
  }
  function golfPlayback() {
    let key,
      cached,
      shotKey,
      started,
      release = 0;
    return {
      update(state, stamp) {
        if (!state?.game || state.game.id !== "putt") return state;
        const g = state.game,
          identity = state.id + ":" + g.start;
        if (identity !== key) {
          key = identity;
          cached = null;
          shotKey = "";
          release = 0;
        }
        const turnKey = g.putt.course + ":" + g.putt.turn;
        // Preserve the outgoing shot and celebration before switching golfers.
        if (cached && cached.turnKey !== turnKey && stamp < release)
          return cached.state;
        const i = g.putt.turn,
          v = g.progress[i],
          shot = v?.shot;
        let shown = state;
        if (shot && shot.course === g.putt.course) {
          const nextKey = turnKey + ":" + shot.at;
          if (nextKey !== shotKey) {
            shotKey = nextKey;
            started =
              !cached && shot.resolved
                ? shot.at
                : Math.max(shot.at, stamp - 70);
            release = started + shot.duration + (shot.holed ? 1300 : 180);
          }
          const progress = [...g.progress];
          progress[i] = {
            ...v,
            shot: { ...shot, at: started },
            holed: stamp >= started + shot.duration && shot.holed,
          };
          shown = {
            ...state,
            game: {
              ...g,
              progress,
              putt: {
                ...g.putt,
                holeEvent: shot.holed
                  ? {
                      player: i,
                      course: g.putt.course,
                      at: started + shot.duration,
                    }
                  : g.putt.holeEvent,
              },
            },
          };
        }
        cached = { turnKey, state: shown };
        return shown;
      },
      busy: (stamp) => stamp < release,
    };
  }
  return { clock, eventStart, shotFrame, golfPlayback };
});
