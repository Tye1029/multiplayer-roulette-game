/* DICE_V2 — six actual pip faces, deterministic landing, cancellable rolls. */
(() => {
 'use strict';
 const pips=[[],[4],[0,8],[0,4,8],[0,2,6,8],[0,2,4,6,8],[0,2,3,5,6,8]],poses=[[0,0],[0,0],[-90,0],[0,-90],[0,90],[90,0],[0,180]];
 const rotation=(face,tilt=true)=>{const [x,y]=poses[face];return `rotateX(${tilt?-12:0}deg) rotateY(${tilt?-15:0}deg) rotateX(${x}deg) rotateY(${y}deg)`;};
 function die(dark=false){
  const slot=document.createElement('div');slot.className='dd-die-slot'+(dark?' dd-die-dark':'');slot.setAttribute('role','img');slot.setAttribute('aria-label','Die ready to roll');
  slot.innerHTML='<div class="dd-die-shadow"></div><div class="dd-die-throw"><div class="dd-die-cube">'+[1,2,3,4,5,6].map(n=>'<div class="dd-face" aria-hidden="true">'+Array.from({length:9},(_,i)=>'<i class="dd-pip'+(pips[n].includes(i)?'':' empty')+'"></i>').join('')+'</div>').join('')+'</div></div>';
  return slot;
 }
 class DiceTable{
  constructor(player,house){this.dice=house?[die(),die(),die(true),die(true)]:[die(),die()];player.append(...this.dice.slice(0,2));house?.append(...this.dice.slice(2));this.animations=new Set();this.timers=new Map();this.run=0;this.reduced=matchMedia('(prefers-reduced-motion:reduce)');this.show([3,5,2,4],false);}
  show(values,known=true){this.dice.forEach((slot,i)=>{slot.querySelector('.dd-die-cube').style.transform=rotation(values[i]);slot.querySelector('.dd-die-throw').style.transform='none';slot.setAttribute('aria-label',known?'Die showing '+values[i]:'Die ready to roll');slot.dataset.value=known?values[i]:'';slot.dataset.lastFace=values[i];});}
  wait(ms){return new Promise(resolve=>{const id=setTimeout(()=>{this.timers.delete(id);resolve(true);},ms);this.timers.set(id,resolve);});}
  motion(element,frames,options){const a=element.animate(frames,{...options,fill:'both'});this.animations.add(a);return a;}
  prepare(){this.stop();if(this.reduced.matches)return;for(const [i,slot] of this.dice.entries())this.motion(slot.querySelector('.dd-die-throw'),[{transform:'translateY(0)'},{transform:'translateY(-5px)',offset:.5},{transform:'translateY(0)'}],{duration:700,delay:i*75,iterations:Infinity,easing:'ease-in-out'});}
  async roll(values,audio,onLanded){
   this.stop();const run=this.run,reduced=this.reduced.matches;
   for(const slot of this.dice){slot.setAttribute('aria-label','Die rolling');slot.dataset.value='';}
   await Promise.race([audio.ready?.()||Promise.resolve(),this.wait(450)]);
   if(run!==this.run)return false;
   audio.roll();
   const rolls=this.dice.map(async(slot,i)=>{
    const [rx,ry]=poses[values[i]],delay=reduced?0:i*90+(i>1?180:0),duration=reduced?240:2050+i*95;
    const cube=slot.querySelector('.dd-die-cube'),carrier=slot.querySelector('.dd-die-throw'),shadow=slot.querySelector('.dd-die-shadow');
    if(!reduced){
     const before=poses[Number(slot.dataset.lastFace)||3],side=i<2?-1:1;
     // Sample a continuous deceleration curve. Every frame has the same transform
     // order, so the browser interpolates angles without snapping at bounce points.
     const turns=Array.from({length:91},(_,n)=>{const t=n/90,u=1-Math.pow(1-t,3);return {offset:t,transform:`rotateX(-12deg) rotateY(-15deg) rotateX(${before[0]+(rx+720-before[0])*u}deg) rotateY(${before[1]+(ry+720-before[1])*u}deg)`};});
     const travel=Array.from({length:91},(_,n)=>{const t=n/90;return {offset:t,transform:`translate(${side*55*Math.sin(t*Math.PI)*(1-t)}px,${-Math.abs(Math.sin(t*Math.PI*3))*55*Math.pow(1-t,1.5)}px)`};});
     this.motion(cube,turns,{duration,delay,easing:'linear'});
     this.motion(carrier,travel,{duration,delay,easing:'linear'});
     this.motion(shadow,[{opacity:.65,transform:'scale(.9)'},{opacity:.4,transform:'scale(.75)',offset:.2},{opacity:1,transform:'scale(1.08)'}],{duration,delay});
    }else this.motion(cube,[{opacity:.45},{opacity:1}],{duration});
    if(!await this.wait(delay+duration)||run!==this.run)return;
    cube.style.transform=rotation(values[i]);slot.dataset.value=String(values[i]);slot.setAttribute('aria-label','Die showing '+values[i]);audio.land(i);
    if(i===1)onLanded('player');if(i===3)onLanded('house');
   });
   await Promise.all(rolls);if(run!==this.run)return false;
   if(!await this.wait(reduced?100:430)||run!==this.run)return false;
   this.clearAnimations();this.show(values);return true;
  }
  clearAnimations(){for(const a of this.animations)a.cancel();this.animations.clear();}
  stop(){this.run++;this.clearAnimations();for(const [id,resolve] of this.timers){clearTimeout(id);resolve(false);}this.timers.clear();}
 }
 window.DiceDuelTable=DiceTable;window.DiceDuelDie=die;
})();
