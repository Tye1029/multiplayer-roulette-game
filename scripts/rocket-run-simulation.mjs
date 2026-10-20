import {createRequire} from 'node:module';
import {randomInt} from 'node:crypto';
const require=createRequire(import.meta.url),rules=require('../shared/games/rocket-run');
const samples=2000000,targets=[100,110,125,150,200,300,500,1000,2000,5000,10000,25000,50000,100000],wins=targets.map(()=>0);
for(let i=0;i<samples;i++){const crash=rules.crashFrom(randomInt(rules.range));for(let k=0;k<targets.length;k++)if(crash>targets[k])wins[k]++;}
console.log(JSON.stringify({build:rules.build,samples,note:'Independent crypto-random flights. Target scenarios share draws. Exact expectation, not any finite sample, establishes the house advantage.',targets:targets.map((c,i)=>({multiplier:c/100,exactReturn:rules.survival(c)*c/100,simulatedReturn:wins[i]/samples*c/100,wins:wins[i]}))},null,2));
