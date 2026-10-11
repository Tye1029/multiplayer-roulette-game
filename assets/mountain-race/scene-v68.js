/* SUMMIT_SPRINT_V68: persistent scene nodes, transform-only cameras, server-owned input. */
(() => {
 'use strict';
 const glyph={up:'↑',left:'←',right:'→',down:'↓'},clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const layouts=new WeakMap();
 function build(root,total){
  root.dataset.mrScene='68';delete root.dataset.mrApprovedScene;
  root.innerHTML=`<div class="mountain-race-game m68-game" data-authoritative="1"><header class="m68-header"><div><small>THE NORTH FACE</small><h2>Summit Sprint</h2></div><div class="m68-clock"><small>TIME LEFT</small><b data-mr-clock>30</b></div></header><div class="m68-racers"></div><div class="m68-stage"></div><section class="m68-deck" aria-label="Climbing controls"><div><small>NEXT FOUR MOVES</small><div class="m68-queue"></div><p class="m68-status" role="status"></p></div><div class="m68-pad">${['up','left','down','right'].map(t=>`<button type="button" class="m68-key m68-${t}" data-mr-network-input="${t}"><b>${glyph[t]}</b><small>${t}</small></button>`).join('')}</div></section><div class="m68-overlays"></div></div>`;
  const height=total*110+600,base=height*.065,summit=height*.91,step=(summit-base)/total;
  const lanes=['me','opponent'].map((side,i)=>{
   const card=document.createElement('div');card.className='m68-player '+side;card.innerHTML='<div><strong></strong><span></span></div><div class="m68-progress"><i></i></div>';root.querySelector('.m68-racers').append(card);
   const lane=document.createElement('div');lane.className='m68-lane '+side;lane.setAttribute('aria-label',i?'Opponent route':'Your route');lane.innerHTML=`<div class="m68-world" style="height:${height}px"><img class="m68-environment" src="/assets/mountain-race/images/summit-world-v68.png" alt=""><div class="m68-trail"></div><div class="m68-climber"><div class="m68-sprite"></div></div><span class="m68-summit">SUMMIT</span><div class="m68-confetti" hidden>${Array.from({length:24},(_,j)=>`<i style="--i:${j}"></i>`).join('')}</div></div>`;root.querySelector('.m68-stage').append(lane);
   const world=lane.firstElementChild,trail=lane.querySelector('.m68-trail');
   const holds=Array.from({length:total},(_,j)=>{const hold=document.createElement('div');hold.className='m68-hold';hold.dataset.mrHoldIndex=j;hold.style.bottom=(base+(j+1)*step)+'px';hold.style.left=holdX(j+1)+'%';hold.style.setProperty('--rock',j%6);hold.innerHTML='<span class="m68-rock"></span><b></b>';hold.firstElementChild.style.backgroundPosition=`${j%3*50}% ${Math.floor(j%6/3)*100}%`;trail.append(hold);return hold;});
   lane.querySelector('.m68-summit').style.bottom=(summit+7)+'px';lane.querySelector('.m68-confetti').style.bottom=(summit+160)+'px';
   return {lane,world,card,holds,climber:lane.querySelector('.m68-climber'),sprite:lane.querySelector('.m68-sprite'),lastIndex:-1,lastInput:'',side};
  });
  const v={total,height,base,summit,step,lanes,overlay:'',resize:null};
  layouts.set(root,v);return v;
 }
 function holdX(index){return index===0?50:[43,57,47,59,41,52][(index-1)%6];}
 function camera(v,l,index){const y=v.base+index*v.step,view=l.lane.clientHeight;const distance=clamp(y-view*.25,0,v.height-view);l.world.style.transform=`translate3d(0,${distance}px,0)`;l.lane.dataset.camera=String(Math.round(distance));}
 function render(root,data){
  const {game,total,me,opponent,prompts,enabled,tone,status,overlays,seconds}=data;
  let v=layouts.get(root);if(!v||v.total!==total||!root.querySelector('.m68-game')){v=build(root,total);}
  delete root.dataset.mrApprovedScene;root.dataset.mrScene='68';root.querySelector('.m68-game').dataset.status=game.status;root.querySelector('[data-mr-clock]').textContent=seconds;
  for(const [i,p] of [me,opponent].entries()){
   const l=v.lanes[i],index=clamp(p.promptIndex,0,total),won=game.status==='complete'&&!game.mountainraceState.tie&&(i===0?game.mountainraceState.viewerWon:!game.mountainraceState.viewerWon);
   l.card.querySelector('strong').textContent=(i===0?'You · ':'')+p.name;l.card.querySelector('span').textContent=`${index} / ${total} holds`;l.card.querySelector('.m68-progress i').style.transform=`scaleX(${index/total})`;
   const slip=p.lastInput?.correct===false&&p.lastInput?.at!==l.lastInput;
   if(slip){l.climber.classList.remove('slipping');void l.climber.offsetWidth;l.climber.classList.add('slipping');}
   if(index!==l.lastIndex){l.climber.style.left=holdX(index)+'%';l.climber.style.bottom=(v.base+index*v.step)+'px';camera(v,l,index);l.lastIndex=index;}
   const pose=won?4:index===0?0:slip?3:(p.lastInput?.control==='left'?1:p.lastInput?.control==='right'?2:index%2+1);
   l.sprite.style.backgroundPosition=`${pose*25}% ${i*100}%`;l.climber.classList.toggle('celebrating',won);l.lane.querySelector('.m68-confetti').hidden=!won;
   l.lastInput=p.lastInput?.at||'';
   l.holds.forEach((hold,j)=>{hold.classList.toggle('current',j===index);hold.classList.toggle('passed',j<index);const show=i===0&&j>=index&&j<index+prompts.length;hold.querySelector('b').textContent=show?glyph[prompts[j-index]]:j<index?'✓':'';hold.hidden=j<index-3||j>index+4;});
  }
  const q=root.querySelector('.m68-queue'),key=prompts.join(':');if(q.dataset.key!==key){q.dataset.key=key;q.innerHTML=prompts.map((t,i)=>`<span class="${i===0?'next':''}">${glyph[t]}</span>`).join('');}
  root.querySelector('.m68-status').textContent=status;root.querySelector('.m68-status').dataset.tone=tone;
  root.querySelectorAll('[data-mr-network-input]').forEach(b=>{b.disabled=!enabled;b.dataset.mrDisplayedExpected=prompts[0]||'';b.dataset.mrDisplayedIndex=me.promptIndex;b.dataset.mrDisplayedRound=game.mountainraceState.roundId||'';});
  if(v.overlay!==overlays){v.overlay=overlays;root.querySelector('.m68-overlays').innerHTML=overlays;}
 }
 window.addEventListener('resize',()=>{for(const root of document.querySelectorAll('[data-mr-scene="68"]')){const v=layouts.get(root);if(v)for(const l of v.lanes)camera(v,l,Math.max(0,l.lastIndex));}});
 window.SummitSceneV68={render};
})();
