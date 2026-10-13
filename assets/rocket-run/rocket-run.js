/* ROCKET_RUN_V1 */
(() => {
 'use strict';
 const rules=window.RocketRunRules,audio=window.RocketRunAudio,$=id=>document.getElementById(id),fmt=n=>Number(n).toLocaleString('en-US'),mult=n=>(n/100).toFixed(2)+'×';
 let scene,stake=50000,autoCents=null,game=null,saved=null,demo=false,playing=false,ready=false,busy=false,connecting=false,pending=null,retry=null,epoch=0,pageActive=true;
 let frame=0,pollTimer=0,polling=false,serverStamp=0,anchor=0,frameStamp=0,lastCount=-1,lastPhase='',celebrated='',effectUntil=0,practiceCrash=0;
 const active=s=>s?.status==='active',finished=s=>s?.status==='settled',current=run=>pageActive&&run===epoch;
 const serverTime=()=>serverStamp+Math.min(1800,Math.max(0,performance.now()-anchor));
 window.XanSiteAdapter={current:()=>({mode:'rocket',id:playing&&!demo?game?.id||'':'',phase:playing?(active(game)?'playing':'ready'):'lobby'}),diagnostics:()=>({build:rules.build,ready,busy,connecting,polling,demo,phase:game?.status,frames:frame?1:0,audioVoices:audio.active})};
 function notice(text='',again=null){$('rr-notice').textContent=text;retry=again;$('rr-retry').hidden=!again;$('rr-retry').textContent=pending?'Recover flight':'Reconnect';}
 function settings(prefix){return '<div class="rr-settings"><label for="'+prefix+'stake">Chips per flight<select id="'+prefix+'stake">'+rules.stakes.map(n=>'<option value="'+n+'">'+fmt(n)+' chips</option>').join('')+'</select></label><label for="'+prefix+'auto">Auto cash-out <small>OPTIONAL</small><select id="'+prefix+'auto"></select></label><p class="rr-auto-note"></p><div class="rr-limit"><span>Maximum return · includes wager</span><b>50,000,000 chips</b></div></div>';}
 function configure(){
  for(const prefix of ['rr-menu-','rr-play-']){const panel=$(prefix+'settings');$(prefix+'stake').value=String(stake);const options=[110,125,150,200,300,500,1000,2000,5000,10000,25000,50000,100000].filter(n=>n<=rules.cap(stake));if(!options.includes(rules.cap(stake)))options.push(rules.cap(stake));$(prefix+'auto').innerHTML='<option value="">Off · I’ll cash out</option>'+options.map(n=>'<option value="'+n+'">'+mult(n)+' · '+fmt(rules.payout(stake,n))+' chips</option>').join('');$(prefix+'auto').value=autoCents===null?'':String(autoCents);panel.querySelector('.rr-auto-note').textContent=autoCents===null?'Press Cash out during flight. The server confirms the return.':'Locks in '+mult(autoCents)+' before launch. Triggers automatically if the rocket survives that far.';}
  try{localStorage.setItem('rocket-run-choice',JSON.stringify({stake,autoCents}));}catch{}controls();
 }
 function controls(){
  const inFlight=playing&&active(game),locked=busy||connecting||Boolean(pending)||inFlight;
  for(const id of ['rr-menu-stake','rr-play-stake','rr-menu-auto','rr-play-auto'])$(id).disabled=locked;
  $('rr-start').disabled=busy||connecting||Boolean(pending)||!ready;$('rr-practice').disabled=busy||connecting||Boolean(pending);
  $('rr-start').textContent=active(saved)?'Resume your flight':'Launch · '+fmt(stake)+' chips';$('rr-connect').hidden=ready;
  $('rr-again').disabled=busy||connecting||Boolean(pending)||(!demo&&!ready);$('rr-again').textContent=demo?'Launch a free flight':active(saved)?'Resume your flight':'Launch again · '+fmt(stake)+' chips';
  $('rr-free').disabled=locked;$('rr-free').checked=demo;$('rr-free-wrap').hidden=inFlight;
  $('rr-live').hidden=!inFlight;$('rr-cashout').hidden=!inFlight;$('rr-again').hidden=inFlight;$('rr-result').hidden=!finished(game);
  $('rr-round-note').textContent=demo?'Free practice uses the same crash odds. No chips are spent or awarded.':inFlight?'Your flight continues if you leave. Your saved auto cash-out still applies.':'Choose your next wager and auto cash-out above.';
 }
 function scheduleFrame(){if(!frame&&playing&&pageActive&&!document.hidden)frame=requestAnimationFrame(render);}
 function stop(){cancelAnimationFrame(frame);frame=0;clearTimeout(pollTimer);audio.silence();}
 function render(stamp){frame=0;if(!pageActive||!playing||document.hidden)return;
  if(stamp-frameStamp<30){scheduleFrame();return;}frameStamp=stamp;
  const now=demo?performance.now():serverTime(),elapsed=game?now-game.launchAt:0;
  if(demo&&active(game)){
   const target=game.autoCents??rules.cap(game.stake),crashAt=game.launchAt+rules.timeAt(practiceCrash),autoAt=game.launchAt+rules.timeAt(target);
   if(practiceCrash<=target&&now>=crashAt)settlePractice('crash',0,crashAt);else if(target<practiceCrash&&now>=autoAt)settlePractice(target===rules.cap(game.stake)?'limit':'auto',target,autoAt);
  }
  let phase=active(game)?(elapsed<0?'countdown':'flight'):finished(game)?(game.outcome==='crash'?'crash':'win'):'ready';
  const elapsedDraw=finished(game)?game.endedAt-game.launchAt:Math.max(0,elapsed),cents=finished(game)?(game.outcome==='crash'?game.crashCents:game.cashCents):Math.min(game?.autoCents??rules.cap(stake),rules.centsAt(elapsed));
  const stale=!demo&&active(game)&&performance.now()-anchor>1800;
  $('rr-countdown').hidden=phase!=='countdown';
  if(phase==='countdown'){const count=Math.max(1,Math.ceil(-elapsed/1000));$('rr-countdown').querySelector('strong').textContent=count;if(count!==lastCount){lastCount=count;audio.tick();}}
  if(phase==='flight'){if(lastPhase==='countdown')audio.ignite();audio.engine(cents/100);}else audio.stopEngine();
  lastPhase=phase;
  $('rr-multiplier').innerHTML=(cents/100).toFixed(2)+'<span>×</span>';
  $('rr-flight-label').textContent=phase==='countdown'?'YOUR FLIGHT STARTS IN A MOMENT':phase==='flight'?(stale?'CONFIRMING FLIGHT':'MULTIPLIER CLIMBING'):phase==='win'?'RETURN SECURED':phase==='crash'?'FLIGHT ENDED':'READY TO LAUNCH';
  $('rr-flight-note').textContent=phase==='countdown'?'Make your moment count.':phase==='flight'?(stale?'Waiting for flight control…':'How far will you go?'):phase==='win'?'A good time to come back down.':phase==='crash'?'The next flight is a new chance.':'The sky is calling.';
  $('rr-scene-title').textContent=phase==='countdown'?'All systems ready.':phase==='flight'?'Beyond the ordinary.':phase==='win'?'Welcome back, captain.':phase==='crash'?'Flight lost.':'Ready for liftoff.';
  $('rr-value').innerHTML=fmt(game?rules.payout(game.stake,cents):0)+' <small>chips</small>';
  $('rr-value-note').textContent=phase==='countdown'?'Wait for liftoff.':stale?'Connection delayed. The server confirms cash-out timing.':'Total return includes your wager.';
  $('rr-cashout').disabled=phase!=='flight'||busy||Boolean(pending);
  $('rr-cashout').textContent=busy?'Securing your return…':pending?'Recover your flight':phase==='countdown'?'Awaiting liftoff…':'Cash out · '+fmt(rules.payout(game?.stake||stake,cents));
  $('rr-connection').textContent=demo?'FREE PRACTICE':stale?'RECONNECTING TO FLIGHT CONTROL':'FLIGHT CONTROL CONNECTED';
  scene.draw({phase,elapsed:elapsedDraw,multiplier:cents/100});
  if(active(game)||performance.now()<effectUntil)scheduleFrame();
 }
 function paint(animate=true){
  $('rr-mode').textContent=demo?'FREE FLIGHT · NO CHIPS SPENT':'FLIGHT DECK';
  $('rr-auto-badge').textContent=game?.autoCents?'AUTO CASH-OUT · '+mult(game.autoCents):'MANUAL CASH OUT';
  const won=finished(game)&&game.outcome!=='crash';$('rr-machine').classList.toggle('is-win',won);$('rr-machine').classList.toggle('is-crash',finished(game)&&!won);
  if(finished(game)){
   $('rr-result').classList.toggle('is-win',won);$('rr-result').classList.toggle('is-crash',!won);
   $('rr-result-label').textContent=won?(game.outcome==='limit'?'MAXIMUM RETURN':game.outcome==='auto'?'AUTO CASH-OUT · '+mult(game.cashCents):'CASHED OUT · '+mult(game.cashCents)):'CRASHED AT '+mult(game.crashCents);
   $('rr-result-value').textContent=fmt(game.payout)+' chips';$('rr-result-note').textContent=demo?'Practice flight complete. No chips spent or awarded.':won?'Return credited to your chip balance.':'This flight’s '+fmt(game.stake)+'-chip wager was lost.';
   $('rr-scene').setAttribute('aria-label',won?'Rocket Run: cashed out at '+mult(game.cashCents)+', '+fmt(game.payout)+' chips.':'Rocket Run: crashed at '+mult(game.crashCents)+'.');
   if(animate&&celebrated!==game.id){celebrated=game.id;effectUntil=performance.now()+2600;audio.finish(won);}
  }else $('rr-scene').setAttribute('aria-label','Rocket Run flight in progress. Use Cash out to secure your return.');
  controls();scheduleFrame();
 }
 function enter(){playing=true;$('rr-menu').hidden=true;$('rr-play').hidden=false;lastCount=-1;lastPhase='';paint(false);requestAnimationFrame(()=>$('rr-play').scrollIntoView({block:'start',behavior:'instant'}));schedulePoll();}
 async function request(body){const before=performance.now(),token=await window.XanHub.authenticate(),response=await window.XanHub.post('rocket-run-action',{token,...body});return {...response,received:performance.now(),before};}
 function adopt(response,animate=true){
  const next=response.game;
  if(game&&next&&game.id===next.id&&finished(game)&&!finished(next))return;
  if(response.serverNow<serverStamp)return;
  serverStamp=response.serverNow;anchor=response.received;saved=next;
  if(Number.isFinite(response.balance)&&$('hub-balance'))$('hub-balance').textContent=fmt(response.balance)+' Chips';
  if(!demo&&playing){game=next;if(game){stake=game.stake;autoCents=game.autoCents;configure();paint(animate);}}
 }
 function schedulePoll(){clearTimeout(pollTimer);if(pageActive&&playing&&!demo&&active(game)&&!document.hidden)pollTimer=setTimeout(poll,950);}
 async function poll(){if(polling||busy||!pageActive||!playing||demo||!active(game)||document.hidden){schedulePoll();return;}polling=true;const run=epoch,id=game.id;
  try{const response=await request({action:'current'});if(!current(run)||demo||game?.id!==id)return;adopt(response);if(!pending)notice();}
  catch(e){if(current(run))notice('Flight connection delayed. Reconnect to confirm the result. Your saved auto cash-out still applies.',reconnect);}
  finally{polling=false;if(current(run))schedulePoll();}
 }
 async function send(body,opening=false){if(busy)return;const run=epoch;busy=true;pending=body;notice();controls();audio.unlock();
  try{const response=await request(body);if(!current(run))return;pending=null;ready=true;adopt(response);if(opening){game=response.game;saved=game;stake=game.stake;autoCents=game.autoCents;configure();enter();}else paint();if(finished(game))window.XanHub.refresh().catch(()=>{});}
  catch(e){if(!current(run))return;if([400,401,404,409].includes(e.status)){pending=null;if(e.status===401)ready=false;notice(e.message,reconnect);}else notice('Connection interrupted. Recover this flight before launching again. Your launch and cash-out receipts are saved.',()=>send(body,opening));}
  finally{if(current(run)){busy=false;controls();scheduleFrame();schedulePoll();}}
 }
 function start(){if(busy||pending||connecting||!ready)return;demo=false;stop();epoch++;if(active(saved)){game=saved;stake=game.stake;autoCents=game.autoCents;configure();enter();reconnect();return;}send({action:'start',stake,autoCents,quote:rules.build,requestId:crypto.randomUUID()},true);}
 function practice(){if(busy||pending||connecting)return;stop();epoch++;demo=true;const n=crypto.getRandomValues(new Uint32Array(1))[0];practiceCrash=rules.crashFrom(n);game={id:'free-'+crypto.randomUUID(),stake,autoCents,status:'active',launchAt:performance.now()+rules.countdownMs};notice();audio.unlock();enter();}
 function settlePractice(outcome,cents,endedAt){game={...game,status:'settled',outcome,cashCents:cents,crashCents:practiceCrash,payout:cents?rules.payout(game.stake,cents):0,endedAt};paint();}
 function cashout(){if(busy||pending||!active(game))return;audio.unlock();if(demo){const now=performance.now();if(now<game.launchAt)return;const crashAt=game.launchAt+rules.timeAt(practiceCrash),target=game.autoCents??rules.cap(game.stake),autoAt=game.launchAt+rules.timeAt(target);if(practiceCrash<=target&&now>=crashAt)settlePractice('crash',0,crashAt);else if(target<practiceCrash&&now>=autoAt)settlePractice(target===rules.cap(game.stake)?'limit':'auto',target,autoAt);else settlePractice('cashout',rules.centsAt(now-game.launchAt),now);}else send({action:'cashout',gameId:game.id,requestId:crypto.randomUUID()});}
 async function reconnect(){if(busy||connecting)return;if(pending){retry?.();return;}if(!localStorage.getItem('tornVisitorApiKey')){ready=false;controls();return;}const run=epoch;connecting=true;controls();
  try{const response=await request({action:'current'});if(!current(run))return;ready=true;adopt(response,false);notice();}
  catch(e){if(current(run)){ready=false;notice(e.message,reconnect);}}finally{if(current(run)){connecting=false;controls();scheduleFrame();schedulePoll();}}
 }
 document.addEventListener('DOMContentLoaded',()=>{
  try{const s=JSON.parse(localStorage.getItem('rocket-run-choice'));if(rules.stakes.includes(s?.stake)&&rules.validAuto(s.autoCents,s.stake)){stake=s.stake;autoCents=s.autoCents;}}catch{}
  for(const prefix of ['rr-menu-','rr-play-']){$(prefix+'settings').innerHTML=settings(prefix);$(prefix+'stake').onchange=e=>{stake=Number(e.target.value);if(autoCents!==null)autoCents=Math.min(autoCents,rules.cap(stake));configure();};$(prefix+'auto').onchange=e=>{autoCents=e.target.value===''?null:Number(e.target.value);configure();};}
  scene=new window.RocketRunScene($('rr-scene'));configure();$('rr-start').onclick=start;$('rr-practice').onclick=practice;$('rr-cashout').onclick=cashout;$('rr-again').onclick=()=>demo?practice():start();$('rr-retry').onclick=()=>retry?.();$('rr-free').onchange=e=>{demo=e.target.checked;controls();};
  $('rr-help').onclick=()=>{const d=document.createElement('dialog');d.className='xan-dialog rr-help';d.innerHTML='<h2>How to play Rocket Run</h2><ol><li>Choose your wager. Launch spends that amount and starts a three-second countdown.</li><li>After liftoff, the multiplier climbs. Press Cash out before the rocket crashes to secure your total return, including your wager.</li><li>A crash before cash-out loses the wager. A flight can crash immediately at 1.00×. Each flight is independent; the animation does not predict a crash.</li><li>Optionally choose Auto cash-out before launch. It is saved on the server and pays at that target if the rocket survives past it, even if you disconnect. A crash at the exact target takes priority.</li><li>Manual cash-out uses the time your request is processed by the server. The displayed value is an estimate between updates; network delay can affect manual timing. Use Auto cash-out for a fixed target.</li><li>Maximum total return is 50,000,000 chips. Reaching that limit safely cashes out automatically. Your flight continues if you leave; reconnect to recover its result. Free practice never spends or awards chips.</li></ol><button class="rr-secondary">Got it</button>';document.body.append(d);d.querySelector('button').onclick=()=>d.close();d.onclose=()=>d.remove();d.showModal();};
  reconnect();
 });
 document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();return;}if(!pageActive)return;scheduleFrame();if(!demo)reconnect();});
 window.addEventListener('pagehide',()=>{pageActive=false;epoch++;stop();});
 window.addEventListener('pageshow',e=>{if(e.persisted){pageActive=true;busy=false;pending=null;connecting=false;polling=false;ready=false;playing=false;demo=false;game=null;saved=null;serverStamp=0;$('rr-menu').hidden=false;$('rr-play').hidden=true;notice();configure();reconnect();}});
})();
