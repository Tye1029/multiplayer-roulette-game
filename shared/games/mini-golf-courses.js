/* POCKET_PUTT_V2 — original courses, shared by the renderer and authoritative physics. */
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.PuttCourses=value;})(globalThis,()=>{
  'use strict';
  const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
  const holes=[
    {id:'garden-1',name:'The Welcome Bend',par:3,theme:'garden',tip:'Bank off the far rail, or stop at the elbow and line up the cup.',
      tee:[160,585],cup:[550,170],floor:[[80,650],[80,90],[640,90],[640,270],[260,270],[260,650]],walls:[],bumpers:[],sand:[{x:110,y:330,w:120,h:90}]},
    {id:'garden-2',name:'Cutting Corners',par:3,theme:'garden',tip:'The narrow middle opening saves a stroke. The outside route is more forgiving.',
      tee:[150,575],cup:[565,150],floor:rect(70,70,580,580),walls:[[[70,365],[305,365]],[[370,365],[540,365]],[[475,70],[475,235]]],bumpers:[{x:570,y:475,r:28}],sand:[{x:100,y:260,w:135,h:90}]},
    {id:'garden-3',name:'Ricochet Roses',par:4,theme:'garden',tip:'Use the diagonal rails to redirect your ball. A soft final putt will hold the cup.',
      tee:[140,570],cup:[570,140],floor:rect(70,70,580,580),walls:[[[210,650],[210,405]],[[340,280],[525,465]],[[70,250],[255,250]]],bumpers:[{x:470,y:180,r:25},{x:350,y:555,r:25}],sand:[]},
    {id:'lagoon-1',name:'Hungry Hungry Shortcut',par:3,theme:'lagoon',tip:'Putt into the hippo’s mouth. A rumble later, your ball pops out of its bottom on the upper green.',
      tee:[160,575],cup:[565,155],floor:[[70,650],[70,440],[440,440],[440,275],[330,275],[330,70],[650,70],[650,650]],walls:[],bumpers:[],sand:[{x:455,y:350,w:155,h:75}],
      portal:{mouth:[280,530],exit:[490,235],angle:-Math.PI/2},water:[{x:485,y:480,w:110,h:100}]},
    {id:'lagoon-2',name:'Lily Pad Passage',par:4,theme:'lagoon',tip:'The slim dry bridge is a shortcut. Water costs a stroke and returns you to your last shot.',
      tee:[155,575],cup:[570,155],floor:rect(70,70,580,580),walls:[[[70,440],[295,440]],[[430,280],[650,280]]],water:[{x:90,y:290,w:205,h:130},{x:365,y:290,w:265,h:130}],sand:[],bumpers:[{x:530,y:550,r:23}]},
    {id:'lagoon-3',name:'Hippo’s Double Back',par:4,theme:'lagoon',tip:'The hippo skips the sand, but its exit faces a bumper. Control your approach speed.',
      tee:[150,570],cup:[560,560],floor:rect(70,70,580,580),walls:[[[345,280],[345,650]],[[70,380],[255,380]]],sand:[{x:125,y:110,w:140,h:160}],bumpers:[{x:540,y:220,r:30},{x:460,y:435,r:23}],portal:{mouth:[230,470],exit:[485,145],angle:Math.PI/2}},
    {id:'fair-1',name:'Windmill Window',par:3,theme:'fair',tip:'Watch the rotating arm. Aim through the opening or bounce around the outside.',
      tee:[155,570],cup:[565,155],floor:rect(70,70,580,580),walls:[[[70,350],[245,350]],[[475,350],[650,350]]],gate:{x:360,y:350,length:100,speed:0.65},sand:[],bumpers:[]},
    {id:'fair-2',name:'Pinball Picnic',par:4,theme:'fair',tip:'Bumpers add a little kick. Find an angle that turns the bounce into a shortcut.',
      tee:[155,580],cup:[565,140],floor:[[70,650],[70,420],[170,420],[170,70],[650,70],[650,300],[550,300],[550,650]],walls:[[[170,300],[345,300]],[[385,480],[550,480]]],bumpers:[{x:330,y:400,r:27},{x:450,y:240,r:27},{x:430,y:580,r:25}],sand:[]},
    {id:'fair-3',name:'The Grand Zigzag',par:5,theme:'fair',tip:'A patient setup shot beats a wild ricochet. Leave yourself a clear angle for the last bend.',
      tee:[145,580],cup:[575,145],floor:[[70,650],[70,440],[450,440],[450,280],[70,280],[70,70],[650,70],[650,650]],walls:[[[450,450],[530,530]]],bumpers:[{x:190,y:175,r:24}],sand:[{x:280,y:105,w:125,h:100}]}
  ];
  // Broad hills and shallow bowls, with smaller bumps on the later greens.
  // Their same elliptical contours are drawn by the renderer and used by physics.
  const terrain=[
    [{x:185,y:485,rx:68,ry:84,height:12},{x:425,y:175,rx:72,ry:62,height:-8}],
    [{x:285,y:485,rx:100,ry:90,height:14},{x:395,y:220,rx:65,ry:80,height:-9}],
    [{x:300,y:380,rx:65,ry:95,height:13},{x:510,y:550,rx:55,ry:50,height:8}],
    [{x:395,y:550,rx:58,ry:72,height:10},{x:575,y:260,rx:48,ry:60,height:-7}],
    [{x:200,y:520,rx:75,ry:58,height:11},{x:340,y:190,rx:95,ry:75,height:-10}],
    [{x:235,y:300,rx:74,ry:65,height:12},{x:540,y:500,rx:58,ry:60,height:-8}],
    [{x:275,y:535,rx:90,ry:78,height:13},{x:435,y:190,rx:80,ry:70,height:-10}],
    [{x:275,y:185,rx:70,ry:62,height:12},{x:450,y:370,rx:53,ry:58,height:8}],
    [{x:300,y:550,rx:96,ry:78,height:14},{x:560,y:370,rx:58,ry:75,height:-9}]
  ];
  holes.forEach((h,i)=>{h.terrain=terrain[i];h.tip+=' Light ridges roll the ball downhill; darker divots draw it inward.';});
  const courses=[
    {id:'garden',name:'Bramble Gardens',subtitle:'Banks, bends & a little finesse',color:'#a6df97',holes:holes.slice(0,3)},
    {id:'lagoon',name:'Hippo Hollow',subtitle:'Hungry shortcuts & lagoon leaps',color:'#8cddd9',holes:holes.slice(3,6)},
    {id:'fair',name:'Moonlight Fair',subtitle:'Moving gates & bumper mischief',color:'#ebc28c',holes:holes.slice(6,9)}
  ];
  return {courses,holes,rect,get:id=>courses.find(c=>c.id===id),SIZE:720};
});
