/* MINEFIELD_V1 — exact, shared display math; the server owns every board. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.MinefieldRules=factory();})(globalThis,()=>{
 const size=25,stakes=[50000,100000,500000,1000000,5000000,10000000];
 const validMines=n=>Number.isInteger(n)&&n>=1&&n<size;
 function ratio(mines,picks){
  if(!validMines(mines)||!Number.isInteger(picks)||picks<0||picks>size-mines)throw new RangeError('Invalid field');
  let numerator=96n,denominator=100n;
  for(let i=0;i<picks;i++){numerator*=BigInt(size-i);denominator*=BigInt(size-mines-i);}
  return {numerator,denominator};
 }
 function payout(stake,mines,picks){if(!stakes.includes(stake))throw new RangeError('Invalid stake');if(!picks)return 0;const r=ratio(mines,picks);return Number(BigInt(stake)*r.numerator/r.denominator);}
 function multiplier(mines,picks){if(!picks)return 1;const r=ratio(mines,picks);return Number(r.numerator)/Number(r.denominator);}
 return {size,stakes,validMines,ratio,payout,multiplier,returnPercent:96,build:'MINEFIELD_V1'};
});
