/* DICE_V4 */
(() => {
 'use strict';const rules=window.LuckyDiceRules,audio=window.DiceDuelAudio,$=id=>document.getElementById(id),fmt=n=>Number(n).toLocaleString('en-US');
 let target=7,direction='higher',table,stake=10000,playing=false,demo=false,ready=false,connecting=false,busy=false,pending=null,retry=null,last=null,lastFree=null,epoch=0,pageActive=true,cooldownUntil=0,cooldownTimer;
 const current=run=>pageActive&&run===epoch,remaining=()=>demo?0:Math.max(0,cooldownUntil-performance.now()),read=key=>{try{return localStorage.getItem(key);}catch{return null;}};
 window.XanSiteAdapter={current:()=>({mode:'luckydice',id:'',phase:playing?(busy?'rolling':'ready'):'lobby'}),diagnostics:()=>({build:'DICE_V4',ready,busy,connecting,demo,animations:table?.animations.size||0,audioVoices:audio.active})};
 function notice(text='',again=null){$('dd-notice').textContent=text;retry=again;$('dd-retry').hidden=!again;$('dd-retry').textContent=pending?'Recover roll':'Reconnect';}
 function settings(prefix){return '<div class="dd-settings"><label for="'+prefix+'stake">Chips per roll<select id="'+prefix+'stake">'+rules.stakes.map(n=>'<option value="'+n+'">'+fmt(n)+' chips</option>').join('')+'</select></label><div class="ld-choice"><label>Prediction<select data-choice="direction"><option value="higher">Higher than</option><option value="lower">Lower than</option></select></label><label>Your number<select data-choice="target">'+rules.targets.map(n=>'<option>'+n+'</option>').join('')+'</select></label></div><div class="dd-payout-preview"><span>Win return</span><b></b></div><p class="ld-odds"></p></div>';}
 function prediction(t=target,d=direction){$('ld-call').textContent=d.toUpperCase()+' THAN '+t;$('ld-target-display').textContent=(d==='higher'?'> ':'< ')+t;const values=Array.from({length:11},(_,i)=>i+2).filter(n=>d==='higher'?n>t:n<t);$('ld-winning-totals').textContent='Win on '+values.join(', ');$('ld-distribution').replaceChildren(...Array.from({length:11},(_,i)=>{const n=i+2,bar=document.createElement('i');bar.style.height=(6-Math.abs(7-n))*8+'px';bar.dataset.total=n;bar.className=values.includes(n)?'is-winning':'';bar.title=n+': '+(6-Math.abs(7-n))+' of 36 combinations';return bar;}));}
 function controls(){const locked=busy||Boolean(pending);
  for(const prefix of ['dd-menu-','dd-play-']){const panel=$(prefix+'settings');panel.querySelector('select').value=String(stake);panel.querySelector('[data-choice=target]').value=target;panel.querySelector('[data-choice=direction]').value=direction;panel.querySelectorAll('select').forEach(e=>e.disabled=locked);const q=rules.quote(stake,target,direction);panel.querySelector('b').textContent=fmt(q.payout)+' chips · '+q.multiplier.toFixed(3)+'×';panel.querySelector('.ld-odds').textContent='Matching '+target+' loses.';}
  $('dd-enter').disabled=locked;
  $('dd-roll').disabled=locked||(!demo&&(!ready||connecting))||remaining()>0;
  $('dd-roll').textContent=busy?'Dice in motion…':pending?'Recover your roll':remaining()>0?'Preparing next roll…':demo?'Roll free dice':'Roll dice · '+fmt(stake)+' chips';
  $('dd-connect').hidden=ready;$('dd-play-connect').hidden=ready||demo;
  $('dd-mode').textContent=demo?'FREE PRACTICE · NO CHIPS SPENT':'';
  $('dd-play-note').textContent=demo?'Practice uses the same fair dice and payouts. No chips are spent or awarded.':'Winnings are added automatically.';
  clearTimeout(cooldownTimer);if(!busy&&remaining()>0)cooldownTimer=setTimeout(controls,Math.min(remaining()+25,1000));
 }
 function configure(){controls();try{localStorage.setItem('lucky-dice-stake',String(stake));}catch{}}
 function totals(s){$('dd-player-total').textContent=s?s.total:'—';$('dd-player-note').textContent=s?s.dice.join(' + '):'Ready to roll';}
 function result(s,restored=false){const box=$('dd-result');box.dataset.outcome=s?.outcome||'';$('dd-machine').classList.remove('is-win','is-loss');$('dd-player-lane').classList.remove('is-winner');$('dd-sparks').replaceChildren();totals(s);prediction(s?.target,s?.direction);
  if(!s){$('dd-result-label').textContent='MAKE YOUR PREDICTION';$('dd-result-value').textContent='Ready to roll.';$('dd-result-note').textContent='Pick higher or lower, then roll your two dice.';$('dd-table-title').textContent='Your number. Your call.';$('dd-table-status').textContent='TWO FAIR DICE. A LITTLE SUSPENSE.';table.show([3,5],false);return;}
  table.show(s.dice);$('dd-result-label').textContent=(demo?'PRACTICE · ':restored?'LAST ROLL · ':'')+(s.outcome==='win'?'YOU CALLED IT':'PREDICTION MISSED');$('dd-result-value').textContent=fmt(s.payout)+' chips';$('dd-result-note').textContent=(demo?'No chips spent or awarded. ':s.outcome==='win'?'Profit +'+fmt(s.payout-s.stake)+' chips. ':'')+'Rolled '+s.total+' · '+s.direction+' than '+s.target+(s.total===s.target?' · Matching your number loses.':'.');$('dd-table-title').textContent=s.outcome==='win'?'A lucky call.':'A new roll awaits.';$('dd-table-status').textContent='ROLLED '+s.total+' · '+s.direction.toUpperCase()+' THAN '+s.target;if(s.outcome==='win')$('dd-player-lane').classList.add('is-winner');
 }
 function celebrate(outcome){audio.finish(outcome);$('dd-machine').classList.add('is-'+outcome);if(outcome!=='win'||matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  for(let i=0;i<28;i++){const p=document.createElement('i');p.className='dd-spark';p.style.setProperty('--i',i);p.style.setProperty('--x',(Math.cos(i*2.39996)*(70+i*7))+'px');p.style.setProperty('--y',(Math.sin(i*2.39996)*110+130)+'px');p.style.setProperty('--r',(i*87)+'deg');$('dd-sparks').append(p);}
 }
 function enter(free=false){demo=free;playing=true;$('dd-menu').hidden=true;$('dd-play').hidden=false;configure();result(demo?lastFree:last,true);audio.unlock();const run=epoch;}
 async function request(body){return window.XanHub.gameRequest('lucky-dice-action',body);}
 function adopt(response,showBalance=true){last=response.round;if(showBalance&&Number.isFinite(response.balance)&&$('hub-balance'))$('hub-balance').textContent=fmt(response.balance)+' Chips';cooldownUntil=performance.now()+Math.max(0,(last?.availableAt||0)-response.serverNow);}
 async function launch(body){if(busy)return;const run=epoch,free=demo;busy=true;pending=free?null:body;notice();controls();audio.unlock();result(null);table.prepare();$('dd-table-title').textContent='Let them roll.';$('dd-table-status').textContent=free?'GETTING THE DICE READY':'SECURING YOUR WAGER';$('dd-result-label').textContent='ROLL IN PROGRESS';$('dd-result-value').textContent='Watch the dice.';$('dd-result-note').textContent='Your return appears when both dice settle.';
  try{
   let response,s;if(free){const dice=[];while(dice.length<2){const n=crypto.getRandomValues(new Uint8Array(1))[0];if(n<252)dice.push(n%6+1);}s={id:'practice-'+Date.now(),stake,...rules.outcome(stake,dice,target,direction),status:'settled'};}else{response=await request(body);s=response.round;}if(!current(run))return;
   if(s?.status!=='settled')throw Error('Round is not settled yet.');
   pending=null;stake=s.stake;target=s.target;direction=s.direction;if(!free)adopt(response,false);controls();$('dd-machine').classList.add('is-rolling');$('dd-table-status').textContent='DICE IN MOTION';$('dd-player-note').textContent='Rolling…';
   const done=await table.roll(s.dice,audio,()=>{});
   if(!done||!current(run))return;if(free)lastFree=s;else if(Number.isFinite(response.balance)&&$('hub-balance'))$('hub-balance').textContent=fmt(response.balance)+' Chips';result(s);celebrate(s.outcome);if(!free)window.XanHub.refresh().catch(()=>{});
  }catch(e){if(!current(run))return;table.stop();audio.silence();
   if([400,401,404,409,429].includes(e.status)){pending=null;if(e.status===401)ready=false;notice(e.message,e.status===429?reconnect:null);result(free?lastFree:last,true);}
   else{notice('Connection interrupted. Recover this roll before starting another. The same wager and dice are saved.',()=>launch(body));$('dd-result-label').textContent='AWAITING CONFIRMATION';$('dd-result-value').textContent='Your roll is saved.';$('dd-result-note').textContent='Recover the original roll without purchasing it again.';$('dd-table-status').textContent='RECONNECT TO RECOVER YOUR ROLL';}
  }finally{if(current(run)){busy=false;$('dd-machine').classList.remove('is-rolling');controls();}}
 }
 function roll(){if(busy||pending||remaining()>0||(!demo&&(!ready||connecting)))return;launch({action:'roll',stake,target,direction,quote:rules.build,requestId:crypto.randomUUID()});}
 async function reconnect(){if(busy||pending)return;if(!read('tornVisitorApiKey')){ready=false;controls();return;}const run=epoch;connecting=true;controls();
  try{const token=await window.XanHub.authenticate();await window.XanHub.post('dice-duel-action',{action:'current',token});const response=await request({action:'current'});if(!current(run))return;ready=true;adopt(response);notice();if(playing&&!demo)result(last,true);}
  catch(e){if(current(run)){ready=false;notice(e.message,reconnect);}}finally{if(current(run)){connecting=false;controls();}}
 }
 function profile(){const p=window.XanHub?.profile;if(!p)return;$('dd-player-name').textContent=p.name||'You';const avatar=$('dd-player-avatar'),src=p.avatar||p.image||p.profileImage||p.profile_image;avatar.textContent=(p.name||'Y').slice(0,1);if(src){const img=document.createElement('img');img.alt='';img.src=src;img.onerror=()=>{avatar.textContent=(p.name||'Y').slice(0,1);};avatar.replaceChildren(img);}}
 document.addEventListener('DOMContentLoaded',()=>{
  const saved=Number(read('lucky-dice-stake'));if(rules.stakes.includes(saved))stake=saved;
  for(const prefix of ['dd-menu-','dd-play-']){const panel=$(prefix+'settings');panel.innerHTML=settings(prefix);panel.querySelector('select').onchange=e=>{stake=Number(e.target.value);configure();};panel.querySelector('[data-choice=target]').onchange=e=>{target=Number(e.target.value);configure();prediction();};panel.querySelector('[data-choice=direction]').onchange=e=>{direction=e.target.value;configure();prediction();};}
  table=new DiceDuelTable($('dd-player-dice'));for(let i=0;i<3;i++){const die=DiceDuelDie(i===1);die.querySelector('.dd-die-cube').style.transform=['rotateX(-25deg) rotateY(-30deg)','rotateX(-30deg) rotateY(35deg)','rotateX(32deg) rotateY(-25deg)'][i];$('dd-hero-dice').append(die);}
  $('dd-enter').onclick=()=>enter(false);$('dd-roll').onclick=roll;$('dd-retry').onclick=()=>retry?.();
  $('dd-help').onclick=()=>{const d=document.createElement('dialog');d.className='xan-dialog dd-help';d.innerHTML='<h2>How to play Lucky Dice</h2><ol><li>Choose a wager, a number from 3 to 11, and Higher or Lower. The preview shows your winning return before you pay.</li><li>Press Roll dice. Two independent fair six-sided dice are rolled, and your wager is spent.</li><li>Your combined total must be strictly higher or lower than your chosen number. Matching that number loses.</li><li>Less likely predictions pay more. For example, under 3 only wins on double ones and pays 34.2×. Over 3 wins on totals 4–12 and pays about 1.036×.</li><li>The return includes your original wager and is added automatically. Payouts are rounded down to whole chips. Every setting has a theoretical return of 95% before rounding. Results vary; a win is never guaranteed.</li><li>Change your prediction between rolls. If interrupted, recover the same roll. Free practice follows identical rules without spending or awarding chips.</li></ol><button class="dd-secondary">Got it</button>';document.body.append(d);d.querySelector('button').onclick=()=>d.close();d.onclose=()=>d.remove();d.showModal();};
  configure();profile();reconnect();
 });
 window.addEventListener('xan-hub-sync',profile);
 document.addEventListener('visibilitychange',()=>{if(document.hidden){audio.silence();return;}if(pageActive&&!busy&&!pending&&!demo)reconnect();});
 window.addEventListener('pagehide',()=>{pageActive=false;epoch++;table?.stop();audio.silence();clearTimeout(cooldownTimer);});
 window.addEventListener('pageshow',e=>{if(e.persisted){pageActive=true;busy=false;pending=null;playing=false;demo=false;ready=false;connecting=false;last=null;$('dd-menu').hidden=false;$('dd-play').hidden=true;$('dd-machine').classList.remove('is-rolling');notice();configure();reconnect();}});
})();
