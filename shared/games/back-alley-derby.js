(function(root,factory){const rules=factory();if(typeof module==='object'&&module.exports)module.exports=rules;else root.BackAlleyDerbyRules=rules;})(typeof window==='object'?window:globalThis,()=>{
 'use strict';
 const build='BACK_ALLEY_DERBY_V2_RACE_DAY',countdownMs=1800,raceMs=11800,totalMs=countdownMs+raceMs;
 const stakes=Object.freeze([50000,100000,500000,1000000,5000000,10000000]);
 const rats=Object.freeze([
  {id:0,name:'Big Cheese',tag:'The favourite',chance:30,color:'#edbd62',bio:'Knows every shortcut in the alley.'},
  {id:1,name:'Drain Runner',tag:'Street smart',chance:24,color:'#67c7bd',bio:'Quick paws. Questionable intentions.'},
  {id:2,name:'Crumb Lord',tag:'Hungry for glory',chance:18,color:'#de8492',bio:'Will run a mile for a stale biscuit.'},
  {id:3,name:'Sewer Sam',tag:'Dark horse',chance:13,color:'#91a9e4',bio:'Never count out the quiet one.'},
  {id:4,name:'Miss Mischief',tag:'Trouble on four paws',chance:9,color:'#b5ce7c',bio:'Small rat. Absolutely no manners.'},
  {id:5,name:'Longshot Lou',tag:'Against the odds',chance:6,color:'#c19ada',bio:'One good sprint could change everything.'}
 ].map(Object.freeze));
 function quote(stake,rat){if(!stakes.includes(stake))throw Error('Choose an available wager.');if(!Number.isInteger(rat)||!rats[rat])throw Error('Choose one of the six racers.');const payout=Math.floor(stake*90/rats[rat].chance);return {payout,multiplier:payout/stake,chance:rats[rat].chance/100};}
 // Integer weighted draws: the first-place probabilities are exactly the
 // displayed percentages. Later places have no financial effect.
 function draw(random){const remaining=rats.map(r=>r.id),order=[];while(remaining.length){const total=remaining.reduce((n,id)=>n+rats[id].chance,0),roll=random(total);if(!Number.isInteger(roll)||roll<0||roll>=total)throw Error('Invalid random draw.');let at=roll,index=0;while(at>=rats[remaining[index]].chance)at-=rats[remaining[index++]].chance;order.push(remaining.splice(index,1)[0]);}return order;}
 function outcome(stake,rat,order){const q=quote(stake,rat);if(!Array.isArray(order)||order.length!==6||new Set(order).size!==6||order.some(id=>!Number.isInteger(id)||!rats[id]))throw Error('Invalid race result.');const win=order[0]===rat;return {rat,order:[...order],winner:order[0],outcome:win?'win':'loss',payout:win?q.payout:0,multiplier:win?q.multiplier:0};}
 return Object.freeze({build,countdownMs,raceMs,totalMs,stakes,rats,quote,draw,outcome,expectedReturn:.9});
});
