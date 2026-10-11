/* SUMMIT_SPRINT_V69: retained cameras and handholds mapped directly to painted rock. */
(() => {
 'use strict';
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),layouts=new WeakMap();
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 // Artwork anchors in a 683x2048 reference view, ground first. The server owns gameplay order.
 const route=[[340,1920],[368,1830],[354,1710],[335,1603],[366,1540],[322,1476],[366,1393],[331,1338],[355,1281],[332,1171],[374,1119],[326,1066],[351,1024],[359,967],[337,903],[356,860],[335,792],[370,739],[331,699],[357,653],[315,624],[342,564],[357,530],[341,493],[351,448],[324,408],[346,357],[330,317],[350,276],[325,235],[338,180]];
 const arrow=t=>`<svg class="m68-arrow" viewBox="0 0 24 24" aria-hidden="true" style="transform:rotate(${({up:0,right:90,down:180,left:270})[t]||0}deg)"><path d="M12 2 2 12h6v10h8V12h6Z"/></svg>`;
 function point(v,index){const p=route[Math.round(clamp(index,0,v.total)/v.total*30)];return{x:(p[0]/683-.5)*v.width,y:(1-p[1]/2048)*v.height};}
 function place(node,p){node.style.left=`calc(50% + ${p.x}px)`;node.style.bottom=p.y+'px';}
 function build(root,total){
  root.dataset.mrScene='68';delete root.dataset.mrApprovedScene;
  root.innerHTML=`<div class="mountain-race-game m68-game" data-authoritative="1"><header class="m68-header"><div><small>THE COPPER RIDGE</small><h2>Summit Sprint</h2><span class="m68-stakes" hidden></span></div><div class="m68-clock"><small>TIME LEFT</small><b data-mr-clock>30</b></div></header><div class="m68-racers"></div><div class="m68-stage"></div><section class="m68-deck" aria-label="Climbing controls"><div><small>NEXT FOUR MOVES</small><div class="m68-queue"></div><p class="m68-status" role="status"></p></div><div class="m68-pad">${['up','left','down','right'].map(t=>`<button type="button" class="m68-key m68-${t}" data-mr-network-input="${t}"><b>${arrow(t)}</b><small>${t}</small></button>`).join('')}</div></section><div class="m68-overlays"></div></div>`;
  const v={total,height:3400,width:3400/3,overlay:'',gameId:'',lanes:[]};
  v.lanes=['me','opponent'].map((side,i)=>{
   const card=document.createElement('div');card.className='m68-player '+side;card.innerHTML='<div><strong></strong><span></span></div><div class="m68-progress"><i></i></div>';root.querySelector('.m68-racers').append(card);
   const lane=document.createElement('div');lane.className='m68-lane '+side;lane.setAttribute('aria-label',i?'Opponent route':'Your route');lane.innerHTML=`<div class="m68-world" style="height:${v.height}px"><img class="m68-environment" src="/assets/mountain-race/images/summit-brown-world-v69.png" alt=""><div class="m68-trail"></div><div class="m68-climber"><div class="m68-sprite"></div></div><span class="m68-summit">SUMMIT</span><div class="m68-confetti" hidden>${Array.from({length:24},(_,j)=>`<i style="--i:${j}"></i>`).join('')}</div></div>`;root.querySelector('.m68-stage').append(lane);
   const world=lane.firstElementChild,trail=lane.querySelector('.m68-trail');
   const holds=Array.from({length:total},(_,j)=>{const hold=document.createElement('div');hold.className='m68-hold';hold.dataset.mrHoldIndex=j;place(hold,point(v,j+1));hold.innerHTML='<b></b>';trail.append(hold);return hold;});
   const top=point(v,total);place(lane.querySelector('.m68-summit'),{...top,y:top.y+8});place(lane.querySelector('.m68-confetti'),{...top,y:top.y+180});
   return{lane,world,card,holds,climber:lane.querySelector('.m68-climber'),sprite:lane.querySelector('.m68-sprite'),lastIndex:-1,lastInput:'',side,zoom:1};
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
  const fresh=v.gameId!==String(game.gameId||'preview');if(fresh){v.gameId=String(game.gameId||'preview');for(const l of v.lanes){l.lastIndex=-1;l.lastInput='';}}
  delete root.dataset.mrApprovedScene;root.dataset.mrScene='68';root.querySelector('.m68-game').dataset.status=game.status;root.querySelector('[data-mr-clock]').textContent=seconds;const stakes=root.querySelector('.m68-stakes');stakes.hidden=!Number(game.wager);stakes.textContent=Number(game.wager).toLocaleString()+' Chips stake · '+Number(game.pot||game.wager*2).toLocaleString()+' Chips pot';
  for(const [i,p] of [me,opponent].entries()){
   const l=v.lanes[i],index=clamp(p.promptIndex,0,total),won=game.status==='complete'&&!game.mountainraceState.tie&&(i===0?game.mountainraceState.viewerWon:!game.mountainraceState.viewerWon);
   l.card.querySelector('strong').textContent=(i===0?'You · ':'')+p.name;l.card.querySelector('span').textContent=`${index} / ${total} holds`;l.card.querySelector('.m68-progress i').style.transform=`scaleX(${index/total})`;
   const slip=p.lastInput?.correct===false&&p.lastInput?.at!==l.lastInput;
   if(slip){l.climber.classList.remove('slipping');void l.climber.offsetWidth;l.climber.classList.add('slipping');}
   if(index!==l.lastIndex){const first=l.lastIndex<0;if(first)l.climber.style.transition='none';place(l.climber,point(v,index));camera(v,l,index,first);if(first){void l.climber.offsetWidth;l.climber.style.removeProperty('transition');}l.lastIndex=index;}
   const pose=won?4:index===0?0:slip?3:(p.lastInput?.control==='left'?1:p.lastInput?.control==='right'?2:index%2+1);
   l.sprite.style.backgroundPosition=`${pose*25}% ${i*100}%`;l.climber.classList.toggle('celebrating',won);l.lane.querySelector('.m68-confetti').hidden=!won;l.lastInput=p.lastInput?.at||'';
   l.holds.forEach((hold,j)=>{hold.classList.toggle('current',j===index);hold.classList.toggle('passed',j<index);const token=i===0&&j>=index&&j<index+prompts.length?prompts[j-index]:j<index?'passed':'';if(hold.dataset.token!==token){hold.dataset.token=token;hold.querySelector('b').innerHTML=token==='passed'?'✓':token?arrow(token):'';}hold.hidden=j<index-3||j>index+4;});
  }
  const q=root.querySelector('.m68-queue'),key=prompts.join(':');if(q.dataset.key!==key){q.dataset.key=key;q.innerHTML=prompts.map((t,i)=>`<span class="${i===0?'next':''}" aria-label="${t}">${arrow(t)}</span>`).join('');}
  root.querySelector('.m68-status').textContent=status;root.querySelector('.m68-status').dataset.tone=tone;
  root.querySelectorAll('[data-mr-network-input]').forEach(b=>{b.disabled=!enabled;b.dataset.mrDisplayedExpected=prompts[0]||'';b.dataset.mrDisplayedIndex=me.promptIndex;b.dataset.mrDisplayedRound=game.mountainraceState.roundId||'';});
  if(v.overlay!==overlays){v.overlay=overlays;root.querySelector('.m68-overlays').innerHTML=overlays;}
 }
 function resultOverlay(game,state,total){
  const outcome=state.tie?'tie':state.viewerWon?'win':'loss',title=state.tie?'A DEAD HEAT':state.viewerWon?'YOU WON THE CLIMB':'YOU LOST THE RACE';
  const start=Date.parse(state.startAt),end=Date.parse(state.completedAt||state.endAt);
  const time=p=>{const finish=Date.parse(p.finishedAt),ms=(Number.isFinite(finish)?finish:end)-start;return Number.isFinite(ms)?(Math.max(0,ms)/1000).toFixed(2)+'s':'—';};
  const chips=n=>Math.round(n).toLocaleString()+' Chips',wager=Number(game.wager)||0,payout=Number(game.payout);
  const reward=state.tie?'Stake returned':state.viewerWon?(payout>0?'+'+chips(Math.max(0,payout-wager)):wager?'Settlement pending':'Free practice'):wager?'−'+chips(wager):'Free practice';
  const detail=state.viewerWon&&payout>0?chips(payout)+' returned including your stake':state.tie?'No net change':state.viewerWon?'':'Your next climb awaits.';
  return `<div class="mr-overlay complete"><div class="mr-overlay-card result m69-result ${outcome}"><span class="mr-eyebrow">COPPER RIDGE · RACE COMPLETE</span><svg class="m69-crest" viewBox="0 0 120 60" aria-hidden="true"><path d="M4 54 42 12h24l50 42Z"/><path d="m42 12 12 16 12-16M54 28v24"/></svg><h1>${title}</h1><div class="m69-times">${[state.me||{},state.opponent||{}].map((p,i)=>`<section><small>${i===0?'YOU':'OPPONENT'}</small><strong>${escape(p.name||'Climber')}</strong><b>${time(p)}</b><span>${p.finishedAt?'SUMMIT REACHED':'DID NOT FINISH'} · ${Number(p.promptIndex)||0}/${total} holds</span></section>`).join('')}</div><div class="m69-prize"><small>${state.viewerWon?'NET WINNINGS':state.tie?'DRAW':'STAKE LOST'}</small><strong>${reward}</strong><span>${detail}</span></div><div class="mr-result-actions"><button type="button" class="mr-start-button" data-mr-rematch>REMATCH</button><button type="button" class="mr-start-button secondary" data-mr-new-game>NEW GAME</button></div></div></div>`;
 }
 window.addEventListener('resize',()=>{for(const root of document.querySelectorAll('[data-mr-scene="68"]')){const v=layouts.get(root);if(v)for(const l of v.lanes)camera(v,l,Math.max(0,l.lastIndex));}});
 function preview(root){render(root,{game:{status:'waiting',mountainraceState:{}},total:30,me:{promptIndex:0,name:'Climber'},opponent:{promptIndex:0,name:'Your opponent'},prompts:[],enabled:false,tone:'waiting',status:'Create Game to open your race, or join an Open Game below.',overlays:'',seconds:'—'});}
 window.SummitSceneV68={render,preview,resultOverlay};
})();
