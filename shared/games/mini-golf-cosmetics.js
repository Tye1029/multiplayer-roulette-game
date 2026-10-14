/* POCKET_PUTT_V5 — shared colors; unlocks are verified against earned achievements. */
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.PuttCosmetics=value;})(globalThis,()=>{
  const colors=[
    {id:'pearl',name:'Pearl',light:'#fffdf2',base:'#ede9d8',dark:'#aeb7a5',achievement:null,challenge:'Available to everyone.'},
    {id:'coral',name:'Coral',light:'#ffe3d0',base:'#f0957e',dark:'#a34755',achievement:'wins-1',challenge:'Unlock through a secret Pocket Putt achievement.'},
    {id:'sky',name:'Sky Blue',light:'#e0f9ff',base:'#69c6f1',dark:'#286ab8',achievement:'wins-10',challenge:'Unlock through a secret Pocket Putt achievement.'},
    {id:'mint',name:'Mint',light:'#eaffde',base:'#9bdd9d',dark:'#388b6f',achievement:'special-0',challenge:'Unlock through a secret Pocket Putt achievement.'},
    {id:'violet',name:'Violet',light:'#f5e6ff',base:'#b48aed',dark:'#6c43a6',achievement:'wins-50',challenge:'Unlock through a secret Pocket Putt achievement.'},
    {id:'sunset',name:'Sunset',light:'#fff7bd',base:'#f4ae58',dark:'#be5b56',achievement:'special-1',challenge:'Unlock through a secret Pocket Putt achievement.'},
    {id:'gold',name:'Champion Gold',light:'#fff5b0',base:'#e8c24d',dark:'#9c7428',achievement:'wins-250',challenge:'Unlock through a secret Pocket Putt achievement.'},
    {id:'galaxy',name:'Galaxy',light:'#eacbff',base:'#7a75e0',dark:'#39306d',achievement:'special-2',challenge:'Unlock through a secret Pocket Putt achievement.'},
    {id:'obsidian',name:'Obsidian',light:'#c1d2dc',base:'#586d7c',dark:'#1d3040',achievement:'wins-1000',challenge:'Unlock through a secret Pocket Putt achievement.'}
  ];
  const get=id=>colors.find(c=>c.id===id)||colors[0];
  const available=(id,earned=[])=>colors.some(c=>c.id===id&&(!c.achievement||earned.includes(c.achievement)));
  // A local contrast aid, never an equipped/unlocked account preference.
  function display(ids,you){
    const result=ids.map(id=>get(id).id);if(you<0||!result[you])return result;
    const rgb=id=>get(id).base.match(/\w\w/g).map(v=>parseInt(v,16));
    const own=rgb(result[you]);
    for(let i=0;i<result.length;i++)if(i!==you){const other=rgb(result[i]);
      if(Math.hypot(...own.map((v,j)=>v-other[j]))<150){
        result[i]=['coral','sky','obsidian','pearl'].sort((a,b)=>Math.hypot(...rgb(b).map((v,j)=>v-own[j]))-Math.hypot(...rgb(a).map((v,j)=>v-own[j])))[0];
      }
    }return result;
  }
  return {colors,get,available,display};
});
