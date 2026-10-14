(function(root,factory){const motion=factory();if(typeof module==='object'&&module.exports)module.exports=motion;else root.DerbyMotion=motion;})(typeof window==='object'?window:globalThis,()=>{
 'use strict';
 const clamp=n=>Math.max(0,Math.min(1,n));
 function hash(text){let n=2166136261;for(const c of String(text))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;}
 // Positive derivative throughout: no teleports, backwards steps or pauses at
 // curve boundaries. Every rat crosses once, in the saved finish order.
 function position(id,order,seed,elapsed){const rank=order.indexOf(id),h=hash(seed+':'+id),finish=10000+rank*270+(h%120),t=clamp(elapsed/finish),phase=(h%628)/100;
  return clamp(t+Math.sin(Math.PI*t)*(.035*Math.sin(t*6+phase)+.015*Math.sin(t*12+phase*1.7)));
 }
 return {position,hash};
});
