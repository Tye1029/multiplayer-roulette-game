/* ROCKET_RUN_SCENE_V3: world-anchored moon, celebration bursts and fiery breakup. */
(() => {
 'use strict';
 class RocketScene{
  constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.ship=new Image();this.ship.src='/assets/rocket-run/rocket.svg?v=ROCKET_RUN_V1';this.ship.onload=()=>this.draw(this.state);this.state={phase:'ready',elapsed:0,multiplier:1};this.reduced=matchMedia('(prefers-reduced-motion:reduce)');this.resize=new ResizeObserver(()=>this.draw(this.state));this.resize.observe(canvas);this.effectAt=0;this.outcome='';}
  setFlight(id='preview'){
   if(this.flightId===id)return;this.flightId=id;let seed=2166136261;for(const letter of id)seed=Math.imul(seed^letter.charCodeAt(0),16777619)>>>0;this.seed=seed;
   // Render the moon once per flight. Surface normals give each phase a curved
   // terminator, shaded craters and a faint earthlit dark side.
   this.moon=document.createElement('canvas');this.moon.width=this.moon.height=128;
   const ctx=this.moon.getContext('2d'),pixels=ctx.createImageData(128,128),phase=(seed%8)/8,angle=phase*Math.PI*2,lx=Math.sin(angle),lz=-Math.cos(angle);
   const craters=[[-.32,-.24,.16],[.26,.35,.21],[.3,-.36,.12],[-.15,.5,.09],[-.56,.16,.08]];
   for(let y=0;y<128;y++)for(let x=0;x<128;x++){
    const nx=(x-63.5)/62,ny=(y-63.5)/62,r2=nx*nx+ny*ny;if(r2>1)continue;const nz=Math.sqrt(1-r2);
    let shade=.1+.9*Math.max(0,nx*lx+nz*lz);for(const [cx,cy,r] of craters){const d=Math.hypot(nx-cx,ny-cy)/r;if(d<1)shade*=.76+.22*d;else if(d<1.12)shade*=1.07;}
    shade*=.92+.08*Math.sin(x*1.27+y*.71)*Math.cos(y*2.41);const at=(y*128+x)*4;
    pixels.data[at]=206*shade;pixels.data[at+1]=218*shade;pixels.data[at+2]=225*shade;pixels.data[at+3]=Math.min(255,(1-r2)*6000);
   }ctx.putImageData(pixels,0,0);
  }
  position(t){
   const lift=1-Math.exp(-t/2.1),sway=1-Math.exp(-t/4),phase=(this.seed%11)*.2;
   return {x:260+lift*(315+sway*(112*Math.sin(t*.43+phase)+34*Math.sin(t*.91))),y:575-lift*(169+28*Math.sin(t*.67)+15*Math.sin(t*.29))};
  }
  moonPosition(t){
   // The moon stays at one world altitude while the camera climbs past it.
   // Never wrap it back into view, including on very long flights.
   const travel=48*(t-2*(1-Math.exp(-t/2)));
   return {x:810-(this.seed%55),y:260+(this.seed%35)+travel};
  }
  sky(c,t){
   const {x:mx,y:my}=this.moonPosition(t);
   if(my<895){const glow=c.createRadialGradient(mx,my,45,mx,my,115);glow.addColorStop(0,'#adccde13');glow.addColorStop(1,'#adccde00');c.fillStyle=glow;c.fillRect(mx-115,my-115,230,230);c.drawImage(this.moon,mx-57,my-57,114,114);}
   if(this.reduced.matches)return;
   const pass=((t+(this.seed%43))%49)/14;
   if(pass<1){c.save();c.translate(-110+pass*1250,240+Math.sin(pass*Math.PI)*65);c.rotate(-.2+pass*.35);c.globalAlpha=.72;const metal=c.createLinearGradient(-8,-12,8,12);metal.addColorStop(0,'#e0c88e');metal.addColorStop(1,'#6a6867');c.fillStyle=metal;c.fillRect(-10,-12,20,24);c.fillStyle='#264665';c.strokeStyle='#8aacc2';c.lineWidth=1;
    for(const side of [-1,1]){const x=side<0?-54:17;c.fillRect(x,-17,37,34);c.strokeRect(x,-17,37,34);c.beginPath();for(let k=1;k<4;k++){c.moveTo(x+k*9,-17);c.lineTo(x+k*9,17);}c.moveTo(x,0);c.lineTo(x+37,0);c.moveTo(side*10,0);c.lineTo(side*17,0);c.stroke();}
    c.strokeStyle='#b6c5c9';c.beginPath();c.moveTo(0,-12);c.lineTo(8,-27);c.stroke();c.fillStyle='#d7dfce';c.beginPath();c.arc(9,-28,2,0,Math.PI*2);c.fill();c.restore();
   }
   const shooting=(t+(this.seed%190)/10)%23;
   if(shooting<1.1){const p=shooting/1.1,x=160+p*610,y=190+p*195;c.save();c.globalAlpha=Math.sin(p*Math.PI)*.8;const trail=c.createLinearGradient(x-125,y-40,x,y);trail.addColorStop(0,'#c5e9ff00');trail.addColorStop(1,'#e4f4ff');c.strokeStyle=trail;c.lineWidth=2;c.beginPath();c.moveTo(x-125,y-40);c.lineTo(x,y);c.stroke();c.fillStyle='#fff7df';c.beginPath();c.arc(x,y,2,0,Math.PI*2);c.fill();c.restore();}
  }
  draw(state=this.state){if(!state)return;this.state=state;const c=this.ctx,w=1000,h=780,dpr=Math.min(devicePixelRatio||1,2),width=Math.max(1,Math.round(this.canvas.clientWidth*dpr));if(this.canvas.width!==width){this.canvas.width=width;this.canvas.height=Math.round(width*h/w);}c.setTransform(this.canvas.width/w,0,0,this.canvas.height/h,0,0);
   this.setFlight(state.flightId);const t=Math.max(0,state.elapsed)/1000,flying=state.phase==='flight',ended=['crash','win'].includes(state.phase),progress=Math.min(1,t/11),motion=this.reduced.matches?0:t;
   const bg=c.createLinearGradient(0,0,0,h);bg.addColorStop(0,'#0b1425');bg.addColorStop(.55,'#1b3149');bg.addColorStop(1,'#43576c');c.fillStyle=bg;c.fillRect(0,0,w,h);
   const aura=c.createRadialGradient(770,480,20,770,480,550);aura.addColorStop(0,'#71999a22');aura.addColorStop(1,'#71999a00');c.fillStyle=aura;c.fillRect(0,0,w,h);
   // Stable star positions: no frame-to-frame randomness or flicker.
   for(let i=0;i<86;i++){const x=(i*173.23+49)%w,y=((i*113.79+15)+(motion*(8+i%9)))%h;c.globalAlpha=.2+(i%5)*.12;c.fillStyle='#dce9df';c.beginPath();c.arc(x,y,i%7===0?1.8:.8,0,Math.PI*2);c.fill();}c.globalAlpha=1;
   this.sky(c,t);
   c.save();c.translate(0,progress*260);c.fillStyle='#91b8be24';c.beginPath();c.ellipse(400,1110,1000,540,-.08,Math.PI,Math.PI*2);c.fill();c.strokeStyle='#a0cbd844';c.lineWidth=3;c.stroke();
   for(let layer=0;layer<3;layer++){c.fillStyle=['#33495e','#263b50','#192d42'][layer];c.beginPath();c.moveTo(0,h);for(let x=0;x<=1100;x+=55)c.lineTo(x,650+layer*44+Math.sin(x*.016+layer*3)*22+Math.cos(x*.031+layer)*15);c.lineTo(1100,1000);c.lineTo(0,1000);c.fill();}
   c.fillStyle='#111f32';for(let i=0;i<20;i++){const x=i*55,hei=20+(i*37%95);c.fillRect(x,765-hei,38,hei);c.fillStyle='#d1b88855';for(let row=0;row<3;row++)if(i%3)c.fillRect(x+9,775-hei+row*12,3,4);c.fillStyle='#111f32';}c.restore();
   // Soft cloud banks descend as the camera follows the rocket.
   for(let i=0;i<5;i++){const y=(480+i*162+(motion*22))%1000-80,x=(i*273+40)%1100-80;c.save();c.translate(x,y);c.scale(1.4,.4);const cloud=c.createRadialGradient(0,0,0,0,0,115);cloud.addColorStop(0,'#c0d7da13');cloud.addColorStop(1,'#c0d7da00');c.fillStyle=cloud;c.fillRect(-115,-115,230,230);c.restore();}
   c.strokeStyle='#b7c9cf20';c.lineWidth=1;for(let y=100;y<700;y+=80){c.beginPath();c.moveTo(24,y);c.lineTo(36,y);c.moveTo(964,y);c.lineTo(976,y);c.stroke();}
   const point=this.position(this.reduced.matches?Math.min(t,5):t),ahead=this.position((this.reduced.matches?Math.min(t,5):t)+.05),{x,y}=point,angle=(1-Math.exp(-t))*(this.reduced.matches?.1:Math.max(-.53,Math.min(.53,Math.atan2((ahead.x-x)/.05,130-(ahead.y-y)/.05)))),scale=.78;
   c.save();c.strokeStyle='#f3c49b28';c.lineWidth=2;c.beginPath();for(let i=0;i<=40;i++){const age=(40-i)/8,p=this.position(Math.max(0,t-age)),py=p.y+90+age*95;if(i===0)c.moveTo(p.x,py);else c.lineTo(p.x,py);}c.stroke();c.restore();
   c.save();c.translate(260,715+progress*260);c.fillStyle='#778896';c.fillRect(-95,0,190,9);c.fillStyle='#2a3c4f';c.fillRect(-80,9,160,16);c.strokeStyle='#8293a0';c.lineWidth=5;c.beginPath();c.moveTo(-106,12);c.lineTo(-106,-205);c.lineTo(-88,-205);c.moveTo(-106,-180);c.lineTo(-43,-180);c.stroke();c.fillStyle='#e8b991';c.fillRect(-111,-213,10,5);c.restore();
   if(this.outcome!==state.phase&&ended){this.effectAt=performance.now();this.outcome=state.phase;}if(!ended)this.outcome='';
   const effect=Math.max(0,(performance.now()-this.effectAt)/1000);
   if(state.phase!=='crash'){
    c.save();c.translate(x,y);c.rotate(angle);c.scale(scale,scale);
    if(flying){const len=this.reduced.matches?150:160+Math.sin(motion*37)*13+Math.sin(motion*21)*8,g=c.createLinearGradient(0,130,0,130+len);g.addColorStop(0,'#fff5c6');g.addColorStop(.25,'#ffc484');g.addColorStop(.7,'#ed886966');g.addColorStop(1,'#ed886900');c.fillStyle=g;c.beginPath();c.moveTo(-18,137);c.quadraticCurveTo(-30,195,0,137+len);c.quadraticCurveTo(30,195,18,137);c.fill();c.fillStyle='#fffadc';c.beginPath();c.moveTo(-8,141);c.quadraticCurveTo(-9,185,0,226);c.quadraticCurveTo(9,185,8,141);c.fill();}
    if(this.ship.complete&&this.ship.naturalWidth)c.drawImage(this.ship,-100,-200,200,400);c.restore();
   }
   if(ended&&effect<2.5){
    c.save();c.translate(x,y);
    // Reduced motion keeps a soft, still result glow instead of flying debris.
    if(this.reduced.matches){const glow=c.createRadialGradient(0,0,12,0,0,130);glow.addColorStop(0,state.phase==='win'?'#f6d89544':'#e8622444');glow.addColorStop(1,'#00000000');c.globalAlpha=Math.max(0,1-effect/2.5);c.fillStyle=glow;c.fillRect(-130,-130,260,260);}
    else if(state.phase==='win')this.celebrate(c,effect);
    else this.breakup(c,effect);
    c.restore();
   }
   c.font='11px system-ui';c.fillStyle='#9cb6c366';c.textAlign='right';c.fillText('XAN AEROSPACE / RR–01',960,749);
  }
  celebrate(c,t){
   const fade=Math.max(0,1-t/2.5),spread=1-Math.exp(-t*4);
   const halo=c.createRadialGradient(0,0,30,0,0,180);halo.addColorStop(0,'#ffdb922a');halo.addColorStop(1,'#ffdb9200');c.globalAlpha=fade;c.fillStyle=halo;c.fillRect(-180,-180,360,360);
   // Three gold/teal fireworks surround the intact rocket; no fire or wreckage.
   for(let burst=0;burst<3;burst++){
    const age=t-burst*.19;if(age<0)continue;
    const bx=[-138,136,16][burst],by=[-66,-113,90][burst];
    c.globalAlpha=fade*Math.min(1,age*12);c.lineWidth=1.8;
    for(let i=0;i<16;i++){
     const a=i*Math.PI/8+burst*.2,r=18+(1-Math.exp(-age*2.5))*(58+i%3*12),tail=Math.max(0,r-14-age*7);
     c.strokeStyle=i%3===0?'#9fece1':'#ffe3a2';c.beginPath();c.moveTo(bx+Math.cos(a)*tail,by+Math.sin(a)*tail+age*age*14);c.lineTo(bx+Math.cos(a)*r,by+Math.sin(a)*r+age*age*14);c.stroke();
    }
   }
   for(let i=0;i<48;i++){
    const a=i*2.39996,r=(55+i*31%155)*spread,px=Math.cos(a)*r,py=Math.sin(a)*r+t*t*28;
    c.globalAlpha=fade*(.65+.35*Math.sin(i+t*3)**2);c.fillStyle=i%4===0?'#a6eee3':'#f7d17f';c.save();c.translate(px,py);c.rotate(a+t*(i%2?1:-1));
    if(i%3===0){c.beginPath();c.moveTo(0,-7);c.lineTo(2,-2);c.lineTo(7,0);c.lineTo(2,2);c.lineTo(0,7);c.lineTo(-2,2);c.lineTo(-7,0);c.lineTo(-2,-2);c.closePath();c.fill();}
    else c.fillRect(-2,-4,4*Math.cos(t*4+i),8);c.restore();
   }
  }
  breakup(c,t){
   const fade=Math.max(0,1-t/2.5),heat=Math.max(0,1-t/1.15),spread=1-Math.exp(-t*5);
   // Dark, overlapping smoke rolls outward and rises behind the fireball.
   for(let i=0;i<14;i++){
    const a=i*2.39996+(this.seed%13),r=(26+i*19%74)*spread,px=Math.cos(a)*r,py=Math.sin(a)*r-t*42,size=24+t*25+i%4*5;
    const smoke=c.createRadialGradient(px-size*.2,py-size*.25,2,px,py,size);smoke.addColorStop(0,'#343039e0');smoke.addColorStop(.65,'#202432bb');smoke.addColorStop(1,'#20243200');c.globalAlpha=fade*Math.min(1,.3+t*3);c.fillStyle=smoke;c.fillRect(px-size,py-size,size*2,size*2);
   }
   if(heat>0){
    const radius=50+spread*135,glow=c.createRadialGradient(0,0,8,0,0,radius);glow.addColorStop(0,'#ffd17bb0');glow.addColorStop(.4,'#ef621d70');glow.addColorStop(1,'#e34a1000');c.globalAlpha=heat;c.fillStyle=glow;c.fillRect(-radius,-radius,radius*2,radius*2);
    for(let i=0;i<12;i++){
     const a=i*2.39996,r=(16+i*17%58)*spread,px=Math.cos(a)*r,py=Math.sin(a)*r-t*23,size=(28+i%4*9)*(1+t*.5);
     const fire=c.createRadialGradient(px-size*.18,py-size*.2,0,px,py,size);fire.addColorStop(0,'#fff2bd');fire.addColorStop(.22,'#ffc351');fire.addColorStop(.53,'#f56c17');fire.addColorStop(.8,'#b82e13aa');fire.addColorStop(1,'#72211900');c.globalAlpha=heat;c.fillStyle=fire;c.fillRect(px-size,py-size,size*2,size*2);
    }
   }
   // Hull fragments tumble downward while fine embers leave short orange trails.
   for(let i=0;i<34;i++){
    const a=i*2.39996,speed=70+i*37%155,px=Math.cos(a)*t*speed,py=Math.sin(a)*t*speed+t*t*65;
    c.globalAlpha=fade;
    if(i<10){c.save();c.translate(px,py);c.rotate(a+t*(i%2?3:-2));c.fillStyle=i%3===0?'#c98a60':'#7e909f';c.strokeStyle='#303b47';c.lineWidth=1.5;c.beginPath();c.moveTo(-6,-10);c.lineTo(7,-5);c.lineTo(4,8);c.lineTo(-4,5);c.closePath();c.fill();c.stroke();c.fillStyle='#ed943d';c.fillRect(-4,-8,6,2);c.restore();}
    else {c.strokeStyle=i%3===0?'#ffdc8b':'#fa8130';c.lineWidth=i%2?1.5:2.5;c.beginPath();c.moveTo(px-Math.cos(a)*12,py-Math.sin(a)*12-t*5);c.lineTo(px,py);c.stroke();}
   }
  }
  destroy(){this.resize.disconnect();}
 }
 window.RocketRunScene=RocketScene;
})();
