/* JACKPOT_JUNCTION_V1 */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.JackpotJunction=factory();})(globalThis,()=>{
 const stakes=[10000,50000,100000,500000,1000000,5000000,10000000];
 const prizes=[{symbol:'cherry',name:'Cherries',multiplier:1,weight:140000},{symbol:'bell',name:'Bells',multiplier:2,weight:150000},{symbol:'bar',name:'Bars',multiplier:3,weight:70000},{symbol:'seven',name:'Sevens',multiplier:5,weight:30000},{symbol:'diamond',name:'Diamonds',multiplier:10,weight:8000},{symbol:'crown',name:'Crowns',multiplier:20,weight:1000}];
 return {stakes,prizes,seed:128338393,housePercent:4,jackpotPercent:6,smallPrizePercent:90,rollSize:1000000,spinMs:3600,build:'JACKPOT_JUNCTION_V1',jackpotWeight:stake=>stake/5000};
});
