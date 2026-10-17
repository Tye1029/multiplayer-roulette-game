/* Cosmetic clock only: the server still owns arrivals, choices and payouts. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.MidnightRunMotion=factory();})(globalThis,()=>{
 'use strict';
 class Clock{
  constructor(){this.reset();}
  reset(){this.key='';this.anchor=0;this.legElapsed=0;}
  sample(game,stamp,serverLegElapsed){
   const duration=game.blockMs||4000,base=game.cleared*duration;
   if(game.status==='settled')return game.travelMs;
   if(game.phase==='corner'){this.legElapsed=0;return base;}
   const key=game.id+':'+game.cleared+':'+game.legStartedAt;
   if(key!==this.key){this.key=key;this.anchor=stamp-serverLegElapsed;}
   // Repeated polls may correct the server clock backwards or arrive late.
   // Once a leg starts, its camera advances on the browser's monotonic clock.
   this.legElapsed=stamp-this.anchor;
   return base+Math.max(0,Math.min(duration,this.legElapsed));
  }
 }
 return {Clock};
});
