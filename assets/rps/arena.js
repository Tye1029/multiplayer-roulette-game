/* HAND_OF_DOOM_V3_20261009 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id), rules = window.RPSRules, audio = window.RPSAudio;
  const debug = window.RPSDebug, cinema = window.RPSCinema.mount(audio,(type,data)=>debug.record(type,data));
  const buttons = [...document.querySelectorAll('[data-choice]')];
  const storage = { get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
    set(k,v) { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k,v); } catch {} } };
  let token = storage.get('rps-token') || '', player = null, game = null, practice = null;
  let busy = false, epoch = 0, pollTimer, polling = false, serverAnchor = Date.now(), perfAnchor = performance.now();
  let lastShot = '', lastReveal = '', lastRound = '', historyKey = '', lastRivalMatch = '';
  const inviteId = new URLSearchParams(location.search).get('arena') || '';
  let gameId = storage.get('rps-match') || '';
  let rival = null, inboxKey = '', inboxBusy = false;
  const preference = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k,v) { try { localStorage.setItem(k,v); } catch {} } };
  let selectedCharacter = rules.character(preference.get('rps-character'));
  const active = () => game && !['complete','cancelled'].includes(game.phase);
  const imagePath = c => `/assets/rps/images/${c.image}?v=2`;
  function showCharacters() {
    const characters = game?.players || [{character:selectedCharacter},{character:selectedCharacter === 'voss' ? 'maximus' : 'voss'}];
    ['A','B'].forEach((seat,i) => {
      const c = rules.CHARACTERS.find(c => c.id === characters[i]?.character) || rules.CHARACTERS[i];
      const img = $('fighter'+seat); if (img.getAttribute('src') !== imagePath(c)) img.src = imagePath(c);
      img.alt = `${c.name}, ${c.title.toLowerCase()}, with hands concealed`;

    });
    for (const b of $('characters').children) { b.setAttribute('aria-pressed',String(b.dataset.character === selectedCharacter)); b.disabled = Boolean(active()) || busy; }
    cinema.setCharacters([0,1].map(i=>rules.character(characters[i]?.character || (i?'voss':selectedCharacter))));
    $('characterHint').textContent = active() ? 'Gladiators are locked for this duel.' : 'If both choose the same fighter, the guest gets the next one.';
  }
  for (const c of rules.CHARACTERS) {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.character = c.id; b.title = c.title;
    const img = document.createElement('img'); img.src = imagePath(c); img.alt = ''; img.width = 60; img.height = 74;
    const name = document.createElement('span'); name.textContent = c.name; b.append(img,name);
    b.onclick = () => { selectedCharacter = c.id; preference.set('rps-character',c.id); showCharacters(); }; $('characters').append(b);
  }
  showCharacters();
  $('joinCode').value = /^[a-f0-9]{12}$/i.test(inviteId) ? inviteId.toUpperCase() : '';
  function status(text, error = false) { for (const id of ['status','lobbyStatus']) { $(id).textContent = text; $(id).classList.toggle('error',error); } }
  function soundLabel() { $('sound').textContent = audio.enabled && audio.unlocked ? 'Sound on' : 'Sound off'; $('sound').setAttribute('aria-pressed', String(audio.enabled && audio.unlocked)); }
  function unlock() { try { audio.unlock(); soundLabel(); } catch {} }
  $('sound').onclick = () => { if (!audio.unlocked && audio.enabled) audio.unlock(); else audio.toggle(); soundLabel(); };
  let calm = preference.get('rps-calm') === '1' || matchMedia('(prefers-reduced-motion: reduce)').matches;
  function motionLabel() { document.body.classList.toggle('calm', calm); $('motion').setAttribute('aria-pressed', String(calm)); $('motion').textContent = calm ? 'Calm camera on' : 'Calm camera'; }
  $('motion').onclick = () => { calm = !calm; preference.set('rps-calm', calm ? '1' : '0'); motionLabel(); }; motionLabel();
  async function request(action, extra = {}) {
    const started = performance.now();
    const response = await fetch('/.netlify/functions/rps-action', { method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ action, token, character:selectedCharacter, ...extra }), signal:AbortSignal.timeout(12000) });
    let data; try { data = await response.json(); } catch { throw new Error('The arena did not respond. Please retry.'); }
    if (!response.ok || !data.ok) {
      debug.record('request-error',{action,status:response.status,ms:Math.round(performance.now()-started)});
      if (response.status === 401 && action !== 'login') { token = ''; storage.set('rps-token', null); connected(false); renderControls(); }
      throw new Error(data.error || 'The arena is unavailable. Please retry.');
    }
    debug.record('request',{action,status:response.status,ms:Math.round(performance.now()-started)});
    if (data.game) data.localServerNow = data.game.serverNow + (performance.now() - started) / 2;
    return data;
  }
  function connected(yes) {
    const occupied = Boolean(active());
    for (const id of ['create','join']) $(id).disabled = busy || occupied;
    $('remoteBot').disabled = busy || (occupied && (game.phase !== 'waiting' || Boolean(game.invitedName)));
    $('remoteBot').innerHTML = game?.phase === 'waiting' && !game.invitedName ? 'Add Remote Network Bot <small>Start this duel</small>' : 'Remote Network Bot <small>Server practice</small>';
    $('refresh').disabled = !yes || busy;
    $('practice').disabled = busy || occupied;
    $('challengeRival').disabled = busy || occupied || !yes || !rival;
    $('leave').disabled = busy;
    for (const b of $('openGames').querySelectorAll('button')) b.disabled = busy || occupied;
    for (const b of $('invitations').querySelectorAll('[data-accept]')) b.disabled = busy || occupied;
    $('loginForm').hidden = yes;
    $('identity').textContent = yes ? `${player?.name || 'Player'} · Verified challenger` : 'Practice is ready. Connect for live 1v1.';
    if (!game) {
      $('nameA').textContent = player?.name || 'You'; $('nameB').textContent = 'Your opponent';
      $('pickTitle').textContent = 'Enter the arena to play.';
    }
    showCharacters();
  }
  async function login(key) {
    if (busy) return; busy = true; $('connect').disabled = true; $('identity').textContent = 'Verifying your Torn identity…';
    try {
      const data = await request('login', {visitorKey:key});
      token = data.token; player = data.player; storage.set('rps-token', token); $('apiKey').value = ''; connected(true);
      await loadLobby(); await loadRivals();
      if (gameId && !practice) { try { await resume(gameId); } catch { gameId = ''; storage.set('rps-match',null); } }
    } catch (e) { connected(false); $('identity').textContent = e.message; status(e.message,true); }
    finally { busy = false; $('connect').disabled = false; connected(Boolean(token)); renderControls(); loadInvitations(); }
  }
  $('loginForm').onsubmit = e => { e.preventDefault(); unlock(); login($('apiKey').value.trim()); };
  async function loadLobby() {
    if (!token) return;
    const data = await request('lobby'); player = data.player; connected(true); $('openGames').replaceChildren();
    if (!game && !$('lobbyStatus').classList.contains('error')) status('Challenge an opponent or warm up with a bot.');
    if (!data.games.length) $('openGames').textContent = 'The sand is yours. Create the first challenge.';
    for (const item of data.games) {
      const b = document.createElement('button'), name = document.createElement('span'), action = document.createElement('b');
      name.textContent = item.name; action.textContent = item.mine ? 'Resume →' : 'Duel →'; b.append(name,action);
      b.disabled = Boolean(game && !['complete','cancelled'].includes(game.phase)); b.onclick = () => perform('join', {gameId:item.id}); $('openGames').append(b);
    }
  }
  async function loadRivals() {
    if (!token) return;
    try {
      const data = await request('rivals'); rival = data.archRival;
      $('archName').textContent = rival ? rival.name : 'No rival yet';
      $('archStats').textContent = rival ? `${rival.matches} matches · You ${rival.wins} — ${rival.losses} ${rival.name}` : 'Finish a human duel to begin your rivalry.';
      connected(Boolean(token));
      $('rivalList').replaceChildren();
      for (const rival of data.opponents.slice(0,8)) {
        const row = document.createElement('div'); row.className = 'rival-row';
        const n = document.createElement('span'), s = document.createElement('b'); n.textContent = rival.name; s.textContent = `${rival.wins} W / ${rival.losses} L`;
        row.append(n,s); $('rivalList').append(row);
      }
    } catch { $('archStats').textContent = 'Rivalry records are temporarily unavailable. Refresh to retry.'; }
  }
  async function loadInvitations() {
    if (!token || inboxBusy || document.hidden) return;
    inboxBusy = true;
    try {
      const data = await request('invitations'), key = JSON.stringify(data.invitations);
      if (key !== inboxKey) {
        inboxKey = key; $('invitations').replaceChildren(); $('invitations').hidden = !data.invitations.length;
        for (const invite of data.invitations) {
          const row = document.createElement('div'), copy = document.createElement('span'), accept = document.createElement('button'), decline = document.createElement('button');
          copy.textContent = `${invite.name} challenges you. The crowd is waiting.`;
          accept.textContent = 'Accept duel'; accept.dataset.accept = 'true';
          accept.onclick = () => perform('join',{gameId:invite.id});
          decline.textContent = 'Decline'; decline.onclick = async () => {
            decline.disabled = true;
            try { await request('decline',{gameId:invite.id}); await loadInvitations(); }
            catch (e) { status(e.message,true); decline.disabled = false; }
          };
          row.append(copy,accept,decline); $('invitations').append(row);
        }
      }
      connected(Boolean(token));
    } catch (e) { if (!token) status(e.message,true); }
    finally { inboxBusy = false; }
  }
  setInterval(loadInvitations,5000);
  function resetPresentation() { cinema.reset(); lastShot = ''; lastRound = ''; lastReveal = ''; historyKey = ''; $('confetti').replaceChildren(); }
  function accept(data) {
    const s = data.game;
    if (game?.id === s.id && (s.revision < game.revision || (s.revision === game.revision && s.serverNow < game.serverNow))) return;
    if (game?.id !== s.id) resetPresentation();
    game = s; gameId = s.id; player = data.player || player;
    serverAnchor = data.localServerNow || s.serverNow; perfAnchor = performance.now();
    if (!practice) storage.set('rps-match', gameId);
    if (s.nextMatch && !practice) { resume(s.nextMatch).catch(e => status(e.message,true)); return; }
    render();
  }
  async function resume(id) { const guard = epoch; const data = await request('get',{gameId:id}); if (guard === epoch) { accept(data); schedulePoll(); } }
  async function perform(action, extra = {}) {
    if (busy) return;
    if (!token) { status('Connect your Torn API key for online duels, or choose Quick practice.',true); $('apiKey').scrollIntoView({block:'center'}); $('apiKey').focus(); return; }
    busy = true; const guard = epoch; unlock();
    connected(Boolean(token)); renderControls();
    try {
      status('Contacting the arena…');
      const data = await request(action,{gameId,...extra});
      if (guard !== epoch) return;
      practice = null; accept(data); schedulePoll();
      if (['create','join','rematch','challenge'].includes(action)) document.querySelector('.game-column').scrollIntoView({block:'start',behavior:calm?'instant':'smooth'});
      if (action === 'leave') exit();
      loadInvitations();
    } catch (e) { if (guard === epoch) status(e.message,true); }
    finally { busy = false; connected(Boolean(token)); renderControls(); }
  }
  function schedulePoll() { clearTimeout(pollTimer); if (practice || !gameId || !token || game?.phase === 'cancelled') return; pollTimer = setTimeout(poll, ['waiting','complete'].includes(game?.phase) ? 1800 : 450); }
  async function poll() {
    if (polling || practice || !gameId || !token) return;
    if (document.hidden) { pollTimer = setTimeout(poll,2000); return; }
    polling = true; const guard = epoch, id = gameId;
    try { const data = await request('get',{gameId:id}); if (guard === epoch && id === gameId) accept(data); }
    catch (e) { if (guard === epoch) status(`${e.message} Reconnecting…`,true); }
    finally { polling = false; if (guard === epoch) schedulePoll(); }
  }
  function startPractice() {
    if (busy || active()) return;
    epoch++; clearTimeout(pollTimer); unlock();
    const now = Date.now(); practice = rules.join(rules.create(`practice-${now}`,{id:'you',name:player?.name || 'You',character:selectedCharacter},now),{id:'bot:emperor',name:'Practice Bot',character:'voss',bot:true},now);
    accept({game:rules.publicState(practice,'you',now)});
    document.querySelector('.game-column').scrollIntoView({block:'start',behavior:calm?'instant':'smooth'});
  }
  function choose(choice) {
    if (!game || busy || game.phase !== 'choosing' || game.locked[game.seat]) return;
    unlock();
    if (practice) {
      const now = Date.now(), bytes = new Uint32Array(1); crypto.getRandomValues(bytes);
      practice = rules.pick(practice,'bot:emperor',rules.CHOICES[bytes[0] % 3],practice.round,now);
      practice = rules.pick(practice,'you',choice,practice.round,now,(practice.round-1)%3);
      accept({game:rules.publicState(practice,'you',now)});
    } else { perform('pick',{choice,round:game.round}); renderControls(); }
  }
  for (const b of buttons) b.onclick = () => choose(b.dataset.choice);
  document.addEventListener('keydown', e => { if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if (['1','2','3'].includes(e.key)) { e.preventDefault(); choose(rules.CHOICES[Number(e.key)-1]); } });
  $('practice').onclick = startPractice;
  $('create').onclick = () => perform('create'); $('remoteBot').onclick = () => perform('create',{bot:true});
  $('challengeRival').onclick = () => perform('challenge');
  $('joinForm').onsubmit = e => { e.preventDefault(); perform('join',{gameId:$('joinCode').value.trim().toUpperCase()}); };
  $('refresh').onclick = () => { loadLobby().catch(e => status(e.message,true)); loadRivals(); loadInvitations(); };
  $('leave').onclick = () => { if (practice) exit(); else perform('leave'); };
  $('backLobby').onclick = exit;
  $('rematch').onclick = () => { if (practice) startPractice(); else perform('rematch'); };
  $('copy').onclick = async () => {
    const url = new URL(location.pathname,location.origin); url.searchParams.set('arena',gameId);
    try { await navigator.clipboard.writeText(url.href); $('copy').textContent = 'Copied!'; }
    catch { $('arenaCode').select(); status('Copy the selected arena code and send it to your rival.'); }
  };
  function exit() {
    epoch++; clearTimeout(pollTimer); practice = null; game = null; gameId = ''; storage.set('rps-match',null); resetPresentation();
    $('arena').dataset.shot = 'wide'; $('arena').classList.remove('celebrate','sudden'); $('invite').hidden = true; $('leave').hidden = true;
    $('hands').setAttribute('aria-hidden','true'); $('matchActions').hidden = true; $('choices').hidden = false;
    $('callout').textContent = 'THE ARENA AWAITS.'; $('subcallout').textContent = 'A new grudge is only three hand gestures away.';
    $('crowdLabel').textContent = 'THE CROWD DEMANDS HANDS'; $('roundLabel').textContent = 'FIRST TO TWO ROUND WINS';
    $('pickTitle').textContent = 'Choose your weapon.'; $('scoreA').textContent = '0'; $('scoreB').textContent = '0'; $('roundHistory').replaceChildren(); $('sealsA').replaceChildren(); $('sealsB').replaceChildren();
    $('announcer').textContent = '“Bring me another unreasonable rivalry!”'; $('practice').disabled = false; buttons.forEach(b => { b.disabled=true; b.classList.remove('selected'); });
    $('modeLabel').textContent = 'THE COLOSSEUM'; $('nameA').textContent = player?.name || 'You'; $('nameB').textContent = 'Your opponent';
    $('lockA').textContent = $('lockB').textContent = 'HAND CONCEALED';
    audio.hush(false); audio.stop(); connected(Boolean(token)); status('Challenge an opponent or warm up with Quick practice.');
    if (token) { loadLobby().catch(e=>status(e.message,true)); loadRivals(); }
  }
  function renderControls() {
    if (!game) return;
    const g = game, ended = ['complete','cancelled'].includes(g.phase);
    buttons.forEach(b => { b.disabled = busy || (!practice && !token) || g.phase !== 'choosing' || g.locked[g.seat]; b.classList.toggle('selected',b.dataset.choice === g.myChoice); });
    $('choices').hidden = ended; $('matchActions').hidden = !ended;
    $('rematch').hidden = g.phase !== 'complete'; $('rematch').disabled = busy || g.rematchVotes.includes(player?.id);
    $('rematch').textContent = g.rematchVotes.includes(player?.id) ? 'Opponent has been challenged…' : 'Demand a rematch';
    $('practice').disabled = !ended; $('leave').hidden = ended;
    $('pickTitle').textContent = ended ? (g.phase === 'complete' ? 'Settle this again?' : 'The duel ended.') : g.phase === 'waiting' ? 'Waiting for an opponent.' : g.locked[g.seat] ? 'Your hand is locked.' : 'Choose your weapon.';
    $('roundHint').textContent = g.suddenDeath && !ended ? '1–1. One hand decides everything.' : 'First to two wins. Ties do not count.';
    connected(Boolean(token));
  }
  function render() {
    const g = game, exhibition = Boolean(practice), bot = g.players.some(p => p.bot);
    $('modeLabel').textContent = exhibition ? 'LOCAL PRACTICE' : bot ? 'REMOTE NETWORK BOT' : 'LIVE 1V1';
    $('nameA').textContent = g.players[0].name + (g.seat === 0 ? ' · YOU' : '');
    $('nameB').textContent = (g.players[1]?.name || 'Awaiting challenger') + (g.seat === 1 ? ' · YOU' : '');
    $('scoreA').textContent = g.scores[0]; $('scoreB').textContent = g.scores[1];
    for(const [i,seat] of ['A','B'].entries()) $('seals'+seat).innerHTML = [0,1].map(n=>`<i class="${g.scores[i]>n?'earned':''}" aria-label="${g.scores[i]>n?'Won':'Needed'}">◆</i>`).join('');
    $('lockA').textContent = g.locked[0] ? 'HAND LOCKED' : 'HAND CONCEALED'; $('lockB').textContent = g.locked[1] ? 'HAND LOCKED' : 'HAND CONCEALED';
    $('invite').hidden = exhibition || bot || g.phase !== 'waiting'; $('arenaCode').value = g.id;
    renderControls();
    const hKey = JSON.stringify(g.history);
    if (hKey !== historyKey) { historyKey = hKey; $('roundHistory').replaceChildren(); for (const r of g.history) {
      const el = document.createElement('span'); el.textContent = `R${r.round} · ${r.picks.join(' / ')} · ${r.winner === null ? 'Tie' : r.winner === g.seat ? 'Win' : 'Loss'}`; $('roundHistory').append(el);
    } }
    if (g.phase === 'waiting') status(g.invitedName ? `Invitation sent to ${g.invitedName}. They can accept in this arena within 15 minutes.` : 'Waiting for an opponent. Share your code, or add the Network Bot to play now.');
    if (g.phase === 'choosing') status(g.locked[g.seat] ? 'Hand locked. Waiting for your opponent…' : 'Pick a hand. Your rival cannot see it until both hands are locked.');
    if (g.phase === 'reveal') status('Both hands locked. Prepare for a wildly excessive reveal.');
    if (g.phase === 'cancelled') status(g.reason);
    if (g.phase === 'complete') {
      status(exhibition || bot ? 'Exhibition complete. Bot matches never affect rivalry records.' : 'Match complete. Your rivalry record is saved.');
      if (!exhibition && lastRivalMatch !== g.id) { lastRivalMatch = g.id; loadRivals(); }
    }
    tick();
  }
  function showShot(shot) {
    if (shot === lastShot) return;
    $('arena').dataset.shot = shot; lastShot = shot;

  }
  function tick() {
    if (!game || document.hidden) return;
    const g = game, now = serverAnchor + performance.now() - perfAnchor;
    cinema.draw(g,now,calm);
    $('arena').dataset.variant = String(g.variant);
    const finished = g.phase === 'complete';
    const revealed = Boolean(g.picks && (g.phase === 'reveal' || finished));
    const quiet = g.suddenDeath && !finished && !(revealed && g.winner !== null);
    $('arena').classList.toggle('sudden',quiet); audio.hush(quiet);
    $('crowdLabel').textContent = quiet ? 'YOU COULD HEAR A SAND GRAIN DROP.' : finished ? 'THE COLOSSEUM HAS LOST ITS MIND' : 'THE CROWD DEMANDS HANDS';
    if (g.phase === 'waiting') { showShot('wide'); $('callout').textContent = 'THE CHALLENGE IS SET.'; $('subcallout').textContent = g.invitedName ? `${g.invitedName}, the arena calls.` : 'An opponent, a grudge, or just a quick warm-up.'; return; }
    if (g.phase === 'cancelled') { showShot('wide'); $('callout').textContent = 'THE CROWD WANTS A REFUND.'; $('subcallout').textContent = 'Nobody won. Start a fresh duel.'; return; }
    const roundKey = `${g.id}:${g.round}`;
    if (g.phase === 'choosing') {
      showShot('wide'); $('arena').classList.remove('celebrate'); $('confetti').replaceChildren();
      $('roundLabel').textContent = `ROUND ${g.round} · ${g.suddenDeath ? 'THE DECIDING HAND' : 'FIRST TO TWO'}`;
      $('callout').textContent = g.suddenDeath ? 'THE ENTIRE ARENA GOES QUIET.' : g.locked[g.seat] ? 'YOUR FATE IS SEALED.' : 'CHOOSE YOUR FATE.';
      $('subcallout').textContent = g.locked[g.seat] ? 'Your hand stays secret. Let them sweat.' : 'A fist. A palm. Two fingers. An absurd amount of glory.';
      if (lastRound !== roundKey) { lastRound = roundKey; audio.round(g.round,g.suddenDeath); $('announcer').textContent = g.suddenDeath ? '“One hand. One legend. Even the emperor has stopped chewing.”' : '“Behold! The most consequential finger arrangement of your life!”'; }
      return;
    }
    if (!revealed) {

      $('roundLabel').textContent = `ROUND ${g.round} · BOTH HANDS LOCKED`;
      $('callout').textContent = ['DESTINY HAS FINGERS.','BEHOLD THE TECHNIQUE.','THIS IS EXTREMELY SERIOUS.'][g.variant];
      $('subcallout').textContent = 'The reveal is coming…'; return;
    }
    showShot('hands'); $('hands').setAttribute('aria-hidden','false');
    if (lastReveal !== roundKey) {
      lastReveal = roundKey;

      audio.cue('impact');
      const tie = g.roundWinner === null;
      if (!quiet) audio.cue('cheer');
      audio.result({tie,won:g.winner!==null,youWon:g.winner===g.seat,flawless:g.winner!==null && g.scores[1-g.winner]===0,round:g.round});
      $('announcer').textContent = g.winner !== null ? '“A champion! Tell the historians to write down… rock, paper, scissors!”' : tie ? '“A draw! All that drama for absolutely nothing. AGAIN!”' : ({rock:'“An immovable fist! An entirely predictable geological victory!”',paper:'“Devastated by stationery! The scholars were right!”',scissors:'“Two fingers! One legend! Someone alert the tailors!”'}[g.picks[g.roundWinner]]);
    }
    const won = g.winner !== null, tie = g.roundWinner === null;
    $('roundLabel').textContent = won ? 'THE COLOSSEUM CROWNS ITS CHAMPION' : `ROUND ${g.round} · ${tie ? 'TIE — REPLAY' : 'A POINT OF GLORY'}`;
    $('callout').textContent = won ? (g.winner === g.seat ? 'YOU ARE THE HAND OF DOOM.' : `${g.players[g.winner].name.toUpperCase()} WINS.`) : tie ? 'IDENTICAL GENIUS. GO AGAIN.' : g.roundWinner === g.seat ? 'YOUR HAND. YOUR GLORY.' : 'A DEVASTATING HAND GESTURE.';
    $('subcallout').textContent = won ? `${g.scores[0]} — ${g.scores[1]} · ${g.winner === g.seat ? 'The crowd will never forget those fingers.' : 'Your revenge arc starts with a rematch.'}` : tie ? 'No point awarded. New hands in a moment.' : `${g.picks[g.roundWinner]} beats ${g.picks[1-g.roundWinner]}. Next hand coming right up.`;
    $('arena').classList.toggle('celebrate',won);
    if (won && !$('confetti').childElementCount) for (let i=0;i<24;i++) { const p = document.createElement('i'); p.style.setProperty('--x',`${(i*37)%100}%`); p.style.setProperty('--delay',`${(i%7)*.13}s`); $('confetti').append(p); }
  }
  setInterval(() => {
    if (practice && !document.hidden) {
      practice = rules.advance(practice); const s = rules.publicState(practice,'you');
      if (s.revision !== game?.revision || Boolean(s.picks) !== Boolean(game?.picks)) accept({game:s});
    }
    tick();
  },100);
  window.addEventListener('pagehide',()=>{epoch++;clearTimeout(pollTimer);});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden && gameId && !practice) schedulePoll();});
  async function boot() {
    if (token) {
      try { await loadLobby(); await loadRivals(); await loadInvitations(); if (gameId) await resume(gameId); return; }
      catch (e) { status(e.message,true); }
    }
    let savedKey = ''; try { savedKey = localStorage.getItem('tornVisitorApiKey') || ''; } catch {}
    if (savedKey) await login(savedKey);
  }
  debug.install(()=>({session:{connected:Boolean(token),busy,polling,mode:practice?'local':'network'},match:game?{id:game.id,phase:game.phase,round:game.round,revision:game.revision,seat:game.seat,scores:game.scores,locked:game.locked,characters:game.players.map(p=>p.character),serverOffsetMs:Math.round(serverAnchor+performance.now()-perfAnchor-Date.now())}:null,media:{...cinema.diagnostics(),audio:audio.diagnostics()},calm}));
  boot();
})();
