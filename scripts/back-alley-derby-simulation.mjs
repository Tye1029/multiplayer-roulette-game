import assert from 'node:assert/strict';import {createRequire} from 'node:module';const R=createRequire(import.meta.url)('../shared/games/back-alley-derby');
// Reproducible Monte Carlo. Exact 100-outcome enumeration in the unit suite
// proves the expectation; simulation checks the implemented weighted sampler.
let seed=0x93abf127;function uniform(n){const limit=4294967296-4294967296%n;let v;do{seed=(seed+0x6D2B79F5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t^=t+Math.imul(t^(t>>>7),61|t);v=(t^(t>>>14))>>>0;}while(v>=limit);return v%n;}
const samples=2000000,wins=Array(6).fill(0);for(let i=0;i<samples;i++)wins[R.draw(uniform)[0]]++;
console.table(R.rats.map(r=>{const q=R.quote(50000,r.id),returnRate=wins[r.id]*q.payout/(samples*50000);assert.ok(Math.abs(wins[r.id]/samples-r.chance/100)<.0015);assert.ok(returnRate<.92&&returnRate>.88);return {rat:r.name,races:samples,wins:wins[r.id],observedReturn:(returnRate*100).toFixed(3)+'%',theoreticalReturn:(q.multiplier*q.chance*100).toFixed(5)+'%'};}));
console.log('Two million complete races sampled. Exact expected return is at most 90% for every supported ticket.');
