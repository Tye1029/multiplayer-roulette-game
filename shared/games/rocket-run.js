/* ROCKET_RUN_V2 — display math shared with the authoritative flight server. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.RocketRunRules=factory();})(globalThis,()=>{
 'use strict';
 const build='ROCKET_RUN_V2',stakes=[50000,100000,500000,1000000,5000000,10000000],maxPayout=50000000,countdownMs=3000,growth=.12,range=4294967296;
 function cap(stake){if(!stakes.includes(stake))throw new RangeError('Invalid wager');return maxPayout/stake*100;}
 function validAuto(n,stake){return n===null||(Number.isInteger(n)&&n>=110&&n<=cap(stake));}
 function centsAt(elapsed){return Math.min(100000,Math.max(100,Math.floor(100*Math.exp(Math.max(0,elapsed)/1000*growth)+1e-8)));}
 const timeAt=cents=>Math.log(cents/100)/growth*1000;
 function payout(stake,cents){cap(stake);if(!Number.isInteger(cents)||cents<100)throw new RangeError('Invalid multiplier');return Math.min(maxPayout,Math.floor(stake*cents/100));}
 function crashFrom(n){if(!Number.isInteger(n)||n<0||n>=range)throw new RangeError('Invalid random draw');return Math.max(100,Math.floor(90*range/(n+1)));}
 // Crash wins ties. This exact probability includes rounding to hundredths.
 const survival=cents=>(Math.ceil(90*range/(cents+1))-1)/range;
 return {build,stakes,maxPayout,countdownMs,growth,range,cap,validAuto,centsAt,timeAt,payout,crashFrom,survival};
});
