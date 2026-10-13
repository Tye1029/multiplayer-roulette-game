/* MINEFIELD_V2 */
(() => {
 'use strict';
 const rules=window.MinefieldRules,sound=window.MinefieldAudio,$=id=>document.getElementById(id),fmt=n=>Number(n||0).toLocaleString('en-US'),mult=n=>n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})+'×';
 const active=s=>s?.status==='active',finished=s=>s?.status==='settled',wait=ms=>new Promise(r=>setTimeout(r,ms));
 let game=null,saved=null,busy=false,ready=false,connecting=false,playing=false,demo=false,demoMines=[],pending=null,retry=null,epoch=0,pageActive=true;
 let selectedReturnPercent=rules.returnPercent;
 const current=run=>pageActive&&run===epoch,tiles=[];
 window.XanSiteAdapter={current:()=>({mode:'minefield',id:playing&&!demo?game?.id||'':'',phase:playing?(active(game)?'playing':'complete'):'lobby'}),diagnostics:()=>({build:'MINEFIELD_V2',ready,busy,demo,phase:game?.status||'menu',revision:game?.revision||0,revealed:game?.revealed?.length||0,audioVoices:sound.active})};
 function selection(){return {stake:Number($('mf-menu-stake').value),mineCount:Number($('mf-menu-mines').value),returnPercent:selectedReturnPercent};}
 function notice(message='',again=null){$('mf-notice').textContent=message;retry=again;$('mf-retry').hidden=!again;}
 function controls(){
  const resume=active(saved),locked=busy||Boolean(pending)||connecting,choiceLocked=locked||(!demo&&active(game))||(!playing&&resume);
  for(const id of ['mf-menu-stake','mf-menu-mines','mf-next-stake','mf-next-mines'])$(id).disabled=choiceLocked;
  $('mf-start').disabled=locked||!ready;$('mf-practice').disabled=locked||connecting;
  $('mf-start').textContent=connecting?'Connecting…':resume?'Resume your field':'Start field · '+fmt(selection().stake)+' chips';
  $('mf-again').disabled=locked||(!demo&&!ready);$('mf-again').textContent=demo?'Try another free field':'Start new field · '+fmt(selection().stake)+' chips';
  $('mf-cashout').disabled=locked||!active(game)||game.safeCount===0;
  $('mf-cashout').textContent=locked?'Confirming…':game?.safeCount?'Cash out · '+fmt(game.cashout)+' chips':'Find a safe tile first';
  for(const [i,tile] of tiles.entries()){tile.disabled=locked||!active(game)||game.revealed.includes(i);tile.classList.toggle('is-pending',pending?.action==='reveal'&&pending.tile===i);}
  $('mf-connect').hidden=ready||connecting;
  $('mf-menu-note').textContent=resume?'Your '+fmt(saved.stake)+'-chip field is saved. Resume without another charge.':'Choose your risk. Every safe find raises the stakes.';
  const s=selection();rewardPreview($('mf-menu-rewards'),s);rewardPreview($('mf-new-rewards'),s);
 }
 function rewardPreview(panel,{stake,mineCount,returnPercent}){
  const key=stake+':'+mineCount+':'+returnPercent;if(panel.dataset.selection===key)return;panel.dataset.selection=key;
  const safe=rules.size-mineCount,first=rules.multiplier(mineCount,1,returnPercent),amount=k=>fmt(rules.payout(stake,mineCount,k,returnPercent)),value=k=>mult(rules.multiplier(mineCount,k,returnPercent));
  panel.innerHTML='<div class="mf-reward-heading"><span><b>'+mineCount+' '+(mineCount===1?'mine':'mines')+'</b> · '+safe+' safe tiles</span><span>FIRST FIND <strong>'+mult(first)+'</strong></span></div>'
   +'<ol class="mf-reward-picks">'+Array.from({length:Math.min(3,safe)},(_,i)=>{const k=i+1;return '<li><span>'+k+' '+(k===1?'diamond':'diamonds')+'</span><strong>'+value(k)+'</strong><small>'+amount(k)+' chips</small></li>';}).join('')+'</ol>'
   +'<p class="mf-reward-note">First pick: '+(safe/rules.size*100).toFixed(0)+'% safe · '+(mineCount/rules.size*100).toFixed(0)+'% mine. Returns include your wager.</p>'
   +(safe>3?'<details class="mf-ladder"><summary>All '+safe+' multipliers</summary><div class="mf-ladder-scroll" tabindex="0" role="region" aria-label="Full multiplier ladder"><table><caption>Total return after consecutive safe finds</caption><thead><tr><th scope="col">Finds</th><th scope="col">Multiplier</th><th scope="col">Chips</th></tr></thead><tbody>'+Array.from({length:safe},(_,i)=>{const k=i+1;return '<tr><th scope="row">'+k+'</th><td>'+value(k)+'</td><td>'+amount(k)+'</td></tr>';}).join('')+'</tbody></table></div></details>':'');
 }
 function setSelection(stake,mines,percent=rules.returnPercent){
  selectedReturnPercent=percent;const counts=rules.validMines(mines)?rules.mineCounts:[...rules.mineCounts,mines].sort((a,b)=>a-b);
  for(const prefix of ['mf-menu-','mf-next-']){
   $(prefix+'stake').value=String(stake);$(prefix+'mines').innerHTML=counts.map(n=>'<option value="'+n+'">'+n+' mines · '+mult(rules.multiplier(n,1,percent))+(!rules.validMines(n)?' · saved field':'')+'</option>').join('');$(prefix+'mines').value=String(mines);
  }
 }
 async function request(body,run){const token=await window.XanHub.authenticate(),r=await window.XanHub.post('minefield-action',{token,...body});if(current(run)&&Number.isFinite(r.balance)&&$('hub-balance'))$('hub-balance').textContent=fmt(r.balance)+' Chips';return r.game;}
 function spark(tile){if(matchMedia('(prefers-reduced-motion:reduce)').matches)return;for(let i=0;i<7;i++){const p=document.createElement('i');p.className='mf-spark';p.style.setProperty('--x',Math.cos(i*Math.PI*2/7)*42+'px');p.style.setProperty('--y',Math.sin(i*Math.PI*2/7)*42+'px');p.onanimationend=()=>p.remove();tile.append(p);}}
 function paint(animateTile=null,celebrate=false){
  if(!game)return;const done=finished(game),won=done&&game.outcome!=='mine';
  if(done&&(selectedReturnPercent!==rules.returnPercent||!rules.validMines(selection().mineCount)))setSelection(game.stake,rules.validMines(game.mineCount)?game.mineCount:3);
  $('mf-table').classList.toggle('is-win',won);$('mf-table').classList.toggle('is-loss',done&&game.outcome==='mine');$('mf-table').classList.toggle('is-complete',done);
  if(!celebrate)$('mf-table').style.animation='none';else $('mf-table').style.animation='';
  for(const [i,tile] of tiles.entries()){
   const mine=done&&game.mines.includes(i),revealed=game.revealed.includes(i),state=mine?(game.hit===i?'hit':'mine'):revealed?'safe':'';
   if((tile.dataset.state||'')!==state){tile.replaceChildren();tile.classList.remove('is-new');if(state){tile.dataset.state=state;const img=document.createElement('img');img.src='/assets/minefield/'+(mine?'mine':'gem')+'.svg?v=MINEFIELD_V2';img.alt='';tile.append(img);if(i===animateTile){tile.classList.add('is-new');if(!mine)spark(tile);}}else delete tile.dataset.state;}
   tile.setAttribute('aria-label','Tile '+String.fromCharCode(65+i%5)+(Math.floor(i/5)+1)+' · '+(state==='safe'?'diamond':mine?'mine':'covered'));
  }
  if(done&&won&&celebrate)game.revealed.forEach(i=>spark(tiles[i]));
  $('mf-found').textContent=game.safeCount;$('mf-hazards').textContent=game.mineCount;$('mf-remaining').textContent=rules.size-game.mineCount-game.safeCount;
  $('mf-mode').textContent=demo?'FREE FIELD · NO CHIPS SPENT':'THE UNDERGROUND VAULT';
  $('mf-board-title').textContent=done?(won?'Prize secured.':'Mine hit.'):'Make your move.';
  $('mf-status-label').textContent=done?(won?'A CLEAN GETAWAY':'THE RISK WAS REAL'):'YOUR NEXT MOVE';
  $('mf-title').textContent=done?(won?(game.outcome==='clear'?'Every diamond. All yours.':'You got out with the goods.'):'A little too far.'):(game.safeCount?'One more, or walk away?':'Trust your instincts.');
  $('mf-instruction').textContent=done?(demo?'Practice round complete. No chips were spent or awarded.':won?fmt(game.payout)+' chips credited to your balance.':'You hit a mine. This field’s '+fmt(game.stake)+'-chip wager is lost.'):'Pick a covered tile to find an diamond. A mine ends the round.';
  $('mf-bank-label').textContent=done?(won?'TOTAL RETURN':'ROUND RETURN'):'CASH OUT VALUE';$('mf-bank').textContent=fmt(done?game.payout:game.cashout);$('mf-multiplier').textContent=done&&!won?'—':mult(game.multiplier);
  $('mf-profit').textContent=done?(won?'Profit +'+fmt(game.payout-game.stake)+' chips':'Wager '+fmt(game.stake)+' chips'):game.safeCount?'Profit +'+fmt(game.cashout-game.stake)+' chips':'Find your first diamond';
  $('mf-cashout').hidden=done;$('mf-next').hidden=done;$('mf-new').hidden=!done;
  $('mf-next-value').textContent=fmt(game.nextPayout)+' chips';$('mf-next-multiplier').textContent=mult(rules.multiplier(game.mineCount,Math.min(rules.size-game.mineCount,game.safeCount+1),game.returnPercent??96));
  $('mf-board-note').textContent=done?(won?'PRIZE SECURED':'MINE HIT · FIELD CLOSED'):'Next diamond · '+fmt(game.nextPayout)+' chips';
  $('mf-trail').replaceChildren(...Array.from({length:rules.size-game.mineCount},(_,i)=>{const p=document.createElement('i');p.className='mf-step'+(i<game.safeCount?' found':'');p.setAttribute('aria-hidden','true');return p;}));
  $('mf-round-note').textContent=demo?'Free practice. No chips are spent or awarded.':active(game)?'Wager '+fmt(game.stake)+' chips · Your field is saved.':'Choose your next wager and mine count above.';
  controls();
 }
 function enter(){playing=true;$('mf-menu').hidden=true;$('mf-play').hidden=false;paint();requestAnimationFrame(()=>$('mf-play').scrollIntoView({block:'start',behavior:'instant'}));}
 function menu(){playing=false;demo=false;game=null;$('mf-menu').hidden=false;$('mf-play').hidden=true;controls();}
 function practice(){if(busy||pending)return;demo=true;if(!rules.validMines(selection().mineCount)||selectedReturnPercent!==rules.returnPercent)setSelection(selection().stake,3);const s=selection(),pool=Array.from({length:rules.size},(_,i)=>i);
  for(let i=0;i<s.mineCount;i++){let n;const bound=0x100000000-(0x100000000%(rules.size-i));do{n=crypto.getRandomValues(new Uint32Array(1))[0];}while(n>=bound);const j=i+n%(rules.size-i);[pool[i],pool[j]]=[pool[j],pool[i]];}
  demoMines=pool.slice(0,s.mineCount);game={...s,id:'practice',status:'active',revision:0,revealed:[],safeCount:0,cashout:0,nextPayout:rules.payout(s.stake,s.mineCount,1,s.returnPercent),multiplier:1};notice();enter();sound.start();
 }
 function demoAction(body){
  if(body.action==='reveal'){game.revealed.push(body.tile);if(demoMines.includes(body.tile)){game.status='settled';game.hit=body.tile;game.outcome='mine';game.payout=0;}else game.safeCount++;}
  if(body.action==='cashout'||game.safeCount===rules.size-game.mineCount){game.status='settled';game.outcome=body.action==='cashout'?'cashout':'clear';game.payout=rules.payout(game.stake,game.mineCount,game.safeCount,game.returnPercent);}
  game.revision++;game.cashout=active(game)?rules.payout(game.stake,game.mineCount,game.safeCount,game.returnPercent):0;game.nextPayout=active(game)?rules.payout(game.stake,game.mineCount,game.safeCount+1,game.returnPercent):0;game.multiplier=rules.multiplier(game.mineCount,game.safeCount,game.returnPercent);if(finished(game))game.mines=demoMines;return game;
 }
 async function send(body,opening=false){
  if(busy)return;const run=epoch,wasDemo=demo;busy=true;pending=body;notice();controls();if(body.action==='reveal')sound.cover();const started=performance.now();
  try{
   const next=wasDemo?demoAction(body):await request(body,run);if(!current(run))return;
   await wait(Math.max(0,180-(performance.now()-started)));if(!current(run))return;
   game=next;if(!wasDemo)saved=next;pending=null;
   if(opening){setSelection(game.stake,game.mineCount,game.returnPercent??96);enter();sound.start();}
   paint(body.action==='reveal'?body.tile:null,true);
   if(finished(game)){if(game.outcome==='mine')sound.mine();else sound.cash();}else if(body.action==='reveal')sound.safe(game.safeCount);
   if(!wasDemo)window.XanHub.refresh().catch(()=>{});
  }catch(e){if(!current(run))return;
   if([400,401,404,409].includes(e.status)){pending=null;notice(e.message);if(e.status===401)ready=false;
    if(!wasDemo&&e.status===409){try{const latest=await request({action:'current'},run);if(!current(run))return;saved=latest;if(playing&&latest){game=latest;paint();}}catch{notice('Reconnect to check the latest field.',reconnect);}}
   }else notice('Connection interrupted. Reconnect to recover this move safely.',()=>send(body,opening));
  }finally{if(current(run)){busy=false;controls();}}
 }
 async function start(){if(busy||pending||!ready)return;demo=false;if(active(saved)){game=saved;setSelection(game.stake,game.mineCount,game.returnPercent??96);notice();enter();return;}await send({action:'start',...selection(),requestId:crypto.randomUUID()},true);}
 function act(action,tile){if(busy||pending||!active(game)||!playing||(action==='reveal'&&game.revealed.includes(tile))||(action==='cashout'&&!game.safeCount))return;send({action,gameId:game.id,revision:game.revision,requestId:crypto.randomUUID(),...(action==='reveal'?{tile}:{})});}
 async function reconnect(){
  if(busy)return;if(pending){retry?.();return;}
  if(!localStorage.getItem('tornVisitorApiKey')){ready=false;connecting=false;controls();return;}
  const run=epoch;connecting=true;controls();
  try{const latest=await request({action:'current'},run);if(!current(run))return;saved=latest;ready=true;notice();if(!playing&&active(saved))setSelection(saved.stake,saved.mineCount,saved.returnPercent??96);if(playing&&!demo&&latest){game=latest;paint();}}
  catch(e){if(current(run)){ready=false;notice(e.message,reconnect);}}
  finally{if(current(run)){connecting=false;controls();}}
 }
 document.addEventListener('DOMContentLoaded',()=>{
  for(const prefix of ['mf-menu-','mf-next-']){
   $(prefix+'stake').innerHTML=rules.stakes.map(n=>'<option value="'+n+'">'+fmt(n)+' chips</option>').join('');
   for(const kind of ['stake','mines'])$(prefix+kind).onchange=()=>{setSelection(Number($(prefix+'stake').value),Number($(prefix+'mines').value));controls();};
  }
  setSelection(50000,3);
  for(let i=0;i<rules.size;i++){const tile=document.createElement('button');tile.type='button';tile.className='mf-tile';tile.setAttribute('aria-label','Tile '+String.fromCharCode(65+i%5)+(Math.floor(i/5)+1)+' · covered');tile.onclick=()=>act('reveal',i);tile.onanimationend=e=>{if(e.target===tile.firstElementChild)tile.classList.remove('is-new');};tiles.push(tile);$('mf-grid').append(tile);}
  $('mf-grid').onkeydown=e=>{const at=tiles.indexOf(document.activeElement);if(at<0)return;let target;if(e.key==='ArrowLeft')target=at-1;if(e.key==='ArrowRight')target=at+1;if(e.key==='ArrowUp')target=at-5;if(e.key==='ArrowDown')target=at+5;if(target!==undefined){e.preventDefault();if(target>=0&&target<25&&!tiles[target].disabled)tiles[target].focus();}};
  $('mf-start').onclick=start;$('mf-practice').onclick=practice;$('mf-cashout').onclick=()=>act('cashout');$('mf-again').onclick=()=>demo?practice():start();$('mf-retry').onclick=()=>retry?.();
  $('mf-help').onclick=()=>{const d=document.createElement('dialog');d.className='xan-dialog';d.innerHTML='<h2>How to play Minefield</h2><ol><li>Choose your wager and 3, 6, 9, 12 or 15 mines. Starting a field spends the amount shown.</li><li>Pick any covered tile. An diamond increases your cash-out value. A mine ends the round and loses that wager.</li><li>After at least one diamond, press Cash out to collect your current return, or pick again for a bigger prize.</li><li>The mine selector shows your first-find multiplier. The ladder shows total returns for consecutive safe finds. More mines mean bigger rewards and fewer safe tiles. There are no number clues. The next safe-find value is shown before every choice. Your payout schedule is fixed when the field starts.</li><li>Find every safe tile to collect automatically. Return amounts include your original wager; profit is shown separately.</li><li>Your unfinished field is saved to your profile. Reconnect or resume it without buying another field. Free fields never spend or award chips.</li></ol><button class="mf-primary">Got it</button>';document.body.append(d);d.querySelector('button').onclick=()=>d.close();d.onclose=()=>d.remove();d.showModal();};
  controls();reconnect();
 });
 window.addEventListener('pagehide',()=>{pageActive=false;epoch++;sound.silence();});
 window.addEventListener('pageshow',e=>{if(e.persisted){pageActive=true;busy=false;pending=null;ready=false;saved=null;notice();menu();reconnect();}});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&pageActive&&!busy&&!pending&&!demo)reconnect();});
})();
