import { Round, VERSION, ENTRY, DIRECTIONS, relativeSeat, random, shuffle, createPersonality, botDecision, botDelay } from './model.mjs?v=four-player-roulette-v1';

const $ = id => document.getElementById(id);
const money = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
const esc = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const asset = name => `/assets/roulette-four/images/${name}`;
const names = ['Marlow', 'Vega', 'Rook', 'Jules', 'Ash', 'Knox', 'Indigo', 'Remy', 'Sage', 'Kit'];
const profiles = ['amber.svg', 'mint.svg', 'rose.svg', 'violet.svg'];
let roster = [], personalities = {}, game = null, roundNumber = 0, generation = 0, busy = false, muted = false;
let angle = 270, phase = 'lobby', uploadUrl = '', messageTimer, tick, resumeResults = false;
const timers = new Set(), audio = new Map();
const sounds = {
  opening: '/assets/roulette/audio/revolver-spinning-on-wood-v4.mp3',
  spin: '/assets/roulette/audio/freesound_community-revolver-chamber-spin-ratchet-sound-90521.mp3',
  dry: '/assets/roulette/audio/freesound_community-gun-dry-firing-3-39820.mp3',
  live: '/assets/roulette/audio/freesound_community-single-pistol-gunshot-33-37187.mp3'
};
function sound(key) {
  if (muted) return;
  if (!audio.has(key)) { const clip = new Audio(sounds[key]); clip.volume = key === 'live' ? 0.3 : 0.45; audio.set(key, clip); }
  const clip = audio.get(key); clip.currentTime = 0; clip.play().catch(() => {});
}
function stopTimers() {
  generation++; for (const timer of timers) clearTimeout(timer); timers.clear();
  clearInterval(tick); clearTimeout(messageTimer);
  for (const clip of audio.values()) { clip.pause(); clip.currentTime = 0; }
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
}
function buildRoster() {
  const botNames = shuffle(names).slice(0, 3), botProfiles = shuffle(profiles.filter(name => uploadUrl || name !== 'amber.svg')).slice(0, 3);
  roster = [{ id: 'you', name: $('player-name').value.trim().slice(0, 24) || 'You', avatar: uploadUrl || asset('amber.svg'), isBot: false },
    ...botNames.map((name, i) => ({ id: `bot-${i + 1}`, name, avatar: asset(botProfiles[i]), isBot: true }))];
}
function mountSeats(s) {
  $('seats').innerHTML = s.players.filter(p => p.id !== 'you').map(p => `<div class="seat" data-player="${p.id}" data-direction="${DIRECTIONS[relativeSeat(s.order, p.id, 'you')]}"><img class="mannequin" src="${asset('tv-mannequin-v1.png')}" alt="Seated mannequin with ${esc(p.name)}'s profile on its TV head"><div class="tv-screen">${avatar(p, '')}${crack()}</div><span class="seat-name">${esc(p.name)}</span></div>`).join('');
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
}
function startRound() {
  stopTimers(); busy = true; roundNumber++;
  personalities = Object.fromEntries(roster.filter(p => p.isBot).map(p => [p.id, createPersonality()]));
  game = new Round(roster, random, roundNumber);
  $('result-dialog').close(); $('welcome').close(); $('scene').classList.remove('is-fatal');
  $('scene-message').textContent = ''; $('turn-hint').classList.remove('result-reopen');
  $('opening').hidden = false; $('opening-name').textContent = 'Four seats. One chamber.';
  mountSeats(game.snapshot()); render();
  sound('opening');
  requestAnimationFrame(() => { if (phase === 'opening') rotateTo(game.snapshot().activeId, true); });
  later(() => {
    const s = game.snapshot(); $('opening-name').textContent = `${player(s.activeId).name} goes first`;
  }, 3700);
  later(() => { $('opening').hidden = true; busy = false; game.begin(); render(); scheduleBot(); }, 4500);
}
function scheduleBot() {
  const s = game.snapshot();
  if (s.phase !== 'playing' || s.activeId === 'you' || busy) return;
  const id = s.activeId, personality = personalities[id];
  later(() => {
    const snapshot = game.snapshot();
    if (snapshot.activeId !== id || snapshot.phase !== 'playing' || busy) return;
    const choice = botDecision(snapshot, id, personality);
    if (choice) act(id, choice);
  }, botDelay(personality));
}
function act(id, action) {
  if (busy) return;
  const event = game.act(id, action);
  if (!event.ok) { toast(event.reason); return; }
  busy = true;
  if (action === 'pass') { rotateTo(game.snapshot().activeId); }
  if (action === 'spin') { sound('spin'); toast(`${player(id).name} spun · next shot $20`); }
  if (action === 'shoot') {
    sound(event.fatal ? 'live' : 'dry');
    const recoil = $('recoil'); recoil.classList.remove('kick', 'live');
    void recoil.offsetWidth; recoil.classList.add('kick');
    if (event.fatal) { recoil.classList.add('live'); $('scene').classList.add('is-fatal'); }
    toast(event.fatal ? `${player(id).name} is out` : `${player(id).name} · safe · +${money(event.award)}`);
  }
  render();
  if (game.snapshot().phase === 'complete') { later(showResults, 1500); return; }
  later(() => { busy = false; render(); scheduleBot(); }, action === 'spin' ? 900 : action === 'pass' ? 700 : 650);
}
function showResults() {
  busy = false; game.openRematch();
  const s = game.snapshot(), me = s.players.find(p => p.id === 'you');
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
    if (random() < personalities[bot.id].rematch) later(() => vote(bot.id), 800 + random() * 5500);
  }
}
function updateRematch() {
  if (!game) return;
  game.expire(); const s = game.snapshot();
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
  if (game.snapshot().ready.includes('you')) { $('rematch').disabled = true; $('rematch').textContent = 'You’re in · waiting for everyone'; }
  if (allReady) startRound();
}
function newTable() { stopTimers(); buildRoster(); roundNumber = 0; startRound(); }

$('join-form').addEventListener('submit', event => { event.preventDefault(); newTable(); });
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
  if (muted) for (const clip of audio.values()) clip.pause();
});
$('rules').addEventListener('click', () => $('rules-dialog').showModal());
$('close-rules').addEventListener('click', () => $('rules-dialog').close());
$('welcome').addEventListener('cancel', event => event.preventDefault());
$('player-photo').addEventListener('change', () => {
  const file = $('player-photo').files[0];
  if (!file) return;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
    $('player-photo').value = ''; alert('Choose a PNG, JPEG or WebP smaller than 5 MB.'); return;
  }
  if (uploadUrl) URL.revokeObjectURL(uploadUrl);
  uploadUrl = URL.createObjectURL(file);
});
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
console.info(`${VERSION}: four-player bot practice ready`);
