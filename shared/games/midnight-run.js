/* MIDNIGHT_RUN_V1 — shared display math; the server owns the route and clock. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.MidnightRunRules=factory();})(globalThis,()=>{
 'use strict';
 const build='MIDNIGHT_RUN_V1',stakes=[50000,100000,500000,1000000,5000000,10000000];
 const maxPayout=50000000,countdownMs=3000,blockMs=4500,returnPercent=90;
 const safePercent=[80,88,86,84,82,80,78,76,74,72,70,68,66,64,62,60,58,56,54,52,50,48,46,44];
 function ratio(block){
  if(!Number.isInteger(block)||block<1||block>safePercent.length)throw new RangeError('Invalid block');
  let numerator=90n,denominator=100n;
  for(let i=0;i<block;i++){numerator*=100n;denominator*=BigInt(safePercent[i]);}
  return {numerator,denominator};
 }
 function payout(stake,block){
  if(!stakes.includes(stake))throw new RangeError('Invalid wager');
  if(block===0)return 0;
  const r=ratio(block);return Number((BigInt(stake)*r.numerator/r.denominator)>BigInt(maxPayout)?BigInt(maxPayout):BigInt(stake)*r.numerator/r.denominator);
 }
 const lastBlocks=new Map();
 function lastBlock(stake){if(lastBlocks.has(stake))return lastBlocks.get(stake);for(let n=1;n<=safePercent.length;n++)if(payout(stake,n)===maxPayout){lastBlocks.set(stake,n);return n;}return safePercent.length;}
 const validAuto=(n,stake)=>n===null||(Number.isInteger(n)&&n>=1&&n<=lastBlock(stake));
 const clearedAt=(elapsed)=>Math.max(0,Math.min(safePercent.length,Math.floor(Math.max(0,elapsed)/blockMs)));
 const survival=block=>safePercent.slice(0,block).reduce((p,n)=>p*n/100,1);
 const district=block=>['OLD QUARTER','DOCKSIDE','MARKET ROW'][Math.floor(Math.max(0,block)/3)%3];
 return {build,stakes,maxPayout,countdownMs,blockMs,returnPercent,safePercent,ratio,payout,lastBlock,validAuto,clearedAt,survival,district};
});
