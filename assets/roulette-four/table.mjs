import { Round, VERSION, ENTRY, DIRECTIONS, relativeSeat, random, shuffle, createPersonality, botDecision, botDelay } from './model.mjs?v=four-player-roulette-atmosphere-v3';
import { installDebug } from './debug.mjs?v=four-player-roulette-atmosphere-v3';

import { loadProfile } from './profile.mjs?v=four-player-roulette-atmosphere-v3';
import { createTableAudio } from './audio.mjs?v=four-player-roulette-atmosphere-v3';
import { createGun } from './gun.mjs?v=four-player-roulette-atmosphere-v3';

const $ = id => document.getElementById(id);
const money = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
const esc = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const asset = name => `/assets/roulette-four/images/${name}`;
const names = ['Marlow', 'Vega', 'Rook', 'Jules', 'Ash', 'Knox', 'Indigo', 'Remy', 'Sage', 'Kit'];
const profiles = ['amber.svg', 'mint.svg', 'rose.svg', 'violet.svg'];
let roster = [], personalities = {}, game = null, roundNumber = 0, generation = 0, busy = false, muted = false;
let angle = 270, phase = 'lobby', connectedProfile = null, messageTimer, tick, resumeResults = false;
let tableNumber = 0;
const timers = new Set(), completedRounds = [];
const diagnostics = installDebug(() => {
  const state = game?.snapshot() || null;
  if (state) state.players = state.players.map(({ avatar, ...p }) => ({ ...p,
    direction: DIRECTIONS[relativeSeat(state.order, p.id, 'you')] }));
  return { version: VERSION, table: tableNumber, state, bots: personalities, completedRounds, audio: tableAudio.status(), gun: gun.selected().id, profile: { status: connectedProfile ? 'connected' : 'guest' },
    ui: { phase: $('roulette-four').dataset.phase, busy, muted, gunAngle: angle,
      pendingTimers: timers.size, resultOpen: $('result-dialog').open,
      controls: Object.fromEntries(['shoot', 'spin', 'pass'].map(id => [id, { disabled: $(id).disabled, text: $(id).textContent.trim() }])) },
    moneyCheck: state ? { totalCents: state.pot + state.players.reduce((sum, p) => sum + p.bank, 0), expectedCents: ENTRY * 4 } : null };
});
function trace(type, details = {}) {
  diagnostics.record(type, { table: tableNumber, round: roundNumber, ...details });
}
const tableAudio = createTableAudio(trace);
const gun = createGun(trace);
function stopTimers() {
  generation++; for (const timer of timers) clearTimeout(timer); timers.clear();
  clearInterval(tick); clearTimeout(messageTimer);
  tableAudio.stop(); gun.stop();
}
function later(fn, ms) {
  const token = generation;
  const timer = setTimeout(() => { timers.delete(timer); if (token === generation) fn(); }, ms);
  timers.add(timer); return timer;
}
function avatar(p, className = 'avatar') { return `<img class="${className}" src="${esc(p.avatar)}" alt="" draggable="false">`; }
function crack() { return '<svg class="screen-crack" viewBox="0 0 100 100" aria-hidden="true"><g fill="none" stroke="#d1d6c9" stroke-width="1.4"><path d="M48 48 35 28 24 25 8 0M48 48 65 27 63 13 75 0M48 48 78 39 100 20M48 48 68 63 85 66 100 91M48 48 40 72 50 88 48 100M48 48 20 59 0 55M48 48 23 80 5 100M35 28 47 20M68 63 74 82M20 59 12 42"/></g><path d="m48 34 8 5 10 1-3 12 4 8-13 2-7 7-7-8-11-2 4-12-1-8 10 1z" fill="#030404" stroke="#a5a48d" stroke-width="2"/></svg>'; }
function player(id) { return game?.snapshot().players.find(p => p.id === id) || roster.find(p => p.id === id); }
function toast(text) {
  clearTimeout(messageTimer); $('scene-message').textContent = text;
  messageTimer = setTimeout(() => { $('scene-message').textContent = ''; }, 2500);
}
function rotateTo(id, opening = false) {
  const s = game.snapshot(), target = 270 + relativeSeat(s.order, id, 'you') * 90;
  const difference = ((target - angle) % 360 + 360) % 360;
  angle += difference + (opening ? 1080 : 0);
  $('gun').style.transitionDuration = opening ? '3.7s' : '0.65s';
  $('gun').style.transform = `rotate(${angle}deg)`;
  tableAudio.play('wood', { duration: opening ? 3700 : 650, loop: true, volume: opening ? .26 : .2 });
  trace('gun-target', { player: id, direction: DIRECTIONS[relativeSeat(s.order, id, 'you')], angle, opening });
}
function buildRoster() {
  const botNames = shuffle(names).slice(0, 3), botProfiles = shuffle(profiles.filter(name => connectedProfile?.avatar || name !== 'amber.svg')).slice(0, 3);
  roster = [{ id: 'you', name: $('player-name').value.trim().slice(0, 24) || 'You', avatar: connectedProfile?.avatar || asset('amber.svg'), gender: connectedProfile?.gender || 'unknown', isBot: false },
    ...botNames.map((name, i) => ({ id: `bot-${i + 1}`, name, avatar: asset(botProfiles[i]), gender: i === 1 ? 'female' : 'male', pose: i, isBot: true }))];
}
function mountSeats(s) {
  $('seats').innerHTML = s.players.filter(p => p.id !== 'you').map(p => `<div class="seat" data-player="${p.id}" data-gender="${p.gender}" data-pose="${p.pose}" data-direction="${DIRECTIONS[relativeSeat(s.order, p.id, 'you')]}" style="--pose:${p.pose};--model:${p.gender === 'female' ? 1 : 0};--idle-delay:-${p.pose * 2.3}s"><div class="seat-figure"><div class="mannequin" role="img" aria-label="${esc(p.name)} seated at the table"></div><div class="tv-glow"></div><div class="tv-screen">${avatar(p, '')}${crack()}</div></div><span class="seat-name">${esc(p.name)}</span></div>`).join('');
  const me = s.players.find(p => p.id === 'you');
  $('self-seat').innerHTML = `<span class="self-picture">${avatar(me)}${crack()}</span><span>${esc(me.name)} <small>You sit here · ↓</small></span>`;
}
function render() {
  if (!game) return;
  const s = game.snapshot(), me = s.players.find(p => p.id === 'you');
  phase = s.phase;
  $('reopen-results').hidden = !['rematch', 'expired'].includes(phase);
  $('roulette-four').dataset.phase = phase;
  $('players').innerHTML = s.order.map((id, i) => {
    const p = s.players.find(p => p.id === id), active = phase === 'playing' && id === s.activeId;
    return `<article class="player-bar ${active ? 'active' : ''} ${p.eliminated ? 'eliminated' : ''}" data-player="${id}" ${active ? 'aria-current="true"' : ''}>${avatar(p)}<div><b class="player-name">${esc(p.name)}${id === 'you' && p.name !== 'You' ? ' · You' : ''}</b><span class="player-detail">${p.shots} safe · ${p.spinUsed ? 'spin used' : '1 spin'}${p.isBot ? ' · BOT' : ''}</span></div><div><span class="order">${p.eliminated ? 'OUT' : active ? `#${i + 1} · TURN` : `#${i + 1}`}</span><strong class="player-money">${money(p.bank)}</strong></div></article>`;
  }).join('');
  document.querySelectorAll('.seat').forEach(seat => {
    const p = s.players.find(p => p.id === seat.dataset.player);
    seat.classList.toggle('active', phase === 'playing' && s.activeId === p.id);
    seat.classList.toggle('eliminated', p.eliminated);
  });
  $('self-seat').classList.toggle('active', phase === 'playing' && s.activeId === 'you');
  $('self-seat').classList.toggle('eliminated', me.eliminated);
  $('pot').textContent = money(s.pot);
  $('round-label').textContent = `Round ${s.round} · $100 each`;
  const canAct = phase === 'playing' && s.activeId === 'you' && !busy;
  $('gun-options').disabled = busy;
  $('shoot').disabled = !canAct; $('pass').disabled = !canAct || !s.canPass;
  $('spin').disabled = !canAct || me.spinUsed;
  $('spin').innerHTML = `Spin chamber <small>${me.spinUsed ? 'Used this round' : '1 left · resets to $20'}</small>`;
  $('shoot-value').textContent = `+${money(s.award)}`;
  $('shoot').setAttribute('aria-label', `Shoot to earn ${money(s.award)} if you survive`);
  $('your-count').textContent = `${me.shots} safe shot${me.shots === 1 ? '' : 's'}`;
  $('risk-label').textContent = `1 in ${6 - s.safeSinceSpin} · ${(s.fatalRisk * 100).toFixed(1)}% risk`;
  $('chambers').innerHTML = Array.from({ length: 6 }, (_, i) => `<i class="chamber-dot ${i < s.safeSinceSpin ? 'spent' : ''}"></i>`).join('');
  if (phase === 'opening') {
    $('turn-label').textContent = 'Choosing the first player'; $('turn-hint').textContent = 'Your seat is always at the bottom.';
  } else if (phase === 'playing') {
    const active = s.players.find(p => p.id === s.activeId);
    $('turn-label').textContent = s.activeId === 'you' ? 'Your turn' : `${active.name}’s turn`;
    $('turn-hint').textContent = s.activeId === 'you' ? (s.spinPending ? 'Chamber spun. Take your shot.' : s.canPass ? 'Keep going, or pass clockwise.' : 'Take at least one shot before passing.') : (busy ? 'At the table…' : 'Thinking…');
  } else {
    $('turn-label').textContent = 'Round complete';
    $('turn-hint').textContent = 'The round has ended.';
  }
  const descriptions = s.actions.map(event => {
    const p = s.players.find(p => p.id === event.id);
    return `${p.name} ${event.action === 'pass' ? 'passed clockwise' : event.action === 'spin' ? 'spun the chamber · next shot $20' : event.fatal ? 'was eliminated' : `survived · +${money(event.award)}`}`;
  });
  $('activity').innerHTML = descriptions.map(text => `<li>${esc(text)}</li>`).join('');
  $('last-action').textContent = descriptions.at(-1) || 'The opening draw';
  diagnostics.refresh();
}
function startRound() {
  stopTimers(); busy = true; roundNumber++;
  personalities = Object.fromEntries(roster.filter(p => p.isBot).map(p => [p.id, createPersonality()]));
  game = new Round(roster, random, roundNumber);
  trace('round-start', { order: game.snapshot().order, bots: structuredClone(personalities) });
  $('result-dialog').close(); $('welcome').close(); $('scene').classList.remove('is-fatal');
  $('scene-message').textContent = ''; $('turn-hint').classList.remove('result-reopen');
  $('opening').hidden = false; $('opening-name').textContent = 'Four seats. One chamber.';
  mountSeats(game.snapshot()); render();
  requestAnimationFrame(() => { if (phase === 'opening') rotateTo(game.snapshot().activeId, true); });
  later(() => {
    const s = game.snapshot(); $('opening-name').textContent = `${player(s.activeId).name} goes first`;
  }, 3700);
  later(() => { $('opening').hidden = true; busy = false; game.begin(); trace('round-playing'); render(); scheduleBot(); }, 4500);
}
function scheduleBot() {
  const s = game.snapshot();
  if (s.phase !== 'playing' || s.activeId === 'you' || busy) return;
  const id = s.activeId, personality = personalities[id];
  const delay = botDelay(personality);
  trace('bot-thinking', { player: id, delayMs: delay });
  later(() => {
    const snapshot = game.snapshot();
    if (snapshot.activeId !== id || snapshot.phase !== 'playing' || busy) return;
    const choice = botDecision(snapshot, id, personality);
    trace('bot-decision', { player: id, style: personality.kind, choice,
      risk: snapshot.fatalRisk, awardCents: snapshot.award, canPass: snapshot.canPass });
    if (choice) act(id, choice);
  }, delay);
}
function act(id, action) {
  if (busy) { trace('action-rejected', { player: id, action, reason: 'UI busy' }); return; }
  const execute = () => {
    const event = game.act(id, action);
    if (!event.ok) { busy = false; trace('action-rejected', event); toast(event.reason); render(); return; }
    const after = game.snapshot();
    trace('action', { ...event, phase: after.phase, activePlayer: after.activeId, potCents: after.pot, nextAwardCents: after.award,
      banks: after.players.map(p => ({ id: p.id, bankCents: p.bank, shots: p.shots, spinUsed: p.spinUsed })) });
    busy = true;
    if (action === 'pass') rotateTo(after.activeId);
    if (action === 'spin') {
      gun.roll(); tableAudio.play('spin', { duration: 1350, volume: .24 });
      toast(`${player(id).name} spun · next shot $20`);
    }
    if (action === 'shoot') {
      gun.strike(event.fatal);
      if (gun.selected().laser) tableAudio.tone(event.fatal, 0);
      else tableAudio.play(event.fatal ? 'live' : 'dry', { duration: event.fatal ? 900 : 350, volume: event.fatal ? .3 : .38 });
      trace('shot-strike', { player: id, fatal: !!event.fatal, hammerDelayMs: 320 });
      if (event.fatal) $('scene').classList.add('is-fatal');
      toast(event.fatal ? `${player(id).name} is out` : `${player(id).name} · safe · +${money(event.award)}`);
    }
    render();
    if (after.phase === 'complete') { later(showResults, 1500); return; }
    later(() => { busy = false; render(); scheduleBot(); }, action === 'spin' ? 1400 : action === 'pass' ? 700 : 550);
  };
  if (action === 'shoot') {
    busy = true; render(); gun.cock();
    if (!gun.selected().laser) tableAudio.play('hammer', { duration: 230, volume: .2 });
    later(execute, 320);
  } else execute();
}
function showResults() {
  busy = false; game.openRematch();
  const s = game.snapshot(), me = s.players.find(p => p.id === 'you');
  completedRounds.push({ table: tableNumber, round: roundNumber, at: new Date().toISOString(), order: s.order, result: s.result, players: s.players.map(({ avatar, ...p }) => p) });
  if (completedRounds.length > 50) completedRounds.shift();
  trace('results', { result: s.result, players: s.players.map(({ avatar, ...p }) => p), deadline: s.rematchDeadline });
  $('result-kicker').textContent = `ROUND ${s.round} COMPLETE`;
  $('result-title').textContent = s.result.reason === 'empty' ? 'The pot is empty.' : `${player(s.result.eliminatedId).name} is out.`;
  $('result-description').textContent = s.result.reason === 'empty' ? 'All $400 has been claimed. Everyone keeps their bank.' : `${money(s.result.splitTotal)} split by surviving shot counts. You finish with ${money(me.bank)}.`;
  $('result-rows').innerHTML = s.order.map(id => {
    const p = s.players.find(p => p.id === id), net = p.bank - ENTRY;
    return `<div class="result-row">${avatar(p)}<div><b>${esc(p.name)}${id === 'you' && p.name !== 'You' ? ' · You' : ''}</b><small>${p.shots} safe shots · ${p.eliminated ? 'Eliminated' : s.result.reason === 'empty' ? 'Bank kept' : `${(p.share * 100).toFixed(2)}% split · +${money(p.split)}`}</small></div><div class="result-total ${net < 0 ? 'negative' : ''}">${money(p.bank)}<small>${net >= 0 ? '+' : '−'}${money(Math.abs(net))} net</small></div></div>`;
  }).join('');
  $('rematch').disabled = false; $('rematch').textContent = "I'm in · Rematch";
  if (!$('result-dialog').open) $('result-dialog').showModal();
  render(); updateRematch();
  tick = setInterval(updateRematch, 100);
  for (const bot of roster.filter(p => p.isBot)) {
    const accepts = random() < personalities[bot.id].rematch;
    trace('bot-rematch-plan', { player: bot.id, accepts });
    if (accepts) later(() => vote(bot.id), 800 + random() * 5500);
  }
}
function updateRematch() {
  if (!game) return;
  if (game.expire()) trace('rematch-expired', { ready: game.snapshot().ready });
  const s = game.snapshot();
  if (!['rematch', 'expired'].includes(s.phase)) return;
  $('roulette-four').dataset.phase = s.phase;
  const seconds = Math.max(0, Math.ceil((s.rematchDeadline - Date.now()) / 1000));
  $('countdown').textContent = `${seconds}s`;
  // Keep avatar nodes stable while only the countdown changes.
  const voteKey = `${s.round}:${s.ready.join(',')}`;
  if ($('ready-bubbles').dataset.votes !== voteKey) {
    $('ready-bubbles').dataset.votes = voteKey;
    $('ready-bubbles').innerHTML = s.order.map(id => `<span class="ready-bubble ${s.ready.includes(id) ? 'ready' : ''}" aria-label="${esc(player(id).name)}: ${s.ready.includes(id) ? 'ready' : 'waiting'}" title="${esc(player(id).name)}">${avatar(player(id), '')}</span>`).join('');
  }
  $('ready-label').textContent = s.phase === 'expired' ? 'Rematch expired. Find a new table to play again.' : `${s.ready.length}/4 ready · all four must accept`;
  if (s.phase === 'expired') { clearInterval(tick); $('rematch').disabled = true; $('rematch').textContent = 'Rematch expired'; }
}
function vote(id) {
  if (!game) return;
  const allReady = game.vote(id); updateRematch();
  trace('rematch-vote', { player: id, ready: game.snapshot().ready, phase: game.snapshot().phase, allReady });
  if (game.snapshot().ready.includes('you')) { $('rematch').disabled = true; $('rematch').textContent = 'You’re in · waiting for everyone'; }
  if (allReady) startRound();
}
function newTable() { stopTimers(); buildRoster(); roundNumber = 0; tableNumber++; startRound(); }

