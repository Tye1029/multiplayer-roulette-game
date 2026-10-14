(function(root,factory){const rules=factory();if(typeof module==='object'&&module.exports)module.exports=rules;else root.LuckyDiceRules=rules;})(typeof window==='object'?window:globalThis,()=>{
 'use strict';
 const build='DICE_V2',rollMs=3200,stakes=[10000,50000,100000,500000,1000000,5000000,10000000],targets=[3,4,5,6,7,8,9,10,11];
 function count(target,direction){if(!targets.includes(target)||!['higher','lower'].includes(direction))throw Error('Choose a number from 3 to 11 and Higher or Lower.');let n=0;for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)if(direction==='higher'?a+b>target:a+b<target)n++;return n;}
 function quote(stake,target,direction){if(!stakes.includes(stake))throw Error('Choose an available wager.');const ways=count(target,direction),payout=Math.floor(stake*342/(ways*10));return {ways,chance:ways/36,payout,multiplier:payout/stake};}
 function outcome(stake,dice,target,direction){const q=quote(stake,target,direction);if(!Array.isArray(dice)||dice.length!==2||dice.some(n=>!Number.isInteger(n)||n<1||n>6))throw Error('Invalid dice.');const total=dice[0]+dice[1],win=direction==='higher'?total>target:total<target;return {dice,total,target,direction,outcome:win?'win':'loss',payout:win?q.payout:0,multiplier:win?q.multiplier:0};}
 return {build,rollMs,stakes,targets,count,quote,outcome,expectedReturn:.95};
});
