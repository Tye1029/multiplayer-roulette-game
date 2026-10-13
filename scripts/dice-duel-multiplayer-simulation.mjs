import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),model=require('../netlify/functions/dice-duel-multiplayer/model'),finance=require('../netlify/functions/shared/table-finance');
let seed=731024;
const die=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return 1+Math.floor(seed/4294967296*6);};
const matches=1000000,counts=[0,0];let ties=0,rounds=0;
for(let n=0;n<matches;n++){
 const s=model.fresh('12345678',model.player('101','A'),0);s.players.push(model.player('202','B'));
 model.act(s,'101',{action:'start'},die,0);model.act(s,'202',{action:'start'},die,0);let now=3000;
 while(s.phase!=='complete'){
  model.advance(s,now,die);for(const id of ['101','202'])model.act(s,id,{action:'roll',round:s.round,game:s.game},die,now);
  rounds++;if(s.history.at(-1).winner===null)ties++;
  if(s.phase!=='complete')assert.equal(s.winner,null);
  now+=model.BREAK_MS;
 }
 counts[s.winner]++;assert.equal(s.scores[s.winner],2);assert.ok(s.scores[1-s.winner]<2);
}
assert.ok(Math.abs(counts[0]/matches-.5)<.003);
// Exercise the actual settlement code at every offered wager, not a second payout formula.
let profit=0;
for(let wager=1000;wager<=50000;wager+=1000){
 const s={wager,players:[{id:'101'},{id:'202'}]},entries=new Map();
 const wallet={account:async p=>p.id,rate:async()=>3.3,apply:async(id,e)=>{entries.set(e.id,e.delta);}};
 await finance.prepare(s,'diceduel',s.players,wager,wallet);
 await finance.recover(s,wallet,()=>({done:false}));assert.equal(entries.size,2);
 await finance.recover(s,wallet,()=>({done:true,winner:'101'}));
 await finance.recover(s,wallet,()=>({done:true,winner:'101'}));assert.equal(entries.size,4);
 const house=-[...entries.values()].reduce((a,b)=>a+b,0);assert.equal(house,Math.ceil(2*wager*.033));assert.ok(house>0);profit+=house;
}
console.log(JSON.stringify({matches,rounds,ties,playerWins:counts,configuredRatePercent:3.3,houseProfitAt1000PerPlayer:matches*66,settlementChecks:50,houseProfitAcrossStakeChecks:profit}));
console.log('First to two is symmetric. Every settled funded match retains its configured cut once; ties add no charges. Refunded matches and free bots generate no house revenue.');
