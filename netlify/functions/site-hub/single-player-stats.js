'use strict';
const modes=['scratch','junction','minefield','plinko','rocket','luckydice','midnight','derby'];
function summarize(entries=[]){
 const stats=Object.fromEntries(modes.map(mode=>[mode,{games:0,wins:0,losses:0,draws:0,wagered:0,returned:0,net:0,bestReturn:0}])),rounds=new Map();
 for(const entry of entries){
  const match=/^(scratch|junction|minefield|plinko|rocket|luckydice|midnight|derby):([A-F0-9]{12}):(stake|payout|refund):([1-9]\d*)$/.exec(entry.id||'');
  if(!match||!Number.isSafeInteger(entry.delta))continue;
  const key=match[1]+':'+match[2]+':'+match[4],r=rounds.get(key)||{mode:match[1]};r[match[3]]=entry.delta;rounds.set(key,r);
 }
 for(const r of rounds.values()){
  if(!(r.stake<0)||r.payout===undefined||r.refund!==undefined)continue;
  const s=stats[r.mode],stake=-r.stake;s.games++;s.wagered+=stake;s.returned+=r.payout;s.net+=r.payout-stake;s.bestReturn=Math.max(s.bestReturn,r.payout);
  if(r.payout>stake)s.wins++;else if(r.payout<stake)s.losses++;else s.draws++;
 }
 return stats;
}
function achievements(stats){return Object.fromEntries(modes.map(mode=>[mode,[
 {id:'first-game',title:'First Round',description:'Complete your first game.',metric:'games',target:1},
 {id:'first-win',title:'First Win',description:'Finish a game with a profit.',metric:'wins',target:1},
 {id:'regular',title:'Regular Player',description:'Complete 25 games.',metric:'games',target:25},
 {id:'century',title:'The Century Club',description:'Complete 100 games.',metric:'games',target:100}
 ].map(a=>({...a,reward:0,unlocked:(stats[mode]?.[a.metric]||0)>=a.target}))]));}
module.exports={summarize,achievements,modes};
