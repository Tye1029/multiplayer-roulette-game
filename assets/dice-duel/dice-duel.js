/* DICE_DUEL_V1 */
(() => {
 'use strict';const rules=window.DiceDuelRules,audio=window.DiceDuelAudio,$=id=>document.getElementById(id),fmt=n=>Number(n).toLocaleString('en-US');
 let table,stake=50000,playing=false,demo=false,ready=false,connecting=false,busy=false,pending=null,retry=null,last=null,lastFree=null,epoch=0,pageActive=true,cooldownUntil=0,cooldownTimer;
 const current=run=>pageActive&&run===epoch,remaining=()=>demo?0:Math.max(0,cooldownUntil-performance.now()),read=key=>{try{return localStorage.getItem(key);}catch{return null;}};
 window.XanSiteAdapter={current:()=>({mode:'diceduel',id:'',phase:playing?(busy?'rolling':'ready'):'lobby'}),diagnostics:()=>({build:rules.build,ready,busy,connecting,demo,animations:table?.animations.size||0,audioVoices:audio.active})};
 function notice(text='',again=null){$('dd-notice').textContent=text;retry=again;$('dd-retry').hidden=!again;$('dd-retry').textContent=pending?'Recover roll':'Reconnect';}
 function settings(prefix){return '<div class="dd-settings"><label for="'+prefix+'stake">Chips per duel<select id="'+prefix+'stake">'+rules.stakes.map(n=>'<option value="'+n+'">'+fmt(n)+' chips</option>').join('')+'</select></label><div class="dd-payout-preview"><span>Win return · includes wager</span><b></b></div></div>';}
 function controls(){const locked=busy||Boolean(pending);
  for(const prefix of ['dd-menu-','dd-play-']){const panel=$(prefix+'settings');panel.querySelector('select').value=String(stake);panel.querySelector('select').disabled=locked;panel.querySelector('b').textContent=fmt(stake*1.8)+' chips';}
  $('dd-enter').disabled=locked;$('dd-practice').disabled=locked;$('dd-free').disabled=locked;$('dd-free').checked=demo;
  $('dd-roll').disabled=locked||(!demo&&(!ready||connecting))||remaining()>0;
  $('dd-roll').textContent=busy?'Dice in motion…':pending?'Recover your roll':remaining()>0?'Preparing next roll…':demo?'Roll free dice':'Roll dice · '+fmt(stake)+' chips';
  $('dd-connect').hidden=ready;$('dd-play-connect').hidden=ready||demo;
  $('dd-mode').textContent=demo?'FREE PRACTICE · NO CHIPS SPENT':'THE DUEL ROOM';
  $('dd-play-note').textContent=demo?'Practice uses the same fair dice and payouts. No chips are spent or awarded.':'All four dice are fair and independent. Returns include your wager. Winnings are added automatically.';
  clearTimeout(cooldownTimer);if(!busy&&remaining()>0)cooldownTimer=setTimeout(controls,Math.min(remaining()+25,1000));
 }
 function configure(){controls();try{localStorage.setItem('dice-duel-stake',String(stake));}catch{}}
 function totals(s){$('dd-player-total').textContent=s?s.playerTotal:'—';$('dd-house-total').textContent=s?s.houseTotal:'—';$('dd-player-note').textContent=s?s.dice[0]+' + '+s.dice[1]:'Ready to roll';$('dd-house-note').textContent=s?s.dice[2]+' + '+s.dice[3]:'The house is ready';}
 function result(s,restored=false){const box=$('dd-result');box.dataset.outcome=s?.outcome||'';$('dd-machine').classList.remove('is-win','is-loss');for(const side of ['player','house'])$('dd-'+side+'-lane').classList.remove('is-winner');$('dd-sparks').replaceChildren();totals(s);
  if(!s){$('dd-result-label').textContent='THE TABLE IS YOURS';$('dd-result-value').textContent='Ready to roll.';$('dd-result-note').textContent='Choose your wager. Beat the house’s total.';$('dd-table-title').textContent='Your seat is waiting.';$('dd-table-status').textContent='FOUR FAIR DICE. ONE DUEL.';table.show([3,5,2,4],false);return;}
  table.show(s.dice);const label={win:'YOU WIN · 1.8× RETURN',tie:'A TIE · WAGER RETURNED',loss:'THE HOUSE WINS'}[s.outcome];
  $('dd-result-label').textContent=(demo?'PRACTICE · ':restored?'LAST DUEL · ':'')+label;
  $('dd-result-value').textContent=fmt(s.payout)+' chips';$('dd-result-note').textContent=(demo?'No chips spent or awarded. ':s.outcome==='win'?'Profit +'+fmt(s.payout-s.stake)+' chips. ':s.outcome==='tie'?'Your '+fmt(s.stake)+' chip wager is returned. ':'')+'You rolled '+s.playerTotal+'. The house rolled '+s.houseTotal+'.';
  $('dd-table-title').textContent={win:'The table is yours.',tie:'Honors even.',loss:'The house takes this one.'}[s.outcome];$('dd-table-status').textContent={win:'HIGH ROLL. WELL PLAYED.',tie:'EVEN ROLLS. YOUR WAGER RETURNS.',loss:'HOUSE HIGH. A NEW ROLL AWAITS.'}[s.outcome];
  if(s.outcome!=='tie')$('dd-'+(s.outcome==='win'?'player':'house')+'-lane').classList.add('is-winner');
 }
 function celebrate(outcome){audio.finish(outcome);$('dd-machine').classList.add('is-'+outcome);if(outcome!=='win'||matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  for(let i=0;i<28;i++){const p=document.createElement('i');p.className='dd-spark';p.style.setProperty('--i',i);p.style.setProperty('--x',(Math.cos(i*2.39996)*(70+i*7))+'px');p.style.setProperty('--y',(Math.sin(i*2.39996)*110+130)+'px');p.style.setProperty('--r',(i*87)+'deg');$('dd-sparks').append(p);}
 }
 function enter(free=false){demo=free;playing=true;$('dd-menu').hidden=true;$('dd-play').hidden=false;configure();result(demo?lastFree:last,true);audio.unlock();const run=epoch;requestAnimationFrame(()=>{if(current(run)&&playing)$('dd-machine').scrollIntoView({block:'start',behavior:'instant'});});}
 async function request(body){const token=await window.XanHub.authenticate();return window.XanHub.post('dice-duel-action',{token,...body});}
 function adopt(response,showBalance=true){last=response.round;if(showBalance&&Number.isFinite(response.balance)&&$('hub-balance'))$('hub-balance').textContent=fmt(response.balance)+' Chips';cooldownUntil=performance.now()+Math.max(0,(last?.availableAt||0)-response.serverNow);}
 async function launch(body){if(busy)return;const run=epoch,free=demo;busy=true;pending=free?null:body;notice();controls();audio.unlock();if(innerWidth<=700)$('dd-machine').scrollIntoView({block:'start',behavior:'instant'});result(null);table.prepare();$('dd-table-title').textContent='Let them roll.';$('dd-table-status').textContent=free?'GETTING THE DICE READY':'SECURING YOUR WAGER';$('dd-result-label').textContent='DUEL IN PROGRESS';$('dd-result-value').textContent='Watch the dice.';$('dd-result-note').textContent='Your return appears when all four dice settle.';
  try{
   let response,s;if(free){const dice=[];while(dice.length<4){const n=crypto.getRandomValues(new Uint8Array(1))[0];if(n<252)dice.push(n%6+1);}s={id:'practice-'+Date.now(),stake,...rules.outcome(stake,dice),status:'settled'};}else{response=await request(body);s=response.round;}if(!current(run))return;
   if(s?.status!=='settled')throw Error('Round is not settled yet.');
   pending=null;stake=s.stake;if(!free)adopt(response,false);controls();$('dd-machine').classList.add('is-rolling');$('dd-table-status').textContent='DICE IN MOTION';$('dd-player-note').textContent=$('dd-house-note').textContent='Rolling…';
   const done=await table.roll(s.dice,audio,side=>{if(!current(run))return;const you=side==='player';$('dd-'+side+'-total').textContent=you?s.playerTotal:s.houseTotal;$('dd-'+side+'-note').textContent=you?s.dice[0]+' + '+s.dice[1]:s.dice[2]+' + '+s.dice[3];$('dd-table-status').textContent=you?'YOUR TOTAL IS IN. HOUSE DICE SETTLING…':'THE DICE HAVE SPOKEN';});
   if(!done||!current(run))return;if(free)lastFree=s;else if(Number.isFinite(response.balance)&&$('hub-balance'))$('hub-balance').textContent=fmt(response.balance)+' Chips';result(s);celebrate(s.outcome);if(!free)window.XanHub.refresh().catch(()=>{});
  }catch(e){if(!current(run))return;table.stop();audio.silence();
   if([400,401,404,409,429].includes(e.status)){pending=null;if(e.status===401)ready=false;notice(e.message,e.status===429?reconnect:null);result(free?lastFree:last,true);}
   else{notice('Connection interrupted. Recover this roll before starting another. The same wager and dice are saved.',()=>launch(body));$('dd-result-label').textContent='AWAITING CONFIRMATION';$('dd-result-value').textContent='Your roll is saved.';$('dd-result-note').textContent='Recover the original roll without purchasing it again.';$('dd-table-status').textContent='RECONNECT TO RECOVER YOUR ROLL';}
  }finally{if(current(run)){busy=false;$('dd-machine').classList.remove('is-rolling');controls();}}
 }
 function roll(){if(busy||pending||remaining()>0||(!demo&&(!ready||connecting)))return;launch({action:'roll',stake,quote:rules.build,requestId:crypto.randomUUID()});}
 async function reconnect(){if(busy||pending)return;if(!read('tornVisitorApiKey')){ready=false;controls();return;}const run=epoch;connecting=true;controls();
  try{const response=await request({action:'current'});if(!current(run))return;ready=true;adopt(response);notice();if(playing&&!demo)result(last,true);}
  catch(e){if(current(run)){ready=false;notice(e.message,reconnect);}}finally{if(current(run)){connecting=false;controls();}}
 }
 function profile(){const p=window.XanHub?.profile;if(!p)return;$('dd-player-name').textContent=p.name||'You';const avatar=$('dd-player-avatar'),src=p.avatar||p.image||p.profileImage||p.profile_image;avatar.textContent=(p.name||'Y').slice(0,1);if(src){const img=document.createElement('img');img.alt='';img.src=src;img.onerror=()=>{avatar.textContent=(p.name||'Y').slice(0,1);};avatar.replaceChildren(img);}}
 document.addEventListener('DOMContentLoaded',()=>{
  const saved=Number(read('dice-duel-stake'));if(rules.stakes.includes(saved))stake=saved;
  for(const prefix of ['dd-menu-','dd-play-']){const panel=$(prefix+'settings');panel.innerHTML=settings(prefix);panel.querySelector('select').onchange=e=>{stake=Number(e.target.value);configure();};}
  table=new DiceDuelTable($('dd-player-dice'),$('dd-house-dice'));for(let i=0;i<3;i++){const die=DiceDuelDie(i===1);die.querySelector('.dd-die-cube').style.transform=['rotateX(-25deg) rotateY(-30deg)','rotateX(-30deg) rotateY(35deg)','rotateX(32deg) rotateY(-25deg)'][i];$('dd-hero-dice').append(die);}
  $('dd-free').onchange=e=>{demo=e.target.checked;configure();result(demo?lastFree:last,true);};$('dd-enter').onclick=()=>enter(false);$('dd-practice').onclick=()=>{enter(true);roll();};$('dd-roll').onclick=roll;$('dd-retry').onclick=()=>retry?.();
  $('dd-help').onclick=()=>{const d=document.createElement('dialog');d.className='xan-dialog dd-help';d.innerHTML='<h2>How to play Dice Duel</h2><ol><li>Choose your wager, then enter the table. Entering is free.</li><li>Press Roll dice to spend the displayed wager. You and the house each roll two fair, six-sided dice.</li><li>Add your two dice together. A higher total than the house wins a total return of 1.8× your wager, including the original wager.</li><li>A tie returns your full wager. If the house rolls higher, you lose the wager. Doubles have no special bonus.</li><li>Your return is added automatically. Change your wager and roll again from the table. Closing the page cannot change an already purchased result.</li><li>If the connection drops, use Recover roll or reload to restore the same result. Free practice uses the same rules without spending or awarding chips.</li></ol><p class="dd-fine">All 1,296 combinations are equally likely. Win: 44.37%. Tie: 11.27%. Loss: 44.37%. Timing and animation do not affect the dice.</p><button class="dd-secondary">Got it</button>';document.body.append(d);d.querySelector('button').onclick=()=>d.close();d.onclose=()=>d.remove();d.showModal();};
  configure();profile();reconnect();
 });
 window.addEventListener('xan-hub-sync',profile);
 document.addEventListener('visibilitychange',()=>{if(document.hidden){audio.silence();return;}if(pageActive&&!busy&&!pending&&!demo)reconnect();});
 window.addEventListener('pagehide',()=>{pageActive=false;epoch++;table?.stop();audio.silence();clearTimeout(cooldownTimer);});
 window.addEventListener('pageshow',e=>{if(e.persisted){pageActive=true;busy=false;pending=null;playing=false;demo=false;ready=false;connecting=false;last=null;$('dd-menu').hidden=false;$('dd-play').hidden=true;$('dd-machine').classList.remove('is-rolling');notice();configure();reconnect();}});
})();
