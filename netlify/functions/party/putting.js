"use strict";
const C = require("../../../assets/party/catalog"),
  P = require("../../../shared/games/mini-golf-physics");
function setup(g) {
  g.duration = g.active.length * 3 * 32500;
  g.end = g.start + g.duration;
  g.putt = { course: 0, slot: 0, turn: g.active[0], offset: 0 };
  for (const v of g.progress)
    Object.assign(v, {
      ball: [...C.holes[0].tee],
      strokes: 0,
      courseScores: [],
      shot: null,
      holed: false,
    });
}
function next(g, now) {
  const turn = g.putt,
    v = g.progress[turn.turn],
    hole = C.holes[turn.course];
  const distance = Math.hypot(v.ball[0] - hole.cup[0], v.ball[1] - hole.cup[1]);
  const points = v.holed
    ? Math.max(
        600,
        1400 -
          v.strokes * 100 +
          Math.floor(Math.max(0, g.start + turn.offset + 30000 - now) / 100),
      )
    : v.strokes
      ? Math.max(0, Math.round(500 - distance * 0.8))
      : 0;
  v.courseScores[turn.course] = points;
  g.scores[turn.turn] += points;
  v.popup = {
    at: now,
    value: points,
    label: (v.holed ? "HOLED! +" : "Course +") + points,
  };
  v.feedback = v.popup.label;
  turn.slot++;
  if (turn.slot === g.active.length) {
    turn.slot = 0;
    turn.course++;
  }
  if (turn.course >= 3) {
    for (const i of g.active) g.progress[i].finished = now;
    return;
  }
  turn.turn = g.active[turn.slot];
  turn.offset = now - g.start + 500;
  const n = g.progress[turn.turn];
  n.ball = [...C.holes[turn.course].tee];
  n.strokes = 0;
  n.shot = null;
  n.holed = false;
}
function advance(g, i, now) {
  const t = g.putt;
  if (!t || t.course >= 3 || i !== t.turn) return;
  const v = g.progress[i],
    deadline = g.start + t.offset + 30000;
  if (
    v.shot &&
    !v.shot.resolved &&
    now >= Math.min(v.shot.at + v.shot.duration, deadline)
  ) {
    const shot = v.shot;
    shot.resolved = true;
    if (shot.at + shot.duration <= deadline) {
      v.ball = [...shot.position];
      v.holed = shot.holed;
      if (shot.holed)
        g.putt.holeEvent = {
          player: i,
          course: t.course,
          at: shot.at + shot.duration,
        };
      if (shot.penalty) v.strokes += shot.penalty;
    } else {
      const frame =
        shot.frames.filter((f) => f[0] <= deadline - shot.at).at(-1) ||
        shot.frames[0];
      v.ball = [frame[1], frame[2]];
    }
  }
  if (
    (now >= deadline && !v.holed) ||
    (v.holed && now >= v.shot.at + v.shot.duration + 1600)
  )
    next(g, Math.min(now, deadline));
}
function play(g, i, b, now, fail) {
  const t = g.putt,
    v = g.progress[i];
  if (i !== t.turn || now < g.start + t.offset)
    fail("Wait for your turn on this course.");
  if (now >= g.start + t.offset + 30000) fail("Your course timer has ended.");
  if (v.shot && now < v.shot.at + v.shot.duration + 250)
    fail("Let your ball stop first.");
  if (v.holed) fail("Your ball is already in the cup.");
  if (
    !Number.isFinite(b.angle) ||
    Math.abs(b.angle) > Math.PI ||
    !Number.isFinite(b.power) ||
    b.power < 0.05 ||
    b.power > 1
  )
    fail("Drag back to aim and set power.", 400);
  const h = C.holes[t.course],
    shot = P.simulate(h, v.ball, b.angle, b.power, now);
  const remaining = g.start + t.offset + 30000 - now;
  if (shot.duration > remaining) {
    // The visible trajectory must stop where the turn timer stops accepting
    // movement. Do not show a later cup hit that the server cannot award.
    const frame = shot.frames.filter((f) => f[0] <= remaining).at(-1);
    shot.frames = shot.frames.filter((f) => f[0] <= remaining);
    shot.frames.push([remaining, ...frame.slice(1)]);
    shot.events = shot.events.filter(
      (e) => e.at <= remaining && e.type !== "cup",
    );
    shot.duration = remaining;
    shot.position = frame.slice(1, 3);
    shot.holed = false;
    shot.penalty = 0;
  }
  v.shot = { ...shot, at: now, course: t.course };
  v.strokes++;
  v.attempts = t.course;
  v.feedback = "Stroke " + v.strokes + " · watch your ball";
}
function bot(g, i, now) {
  if (i !== g.putt.turn) return null;
  const v = g.progress[i],
    h = C.holes[g.putt.course];
  if (
    (v.shot && now < v.shot.at + v.shot.duration + 350) ||
    now < g.start + g.putt.offset ||
    v.holed
  )
    return null;
  const dx = h.cup[0] - v.ball[0],
    dy = h.cup[1] - v.ball[1];
  return {
    value: "putt",
    angle: Math.atan2(dy, dx),
    power: Math.max(
      0.12,
      Math.min(0.92, Math.sqrt(Math.hypot(dx, dy) * 310) / 660),
    ),
  };
}
module.exports = { setup, advance, play, bot };
