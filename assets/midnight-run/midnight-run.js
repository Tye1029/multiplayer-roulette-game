/* MIDNIGHT_RUN_V6_STORM_FLOW */
(() => {
 'use strict';
 const rules=window.MidnightRunRules,audio=window.MidnightRunAudio,$=id=>document.getElementById(id),numberFormat=new Intl.NumberFormat('en-US'),fmt=n=>numberFormat.format(Number(n));
 const active=s=>s?.status==='active',finished=s=>s?.status==='settled',mult=(amount,wager)=>(amount/wager).toFixed(2)+'×';
 const label=(id,text)=>{const el=$(id),value=String(text);if(el.textContent!==value)el.textContent=value;};
 const markup=(id,html)=>{const el=$(id);if(el.dataset.html!==html){el.innerHTML=html;el.dataset.html=html;}};
 const flag=(id,key,value)=>{const el=$(id);if(el[key]!==value)el[key]=value;};
 let scene,preview,stake=10000,difficulty='normal',game=null,saved=null,demo=false,playing=false,ready=false,busy=false,connecting=false,pending=null,retry=null,epoch=0,pageActive=true;
 let frame=0,frameStamp=0,pollTimer=0,polling=false,serverStamp=0,anchor=0,lastStateAt=0,lastCount=-1,lastCleared=0,lastDrawElapsed=0;
 let nextQuoteKey='',nextQuote=0;
 const motion=new window.MidnightRunMotion.Clock(),storm=new window.MidnightRunWeather.Storm();
 let frozen=null,celebrated='',revealAt=0,revealed=false,effectUntil=0,practiceCaught=0,heldBalance=null;
 const blockMs=()=>game?.blockMs||rules.blockMs;
 const current=run=>pageActive&&run===epoch,serverTime=()=>serverStamp+Math.min(2000,Math.max(0,performance.now()-anchor));
 window.XanSiteAdapter={current:()=>({mode:'midnight',id:playing&&!demo?game?.id||'':'',phase:playing?(active(game)?'playing':'ready'):'lobby'}),diagnostics:()=>({build:rules.build,ready,busy,connecting,polling,demo,phase:game?.status,cleared:game?.cleared,difficulty:game?.difficulty,scenery:scene?.routeId,artReady:scene?.ready,frames:frame?1:0,audioVoices:audio.active,resultVisible:revealed,visualElapsed:lastDrawElapsed,lightning:storm.flashes})};
 function notice(text='',again=null){$('mr-notice').textContent=text;retry=again;$('mr-retry').hidden=!again;$('mr-retry').textContent=pending?'Recover run':'Reconnect';}
 function settings(prefix){return '<div class="mr-settings"><label for="'+prefix+'stake">Chips per run<select id="'+prefix+'stake">'+rules.stakes.map(n=>'<option value="'+n+'">'+fmt(n)+' chips</option>').join('')+'</select></label><label for="'+prefix+'difficulty">Difficulty<select id="'+prefix+'difficulty">'+rules.difficulties.map(d=>'<option value="'+d+'">'+rules.labels[d]+' · '+mult(rules.payout(stake,1,d),stake)+'</option>').join('')+'</select></label><p class="mr-setting-note"></p></div>';}
 function configure(){
  for(const prefix of ['mr-menu-','mr-play-']){
   $(prefix+'stake').value=String(stake);$(prefix+'difficulty').value=difficulty;
   for(const option of $(prefix+'difficulty').options)option.textContent=rules.labels[option.value]+' · '+mult(rules.payout(stake,1,option.value),stake);
   $(prefix+'settings').querySelector('.mr-setting-note').textContent='First-block return: '+fmt(rules.payout(stake,1,difficulty))+' chips. Difficulty is fixed for the run.';
  }
  try{localStorage.setItem('midnight-run-choice',JSON.stringify({stake,difficulty}));}catch{}controls();
 }
 function controls(){
  const inRun=playing&&active(game),ending=playing&&finished(game)&&!revealed,locked=busy||Boolean(pending)||inRun||ending;
  for(const id of ['mr-menu-stake','mr-play-stake','mr-menu-difficulty','mr-play-difficulty'])$(id).disabled=locked;
  $('mr-start').disabled=busy||connecting||Boolean(pending)||!ready;
  $('mr-start').textContent=connecting?'Connecting your chip balance…':active(saved)?'Resume your run':'Start run · '+fmt(stake)+' chips';
  $('mr-connect').hidden=ready||connecting;
  $('mr-again').hidden=inRun||ending;$('mr-again').disabled=busy||connecting||Boolean(pending)||(!demo&&!ready);
  $('mr-again').textContent=demo?'Start another free run':active(saved)?'Resume your run':'Run again · '+fmt(stake)+' chips';
  $('mr-cashout').hidden=!inRun&&!ending;$('mr-continue').hidden=!inRun;
  $('mr-round-note').textContent=demo?'Free practice. No chips are spent or awarded.':inRun?'Your runner waits at each cleared corner, even if you leave.':'Choose your wager and start the next run here.';
 }
 function scheduleFrame(){if(!frame&&pageActive&&!document.hidden)frame=requestAnimationFrame(render);}
 function stop(){cancelAnimationFrame(frame);frame=0;clearTimeout(pollTimer);audio.silence();storm.reset();}
 function render(stamp){
  frame=0;if(!pageActive||document.hidden)return;
  if(!playing&&stamp-frameStamp<40){scheduleFrame();return;}frameStamp=stamp;
  if(!playing){preview.draw({phase:'preview',elapsed:0});if(!preview.reduced.matches||!preview.ready)scheduleFrame();return;}
  const now=demo?performance.now():serverTime();
  if(demo&&active(game))advancePractice(now);
  const terminal=finished(game),corners=game?.mode==='corners',atCorner=active(game)&&game.phase==='corner';
  const serverLegElapsed=now-(game?.legStartedAt??game?.startedAt??now);
  const visualElapsed=corners?motion.sample(game,stamp,serverLegElapsed):Math.max(0,now-game.startedAt);
  const legElapsed=corners&&game.phase==='running'?motion.legElapsed:serverLegElapsed,stale=!demo&&active(game)&&performance.now()-anchor>2000;
  if(terminal&&!revealed&&performance.now()>=revealAt)revealResult();
  const holding=active(game)&&frozen!==null,awaiting=active(game)&&!atCorner&&legElapsed>=blockMs();
  const phase=terminal?(game.outcome==='caught'?'caught':'escape'):holding?'securing':atCorner?'corner':awaiting&&corners?'waiting':legElapsed<0?'countdown':'running';
  const rawElapsed=terminal?game.travelMs:holding?frozen:visualElapsed;
  const drawElapsed=Math.max(lastDrawElapsed,rawElapsed||0);lastDrawElapsed=drawElapsed;
  const block=Math.min((game?.cleared||0)+1,game?.lastBlock||rules.lastBlock(stake,difficulty));
  flag('mr-countdown','hidden',phase!=='countdown');
  if(phase==='countdown'){const count=Math.max(1,Math.ceil(-legElapsed/1000));if(count!==lastCount){$('mr-countdown').querySelector('strong').textContent=count;lastCount=count;audio.tick();}}
  if(phase==='running')audio.run();else{audio.stopRun();if(active(game))audio.ambient();}
  flag('mr-corner','hidden',!atCorner);
  const choiceHome=$(atCorner?'mr-corner-actions':'mr-actions');
  if($('mr-continue').parentElement!==choiceHome)choiceHome.append($('mr-continue'),$('mr-cashout'));
  $('mr-machine').classList.toggle('at-corner',atCorner&&!holding);
  label('mr-district','CITY STREETS');label('mr-block',atCorner?'CORNER '+String(game.cleared).padStart(2,'0'):'BLOCK '+String(block).padStart(2,'0'));
  label('mr-distance',fmt(Math.floor(drawElapsed/blockMs()*100))+' m');
  label('mr-state',holding?'ESCAPE REQUESTED':terminal?(revealed?(game.outcome==='caught'?'CAUGHT':'ESCAPED'):'RUN ENDED'):atCorner?'CONTINUE OR CASH OUT':phase==='countdown'?'MAKE YOUR MOVE':stale?'RECONNECTING':awaiting?'CHECKING CORNER':'KEEP MOVING');
  const bank=terminal&&revealed?game.payout:game?.bank||0;
  label('mr-bank',fmt(bank));label('mr-multiplier',bank?mult(bank,game.stake):'—');
  label('mr-bank-label',terminal&&revealed?(game.outcome==='caught'?'RUN RETURN':'RETURN SECURED'):'CASH-OUT VALUE');
  label('mr-bank-note',terminal?(revealed?(demo?'Practice result · no chips awarded':game.outcome==='caught'?fmt(game.stake)+'-chip wager lost.':'Your return has been credited.'):'Finishing your run…'):holding?'Confirming your escape…':stale?'Connection delayed. Reconnecting…':atCorner?'Corner cleared. Take your time — continue or cash out.':'Running to the next corner…');
  const canChoose=active(game)&&(atCorner||!corners&&game.cleared)&&!busy&&!pending&&!stale&&!holding;
  flag('mr-cashout','disabled',!canChoose);flag('mr-continue','disabled',!canChoose||!corners);
  label('mr-cashout',terminal?'Finishing your run…':holding?'Securing your escape…':pending?'Recover your run':phase==='countdown'?'Ready to run…':stale?'Reconnecting…':!atCorner&&corners?'Reach the next corner…':'Cash out · '+fmt(game.bank));
  label('mr-continue',busy&&pending?.action==='continue'?'Continuing…':'Continue · block '+block);
  const quoteKey=[game?.stake||stake,block,game?.difficulty||difficulty].join(':');
  if(quoteKey!==nextQuoteKey){nextQuoteKey=quoteKey;nextQuote=rules.payout(game?.stake||stake,block,game?.difficulty||difficulty);}const next=nextQuote;
  markup('mr-next-value',fmt(next)+' <small>chips</small>');label('mr-next-multiplier',mult(next,game?.stake||stake));
  const safe=rules.odds(game?.difficulty||difficulty)[block-1];label('mr-next-note',rules.labels[game?.difficulty||difficulty]+(block===1?' · First block.':' · '+safe+'% clear / '+(100-safe)+'% caught'+(block===game?.lastBlock?' · Final block.':'.')));
  flag('mr-next','hidden',terminal);label('mr-route-label',terminal?'Run complete':holding?'Securing your escape':atCorner?'Corner cleared · your choice':'Next corner · block '+block);
  $('mr-progress').style.transform='scaleX('+(terminal||atCorner?1:Math.max(0,Math.min(1,(drawElapsed-(block-1)*blockMs())/blockMs())))+')';
  const weather=storm.sample(stamp,active(game),scene.reduced.matches);if(weather.thunder)audio.thunder();
  scene.draw({phase,elapsed:drawElapsed,id:game?.id,lightning:weather.light});
  if(active(game)||!revealed||performance.now()<effectUntil)scheduleFrame();
 }

 function revealResult(){
  revealed=true;const won=game.outcome!=='caught';$('mr-result').hidden=false;$('mr-result').classList.toggle('is-caught',!won);
  $('mr-result-eyebrow').textContent=won?(game.outcome==='limit'?'MAXIMUM RETURN':'CASHED OUT'):'END OF THE ROAD';
  $('mr-result-title').textContent=won?'Clean getaway.':'Busted.';
  $('mr-result-value').textContent=fmt(game.payout)+' chips';
  $('mr-result-note').textContent=demo?'Practice run complete. No chips spent or awarded.':won?game.cleared+' blocks cleared · '+mult(game.payout,game.stake)+' return. '+fmt(game.payout-game.stake)+' chips gained.':'Caught before you escaped. Your '+fmt(game.stake)+'-chip wager was lost.';
  $('mr-scene').setAttribute('aria-label',won?'Escaped after '+game.cleared+' blocks. '+fmt(game.payout)+' chips returned.':'Caught after '+game.cleared+' cleared blocks. Wager lost.');
  if(heldBalance){window.XanHub.setBalance(heldBalance.value,heldBalance.meta);heldBalance=null;}
  controls();
 }
 function paint(animate=true){
  $('mr-mode').textContent=(demo?'PRACTICE · ':'')+rules.labels[game?.difficulty||difficulty].toUpperCase();
  if(active(game)&&game.cleared>lastCleared){if(animate&&playing)audio.corner();lastCleared=game.cleared;}
  if(finished(game)&&celebrated!==game.id){celebrated=game.id;revealed=false;revealAt=performance.now()+(animate?1250:0);effectUntil=performance.now()+(animate?3100:0);if(animate)audio.finish(game.outcome!=='caught');}
  controls();scheduleFrame();
 }
 function enter(){
  playing=true;motion.reset();storm.reset();frozen=null;lastDrawElapsed=0;lastCount=-1;lastCleared=0;revealed=false;celebrated='';
  $('mr-menu').hidden=true;$('mr-play').hidden=false;$('mr-result').hidden=true;paint(false);schedulePoll();

 }
 async function request(body){
  const key=localStorage.getItem('tornVisitorApiKey'),token=await window.XanHub.authenticate();
  if(key!==localStorage.getItem('tornVisitorApiKey'))throw Object.assign(Error('Your profile changed. Reconnect.'),{status:401});
  const before=performance.now(),response=await window.XanHub.post('midnight-run-action',{token,...body});return {...response,received:performance.now(),before,key};
 }
 function adopt(response,animate=true){
  const next=response.game;
  // A slow poll can arrive after Continue with a later response timestamp.
  if(saved&&next&&saved.id===next.id&&(next.revision||0)<(saved.revision||0))return;
  if(game&&next&&game.id===next.id&&finished(game)&&!finished(next))return;
  if(response.key!==localStorage.getItem('tornVisitorApiKey')||response.stateAt<lastStateAt)return;
  lastStateAt=response.stateAt;const wire=Math.max(0,response.received-response.before-(response.serverNow-response.requestAt));
  serverStamp=response.serverNow+Math.min(200,wire/2);anchor=response.received;saved=next;
  if(finished(next)){frozen=null;}
  if(Number.isFinite(response.balance)){
   const meta={key:response.key,at:response.received};
   if(playing&&!demo&&finished(next)&&!revealed)heldBalance={value:response.balance,meta};else window.XanHub.setBalance(response.balance,meta);
  }
  if(!demo&&playing){game=next;if(game){const changed=stake!==game.stake||difficulty!==(game.difficulty||'normal');stake=game.stake;difficulty=game.difficulty||'normal';if(changed)configure();paint(animate);}}
 }
 function schedulePoll(){
  clearTimeout(pollTimer);if(!pageActive||!playing||demo||!active(game)||document.hidden)return;
  const nextAt=game.legStartedAt+blockMs(),until=nextAt-serverTime();
  pollTimer=setTimeout(poll,game.phase==='corner'?1000:Math.max(150,Math.min(700,until+30)));
 }
 async function poll(){
  if(polling||busy||!pageActive||!playing||demo||!active(game)||document.hidden){schedulePoll();return;}
  polling=true;const run=epoch,id=game.id;
  try{const response=await request({action:'current'});if(!current(run)||demo||game?.id!==id||frozen!==null)return;adopt(response);if(!pending)notice();}
  catch(e){if(current(run))notice('Connection delayed. Reconnect to confirm your run. Your runner waits at the next cleared corner.',reconnect);}
  finally{polling=false;if(current(run))schedulePoll();}
 }
 async function send(body,opening=false){
  if(busy)return;const run=epoch;busy=true;pending=body;notice();controls();audio.unlock();
  try{const response=await request(body);if(!current(run))return;pending=null;ready=true;adopt(response);if(opening){game=response.game;saved=game;stake=game.stake;difficulty=game.difficulty||'normal';configure();enter();}else paint();}
  catch(e){if(!current(run))return;
   if([400,401,404,409].includes(e.status)){pending=null;frozen=null;if(e.status===401)ready=false;notice(e.message,reconnect);}
   else notice('Connection interrupted. Recover this run before starting another. Your wager and return are saved.',()=>send(body,opening));
  }finally{if(current(run)){busy=false;controls();scheduleFrame();schedulePoll();}}
 }
 function start(){
  if(busy||pending||connecting||!ready)return;demo=false;stop();epoch++;lastStateAt=0;
  if(active(saved)){game=saved;stake=game.stake;difficulty=game.difficulty||'normal';configure();audio.unlock();enter();reconnect();return;}
  send({action:'start',stake,difficulty,quote:rules.build,requestId:crypto.randomUUID()},true);
 }
 function practiceInt(){let n;do{n=crypto.getRandomValues(new Uint32Array(1))[0];}while(n>=4294967200);return n%100;}
 function practice(){
  if(busy||pending)return;stop();epoch++;connecting=false;demo=true;heldBalance=null;practiceCaught=rules.lastBlock(stake,difficulty)+1;
  for(let b=1;b<=rules.lastBlock(stake,difficulty);b++)if(practiceInt()>=rules.odds(difficulty)[b-1]){practiceCaught=b;break;}
  game={id:'free-'+crypto.randomUUID(),stake,difficulty,blockMs:rules.blockMs,mode:'corners',phase:'running',status:'active',startedAt:performance.now()+rules.countdownMs,legStartedAt:performance.now()+rules.countdownMs,cleared:0,bank:0,lastBlock:rules.lastBlock(stake,difficulty)};
  notice();audio.unlock();enter();
 }
 function settlePractice(outcome,cleared,endedAt){game={...game,status:'settled',outcome,cleared,payout:outcome==='caught'?0:rules.payout(game.stake,cleared,game.difficulty),endedAt,travelMs:(outcome==='caught'?cleared+1:cleared)*blockMs()};paint();}
 function advancePractice(now){
  if(game.phase!=='running'||now<game.legStartedAt+blockMs())return;
  const block=game.cleared+1,arrival=game.legStartedAt+blockMs();
  if(block>=practiceCaught)settlePractice('caught',game.cleared,arrival);
  else if(block===game.lastBlock)settlePractice('limit',block,arrival);
  else{game.cleared=block;game.bank=rules.payout(game.stake,block,game.difficulty);game.phase='corner';paint();}
 }
 function continueRun(){
  if(busy||pending||!active(game)||game.phase!=='corner'||frozen!==null)return;
  audio.unlock();if(demo){game.phase='running';game.legStartedAt=performance.now();paint();}
  else if(performance.now()-anchor<=2000)send({action:'continue',gameId:game.id,cleared:game.cleared,requestId:crypto.randomUUID()});
 }
 function cashout(){
  if(busy||pending||!active(game)||frozen!==null||!game.cleared||game.mode==='corners'&&game.phase!=='corner')return;
  audio.unlock();if(demo)settlePractice('escape',game.cleared,performance.now());
  else{if(performance.now()-anchor>2000)return;frozen=lastDrawElapsed;audio.stopRun();clearTimeout(pollTimer);scheduleFrame();send({action:'cashout',gameId:game.id,cleared:game.cleared,requestId:crypto.randomUUID()});}
 }
 async function reconnect(){
  if(busy||connecting)return;if(pending){retry?.();return;}
  if(!localStorage.getItem('tornVisitorApiKey')){ready=false;controls();return;}
  const run=epoch;connecting=true;controls();
  try{const response=await request({action:'current'});if(!current(run))return;ready=true;adopt(response,false);notice();}
  catch(e){if(current(run)){ready=false;notice(e.message,reconnect);}}
  finally{if(current(run)){connecting=false;controls();scheduleFrame();schedulePoll();}}
 }
 function reset(){stop();epoch++;busy=false;pending=null;connecting=false;polling=false;ready=false;playing=false;demo=false;game=null;saved=null;heldBalance=null;lastStateAt=0;frozen=null;$('mr-menu').hidden=false;$('mr-play').hidden=true;notice();configure();reconnect();scheduleFrame();}
 document.addEventListener('DOMContentLoaded',()=>{
  try{const s=JSON.parse(localStorage.getItem('midnight-run-choice'));if(rules.stakes.includes(s?.stake))stake=s.stake;if(rules.validDifficulty(s?.difficulty))difficulty=s.difficulty;}catch{}
  for(const prefix of ['mr-menu-','mr-play-']){
   $(prefix+'settings').innerHTML=settings(prefix);$(prefix+'stake').onchange=e=>{stake=Number(e.target.value);configure();};$(prefix+'difficulty').onchange=e=>{difficulty=e.target.value;configure();};
  }
  scene=new window.MidnightRunScene($('mr-scene'));preview=new window.MidnightRunScene($('mr-preview'));configure();
  $('mr-continue').onclick=continueRun;$('mr-start').onclick=start;$('mr-cashout').onclick=cashout;
  $('mr-cashout').onpointerdown=e=>{if(e.isPrimary&&e.button===0&&!e.currentTarget.disabled)cashout();};
  $('mr-again').onclick=()=>demo?practice():start();$('mr-retry').onclick=()=>retry?.();
  $('mr-help').onclick=()=>{
   const d=document.createElement('dialog');d.className='xan-dialog mr-help';d.innerHTML='<h2>How to play Midnight Run</h2><ol><li>Choose your wager and difficulty. Low Risk keeps the original odds; Medium Risk and High Risk increase both capture chance and return. Your runner moves after a three-second countdown.</li><li>Each new run takes 4 seconds per block. Survive it and your runner stops at the corner.</li><li>Choose Continue to risk another block, or Cash out to secure your current return, including your wager.</li><li>There is no decision timer. Your runner waits at a cleared corner even if you leave or disconnect.</li><li>Getting caught during a block loses your wager. The next block’s clear/capture chances are shown before you continue. Randomized scenery and patrol lights are atmosphere, not clues.</li><li>Reaching 50,000,000 chips completes the run.</li></ol><button class="mr-secondary">Got it</button>';document.body.append(d);d.querySelector('button').onclick=()=>d.close();d.onclose=()=>d.remove();d.showModal();
  };
  reconnect();scheduleFrame();
 });
 document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();return;}if(!pageActive)return;scheduleFrame();if(!demo)reconnect();});
 window.addEventListener('pagehide',()=>{pageActive=false;epoch++;stop();});
 window.addEventListener('pageshow',e=>{if(e.persisted){pageActive=true;reset();}});
 window.addEventListener('storage',e=>{if(e.key==='tornVisitorApiKey')reset();});
})();
