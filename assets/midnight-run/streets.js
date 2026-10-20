/* MIDNIGHT_RUN_V3_CITY_RISK — cosmetic layout, independent of game odds and outcomes. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.MidnightRunStreets=factory();})(globalThis,()=>{
 'use strict';
 const lotHeight=360,lotWidth=252;
 function randomFor(id){
  let seed=2166136261;for(const ch of String(id))seed=Math.imul(seed^ch.charCodeAt(0),16777619);
  return ()=>{seed+=0x6D2B79F5;let n=seed;n=Math.imul(n^n>>>15,n|1);n^=n+Math.imul(n^n>>>7,n|61);return ((n^n>>>14)>>>0)/4294967296;};
 }
 function plan(id,count=128){
  const random=randomFor(id),pick=n=>Math.floor(random()*n),rows=[],previous=[null,null],lastNeon=[-1,-1];
  let nextNeon=pick(2);
  for(let row=0;row<count;row++){
   const neonSide=row===nextNeon?pick(2):-1;if(neonSide!==-1)nextNeon+=2+pick(2);
   rows.push([0,1].map(side=>{
    let image,section;
    if(side===neonSide){image=0;section=(lastNeon[side]+1+pick(2))%3;lastNeon[side]=section;}
    else{const options=[1,2,3].filter(n=>n!==previous[side]);image=options[pick(options.length)];section=pick(3);}
    previous[side]=image;return {image,section};
   }));
  }
  return rows;
 }
 return {plan,lotHeight,lotWidth};
});