$('join-form').addEventListener('submit', async event => { event.preventDefault(); const button = $('join-form').querySelector('button'); button.disabled = true; button.textContent = 'Preparing the table…'; await Promise.all([tableAudio.unlock(), gun.ready()]); newTable(); button.disabled = false; button.textContent = 'Take a seat · $100'; });
$('gun-options').addEventListener('change', async event => { if (busy) return; const token = generation; busy = true; render(); await gun.select(event.target.value); if (generation !== token) return; busy = false; render(); scheduleBot(); });
$('shoot').addEventListener('click', () => act('you', 'shoot'));
$('spin').addEventListener('click', () => act('you', 'spin'));
$('pass').addEventListener('click', () => act('you', 'pass'));
$('rematch').addEventListener('click', () => vote('you'));
$('new-table').addEventListener('click', () => game ? newTable() : $('welcome').showModal());
$('result-new-table').addEventListener('click', newTable);
$('view-table').addEventListener('click', () => $('result-dialog').close());
$('reopen-results').addEventListener('click', () => { if (game && ['rematch', 'expired'].includes(game.snapshot().phase) && !$('result-dialog').open) $('result-dialog').showModal(); });
$('sound').addEventListener('click', () => {
  muted = !muted; $('sound').textContent = muted ? 'Sound off' : 'Sound on'; $('sound').setAttribute('aria-pressed', String(!muted));
  tableAudio.mute(muted); if (!muted) tableAudio.unlock();
});
$('rules').addEventListener('click', () => $('rules-dialog').showModal());
$('close-rules').addEventListener('click', () => $('rules-dialog').close());
$('welcome').addEventListener('cancel', event => event.preventDefault());
try { $('player-name').value = localStorage.getItem('tornKeyConfirmedName') || 'You'; } catch {}
window.addEventListener('pagehide', () => { stopTimers(); resumeResults = true; });
window.addEventListener('pageshow', event => {
  if (!event.persisted || !resumeResults || !game) return;
  resumeResults = false; busy = false;
  const s = game.snapshot();
  if (s.phase === 'opening') { game.begin(); $('opening').hidden = true; render(); scheduleBot(); }
  else if (s.phase === 'playing') { render(); scheduleBot(); }
  else if (s.phase === 'complete') showResults();
  else { updateRematch(); tick = setInterval(updateRematch, 100); }
});
buildRoster();
game = new Round(roster);
mountSeats(game.snapshot()); render();
$('turn-label').textContent = 'Take a seat'; $('turn-hint').textContent = 'One bullet. Six chambers. One shared pot.';
$('roulette-four').dataset.phase = 'lobby';
$('welcome').showModal();
async function connectProfile() {
  const join = $('join-form').querySelector('button'); join.disabled = true;
  $('profile-status').textContent = 'Loading your Torn profile…';
  const loaded = await loadProfile(); connectedProfile = loaded.profile || null;
  if (connectedProfile) {
    $('player-name').value = connectedProfile.name; $('player-name').readOnly = true;
    $('profile-status').textContent = 'Connected to Torn · your profile picture and character are automatic.';
    $('profile-preview').src = connectedProfile.avatar || asset('amber.svg'); $('profile-preview').hidden = false;
  } else $('profile-status').textContent = loaded.message;
  trace('profile-loaded', { status: loaded.status }); join.disabled = false;
}
document.addEventListener('error', event => {
  if (event.target instanceof HTMLImageElement && !event.target.src.endsWith('/amber.svg') && (event.target.matches('.avatar,.tv-screen img,.ready-bubble img,#profile-preview'))) event.target.src = asset('amber.svg');
}, true);
document.addEventListener('visibilitychange', () => { if (document.hidden) tableAudio.stop(); });
connectProfile();
console.info(`${VERSION}: four-player bot practice ready`);
