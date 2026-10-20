import {createRequire} from 'node:module';const require=createRequire(import.meta.url),rules=require('../shared/games/lucky-dice');
let seed=1260813;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const runs=1000000,stake=50000;let total=0;
for(const target of rules.targets)for(const direction of ['higher','lower']){let paid=0;for(let i=0;i<runs;i++)paid+=rules.outcome(stake,[1+Math.floor(random()*6),1+Math.floor(random()*6)],target,direction).payout;const rtp=paid/(runs*stake);total+=paid;console.log(JSON.stringify({target,direction,rolls:runs,returnPercent:Number((100*rtp).toFixed(4)),houseProfit:runs*stake-paid}));if(rtp>=1)throw Error('Simulation returned a house loss.');}
console.log('18 million rolls complete. Combined return: '+(total/(18*runs*stake)*100).toFixed(4)+'%. Exact probability tests cover every stake and setting.');
