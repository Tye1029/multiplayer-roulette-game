/* XAN_HUB_V3_20261011 */
(() => {
 'use strict';
 const $=id=>document.getElementById(id), storage={get(k){try{return localStorage.getItem(k);}catch{return null;}},set(k,v){try{localStorage.setItem(k,v);}catch{}}};
 const games={
  bluff:['Bluff or Bust','2 PLAYERS · FREE PLAY','/assets/bluff/images/cover.svg','Both players secretly play cards claiming the required symbol. Believe or challenge, then reveal everything. A caught bluffer takes their cards back; a false accuser takes the genuine play. Empty your hand after all transfers to win. Lock cards within 30 seconds or lose.','#e9c68a'],
  roulette:['Russian Roulette','2 PLAYERS','/assets/roulette/decor/saloon-room-v3.webp','Take turns with a six-chamber revolver. Follow the table’s shoot, spin and pass controls. Survive your opponent to win the pot, less the displayed house fee.','#e6bf51'],
  rps:['Rock Paper Scissors','2 PLAYERS','/assets/rps/images/coliseum.png','Both players secretly choose rock, paper or scissors. Rock beats scissors, scissors beats paper, and paper beats rock. First to two round wins takes the pot; ties replay. Leaving a funded duel forfeits your stake.','#e55360'],
  fishing:['Fishing Duel','2 PLAYERS','/assets/fishing/images/v2/lake-bg-v2.png','Cast and follow the on-screen bite and pull prompts. Time your inputs to land fish. The highest total catch score at the end of the duel wins.','#61b8ed'],
  safecracker:['Safe Cracker','2 PLAYERS','/assets/safe-cracker/images/bank-vault-wall-v5.png','Race to crack the safe. Follow the dial direction and timing prompts to complete each lock. The first player to finish the heist wins.','#bfc7d1'],
  mountainrace:['Summit Sprint','2 PLAYERS','/assets/mountain-race/images/summit-sprint-reboot-background-v44.png','Climb by entering the directional moves shown on your next holds. Wrong inputs cause a slip. Keep moving: the first climber to reach the summit wins.','#91b480'],
  draw:['DRAW!','2 PLAYERS','/assets/roulette/decor/western-town-frame.png','Wait for the draw signal, then fire as fast as you can. Firing early is a false start. Follow the round prompts to win the duel.','#dca16b'],
  blackjackduel:['Blackjack Duel','2 PLAYERS','/assets/blackjack-duel/images/table-felt.png','Play head-to-head blackjack with your match stack. Choose your bet, then hit or stand to approach 21 without busting. Follow the match’s round and stack rules to beat your opponent.','#ba7897'],
  'roulette-four':['Four-player Roulette','4 PLAYERS','/assets/roulette-four/images/tv-gamblers-v6.png','Four players each stake the chosen wager. Take at least one shot before passing; you get one spin per round. Safe shots bank increasing awards. A live round ends the game: the eliminated player loses their bank and survivors share the remaining pot, weighted by safe shots. Inactivity eliminates a player.','#e6bf51']
 };
 let token='',authPromise=null,pending=false,notifications=[],errors=0,networkErrors=0,refreshTimer;
 const chips=v=>Number(v||0).toLocaleString()+' Chips';
 const element=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 function current(){return window.XanSiteAdapter?.current?.()||{mode:location.pathname.includes('/rps/')?'rps':location.pathname.includes('/roulette-four/')?'roulette-four':'',id:''};}
 async function post(endpoint,body){const r=await fetch('/.netlify/functions/'+endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});const d=await r.json();if(!r.ok||!d.ok){const e=new Error(d.error||'Please retry.');e.status=r.status;throw e;}return d;}
 async function authenticate(){
  if(token)return token;if(authPromise)return authPromise;
  const key=storage.get('tornVisitorApiKey');if(!key)return '';
  authPromise=(async()=>{const d=await post('rps-action',{action:'login',visitorKey:key});token=d.token;return token;})().finally(()=>{authPromise=null;});return authPromise;
 }
 async function api(action,extra={}){const session=await authenticate();try{return await post('site-hub',{action,token:session,...extra});}catch(e){if(e.status===401)token='';throw e;}}
 window.XanHub={authenticate,post,refresh:()=>refresh(),games};
 const bar=element('header',undefined,'xan-bar');bar.innerHTML='<div class="xan-account"><span id="hub-player">WELCOME TO THE ARENA</span><strong id="hub-balance">Connect to play</strong></div><a href="/" class="xan-brand" aria-label="Xan Duels home"><b>XAN</b> DUELS</a><nav class="xan-tools" aria-label="Site controls"><a class="hub-all" href="/">All games</a><button id="hub-bell" aria-label="Notifications" aria-expanded="false"><svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M9 21h6"/></svg></button><button id="hub-menu" aria-label="Open menu" aria-expanded="false"><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button></nav>';
 document.body.prepend(bar);
 const menu=element('section',undefined,'xan-popover');menu.id='hub-menu-panel';menu.hidden=true;menu.innerHTML='<h2>Your settings</h2><label>Sound<input id="hub-sound" type="checkbox"></label><label>Dark mode<input id="hub-dark" type="checkbox"></label><button id="hub-remove">Remove API key</button><button id="hub-report">Report bug / Suggestions</button>';document.body.append(menu);
 const inbox=element('section',undefined,'xan-popover');inbox.id='hub-inbox';inbox.hidden=true;document.body.append(inbox);
 const dialog=element('dialog',undefined,'xan-dialog');dialog.id='hub-dialog';document.body.append(dialog);
 const home=$('simpleTestHome');
 function updateHeader(){
  const c=current(),isHome=home&&!home.hidden;
  const title=$('hub-game-title');if(title)title.textContent=games[c.mode]?.[0]||'Choose a game';
  const preview=$('hub-game-preview');if(preview){const summit=c.mode==='mountainrace'&&window.SummitSceneV68;preview.classList.toggle('hub-summit-preview',Boolean(summit));if(summit){preview.style.backgroundImage='none';window.SummitSceneV68.preview(preview);}else{if(preview.dataset.mrScene){preview.replaceChildren();delete preview.dataset.mrScene;}preview.style.backgroundImage=c.mode?'url(/assets/site-hub/images/'+c.mode+'.webp)':'';}preview.hidden=Boolean(c.id);}
  if($('duelScreen'))$('duelScreen').classList.toggle('hub-has-game',Boolean(c.id));document.documentElement.style.setProperty('--xan-accent',games[c.mode]?.[4]||'#ed555d');
  bar.querySelector('.hub-all').hidden=Boolean(isHome||(!home&&!c.mode));
  $('hub-bell').hidden=!storage.get('tornVisitorApiKey');
  $('hub-sound').checked=!window.XanPreferences.muted;$('hub-dark').checked=document.documentElement.dataset.theme!=='light';
  $('hub-remove').disabled=!storage.get('tornVisitorApiKey');
 }
 function pop(panel,button){const open=panel.hidden;menu.hidden=inbox.hidden=true;panel.hidden=!open;$('hub-menu').setAttribute('aria-expanded',String(!menu.hidden));$('hub-bell').setAttribute('aria-expanded',String(!inbox.hidden));if(open)panel.querySelector('button,a,input')?.focus();}
 $('hub-menu').onclick=()=>{updateHeader();pop(menu,$('hub-menu'));};
 $('hub-sound').onchange=e=>window.XanPreferences.sound(e.target.checked);
 $('hub-dark').onchange=e=>window.XanPreferences.theme(e.target.checked?'dark':'light');
 $('hub-remove').onclick=()=>{
  // Remove credentials and cached identities, while server-owned waiting rooms remain open.
  for(const k of ['tornVisitorApiKey','tornKeyConfirmed','tornVisitorUserId','tornVisitorName','tornVisitorId','xanVisitorId','xanSiteConfirmedBalance','xanSiteSharedState']){try{localStorage.removeItem(k);}catch{}}
  try{sessionStorage.removeItem('rps-token');sessionStorage.removeItem('rps-match');}catch{}
  token='';location.assign('/');
 };
 function closeDialog(){dialog.close();$('hub-menu').focus();}
 function showRules(mode){const g=games[mode];dialog.replaceChildren(element('h2',g[0]),element('p',g[3]));const close=element('button','Got it');close.onclick=closeDialog;dialog.append(close);dialog.showModal();}
 function showReport(){
  menu.hidden=true;dialog.innerHTML='<h2>Report a bug or share an idea</h2><p>Your report goes to the site admin. Debug sends a small diagnostic summary without API keys, request bodies, or hidden game choices.</p><label for="hub-message">What happened?</label><textarea id="hub-message" maxlength="4000" placeholder="What were you doing, and what happened next?"></textarea><div class="hub-actions"><button class="primary" id="hub-send">Send report</button><button id="hub-debug">Send debug</button><button id="hub-close">Close</button></div><p id="hub-report-status" class="hub-status" role="status"></p>';
  $('hub-close').onclick=closeDialog;
  async function send(debug){
   const buttons=[...dialog.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
   try{const c=current();const d=await api('report',{message:$('hub-message').value,debug:debug?{build:'XAN_HUB_V3_20261011',page:location.pathname,mode:c.mode,phase:c.phase,online:navigator.onLine,visibility:document.visibilityState,viewport:{width:innerWidth,height:innerHeight,pixelRatio:devicePixelRatio},errors,networkErrors,...window.XanSiteAdapter?.diagnostics?.()}:undefined});$('hub-report-status').textContent='Sent to the admin inbox. Thank you!';$('hub-message').value='';}catch(e){$('hub-report-status').textContent=e.message;}finally{buttons.forEach(b=>b.disabled=false);}
  }
  $('hub-send').onclick=()=>send(false);$('hub-debug').onclick=()=>send(true);dialog.showModal();
 }
 $('hub-report').onclick=showReport;
 function renderNotifications(){
  inbox.replaceChildren(element('h2','Notifications'));
  if(!notifications.length)inbox.append(element('p','No notifications yet.'));
  for(const n of notifications){const a=element('a',n.payload.name+' joined your '+(games[n.payload.mode]?.[0]||'game'));a.href=n.payload.href;a.append(element('small',new Date(n.created_at).toLocaleString()));inbox.append(a);}
  const count=notifications.filter(n=>!n.seen).length;$('hub-bell').dataset.unread=String(count>0);$('hub-bell').setAttribute('aria-label',count?`${count} unread notifications`:'Notifications');
 }
 $('hub-bell').onclick=async()=>{renderNotifications();pop(inbox,$('hub-bell'));if(!inbox.hidden){const ids=notifications.filter(n=>!n.seen).map(n=>n.id);if(ids.length)try{await api('read',{ids});notifications.forEach(n=>n.seen=true);renderNotifications();}catch{}}};
 document.addEventListener('pointerdown',e=>{if(!bar.contains(e.target)&&!menu.contains(e.target)&&!inbox.contains(e.target)){menu.hidden=inbox.hidden=true;$('hub-menu').setAttribute('aria-expanded','false');$('hub-bell').setAttribute('aria-expanded','false');}});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){menu.hidden=inbox.hidden=true;}});
 function setupHome(){
  if(!home)return;
  const card=home.querySelector('.sth-card'),title=card.querySelector('h1');title.textContent='Pick Your Next Duel!';card.querySelector('p').remove();card.insertBefore(element('div','THE GAMES ROOM','hub-kicker'),title);
  const keyBox=element('section',undefined,'hub-key');title.after(keyBox);
  for(const node of [card.querySelector('.sth-label'),card.querySelector('.sth-row'),$('simpleApiStatus')])if(node)keyBox.append(node);
  keyBox.querySelector('label').textContent='Connect with your public Torn API key';
  const grid=card.querySelector('.sth-games');grid.querySelector('a')?.remove();grid.querySelector('[data-mode=draw]')?.remove();
  for(const mode of ['rps','roulette-four','bluff']){const b=element('button',games[mode][0],'sth-game');b.dataset.mode=mode;b.disabled=true;b.onclick=()=>{if(mode==='bluff'||storage.get('tornKeyConfirmed')==='true')location.assign('/games/multiplayer/'+mode+'/');};grid.append(b);}
  for(const button of [...grid.children]){
    const mode=button.dataset.mode,g=games[mode];if(!g)continue;const tile=element('article',undefined,'hub-tile');button.before(tile);tile.append(button);button.replaceChildren();const img=element('img');img.src=mode==='bluff'?'/assets/bluff/images/cover.svg':'/assets/site-hub/images/'+mode+'.webp';img.alt='';img.width=360;img.height=360;img.loading='lazy';button.append(img);if(['safecracker','blackjackduel','rps'].includes(mode)){const fg=element('img',undefined,'hub-foreground');fg.src='/assets/site-hub/images/'+mode+'-foreground.webp';fg.alt='';fg.loading='lazy';button.append(fg);}
    const label=element('span',undefined,'hub-title');label.append(element('small',g[1]),document.createTextNode(g[0]));button.append(label);const info=element('button','i','hub-info');info.setAttribute('aria-label','Rules for '+g[0]);info.onclick=()=>showRules(mode);tile.append(info);
  }
  const yahtzeeTile=element('article',undefined,'hub-tile');
  const yahtzeeLink=element('a',undefined,'sth-game');yahtzeeLink.href='/games/multiplayer/yahtzee/';
  const yahtzeeArt=element('img');yahtzeeArt.src='/assets/yahtzee/dice.svg';yahtzeeArt.alt='';yahtzeeArt.width=360;yahtzeeArt.height=360;yahtzeeArt.loading='lazy';
  const yahtzeeLabel=element('span',undefined,'hub-title');yahtzeeLabel.append(element('small','2–4 FRIENDS · FREE TO PLAY'),document.createTextNode('Yahtzee'));
  yahtzeeLink.append(yahtzeeArt,yahtzeeLabel);yahtzeeTile.append(yahtzeeLink);grid.append(yahtzeeTile);
  const section=element('section',undefined,'hub-open');section.innerHTML='<div class="hub-heading"><h2>Open Games</h2><span>Join the next game</span></div><div id="hub-games" data-hub-games aria-live="polite"><p class="hub-empty">Connect your public API key to see open games and wagers.</p></div><p id="hub-lobby-status" class="hub-status" role="status"></p>';card.append(section);
  const syncKey=()=>{const ok=storage.get('tornKeyConfirmed')==='true'&&Boolean(storage.get('tornVisitorApiKey'));keyBox.hidden=ok;grid.querySelectorAll('.sth-game').forEach(b=>b.disabled=b.dataset.mode==='bluff'?false:!ok);updateHeader();};
  new MutationObserver(syncKey).observe($('simpleApiStatus'),{childList:true,attributes:true});syncKey();
  new MutationObserver(()=>{updateHeader();if(!home.hidden)refresh();}).observe(home,{attributes:true,attributeFilter:['hidden']});
 }
 function lobbyStatus(text){document.querySelectorAll('#hub-lobby-status,[data-hub-lobby-status]').forEach(e=>e.textContent=text);}
 function renderGames(list){
  for(const root of document.querySelectorAll('[data-hub-games]')){root.replaceChildren();
  const open=list.filter(g=>g.mode!=='draw'&&g.count<g.capacity&&(!g.expiresAt||g.expiresAt>Date.now()));
  if(!open.length){root.append(element('p','No open games yet.','hub-empty'));continue;}
  for(const g of open){
   const row=element('div',undefined,'hub-row'),label=element('div');label.append(element('strong',games[g.mode]?.[0]||g.name),element('small',`${g.creator||'Player'} · ${g.count}/${g.capacity} players${g.mine?' · Your game':''}`));row.append(label,element('div',chips(g.wager),'hub-wager'));const actions=element('div',undefined,'hub-buttons'),join=element('button',g.mine?'Return':'Join');
   join.onclick=async()=>{join.disabled=true;try{
    if(g.mode==='rps'||g.mode==='roulette-four'){location.assign(`/games/multiplayer/${g.mode}/?${g.mode==='rps'?'arena':'room'}=${encodeURIComponent(g.id)}`);}
    else if(window.XanSiteAdapter?.open)await window.XanSiteAdapter.open(g.mode,g.id,!g.mine);else location.assign('/?game='+encodeURIComponent(g.mode)+'&room='+encodeURIComponent(g.id)+(g.mine?'':'&join=1'));
   }catch(e){lobbyStatus(e.message);join.disabled=false;}};actions.append(join);
   if(g.mine&&g.count===1){const cancel=element('button','×','hub-cancel');cancel.setAttribute('aria-label','Cancel '+(games[g.mode]?.[0]||g.name));cancel.onclick=async()=>{cancel.disabled=true;try{if(g.mode==='rps')await post('rps-action',{action:'leave',gameId:g.id,token:await authenticate()});else if(g.mode==='roulette-four')await post('roulette-four-action',{action:'cancel',gameId:g.id,token:await authenticate()});else if(window.XanSiteAdapter?.cancel)await window.XanSiteAdapter.cancel(g.id);else await post('duel-action',{action:'cancel',gameId:g.id,visitorKey:storage.get('tornVisitorApiKey')});await refresh();}catch(e){lobbyStatus(e.message);cancel.disabled=false;}};actions.append(cancel);}
   row.append(actions);root.append(row);
  }
  }
 }

 function setupGameEntry(){
  const legacy=$('duelScreen'),rps=document.querySelector('.lobby-card'),four=$('roulette-four');
  const target=legacy||document.querySelector('main');if(!target||(!legacy&&!rps&&!four))return;
  const heading=element('section',undefined,'hub-game-entry');heading.innerHTML='<div class="hub-game-heading"><span class="hub-kicker">XAN DUELS</span><h1 id="hub-game-title"></h1></div><div class="hub-create-controls"></div>';target.prepend(heading);
  const controls=heading.querySelector('.hub-create-controls');
  if(legacy){
   const fields=document.querySelector('.duel-create-fields');controls.append(fields.querySelector('.duel-compact-field:not(:first-child)'),$('duelCreateBtn'));
   const preview=element('div',undefined,'hub-game-preview');preview.id='hub-game-preview';heading.after(preview);
   const status=$('duelStatus');heading.append(status);
   new MutationObserver(()=>updateHeader()).observe($('duelActive'),{childList:true});
  }else if(rps){
   const label=document.querySelector('label[for=wager]'),box=element('div',undefined,'duel-compact-field');box.append(label,$('wager'));controls.append(box,$('create'));rps.querySelector('h2').textContent='Your gladiator';rps.querySelector('h2+p')?.remove();
  }
  const list=element('section',undefined,'hub-open hub-game-open');list.innerHTML='<div class="hub-heading"><h2>Open Games</h2></div><div data-hub-games><p class="hub-empty">Connect your public API key to see open games.</p></div><p data-hub-lobby-status class="hub-status" role="status"></p>';const footer=target.querySelector(':scope>footer');if(footer)footer.before(list);else target.append(list);
 }
 async function refresh(){
  if(pending||document.hidden||!storage.get('tornVisitorApiKey'))return;
  pending=true;updateHeader();try{const data=await api('sync',{focus:current().id});$('hub-player').textContent=data.player.name;$('hub-balance').textContent=chips(data.balance);renderGames(data.games);notifications=data.notifications;renderNotifications();lobbyStatus('');}catch(e){networkErrors++;lobbyStatus(e.message);}finally{pending=false;}
 }
 window.addEventListener('error',()=>errors++);window.addEventListener('unhandledrejection',()=>errors++);
 window.addEventListener('xan-navigation',()=>{updateHeader();refresh();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
 $('duelModeSelect')?.addEventListener('change',updateHeader);
 setupHome();setupGameEntry();updateHeader();refresh();refreshTimer=setInterval(refresh,15000);
 window.addEventListener('pagehide',()=>clearInterval(refreshTimer));
})();
