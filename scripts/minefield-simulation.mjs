import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomInt,createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Offline only: uses the real board generator and payouts, never a wallet/API.
const require=createRequire(import.meta.url),rules=require('../shared/games/minefield');
const {draw}=require('../netlify/functions/minefield/database');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function argument(name,fallback){const i=process.argv.indexOf(name);return i<0?fallback:process.argv[i+1];}
const rounds=Number(argument('--rounds','1000000'));
assert.ok(Number.isSafeInteger(rounds)&&rounds>=1000&&rounds<=100000000,'--rounds must be 1,000–100,000,000 per mine count');
const destination=argument('--out',null),started=Date.now();
const choose=(n,k)=>{if(n<k||k<0)return 0n;let result=1n;for(let i=1;i<=k;i++)result=result*BigInt(n-i+1)/BigInt(i);return result;};
const gcd=(a,b)=>b?gcd(b,a%b):a;
function fraction(n,d=1n){const g=gcd(n,d);return {n:n/g,d:d/g};}
const times=(r,n,d)=>fraction(r.n*BigInt(n),r.d*BigInt(d));
const less=(a,b)=>a.n*b.d<b.n*a.d;
const rate=(n,d)=>Number(n)/Number(d);
const pct=(n,d)=>100*rate(n,d);
function money(handle,paid){return {wageredChips:handle.toString(),returnedChips:paid.toString(),houseProfitChips:(handle-paid).toString(),observedHouseMarginPercent:pct(handle-paid,handle)};}
function interval(successes,trials){ // Approximate 95% Wilson interval, including zero rare wins.
 const z=1.959963984540054,p=successes/trials,a=1+z*z/trials,center=(p+z*z/(2*trials))/a;
 const radius=z*Math.sqrt(p*(1-p)/trials+z*z/(4*trials*trials))/a;
 return [Math.max(0,center-radius),Math.min(1,center+radius)];
}
function optimalReturn(stake,mines,percent){
 const safe=rules.size-mines;let best=fraction(BigInt(rules.payout(stake,mines,safe,percent)));
 for(let k=safe-1;k>=1;k--){const take=fraction(BigInt(rules.payout(stake,mines,k,percent))),continuePlaying=times(best,safe-k,rules.size-k);best=less(take,continuePlaying)?continuePlaying:take;}
 return times(best,safe,rules.size);
}
function exactAudit(counts,percent){
 const rows=[];
 for(const mines of counts){const population=choose(rules.size,mines),safe=rules.size-mines;
  for(const stake of rules.stakes){
   const optimum=optimalReturn(stake,mines,percent);
   assert.ok(optimum.n*100n<=BigInt(stake*percent)*optimum.d,'An adaptive cash-out rule improves the advertised return');
   for(let picks=1;picks<=safe;picks++){
    const survivingBoards=choose(rules.size-picks,mines),payout=rules.payout(stake,mines,picks,percent);
    assert.ok(Number.isSafeInteger(payout));
    const expectation=BigInt(payout)*survivingBoards,ceiling=BigInt(stake*percent)*population;
    assert.ok(expectation*100n<=ceiling,'House margin below target');
    assert.ok(ceiling-expectation*100n<100n*survivingBoards,'Payout differs from the independently calculated odds by more than rounding');
    rows.push({mines,stake,picks,payout,survivalProbability:rate(survivingBoards,population),survivingBoards:survivingBoards.toString(),possibleBoards:population.toString(),expectedHouseMarginPercent:pct(BigInt(stake)*population-expectation,BigInt(stake)*population),bestAdaptiveHouseMarginPercent:100*(1-rate(optimum.n,optimum.d)/stake)});
   }
  }
 }
 return rows;
}
const exact=exactAudit(rules.mineCounts,rules.returnPercent),legacy=exactAudit(Array.from({length:24},(_,i)=>i+1),96);
console.log(`Exact checks passed: ${exact.length} current combinations, ${legacy.length} legacy combinations; optimal cash-out decisions preserve the house edge.`);
const fixed=[],strategies=[],groups=[];
function aggregate(histogram,stake,mines){let paid=0n;for(let k=1;k<histogram.length;k++)paid+=BigInt(histogram[k])*BigInt(rules.payout(stake,mines,k));return money(BigInt(rounds)*BigInt(stake),paid);}
for(const mines of rules.mineCounts){
 const safe=rules.size-mines,prefixes=Array(safe+1).fill(0),reversePrefixes=Array(safe+1).fill(0),positions=Array(rules.size).fill(0);
 const uniform=Array(safe+1).fill(0),geometric=Array(safe+1).fill(0),chasingWagers=rules.stakes.map(()=>0),chasingWins=rules.stakes.map(()=>0);
 const doubleTarget=Array.from({length:safe},(_,i)=>i+1).find(k=>rules.multiplier(mines,k)>=2);
 let wagerIndex=0;
 for(let round=0;round<rounds;round++){
  const board=draw(mines),prefix=board[0],reverse=rules.size-1-board.at(-1);
  prefixes[prefix]++;reversePrefixes[reverse]++;for(const tile of board)positions[tile]++;
  const uniformTarget=randomInt(1,safe+1);uniform[uniformTarget<=prefix?uniformTarget:0]++;
  let bits=randomInt(2**(safe-1)),geometricTarget=1;
  while(geometricTarget<safe&&(bits&1)){geometricTarget++;bits>>>=1;}
  geometric[geometricTarget<=prefix?geometricTarget:0]++;
  // Reset wager after a win; move to the next allowed stake after a loss.
  chasingWagers[wagerIndex]++;
  if(prefix>=doubleTarget){chasingWins[wagerIndex]++;wagerIndex=0;}else wagerIndex=Math.min(wagerIndex+1,rules.stakes.length-1);
  if((round+1)%1000000===0)console.log(`${mines} mines: ${(round+1).toLocaleString('en-US')} unique boards sampled`);
 }
 assert.equal(prefixes.reduce((a,b)=>a+b,0),rounds);assert.equal(positions.reduce((a,b)=>a+b,0),rounds*mines);
 const wins=Array(safe+1).fill(0),reverseWins=Array(safe+1).fill(0);
 for(let k=safe;k>=1;k--){wins[k]=prefixes[k]+(wins[k+1]||0);reverseWins[k]=reversePrefixes[k]+(reverseWins[k+1]||0);}
 for(const stake of rules.stakes){
  for(const row of exact.filter(r=>r.mines===mines&&r.stake===stake)){
   const [low,high]=interval(wins[row.picks],rounds),handle=BigInt(rounds)*BigInt(stake),paid=BigInt(wins[row.picks])*BigInt(row.payout);
   fixed.push({...row,rounds,wins:wins[row.picks],reverseOrderWins:reverseWins[row.picks],...money(handle,paid),samplingMarginLowPercent:100*(1-high*row.payout/stake),samplingMarginHighPercent:100*(1-low*row.payout/stake)});
  }
  strategies.push({mines,stake,strategy:'uniform random cash-out depth',rounds,...aggregate(uniform,stake,mines)});
  strategies.push({mines,stake,strategy:'50% chance to stop after each safe pick',rounds,...aggregate(geometric,stake,mines)});
 }
 let chaseHandle=0n,chasePaid=0n;
 for(let i=0;i<rules.stakes.length;i++){chaseHandle+=BigInt(chasingWagers[i])*BigInt(rules.stakes[i]);chasePaid+=BigInt(chasingWins[i])*BigInt(rules.payout(rules.stakes[i],mines,doubleTarget));}
 const chase={mines,strategy:'raise wager after loss; reset after win; cash out at first >=2x',rounds,picks:doubleTarget,wagersByStake:chasingWagers,winsByStake:chasingWins,...money(chaseHandle,chasePaid)};strategies.push(chase);
 const first=fixed.find(r=>r.mines===mines&&r.stake===50000&&r.picks===1),three=fixed.find(r=>r.mines===mines&&r.stake===50000&&r.picks===3),clear=fixed.find(r=>r.mines===mines&&r.stake===50000&&r.picks===safe);
 groups.push({mines,rounds,prefixHistogram:prefixes,reversePrefixHistogram:reversePrefixes,mineCountsByPosition:positions,firstPickMarginPercent:first.observedHouseMarginPercent,threePickMarginPercent:three.observedHouseMarginPercent,fullClearMarginPercent:clear.observedHouseMarginPercent,fullClearWins:clear.wins,fullClearExpectedWins:rounds*clear.survivalProbability,fullClearSamplingMarginInterval95:[clear.samplingMarginLowPercent,clear.samplingMarginHighPercent],lossChasingMarginPercent:chase.observedHouseMarginPercent});
 console.log(`${mines} mines done: first-pick edge ${first.observedHouseMarginPercent.toFixed(4)}%, three-pick ${three.observedHouseMarginPercent.toFixed(4)}%, full-clear wins ${clear.wins} (expected ${(rounds*clear.survivalProbability).toFixed(3)})`);
}
const max=exact.reduce((a,b)=>a.payout>b.payout?a:b),hash=p=>createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const summary={
 game:'Minefield V2',createdAt:new Date().toISOString(),runtime:process.version,seconds:(Date.now()-started)/1000,
 rulesSha256:hash('shared/games/minefield.js'),boardGeneratorSha256:hash('netlify/functions/minefield/database.js'),
 uniqueRandomBoards:rounds*rules.mineCounts.length,roundsPerMineCount:rounds,mineCounts:rules.mineCounts,stakes:rules.stakes,
 fixedCombinations:fixed.length,additionalStrategyCombinations:strategies.length,exactCurrentCombinations:exact.length,exactLegacyCombinations:legacy.length,
 expectedHouseMarginRangePercent:[Math.min(...exact.map(r=>r.expectedHouseMarginPercent)),Math.max(...exact.map(r=>r.expectedHouseMarginPercent))],
 legacyExpectedHouseMarginRangePercent:[Math.min(...legacy.map(r=>r.expectedHouseMarginPercent)),Math.max(...legacy.map(r=>r.expectedHouseMarginPercent))],
 maxPayout:max,groups,strategies,
 interpretation:[
  'Production crypto.randomInt board draws and production whole-chip payouts, evaluated offline; no wallet calls or real player chips.',
  'Each unique board evaluates all fixed stopping depths and wagers. These scenarios share randomness; the number of unique boards is not multiplied by the number of scenarios.',
  'All six wagers use the same board samples. Stake does not change win probability. Totals use BigInt; JSON chip amounts are exact decimal strings.',
  'Independent combinatorial probabilities and backwards optimal-stopping calculations verify all current and legacy payout combinations.',
  'Exact checks establish positive expected house profit, not guaranteed profit over any finite number of rounds.',
  'Rare full clears can dominate losses. Simulation estimates with only a few full-clear wins are not reliable estimates of the long-run margin.',
  'The 95% Wilson intervals describe individual fixed-depth samples; they are approximate, not simultaneous guarantees across all rows.',
  'No bonus, achievement, deposit, other game, or real-money cost is included. This audit covers Minefield wagers and payouts only.'
 ]
};
function csv(rows){const fields=Object.keys(rows[0]);return fields.join(',')+'\n'+rows.map(row=>fields.map(k=>{const v=String(row[k]??'');return /[",\r\n]/.test(v)?'"'+v.replaceAll('"','""')+'"':v;}).join(',')).join('\n')+'\n';}
if(destination){fs.mkdirSync(destination,{recursive:true});fs.writeFileSync(path.join(destination,'summary.json'),JSON.stringify(summary,null,2)+'\n');fs.writeFileSync(path.join(destination,'fixed-cashouts.csv'),csv(fixed));fs.writeFileSync(path.join(destination,'mixed-strategies.csv'),csv(strategies.map(({wagersByStake,winsByStake,...row})=>row)));console.log('Results saved to '+path.resolve(destination));}
console.log(JSON.stringify({uniqueRandomBoards:summary.uniqueRandomBoards,exactCombinations:exact.length,expectedHouseMarginRangePercent:summary.expectedHouseMarginRangePercent,maxPayout:max,groups:groups.map(({prefixHistogram,reversePrefixHistogram,mineCountsByPosition,...row})=>row)},null,2));
