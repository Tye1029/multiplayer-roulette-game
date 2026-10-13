/* MIDNIGHT_RUN_V1 */
(() => {
 'use strict';
 const rules=window.MidnightRunRules,audio=window.MidnightRunAudio,$=id=>document.getElementById(id),fmt=n=>Number(n).toLocaleString('en-US');
 const active=s=>s?.status==='active',finished=s=>s?.status==='settled',mult=(amount,wager)=>(amount/wager).toFixed(2)+'×';
 const label=(id,text)=>{const el=$(id),value=String(text);if(el.textContent!==value)el.textContent=value;};
 const markup=(id,html)=>{const el=$(id);if(el.dataset.html!==html){el.innerHTML=html;el.dataset.html=html;}};
 let scene,preview,stake=50000,autoBlock=null,game=null,saved=null,demo=false,playing=false,ready=false,busy=false,connecting=false,pending=null,retry=null,epoch=0,pageActive=true;
 let frame=0,frameStamp=0,pollTimer=0,polling=false,serverStamp=0,anchor=0,lastStateAt=0,lastCount=-1,lastCleared=0,lastDrawElapsed=0;
 let frozen=null,autoHolding=false,celebrated='',revealAt=0,revealed=false,effectUntil=0,practiceCaught=0,heldBalance=null;
 const current=run=>pageActive&&run===epoch,serverTime=()=>serverStamp+Math.min(2000,Math.max(0,performance.now()-anchor));
 window.XanSiteAdapter={current:()=>({mode:'midnight',id:playing&&!demo?game?.id||'':'',phase:playing?(active(game)?'playing':'ready'):'lobby'}),diagnostics:()=>({build:rules.build,ready,busy,connecting,polling,demo,phase:game?.status,cleared:game?.cleared,artReady:scene?.ready,frames:frame?1:0,audioVoices:audio.active,resultVisible:revealed})};
 function notice(text='',again=null){$('mr-notice').textContent=text;retry=again;$('mr-retry').hidden=!again;$('mr-retry').textContent=pending?'Recover run':'Reconnect';}
 function settings(prefix){return '<div class="mr-settings"><label for="'+prefix+'stake">Chips per run<select id="'+prefix+'stake">'+rules.stakes.map(n=>'<option value="'+n+'">'+fmt(n)+' chips</option>').join('')+'</select></label><label for="'+prefix+'auto">Auto escape <small>OPTIONAL</small><select id="'+prefix+'auto"></select></label><p class="mr-setting-note"></p></div>';}
 function configure(){
  for(const prefix of ['mr-menu-','mr-play-']){
   $(prefix+'stake').value=String(stake);$(prefix+'auto').innerHTML='<option value="">Off · I’ll choose when</option>'+Array.from({length:rules.lastBlock(stake)},(_,i)=>{const b=i+1;return '<option value="'+b+'">Block '+b+' · '+mult(rules.payout(stake,b),stake)+'</option>';}).join('');
   $(prefix+'auto').value=autoBlock===null?'':String(autoBlock);
   $(prefix+'settings').querySelector('.mr-setting-note').textContent=autoBlock===null?'Your return grows at each cleared corner. Escape before you get caught.':'Escape after block '+autoBlock+' for '+fmt(rules.payout(stake,autoBlock))+' chips if you make it that far.';
  }
  try{localStorage.setItem('midnight-run-choice',JSON.stringify({stake,autoBlock}));}catch{}controls();
 }
 function controls(){
  const inRun=playing&&active(game),ending=playing&&finished(game)&&!revealed,locked=busy||Boolean(pending)||inRun||ending;
  for(const id of ['mr-menu-stake','mr-play-stake','mr-menu-auto','mr-play-auto'])$(id).disabled=locked;
  $('mr-start').disabled=busy||connecting||Boolean(pending)||!ready;
  $('mr-start').textContent=connecting?'Connecting your chip balance…':active(saved)?'Resume your run':'Start run · '+fmt(stake)+' chips';
  $('mr-practice').disabled=busy||Boolean(pending);$('mr-connect').hidden=ready||connecting;
  $('mr-again').hidden=inRun||ending;$('mr-again').disabled=busy||connecting||Boolean(pending)||(!demo&&!ready);
  $('mr-again').textContent=demo?'Start another free run':active(saved)?'Resume your run':'Run again · '+fmt(stake)+' chips';
  $('mr-cashout').hidden=!inRun&&!ending;$('mr-free-wrap').hidden=inRun||ending;$('mr-free').disabled=locked;$('mr-free').checked=demo;
  $('mr-round-note').textContent=demo?'Free practice. No chips are spent or awarded.':inRun?'Your run continues if you leave. A saved auto escape still applies.':'Choose your wager and start the next run here.';
 }
 function scheduleFrame(){if(!frame&&pageActive&&!document.hidden)frame=requestAnimationFrame(render);}
 function stop(){cancelAnimationFrame(frame);frame=0;clearTimeout(pollTimer);audio.silence();}
 function render(stamp){
  frame=0;if(!pageActive||document.hidden)return;
  const gap=playing?16:40;if(stamp-frameStamp<gap){scheduleFrame();return;}frameStamp=stamp;
  if(!playing){preview.draw({phase:'preview',elapsed:0});if(!preview.reduced.matches||!preview.ready)scheduleFrame();return;}
  const now=demo?performance.now():serverTime(),elapsed=game?now-game.startedAt:0;
  if(demo&&active(game))advancePractice(now);
  const terminal=finished(game),target=game?.autoBlock??rules.lastBlock(stake);
  if(!demo&&active(game)&&!frozen&&elapsed>=target*rules.blockMs&&!autoHolding){autoHolding=true;clearTimeout(pollTimer);poll();}
  if(terminal&&!revealed&&performance.now()>=revealAt)revealResult();
  const stale=!demo&&active(game)&&performance.now()-anchor>2000;
  const holding=active(game)&&(frozen||autoHolding);
  const phase=terminal?(game.outcome==='caught'?'caught':'escape'):holding?'securing':elapsed<0?'countdown':'running';
  // Never rewind the street when clocks resync. Stop at an unconfirmed corner.
  const rawElapsed=terminal?game.endedAt-game.startedAt:frozen??(autoHolding?target*rules.blockMs:Math.min(Math.max(0,elapsed),(game.cleared+1)*rules.blockMs));
  const drawElapsed=terminal?rawElapsed:Math.max(lastDrawElapsed,rawElapsed);lastDrawElapsed=drawElapsed;
  const block=Math.min((game?.cleared||0)+1,game?.lastBlock||rules.lastBlock(stake));
  $('mr-countdown').hidden=phase!=='countdown';
  if(phase==='countdown'){const count=Math.max(1,Math.ceil(-elapsed/1000));$('mr-countdown').querySelector('strong').textContent=count;if(count!==lastCount){lastCount=count;audio.tick();}}
  if(phase==='running'&&!stale)audio.run();else audio.stopRun();
  label('mr-district',rules.district(game?.cleared||0));label('mr-block','BLOCK '+String(block).padStart(2,'0'));
  label('mr-distance',fmt(Math.floor(Math.max(0,drawElapsed)/rules.blockMs*100))+' m');
  label('mr-state',holding?'ESCAPE REQUESTED':terminal?(revealed?(game.outcome==='caught'?'CAUGHT':'ESCAPED'):'RUN ENDED'):phase==='countdown'?'MAKE YOUR MOVE':stale?'RECONNECTING':'KEEP MOVING');
  label('mr-connection',demo?'FREE PRACTICE':stale?'RECONNECTING TO YOUR RUN':'STREETS AHEAD');
  const bank=terminal&&revealed?game.payout:game?.bank||0;
  label('mr-bank',fmt(bank));label('mr-multiplier',bank?mult(bank,game.stake):'—');
  label('mr-bank-label',terminal&&revealed?(game.outcome==='caught'?'RUN RETURN':'RETURN SECURED'):'CASH-OUT VALUE');
  label('mr-bank-note',terminal?(revealed?(demo?'Practice result · no chips awarded':game.outcome==='caught'?fmt(game.stake)+'-chip wager lost.':'Your return has been credited.'):'Finishing your run…'):holding?'Confirming your escape…':stale?'Connection delayed. Reconnecting…':game.cleared?'Includes your wager. The next corner is a new risk.':'Clear the first block to cash out.');
  $('mr-cashout').disabled=phase!=='running'||busy||Boolean(pending)||stale||!game?.cleared;
  label('mr-cashout',terminal?'Finishing your run…':holding?'Securing your escape…':pending?'Recover your run':phase==='countdown'?'Ready to run…':stale?'Reconnecting…':!game.cleared?'Clear the first block…':'Escape & cash out · '+fmt(game.bank));
  const next=rules.payout(game?.stake||stake,block);
  markup('mr-next-value',fmt(next)+' <small>chips</small>');label('mr-next-multiplier',mult(next,game?.stake||stake));
  label('mr-next-note',block===(game?.lastBlock||rules.lastBlock(stake))?'Reach this return to escape automatically.':'Every corner is a new risk.');
  $('mr-next').hidden=terminal;label('mr-route-label',terminal?'Run complete':holding?'Securing your escape':game.cleared>=block?'Corner cleared':'Next corner · block '+block);
  $('mr-progress').style.width=(terminal?100:Math.max(0,Math.min(100,(drawElapsed-(block-1)*rules.blockMs)/rules.blockMs*100)))+'%';
  scene.draw({phase,elapsed:drawElapsed,id:game?.id});
  if(active(game)||!revealed||performance.now()<effectUntil)scheduleFrame();
 }
 function revealResult(){
  revealed=true;const won=game.outcome!=='caught';$('mr-result').hidden=false;$('mr-result').classList.toggle('is-caught',!won);
  $('mr-result-eyebrow').textContent=won?(game.outcome==='auto'?'AUTO ESCAPE':game.outcome==='limit'?'MAXIMUM RETURN':'CASHED OUT'):'END OF THE ROAD';
  $('mr-result-title').textContent=won?'Clean getaway.':'Busted.';
  $('mr-result-value').textContent=fmt(game.payout)+' chips';
  $('mr-result-note').textContent=demo?'Practice run complete. No chips spent or awarded.':won?game.cleared+' blocks cleared · '+mult(game.payout,game.stake)+' return. '+fmt(game.payout-game.stake)+' chips gained.':'Caught before you escaped. Your '+fmt(game.stake)+'-chip wager was lost.';
  $('mr-scene').setAttribute('aria-label',won?'Escaped after '+game.cleared+' blocks. '+fmt(game.payout)+' chips returned.':'Caught after '+game.cleared+' cleared blocks. Wager lost.');
  if(heldBalance){window.XanHub.setBalance(heldBalance.value,heldBalance.meta);heldBalance=null;}
  controls();
 }
 function paint(animate=true){
  $('mr-mode').textContent=demo?'FREE PRACTICE':'MIDNIGHT RUN';$('mr-auto-badge').textContent=game?.autoBlock?'AUTO ESCAPE · BLOCK '+game.autoBlock:'MANUAL ESCAPE';
  if(active(game)&&game.cleared>lastCleared){if(animate&&playing)audio.corner();lastCleared=game.cleared;}
  if(finished(game)&&celebrated!==game.id){celebrated=game.id;revealed=false;revealAt=performance.now()+(animate?1250:0);effectUntil=performance.now()+(animate?3100:0);if(animate)audio.finish(game.outcome!=='caught');}
  controls();scheduleFrame();
 }
 function enter(){
  playing=true;frozen=null;autoHolding=false;lastDrawElapsed=0;lastCount=-1;lastCleared=0;revealed=false;celebrated='';
  $('mr-menu').hidden=true;$('mr-play').hidden=false;$('mr-result').hidden=true;paint(false);schedulePoll();
  requestAnimationFrame(()=>$('mr-play').scrollIntoView({block:'start',behavior:'instant'}));
 }
 async function request(body){
  const key=localStorage.getItem('tornVisitorApiKey'),token=await window.XanHub.authenticate();
  if(key!==localStorage.getItem('tornVisitorApiKey'))throw Object.assign(Error('Your profile changed. Reconnect.'),{status:401});
  const before=performance.now(),response=await window.XanHub.post('midnight-run-action',{token,...body});return {...response,received:performance.now(),before,key};
 }
 function adopt(response,animate=true){
  const next=response.game;if(game&&next&&game.id===next.id&&finished(game)&&!finished(next))return;
  if(response.key!==localStorage.getItem('tornVisitorApiKey')||response.stateAt<lastStateAt)return;
  lastStateAt=response.stateAt;const wire=Math.max(0,response.received-response.before-(response.serverNow-response.requestAt));
  serverStamp=response.serverNow+Math.min(200,wire/2);anchor=response.received;saved=next;
  if(finished(next)){frozen=null;autoHolding=false;}
  if(Number.isFinite(response.balance)){
   const meta={key:response.key,at:response.received};
   if(playing&&!demo&&finished(next)&&!revealed)heldBalance={value:response.balance,meta};else window.XanHub.setBalance(response.balance,meta);
  }
  if(!demo&&playing){game=next;if(game){const changed=stake!==game.stake||autoBlock!==game.autoBlock;stake=game.stake;autoBlock=game.autoBlock;if(changed)configure();paint(animate);}}
 }
 function schedulePoll(){
  clearTimeout(pollTimer);if(!pageActive||!playing||demo||!active(game)||document.hidden)return;
  const nextAt=game.startedAt+(game.cleared+1)*rules.blockMs,until=nextAt-serverTime();
  pollTimer=setTimeout(poll,autoHolding?250:Math.max(150,Math.min(700,until+30)));
 }
 async function poll(){
  if(polling||busy||!pageActive||!playing||demo||!active(game)||document.hidden){schedulePoll();return;}
  polling=true;const run=epoch,id=game.id;
  try{const response=await request({action:'current'});if(!current(run)||demo||game?.id!==id||frozen!==null)return;adopt(response);if(!pending)notice();}
  catch(e){if(current(run))notice('Connection delayed. Reconnect to confirm your run. Your saved escape target still applies.',reconnect);}
  finally{polling=false;if(current(run))schedulePoll();}
 }
 async function send(body,opening=false){
  if(busy)return;const run=epoch;busy=true;pending=body;notice();controls();audio.unlock();
  try{const response=await request(body);if(!current(run))return;pending=null;ready=true;adopt(response);if(opening){game=response.game;saved=game;stake=game.stake;autoBlock=game.autoBlock;configure();enter();}else paint();}
  catch(e){if(!current(run))return;
   if([400,401,404,409].includes(e.status)){pending=null;frozen=null;if(e.status===401)ready=false;notice(e.message,reconnect);}
   else notice('Connection interrupted. Recover this run before starting another. Your wager and return are saved.',()=>send(body,opening));
  }finally{if(current(run)){busy=false;controls();scheduleFrame();schedulePoll();}}
 }
 function start(){
  if(busy||pending||connecting||!ready)return;demo=false;stop();epoch++;lastStateAt=0;
  if(active(saved)){game=saved;stake=game.stake;autoBlock=game.autoBlock;configure();audio.unlock();enter();reconnect();return;}
  send({action:'start',stake,autoBlock,quote:rules.build,requestId:crypto.randomUUID()},true);
 }
 function practiceInt(){let n;do{n=crypto.getRandomValues(new Uint32Array(1))[0];}while(n>=4294967200);return n%100;}
 function practice(){
  if(busy||pending)return;stop();epoch++;connecting=false;demo=true;heldBalance=null;practiceCaught=rules.lastBlock(stake)+1;
  for(let b=1;b<=rules.lastBlock(stake);b++)if(practiceInt()>=rules.safePercent[b-1]){practiceCaught=b;break;}
  game={id:'free-'+crypto.randomUUID(),stake,autoBlock,status:'active',startedAt:performance.now()+rules.countdownMs,cleared:0,bank:0,lastBlock:rules.lastBlock(stake)};
  notice();audio.unlock();enter();
 }
 function settlePractice(outcome,cleared,endedAt){game={...game,status:'settled',outcome,cleared,payout:outcome==='caught'?0:rules.payout(game.stake,cleared),endedAt};paint();}
 function advancePractice(now){
  const target=game.autoBlock??rules.lastBlock(game.stake),caughtAt=game.startedAt+practiceCaught*rules.blockMs,targetAt=game.startedAt+target*rules.blockMs;
  if(practiceCaught<=target&&now>=caughtAt)settlePractice('caught',practiceCaught-1,caughtAt);
  else if(target<practiceCaught&&now>=targetAt)settlePractice(target===rules.lastBlock(game.stake)?'limit':'auto',target,targetAt);
  else{game.cleared=rules.clearedAt(now-game.startedAt);game.bank=rules.payout(game.stake,game.cleared);if(game.cleared>lastCleared){lastCleared=game.cleared;audio.corner();}}
 }
 function cashout(){
  if(busy||pending||!active(game)||autoHolding||frozen!==null||!game.cleared)return;
  audio.unlock();if(demo){const now=performance.now();advancePractice(now);if(active(game))settlePractice('escape',game.cleared,now);}
  else{if(performance.now()-anchor>2000)return;frozen=Math.max(0,serverTime()-game.startedAt);audio.stopRun();clearTimeout(pollTimer);scheduleFrame();send({action:'cashout',gameId:game.id,requestId:crypto.randomUUID()});}
 }
 async function reconnect(){
  if(busy||connecting)return;if(pending){retry?.();return;}
  if(!localStorage.getItem('tornVisitorApiKey')){ready=false;controls();return;}
  const run=epoch;connecting=true;controls();
  try{const response=await request({action:'current'});if(!current(run))return;ready=true;adopt(response,false);notice();}
  catch(e){if(current(run)){ready=false;notice(e.message,reconnect);}}
  finally{if(current(run)){connecting=false;controls();scheduleFrame();schedulePoll();}}
 }
 function reset(){stop();epoch++;busy=false;pending=null;connecting=false;polling=false;ready=false;playing=false;demo=false;game=null;saved=null;heldBalance=null;lastStateAt=0;frozen=null;autoHolding=false;$('mr-menu').hidden=false;$('mr-play').hidden=true;notice();configure();reconnect();scheduleFrame();}
 document.addEventListener('DOMContentLoaded',()=>{
  try{const s=JSON.parse(localStorage.getItem('midnight-run-choice'));if(rules.stakes.includes(s?.stake)&&rules.validAuto(s.autoBlock,s.stake)){stake=s.stake;autoBlock=s.autoBlock;}}catch{}
  for(const prefix of ['mr-menu-','mr-play-']){
   $(prefix+'settings').innerHTML=settings(prefix);$(prefix+'stake').onchange=e=>{stake=Number(e.target.value);if(autoBlock!==null)autoBlock=Math.min(autoBlock,rules.lastBlock(stake));configure();};
   $(prefix+'auto').onchange=e=>{autoBlock=e.target.value===''?null:Number(e.target.value);configure();};
  }
  scene=new window.MidnightRunScene($('mr-scene'));preview=new window.MidnightRunScene($('mr-preview'));configure();
  $('mr-start').onclick=start;$('mr-practice').onclick=practice;$('mr-cashout').onclick=cashout;
  $('mr-cashout').onpointerdown=e=>{if(e.isPrimary&&e.button===0&&!e.currentTarget.disabled)cashout();};
  $('mr-again').onclick=()=>demo?practice():start();$('mr-retry').onclick=()=>retry?.();$('mr-free').onchange=e=>{demo=e.target.checked;controls();if(!demo)reconnect();};
  $('mr-help').onclick=()=>{
   const d=document.createElement('dialog');d.className='xan-dialog mr-help';d.innerHTML='<h2>How to play Midnight Run</h2><ol><li>Choose your wager and start. Your runner moves automatically after a three-second countdown.</li><li>Clear the first block to unlock cash-out. Every cleared corner raises your return. Getting caught before escaping loses your wager.</li><li>Press Escape &amp; cash out to take the return from your cleared blocks. Moving partway through a block does not increase that return. Street scenery and patrol lights are atmosphere, not clues to a future outcome.</li><li>Optionally set Auto escape before starting. The server saves this target and pays if you clear that block, even if you disconnect. Getting caught at that corner takes priority.</li><li>Your run continues if you leave. Manual escape is confirmed using the time your verified request reaches the server; an already confirmed capture cannot be reversed. Use Auto escape to avoid network timing.</li><li>Reaching 50,000,000 chips escapes automatically. Returns include your wager. Free practice uses the same risks and never spends or awards chips.</li></ol><button class="mr-secondary">Got it</button>';document.body.append(d);d.querySelector('button').onclick=()=>d.close();d.onclose=()=>d.remove();d.showModal();
  };
  reconnect();scheduleFrame();
 });
 document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();return;}if(!pageActive)return;scheduleFrame();if(!demo)reconnect();});
 window.addEventListener('pagehide',()=>{pageActive=false;epoch++;stop();});
 window.addEventListener('pageshow',e=>{if(e.persisted){pageActive=true;reset();}});
 window.addEventListener('storage',e=>{if(e.key==='tornVisitorApiKey')reset();});
})();
