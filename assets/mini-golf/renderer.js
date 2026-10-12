/* POCKET_PUTT_V1 — live canvas artwork, sized independently of game coordinates. */
(()=>{
  'use strict';
  const C=window.PuttCourses,P=window.PuttPhysics;
  const themes={garden:{bg:'#234639',grass:'#79a94f',stripe:'#81b157',edge:'#dac293',water:'#4b9fa5',flower:'#f2baa5'},lagoon:{bg:'#234748',grass:'#6aa669',stripe:'#73b173',edge:'#dabd90',water:'#438e9b',flower:'#c8b6e4'},fair:{bg:'#303744',grass:'#6c9471',stripe:'#759e79',edge:'#dec091',water:'#597fb1',flower:'#f1c27d'}};
  function render(canvas,h,{balls=[],time=0,aim=null,active=0,ghost=false,portalPulse=0}={}){
    const x=canvas.getContext('2d'),dpr=Math.min(2,window.devicePixelRatio||1),size=Math.max(240,Math.round(canvas.clientWidth*dpr));if(canvas.width!==size||canvas.height!==size){canvas.width=canvas.height=size;}
    x.setTransform(size/720,0,0,size/720,0,0);x.clearRect(0,0,720,720);const t=themes[h.theme];
    function path(points){x.beginPath();points.forEach((p,i)=>i?x.lineTo(...p):x.moveTo(...p));x.closePath();}
    function line(a,b,color,width){x.beginPath();x.moveTo(...a);x.lineTo(...b);x.strokeStyle=color;x.lineWidth=width;x.lineCap='round';x.stroke();}
    function circle(a,b,r,color){x.beginPath();x.arc(a,b,r,0,Math.PI*2);x.fillStyle=color;x.fill();}
    function ellipse(a,b,rx,ry,color){x.beginPath();x.ellipse(a,b,rx,ry,0,0,Math.PI*2);x.fillStyle=color;x.fill();}
    function roundRect(a,b,w,h,r,color){x.beginPath();x.roundRect(a,b,w,h,r);x.fillStyle=color;x.fill();}
    function leaf(a,b,s=1){x.save();x.translate(a,b);x.scale(s,s);ellipse(2,9,28,13,'#102e2755');for(let i=0;i<5;i++){x.save();x.rotate(i*1.25);ellipse(0,-14,10,21,i%2?'#365f42':'#446e47');x.restore();}circle(0,0,6,'#597c49');x.restore();}
    x.fillStyle=t.bg;x.fillRect(0,0,720,720);
    for(let i=0;i<75;i++){const xx=(i*173+23)%720,yy=(i*233+11)%720;circle(xx,yy,1.4,'#9fc39812');}
    // Decorative gravel, flowers, and bushes remain outside the playable green.
    for(let i=0;i<30;i++){const xx=(i*137+27)%690+15,yy=(i*191+45)%690+15;if(!P.inside(xx,yy,h.floor)){ellipse(xx,yy,6+(i%3)*2,4,'#a8b29b21');if(i%3===0)leaf(xx,yy,.7);else{for(let j=0;j<5;j++)circle(xx+Math.cos(j*1.26)*4,yy+Math.sin(j*1.26)*4,3,t.flower);circle(xx,yy,2,'#fff0b3');}}}
    x.save();x.translate(0,10);path(h.floor);x.fillStyle='#0b251f70';x.fill();x.lineJoin='round';x.lineWidth=28;x.strokeStyle='#0b251f70';x.stroke();x.restore();
    path(h.floor);x.lineJoin='round';x.strokeStyle='#71583f';x.lineWidth=28;x.stroke();x.strokeStyle=t.edge;x.lineWidth=20;x.stroke();x.strokeStyle='#f4dfaf';x.lineWidth=3;x.stroke();x.fillStyle=t.grass;x.fill();
    x.save();path(h.floor);x.clip();x.fillStyle=t.stripe;for(let i=-12;i<16;i++){x.save();x.translate(i*80,0);x.rotate(-.5);x.fillRect(0,-300,40,1500);x.restore();}
    for(let i=0;i<480;i++){const xx=(i*83+23)%720,yy=(i*157+17)%720;x.fillStyle=i%2?'#e5efbc13':'#17472112';x.fillRect(xx,yy,1.6,2.5);}
    for(const s of h.sand||[]){roundRect(s.x,s.y,s.w,s.h,18,'#4a693033');roundRect(s.x+3,s.y+3,s.w-6,s.h-6,16,'#d6bb7e');for(let i=0;i<35;i++)circle(s.x+8+(i*37)%(s.w-16),s.y+8+(i*23)%(s.h-16),1.3,'#aa8c5066');}
    for(const w of h.water||[]){roundRect(w.x-3,w.y-3,w.w+6,w.h+6,19,'#395f50');roundRect(w.x,w.y,w.w,w.h,16,t.water);x.save();x.beginPath();x.roundRect(w.x,w.y,w.w,w.h,16);x.clip();for(let row=0;row<8;row++){x.beginPath();for(let i=0;i<=w.w;i+=5){const yy=w.y+row*20+Math.sin(i*.05+time*.001+row)*2.5;i?x.lineTo(w.x+i,yy):x.moveTo(w.x+i,yy);}x.strokeStyle='#b0eddf35';x.lineWidth=2;x.stroke();}x.restore();ellipse(w.x+25,w.y+26,11,7,'#83b572');circle(w.x+25,w.y+26,3,'#efc5c9');}
    x.restore();
    for(const [a,b] of h.walls||[]){line([a[0]+2,a[1]+6],[b[0]+2,b[1]+6],'#24472b50',16);line(a,b,'#705c43',14);line(a,b,t.edge,10);line([a[0],a[1]-2],[b[0],b[1]-2],'#f1dfb4',2);}
    for(const b of h.bumpers||[]){ellipse(b.x+3,b.y+7,b.r+3,b.r,'#26433055');circle(b.x,b.y,b.r+3,'#705548');circle(b.x,b.y,b.r,'#ebad82');circle(b.x,b.y,b.r-5,'#f3d6a0');circle(b.x,b.y,b.r-11,'#ce775e');circle(b.x-5,b.y-6,5,'#ffe1b1');}
    if(h.gate){const g=h.gate,seg=P.gateSegment(h,time/1000);circle(g.x,g.y,20,'#3d654533');line(...seg,'#594e45',19);line(...seg,'#e7c590',13);line([seg[0][0],seg[0][1]-2],[seg[1][0],seg[1][1]-2],'#fff1c6',3);circle(g.x,g.y,13,'#eee0b9');circle(g.x,g.y,6,'#9a6654');}
    if(h.portal){const m=h.portal.mouth,e=h.portal.exit;
      // Mouth and rump are the two visible ends of an underground hippo tunnel.
      x.save();x.translate(m[0],m[1]);ellipse(0,-30,45,37,'#34464355');ellipse(0,-38,41,40,'#9b91b1');ellipse(-33,-61,12,11,'#b9a9cb');ellipse(33,-61,12,11,'#b9a9cb');ellipse(-33,-62,6,6,'#8d7e9d');ellipse(33,-62,6,6,'#8d7e9d');ellipse(-19,-44,10,12,'#c7bbd6');ellipse(19,-44,10,12,'#c7bbd6');circle(-18,-43,4,'#28283b');circle(18,-43,4,'#28283b');ellipse(0,-12,42,29,'#b9abc9');ellipse(0,2,31,17+(portalPulse?3:0),'#51405f');ellipse(0,8,19,7,'#b4778d');roundRect(-23,-12,10,13,3,'#f5e7cc');roundRect(13,-12,10,13,3,'#f5e7cc');ellipse(-15,-23,5,3,'#877397');ellipse(15,-23,5,3,'#877397');x.restore();
      x.save();x.translate(...e);x.rotate(h.portal.angle+Math.PI/2);ellipse(0,31,36,34,'#968baa');ellipse(-18,16,21,25,'#b2a4c4');ellipse(18,16,21,25,'#a598b8');ellipse(0,0,12,8,'#67536f');x.beginPath();x.moveTo(1,25);x.quadraticCurveTo(25,36,17,47);x.strokeStyle='#d3c4dd';x.lineWidth=6;x.lineCap='round';x.stroke();x.restore();
    }
    // Cup, flag and tee are always in the same world coordinates as collision.
    circle(...h.tee,18,'#f0e7cd25');circle(...h.tee,3,'#ebedc566');ellipse(h.cup[0]+3,h.cup[1]+3,17,13,'#426d3c55');circle(...h.cup,15,'#c0cb95');circle(...h.cup,12,'#17392a');circle(h.cup[0]+1,h.cup[1]+2,8,'#0b221c');
    line([h.cup[0],h.cup[1]-3],[h.cup[0],h.cup[1]-70],'#f8e7bd',3);x.beginPath();x.moveTo(h.cup[0]+2,h.cup[1]-70);x.lineTo(h.cup[0]+36,h.cup[1]-58+Math.sin(time*.002)*2);x.lineTo(h.cup[0]+2,h.cup[1]-46);x.fillStyle='#ee9d80';x.fill();
    for(const [i,b] of [...balls.entries()].sort(([a],[b])=>Number(a===active)-Number(b===active))){if(b.holed||b.alpha===0)continue;const [a,c]=b.position;const alpha=b.alpha??1;x.globalAlpha=(i!==active&&ghost?0.55:1)*alpha;ellipse(a+2,c+5,10,6,'#163a2866');const gradient=x.createRadialGradient(a-3,c-4,1,a,c,10);gradient.addColorStop(0,i===0?'#fffdf2':'#ffe2c4');gradient.addColorStop(.6,i===0?'#ede9d8':'#e9a084');gradient.addColorStop(1,i===0?'#b6bca7':'#b97360');circle(a,c,9,gradient);circle(a-3,c-4,2,'#ffffffa0');if(i===active){x.beginPath();x.arc(a,c,15+Math.sin(time*.003)*1.3,0,Math.PI*2);x.strokeStyle='#fff1b477';x.lineWidth=1.5;x.stroke();}x.globalAlpha=1;}
    if(aim){const {position:p,angle,power}=aim,length=48+power*106,end=[p[0]+Math.cos(angle)*length,p[1]+Math.sin(angle)*length];
      x.save();x.translate(...p);x.rotate(angle);x.beginPath();x.moveTo(22,-7);x.lineTo(length-17,-7);x.lineTo(length-17,-16);x.lineTo(length,0);x.lineTo(length-17,16);x.lineTo(length-17,7);x.lineTo(22,7);x.closePath();x.fillStyle='#f6e8ca35';x.fill();x.strokeStyle='#fff1d7';x.lineWidth=2;x.stroke();x.save();x.clip();x.fillStyle=power>.8?'#f2ae80':'#d9f29d';x.fillRect(20,-17,(length-20)*power,34);x.restore();x.setLineDash([4,6]);line([-16,0],[-20-power*100,0],'#ffffff99',2);x.restore();circle(end[0],end[1],2,'#ffebce');
    }
    x.fillStyle='#e6e5c77d';x.font='700 10px system-ui';x.textAlign='left';x.fillText('POCKET PUTT  /  '+h.name.toUpperCase(),22,700);
  }
  window.PuttRenderer={render};
})();
