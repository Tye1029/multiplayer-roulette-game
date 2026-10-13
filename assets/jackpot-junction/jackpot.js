/* JACKPOT_JUNCTION_V5 */
(() => {
 'use strict';
 const rules=window.JackpotJunction,$=id=>document.getElementById(id),fmt=n=>n.toLocaleString('en-US'),symbols=[...rules.prizes.map(p=>p.symbol),'jackpot'],reduced=matchMedia('(prefers-reduced-motion:reduce)');
 let playing=false,demo=false,ready=false,busy=false,intent=null,last=null,meterVersion=-1,meterAmount=null,meterBusy=false,retry=null,pollTimer,frame,lastPull=null,generation=0,pageActive=true;
 const reelAnimations=[],settlingAnimations=new Set(),sound=window.JackpotAudio;
 window.XanSiteAdapter={current:()=>({mode:'junction',id:playing?last?.id||'':'',phase:busy?'spinning':playing?'playing':'lobby'}),diagnostics:()=>({build:"JACKPOT_JUNCTION_V5",busy,demo,ready,meterVersion,spinningAudio:sound.spinning})};
 const current=run=>pageActive&&run===generation;
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 function notice(message='',again=null){$('jj-notice').textContent=message;retry=again;$('jj-retry').hidden=!again;}
 function price(){return Number($('jj-stake').value);}
 function controls(){
  $('jj-spin').disabled=busy||Boolean(intent)||(!demo&&!ready);$('jj-lever').disabled=!playing||$('jj-spin').disabled;$('jj-cabinet-spin').disabled=$('jj-lever').disabled;$('jj-bet-display').textContent=fmt(price());
  $('jj-spin').textContent=busy?'Reels rolling…':demo?'Free sample spin':'Spin · '+fmt(price())+' chips';
  for(const id of ['jj-stake','jj-menu-stake','jj-demo','jj-enter'])$(id).disabled=busy||Boolean(intent);
  $('jj-connect').hidden=ready||demo;$('jj-mode').textContent=demo?'FREE SAMPLE · NO CHIPS SPENT':'AT THE MACHINE';
 }
 function setMeter(m){if(!m||m.version<meterVersion)return;meterVersion=m.version;$('jj-jackpot').removeAttribute('title');
  const from=meterAmount??m.amount;meterAmount=m.amount;cancelAnimationFrame(frame);$('jj-jackpot').style.setProperty('--digits',fmt(m.amount).length);
  const start=performance.now(),paint=now=>{const t=reduced.matches?1:Math.min(1,(now-start)/500);$('jj-jackpot').textContent=fmt(Math.round(from+(m.amount-from)*(1-(1-t)**3)));if(t<1)frame=requestAnimationFrame(paint);};paint(start);
 }
 async function request(action,extra={}){const run=generation;const token=await window.XanHub.authenticate();const r=await window.XanHub.post('jackpot-junction-action',{action,token,...extra});if(!current(run))return r;if(Number.isFinite(r.balance)&&$('hub-balance'))$('hub-balance').textContent=fmt(r.balance)+' Chips';setMeter(r.jackpot);return r;}
 async function refreshMeter(){if(!pageActive||meterBusy||document.hidden||busy)return;const run=generation;meterBusy=true;try{const r=await window.XanHub.post('jackpot-junction-action',{action:'meter'});if(current(run))setMeter(r.jackpot);}catch{if(current(run))$('jj-jackpot').title='Jackpot temporarily unavailable; reconnecting automatically.';}finally{if(current(run))meterBusy=false;}}
 function symbolNode(symbol){const el=document.createElement('div');el.className='jj-symbol';el.dataset.symbol=symbol;const img=document.createElement('img');img.src='/assets/jackpot-junction/'+symbol+'.svg?v=JACKPOT_JUNCTION_V5';img.alt=symbol==='jackpot'?'Gold JJ jackpot symbol':rules.prizes.find(p=>p.symbol===symbol)?.name||symbol;img.draggable=false;el.append(img);return el;}
 function showReels(values){document.querySelectorAll('.jj-strip').forEach((strip,i)=>{strip.replaceChildren(symbolNode(values[i]));strip.style.transform='';});$('jj-reels').setAttribute('aria-label','Reels: '+values.join(', '));}
 function cancelReels(){reelAnimations.forEach(a=>a.cancel());reelAnimations.length=0;settlingAnimations.forEach(a=>a.cancel());settlingAnimations.clear();}
 function startReels(){
  cancelReels();$('jj-machine').classList.remove('is-win','is-jackpot');$('jj-machine').classList.add('is-spinning');document.querySelectorAll('.jj-reel').forEach(el=>el.classList.remove('is-settled'));$('jj-machine-caption').textContent='REELS IN MOTION';$('jj-result-title').textContent='Around they go.';$('jj-result').textContent=demo?'Free sample — your balance stays the same.':'Your spin is being saved. Let the reels roll.';
  // One complete seven-symbol cycle, followed by its first three symbols.
  // JJ is visible during travel; only the server decides the paid final trio.
  document.querySelectorAll('.jj-strip').forEach((strip,i)=>{const list=Array.from({length:symbols.length+3},(_,n)=>symbols[(n+i)%symbols.length]);strip.replaceChildren(...list.map(symbolNode));if(!reduced.matches)reelAnimations[i]=strip.animate([{transform:'translateY(0)'},{transform:'translateY(-'+(symbols.length/list.length*100)+'%)'}],{duration:840+i*75,iterations:Infinity,easing:'linear'});});sound.start();
 }
 async function stopReels(values,run){
  const strips=[...document.querySelectorAll('.jj-strip')];
  await Promise.all(strips.map(async(strip,i)=>{
   if(!reduced.matches)await wait(i*230);if(!current(run))return;
   sound.brake(i);
   // Preserve the drum's visible position when the brake takes over.
   const height=strip.firstElementChild.getBoundingClientRect().height,transform=getComputedStyle(strip).transform;
   const travel=transform==='none'?0:-new DOMMatrixReadOnly(transform).m42/height,index=Math.floor(travel),fraction=travel-index;
   const lead=[strip.children[index]?.dataset.symbol||symbols[i],strip.children[index+1]?.dataset.symbol||symbols[i+1]];
   reelAnimations[i]?.cancel();strip.replaceChildren(...[...lead,symbols[(i+4)%symbols.length],values[i]].map(symbolNode));
   if(!reduced.matches){const a=strip.animate([{transform:'translateY(-'+fraction*height+'px)'},{transform:'translateY(-75%)'}],{duration:580,easing:'cubic-bezier(.18,.72,.26,1)',fill:'forwards'});settlingAnimations.add(a);await a.finished.catch(()=>{});a.cancel();settlingAnimations.delete(a);if(!current(run))return;}
   strip.replaceChildren(symbolNode(values[i]));strip.parentElement.classList.add('is-settled');sound.reel(i);
  }));if(!current(run))return;reelAnimations.length=0;showReels(values);$('jj-machine').classList.remove('is-spinning');
 }
 function result(s,restored=false){if(!demo)last=s;showReels(s.reels);const jackpot=s.kind==='jackpot',won=s.payout>0;
  $('jj-machine').classList.toggle('is-win',won);$('jj-machine').classList.toggle('is-jackpot',jackpot&&!demo);$('jj-machine-caption').textContent=jackpot?'JACKPOT!':won?'A LITTLE GOLD FOUND YOU':'THE NEXT SPIN IS YOURS';
  $('jj-result-title').textContent=jackpot?'You hit the jackpot!':won?'A winning stop.':'Another stop, another chance.';
  $('jj-result').textContent=demo?'Sample prize: '+fmt(s.payout)+' chips. No chips are charged or awarded.':(restored?'Last spin: ':'')+(won?fmt(s.payout)+' chips credited to your balance.':'No winning trio this time.')+' Spin cost: '+fmt(s.stake)+' chips.';
  $('jj-win-display').textContent=won?(s.payout>=1000000?new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2}).format(s.payout):fmt(s.payout)):'—';$('jj-win-display').title=won?fmt(s.payout)+' chips':'';
  if(won&&!restored)sound.win(jackpot);
 }
 function enter(free=false){if(busy||intent)return;sound.prepare();demo=free;playing=true;$('jj-menu').hidden=true;$('jj-controls').hidden=false;$('jj-stage').dataset.playing='true';$('jj-stake').value=$('jj-menu-stake').value;notice();
  $('jj-machine').classList.remove('is-win','is-jackpot');$('jj-result-title').textContent='Make it a lucky one.';$('jj-result').textContent=free?'Try the handle. This sample never spends or awards chips.':'Pull the handle down, or press Spin.';$('jj-machine-caption').textContent=free?'FREE SAMPLE':'PULL A LITTLE LUCK';$('jj-win-display').textContent='—';showReels(['seven','jackpot','seven']);if(last&&!free)result(last,true);controls();requestAnimationFrame(()=>document.querySelector('.jj-machine-wrap').scrollIntoView({block:'start',behavior:'instant'}));
 }
 function menu(){if(busy||intent)return;playing=false;demo=false;$('jj-win-display').textContent='—';$('jj-menu').hidden=false;$('jj-controls').hidden=true;$('jj-stage').dataset.playing='false';$('jj-machine-caption').textContent='YOUR LUCK IS WAITING';$('jj-machine').classList.remove('is-win','is-jackpot');showReels(['seven','jackpot','seven']);controls();}
 async function spin(){if(!playing||busy||intent||(!ready&&!demo))return;busy=true;const run=generation,started=performance.now();controls();try{startReels();
   let s;if(demo){const p=rules.prizes[Math.floor(Math.random()*rules.prizes.length)];s={id:'sample',stake:price(),kind:'small',reels:Array(3).fill(p.symbol),payout:price()*p.multiplier};}else{intent={stake:price(),requestId:crypto.randomUUID()};s=(await request('spin',intent)).spin;}
   if(!current(run))return;const receivedAt=performance.now();if(!reduced.matches)await wait(Math.max(0,rules.spinMs-1100-(performance.now()-started)));if(!current(run))return;await stopReels(s.reels,run);if(!current(run))return;intent=null;result(s);notice();if(!demo)window.XanHub.refresh().catch(()=>{});await wait(Math.max(0,rules.spinMs-(performance.now()-receivedAt)));
  }catch(e){if(!current(run))return;cancelReels();showReels(['seven','jackpot','seven']);$('jj-machine-caption').textContent='SPIN PAUSED';if([400,401,409,429].includes(e.status)){intent=null;$('jj-result-title').textContent='Spin not started.';$('jj-result').textContent=e.message;notice(e.message);}else{$('jj-result-title').textContent='Let’s reconnect.';$('jj-result').textContent='Use Recover Spin to retrieve the saved result safely.';notice(e.message,recover);}}finally{if(current(run)){sound.stop();$('jj-machine').classList.remove('is-spinning');busy=false;controls();}}
 }
 async function recover(){if(busy||!intent)return;const run=generation;busy=true;controls();try{const s=(await request('spin',intent)).spin;if(!current(run))return;intent=null;demo=false;result(s);notice();window.XanHub.refresh().catch(()=>{});}catch(e){if(!current(run))return;if([400,401,409,429].includes(e.status)){intent=null;notice(e.message);}else notice(e.message,recover);}finally{if(current(run)){busy=false;controls();}}}
 async function authenticate(){if(!localStorage.getItem('tornVisitorApiKey'))return;const run=generation;try{const r=await request('current');if(!current(run))return;last=r.spin;ready=true;if(playing&&!demo&&!busy&&last)result(last,true);}catch(e){if(!current(run))return;notice(e.message,authenticate);}controls();}
 function lever(){
  const button=$('jj-lever'),arm=$('jj-arm'),shadow=$('jj-arm-shadow'),knob=$('jj-lever-ball'),holder=$('jj-holder-body'),inset=$('jj-holder-inset'),lip=$('jj-holder-lip');
  let position=0,returnFrame=0;
  function paint(p){
   position=p;
   // Project one rigid arm around its fixed axle. Both ends are drawn in the
   // same SVG space. A frontal view projects forward travel mostly downward,
   // with a larger grip and a foreshortened shaft as it approaches the player.
   const angle=-.15+p*2,x=43+Math.sin(angle)*9,y=150-Math.cos(angle)*114+Math.sin(angle)*40;
   // A hinged socket sleeves the lower quarter of the bar. Its mouth and
   // side walls share the shaft projection, so it folds with the arm.
   const hx=43+(x-43)*.29,hy=150+(y-150)*.29,depth=5+Math.sin(angle)*3;
   holder.setAttribute('d','M30 150L'+(hx-11)+' '+hy+'Q'+hx+' '+(hy-depth)+' '+(hx+11)+' '+hy+'L56 150Q55 162 43 163Q31 162 30 150Z');
   inset.setAttribute('d','M35 149L'+(hx-7)+' '+hy+'L'+(hx+7)+' '+hy+'L51 149Z');
   lip.setAttribute('d','M'+(hx-10)+' '+hy+'Q'+hx+' '+(hy+depth)+' '+(hx+10)+' '+hy);
   arm.setAttribute('d','M43 150L'+x.toFixed(3)+' '+y.toFixed(3));
   shadow.setAttribute('d','M47 154L'+(x+4).toFixed(3)+' '+(y+4).toFixed(3));
   knob.setAttribute('transform','translate('+x.toFixed(3)+' '+y.toFixed(3)+') scale('+(1+Math.sin(angle)*.28).toFixed(3)+')');
   button.style.setProperty('--pull',p);
  }
  function reset(){
   cancelAnimationFrame(returnFrame);button.classList.remove('is-pulling');
   if(reduced.matches){paint(0);return;}
   const from=position,started=performance.now();
   const step=now=>{const t=Math.min(1,(now-started)/320);paint(from*(1-t)**3);if(t<1)returnFrame=requestAnimationFrame(step);};
   returnFrame=requestAnimationFrame(step);
  }
  button.onpointerdown=e=>{if(button.disabled||e.button!==0||lastPull)return;e.preventDefault();cancelAnimationFrame(returnFrame);button.classList.add('is-pulling');lastPull={id:e.pointerId,y:e.clientY,distance:0,from:position};button.setPointerCapture(e.pointerId);};
  button.onpointermove=e=>{if(!lastPull||e.pointerId!==lastPull.id)return;e.preventDefault();lastPull.distance=Math.max(0,Math.min(85,e.clientY-lastPull.y));paint(Math.min(1,lastPull.from+lastPull.distance/85));};
  const release=(e,cancel=false)=>{if(!lastPull||lastPull.id!==e.pointerId)return;const fire=!cancel&&lastPull.distance>=35;lastPull=null;reset();if(button.hasPointerCapture(e.pointerId))button.releasePointerCapture(e.pointerId);if(fire)spin();};
  button.onpointerup=e=>release(e);button.onpointercancel=e=>release(e,true);
  button.onlostpointercapture=()=>{if(lastPull){lastPull=null;reset();}};
  button.onclick=e=>{if(e.detail===0)spin();};
  document.addEventListener('visibilitychange',()=>{if(document.hidden){lastPull=null;cancelAnimationFrame(returnFrame);button.classList.remove('is-pulling');paint(0);}});
  paint(0);
 }
 document.addEventListener('DOMContentLoaded',()=>{
  const options=rules.stakes.map(stake=>'<option value="'+stake+'">'+fmt(stake)+' chips</option>').join('');$('jj-menu-stake').innerHTML=$('jj-stake').innerHTML=options;
  for(const id of ['jj-menu-stake','jj-stake'])$(id).onchange=()=>{$('jj-menu-stake').value=$('jj-stake').value=$(id).value;controls();};
  $('jj-enter').onclick=()=>enter(false);$('jj-demo').onclick=()=>enter(true);$('jj-spin').onclick=$('jj-cabinet-spin').onclick=spin;$('jj-retry').onclick=()=>retry?.();lever();
  $('jj-prizes').innerHTML='<div class="jj-prize"><span><img src="/assets/jackpot-junction/jackpot.svg?v=JACKPOT_JUNCTION_V5" alt="Gold JJ symbol">Three gold JJ symbols</span><strong>JACKPOT</strong></div>'+[...rules.prizes].reverse().map(p=>'<div class="jj-prize"><span>Three '+p.name.toLowerCase()+'</span><strong>'+p.multiplier+'×</strong></div>').join('');
  $('jj-help').onclick=()=>{const d=document.createElement('dialog');d.className='xan-dialog';d.innerHTML='<h2>How to play</h2><ol><li>Choose a spin price and press Play Slots. Opening the machine does not spend chips.</li><li>Pull the handle downward with your mouse or finger, or press Spin. Each spin costs the amount shown.</li><li>Match three symbols on the center line to win the shown multiplier. Prizes are total returns, including any returned stake.</li><li>Three gold JJ symbols (the Junction seal) win the entire shared jackpot displayed on the machine. Higher stakes increase your jackpot chance proportionally.</li><li>The jackpot grows with paid spins and resets after a jackpot win. Free samples do not change your balance or the jackpot.</li></ol><p>Spins and prizes are saved automatically. If the connection drops, use Recover Spin; reopening the page also recovers a pending payment.</p><button class="jj-primary">Got it</button>';document.body.append(d);d.querySelector('button').onclick=()=>d.close();d.onclose=()=>d.remove();d.showModal();};
  showReels(['seven','jackpot','seven']);controls();refreshMeter();authenticate();pollTimer=setInterval(refreshMeter,15000);
 });
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshMeter();});window.addEventListener('pagehide',()=>{pageActive=false;generation++;clearInterval(pollTimer);cancelReels();sound.silence();});window.addEventListener('pageshow',e=>{if(e.persisted){pageActive=true;busy=false;meterBusy=false;intent=null;ready=false;last=null;notice();$('jj-machine').classList.remove('is-spinning');menu();refreshMeter();authenticate();clearInterval(pollTimer);pollTimer=setInterval(refreshMeter,15000);}});
})();
