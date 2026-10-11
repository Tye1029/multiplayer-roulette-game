import {createTableAudio} from './audio.mjs';
import {createGun} from './gun.mjs';
import {CAST,castById} from './cast.mjs';
import {animateRoom} from './room.mjs';
import {installDebug} from './debug.mjs';
const $=id=>document.getElementById(id),chips=n=>Number(n||0).toLocaleString()+' Chips';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let me=null,game=null,busy=false,timer,revision=-1,lastAction=0,seatsKey='',angle=270;
let id=new URLSearchParams(location.search).get('room')||'',requestId=crypto.randomUUID().replace(/-/g,'').slice(0,24);
const debug=installDebug(()=>({version:'XAN_FOUR_ONLINE_V1',gameId:id,phase:game?.phase,revision:game?.revision,players:game?.players.length,online:navigator.onLine}));
const trace=(type,details)=>debug.record(type,details),audio=createTableAudio(trace),gun=createGun(trace),atmosphere=animateRoom();
window.XanSiteAdapter={current:()=>({mode:'roulette-four',id:game?.seated?id:'',phase:game?.phase||'lobby'})};
async function api(action,extra={}){
 const token=await window.XanHub.authenticate();const data=await window.XanHub.post('roulette-four-action',{action,token,gameId:id,...extra});me=data.player;accept(data.game);return data;
}
function status(text){$('profile-status').textContent=text;$('scene-message').textContent=text;}
function direction(player){const order=game.order,viewer=Math.max(0,order.indexOf(me.id));return ['down','left','up','right'][(order.indexOf(player.id)-viewer+4)%4];}
function mountSeats(){
 const key=game.order.join(':');if(key===seatsKey)return;seatsKey=key;
 $('seats').innerHTML=game.players.filter(p=>p.id!==me.id).map(p=>{
  const c=CAST[game.players.findIndex(x=>x.id===p.id)%CAST.length],[x,y,w,h,tilt]=c.screen;
  return `<div class="seat" data-player="${p.id}" data-character="${c.id}" data-direction="${direction(p)}" style="--atlas:url('${c.art}');--atlas-rows:${c.rows*100}%;--atlas-x:${c.col*100}%;--atlas-y:${c.row/(c.rows-1)*100}%;--screen-x:${x}%;--screen-y:${y}%;--screen-w:${w}%;--screen-h:${h}%;--screen-tilt:${tilt}deg"><div class="seat-figure"><div class="character-art character-fallback"></div><canvas class="character-canvas"></canvas><div class="head-motion"><div class="tv-glow"></div><div class="tv-screen"><img src="/assets/roulette-four/images/${['amber','mint','rose','violet'][game.players.findIndex(x=>x.id===p.id)]}.svg" alt=""></div></div></div><span class="seat-name">${esc(p.name)}</span></div>`;
 }).join('');$('self-seat').textContent=me.name;
}
function render(){
 if(!game)return;const s=game,mine=s.players.find(p=>p.id===me.id);
 $('roulette-four').dataset.phase=s.phase;
 document.querySelector('.table-meta').textContent=`ONLINE TABLE · ${s.players.length}/4 players · ${chips(s.wager)} each · ${s.rate}% house fee`;
 $('players').innerHTML=s.players.map(p=>`<article class="player-bar ${p.id===s.activeId?'active':''} ${p.eliminated?'eliminated':''}"><img class="avatar" src="/assets/roulette-four/images/amber.svg" alt=""><div><b>${esc(p.name)}${p.id===me.id?' · You':''}</b><span class="player-detail">${p.eliminated?'OUT':p.id===s.activeId?'Your turn at the table':p.spinUsed?'Spin used':'1 spin left'}</span></div><strong>${chips(p.bank)}</strong></article>`).join('');
 $('pot').textContent=chips(s.phase==='waiting'?s.wager*s.players.length:s.pot);
 for(const action of ['shoot','spin','pass'])$(action).disabled=busy||s.phase!=='playing'||s.activeId!==me.id||Date.now()<s.actionAfter||(action==='spin'&&mine?.spinUsed)||(action==='pass'&&!s.turnShots);
 $('shoot-value').textContent='+'+chips(Math.min(s.nextPayout,s.pot));$('spin').innerHTML=`Spin chamber <small>${mine?.spinUsed?'Used this game':'Resets to '+chips(s.wager/5)}</small>`;
 $('risk-label').textContent=`1 in ${6-s.safeSinceSpin} chance`;$('chambers').innerHTML=Array.from({length:6},(_,i)=>`<i class="chamber-dot ${i<s.safeSinceSpin?'spent':''}"></i>`).join('');
 $('turn-label').textContent=s.phase==='waiting'?`Waiting for players · ${s.players.length}/4`:s.phase==='opening'?'Choosing the first player':s.phase==='playing'?(s.activeId===me.id?'Your turn':s.players.find(p=>p.id===s.activeId)?.name+'’s turn'):s.phase==='cancelled'?'Table cancelled':'Game complete';
 $('turn-hint').textContent=s.phase==='waiting'?'Your table stays open for 15 minutes. You can browse or join other games.':s.phase==='playing'?`${Math.max(0,Math.ceil((s.deadline-Date.now())/1000))}s remaining · take one shot before passing`:s.reason||'';
 $('new-table').textContent='All games';$('opening').hidden=s.phase!=='opening';$('opening-name').textContent='Four players. One pot.';
 document.querySelectorAll('.seat').forEach(el=>{const p=s.players.find(p=>p.id===el.dataset.player);el.classList.toggle('active',p?.id===s.activeId);el.classList.toggle('eliminated',p?.eliminated);});
 $('cancel-table').hidden=!(s.mine&&s.players.length===1&&s.phase==='waiting');
 if(s.phase==='complete'){
  $('result-title').textContent=mine?.eliminated?'Your luck ran out.':'You survived.';$('result-description').textContent=s.settled?`${chips(s.payouts[me.id]||0)} credited · stake ${chips(s.wager)}`:'Confirming Chip payouts…';
  $('result-rows').innerHTML=s.players.map(p=>`<div class="result-row"><img src="/assets/roulette-four/images/amber.svg" alt=""><b>${esc(p.name)}</b><span>${chips(s.payouts[p.id]||0)} paid out</span></div>`).join('');
  $('countdown').textContent=`${s.rematchVotes.length}/4`;$('ready-label').textContent='All four players must accept the same wager within 15 seconds of the first vote.';$('rematch').textContent='Rematch · '+chips(s.wager);$('rematch').disabled=busy||!s.settled||s.rematchVotes.includes(me.id);$('reopen-results').hidden=false;
 }
 debug.refresh();
}
function accept(s){
 if(s.id===id&&s.revision<revision)return;const prior=game;game=s;id=s.id;revision=s.revision;
 if(s.seated){$('scene-message').textContent='';$('welcome').close();history.replaceState(null,'','?room='+s.id);mountSeats();}
 if(s.activeId&&s.activeId!==prior?.activeId){angle=270+['down','left','up','right'].indexOf(direction(s.players.find(p=>p.id===s.activeId)))*90;const duration=s.phase==='opening'?2000:600;$('gun').style.transitionDuration=duration+'ms';$('gun').style.transform=`rotate(${angle+(s.phase==='opening'?720:0)}deg)`;audio.play('wood',{duration,volume:.2});}
 const e=s.lastAction;if(e&&e.number>lastAction){lastAction=e.number;if(e.action==='shoot'){gun.strike(e.fatal);audio.play(e.fatal?'live':'dry',{duration:900,volume:.3});$('scene').classList.toggle('is-fatal',!!e.fatal);}if(e.action==='spin'){gun.roll(850);audio.play('spin',{duration:850,volume:.2});}}
 render();if(s.phase==='complete'&&prior?.phase!=='complete')window.XanHub.refresh();
 if(s.phase==='complete'&&prior?.phase!=='complete')setTimeout(()=>{if(game?.id===s.id&&!$('result-dialog').open)$('result-dialog').showModal();},1200);
 if(s.nextMatch&&s.nextMatch!==id){id=s.nextMatch;revision=-1;game=null;seatsKey='';$('result-dialog').close();poll();}
 if(!s.seated&&s.reason)status(s.reason);
}
async function poll(){if(busy||document.hidden||!id)return;busy=true;try{await api('get');}catch(e){status(e.message);}finally{busy=false;render();}}
async function act(choice){if(busy)return;busy=true;render();try{await audio.unlock();if(choice==='shoot'){gun.cock();audio.play('hammer',{duration:200,volume:.2});}await api('act',{choice,revision,actionId:crypto.randomUUID()});}catch(e){status(e.message);await api('get').catch(()=>{});}finally{busy=false;render();}}
$('gun-options').onchange=e=>gun.select(e.target.value);
for(const a of ['shoot','spin','pass'])$(a).onclick=()=>act(a);
$('rules').onclick=()=>{$('rules-dialog').querySelectorAll('li')[2].textContent='Safe-shot rewards start at one fifth of the wager and increase by that amount with each safe shot.';$('rules-dialog').querySelectorAll('li')[3].textContent='Each player may spin once. Spinning randomizes the chamber and resets the award to one fifth of the wager.';$('rules-dialog').showModal();};$('close-rules').onclick=()=>$('rules-dialog').close();
$('sound').onclick=()=>{window.XanPreferences.sound(window.XanPreferences.muted);audio.unlock();$('sound').textContent=window.XanPreferences.muted?'Sound off':'Sound on';};
for(const name of ['new-table','result-new-table'])$(name).onclick=()=>location.assign('/');
$('reopen-results').onclick=()=>$('result-dialog').showModal();$('view-table').onclick=()=>$('result-dialog').close();
$('rematch').onclick=async()=>{busy=true;render();try{await api('rematch',{wager:game.wager});}catch(e){status(e.message);}finally{busy=false;render();}};
document.querySelector('footer>span').textContent='Server-controlled turns · shared Chip wagers';
const cancel=document.createElement('button');cancel.id='cancel-table';cancel.textContent='Cancel empty table';cancel.hidden=true;cancel.onclick=async()=>{try{await api('cancel');window.XanHub.refresh();}catch(e){status(e.message);}};document.querySelector('footer').append(cancel);
const form=$('join-form');form.querySelector('p:not(.eyebrow)').textContent='Create a public table or accept the wager to take an open seat. Four verified players are required.';
const back=document.createElement('a');back.href='/';back.textContent='← All games';form.append(back);
const label=document.createElement('label');label.textContent='Wager per player · Chips';const input=document.createElement('input');Object.assign(input,{id:'four-wager',type:'number',min:'1000',max:'50000',step:'1000',value:'1000'});input.required=true;label.append(input);form.querySelector('button').before(label);form.querySelector('.fine').textContent='Unfilled tables expire after 15 minutes and refund all stakes. Closing the page keeps your seat. Inactive turns forfeit your bank.';
form.onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;form.querySelector('button').disabled=true;try{await audio.unlock();await gun.ready();await api(id?'join':'create',{wager:Number(input.value),requestId});window.XanHub.refresh();}catch(e){status(e.message);}finally{busy=false;form.querySelector('button').disabled=false;render();}};
async function init(){
 if(!window.XanHub){setTimeout(init,50);return;}
 $('welcome').showModal();gun.ready().catch(()=>{});form.querySelector('button').textContent=id?'Accept wager & join':'Create public table';$('profile-name').textContent='Four-player Roulette';status('Connect on the main site before staking Chips.');
 try{await window.XanHub.authenticate();if(id){await api('get');input.value=game.wager;input.disabled=true;if(!game.seated)status(`${game.players.length}/4 seats · ${chips(game.wager)} each · ${game.rate}% fee`);}else status('Choose your stake. Your challenge appears on the main screen.');}catch(e){status(e.message);}
 timer=setInterval(poll,game?.phase==='waiting'?1800:1000);
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll();else audio.stop();});window.addEventListener('pagehide',()=>{clearInterval(timer);audio.stop();});
init();
