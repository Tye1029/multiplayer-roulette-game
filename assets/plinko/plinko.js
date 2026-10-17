/* PLINKO_UI_V2 */
(() => {
 'use strict';const rules=window.PlinkoRules,audio=window.PlinkoAudio,$=id=>document.getElementById(id),fmt=n=>Number(n).toLocaleString('en-US'),multi=n=>Number(n).toLocaleString('en-US',{maximumFractionDigits:2})+'×';
 let board,stake=10000,risk='medium',playing=false,demo=false,ready=false,connecting=false,busy=false,pending=null,retry=null,last=null,lastFree=null,epoch=0,pageActive=true,cooldownTimer;
 const current=run=>pageActive&&run===epoch,remaining=()=>!demo&&last?Math.max(0,last.availableAt-Date.now()):0;
 window.XanSiteAdapter={current:()=>({mode:'plinko',id:playing&&!demo?last?.id||'':'',phase:playing?(busy?'playing':'ready'):'lobby'}),diagnostics:()=>({build:rules.build,ready,busy,connecting,demo,frames:board?.frame?1:0,audioVoices:audio.active})};
 function notice(text='',again=null){$('pl-notice').textContent=text;retry=again;$('pl-retry').hidden=!again;$('pl-retry').textContent=pending?'Recover drop':'Reconnect';}
 function settings(prefix){return '<div class="pl-settings"><label class="pl-stake-label" for="'+prefix+'stake">Chips per drop<select id="'+prefix+'stake">'+rules.stakes.map(n=>'<option value="'+n+'">'+fmt(n)+' chips</option>').join('')+'</select></label><div class="pl-risk-heading"><span>Risk level</span><small>16 PEG ROWS</small></div><div class="pl-risks" role="group" aria-label="Risk level">'+Object.entries(rules.risks).map(([key,value])=>'<button type="button" data-risk="'+key+'" aria-pressed="false">'+value.name+'</button>').join('')+'</div><p class="pl-risk-note"></p><div class="pl-cap"><span>Top return · includes wager</span><b></b></div></div>';}
 function controls(){const locked=busy||Boolean(pending);
  for(const prefix of ['pl-menu-','pl-play-']){const panel=$(prefix+'settings');panel.querySelector('select').value=String(stake);panel.querySelector('select').disabled=locked;for(const button of panel.querySelectorAll('[data-risk]')){button.disabled=locked;button.setAttribute('aria-pressed',String(button.dataset.risk===risk));}panel.querySelector('.pl-risk-note').textContent=rules.risks[risk].description;panel.querySelector('.pl-cap b').textContent=fmt(rules.payout(stake,risk,0))+' chips';}
  $('pl-enter').disabled=locked;
  $('pl-drop').disabled=locked||(!demo&&(!ready||connecting))||remaining()>0;
  $('pl-drop').textContent=busy?'Ball in motion…':pending?'Recover your drop':remaining()>0?'Preparing next drop…':demo?'Drop a free ball':'Drop ball · '+fmt(stake)+' chips';
  $('pl-connect').hidden=ready;$('pl-play-connect').hidden=ready||demo;
  $('pl-mode').textContent=demo?'FREE PRACTICE · NO CHIPS SPENT':'THE DROP ROOM';
  $('pl-play-note').textContent=demo?'Free practice uses the same odds and payouts. No chips are spent or awarded.':'Each bounce is random. Timing does not affect the result. Returns include your wager; maximum 50,000,000 chips.';
  clearTimeout(cooldownTimer);if(!busy&&remaining()>0)cooldownTimer=setTimeout(controls,Math.min(remaining()+25,1000));
 }
 function configure(){controls();board.configure(stake,risk);payouts();try{localStorage.setItem('plinko-choice',JSON.stringify({stake,risk}));}catch{}}
 function payouts(){const weights=rules.weights;$('pl-odds').innerHTML='<table><caption>'+rules.risks[risk].name+' risk · '+fmt(stake)+' chips per drop. Pockets run left to right. Amounts include the wager and already apply the 50M cap.</caption><thead><tr><th scope="col">Pocket</th><th scope="col">Chance</th><th scope="col">Return</th><th scope="col">Chips</th></tr></thead><tbody>'+weights.map((w,k)=>'<tr><th scope="row">'+(k+1)+'</th><td>'+(100*w/2**rules.rows).toFixed(3)+'%</td><td>'+multi(rules.multiplier(stake,risk,k))+'</td><td>'+fmt(rules.payout(stake,risk,k))+'</td></tr>').join('')+'</tbody></table>';}

 function result(s,restored=false){const box=$('pl-result');box.classList.toggle('is-win',Boolean(s&&s.payout>s.stake));box.classList.toggle('is-loss',Boolean(s&&s.payout<s.stake));
  if(!s){box.querySelector('.pl-result-label').textContent='THE NEXT ONE COULD BE YOURS';box.querySelector('strong').textContent='Ready when you are.';box.querySelector('p').textContent='Select your wager and risk, then drop the ball.';return;}
  box.querySelector('.pl-result-label').textContent=(demo?'PRACTICE RETURN':restored?'LAST DROP · TOTAL RETURN':'TOTAL RETURN')+' · '+multi(s.multiplier);
  box.querySelector('strong').textContent=fmt(s.payout)+' chips';const net=s.payout-s.stake;
  box.querySelector('p').textContent=(demo?'No chips spent or awarded. ':net>0?'Profit +'+fmt(net)+' chips. ':net===0?'Your wager was returned. ':'')+(s.payout===rules.maxPayout?'Maximum payout reached. ':'')+'Pocket '+(s.bucket+1)+' · '+rules.risks[s.risk].name+' risk.';
  $('pl-board').setAttribute('aria-label','Plinko ball landed in pocket '+(s.bucket+1)+', '+multi(s.multiplier)+', '+fmt(s.payout)+' chips'+(demo?' in free practice.':'.'));
 }
 function enter(free=false){demo=free;playing=true;$('pl-menu').hidden=true;$('pl-play').hidden=false;configure();result(demo?lastFree:last,true);audio.unlock();}
 async function request(body){return window.XanHub.gameRequest('plinko-action',body);}
 function balance(response){if(Number.isFinite(response.balance)&&$('hub-balance'))$('hub-balance').textContent=fmt(response.balance)+' Chips';}
 async function launch(body){if(busy)return;const run=epoch,free=demo;busy=true;pending=free?null:body;notice();controls();audio.drop();$('pl-flight').textContent='RELEASING BALL';$('pl-board-title').textContent='Watch it fall.';$('pl-result').classList.remove('is-win','is-loss');$('pl-result').querySelector('.pl-result-label').textContent='BALL IN MOTION';$('pl-result').querySelector('strong').textContent='Follow the bounce.';$('pl-result').querySelector('p').textContent='Your return appears when the ball lands.';$('pl-machine').classList.remove('is-celebrating');$('pl-machine').classList.add('is-dropping');
  try{
   let response,s;if(free){const bits=crypto.getRandomValues(new Uint8Array(rules.rows));s={id:'practice-'+Date.now(),stake,risk,...rules.outcome(stake,risk,Array.from(bits,n=>n&1)),status:'settled'};}else{response=await request(body);s=response.drop;}if(!current(run))return;
   if(s?.status!=='settled')throw Error('Drop is not settled yet.');
   pending=null;stake=s.stake;risk=s.risk;controls();payouts();
   const done=await board.animate(s,audio,row=>{$('pl-flight').textContent='BOUNCE '+row+' / '+rules.rows;});if(!done||!current(run))return;
   if(free)lastFree=s;else{last=s;balance(response);}
   result(s);$('pl-flight').textContent=multi(s.multiplier)+' · LANDED';$('pl-board-title').textContent=s.payout>s.stake?'That’s a good bounce.':'Every bounce is a new chance.';
   if(s.payout>s.stake)$('pl-machine').classList.add('is-celebrating');if(!free)window.XanHub.refresh().catch(()=>{});
  }catch(e){if(!current(run))return;
   if([400,401,404,409,429].includes(e.status)){pending=null;notice(e.message,e.status===429?reconnect:null);if(e.status===401)ready=false;result(free?lastFree:last,true);$('pl-flight').textContent='READY TO DROP';$('pl-board-title').textContent='Find your fortune.';}
   else{notice('Connection interrupted. Recover this drop before starting another. Your purchase reference is saved.',()=>launch(body));$('pl-result').querySelector('.pl-result-label').textContent='CONNECTION INTERRUPTED';$('pl-result').querySelector('strong').textContent='Your drop is saved.';$('pl-result').querySelector('p').textContent='Use Recover drop to restore the original result.';}
  }finally{if(current(run)){busy=false;$('pl-machine').classList.remove('is-dropping');if(pending)$('pl-flight').textContent='AWAITING CONFIRMATION';controls();}}
 }
 function drop(){if(busy||pending||remaining()>0||(!demo&&(!ready||connecting)))return;launch({action:'drop',stake,risk,quote:rules.build,requestId:crypto.randomUUID()});}
 async function reconnect(){if(busy||pending)return;if(!localStorage.getItem('tornVisitorApiKey')){ready=false;controls();return;}const run=epoch;connecting=true;controls();
  try{const response=await request({action:'current'});if(!current(run))return;ready=true;last=response.drop;balance(response);notice();if(playing&&!demo){result(last,true);if(last&&last.stake===stake&&last.risk===risk)board.show(last);}}
  catch(e){if(current(run)){ready=false;notice(e.message,reconnect);}}finally{if(current(run)){connecting=false;controls();}}
 }
 document.addEventListener('DOMContentLoaded',()=>{
  try{const s=JSON.parse(localStorage.getItem('plinko-choice'));if(rules.stakes.includes(s?.stake))stake=s.stake;if(Object.hasOwn(rules.risks,s?.risk))risk=s.risk;}catch{}
  for(const prefix of ['pl-menu-','pl-play-']){const panel=$(prefix+'settings');panel.innerHTML=settings(prefix);panel.querySelector('select').onchange=e=>{stake=Number(e.target.value);configure();};for(const b of panel.querySelectorAll('[data-risk]'))b.onclick=()=>{risk=b.dataset.risk;configure();};}
  const connect=document.createElement('a');connect.id='pl-play-connect';connect.href='/';connect.textContent='Connect your public Torn API key to play with chips ↗';connect.className='pl-play-connect';$('pl-drop').after(connect);
  board=new window.PlinkoBoard($('pl-board'));configure();$('pl-enter').onclick=()=>enter(false);$('pl-drop').onclick=drop;$('pl-retry').onclick=()=>retry?.();
  $('pl-payouts').onclick=()=>{const open=$('pl-odds').hidden;$('pl-odds').hidden=!open;$('pl-payouts').setAttribute('aria-expanded',String(open));};
  $('pl-help').onclick=()=>{const d=document.createElement('dialog');d.className='xan-dialog pl-help';d.innerHTML='<h2>How to play Plinko</h2><ol><li>Choose your wager and Low, Medium or High risk. Entering the board is free.</li><li>Press Drop ball to spend the displayed wager. Follow your ball as it bounces through 16 rows of pegs.</li><li>The ball lands in one of 17 pockets. Its multiplier gives your total return, including your original wager. A return below 1× means you lose part of the wager.</li><li>Low risk has smaller swings. High risk has smaller center returns and rare larger edge prizes. View payouts for exact chip amounts and pocket probabilities at your chosen wager. Each left or right bounce is equally likely; timing cannot improve your odds.</li><li>Every drop has a maximum total return of 50,000,000 chips. The board already shows capped payouts. Prizes go straight to your chip balance; you never need to claim them.</li><li>If the connection drops, use Recover drop or reload. The same drop is restored without buying it again.</li></ol><button class="pl-secondary">Got it</button>';document.body.append(d);d.querySelector('button').onclick=()=>d.close();d.onclose=()=>d.remove();d.showModal();};
  reconnect();
 });
 document.addEventListener('visibilitychange',()=>{if(document.hidden){audio.silence();return;}board?.resume();if(pageActive&&!busy&&!pending&&!demo)reconnect();});
 window.addEventListener('pagehide',()=>{pageActive=false;epoch++;board?.stop();audio.silence();clearTimeout(cooldownTimer);});
 window.addEventListener('pageshow',e=>{if(e.persisted){pageActive=true;busy=false;pending=null;playing=false;demo=false;ready=false;connecting=false;last=null;$('pl-menu').hidden=false;$('pl-play').hidden=true;notice();configure();reconnect();}});
})();
