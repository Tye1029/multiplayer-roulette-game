'use strict';

// Puzzle state is private. Only publicView is sent to a player.
const {heads} = require('../../../assets/safe-cracker/heist-catalog');
const shapes = Object.keys(heads);
const colors = ['red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'cyan', 'white', 'brown', 'lime', 'gray'];
const shuffle = (values, random = Math.random) => {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};
function create(random = Math.random) {
  const kit = shuffle(shapes, random).slice(0, 6);
  return {
    phase: 0, kit,
    wireLayout: {variant:Math.floor(random()*5),order:shuffle(colors.slice(0,10),random),jitter:colors.slice(0,10).map(()=>Math.floor(random()*5)-2)},
    screws: shuffle([...kit, kit[Math.floor(random() * 6)], kit[Math.floor(random() * 6)]], random)
      .map(type => ({ type, stripped: false, turns: 0, removed: false })),
    order: shuffle(colors.slice(0, 10), random),
    ink: shuffle(colors, random),
    orientation: colors.map(() => Math.floor(random() * 3)),
    cut: [], mistakes: 0, cardOpen: false, lastAction: null
  };
}
function nextWire(heist) { return heist.order.find(color => !heist.cut.includes(color)); }
function apply(current, command, now = Date.now()) {
  if (!current) throw new Error('This round does not use the tool stages.');
  if (current.failed) throw new Error('Five wiring faults triggered vault lockdown.');
  const h = JSON.parse(JSON.stringify(current));
  const parts = String(command).split(':');
  const [kind, target, tool] = parts;
  let effect;
  if (kind === 'screw') {
    if (h.phase !== 0) throw new Error('The access panel is already open.');
    if (!/^[0-7]$/.test(target) || !shapes.includes(tool)) throw new Error('Choose a screw and a screwdriver.');
    if (!(h.kit || h.screws.map(s=>s.type)).includes(tool)) throw new Error('That screwdriver is not in your kit.');
    const screw = h.screws[Number(target)];
    if (screw.removed) return current;
    if (screw.type !== tool) { screw.stripped = true; effect = 'strip'; }
    else {
      screw.turns += 1;
      screw.removed = screw.turns >= (screw.stripped ? 3 : 1);
      effect = screw.removed ? 'remove' : 'turn';
    }
    if (h.screws.every(s => s.removed)) h.phase = 1;
  } else if (kind === 'card') {
    if (h.phase !== 1 || !['open', 'close'].includes(target)) throw new Error('The note is used at the wiring stage.');
    h.cardOpen = target === 'open'; effect = h.cardOpen ? 'card-open' : 'card-close';
  } else if (kind === 'cut') {
    if (h.phase !== 1) throw new Error('Open the access panel first.');
    if (h.cardOpen) throw new Error('Put the note away before using the cutters.');
    if (!h.order.includes(target)) throw new Error('Choose a wire on this panel.');
    if (h.cut.includes(target)) return current;
    const correct = nextWire(h) === target;
    h.cut.push(target);
    if (!correct) h.mistakes += 1;
    effect = correct ? 'cut' : 'zap';
    // An incorrectly cut wire stays cut; later instructions skip it.
    h.failed = h.mistakes >= 5;
    if (h.failed) h.failedAt = now;
    if (!h.failed && h.cut.length === h.order.length) { h.phase = 2; h.cardOpen = false; }
  } else throw new Error('Choose a screwdriver, the note, or wire cutters.');
  h.lastAction = { kind, target, effect, at: now };
  return h;
}
function tier(value, heist) {
  if ((heist?.mistakes || 0) >= 3) return 'off';
  if ((heist?.mistakes || 0) >= 2 && value === 'yellow') return 'orange';
  return value;
}
function publicView(h, own) {
  if (!h) return undefined;
  const progress = { phase: h.phase, removed: h.screws.filter(s => s.removed).length, cutCount: h.cut.length, wireCount: h.order.length };
  if (!own) return progress;
  return { ...progress, kit: [...(h.kit || new Set(h.screws.map(s=>s.type)))],
    wireLayout: h.wireLayout ? JSON.parse(JSON.stringify(h.wireLayout)) : undefined, screws: h.screws.map(s => ({ ...s })), cut: [...h.cut], mistakes: h.mistakes,
    cardOpen: h.cardOpen, lastAction: h.lastAction, failed: Boolean(h.failed),
    // Preload only the viewer's own card for instant pickup. The UI keeps it
    // covered while closed; the server still prohibits cuts while it is open.
    wireColors: colors.filter(color => h.order.includes(color)),
    notePlan: h.order.map((color,index) => ({color,ink:index % 3 === 0 ? color : h.ink[index],orientation:h.orientation[index]})),
    instructions: h.cardOpen ? h.order.map((color, index) => ({ color, ink: index % 3 === 0 ? color : h.ink[index], orientation: h.orientation[index], done: h.cut.includes(color) })) : undefined };
}
function botCommand(h) {
  if (h.failed) return null;
  if (h.phase === 0) {
    const index = h.screws.findIndex(s => !s.removed);
    return `screw:${index}:${h.screws[index].type}`;
  }
  if (h.phase === 1) {
    if (h.cardOpen) return 'card:close';
    // The bot takes a short look at its card once before remembering the order.
    if (!h.cut.length && h.lastAction?.effect !== 'card-close') return 'card:open';
    return `cut:${nextWire(h)}`;
  }
  return null;
}
// Timings are recorded only by the authoritative action path, never predictions.
function record(metrics, before, after, now, correct) {
  if (!metrics) return undefined; // Do not invent timing for pre-release rounds.
  const next = {...metrics, finished:[...metrics.finished], mistakes:[...metrics.mistakes]};
  if (before && after && before.phase !== after.phase) next.finished[before.phase] = now;
  if (after?.lastAction?.effect === 'strip' && before !== after) next.mistakes[0]++;
  if (after) next.mistakes[1] = after.mistakes;
  if (correct === false) next.mistakes[2]++;
  return next;
}
function report(player, endMs) {
  const metrics = player?.heistMetrics;
  if (!metrics) return null;
  const ends = [...metrics.finished];
  if (player.completedAt) ends[2] = Date.parse(player.completedAt);
  return ['Panel','Wires','Dial'].map((label,index)=> {
    const start = index ? ends[index-1] : metrics.startedAt;
    const end = ends[index];
    return {label, milliseconds:start == null ? null : Math.max(0,Math.min(end ?? endMs,endMs)-start),
      complete:end != null, started:start != null, mistakes:Number(metrics.mistakes[index]) || 0};
  });
}
module.exports = { record, report, shapes, colors, create, apply, tier, publicView, nextWire, botCommand };
