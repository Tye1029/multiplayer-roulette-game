/* LUCKY_SCRATCH_V3 — published ticket prices and exact prize distribution. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.LuckyScratch=factory();})(globalThis,()=>{
  const tiers=[{id:'bronze',name:'Bronze Spark',price:10000,color:'#d99e6b'},{id:'silver',name:'Silver Chance',price:50000,color:'#d2ccd9'},{id:'copper',name:'Copper Luck',price:100000,color:'#e4ad79'},{id:'jade',name:'Jade Fortune',price:500000,color:'#8fd4b0'},{id:'sapphire',name:'Sapphire Streak',price:1000000,color:'#88bbef'},{id:'violet',name:'Velvet Riches',price:5000000,color:'#c5a4ea'},{id:'gold',name:'Golden Hour',price:10000000,color:'#f4d681'}];
  const prizes=[{multiplier:0,weight:6080},{multiplier:1,weight:2000},{multiplier:2,weight:1200},{multiplier:5,weight:520},{multiplier:10,weight:170},{multiplier:25,weight:28},{multiplier:100,weight:2}];
  return {tiers,prizes,get:id=>tiers.find(t=>t.id===id),rtp:96,build:'LUCKY_SCRATCH_V3'};
});
