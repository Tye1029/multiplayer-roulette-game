/* POCKET_PUTT_V7 — original courses, shared by the renderer and authoritative physics. */
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
    {id:'lagoon-1',name:'Hungry Hungry Shortcut',par:3,theme:'lagoon',tip:'Putt into the hippo’s mouth. Follow its clear chute to the upper green.',
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
  holes.forEach((h,i)=>{h.terrain=terrain[i];});
  const courses=[
    {id:'garden',name:'Bramble Gardens',difficulty:'Intermediate',subtitle:'Banks, bends & a little finesse',color:'#a6df97',holes:holes.slice(0,3)},
    {id:'lagoon',name:'Hippo Hollow',difficulty:'Intermediate',subtitle:'Hungry shortcuts & lagoon leaps',color:'#8cddd9',holes:holes.slice(3,6)},
    {id:'fair',name:'Moonlight Fair',difficulty:'Challenging',subtitle:'Moving gates & bumper mischief',color:'#ebc28c',holes:holes.slice(6,9)}
  ];
  const mound=(x,y,rx,ry,height=12)=>({x,y,rx,ry,height}),sand=(x,y,w,h)=>({x,y,w,h}),bumper=(x,y,r=25)=>({x,y,r});
  function add(id,name,difficulty,theme,subtitle,layouts){
    const greens=layouts.map(([name,par,tee,cup,tip,features],i)=>({id:id+'-'+(i+1),name,par,theme,tee,cup,tip,floor:rect(70,70,580,580),walls:[],sand:[],water:[],bumpers:[],terrain:[],...features}));
    holes.push(...greens);courses.push({id,name,difficulty,subtitle,color:'#c4dfad',holes:greens});
  }
  add('clover','Clover Club','Beginner','garden','Room to learn your touch',[
    ['First Putt',2,[360,575],[360,160],'A clear lane. Start gently and learn how far your ball rolls.',{floor:rect(210,75,300,570)}],
    ['Easy Bank',3,[180,560],[550,180],'A single angled rail introduces bank shots. There is room around either end.',{walls:[[[290,350],[445,425]]],sand:[sand(100,210,100,85)]}],
    ['Little Rise',3,[160,570],[540,170],'Try aiming beside the small hill. A downhill bounce can save a stroke.',{terrain:[mound(350,365,120,100,9)]}]
  ]);
  add('willow','Willow Walk','Easy','garden','Gentle bends through the gardens',[
    ['Around the Pond',3,[160,570],[555,180],'Follow the wide bend. The inner rail sets up a tidy second shot.',{floor:[[70,650],[70,90],[650,90],[650,290],[290,290],[290,650]],terrain:[mound(435,185,80,65,-6)]}],
    ['Garden Gate',3,[160,570],[555,155],'The gap through the fence is wide; choose a line before adding power.',{walls:[[[70,330],[240,330]],[[445,330],[650,330]]],sand:[sand(480,410,125,105)]}],
    ['The Horseshoe',4,[150,575],[570,575],'Go up, across the top, then down. Soft shots make the bends easier.',{floor:[[70,650],[70,70],[650,70],[650,650],[450,650],[450,270],[270,270],[270,650]],terrain:[mound(360,170,90,65,8)]}]
  ]);
  add('dunes','Sandstone Dunes','Intermediate','dunes','Read the sand, save your strokes',[
    ['Bunker Boulevard',3,[160,565],[555,155],'Sand grabs the ball. Take the clean strip down either side.',{sand:[sand(275,220,175,270)],terrain:[mound(535,490,75,80,10)]}],
    ['Desert Dogleg',4,[140,570],[570,155],'Set up at the elbow; the sandy corner punishes overpowered banks.',{floor:[[70,650],[70,380],[380,380],[380,70],[650,70],[650,650]],sand:[sand(140,430,170,100),sand(465,220,100,125)]}],
    ['Dune Crossing',4,[150,555],[565,160],'The ridge pushes outward. Aim into its slope to bend toward the cup.',{terrain:[mound(325,390,120,130,19),mound(510,225,80,75,-10)],sand:[sand(90,90,160,140)],walls:[[[400,650],[400,475]]]}]
  ]);
  add('pebble','Pebble Springs','Easy','alpine','Friendly bumpers and open greens',[
    ['Bumper School',3,[155,575],[560,145],'The blue spring bumper kicks your ball away on contact.',{bumpers:[bumper(360,355,35)]}],
    ['Twin Springs',3,[360,580],[360,140],'Thread the middle or bank around the pair of spring bumpers.',{bumpers:[bumper(245,350,32),bumper(475,350,32)],terrain:[mound(360,200,80,65,-6)]}],
    ['Pebble Bend',4,[155,575],[560,155],'A bumper at the bend can send you up the second lane.',{floor:[[70,650],[70,420],[420,420],[420,70],[650,70],[650,650]],bumpers:[bumper(545,540,33)],sand:[sand(220,475,115,95)]}]
  ]);
  add('tide','Tidal Trails','Challenging','lagoon','Bridges, coves and careful landings',[
    ['Dry Bridge',4,[150,560],[560,145],'Cross the narrow dry bridge between the two pools.',{water:[sand(70,290,240,120),sand(410,290,240,120)],terrain:[mound(515,205,75,65,-8)]}],
    ['Island Hops',4,[145,570],[570,145],'Use the left bank, then turn above the central lagoon.',{water:[sand(250,235,230,275)],walls:[[[70,200],[200,200]],[[510,520],[650,520]]],bumpers:[bumper(565,350,25)]}],
    ['The Shoreline',5,[160,575],[560,105],'Two offset pools leave a winding dry route. Keep your landing spot in mind.',{water:[sand(70,330,295,110),sand(355,140,295,110)],terrain:[mound(485,520,105,85,14)],walls:[[[200,70],[200,170]]]}]
  ]);
  add('alpine','Alpine Greens','Challenging','alpine','Slopes do the steering',[
    ['Ridge Rider',4,[155,570],[560,150],'Hit across the ridge at an angle and let its downhill side bend your shot.',{terrain:[mound(345,360,145,125,22)],sand:[sand(90,100,120,100)]}],
    ['Bowl Country',4,[155,570],[565,155],'These grassy bowls pull shots inward. Leave enough power to climb out.',{terrain:[mound(280,455,95,100,-15),mound(465,260,105,95,-15)],walls:[[[70,270],[210,270]]]}],
    ['Mountain Pass',5,[155,575],[560,150],'Climb the first slope, cross the opening, then avoid the final bowl.',{walls:[[[70,350],[290,350]],[[415,350],[650,350]]],terrain:[mound(275,500,110,95,19),mound(430,190,90,80,-13)],sand:[sand(490,410,120,100)]}]
  ]);
  add('neon','Neon Boardwalk','Expert','fair','Timing meets pinball precision',[
    ['Turnstile',4,[155,565],[565,150],'Wait for the moving bar to clear your line, then commit.',{walls:[[[70,350],[215,350]],[[505,350],[650,350]]],gate:{x:360,y:350,length:120,speed:.8},bumpers:[bumper(530,520,26)]}],
    ['Spring Alley',5,[150,580],[565,145],'The central spring array offers sharp bank-shot shortcuts.',{bumpers:[bumper(280,470,30),bumper(425,370,30),bumper(290,250,30),bumper(485,200,25)],walls:[[[70,370],[190,370]],[[515,460],[650,460]]],terrain:[mound(525,570,65,55,-9)]}],
    ['Clockwork Corner',5,[150,570],[565,145],'Line up at the corner before taking on the rotating arm.',{floor:[[70,650],[70,420],[330,420],[330,70],[650,70],[650,650]],gate:{x:475,y:310,length:95,speed:-.55},sand:[sand(420,475,135,100)],bumpers:[bumper(575,430,22)]}]
  ]);
  add('safari','Hippo Safari','Expert','lagoon','Three very hungry detours',[
    ['Feeding Time',4,[155,570],[555,155],'Feed the hippo to skip a long detour. Its exit aims away from the water.',{portal:{mouth:[285,525],exit:[500,260],angle:-Math.PI/2},water:[sand(70,300,385,115)],terrain:[mound(560,385,60,75,-9)]}],
    ['River Run',5,[150,575],[565,160],'The hippo skips one pool, but you must still find a safe route to the flag.',{portal:{mouth:[270,530],exit:[180,220],angle:0},water:[sand(70,315,370,115),sand(350,265,150,185)],walls:[[[350,70],[350,175]]],sand:[sand(440,100,95,100)]}],
    ['Hungry Detour',5,[145,580],[565,570],'Go through the hippo, then use a soft bank to avoid the spring bumper.',{walls:[[[350,260],[350,650]]],portal:{mouth:[250,485],exit:[475,165],angle:Math.PI/2},bumpers:[bumper(515,290,32)],terrain:[mound(535,450,85,80,15)],sand:[sand(100,100,140,150)]}]
  ]);
  add('masters','The Masters Loop','Expert','dunes','Every trick in the caddy book',[
    ['The Switchback',5,[145,580],[570,140],'Climb around the two offset rails. The bowl can help catch an overshoot.',{walls:[[[70,420],[445,420]],[[275,250],[650,250]]],terrain:[mound(535,500,65,95,15),mound(180,185,75,70,-12)],sand:[sand(280,290,125,85)]}],
    ['Risk and Reward',5,[150,575],[565,145],'The hippo saves distance; the open bank route avoids the moving gate.',{portal:{mouth:[255,505],exit:[500,340],angle:-Math.PI/2},gate:{x:510,y:230,length:85,speed:.6},water:[sand(280,270,135,180)],bumpers:[bumper(180,230,30)],terrain:[mound(480,535,90,65,-12)]}],
    ['Grand Finale',6,[150,575],[565,145],'Use the left opening first, the right opening second, then a measured final putt.',{walls:[[[270,440],[650,440]],[[70,270],[420,270]]],terrain:[mound(190,370,85,100,17),mound(520,195,85,75,-13)],bumpers:[bumper(505,350,28)],sand:[sand(315,500,140,100)]}]
  ]);
  const ramp=(x,y,angle=-Math.PI/2)=>({x,y,angle,width:90,length:95,height:22,lift:.62});
  const belt=(x,y,w,h,angle)=>({x,y,w,h,angle,force:240});
  add('skybridge','Skybridge Park','Challenging','garden','Carry the water or take the long way',[
    ['Leap of Faith',4,[260,575],[510,170],'The ramp clears the pond at medium power. Too soft splashes short; too hard finds the far bunker. The right lane is safe.',{ramps:[ramp(260,425)],water:[sand(100,255,290,145)],sand:[sand(155,80,230,120)]}],
    ['Island Express',5,[160,570],[550,150],'Launch diagonally across the lagoon, or follow the dry right-hand bank. Leave room for the landing roll.',{ramps:[ramp(270,460,-Math.PI/3)],water:[sand(180,250,240,160)],sand:[sand(420,80,160,100)],walls:[[[70,210],[190,210]]]}],
    ['Over the Hedge',5,[180,580],[540,140],'Jump over the hedge for a direct approach. The outside path costs distance but has no landing bunker.',{ramps:[ramp(260,430)],walls:[[[70,340],[450,340]]],sand:[sand(165,170,160,95)],terrain:[mound(515,235,85,95,-11)]}]
  ]);
  add('clockwork','Clockwork Gardens','Expert','fair','Moving lanes and timed escapes',[
    ['Beltway',4,[145,575],[560,140],'The moving lane carries you right. Use it to cut the corner, or hit across before it steers you toward the pond.',{conveyors:[belt(180,365,360,100,0)],water:[sand(555,350,95,135)],walls:[[[70,250],[300,250]]],bumpers:[bumper(425,220,25)]}],
    ['Cross Traffic',5,[160,570],[550,140],'Two belts pull in opposite directions. A measured diagonal shot can use both to reach the upper green.',{conveyors:[belt(165,415,370,80,0),belt(185,230,355,80,Math.PI)],sand:[sand(535,400,110,110),sand(75,215,110,115)],gate:{x:365,y:340,length:80,speed:.45}}],
    ['Launch Window',5,[240,575],[525,145],'The launch ramp skips the moving arm. Catch the near landing green, or take the safe route along the right rail.',{ramps:[ramp(240,435)],gate:{x:300,y:335,length:105,speed:.55},conveyors:[belt(165,170,330,75,0)],sand:[sand(505,155,125,110)],cup:[555,115]}]
  ]);
  add('harbor','Hippo Adventure Harbor','Expert','lagoon','Hungry tunnels and daring jumps',[
    ['Hippo High Dive',5,[150,575],[550,140],'The hippo’s chute exits on the dry right bank. Choose that detour or line up the ramp jump across the lagoon.',{portal:{mouth:[260,535],exit:[480,420],angle:-Math.PI/2},ramps:[ramp(330,420)],water:[sand(135,255,300,125)],sand:[sand(240,85,150,125)]}],
    ['Cargo Run',5,[155,570],[555,150],'Ride the cargo belt toward the hippo, but brake before the pond. A quiet outside approach also reaches its mouth.',{conveyors:[belt(180,460,290,100,0)],portal:{mouth:[475,510],exit:[475,230],angle:-Math.PI/2},water:[sand(520,435,120,155)],walls:[[[70,350],[440,350]]],terrain:[mound(220,210,100,90,14)]}],
    ['The Captain’s Cut',6,[170,575],[550,145],'Choose the ramp over the lagoon or the hippo along the edge. The landing belt can carry a strong shot into sand.',{ramps:[ramp(290,430)],portal:{mouth:[510,560],exit:[480,245],angle:0},water:[sand(145,265,270,130)],conveyors:[belt(180,160,320,75,0)],sand:[sand(500,180,140,130)],bumpers:[bumper(420,540,27)]}]
  ]);
  // Curved silhouettes are real collision boundaries, not square greens with
  // decorative cutouts. New sets deliberately leave ramps to the jump courses.
  const oval=(x,y,rx,ry,n=24)=>Array.from({length:n},(_,i)=>[Math.round(x+Math.cos(i*Math.PI*2/n)*rx),Math.round(y+Math.sin(i*Math.PI*2/n)*ry)]);
  add('meadow','Meadow Meanders','Easy','garden','Curved greens and quiet doglegs',[
    ['The Oval Office',3,[235,530],[480,190],'An open oval green. Read the curved rail for a gentle bank toward the flag.',{floor:oval(360,360,285,285)}],
    ['Crooked Clover',3,[160,550],[540,160],'Stop at the broad elbow, then send a gentle putt up the second lane.',{floor:[[70,640],[70,425],[380,425],[380,75],[640,75],[640,640]],terrain:[mound(510,290,80,100,8)]}],
    ['Butterfly Green',3,[180,530],[540,185],'A wide waist connects the two greens. The shallow bowl catches a slightly wide approach.',{floor:[[85,580],[85,440],[235,350],[85,230],[110,95],[260,75],[365,220],[515,75],[640,110],[630,265],[470,350],[635,470],[610,625],[450,630],[360,490],[245,640]],terrain:[mound(515,230,65,65,-6)]}]
  ]);
  add('canyon','Canyon Corners','Intermediate','dunes','Angular banks and sandy pockets',[
    ['Copper Chevron',4,[165,540],[560,145],'Follow the chevron uphill on the map. Aim at the angled outside rail to cut the bend.',{floor:[[65,650],[65,440],[365,280],[450,70],[655,70],[535,450],[280,575],[280,650]],sand:[sand(400,320,95,65)]}],
    ['Hourglass Sands',4,[360,565],[360,145],'The waist is the clean route. Sandy wings catch wide banks.',{floor:[[120,650],[75,535],[265,355],[75,170],[120,70],[600,70],[645,170],[455,355],[645,535],[600,650]],sand:[sand(145,115,130,75),sand(445,510,125,80)]}],
    ['The Long Dogleg',4,[145,565],[560,160],'Two square turns demand accurate setup shots. The bunker sits on the tempting inside line.',{floor:[[65,650],[65,400],[390,400],[390,70],[650,70],[650,650]],sand:[sand(420,425,110,115)],walls:[[[390,310],[500,310]]]}]
  ]);
  add('brook','Brookside Bends','Intermediate','lagoon','Curving banks and dry crossings',[
    ['Crescent Cove',4,[160,565],[180,150],'Follow the crescent around its planted center. Use the sloping rails to carry each bend.',{floor:[[80,650],[80,470],[345,470],[470,350],[345,235],[80,235],[80,70],[420,70],[650,295],[650,435],[420,650]],water:[sand(505,325,95,95)]}],
    ['The Narrow Neck',4,[175,540],[545,165],'Cross the narrow middle between the pools. The broad ends give you room to line up.',{floor:[[75,650],[75,420],[260,320],[260,80],[645,80],[645,285],[435,400],[435,650]],water:[sand(80,435,125,100),sand(465,170,160,100)]}],
    ['Estuary',4,[170,565],[540,165],'Choose either side of the central pool. The tapered top rewards a careful final bank.',{floor:[[70,590],[115,410],[70,235],[205,70],[565,70],[655,230],[600,430],[650,650],[220,650]],water:[sand(285,275,150,190)],terrain:[mound(515,200,65,80,-8)]}]
  ]);
  add('highland','Highland Hollows','Challenging','alpine','Rolling ridges, bowls and contoured greens',[
    ['Rolling Ribbon',4,[160,575],[540,155],'The ribbon bends twice. Use the first rise to curve toward the center lane.',{floor:[[70,650],[70,430],[280,285],[280,70],[650,70],[650,300],[425,450],[425,650]],terrain:[mound(245,480,105,90,14),mound(450,190,100,70,-10)]}],
    ['Emerald Basin',4,[205,530],[520,195],'The broad bowl pulls toward its center. Aim across its shoulder to escape toward the flag.',{floor:oval(360,360,290,275),terrain:[mound(350,360,155,130,-16),mound(520,245,70,80,12)]}],
    ['Twin Peaks',5,[155,540],[555,155],'A diagonal ridge divides the open diamond. Cross it gently, or follow the low edge around it.',{floor:[[70,490],[70,270],[280,70],[495,70],[650,235],[650,460],[445,650],[230,650]],terrain:[mound(290,415,105,100,18),mound(440,280,95,105,17)],sand:[sand(460,485,95,85)]}]
  ]);
  add('switchback','Switchback Trail','Expert','fair','Winding lanes and precision banks',[
    ['Serpentine',5,[145,570],[565,150],'Three lanes snake from tee to flag. Set up each corner rather than blasting through all three.',{floor:[[65,650],[65,430],[435,430],[435,290],[65,290],[65,70],[650,70],[650,650]],sand:[sand(465,460,100,110)],bumpers:[bumper(225,175,24)]}],
    ['The Keyhole',5,[170,560],[535,170],'The dogleg opens into an angled upper green. Clear the rotating arm before your approach.',{floor:[[70,650],[70,420],[335,420],[335,220],[405,70],[575,70],[650,205],[575,345],[525,345],[525,650]],gate:{x:425,y:385,length:65,speed:.5}}],
    ['Zigzag Finish',5,[150,570],[550,145],'Use the diagonal walls as banks. A shallow divot holds the final setup shot near the top.',{floor:[[70,650],[70,425],[405,285],[405,70],[650,70],[650,340],[280,510],[280,650]],terrain:[mound(530,190,70,75,-9)],sand:[sand(130,455,90,75)]}]
  ]);
  const order=['clover','willow','pebble','meadow','garden','dunes','lagoon','canyon','brook','alpine','tide','fair','highland','skybridge','neon','safari','clockwork','harbor','switchback','masters'];
  courses.sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id));
  const suddenHole=course=>({id:'decider-'+course,name:'The Decider',par:2,theme:courses.find(c=>c.id===course)?.holes[0].theme||'garden',tee:[360,575],cup:[360,150],floor:[[210,650],[120,500],[120,250],[230,70],[490,70],[600,250],[600,500],[510,650]],walls:[],water:[],sand:[],terrain:[],bumpers:[bumper(360,355,32)],tip:'Both players putt at once. Bank around the central bumper; the first ball in the cup wins. Wait only for your own ball to stop.'});
  return {courses,holes,rect,suddenHole,get:id=>courses.find(c=>c.id===id),SIZE:720};
});
