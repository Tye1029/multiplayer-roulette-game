import {createRequire} from 'node:module';
import {randomInt} from 'node:crypto';
const require=createRequire(import.meta.url),rules=require('../shared/games/dice-duel');
const trials=1000000,counts={win:0,tie:0,loss:0};
for(let i=0;i<trials;i++)counts[rules.outcome(50000,Array.from({length:4},()=>randomInt(6)+1)).outcome]++;
console.log(JSON.stringify({rounds:trials,counts,exactReturnPercent:rules.expectedReturn*100,exactHouseEdgePercent:(1-rules.expectedReturn)*100,stakes:rules.stakes.map(stake=>{const totalStaked=trials*stake,totalReturned=counts.win*stake*1.8+counts.tie*stake;return {stake,totalStaked,totalReturned,houseProfit:totalStaked-totalReturned,returnPercent:totalReturned/totalStaked*100};})},null,2));
if(counts.win*1.8+counts.tie>=trials)throw Error('Simulation did not produce a house profit.');
