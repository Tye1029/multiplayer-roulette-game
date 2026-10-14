/* BOARDWALK_PARTY_V1: shared, public presentation data. No account or reward authority. */
(function(root,factory){const data=factory();if(typeof module==='object'&&module.exports)module.exports=data;else root.PartyCatalog=data;})(globalThis,()=>{
  const characters=[
    {id:'raccoon',name:'Riff',kind:'Raccoon',color:'#a6a4ff',accent:'#6059c9',bio:'Small paws. Big plans.'},
    {id:'fox',name:'Cleo',kind:'Fox',color:'#ffad69',accent:'#e36846',bio:'Always takes the scenic shortcut.'},
    {id:'frog',name:'Moss',kind:'Frog',color:'#a7e7a2',accent:'#3e9f85',bio:'Cool head. Competitive streak.'},
    {id:'robot',name:'Bolt',kind:'Robot',color:'#7cddf2',accent:'#4189d2',bio:'Built for one more round.'}
  ];
  const games=[
    {id:'climb',name:'Rooftop Rally',tag:'REFLEXES',color:'#ae9fff',description:'Follow the arrows. Race above the city.',rules:'Tap the matching arrow to climb. A wrong move costs a step. Reach the rooftop first, or climb highest before time runs out.',unit:'points'},
    {id:'putt',name:'Neon Putt',tag:'PRECISION',color:'#a6e6b5',description:'Three shots. One perfect line.',rules:'Set your aim and power, then putt. Each attempt starts at the tee. Sink it for 1,000 points; otherwise closer earns more. Your best of three shots counts.',unit:'points'},
    {id:'fish',name:'Harbor Haul',tag:'TIMING',color:'#82d9ef',description:'Find the sweet spot. Reel in a big one.',rules:'Watch the moving float. Tap Reel when it crosses the gold zone. You get five casts; accurate timing earns more points.',unit:'points'},
    {id:'memory',name:'Afterglow',tag:'MEMORY',color:'#ffb5ca',description:'Watch the lights. Remember the rhythm.',rules:'Watch the four colored pads light up, then repeat the sequence. Each success adds another light. A mistake starts a fresh pattern of the same length.',unit:'points'}
  ];
  const skins=[{id:'classic',name:'Originals',price:0,color:'#fff',description:'The crew, as you met them.'},{id:'sunset',name:'Sunset Club',price:60,color:'#ffab79',description:'Warm jackets. Golden-hour energy.'},{id:'electric',name:'Electric Nights',price:120,color:'#b49aff',description:'A little extra neon after dark.'},{id:'champion',name:'Victory Lap',price:240,color:'#ffe38d',description:'A golden crown for your next entrance.'}];
  const items=[{id:'boost',name:'Sneakers',cost:4,description:'Move 3 extra spaces this turn.'},{id:'magnet',name:'Magnet',cost:4,description:'Collect 5 extra match tokens.'},{id:'shield',name:'Umbrella',cost:3,description:'Protect against the next rainy space.'}];
  const spaces=Array.from({length:24},(_,i)=>({type:i%8===3?'rain':i%6===1?'gift':i%4===0?'tokens':'street'}));
  const hole={floor:[[100,90],[620,90],[620,630],[100,630]],tee:[230,545],cup:[500,160],walls:[[[100,340],[375,340]]],bumpers:[{x:480,y:385,r:26}],sand:[{x:405,y:215,w:175,h:55}]};
  return {characters,games,skins,items,spaces,hole,version:'BOARDWALK_PARTY_V1'};
});
