/* DICE_DUEL_V1 — four independent fair six-sided dice; ties return the wager. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.DiceDuelRules=factory();})(globalThis,()=>{
 const build='DICE_DUEL_V1',rollMs=3200,stakes=[50000,100000,500000,1000000,5000000,10000000],winNumerator=9,winDenominator=5;
 function outcome(stake,dice){
  if(!stakes.includes(stake)||!Array.isArray(dice)||dice.length!==4||dice.some(n=>!Number.isInteger(n)||n<1||n>6))throw new RangeError('Choose an available wager and four valid dice.');
  const playerTotal=dice[0]+dice[1],houseTotal=dice[2]+dice[3],outcome=playerTotal>houseTotal?'win':playerTotal===houseTotal?'tie':'loss';
  const payout=outcome==='win'?stake*winNumerator/winDenominator:outcome==='tie'?stake:0;
  return {dice:[...dice],playerTotal,houseTotal,outcome,payout,multiplier:payout/stake};
 }
 const counts={win:575,tie:146,loss:575,total:1296};
 const expectedReturn=(counts.win*winNumerator/winDenominator+counts.tie)/counts.total;
 return {build,rollMs,stakes,winNumerator,winDenominator,counts,expectedReturn,outcome};
});
