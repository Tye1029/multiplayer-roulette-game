import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),rules=require('../shared/games/midnight-run'),{draw}=require('../netlify/functions/midnight-run/database');
const rounds=Number(process.env.MIDNIGHT_SIM_ROUNDS||2000000),survived=Array(25).fill(0);
for(let n=0;n<rounds;n++){const caught=draw(50000,crypto.randomInt);for(let b=1;b<caught;b++)survived[b]++;}
const rows=[];
for(const stake of rules.stakes)for(let block=1;block<=rules.lastBlock(stake);block++){
 const payout=rules.payout(stake,block),expected=rules.survival(block)*payout/stake,observed=survived[block]/rounds*payout/stake;
 assert.ok(expected<=.900000001);assert.ok(payout<=50000000);
 rows.push({stake,block,payout,expectedReturn:expected,observedReturn:observed,escapes:survived[block]});
}
console.log(JSON.stringify({rounds,scenarios:rows.length,expectedReturnRange:[Math.min(...rows.map(r=>r.expectedReturn)),Math.max(...rows.map(r=>r.expectedReturn))],observedReturnRange:[Math.min(...rows.map(r=>r.observedReturn)),Math.max(...rows.map(r=>r.observedReturn))],sampledHouseLossScenarios:rows.filter(r=>r.observedReturn>1),rows},null,2));
