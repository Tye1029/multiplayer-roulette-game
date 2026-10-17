'use strict';
const modes=['scratch','junction','minefield','plinko','rocket','luckydice','midnight','derby'];
function summarize(entries=[]){
 const stats=Object.fromEntries(modes.map(mode=>[mode,{games:0,wins:0,losses:0,draws:0,wagered:0,returned:0,net:0,bestReturn:0,activeDays:0,qualifyingGames:0}])),rounds=new Map(),days=Object.fromEntries(modes.map(mode=>[mode,new Set()]));
 for(const entry of entries){
  const match=/^(scratch|junction|minefield|plinko|rocket|luckydice|midnight|derby):([A-F0-9]{12}):(stake|payout|refund):([1-9]\d*)$/.exec(entry.id||'');
  if(!match||!Number.isSafeInteger(entry.delta))continue;
  const key=match[1]+':'+match[2]+':'+match[4],r=rounds.get(key)||{mode:match[1]};r[match[3]]=entry.delta;if(match[3]==='payout')r.at=entry.at;rounds.set(key,r);
 }
 for(const r of rounds.values()){
  if(!(r.stake<0)||!(r.payout>=0)||r.refund!==undefined)continue;
  const s=stats[r.mode],stake=-r.stake;s.games++;s.wagered+=stake;s.returned+=r.payout;s.net+=r.payout-stake;s.bestReturn=Math.max(s.bestReturn,r.payout);
  if(r.payout>stake)s.wins++;else if(r.payout<stake)s.losses++;else s.draws++;
  // Keep older, smaller paid rounds in lifetime statistics without letting
  // them qualify for the new funded achievement catalog.
  if(stake>=10000){s.qualifyingGames++;const at=Date.parse(r.at);if(Number.isFinite(at)&&at<=Date.now()){days[r.mode].add(new Date(at).toISOString().slice(0,10));s.activeDays=days[r.mode].size;}}
 }
 return stats;
}
// Server-only objectives. No thresholds or descriptions are sent to browsers.
// Every reward tier is funded by substantial settled play, with UTC-day gates.
function catalog(mode){if(!modes.includes(mode))return [];const names={scratch:'Scratch',junction:'Junction',minefield:'Diamond',plinko:'Pegboard',rocket:'Orbit',luckydice:'Dice',midnight:'Midnight',derby:'Gutter Lane'};
 const titles=['Regular','Contender','Specialist','Veteran','Expert','Master','Champion','Legend','Icon','Royalty','Immortal','All-Time Great'];
 return [25,100,250,500,1000,2500,5000,10000,20000,35000,50000,100000].map((target,i)=>({id:'career-'+(i+1),title:names[mode]+' '+titles[i],metric:'qualifyingGames',target,minDays:[1,3,7,14,30,60,90,180,270,365,540,730][i],reward:[1000,2000,5000,12000,30000,70000,150000,300000,500000,750000,1000000,1500000][i]}));
}
module.exports={summarize,catalog,modes};
