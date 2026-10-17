/* BLUFF_OR_BUST_V4_STABLE_REVEALS */
(() => {
  'use strict';
  const rules = window.BluffRules, $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const suitName = { crown: 'Crowns', coin: 'Coins', skull: 'Skulls' }, pip = { crown: '♛', coin: '◆', skull: '✦' };
  const storage = { get(k) { try { return sessionStorage.getItem(k); } catch { return null; } }, set(k, v) { try { sessionStorage.setItem(k, v); } catch {} }, remove(k) { try { sessionStorage.removeItem(k); } catch {} } };
  let state, local, room = '', token = '', busy = false, polling = false, selected = new Set(), key = '', clockOffset = 0, lastCue = '', createId = '', noticeTimer;
  let generation = 0, connecting = false, networkErrors = 0, lastResponseMs = 0;
  const connection = document.createElement('p');
  connection.className = 'bluff-connection'; connection.hidden = true; connection.setAttribute('role', 'status');
  $('game').before(connection);
  function showConnection(value, message = 'Connecting to your table…') {
    connecting = value; connection.hidden = !value; connection.textContent = message;
    $('game').inert = value; $('game').setAttribute('aria-busy', String(value));
    window.XanGameMenu?.update?.();
  }
  window.XanSiteAdapter = {
    current: () => ({mode:'bluff',id:state?.id||'',phase:state?.phase||'lobby'}),
    view: () => state ? {id:state.id,match:state.match,phase:state.phase,connecting,canCancel:!connecting&&!local&&state.phase==='waiting'&&state.players.length===1&&state.me===0,readyDeadline:state.readyDeadline,ready:state.ready.includes(state.players[state.me].id),canReady:!connecting&&state.phase==='waiting'&&state.players.length===2&&!state.ready.includes(state.players[state.me].id),wager:state.wager||0,private:state.private,players:state.players,me:state.players[state.me].id,votes:state.rematch,finished:state.phase==='complete',settlement:state.settlement,payout:state.payouts?.[state.players[state.me].id]||0} : {},
    ready:()=>request('ready'),dismissCancelled:id=>{if(id===room)resetTable();},addBot:()=>state?.wager?startOnline(true,'',{},state.id):state?request('add-bot'):$('practice').onclick(),create: options => startOnline(false,'',options), practice: () => $('practice').onclick(),
    diagnostics:()=>({build:'BLUFF_OR_BUST_V4_STABLE_REVEALS',revision:state?.revision||0,round:state?.round||0,networkErrors,lastResponseMs,busy,polling,connecting}),
    quote: async id => (await post('bluff-action',{action:'quote',gameId:id.toUpperCase(),token:await authenticate()})).quote,
    join: (id,wager) => startOnline(false,id.toUpperCase(),{wager}),
    help: () => $('rules-dialog').showModal(), controls: () => $('table-controls'), resultRoot: () => $('game').querySelector('.result-actions')
  };
  function notice(message, persistent = false) {
    clearTimeout(noticeTimer); $('notice').textContent = message;
    if (!persistent) noticeTimer = setTimeout(() => { $('notice').textContent = ''; }, 6000);
  }
  const foley = new Map();
  function tone(kind) {
    if (window.XanPreferences?.muted || document.hidden) return;
    const name = kind === 'lock' ? 'place' : kind;
    if (!foley.has(name)) foley.set(name, new Audio(({place:'/assets/site-hub/audio/card-place-1.ogg',pick:'/assets/site-hub/audio/card-slide-1.ogg',reveal:'/assets/site-hub/audio/card-fan-1.ogg'})[name]||'/assets/bluff/audio/'+name+'.wav'));
    const sound = foley.get(name); sound.currentTime = 0; sound.volume = name === 'win' || name === 'lose' ? .55 : .7;
    sound.play().catch(() => {});
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) for (const sound of foley.values()) sound.pause(); });
  $('rules').onclick = () => $('rules-dialog').showModal();
  $('close-rules').onclick = () => $('rules-dialog').close();
  $('rules-dialog').addEventListener('click', e => { if (e.target === $('rules-dialog')) { const r = e.target.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) e.target.close(); } });
  function card(c, i = 0, mini = false, target = '') {
    return `<${mini ? 'div' : 'button'} data-key="${mini ? 'reveal' : 'hand'}-${esc(c.id)}" class="card ${mini ? `mini face${c.suit !== target ? ' fake' : ''}` : ''}" ${mini ? '' : `data-card="${esc(c.id)}" aria-label="${esc(c.suit)} card ${i + 1}" aria-pressed="${selected.has(c.id)}" ${state?.phase !== 'select' || state?.locked[state.me] ? 'disabled' : ''}`} style="--i:${Math.min(i,7)}"><span class="card-name">${c.suit.toUpperCase()}</span><img src="/assets/bluff/images/${c.suit}.svg" alt=""><span class="pip">${pip[c.suit]}</span></${mini ? 'div' : 'button'}>`;
  }
  function backs(count, locked) {
    if (!count) return '<div class="ghost-slot">◇</div>';
    return Array.from({ length: Math.min(count, 7) }, (_, i) => `<div data-key="back-${i}" class="mini back" style="--i:${i};--angle:${(i - Math.min(count, 7) / 2) * 3}" aria-hidden="true"></div>`).join('');
  }
  async function post(endpoint, body) {
    const began = performance.now();
    try {
    const response = await fetch('/.netlify/functions/' + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000) });
    const data = await response.json();
    if (!response.ok || !data.ok) { const e = new Error(data.error || 'Connection interrupted. Please retry.'); e.status = response.status; throw e; }
    lastResponseMs = Math.round(performance.now() - began); return data;
    } catch(e) { networkErrors++; throw e; }
  }
  async function authenticate() {
    if (token) return token;
    let visitorKey; try { visitorKey = localStorage.getItem('tornVisitorApiKey'); } catch {}
    if (!visitorKey) throw new Error('Connect your public Torn API key on the home page to play online. Bot practice is available now.');
    token = (await post('rps-action', { action: 'login', visitorKey })).token; return token;
  }
  function accept(next, elapsed = 0) {
    if (state?.id === next.id && state.revision > next.revision) return;
    if(next.cancelled){resetTable();return;}
    clockOffset = next.serverNow + elapsed / 2 - Date.now();
    const reset = !state || state.id !== next.id || state.match !== next.match || state.round !== next.round;
    if (reset || (next.phase === 'reveal' && state?.phase !== 'reveal')) selected.clear();
    state = next; room = next.id;
    selected = new Set([...selected].filter(id => state.hand.some(c => c.id === id)));
    render(); window.XanGameMenu?.update?.();
  }
  function persistLocal() { storage.set('bluff-practice', JSON.stringify(local)); }
  async function request(action, extra = {}) {
    if (busy) return;
    busy = true;
    const epoch = generation, requestRoom = room, match = state?.match, round = state?.round;
    try {
      if (local) {
        rules.bot(local);
        rules.act(local, 'practice:you', { action, match: state?.match, round: state?.round, ...extra });
        persistLocal(); accept(rules.publicState(local, 'practice:you'));
      } else {
        const session = await authenticate(), began = Date.now();
        const data = await post('bluff-action', { action, token: session, gameId: requestRoom, match, round, ...extra });
        if (epoch !== generation || requestRoom !== room) return;
        storage.set('bluff-room', data.game.id); accept(data.game, Date.now() - began);
      }
      notice('');
    } catch (e) {
      if (epoch !== generation) return;
      if (e.status === 401) token = '';
      notice(e.message || 'Connection interrupted. Your locked choices are preserved.', true);
      if (local) { persistLocal(); accept(rules.publicState(local, 'practice:you')); }
    } finally { if(epoch === generation) { busy = false; updateSelection(); } }
  }
  async function poll() {
    if (!state || local || polling || busy || document.hidden) return;

    polling = true;
    const epoch = generation, requestRoom = room;
    try { const session = await authenticate(), began = Date.now(); const data = await post('bluff-action', { action: 'get', gameId: requestRoom, token: session }); if(epoch !== generation || requestRoom !== room)return; accept(data.game, Date.now() - began); if ($('notice').dataset.network) { notice(''); delete $('notice').dataset.network; } }
    catch (e) { if(epoch !== generation)return; if (e.status === 401) token = ''; $('notice').dataset.network = '1'; notice('Reconnecting… the table clock continues. ' + e.message, true); }
    finally { polling = false; }
  }
  async function startOnline(bot = false, join = '', options = {}, replaceRoom = '') {
    if (busy) return;
    busy = true;
    const epoch = ++generation; let cancelled = false;
    showConnection(true, bot ? 'Seating The Velvet Fox…' : 'Connecting to your table…');
    try {
      const session = await authenticate();
      // Keep the current table painted while refunding its stake and seating a free bot.
      if(replaceRoom) { await post('bluff-action',{action:'cancel',gameId:replaceRoom,token:session}); cancelled = true; }
      if (!createId) createId = crypto.randomUUID();
      const began = Date.now(), data = await post('bluff-action', { action: join ? 'join' : 'create', gameId: join, bot, wager:bot?0:options.wager||0,private:options.private===true,requestId: createId, token: session });
      if(epoch !== generation)return;
      local = null; state = null; key = ''; createId = ''; storage.remove('bluff-practice'); storage.set('bluff-room', data.game.id);
      history.replaceState(null, '', '?room=' + data.game.id); accept(data.game, Date.now() - began); notice('');
    } catch (e) { if(e.status&&e.status<500)createId='';if(cancelled)resetTable();notice(e.message, true); throw e; }
    finally { busy = false; showConnection(false); if(replaceRoom)window.XanHub?.refresh?.(); }
  }
  $('practice').onclick = async () => {
    if(busy)return;
    let connected; try { connected = localStorage.getItem('tornVisitorApiKey'); } catch {}
    if (connected) return startOnline(true);
    generation++;
    local = rules.create('PRACTICE', { id: 'practice:you', name: 'You' });
    rules.join(local, { id: 'bot:velvet', name: 'The Velvet Fox', bot: true });
    state = null; key = ''; storage.remove('bluff-room'); persistLocal(); history.replaceState(null, '', location.pathname); accept(rules.publicState(local, 'practice:you'));
  };
  $('create').onclick = () => startOnline();
  $('join').onclick = () => { const code = $('room').value.trim().toUpperCase(); if (!/^[A-F0-9]{12}$/.test(code)) return notice('Enter the 12-character code from your friend’s invitation.'); startOnline(false, code); };
  async function copyInvite() {
    const url = new URL(location.pathname, location.origin); url.searchParams.set('room', room);
    try { await navigator.clipboard.writeText(url.href); notice('Invitation link copied. Send it to your opponent.'); }
    catch { notice('Your invitation code: ' + room, true); }
  }
  async function leave() {
    if (busy) return;
    if (state && !['complete'].includes(state.phase)) {
      // Leaving is explicitly labeled as forfeiting while a match is active.
      await request('leave');
      if (state&&state.phase !== 'complete') return;
    }
    resetTable();
  }
  function resetTable(){
    generation++; busy = false; showConnection(false);
    state = null; local = null; room = ''; key = ''; selected.clear(); storage.remove('bluff-room'); storage.remove('bluff-practice');
    history.replaceState(null, '', location.pathname); $('game').hidden = true; $('lobby').hidden = false; $('table-controls').replaceChildren(); notice('');window.XanGameMenu?.update?.();
  }
  function outcome(e) {
    const own = e.player === state.me, who = own ? 'You' : esc(state.players[e.player].name), n = e.cards.length;
    if (e.result === 'caught') return `<b>CAUGHT BLUFFING.</b>${who} take${own ? '' : 's'} ${n} card${n === 1 ? '' : 's'} back.`;
    if (e.result === 'false-call') return `<b>ALL GENUINE.</b>${own ? 'Your rival takes' : 'You take'} all ${n} cards. A costly accusation.`;
    return `<b>${e.fake ? 'GOT AWAY WITH IT.' : 'TRUST WELL PLACED.'}</b>${n} card${n === 1 ? '' : 's'} discarded.${e.fake ? ` ${e.cards.filter(c => c.suit !== state.target).length} fake.` : ''}`;
  }
  function reconcile(root, next) {
    // Keep stable DOM nodes mounted: polling must not restart deal/flip animations.
    const desired = [...next.childNodes];
    desired.forEach((node, i) => {
      let old = root.childNodes[i];
      if (node.nodeType === 1 && node.dataset.key) {
        const match = [...root.children].find(c => c.dataset.key === node.dataset.key);
        if (match && match !== old) { root.insertBefore(match, old || null); old = match; }
      }
      if (!old || old.nodeType !== node.nodeType || old.nodeName !== node.nodeName || (node.nodeType === 1 && old.dataset.key !== node.dataset.key)) {
        if (old) root.replaceChild(node.cloneNode(true), old); else root.append(node.cloneNode(true));
        return;
      }
      if (node.nodeType === 3) { if (old.data !== node.data) old.data = node.data; return; }
      if (node.nodeType !== 1) return;
      for (const attr of [...old.attributes]) if (!node.hasAttribute(attr.name)) old.removeAttribute(attr.name);
      for (const attr of node.attributes) if (old.getAttribute(attr.name) !== attr.value) old.setAttribute(attr.name, attr.value);
      reconcile(old, node);
    });
    while (root.childNodes.length > desired.length) root.lastChild.remove();
  }
  function render() {
    if (!state) return;
    $('lobby').hidden = true; $('game').hidden = false;
    const s = state, me = s.me, other = 1 - me, rival = s.players[other];
    const nextKey = [s.id, s.revision, local ? 'local' : 'online'].join(':');
    if (nextKey === key) return;
    const oldPhase = $('game').dataset.phase;
    const focus = document.activeElement?.dataset.card;
    key = nextKey; $('game').dataset.phase = s.phase;
    $('table-controls').innerHTML = `${!local && s.phase === 'waiting' ? '<button data-action="invite">Copy invite</button>' : ''}<button data-action="leave">${['waiting', 'complete'].includes(s.phase) ? 'Leave table' : 'Leave & forfeit'}</button>`;
    let content;
    if (s.phase === 'waiting') {
      const ready = s.ready.includes(s.players[me].id);
      content = `<section data-key="table" class="table waiting"><div class="waiting-card-fan">${backs(5,false)}</div><h2>${rival?esc(rival.name)+' has joined':'A seat for a good liar'}</h2><p>${rival?'Both players must be ready before the cards are dealt.':'Waiting for another player.'}</p><div class="ghost-slot">♛</div></section>`;
    } else if (s.phase === 'complete') {
      const draw = s.winner === 'draw', won = s.winner === me;
      content = `<section data-key="result" class="table result">${won ? Array.from({length:28},(_,i)=>`<i class="confetti" style="--x:${i*3.7}%;--delay:${i%7*.11}s;--color:${['#eace91','#b98ac0','#83c5b6'][i%3]}"></i>`).join('') : ''}<img class="result-icon" src="/assets/bluff/images/${won ? 'crown' : draw ? 'coin' : 'skull'}.svg" alt=""><span class="eyebrow">${draw ? 'EVENLY MATCHED' : won ? 'A MASTERCLASS IN MISDIRECTION' : 'THE TABLE HAS TURNED'}</span><h2>${draw ? 'An honest draw.' : won ? 'You played them.' : 'Outbluffed.'}</h2><p>${esc(s.reason)}<br>${draw ? 'Nobody takes the win.' : `${won ? 'You win' : esc(rival?.name || 'Opponent') + ' wins'}.`}<br>You: ${s.counts[me]} cards · ${esc(rival?.name || 'Opponent')}: ${s.counts[other]} cards</p><div class="result-actions">${s.players.length === 2 ? `<button class="primary" data-action="rematch" ${s.rematch.includes(s.players[me].id) ? 'disabled' : ''}>${s.rematch.includes(s.players[me].id) ? 'Waiting for rematch…' : 'Rematch ↗'}</button>` : ''}<button data-action="leave">Create a new game</button></div></section>`;
    } else {
      const reveal = s.phase === 'reveal';
      let message = s.phase === 'select' ? s.locked[me] ? 'Your cards are locked. Keep that poker face.' : 'Every card you play claims to be <b>' + suitName[s.target].toLowerCase() + '</b>.' : reveal ? 'The choices are locked. <b>Let’s see the truth.</b>' : s.decisionLocked[me] ? 'Decision locked. Your rival can’t see your answer.' : `Your rival claims <b>${s.playCounts[other]} ${suitName[s.target].toLowerCase()}</b>. Do you buy it?`;
      content = `<section data-key="table" class="table ${reveal ? 'reveal-table' : ''}"><div class="table-top"><div class="player"><span class="avatar">${rival?.avatar&&/^https:\/\//.test(rival.avatar)?'<img src="'+esc(rival.avatar)+'" alt="">':rival?.bot ? '♜' : esc(rival?.name?.[0] || '?')}</span><div><strong>${esc(rival?.name || 'Opponent')}</strong><small>${reveal ? 'The truth is out' : s.locked[other] ? 'Cards locked · poker face on' : 'Choosing their story…'}</small></div></div><span class="count-pill" aria-label="Opponent has ${s.counts[other]} cards remaining"><b>${s.counts[other]}</b><span>CARDS LEFT</span></span><span class="round-badge">ROUND ${String(s.round).padStart(2, '0')}</span></div><div class="target"><img src="/assets/bluff/images/${s.target}.svg" alt=""><div><small>THE TABLE CALLS FOR</small><b>${suitName[s.target].toUpperCase()}</b></div><div class="timer" id="timer" role="timer" aria-label="Seconds remaining"><strong id="seconds">—</strong></div></div><p class="table-message" aria-live="polite">${message}</p><div class="plays">${[other, me].map(p => {
        const e = s.reveal?.entries[p];
        return `<div data-key="play-${p}" class="play-zone"><p class="play-label">${p === me ? 'YOUR STORY' : 'THEIR STORY'}</p>${reveal ? `<p class="reveal-decision ${e.challenged ? 'challenged' : 'believed'}" role="status">${p === me ? esc(rival.name) + (e.challenged ? ' called your bluff' : ' believed you') : e.challenged ? 'You called their bluff' : 'You believed them'}</p>` : ''}${reveal ? `<div data-key="reveal-${s.match}-${s.round}-${p}" class="reveal-pile">${e.cards.map((c,i)=>card(c,i,true,s.target)).join('')}</div><p class="outcome">${outcome(e)}</p>` : `<div data-key="pile-${p}" class="card-pile">${backs(s.locked[p] ? s.playCounts[p] || 3 : p === me ? selected.size : 0, s.locked[p])}</div><span class="pile-count">${s.locked[p] ? s.phase === 'select' && p !== me ? 'Locked · count hidden' : `${s.playCounts[p]} card${s.playCounts[p] === 1 ? '' : 's'} committed` : p === me ? 'Your secret selection' : 'Waiting for their play'}</span>`}</div>`;
      }).join('')}</div><div class="action-area">${s.phase === 'select' ? `<button class="primary" id="lock" ${s.locked[me] || !selected.size ? 'disabled' : ''}>${s.locked[me] ? '✓ Cards locked' : `Lock ${selected.size || 'your'} card${selected.size === 1 ? '' : 's'} →`}</button><p>${s.locked[me] ? 'Your rival still has to meet the play deadline.' : 'Play any number. Miss the 30-second deadline and you lose.'}</p>` : s.phase === 'decide' ? s.decisionLocked[me] ? `<span class="decision-tag">✓ ${s.myDecision === 'call' ? 'CALL BLUFF' : 'BELIEVE'} LOCKED</span><p>Waiting for the other decision. Then everything flips.</p>` : '<div class="decisions"><button class="secondary" data-choice="believe">Believe them ✓</button><button class="call" data-choice="call">Call bluff !</button></div><p>Wrong accusation? You take their entire play. No answer defaults to Believe.</p>' : '<p class="reveal-countdown">Time to read the table · <b id="next-hand">Next hand in a moment</b></p>'}</div></section><section data-key="hand-panel" class="hand-panel"><div class="hand-head"><h2>Your hand <small>${s.counts[me]} cards</small></h2><div class="hand-tools"><button id="matching" ${s.phase !== 'select' || s.locked[me] ? 'disabled' : ''}>Pick genuine</button><button id="all" ${s.phase !== 'select' || s.locked[me] ? 'disabled' : ''}>Select all</button><button id="clear" ${s.phase !== 'select' || s.locked[me] ? 'disabled' : ''}>Clear</button></div></div><div class="hand ${s.locked[me] ? 'locked' : ''}">${s.hand.map((c,i)=>card(c,i)).join('')}</div><p class="hand-hint">${reveal ? 'Remember what came back. A familiar card can make a convincing lie.' : '<b>Tap cards to select.</b> Genuine, fake, or a little of both. Only you can see your hand.'}</p></section>`;
    }
    const next = document.createElement('template'); next.innerHTML = content;
    const votes=$('game').querySelector('.xg-rematch');if(votes)votes.remove();
    reconcile($('game'), next.content);
    if(votes&&s.phase==='complete')$('game').querySelector('.result-actions')?.append(votes);
    $('app').querySelectorAll('[data-action]').forEach(b => b.onclick = () => b.dataset.action === 'invite' ? copyInvite() : b.dataset.action === 'leave' ? leave() : request(b.dataset.action,{wager:state.wager||0}));
    $('game').querySelectorAll('[data-card]').forEach(b => b.onclick = () => { if (busy || state.phase !== 'select' || state.locked[me]) return; selected.has(b.dataset.card) ? selected.delete(b.dataset.card) : selected.add(b.dataset.card); tone('pick'); updateSelection(); });
    $('game').querySelectorAll('[data-choice]').forEach(b => b.onclick = () => { tone('lock'); request('decide', { choice: b.dataset.choice }); });
    if ($('lock')) $('lock').onclick = () => { if (!selected.size) return; tone('lock'); request('play', { cards: [...selected] }); };
    if ($('matching')) $('matching').onclick = () => { selected = new Set(s.hand.filter(c=>c.suit===s.target).map(c=>c.id)); updateSelection(); };
    if ($('all')) $('all').onclick = () => { selected = new Set(s.hand.map(c=>c.id)); updateSelection(); };
    if ($('clear')) $('clear').onclick = () => { selected.clear(); updateSelection(); };
    if (focus) [...$('game').querySelectorAll('[data-card]')].find(b=>b.dataset.card===focus)?.focus({preventScroll:true});
    const cue = `${s.id}:${s.match}:${s.round}:${s.phase}`;
    if (cue !== lastCue) { lastCue = cue; if (s.phase === 'reveal') tone('reveal'); if (s.phase === 'complete') tone(s.winner === me ? 'win' : s.winner === 'draw' ? 'reveal' : 'lose'); }
    tick();
  }
  function updateSelection() {
    if (!state) return;
    $('game').querySelectorAll('[data-card]').forEach(b=>b.setAttribute('aria-pressed',String(selected.has(b.dataset.card))));
    const lock = $('lock');
    if (lock && !state.locked[state.me]) { lock.disabled = busy || !selected.size; lock.textContent = `Lock ${selected.size || 'your'} card${selected.size === 1 ? '' : 's'} →`; }
    if (state.phase === 'select' && !state.locked[state.me]) {
      const pile = $('game').querySelectorAll('.card-pile')[1]; if (pile) { const next = document.createElement('template'); next.innerHTML = backs(selected.size); reconcile(pile, next.content); }
    }
  }
  function tick() {
    if (!state) return;
    if (local && !busy) {
      const revision = local.revision; rules.bot(local);
      if (revision !== local.revision) { persistLocal(); accept(rules.publicState(local, 'practice:you')); return; }
    }
    if (!$('seconds')) return;
    const seconds = Math.max(0, Math.ceil((state.deadline - Date.now() - clockOffset) / 1000));
    if($('seconds').textContent !== String(seconds)) $('seconds').textContent = seconds;
    const countdown = $('next-hand');
    if(countdown) { const text = (state.counts.some(n=>n===0) ? 'Result' : 'Next hand') + ' in ' + seconds + 's'; if(countdown.textContent !== text)countdown.textContent = text; }
    $('timer').classList.toggle('urgent', seconds <= 5 && state.phase !== 'reveal');
    $('timer').style.setProperty('--progress', Math.min(100, seconds / (state.phase === 'select' ? 30 : state.phase === 'decide' ? 20 : Math.max(1,(state.deadline-state.reveal.at)/1000)) * 100) + '%');
  }
  setInterval(tick, 100); setInterval(poll, 900);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { tick(); poll(); } });
  const invite = new URLSearchParams(location.search).get('room');
  if (invite && /^[A-F0-9]{12}$/.test(invite)) { $('room').value = invite; notice('Your invitation is ready. Press Join table to take your seat.', true); }
  const savedRoom = storage.get('bluff-room');
  if (savedRoom && (!invite || invite === savedRoom)) {
    room = savedRoom; request('get');
  } else if (!invite) {
    try { const saved = JSON.parse(storage.get('bluff-practice')); if (saved?.version === 'BLUFF_OR_BUST_V1') { local = saved; rules.bot(local); accept(rules.publicState(local, 'practice:you')); } } catch { storage.remove('bluff-practice'); }
  }
})();
