/* POCKET_PUTT_V3 — shared colors; unlocks are verified against earned achievements. */
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.PuttCosmetics=value;})(globalThis,()=>{
  const colors=[
    {id:'pearl',name:'Pearl',light:'#fffdf2',base:'#ede9d8',dark:'#aeb7a5',achievement:null,challenge:'Available to everyone.'},
    {id:'coral',name:'Coral',light:'#ffe3d0',base:'#f0957e',dark:'#a34755',achievement:'wins-1',challenge:'Earn First Victory: win one competitive golf match.'},
    {id:'sky',name:'Sky Blue',light:'#e0f9ff',base:'#69c6f1',dark:'#286ab8',achievement:'wins-10',challenge:'Earn Finding Your Form: win 10 competitive golf matches.'},
    {id:'mint',name:'Mint',light:'#eaffde',base:'#9bdd9d',dark:'#388b6f',achievement:'special-0',challenge:'Earn A Little Finesse: 25 under-par holes, 20 competitive matches, and five active days.'},
    {id:'violet',name:'Violet',light:'#f5e6ff',base:'#b48aed',dark:'#6c43a6',achievement:'wins-50',challenge:'Earn Regular Winner: win 50 competitive golf matches.'},
    {id:'sunset',name:'Sunset',light:'#fff7bd',base:'#f4ae58',dark:'#be5b56',achievement:'special-1',challenge:'Earn Hippo Whisperer: 250 shortcuts, 100 competitive matches, and 30 active days.'},
    {id:'gold',name:'Champion Gold',light:'#fff5b0',base:'#e8c24d',dark:'#9c7428',achievement:'wins-250',challenge:'Earn Arena Veteran: win 250 competitive golf matches across 30 active days.'},
    {id:'galaxy',name:'Galaxy',light:'#eacbff',base:'#7a75e0',dark:'#39306d',achievement:'special-2',challenge:'Earn Ace of the Greens: 100 aces, 500 competitive matches, and 90 active days.'},
    {id:'obsidian',name:'Obsidian',light:'#c1d2dc',base:'#586d7c',dark:'#1d3040',achievement:'wins-1000',challenge:'Earn A Thousand Victories: win 1,000 competitive golf matches across 90 active days.'}
  ];
  const get=id=>colors.find(c=>c.id===id)||colors[0];
  const available=(id,earned=[])=>colors.some(c=>c.id===id&&(!c.achievement||earned.includes(c.achievement)));
  return {colors,get,available};
});
