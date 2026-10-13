/* XAN_HUB_V4_SHARED_DEBUG · XAN_HOME_READY_V1 · XAN_SESSION_REUSE_V1 */
(() => {
 'use strict';
 const $=id=>document.getElementById(id), storage={get(k){try{return localStorage.getItem(k);}catch{return null;}},set(k,v){try{localStorage.setItem(k,v);}catch{}}};
 const games={
  luckydice:['Lucky Dice','SINGLE PLAYER','/assets/dice-duel/lucky-cover.svg?v=DICE_V2','Choose higher or lower, set your number, and roll two dice. A bolder prediction pays more.','#90d5c2'],
  diceduel:['Dice Duel','2 PLAYERS','/assets/dice-duel/cover.svg?v=DICE_V2','Two players. Two dice each. Higher total wins the pot. Ties roll again.','#90d5c2'],
  rocket:['Rocket Run','SINGLE PLAYER','/assets/rocket-run/cover.svg?v=ROCKET_RUN_V1','Ride a rising multiplier and cash out before the rocket crashes. Set an optional auto cash-out and choose when to come back down.','#e9b292'],
  plinko:['Plinko','SINGLE PLAYER','/assets/plinko/cover.svg?v=PLINKO_V1','Drop a golden ball through sixteen rows of pegs. Pick your risk and follow every bounce into a prize pocket.','#83cbd7'],
  minefield:['Minefield','SINGLE PLAYER','/assets/minefield/cover.svg?v=MINEFIELD_V2','Choose your mine count, uncover diamonds, and cash out before you hit a mine. Every safe find grows your return.','#cdd0d5'],
  junction:['Jackpot Junction','SINGLE PLAYER','/assets/jackpot-junction/cover.svg','Pull the handle, match three symbols, and take a chance at the shared growing jackpot.','#e9cf91'],
  scratch:['Lucky Scratch','SINGLE PLAYER','/assets/lucky-scratch/cover.svg','Choose a ticket, scratch the nine panels, and match three prize amounts to win. Bigger tickets offer bigger prizes.','#efd493'],
  minigolf:['Pocket Putt','2 PLAYERS','/assets/mini-golf/cover.svg','Pull back, pick your line, and putt. Twenty courses, 60 unique holes, and a few very hungry hippos. Pick your challenge, from Beginner to Expert. Lowest total strokes wins.','#d4ee94'],
  yahtzee:['Yahtzee','2 PLAYERS','/assets/yahtzee/dice.svg','Both players get 30 seconds per round to roll, hold dice, and choose one category. Roll up to three times. Highest score after 13 rounds wins.','#67b47c'],
  bluff:['Bluff or Bust','2 PLAYERS','/assets/bluff/images/cover.svg','Both players secretly play cards claiming the required symbol. Believe or challenge, then reveal everything. A caught bluffer takes their cards back; a false accuser takes the genuine play. Empty your hand after all transfers to win. Lock cards within 30 seconds or lose.','#e9c68a'],
  roulette:['Russian Roulette','2 PLAYERS','/assets/roulette/decor/saloon-room-v3.webp','Take turns with a six-chamber revolver. Follow the table’s shoot, spin and pass controls. Survive your opponent to win the pot.','#e6bf51'],
  rps:['Rock Paper Scissors','2 PLAYERS','/assets/rps/images/coliseum.png','Both players secretly choose rock, paper or scissors. Rock beats scissors, scissors beats paper, and paper beats rock. First to two round wins takes the pot; ties replay. Leaving a funded duel forfeits your stake.','#963b43'],
  fishing:['Fishing Duel','2 PLAYERS','/assets/fishing/images/v2/lake-bg-v2.png','One cast. Bigger ripples mean bigger fish. Choose your moment: the largest catch wins.','#61b8ed'],
  safecracker:['Safe Cracker','2 PLAYERS','/assets/safe-cracker/images/bank-vault-wall-v5.png','Race to crack the safe. Follow the dial direction and timing prompts to complete each lock. The first player to finish the heist wins.','#bfc7d1'],
  mountainrace:['Summit Sprint','2 PLAYERS','/assets/mountain-race/images/summit-sprint-reboot-background-v44.png','Climb by entering the directional moves shown on your next holds. Wrong inputs cause a slip. Keep moving: the first climber to reach the summit wins.','#91b480'],
  draw:['DRAW!','2 PLAYERS','/assets/roulette/decor/western-town-frame.png','Wait for the draw signal, then fire as fast as you can. Firing early is a false start. Follow the round prompts to win the duel.','#dca16b'],
  blackjackduel:['Blackjack Duel','2 PLAYERS','/assets/blackjack-duel/images/table-felt.png','Play head-to-head blackjack with your match stack. Choose your bet, then hit or stand to approach 21 without busting. Follow the match’s round and stack rules to beat your opponent.','#ba7897'],
  'roulette-four':['Four-player Roulette','4 PLAYERS','/assets/roulette-four/images/tv-gamblers-v6.png','Four players each stake the chosen wager. Take at least one shot before passing; you get one spin per round. Safe shots bank increasing awards. A live round ends the game: the eliminated player loses their bank and survivors share the remaining pot, weighted by safe shots. Inactivity eliminates a player.','#e6bf51']
 };
 let token='',tokenKey='',authKey='',authPromise=null,pending=false,notifications=[],errors=0,networkErrors=0,refreshTimer;
 const chips=v=>Number(v||0).toLocaleString()+' Chips';
 const element=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 function current(){return window.XanSiteAdapter?.current?.()||{mode:location.pathname.includes('/rps/')?'rps':location.pathname.includes('/roulette-four/')?'roulette-four':'',id:''};}
 function clearSession(){token='';tokenKey='';try{sessionStorage.removeItem('xan-hub-session');}catch{}}
 async function post(endpoint,body,retried=false){const keyAtSend=storage.get('tornVisitorApiKey'),r=await fetch('/.netlify/functions/'+endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});const d=await r.json();if(!r.ok||!d.ok){
   // Only an authentication rejection is replayed. Mutations retain their
   // original receipt, and the server still verifies every request.
   if(r.status===401&&body.token&&endpoint!=='rps-action'&&!retried&&keyAtSend===storage.get('tornVisitorApiKey')){if(body.token===token)clearSession();const renewed=await authenticate();if(renewed)return post(endpoint,{...body,token:renewed},true);}
   const e=new Error(d.error||'Please retry.');e.status=r.status;throw e;
  }return d;}
 async function authenticate(){
  const key=storage.get('tornVisitorApiKey');if(!key){clearSession();return '';}
  if(token&&tokenKey===key)return token;if(authPromise&&authKey===key)return authPromise;
  authKey=key;
  const operation=(async()=>{
   let keyHash='';try{keyHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key))),n=>n.toString(16).padStart(2,'0')).join('');}catch{}
   let cached;try{cached=JSON.parse(sessionStorage.getItem('xan-hub-session'));}catch{}
   if(keyHash&&cached?.keyHash===keyHash&&cached.expiresAt>Date.now()&&/^[a-f0-9]{64}$/.test(cached.token)){
    if(storage.get('tornVisitorApiKey')!==key)throw Error('Your profile changed. Please reconnect.');token=cached.token;tokenKey=key;return token;
   }
   const d=await post('rps-action',{action:'login',visitorKey:key});if(storage.get('tornVisitorApiKey')!==key)throw Error('Your profile changed. Please reconnect.');token=d.token;tokenKey=key;
   if(keyHash)try{sessionStorage.setItem('xan-hub-session',JSON.stringify({keyHash,token,expiresAt:Date.now()+10*60*60*1000}));}catch{}
   return token;
  })();authPromise=operation;try{return await operation;}finally{if(authPromise===operation){authPromise=null;authKey='';}}
 }
 async function api(action,extra={}){const session=await authenticate();try{return await post('site-hub',{action,token:session,...extra});}catch(e){if(e.status===401)clearSession();throw e;}}
 async function cancelTable(mode,id){const token=await authenticate();if(mode==='diceduel')await post('dice-duel-multiplayer-action',{action:'cancel',room:id,requestId:crypto.randomUUID(),token});else if(mode==='yahtzee')await post('yahtzee-action',{action:'cancel',room:id,requestId:crypto.randomUUID(),token});else if(mode==='minigolf')await post('mini-golf-action',{action:'cancel',gameId:id,token});else if(['rps','roulette-four','bluff'].includes(mode))await post(mode+'-action',{action:'cancel',gameId:id,token});else if(window.XanSiteAdapter?.cancel)await window.XanSiteAdapter.cancel(id);else await post('duel-action',{action:'cancel',gameId:id,visitorKey:storage.get('tornVisitorApiKey')});await window.XanSiteAdapter?.dismissCancelled?.(id);await refresh();}
 window.XanHub={authenticate,post,api,cancelTable,refresh:()=>refresh(),games,get profile(){return window.XanPlayerProfile;}};
 const bar=element('header',undefined,'xan-bar');bar.innerHTML='<div class="xan-account"><span id="hub-player">WELCOME TO THE ARENA</span><strong id="hub-balance">Connect to play</strong></div><a href="/" class="xan-brand" aria-label="Xan Duels home"><b>XAN</b> DUELS</a><nav class="xan-tools" aria-label="Site controls"><a class="hub-all" href="/">All games</a><button id="hub-bell" aria-label="Notifications" aria-expanded="false"><svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M9 21h6"/></svg></button><button id="hub-menu" aria-label="Open menu" aria-expanded="false"><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button></nav>';
 document.body.prepend(bar);
 // Account controls can wrap on phones; launcher and menus follow the actual bar.
 let headerHeight=0;
 const measureHeader=()=>{const next=Math.ceil(bar.getBoundingClientRect().height);if(next!==headerHeight){headerHeight=next;document.documentElement.style.setProperty('--xan-header-height',next+'px');}};
 new ResizeObserver(measureHeader).observe(bar);measureHeader();
 const menu=element('section',undefined,'xan-popover');menu.id='hub-menu-panel';menu.hidden=true;menu.innerHTML='<h2>Your settings</h2><label>Sound<input id="hub-sound" type="checkbox"></label><label>Dark mode<input id="hub-dark" type="checkbox"></label><button id="hub-add-bot">Add bot</button><button id="hub-diagnostics">Debug</button><button id="hub-remove">Remove API key</button><button id="hub-report">Report bug / Suggestions</button>';document.body.append(menu);
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
  $('hub-add-bot').hidden=!window.XanGameMenu?.canAddBot;$('hub-remove').disabled=!storage.get('tornVisitorApiKey');
 }
 function pop(panel,button){const open=panel.hidden;menu.hidden=inbox.hidden=true;panel.hidden=!open;$('hub-menu').setAttribute('aria-expanded',String(!menu.hidden));$('hub-bell').setAttribute('aria-expanded',String(!inbox.hidden));if(open)panel.querySelector('button,a,input')?.focus();}
 $('hub-menu').onclick=()=>{updateHeader();pop(menu,$('hub-menu'));};
 $('hub-sound').onchange=e=>window.XanPreferences.sound(e.target.checked);
 $('hub-dark').onchange=e=>window.XanPreferences.theme(e.target.checked?'dark':'light');
 $('hub-remove').onclick=()=>{
  // Remove credentials and cached identities, while server-owned waiting rooms remain open.
  for(const k of ['tornVisitorApiKey','tornKeyConfirmed','tornVisitorUserId','tornVisitorName','tornVisitorId','xanVisitorId','xanSiteConfirmedBalance','xanSiteSharedState']){try{localStorage.removeItem(k);}catch{}}
  try{sessionStorage.removeItem('rps-token');sessionStorage.removeItem('rps-match');}catch{}
  clearSession();location.assign('/');
 };
 function closeDialog(){dialog.close();$('hub-menu').focus();}
 function diagnosticSnapshot(){
  const a=window.XanSiteAdapter,c=current(),v=a?.view?.()||{},d=a?.diagnostics?.()||{};
  const numeric=n=>Number.isFinite(Number(n))?Math.max(0,Math.min(1e9,Number(n))):0;
  const word=s=>String(s||'').replace(/[^a-zA-Z0-9_./ -]/g,'').slice(0,100);
  // Explicit fields only: never copy adapter state, storage, URLs with invite codes, or card choices.
  return {build:'XAN_HUB_V4_SHARED_DEBUG',gameBuild:word(d.build),page:location.pathname,mode:word(c.mode||'home'),phase:word(c.phase||v.phase||'lobby'),
   capturedAt:new Date().toISOString(),online:navigator.onLine,visibility:document.visibilityState,
   viewport:{width:innerWidth,height:innerHeight,pixelRatio:devicePixelRatio},
   active:Boolean(c.id||v.id),players:v.players?.length||0,match:numeric(v.match),round:numeric(d.round),revision:numeric(d.revision),
   busy:Boolean(d.busy),polling:Boolean(d.polling),connecting:Boolean(v.connecting||d.connecting),lastResponseMs:numeric(d.lastResponseMs),
   errors,networkErrors:networkErrors+numeric(d.networkErrors),frames:numeric(d.frames),slowFrames:numeric(d.slowFrames),longestFrameMs:numeric(d.longestFrameMs)};
 }
 function showDebug(){
  menu.hidden=true;$('hub-menu').setAttribute('aria-expanded','false');
  dialog.innerHTML='<h2>Game debug</h2><p>Current game, connection, screen size, and error counts. Refresh after an issue, then copy the details to help diagnose it. Your API key and hidden choices are excluded.</p><label for="hub-debug-data">Diagnostic details</label><textarea id="hub-debug-data" class="hub-debug-data" readonly spellcheck="false"></textarea><div class="hub-actions"><button id="hub-debug-refresh">Refresh details</button><button id="hub-debug-copy">Copy debug</button><button id="hub-close">Close</button></div><p id="hub-debug-status" class="hub-status" role="status"></p>';
  const capture=()=>{$('hub-debug-data').value=JSON.stringify(diagnosticSnapshot(),null,2);$('hub-debug-status').textContent='Details updated. The game clock continues while this panel is open.';};
  $('hub-debug-refresh').onclick=capture;$('hub-close').onclick=closeDialog;
  $('hub-debug-copy').onclick=async()=>{try{await navigator.clipboard.writeText($('hub-debug-data').value);$('hub-debug-status').textContent='Debug details copied.';}catch{$('hub-debug-data').focus();$('hub-debug-data').select();$('hub-debug-status').textContent='Details selected. Use your device’s Copy command.';}};
  capture();dialog.showModal();$('hub-debug-refresh').focus();$('hub-debug-data').scrollTop=0;
 }
 function showRules(mode){const g=games[mode];const list=element('ol');for(const step of (window.XanRules?.[mode]||[g[3]]))list.append(element('li',step));dialog.replaceChildren(element('h2',g[0]),list);const close=element('button','Got it');close.onclick=closeDialog;dialog.append(close);dialog.showModal();}
 function showReport(){
  menu.hidden=true;dialog.innerHTML='<h2>Report a bug or share an idea</h2><p>Your report goes to the site admin. Debug sends a small diagnostic summary without API keys, request bodies, or hidden game choices.</p><label for="hub-message">What happened?</label><textarea id="hub-message" maxlength="4000" placeholder="What were you doing, and what happened next?"></textarea><div class="hub-actions"><button class="primary" id="hub-send">Send report</button><button id="hub-debug">Send debug</button><button id="hub-close">Close</button></div><p id="hub-report-status" class="hub-status" role="status"></p>';
  $('hub-close').onclick=closeDialog;
  async function send(debug){
   const buttons=[...dialog.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
   try{await api('report',{message:$('hub-message').value,debug:debug?diagnosticSnapshot():undefined});$('hub-report-status').textContent='Sent to the admin inbox. Thank you!';$('hub-message').value='';}catch(e){$('hub-report-status').textContent=e.message;}finally{buttons.forEach(b=>b.disabled=false);}
  }
  $('hub-send').onclick=()=>send(false);$('hub-debug').onclick=()=>send(true);dialog.showModal();
 }
 $('hub-diagnostics').onclick=showDebug;$('hub-report').onclick=showReport;$('hub-add-bot').onclick=async()=>{menu.hidden=true;try{await window.XanGameMenu?.addBot?.();}catch(e){lobbyStatus(e.message);}};
 function renderNotifications(){
  inbox.replaceChildren(element('h2','Notifications'));
  if(!notifications.length)inbox.append(element('p','No notifications yet.'));
  for(const n of notifications){const a=element('a',n.payload.message||(n.payload.name+' is ready to play'));a.href=n.payload.href;a.append(element('small',new Date(n.created_at).toLocaleString()));inbox.append(a);}
  const count=notifications.filter(n=>!n.seen).length;$('hub-bell').dataset.unread=String(count>0);$('hub-bell').setAttribute('aria-label',count?`${count} unread notifications`:'Notifications');
 }
 $('hub-bell').onclick=async()=>{renderNotifications();pop(inbox,$('hub-bell'));if(!inbox.hidden){const ids=notifications.filter(n=>!n.seen).map(n=>n.id);if(ids.length)try{await api('read',{ids});notifications.forEach(n=>n.seen=true);renderNotifications();}catch{}}};
 document.addEventListener('pointerdown',e=>{if(!bar.contains(e.target)&&!menu.contains(e.target)&&!inbox.contains(e.target)){menu.hidden=inbox.hidden=true;$('hub-menu').setAttribute('aria-expanded','false');$('hub-bell').setAttribute('aria-expanded','false');}});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){menu.hidden=inbox.hidden=true;}});
 function setupHome(){
  if(!home)return;
  const card=home.querySelector('.sth-card'),title=card.querySelector('h1');title.textContent='Pick Your Next Game!';card.querySelector('p').remove();card.insertBefore(element('div','THE GAMES ROOM','hub-kicker'),title);
  const keyBox=element('section',undefined,'hub-key');title.after(keyBox);
  for(const node of [card.querySelector('.sth-label'),card.querySelector('.sth-row'),$('simpleApiStatus')])if(node)keyBox.append(node);
  keyBox.querySelector('label').textContent='Connect with your public Torn API key';
  const grid=card.querySelector('.sth-games');grid.querySelector('[data-mode=draw]')?.remove();grid.querySelector('[data-mode=blackjackduel]')?.remove();
  for(const mode of ['rps','roulette-four','bluff']){const b=element('button',games[mode][0],'sth-game');b.dataset.mode=mode;b.disabled=true;b.onclick=()=>{if(mode==='bluff'||storage.get('tornKeyConfirmed')==='true')location.assign('/games/multiplayer/'+mode+'/');};grid.append(b);}
  for(const button of [...grid.children]){
    const mode=button.dataset.mode,g=games[mode];if(!g)continue;const tile=element('article',undefined,'hub-tile');button.before(tile);tile.append(button);button.replaceChildren();const img=element('img');img.src=mode==='bluff'?'/assets/bluff/images/cover.svg':'/assets/site-hub/images/'+mode+'.webp';img.alt='';img.width=360;img.height=360;img.loading='lazy';button.append(img);if(['safecracker','blackjackduel','rps'].includes(mode)){const fg=element('img',undefined,'hub-foreground');fg.src='/assets/site-hub/images/'+mode+'-foreground.webp';fg.alt='';fg.loading='lazy';button.append(fg);}
    const label=element('span',undefined,'hub-title');label.append(element('small',g[1]),document.createTextNode(g[0]));button.append(label);const info=element('button','i','hub-info');info.setAttribute('aria-label','Rules for '+g[0]);info.onclick=()=>showRules(mode);tile.append(info);
  }
  const yahtzeeTile=element('article',undefined,'hub-tile');
  const yahtzeeLink=element('a',undefined,'sth-game');yahtzeeLink.href='/games/multiplayer/yahtzee/';
  const yahtzeeArt=element('img');yahtzeeArt.src='/assets/yahtzee/dice.svg';yahtzeeArt.alt='';yahtzeeArt.width=360;yahtzeeArt.height=360;yahtzeeArt.loading='lazy';
  const yahtzeeLabel=element('span',undefined,'hub-title');yahtzeeLabel.append(element('small','2 PLAYERS · 30-SECOND ROUNDS'),document.createTextNode('Yahtzee'));
  yahtzeeLink.append(yahtzeeArt,yahtzeeLabel);yahtzeeTile.append(yahtzeeLink);grid.append(yahtzeeTile);
  const golfTile=element('article',undefined,'hub-tile'),golfLink=element('a',undefined,'sth-game'),golfArt=element('img'),golfLabel=element('span',undefined,'hub-title');golfLink.href='/games/multiplayer/mini-golf/';golfArt.src='/assets/mini-golf/cover.svg';golfArt.alt='';golfArt.width=360;golfArt.height=360;golfArt.loading='lazy';golfLabel.append(element('small','2 PLAYERS · 60 UNIQUE HOLES'),document.createTextNode('Pocket Putt'));golfLink.append(golfArt,golfLabel);golfTile.append(golfLink);grid.append(golfTile);
  const duelTile=element('article',undefined,'hub-tile'),duelLink=element('a',undefined,'sth-game'),duelArt=element('img'),duelLabel=element('span',undefined,'hub-title');duelLink.href='/games/multiplayer/dice-duel/';duelArt.src=games.diceduel[2];duelArt.alt='';duelArt.width=360;duelArt.height=390;duelArt.loading='lazy';duelLabel.append(element('small','2 PLAYERS · HIGH ROLL WINS'),document.createTextNode('Dice Duel'));duelLink.append(duelArt,duelLabel);duelTile.append(duelLink);grid.append(duelTile);
  const multiplayer=element('h2','Multiplayer','hub-section-title');grid.before(multiplayer);
  const singleHeading=element('h2','Single Player','hub-section-title'),singleGrid=element('div',undefined,'sth-games hub-single-games');singleGrid.setAttribute('aria-label','Single player games');
  const scratchTile=element('article',undefined,'hub-tile'),scratchLink=element('a',undefined,'sth-game'),scratchArt=element('img'),scratchLabel=element('span',undefined,'hub-title');scratchLink.href='/games/single-player/lucky-scratch/';scratchArt.src='/assets/lucky-scratch/cover.svg';scratchArt.alt='';scratchArt.width=360;scratchArt.height=360;scratchArt.loading='lazy';scratchLabel.append(element('small','SINGLE PLAYER · SCRATCH & MATCH'),document.createTextNode('Lucky Scratch'));scratchLink.append(scratchArt,scratchLabel);scratchTile.append(scratchLink);singleGrid.append(scratchTile);grid.after(singleHeading,singleGrid);
  const junctionTile=element('article',undefined,'hub-tile'),junctionLink=element('a',undefined,'sth-game'),junctionArt=element('img'),junctionLabel=element('span',undefined,'hub-title');junctionLink.href='/games/single-player/jackpot-junction/';junctionArt.src='/assets/jackpot-junction/cover.svg';junctionArt.alt='';junctionArt.width=360;junctionArt.height=360;junctionArt.loading='lazy';junctionLabel.append(element('small','SINGLE PLAYER · GROWING JACKPOT'),document.createTextNode('Jackpot Junction'));junctionLink.append(junctionArt,junctionLabel);junctionTile.append(junctionLink);singleGrid.append(junctionTile);
  const mineTile=element('article',undefined,'hub-tile'),mineLink=element('a',undefined,'sth-game'),mineArt=element('img'),mineLabel=element('span',undefined,'hub-title');mineLink.href='/games/single-player/minefield/';mineArt.src='/assets/minefield/cover.svg?v=MINEFIELD_V2';mineArt.alt='';mineArt.width=360;mineArt.height=360;mineArt.loading='lazy';mineLabel.append(element('small','SINGLE PLAYER · PICK & CASH OUT'),document.createTextNode('Minefield'));mineLink.append(mineArt,mineLabel);mineTile.append(mineLink);singleGrid.append(mineTile);
  const plinkoTile=element('article',undefined,'hub-tile'),plinkoLink=element('a',undefined,'sth-game'),plinkoArt=element('img'),plinkoLabel=element('span',undefined,'hub-title');plinkoLink.href='/games/single-player/plinko/';plinkoArt.src='/assets/plinko/cover.svg?v=PLINKO_V1';plinkoArt.alt='';plinkoArt.width=360;plinkoArt.height=390;plinkoArt.loading='lazy';plinkoLabel.append(element('small','SINGLE PLAYER · DROP & WIN'),document.createTextNode('Plinko'));plinkoLink.append(plinkoArt,plinkoLabel);plinkoTile.append(plinkoLink);singleGrid.append(plinkoTile);
  const rocketTile=element('article',undefined,'hub-tile'),rocketLink=element('a',undefined,'sth-game'),rocketArt=element('img'),rocketLabel=element('span',undefined,'hub-title');rocketLink.href='/games/single-player/rocket-run/';rocketArt.src='/assets/rocket-run/cover.svg?v=ROCKET_RUN_V1';rocketArt.alt='';rocketArt.width=360;rocketArt.height=390;rocketArt.loading='lazy';rocketLabel.append(element('small','SINGLE PLAYER · LAUNCH & CASH OUT'),document.createTextNode('Rocket Run'));rocketLink.append(rocketArt,rocketLabel);rocketTile.append(rocketLink);singleGrid.append(rocketTile);
  const diceTile=element('article',undefined,'hub-tile'),diceLink=element('a',undefined,'sth-game'),diceArt=element('img'),diceLabel=element('span',undefined,'hub-title');diceLink.href='/games/single-player/lucky-dice/';diceArt.src='/assets/dice-duel/lucky-cover.svg?v=DICE_V2';diceArt.alt='';diceArt.width=360;diceArt.height=390;diceArt.loading='lazy';diceLabel.append(element('small','SINGLE PLAYER · HIGHER OR LOWER'),document.createTextNode('Lucky Dice'));diceLink.append(diceArt,diceLabel);diceTile.append(diceLink);singleGrid.append(diceTile);
  const section=element('section',undefined,'hub-open');section.innerHTML='<div class="hub-heading"><h2>Open Games</h2><span>Join the next game</span></div><div id="hub-games" data-hub-games aria-live="polite"><p class="hub-empty">Connect your public API key to see open games and wagers.</p></div><p id="hub-lobby-status" class="hub-status" role="status"></p>';card.append(section);
  const syncKey=()=>{const ok=storage.get('tornKeyConfirmed')==='true'&&Boolean(storage.get('tornVisitorApiKey'));keyBox.hidden=ok;grid.querySelectorAll('.sth-game').forEach(b=>b.disabled=b.dataset.mode==='bluff'?false:!ok);updateHeader();};
  new MutationObserver(syncKey).observe($('simpleApiStatus'),{childList:true,attributes:true});syncKey();
  new MutationObserver(()=>{updateHeader();if(!home.hidden)refresh();}).observe(home,{attributes:true,attributeFilter:['hidden']});
  home.dataset.hubReady='true';window.XanHomeBoot?.ready();
 }
 function lobbyStatus(text){document.querySelectorAll('#hub-lobby-status,[data-hub-lobby-status]').forEach(e=>e.textContent=text);}
 function renderGames(list){
  for(const root of document.querySelectorAll('[data-hub-games]')){const key=JSON.stringify(list);if(root.dataset.snapshot===key)continue;root.dataset.snapshot=key;root.replaceChildren();
  const open=list.filter(g=>g.count<g.capacity&&(!g.expiresAt||g.expiresAt>Date.now()));
  if(!open.length){root.append(element('p','No open games yet.','hub-empty'));continue;}
  for(const g of open){
   const row=element('div',undefined,'hub-row'),label=element('div');label.append(element('strong',games[g.mode]?.[0]||g.name),element('small',`${g.creator||'Player'} · ${g.count}/${g.capacity} players${g.mine?' · Your game':''}`));row.append(label,element('div',chips(g.wager),'hub-wager'));const actions=element('div',undefined,'hub-buttons'),join=element('button',g.mine?'Return':'Join');
   join.onclick=async()=>{join.disabled=true;try{
    if(g.mode==='diceduel'){location.assign('/games/multiplayer/dice-duel/?room='+encodeURIComponent(g.id));}
    else if(g.mode==='yahtzee'){location.assign('/games/multiplayer/yahtzee/?room='+encodeURIComponent(g.id));}
    else if(g.mode==='rps'||g.mode==='roulette-four'||g.mode==='bluff'){location.assign(`/games/multiplayer/${g.mode}/?${g.mode==='rps'?'arena':'room'}=${encodeURIComponent(g.id)}`);}
    else location.assign(window.XanGameMenu.href(g.mode,g.id));
   }catch(e){lobbyStatus(e.message);join.disabled=false;}};if(!g.mine)actions.append(join);
   if(g.mine&&g.count===1){const cancel=element('button','×','hub-cancel');cancel.setAttribute('aria-label','Cancel '+(games[g.mode]?.[0]||g.name));cancel.onclick=async()=>{cancel.disabled=true;try{await cancelTable(g.mode,g.id);}catch(e){lobbyStatus(e.message);cancel.disabled=false;}};actions.append(cancel);}
   row.append(actions);root.append(row);
  }
  }
 }

 function setupGameEntry(){
  if(window.XanGameMenu){window.XanGameMenu.install({games,showRules});return;}
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
  if(pending||!storage.get('tornVisitorApiKey'))return;if(document.hidden&&Date.now()-(window._xanLastHiddenSync||0)<60000)return;if(document.hidden)window._xanLastHiddenSync=Date.now();
  pending=true;updateHeader();try{const data=await api('sync',{focus:document.hidden?'':current().id});window.XanPlayerProfile=data.player;window.dispatchEvent(new CustomEvent('xan-hub-sync',{detail:data}));$('hub-player').textContent=data.player.name;$('hub-balance').textContent=chips(data.balance);renderGames(data.games);notifications=data.notifications;renderNotifications();lobbyStatus('');}catch(e){networkErrors++;lobbyStatus(e.message);}finally{pending=false;}
 }
 window.addEventListener('error',()=>errors++);window.addEventListener('unhandledrejection',()=>errors++);
 window.addEventListener('xan-navigation',()=>{updateHeader();refresh();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
 $('duelModeSelect')?.addEventListener('change',updateHeader);
 setupHome();setupGameEntry();updateHeader();refresh();refreshTimer=setInterval(refresh,15000);
 window.addEventListener('pagehide',()=>clearInterval(refreshTimer));
})();
