import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),rules=require('../shared/games/midnight-run'),{draw}=require('../netlify/functions/midnight-run/database');
const rounds=Number(process.env.MIDNIGHT_SIM_ROUNDS||2000000),rows=[];
assert.ok(Number.isSafeInteger(rounds)&&rounds>0,'Use a positive whole number of routes');
for(const difficulty of rules.difficulties){
 const survived=Array(25).fill(0);
 for(let n=0;n<rounds;n++){const caught=draw(50000,crypto.randomInt,difficulty);for(let b=1;b<caught;b++)survived[b]++;}
 for(const stake of rules.stakes)for(let block=1;block<=rules.lastBlock(stake,difficulty);block++){
 const payout=rules.payout(stake,block,difficulty),expected=rules.survival(block,difficulty)*payout/stake,observed=survived[block]/rounds*payout/stake;
 assert.ok(expected<=.900000001);assert.ok(payout<=50000000);
 rows.push({difficulty,stake,block,payout,expectedReturn:expected,observedReturn:observed,escapes:survived[block]});
 }
}
const difficulties=rules.difficulties.map(difficulty=>{
 const cases=rows.filter(r=>r.difficulty===difficulty),bestAdaptiveReturn=Math.max(...rules.stakes.map(stake=>{
  const last=rules.lastBlock(stake,difficulty);let best=rules.payout(stake,last,difficulty);
  for(let block=last-1;block>=1;block--)best=Math.max(rules.payout(stake,block,difficulty),rules.odds(difficulty)[block]/100*best);
  return best*rules.odds(difficulty)[0]/100/stake;
 }));
 assert.ok(bestAdaptiveReturn<=.90000000001);
 return {difficulty,label:rules.labels[difficulty],scenarios:cases.length,bestAdaptiveReturn,minimumExpectedHouseEdge:1-bestAdaptiveReturn,observedReturnRange:[Math.min(...cases.map(r=>r.observedReturn)),Math.max(...cases.map(r=>r.observedReturn))]};
});
console.log(JSON.stringify({build:rules.build,roundsPerDifficulty:rounds,totalRounds:rounds*rules.difficulties.length,scenarios:rows.length,difficulties,expectedReturnRange:[Math.min(...rows.map(r=>r.expectedReturn)),Math.max(...rows.map(r=>r.expectedReturn))],observedReturnRange:[Math.min(...rows.map(r=>r.observedReturn)),Math.max(...rows.map(r=>r.observedReturn))],sampledHouseLossScenarios:rows.filter(r=>r.observedReturn>1),rows},null,2));
