/* Two seats share the four-player cast; gameplay remains server-owned. */
import {createCharacterRig} from '../roulette-four/character-rig.mjs';
import {screenCrack} from './screen-effects.mjs';
window.RouletteScreenCrack=screenCrack;
import {CAST} from '../roulette-four/cast.mjs';
let queued=false;const actors=new Map();const reduce=matchMedia('(prefers-reduced-motion: reduce)');
function mount(){
 queued=false;
 for(const scene of document.querySelectorAll('[data-roulette-game]')){
  if(!scene.querySelector('.rr-duel-cast')){
   const layer=document.createElement('div');layer.className='rr-duel-cast';layer.setAttribute('aria-hidden','true');
   for(let i=0;i<2;i++){
    const c=CAST[i],seat=document.createElement('div');seat.className='rr-duel-seat '+(i?'right':'left');
    seat.style.cssText=`--cast:url('${c.art}');--cast-x:${c.col*100}%;--cast-y:${c.row/(c.rows-1)*100}%;--cast-rows:${c.rows*100}%;--screen-x:${c.screen[0]}%;--screen-y:${c.screen[1]}%;--screen-w:${c.screen[2]}%;--screen-h:${c.screen[3]}%`;
    seat.innerHTML='<div class="rr-duel-person"></div><canvas class="character-canvas"></canvas><div class="head-motion"><div class="rr-duel-tv"></div></div>';layer.append(seat);
   }
   scene.append(layer);layer.querySelectorAll('.rr-duel-seat').forEach((seat,i)=>actors.set(seat,{rig:createCharacterRig(seat,CAST[i]),next:performance.now()+3000+i*2000}));
  }
  const players=scene.querySelectorAll('.rr-top .rr-player');scene.querySelectorAll('.rr-duel-seat').forEach((seat,i)=>{seat.classList.toggle('active',players[i]?.classList.contains('active'));const avatar=players[i]?.querySelector('img');if(avatar&&seat.querySelector('.rr-duel-tv').dataset.src!==avatar.src){const tv=seat.querySelector('.rr-duel-tv');tv.dataset.src=avatar.src;const img=document.createElement('img');img.src=avatar.src;img.alt='';tv.replaceChildren(img);}});
 }
}
const host=document.getElementById('duelActive');if(host)new MutationObserver(()=>{if(!queued){queued=true;requestAnimationFrame(mount);}}).observe(host,{childList:true,subtree:true});mount();

function animate(now){for(const [seat,a] of actors){if(!seat.isConnected){a.rig.destroy();actors.delete(seat);continue;}if(document.hidden||reduce.matches)continue;if(now>a.next){a.rig.play(['glance','foot-tap','neck-stretch','scratch'][Math.floor(Math.random()*4)],2600,now);a.next=now+6000+Math.random()*5000;}a.rig.update(now);}requestAnimationFrame(animate);}requestAnimationFrame(animate);
