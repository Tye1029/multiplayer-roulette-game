/* SUMMIT_SPRINT_V71: charged jumps, grounded celebration and smooth recovery. */
(() => {
 'use strict';
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),layouts=new WeakMap();
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 // Artwork anchors in a 683x2048 reference view, ground first. The server owns gameplay order.
 const route=[[340,1920],[368,1830],[354,1710],[335,1603],[366,1540],[322,1476],[366,1393],[331,1338],[355,1281],[332,1171],[374,1119],[326,1066],[351,1024],[359,967],[337,903],[356,860],[335,792],[370,739],[331,699],[357,653],[315,624],[342,564],[357,530],[341,493],[351,448],[324,408],[346,357],[330,317],[350,276],[325,235],[338,184]];
 const arrow=t=>`<svg class="m68-arrow" viewBox="0 0 24 24" aria-hidden="true" style="transform:rotate(${({up:0,right:90,down:180,left:270})[t]||0}deg)"><path d="M12 2 2 12h6v10h8V12h6Z"/></svg>`;
 function point(v,index){const p=route[Math.round(clamp(index,0,v.total)/v.total*30)];return{x:(p[0]/683-.5)*v.width,y:(1-p[1]/2048)*v.height};}
 function place(node,p){node.style.left=`calc(50% + ${p.x}px)`;node.style.bottom=p.y+'px';}
 function build(root,total){
  root.dataset.mrScene='68';delete root.dataset.mrApprovedScene;
  root.innerHTML=`<div class="mountain-race-game m68-game" data-authoritative="1"><header class="m68-header"><div><h2>Summit Sprint</h2><span class="m68-stakes" hidden></span></div><div class="m68-clock"><small>TIME LEFT</small><b data-mr-clock>30</b></div></header><div class="m68-racers"></div><div class="m68-stage"></div><section class="m68-deck" aria-label="Climbing controls"><div><small>NEXT FOUR MOVES</small><div class="m68-queue"></div><p class="m68-status" role="status"></p></div><div class="m68-pad">${['up','left','down','right'].map(t=>`<button type="button" class="m68-key m68-${t}" data-mr-network-input="${t}"><b>${arrow(t)}</b><small>${t}</small></button>`).join('')}</div></section><div class="m68-overlays"></div></div>`;
  root.querySelector('.m68-deck>div').insertAdjacentHTML('beforeend','<div class="m71-charge" hidden><span class="m71-ring" aria-hidden="true"><i></i><b>2×</b></span><span class="m71-charge-copy" role="status"></span></div><p class="m71-hint">Tap: next ledge · Hold the second arrow, release in green: jump two</p>');
  root.querySelector('.m68-pad').append(root.querySelector('.m71-charge'));
  const v={total,height:3400,width:3400/3,overlay:'',gameId:'',lanes:[]};
  v.lanes=['me','opponent'].map((side,i)=>{
   const card=document.createElement('div');card.className='m68-player '+side;card.innerHTML='<div><strong></strong><span></span></div><div class="m68-progress"><i></i></div>';root.querySelector('.m68-racers').append(card);
   const lane=document.createElement('div');lane.className='m68-lane '+side;lane.setAttribute('aria-label',i?'Opponent route':'Your route');lane.innerHTML=`<div class="m68-world" style="height:${v.height}px"><img class="m68-environment" src="/assets/mountain-race/images/summit-brown-world-v69.png" alt=""><div class="m70-clouds" aria-hidden="true"><i></i><i></i><i></i></div><div class="m68-trail"></div><div class="m68-climber"><div class="m68-sprite"></div></div><span class="m68-summit">FINISH</span><div class="m68-confetti" hidden>${Array.from({length:24},(_,j)=>`<i style="--i:${j}"></i>`).join('')}</div></div>`;root.querySelector('.m68-stage').append(lane);
   const world=lane.firstElementChild,trail=lane.querySelector('.m68-trail');
   const holds=Array.from({length:total},(_,j)=>{const hold=document.createElement('div');hold.className='m68-hold';hold.dataset.mrHoldIndex=j;place(hold,point(v,j+1));hold.innerHTML='<b></b>';trail.append(hold);return hold;});
   const top=point(v,total);place(lane.querySelector('.m68-summit'),{...top,y:top.y+8});place(lane.querySelector('.m68-confetti'),{...top,y:top.y+180});
   return{lane,world,card,holds,climber:lane.querySelector('.m68-climber'),sprite:lane.querySelector('.m68-sprite'),lastIndex:-1,lastInput:'',lastRejected:0,side,zoom:1};
  });layouts.set(root,v);return v;
 }
 function camera(v,l,index,instant=false){
  const view=l.lane.clientHeight,p=point(v,index);
  // Uniform zoom reveals the narrowing shoulders on phones without stretching the artwork.
  const peakZoom=Math.min(1,l.lane.clientWidth*.78/(v.width*.235)),finish=clamp((index/v.total-.76)/.24,0,1),zoom=1-(1-peakZoom)*finish;
  const distance=clamp(p.y*zoom-view*.23,0,Math.max(0,v.height*zoom-view));
  if(instant)l.world.style.transition='none';
  l.world.style.setProperty('--m68-inverse-zoom',String(1/zoom));l.world.style.transform=`translate3d(0,${distance}px,0) scale(${zoom})`;
  l.lane.dataset.camera=String(Math.round(distance));l.lane.dataset.zoom=String(zoom);l.zoom=zoom;
  if(instant){void l.world.offsetWidth;l.world.style.removeProperty('transition');}
 }
 function render(root,data){
  const {game,total,me,opponent,prompts,enabled,tone,status,overlays,seconds}=data;
  let v=layouts.get(root);if(!v||v.total!==total||!root.querySelector('.m68-game'))v=build(root,total);
  const fresh=v.gameId!==String(game.gameId||'preview');if(fresh){v.gameId=String(game.gameId||'preview');for(const l of v.lanes){l.lastIndex=-1;l.lastInput='';l.lastRejected=0;l.slipUntil=0;}}
  delete root.dataset.mrApprovedScene;root.dataset.mrScene='68';root.querySelector('.m68-game').dataset.status=game.status;root.querySelector('[data-mr-clock]').textContent=seconds;const stakes=root.querySelector('.m68-stakes');stakes.hidden=!Number(game.wager);stakes.textContent=Number(game.wager).toLocaleString()+' Chips stake · '+Number(game.pot||game.wager*2).toLocaleString()+' Chips pot';
  for(const [i,p] of [me,opponent].entries()){
   const l=v.lanes[i],index=clamp(p.promptIndex,0,total),won=game.status==='complete'&&!game.mountainraceState.tie&&(i===0?game.mountainraceState.viewerWon:!game.mountainraceState.viewerWon);
   l.card.querySelector('strong').textContent=(i===0?'You · ':'')+p.name;l.card.querySelector('span').textContent=`${index} / ${total} holds`;l.card.querySelector('.m68-progress i').style.transform=`scaleX(${index/total})`;
   const slip=p.lastInput?.correct===false&&p.rejectedInputs>l.lastRejected;
   if(slip){l.slipUntil=performance.now()+500;l.climber.classList.remove('slipping');void l.climber.offsetWidth;l.climber.classList.add('slipping');window.clearTimeout(l.fallTimer);l.fallTimer=window.setTimeout(()=>{l.climber.classList.remove('slipping');if(l.climber.dataset.pose==='6'){l.sprite.style.backgroundPosition='0% '+i*100+'%';l.climber.dataset.pose='0';}},500);}
   l.lastRejected=p.rejectedInputs||0;
   l.climber.classList.toggle('charged-jump',Boolean(p.lastInput?.charged&&p.lastInput.correct));
   if(index!==l.lastIndex){const first=l.lastIndex<0;if(first)l.climber.style.transition='none';place(l.climber,point(v,index));camera(v,l,index,first);if(first){void l.climber.offsetWidth;l.climber.style.removeProperty('transition');}l.lastIndex=index;}
   const falling=performance.now()<(l.slipUntil||0),direction=p.lastInput?.control;
   const pose=index===total?7:falling?6:index===0?0:direction==='down'?5:direction==='left'?(index%2?1:2):direction==='right'?(index%2?3:4):[1,2,3,4][index%4];
   l.climber.dataset.pose=String(pose);l.climber.classList.toggle('slipping',falling);
   l.sprite.style.backgroundPosition=`${pose*100/7}% ${i*100}%`;l.climber.classList.toggle('celebrating',won);l.lane.querySelector('.m68-confetti').hidden=!won;l.lastInput=p.lastInput?.at||'';
   l.holds.forEach((hold,j)=>{hold.classList.toggle('current',j===index);hold.classList.toggle('passed',j<index);const token=i===0&&j>=index&&j<index+prompts.length?prompts[j-index]:j<index?'passed':'';if(hold.dataset.token!==token){hold.dataset.token=token;hold.querySelector('b').innerHTML=token==='passed'?'✓':token?arrow(token):'';}hold.hidden=j<index-3||j>index+4;});
  }
  const q=root.querySelector('.m68-queue'),key=game.status+':'+prompts.join(':');if(q.dataset.key!==key){q.dataset.key=key;q.innerHTML=prompts.map((t,i)=>`<span class="${i===0?'next':''}" aria-label="${t}">${arrow(t)}<small>${t}</small></span>`).join('') || `<p class="m70-queue-note">${game.status==='complete'?'Race complete':game.status==='playing'?'Syncing next moves…':'Moves appear when the race starts'}</p>`;}
  root.querySelector('.m68-status').textContent=status;root.querySelector('.m68-status').dataset.tone=tone;
  root.querySelectorAll('[data-mr-network-input]').forEach(b=>{b.disabled=!enabled;b.dataset.mrDisplayedExpected=prompts[0]||'';b.dataset.mrDisplayedIndex=me.promptIndex;b.dataset.mrDisplayedRound=game.mountainraceState.roundId||'';});
  if(v.overlay!==overlays){v.overlay=overlays;root.querySelector('.m68-overlays').innerHTML=overlays;}
 }
 function setCharge(root,charge){
  if(!root)return;const panel=root.querySelector('.m71-charge');if(!panel)return;
  panel.hidden=!charge;root.querySelector('.m71-hint').hidden=false;
  root.querySelectorAll('.m68-key').forEach(b=>b.classList.toggle('charging',Boolean(charge&&b.dataset.mrNetworkInput===charge.token)));
  const v=layouts.get(root);if(v)v.lanes[0].holds.forEach((h,j)=>h.classList.toggle('jump-target',Boolean(charge&&j===v.lanes[0].lastIndex+1)));
  if(!charge)return;
  const green=charge.age>=900&&charge.age<=1180;
  panel.dataset.green=String(green);panel.style.setProperty('--charge-angle',Math.min(360,charge.age/1600*360)+'deg');
  panel.querySelector('.m71-charge-copy').textContent=charge.releasing?'Landing…':!charge.ready?'Get ready…':green?'RELEASE!':charge.age>1180?'Too late!':'Hold '+charge.token.toUpperCase();
 }
 function resultOverlay(game,state,total){
  const outcome=state.tie?'tie':state.viewerWon?'win':'loss',title=state.tie?'A DEAD HEAT':state.viewerWon?'YOU WIN!':'YOU LOST THE RACE';
  const start=Date.parse(state.startAt);
  const time=p=>{const finish=Date.parse(p.finishedAt),ms=finish-start;return p.finishedAt&&Number.isFinite(ms)?(Math.max(0,ms)/1000).toFixed(2)+'s':'DNF';};
  const comparison=p=>{const r=p.performance;if(p.isBot)return 'Practice opponent';if(!r)return 'Personal best unavailable';const fmt=n=>(n/1000).toFixed(2)+'s';if(!p.finishedAt||r.elapsedMs===null)return r.bestMs===null?'Finish a race to set your best':'Personal best '+fmt(r.bestMs);if(r.previousBestMs===null)return 'First finish · personal best '+fmt(r.bestMs);const delta=r.elapsedMs-r.previousBestMs;return delta<0?'NEW PERSONAL BEST · '+fmt(-delta)+' faster':delta===0?'Matched your personal best':'Personal best '+fmt(r.bestMs)+' · '+fmt(delta)+' slower';};
  const chips=n=>Math.round(n).toLocaleString()+' Chips',wager=Number(game.wager)||0,payout=Number(game.payout);
  const reward=state.tie?'Stake returned':state.viewerWon?(payout>0?'+'+chips(Math.max(0,payout-wager)):wager?'Settlement pending':'Free practice'):wager?'−'+chips(wager):'Free practice';
  const detail=state.viewerWon&&payout>0?chips(payout)+' returned including your stake':state.tie?'No net change':state.viewerWon?'':'Your next climb awaits.';
  return `<div class="mr-overlay complete"><div class="mr-overlay-card result m69-result ${outcome}"><span class="mr-eyebrow">RACE COMPLETE</span><svg class="m69-crest" viewBox="0 0 120 60" aria-hidden="true"><path d="M4 54 42 12h24l50 42Z"/><path d="m42 12 12 16 12-16M54 28v24"/></svg><h1>${title}</h1><div class="m69-times">${[state.me||{},state.opponent||{}].map((p,i)=>`<section><small>${i===0?'YOU':'OPPONENT'}</small><strong>${escape(p.name||'Climber')}</strong><b>${time(p)}</b><span>${p.finishedAt?'SUMMIT REACHED':'DID NOT FINISH'} · ${Number(p.promptIndex)||0}/${total} holds</span><p class="m70-personal-best">${escape(comparison(p))}</p></section>`).join('')}</div><div class="m69-prize"><small>${state.viewerWon?'NET WINNINGS':state.tie?'DRAW':'STAKE LOST'}</small><strong>${reward}</strong><span>${detail}</span></div><div class="mr-result-actions"><button type="button" class="mr-start-button" data-mr-rematch>REMATCH</button><button type="button" class="mr-start-button secondary" data-mr-new-game>NEW GAME</button></div></div></div>`;
 }
 window.addEventListener('resize',()=>{for(const root of document.querySelectorAll('[data-mr-scene="68"]')){const v=layouts.get(root);if(v)for(const l of v.lanes)camera(v,l,Math.max(0,l.lastIndex));}});
 function preview(root){render(root,{game:{status:'waiting',mountainraceState:{}},total:30,me:{promptIndex:0,name:'Climber'},opponent:{promptIndex:0,name:'Your opponent'},prompts:[],enabled:false,tone:'waiting',status:'Create Game to open your race, or join an Open Game below.',overlays:'',seconds:'—'});}
 window.SummitSceneV68={render,preview,resultOverlay,setCharge};
})();
