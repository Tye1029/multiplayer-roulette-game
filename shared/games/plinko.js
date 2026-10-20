/* PLINKO_V1 — one fair left/right decision at each peg row. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.PlinkoRules=factory();})(globalThis,()=>{
 const build='PLINKO_V1',rows=16,dropMs=3600,maxPayout=50000000,stakes=[10000,50000,100000,500000,1000000,5000000,10000000];
 // Hundredths of a multiplier, from an outer pocket through the center.
 const risks={low:{name:'Low',description:'Smaller swings. More modest returns.',half:[800,400,200,150,120,110,100,80,65]},medium:{name:'Medium',description:'A balance of steady drops and bigger prizes.',half:[10000,2500,1000,500,300,150,70,50,25]},high:{name:'High',description:'Small center returns. Rare, much larger edges.',half:[100000,13000,3000,800,300,100,50,30,10]}};
 const weights=Array.from({length:rows+1},(_,k)=>{let n=1;for(let i=1;i<=k;i++)n=n*(rows-i+1)/i;return n;});
 function table(risk){if(typeof risk!=='string'||!Object.hasOwn(risks,risk))throw new RangeError('Choose Low, Medium or High risk.');const a=risks[risk].half;return [...a,...a.slice(0,-1).reverse()];}
 function payout(stake,risk,bucket){if(!stakes.includes(stake)||!Number.isInteger(bucket)||bucket<0||bucket>rows)throw new RangeError('Invalid drop.');return Math.min(maxPayout,Number(BigInt(stake)*BigInt(table(risk)[bucket])/100n));}
 function multiplier(stake,risk,bucket){return payout(stake,risk,bucket)/stake;}
 function outcome(stake,risk,path){if(!Array.isArray(path)||path.length!==rows||path.some(n=>n!==0&&n!==1))throw new RangeError('Invalid ball path.');const bucket=path.reduce((a,b)=>a+b,0);return {path:[...path],bucket,payout:payout(stake,risk,bucket),multiplier:multiplier(stake,risk,bucket)};}
 function expectedReturn(stake,risk){return weights.reduce((sum,w,k)=>sum+w*payout(stake,risk,k),0)/(2**rows*stake);}
 return {build,rows,dropMs,maxPayout,stakes,risks,weights,table,payout,multiplier,outcome,expectedReturn};
});
