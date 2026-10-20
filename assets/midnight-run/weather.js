/* Cosmetic weather is independent of run outcomes, difficulty and payout state. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.MidnightRunWeather=factory();})(globalThis,()=>{
 'use strict';
 class Storm{
  constructor(random=Math.random){this.random=random;this.reset();}
  reset(){this.next=0;this.flashAt=-Infinity;this.thunderAt=Infinity;this.flashes=0;}
  sample(now,enabled=true,reduced=false){
   if(!enabled){this.next=0;this.flashAt=-Infinity;this.thunderAt=Infinity;return {light:0,thunder:false};}
   if(!this.next)this.next=now+12000+this.random()*10000;
   if(now>=this.next){this.flashAt=now;this.thunderAt=now+1000+this.random()*1400;this.next=now+24000+this.random()*22000;this.flashes++;}
   const age=now-this.flashAt;
   // One softened flash fading across a second; never a rapid strobe.
   const light=!reduced&&age>=0&&age<1000?.18*Math.min(1,age/70)*Math.pow(1-age/1000,2):0;
   const thunder=now>=this.thunderAt;if(thunder)this.thunderAt=Infinity;
   return {light,thunder};
  }
 }
 return {Storm};
});
