/* MINEFIELD_V3 — exact, shared display math; the server owns every board. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.MinefieldRules=factory();})(globalThis,()=>{
 const size=25,stakes=[10000,50000,100000,500000,1000000,5000000,10000000],mineCounts=[3,6,9,12,15],returnPercent=90,maxPayout=50000000;
 const validMines=n=>mineCounts.includes(n);
 function ratio(mines,picks,percent=returnPercent){
  // Legacy fields may contain any 1–24 mine layout at their original 96% return.
  if(!Number.isInteger(mines)||mines<1||mines>=size||!Number.isInteger(picks)||picks<0||picks>size-mines||![90,96].includes(percent))throw new RangeError('Invalid field');
  let numerator=BigInt(percent),denominator=100n;
  for(let i=0;i<picks;i++){numerator*=BigInt(size-i);denominator*=BigInt(size-mines-i);}
  return {numerator,denominator};
 }
 // An explicit null limit is reserved for fields purchased before V3.
 function payout(stake,mines,picks,percent=returnPercent,limit=maxPayout){if(!stakes.includes(stake))throw new RangeError('Invalid stake');if(limit!==null&&(!Number.isSafeInteger(limit)||limit<stake))throw new RangeError('Invalid payout limit');const r=ratio(mines,picks,percent),amount=picks?Number(BigInt(stake)*r.numerator/r.denominator):0;return limit===null?amount:Math.min(amount,limit);}
 function multiplier(mines,picks,percent=returnPercent){const r=ratio(mines,picks,percent);return picks?Number(r.numerator)/Number(r.denominator):1;}
 function payoutMultiplier(stake,mines,picks,percent=returnPercent,limit=maxPayout){return picks?payout(stake,mines,picks,percent,limit)/stake:1;}
 function atLimit(stake,mines,picks,percent=returnPercent,limit=maxPayout){return limit!==null&&payout(stake,mines,picks,percent,limit)===limit;}
 function lastPick(stake,mines,percent=returnPercent,limit=maxPayout){const safe=size-mines;for(let k=1;k<=safe;k++)if(atLimit(stake,mines,k,percent,limit))return k;return safe;}
 return {size,stakes,mineCounts,validMines,ratio,payout,multiplier,payoutMultiplier,atLimit,lastPick,returnPercent,maxPayout,build:'MINEFIELD_V3'};
});
