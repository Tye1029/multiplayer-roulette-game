/* POCKET_PUTT_V5 — live canvas artwork, sized independently of game coordinates. */
(()=>{
  'use strict';
  const C=window.PuttCourses,P=window.PuttPhysics,B=window.PuttCosmetics;
  const themes={garden:{bg:'#234639',grass:'#79a94f',stripe:'#81b157',edge:'#dac293',water:'#4b9fa5',flower:'#f2baa5'},lagoon:{bg:'#234748',grass:'#6aa669',stripe:'#73b173',edge:'#dabd90',water:'#438e9b',flower:'#c8b6e4'},fair:{bg:'#303744',grass:'#6c9471',stripe:'#759e79',edge:'#dec091',water:'#597fb1',flower:'#f1c27d'}};
  themes.dunes={bg:'#bb9a6e',grass:'#8caa62',stripe:'#95b16b',edge:'#e8d0a0',water:'#549eac'};
  themes.alpine={bg:'#526d65',grass:'#72a47e',stripe:'#7cac85',edge:'#d5c5a4',water:'#6babba'};
  const textures=new Map();
  const scenery=new WeakMap();
  function gardenSpot(h){
    if(scenery.has(h))return scenery.get(h);let best=null;
    for(let y=150;y<=570;y+=70)for(let x=150;x<=570;x+=70){if(P.inside(x,y,h.floor))continue;
      const clearance=Math.min(x-65,y-65,655-x,655-y,...h.floor.map((a,i)=>{const q=P.closest(x,y,a,h.floor[(i+1)%h.floor.length]);return Math.hypot(x-q[0],y-q[1]);}));
      if(clearance>75&&(!best||clearance>best.r))best={x,y,r:clearance};
    }scenery.set(h,best);return best;
  }
  function texture(kind){
    if(textures.has(kind))return textures.get(kind);
    const tile=document.createElement('canvas');tile.width=tile.height=128;const ctx=tile.getContext('2d');let seed=1937;
    const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<(kind==='grass'?1900:2600);i++){const x=rand()*128,y=rand()*128,light=rand()>.5;ctx.fillStyle=kind==='grass'?(light?'#f3f9bc20':'#153e2324'):(light?'#fff4d84a':'#805f3026');ctx.fillRect(x,y,kind==='grass'?.65:1,kind==='grass'?1+rand()*2.5:.7);}
    if(kind==='grass'){ctx.strokeStyle='#fff3be14';ctx.lineWidth=.5;for(let i=0;i<110;i++){const x=rand()*128,y=rand()*128;ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x-1,y-3,x+1,y-4);ctx.stroke();}}
    textures.set(kind,tile);return tile;
  }
  const reliefCache=new Map();
  function relief(h){
    if(reliefCache.has(h))return reliefCache.get(h);
    const layer=document.createElement('canvas');layer.width=layer.height=720;const ctx=layer.getContext('2d'),theme=themes[h.theme];
    const rgb=hex=>hex.match(/\w\w/g).map(v=>parseInt(v,16));
    // Bake a height-displaced turf mesh once per hole. Lighting comes from
    // actual surface normals, so the near/far faces reverse inside a hollow.
    for(const t of h.terrain||[]){
      if(t.height>0){ctx.save();ctx.translate(t.x+10,t.y+12);ctx.scale(t.rx*1.03,t.ry*.98);const shadow=ctx.createRadialGradient(0,0,.4,0,0,1);shadow.addColorStop(0,'#163b2935');shadow.addColorStop(1,'#163b2900');ctx.fillStyle=shadow;ctx.fillRect(-1,-1,2,2);ctx.restore();}
      for(let y=t.y-t.ry;y<t.y+t.ry;y+=3)for(let x=t.x-t.rx;x<t.x+t.rx;x+=3){
        const q=((x+1.5-t.x)/t.rx)**2+((y+1.5-t.y)/t.ry)**2;if(q>=1)continue;
        const shape={terrain:[t]},v=P.terrainAt(shape,x+1.5,y+1.5),nx=v.ax/320,ny=v.ay/320,n=Math.hypot(nx,ny,1);
        const lit=(-.5*nx-.65*ny+.8)/(n*Math.hypot(.5,.65,.8));
        const brightness=Math.max(.42,Math.min(1.3,.5+.75*lit+(t.height<0?v.height*.023:0)));
        const stripe=((x-Math.tan(.5)*y)%80+80)%80<40/Math.cos(.5),base=rgb(stripe?theme.stripe:theme.grass),grain=(Math.sin(x*71.3+y*91.7)*43758.54)%1*3;
        ctx.fillStyle='rgb('+base.map(c=>Math.max(0,Math.min(255,Math.round(c*brightness+grain)))).join(',')+')';
        ctx.globalAlpha=Math.min(1,(1-q)*12);ctx.beginPath();
        for(const [i,dx,dy] of [[0,0,0],[1,3.4,0],[2,3.4,3.4],[3,0,3.4]]){const py=y+dy-P.terrainAt(shape,x+dx,y+dy).height*1.8;i?ctx.lineTo(x+dx,py):ctx.moveTo(x+dx,py);}ctx.closePath();ctx.fill();
      }ctx.globalAlpha=1;
    }
    if(reliefCache.size>=4)reliefCache.delete(reliefCache.keys().next().value);
    reliefCache.set(h,layer);return layer;
  }
  function render(canvas,h,{balls=[],time=0,aim=null,active=0,you=-1,playable=false,ghost=false,portalPulse=0,colors=[],effects=[]}={}){
    const x=canvas.getContext('2d'),dpr=Math.min(2,window.devicePixelRatio||1),size=Math.max(240,Math.round(canvas.clientWidth*dpr));if(canvas.width!==size||canvas.height!==size){canvas.width=canvas.height=size;}
    x.setTransform(size/720,0,0,size/720,0,0);x.clearRect(0,0,720,720);const t=themes[h.theme];
    function path(points){x.beginPath();points.forEach((p,i)=>i?x.lineTo(...p):x.moveTo(...p));x.closePath();}
    function line(a,b,color,width){x.beginPath();x.moveTo(...a);x.lineTo(...b);x.strokeStyle=color;x.lineWidth=width;x.lineCap='round';x.stroke();}
    function circle(a,b,r,color){x.beginPath();x.arc(a,b,r,0,Math.PI*2);x.fillStyle=color;x.fill();}
    function ellipse(a,b,rx,ry,color){x.beginPath();x.ellipse(a,b,rx,ry,0,0,Math.PI*2);x.fillStyle=color;x.fill();}
    function roundRect(a,b,w,h,r,color){x.beginPath();x.roundRect(a,b,w,h,r);x.fillStyle=color;x.fill();}
    function leaf(a,b,s=1){x.save();x.translate(a,b);x.scale(s,s);ellipse(2,9,28,13,'#102e2755');for(let i=0;i<5;i++){x.save();x.rotate(i*1.25);ellipse(0,-14,10,21,i%2?'#365f42':'#446e47');x.restore();}circle(0,0,6,'#597c49');x.restore();}
    x.fillStyle=t.bg;x.fillRect(0,0,720,720);
    // Landscaped surroundings: a continuous material, perimeter paths, and
    // deliberately placed planting beds. Course geometry covers this layer.
    if(h.theme==='lagoon'){
      const water=x.createLinearGradient(0,0,720,720);water.addColorStop(0,'#537f80');water.addColorStop(1,'#244c5b');x.fillStyle=water;x.fillRect(0,0,720,720);
      for(let row=0;row<18;row++){x.beginPath();for(let xx=0;xx<=720;xx+=12){const yy=row*44+Math.sin(xx*.019+time*.00035+row)*3;xx?x.lineTo(xx,yy):x.moveTo(xx,yy);}x.strokeStyle='#b0dcd520';x.lineWidth=1.5;x.stroke();}
      for(const [a,b] of [[36,190],[680,330],[40,570],[480,690]]){ellipse(a,b,16,10,'#244b4650');ellipse(a-1,b-3,14,9,'#6c9e6e');line([a-1,b-3],[a+10,b-8],'#c0d293',1);}
    }else if(h.theme==='dunes'){
      x.fillStyle=x.createPattern(texture('sand'),'repeat');x.fillRect(0,0,720,720);
      for(let i=-2;i<12;i++){x.beginPath();x.moveTo(0,i*80);x.bezierCurveTo(230,i*80-100,490,i*80+140,720,i*80+30);x.lineWidth=24;x.strokeStyle='#f4d7a320';x.stroke();}
      for(const [a,b] of [[35,160],[680,490],[380,685]]){ellipse(a+4,b+6,22,10,'#624d4933');ellipse(a,b,18,12,'#8a7e69');ellipse(a-4,b-3,13,8,'#b3a18b');line([a-10,b],[a+5,b-4],'#d8c5a8',1);}
    }else{
      x.fillStyle=h.theme==='fair'?'#303d50':h.theme==='alpine'?'#526d65':'#526e55';x.fillRect(0,0,720,720);
      // Stone walk and low boundary edging give the whole course a built setting.
      x.strokeStyle=h.theme==='fair'?'#506077':'#899484';x.lineWidth=30;x.strokeRect(35,35,650,650);
      for(let i=0;i<18;i++){const p=35+i*38;line([p,20],[p,50],'#142d282a',1);line([p,670],[p,700],'#142d282a',1);line([20,p],[50,p],'#142d282a',1);line([670,p],[700,p],'#142d282a',1);}
      for(const [a,b] of [[32,120],[32,360],[32,600],[687,160],[687,400],[687,610],[150,32],[480,32],[230,685],[550,685]]){
        if(h.theme==='fair'){circle(a,b,10,'#172b4255');circle(a,b,4,'#ffdb8c');circle(a,b,2,'#fff8d2');}
        else if(h.theme==='alpine'){ellipse(a+4,b+7,20,12,'#1c3f3544');for(let k=0;k<3;k++){path([[a,b-26+k*10],[a-18+k*3,b+8+k*6],[a+18-k*3,b+8+k*6]]);x.fillStyle=['#284f45','#396657','#50816a'][k];x.fill();}}
        else{roundRect(a-13,b-23,26,46,9,'#1b3c2d');leaf(a,b,.58);}
      }
      if(h.theme==='fair'){line([36,30],[684,30],'#171f2d',2);for(let i=0;i<12;i++){const xx=62+i*54;circle(xx,31,5,i%2?'#f0c68c':'#92d3cf');}}
    }
    if(h.theme!=='lagoon'){
      x.globalAlpha=.5;x.fillStyle=x.createPattern(texture(h.theme==='dunes'?'sand':'grass'),'repeat');x.fillRect(0,0,720,720);x.globalAlpha=1;
      const spot=gardenSpot(h);if(spot){const {x:a,y:b}=spot,r=Math.min(90,spot.r-15);
        if(h.theme==='dunes'){for(const [dx,dy,k] of [[-.3,.1,1],[.25,-.2,.7],[.45,.35,.4]]){ellipse(a+dx*r+5,b+dy*r+7,40*k,30*k,'#6e5b4244');ellipse(a+dx*r,b+dy*r,38*k,27*k,'#9b886f');ellipse(a+dx*r-8*k,b+dy*r-8*k,24*k,15*k,'#c3ad85');}}
        else{
          circle(a,b,r,'#3e5d4966');circle(a,b,r-4,'#a4a48a');circle(a,b,r-12,'#c0bca0');
          for(let i=0;i<12;i++){const angle=i*Math.PI/6;line([a+Math.cos(angle)*(r-12),b+Math.sin(angle)*(r-12)],[a+Math.cos(angle)*(r-4),b+Math.sin(angle)*(r-4)],'#827d65',1);}
          circle(a,b,r*.52,'#667d6f');circle(a,b,r*.46,'#91b5ad');circle(a,b,r*.35,'#609894');ellipse(a-6,b-7,r*.22,r*.13,'#c3e3d044');circle(a,b,7,'#d6d4b2');
          for(const side of [-1,1]){roundRect(a-r*.65,b+side*r*.7-6,r*1.3,12,3,'#615844');for(let j=0;j<3;j++)line([a-r*.58,b+side*r*.7-4+j*4],[a+r*.58,b+side*r*.7-4+j*4],'#d6b781',2);leaf(a+side*r*.82,b,.6);}
        }
      }
    }
    x.save();x.translate(0,10);path(h.floor);x.fillStyle='#0b251f70';x.fill();x.lineJoin='round';x.lineWidth=28;x.strokeStyle='#0b251f70';x.stroke();x.restore();
    path(h.floor);x.lineJoin='round';x.strokeStyle='#71583f';x.lineWidth=28;x.stroke();x.strokeStyle=t.edge;x.lineWidth=20;x.stroke();x.strokeStyle='#f4dfaf';x.lineWidth=3;x.stroke();x.fillStyle=t.grass;x.fill();
    x.save();path(h.floor);x.clip();x.fillStyle=t.stripe;for(let i=-12;i<16;i++){x.save();x.translate(i*80,0);x.rotate(-.5);x.fillRect(0,-300,40,1500);x.restore();}
    const light=x.createLinearGradient(80,70,640,650);light.addColorStop(0,'#eef5b514');light.addColorStop(1,'#163c221c');x.fillStyle=light;x.fillRect(0,0,720,720);
    if(h.terrain?.length)x.drawImage(relief(h),0,0);
    x.fillStyle=x.createPattern(texture('grass'),'repeat');x.fillRect(0,0,720,720);
    for(const s of h.sand||[]){
      roundRect(s.x-2,s.y-2,s.w+4,s.h+4,19,'#24462655');roundRect(s.x,s.y,s.w,s.h,18,'#efe0a8');
      x.save();x.beginPath();x.roundRect(s.x+2,s.y+2,s.w-4,s.h-4,16);x.clip();
      const sand=x.createLinearGradient(s.x,s.y,s.x+s.w*.7,s.y+s.h);sand.addColorStop(0,'#b39760');sand.addColorStop(.18,'#d8bc80');sand.addColorStop(.6,'#e4ce97');sand.addColorStop(1,'#ead8a8');x.fillStyle=sand;x.fillRect(s.x,s.y,s.w,s.h);
      for(let r=0;r<s.h+25;r+=9){x.beginPath();x.moveTo(s.x-4,s.y+r);x.bezierCurveTo(s.x+s.w*.3,s.y+r-12,s.x+s.w*.65,s.y+r+13,s.x+s.w+4,s.y+r-5);x.strokeStyle='#9a7e4930';x.lineWidth=1;x.stroke();}
      x.fillStyle=x.createPattern(texture('sand'),'repeat');x.fillRect(s.x,s.y,s.w,s.h);x.restore();
    }
    path(h.floor);x.strokeStyle='#244a3133';x.lineWidth=7;x.stroke();
    for(const w of h.water||[]){roundRect(w.x-3,w.y-3,w.w+6,w.h+6,19,'#395f50');roundRect(w.x,w.y,w.w,w.h,16,t.water);x.save();x.beginPath();x.roundRect(w.x,w.y,w.w,w.h,16);x.clip();for(let row=0;row<8;row++){x.beginPath();for(let i=0;i<=w.w;i+=5){const yy=w.y+row*20+Math.sin(i*.05+time*.001+row)*2.5;i?x.lineTo(w.x+i,yy):x.moveTo(w.x+i,yy);}x.strokeStyle='#b0eddf35';x.lineWidth=2;x.stroke();}x.restore();ellipse(w.x+25,w.y+26,11,7,'#83b572');circle(w.x+25,w.y+26,3,'#efc5c9');}
    x.restore();
    for(const [a,b] of h.walls||[]){line([a[0]+2,a[1]+6],[b[0]+2,b[1]+6],'#24472b50',16);line(a,b,'#705c43',14);line(a,b,t.edge,10);line([a[0],a[1]-2],[b[0],b[1]-2],'#f1dfb4',2);}
    for(const c of h.conveyors||[]){
      roundRect(c.x-4,c.y-4,c.w+8,c.h+8,8,'#243d3b');roundRect(c.x,c.y,c.w,c.h,5,'#65766b');
      x.save();x.beginPath();x.rect(c.x,c.y,c.w,c.h);x.clip();const shift=(time*.055)%22;
      for(let i=-20;i<40;i++){const xx=c.x+i*22+Math.cos(c.angle)*shift,yy=c.y+i*22+Math.sin(c.angle)*shift;if(Math.abs(Math.cos(c.angle))>.5)line([xx,c.y],[xx,c.y+c.h],'#a8b494',2);else line([c.x,yy],[c.x+c.w,yy],'#a8b494',2);}
      x.restore();x.save();x.translate(c.x+c.w/2,c.y+c.h/2);x.rotate(c.angle);path([[-13,-10],[3,-10],[3,-17],[20,0],[3,17],[3,10],[-13,10]]);x.fillStyle='#f0d89b';x.fill();x.restore();
    }
    for(const r of h.ramps||[]){
      x.save();x.translate(r.x,r.y);x.rotate(r.angle+Math.PI/2);
      path([[-r.width/2,8],[r.width/2+9,8],[r.width/2+9,r.length+8],[-r.width/2,r.length+8]]);x.fillStyle='#14382b55';x.fill();
      path([[-r.width/2,-r.height],[r.width/2,-r.height],[r.width/2,r.length],[-r.width/2,r.length]]);const surface=x.createLinearGradient(0,-r.height,0,r.length);surface.addColorStop(0,'#d9c39a');surface.addColorStop(1,'#947850');x.fillStyle=surface;x.fill();
      for(let i=0;i<8;i++){const y=-r.height+i*(r.length+r.height)/8;line([-r.width/2+3,y],[r.width/2-3,y],'#f6ddb175',1.5);}
      for(const side of [-1,1]){line([side*r.width/2,-r.height],[side*r.width/2,r.length],'#574e3d',6);line([side*r.width/2-1,-r.height],[side*r.width/2-1,r.length],'#edce91',2);}
      line([-r.width/2,-r.height],[r.width/2,-r.height],'#f8e1a6',5);x.restore();
    }
    for(const b of h.bumpers||[]){
      const hit=effects.find(e=>e.type==='bumper'&&Math.hypot(e.x-b.x,e.y-b.y)<2&&e.age<450),pulse=hit?Math.sin(hit.age/450*Math.PI)*5:0;
      ellipse(b.x+3,b.y+8,b.r+4,b.r,'#16382c66');circle(b.x,b.y,b.r+3,'#173e52');
      for(let i=0;i<3;i++)ellipse(b.x,b.y+5-i*3,b.r-3,b.r-7,i%2?'#6e8b94':'#c8d5c5');
      circle(b.x,b.y-2,b.r+pulse,'#cae8d9');circle(b.x,b.y-2,b.r-4+pulse,'#3c9fbd');circle(b.x-3,b.y-6,b.r-10,'#6ac8d4');
      x.beginPath();x.moveTo(b.x-8,b.y-5);x.lineTo(b.x-2,b.y+2);x.lineTo(b.x+2,b.y-8);x.lineTo(b.x+7,b.y);x.strokeStyle='#f4f1cd';x.lineWidth=3;x.stroke();
      for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5])circle(b.x+Math.cos(angle)*(b.r-2),b.y-2+Math.sin(angle)*(b.r-2),2,'#fff0b7');
      if(hit){x.globalAlpha=1-hit.age/450;x.beginPath();x.arc(b.x,b.y,b.r+8+hit.age*.04,0,Math.PI*2);x.strokeStyle='#c7eff1';x.lineWidth=2;x.stroke();x.globalAlpha=1;}
    }
    if(h.gate){const g=h.gate,seg=P.gateSegment(h,time/1000);circle(g.x,g.y,20,'#3d654533');line(...seg,'#594e45',19);line(...seg,'#e7c590',13);line([seg[0][0],seg[0][1]-2],[seg[1][0],seg[1][1]-2],'#fff1c6',3);circle(g.x,g.y,13,'#eee0b9');circle(g.x,g.y,6,'#9a6654');}
    if(h.portal){const m=h.portal.mouth,e=h.portal.exit;
      // Mouth and rump are the two visible ends of an underground hippo tunnel.
      x.save();x.translate(m[0],m[1]);ellipse(0,-30,45,37,'#34464355');ellipse(0,-38,41,40,'#9b91b1');ellipse(-33,-61,12,11,'#b9a9cb');ellipse(33,-61,12,11,'#b9a9cb');ellipse(-33,-62,6,6,'#8d7e9d');ellipse(33,-62,6,6,'#8d7e9d');ellipse(-19,-44,10,12,'#c7bbd6');ellipse(19,-44,10,12,'#c7bbd6');circle(-18,-43,4,'#28283b');circle(18,-43,4,'#28283b');ellipse(0,-12,42,29,'#b9abc9');ellipse(0,2,31,17+(portalPulse?3:0),'#51405f');ellipse(0,8,19,7,'#b4778d');roundRect(-23,-12,10,13,3,'#f5e7cc');roundRect(13,-12,10,13,3,'#f5e7cc');ellipse(-15,-23,5,3,'#877397');ellipse(15,-23,5,3,'#877397');x.restore();
      x.save();x.translate(...e);x.rotate(h.portal.angle+Math.PI/2);ellipse(0,31,36,34,'#968baa');ellipse(-18,16,21,25,'#b2a4c4');ellipse(18,16,21,25,'#a598b8');ellipse(0,0,12,8,'#67536f');x.beginPath();x.moveTo(1,25);x.quadraticCurveTo(25,36,17,47);x.strokeStyle='#d3c4dd';x.lineWidth=6;x.lineCap='round';x.stroke();x.restore();
    }
    // Cup, flag and tee are always in the same world coordinates as collision.
    circle(...h.tee,18,'#f0e7cd25');circle(...h.tee,3,'#ebedc566');ellipse(h.cup[0]+3,h.cup[1]+3,17,13,'#426d3c55');circle(...h.cup,15,'#c0cb95');circle(...h.cup,12,'#17392a');circle(h.cup[0]+1,h.cup[1]+2,8,'#0b221c');
    line([h.cup[0],h.cup[1]-3],[h.cup[0],h.cup[1]-70],'#f8e7bd',3);x.beginPath();x.moveTo(h.cup[0]+2,h.cup[1]-70);x.lineTo(h.cup[0]+36,h.cup[1]-58+Math.sin(time*.002)*2);x.lineTo(h.cup[0]+2,h.cup[1]-46);x.fillStyle='#d92d3e';x.fill();line([h.cup[0]+4,h.cup[1]-67],[h.cup[0]+25,h.cup[1]-59],'#ff7c78',2);
    for(const [i,b] of [...balls.entries()].sort(([a],[b])=>Number(a===active)-Number(b===active))){if(b.holed||b.alpha===0)continue;const [a,groundY]=b.position,elevation=Math.max(b.z||0,P.rampHeight(h,...b.position))+P.terrainAt(h,...b.position).height*1.8,c=groundY-elevation,color=B.get(colors[i]);const alpha=b.alpha??1;x.globalAlpha=(i!==active&&ghost?0.65:1)*alpha;ellipse(a+2+Math.max(0,elevation)*.2,groundY+5,10+Math.max(0,elevation)*.06,6+Math.max(0,elevation)*.03,'#163a2855');const gradient=x.createRadialGradient(a-3,c-4,1,a,c,10);gradient.addColorStop(0,color.light);gradient.addColorStop(.6,color.base);gradient.addColorStop(1,color.dark);circle(a,c,9+Math.min(3,(b.z||0)*.025),gradient);circle(a-3,c-4,2,'#ffffffa0');if(i===active){x.beginPath();x.arc(a,c,15+Math.sin(time*.003)*1.3,0,Math.PI*2);x.strokeStyle='#fff1b477';x.lineWidth=1.5;x.stroke();}x.globalAlpha=1;}
    const cupEffect=effects.find(e=>e.type==='cup'&&e.age<window.PuttRules.CUP_FEEDBACK_MS);
    if(cupEffect){
      const progress=cupEffect.age/window.PuttRules.CUP_FEEDBACK_MS,reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches,color=B.get(colors[cupEffect.player]);
      if(progress<.5){const p=progress*2,angle=reduced?0:p*Math.PI*3,r=(1-p)*7;circle(h.cup[0]+Math.cos(angle)*r,h.cup[1]+Math.sin(angle)*r,Math.max(.1,9*(1-p)),color.base);}
      x.globalAlpha=1-progress;x.beginPath();x.arc(...h.cup,18+progress*(reduced?4:34),0,Math.PI*2);x.strokeStyle='#f8e9a8';x.lineWidth=3;x.stroke();
      if(!reduced)for(let i=0;i<8;i++){const angle=i*Math.PI/4,d=22+progress*45;circle(h.cup[0]+Math.cos(angle)*d,h.cup[1]+Math.sin(angle)*d,2.5*(1-progress),i%2?'#d4ee94':'#ffe2a6');}
      roundRect(h.cup[0]-27,h.cup[1]-102-(reduced?0:progress*12),54,22,8,'#f9ebbb');x.fillStyle='#315634';x.font='bold 12px system-ui';x.textAlign='center';x.fillText('SUNK!',h.cup[0],h.cup[1]-87-(reduced?0:progress*12));x.globalAlpha=1;
    }
    if(you>=0&&balls[you]&&!balls[you].holed&&!aim&&(!ghost||balls[you].alpha!==0)){
      const [a,gy]=balls[you].position,b=gy-Math.max(balls[you].z||0,P.rampHeight(h,a,gy))-P.terrainAt(h,a,gy).height*1.8;roundRect(a-20,b-39,40,17,6,playable?'#f3edcfe8':'#173b32bf');x.fillStyle=playable?'#234533':'#e3edcc';x.font='bold 9px system-ui';x.textAlign='center';x.fillText('YOU',a,b-27);
    }
    if(aim){const {angle,power}=aim,p=[aim.position[0],aim.position[1]-P.rampHeight(h,...aim.position)-P.terrainAt(h,...aim.position).height*1.8],length=48+power*106,end=[p[0]+Math.cos(angle)*length,p[1]+Math.sin(angle)*length];
      x.save();x.translate(...p);x.rotate(angle);x.beginPath();x.moveTo(22,-7);x.lineTo(length-17,-7);x.lineTo(length-17,-16);x.lineTo(length,0);x.lineTo(length-17,16);x.lineTo(length-17,7);x.lineTo(22,7);x.closePath();x.fillStyle='#f6e8ca35';x.fill();x.strokeStyle='#fff1d7';x.lineWidth=2;x.stroke();x.save();x.clip();x.fillStyle=power>.8?'#f2ae80':'#d9f29d';x.fillRect(20,-17,(length-20)*power,34);x.restore();x.save();x.setLineDash([4,6]);line([-16,0],[-20-power*100,0],'#ffffff99',2);x.restore();const club=-26-power*44;line([club,-12],[club-27,-65],'#f0e8d2',3);line([club-22,-55],[club-29,-69],'#a9704f',6);roundRect(club-5,-13,10,27,3,'#173d31');roundRect(club-4,-12,7,24,2,'#eef0dc');x.restore();circle(end[0],end[1],2,'#ffebce');
    }
    x.fillStyle='#e6e5c77d';x.font='700 10px system-ui';x.textAlign='left';x.fillText('POCKET PUTT  /  '+h.name.toUpperCase(),22,700);
  }
  window.PuttRenderer={render};
})();
