/* MIDNIGHT_RUN_V3_CITY_RISK — shared display math; the server owns the route and clock. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.MidnightRunRules=factory();})(globalThis,()=>{
 'use strict';
 const build='MIDNIGHT_RUN_V3_CITY_RISK',stakes=[50000,100000,500000,1000000,5000000,10000000];
 const maxPayout=50000000,countdownMs=3000,blockMs=4500,returnPercent=90;
 const safePercent=[80,88,86,84,82,80,78,76,74,72,70,68,66,64,62,60,58,56,54,52,50,48,46,44];
 const difficulties=['normal','medium','high'];
 const labels={normal:'Normal',medium:'Medium',high:'High Risk'};
 const chances={normal:safePercent,medium:safePercent.map((n,i)=>n-(i===0?10:9)),high:safePercent.map((n,i)=>n-(i===0?20:18))};
 const validDifficulty=d=>difficulties.includes(d);
 function odds(difficulty='normal'){if(!validDifficulty(difficulty))throw new RangeError('Invalid difficulty');return chances[difficulty];}
 function ratio(block,difficulty='normal'){
  const safe=odds(difficulty);
  if(!Number.isInteger(block)||block<1||block>safePercent.length)throw new RangeError('Invalid block');
  let numerator=90n,denominator=100n;
  for(let i=0;i<block;i++){numerator*=100n;denominator*=BigInt(safe[i]);}
  return {numerator,denominator};
 }
 function payout(stake,block,difficulty='normal'){
  if(!stakes.includes(stake))throw new RangeError('Invalid wager');
  if(block===0)return 0;
  const r=ratio(block,difficulty);return Number((BigInt(stake)*r.numerator/r.denominator)>BigInt(maxPayout)?BigInt(maxPayout):BigInt(stake)*r.numerator/r.denominator);
 }
 const lastBlocks=new Map();
 function lastBlock(stake,difficulty='normal'){const key=stake+':'+difficulty;if(lastBlocks.has(key))return lastBlocks.get(key);for(let n=1;n<=safePercent.length;n++)if(payout(stake,n,difficulty)===maxPayout){lastBlocks.set(key,n);return n;}return safePercent.length;}
 const clearedAt=(elapsed)=>Math.max(0,Math.min(safePercent.length,Math.floor(Math.max(0,elapsed)/blockMs)));
 const survival=(block,difficulty='normal')=>odds(difficulty).slice(0,block).reduce((p,n)=>p*n/100,1);

 return {build,stakes,maxPayout,countdownMs,blockMs,returnPercent,safePercent,ratio,payout,lastBlock,clearedAt,survival,difficulties,labels,odds,validDifficulty};
});
