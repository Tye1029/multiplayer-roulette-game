/* ROCKET_RUN_V1: responsive canvas, deterministic scenery, bounded particles. */
(() => {
 'use strict';
 class RocketScene{
  constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.ship=new Image();this.ship.src='/assets/rocket-run/rocket.svg?v=ROCKET_RUN_V1';this.ship.onload=()=>this.draw(this.state);this.state={phase:'ready',elapsed:0,multiplier:1};this.reduced=matchMedia('(prefers-reduced-motion:reduce)');this.resize=new ResizeObserver(()=>this.draw(this.state));this.resize.observe(canvas);this.effectAt=0;this.outcome='';}
  draw(state=this.state){if(!state)return;this.state=state;const c=this.ctx,w=1000,h=780,dpr=Math.min(devicePixelRatio||1,2),width=Math.max(1,Math.round(this.canvas.clientWidth*dpr));if(this.canvas.width!==width){this.canvas.width=width;this.canvas.height=Math.round(width*h/w);}c.setTransform(this.canvas.width/w,0,0,this.canvas.height/h,0,0);
   const t=Math.max(0,state.elapsed)/1000,flying=state.phase==='flight',ended=['crash','win'].includes(state.phase),progress=Math.min(1,t/11),motion=this.reduced.matches?0:performance.now()/1000;
   const bg=c.createLinearGradient(0,0,0,h);bg.addColorStop(0,'#0b1425');bg.addColorStop(.55,'#1b3149');bg.addColorStop(1,'#43576c');c.fillStyle=bg;c.fillRect(0,0,w,h);
   const aura=c.createRadialGradient(770,480,20,770,480,550);aura.addColorStop(0,'#71999a22');aura.addColorStop(1,'#71999a00');c.fillStyle=aura;c.fillRect(0,0,w,h);
   // Stable star positions: no frame-to-frame randomness or flicker.
   for(let i=0;i<86;i++){const x=(i*173.23+49)%w,y=((i*113.79+15)+(flying?motion*(8+i%9):0))%h;c.globalAlpha=.2+(i%5)*.12;c.fillStyle='#dce9df';c.beginPath();c.arc(x,y,i%7===0?1.8:.8,0,Math.PI*2);c.fill();}c.globalAlpha=1;
   c.save();c.translate(0,progress*260);c.fillStyle='#91b8be24';c.beginPath();c.ellipse(400,1110,1000,540,-.08,Math.PI,Math.PI*2);c.fill();c.strokeStyle='#a0cbd844';c.lineWidth=3;c.stroke();
   for(let layer=0;layer<3;layer++){c.fillStyle=['#33495e','#263b50','#192d42'][layer];c.beginPath();c.moveTo(0,h);for(let x=0;x<=1100;x+=55)c.lineTo(x,650+layer*44+Math.sin(x*.016+layer*3)*22+Math.cos(x*.031+layer)*15);c.lineTo(1100,1000);c.lineTo(0,1000);c.fill();}
   c.fillStyle='#111f32';for(let i=0;i<20;i++){const x=i*55,hei=20+(i*37%95);c.fillRect(x,765-hei,38,hei);c.fillStyle='#d1b88855';for(let row=0;row<3;row++)if(i%3)c.fillRect(x+9,775-hei+row*12,3,4);c.fillStyle='#111f32';}c.restore();
   // Soft cloud banks descend as the camera follows the rocket.
   for(let i=0;i<5;i++){const y=(480+i*162+(flying?motion*22:0))%1000-80,x=(i*273+40)%1100-80;c.save();c.translate(x,y);c.scale(1.4,.4);const cloud=c.createRadialGradient(0,0,0,0,0,115);cloud.addColorStop(0,'#c0d7da13');cloud.addColorStop(1,'#c0d7da00');c.fillStyle=cloud;c.fillRect(-115,-115,230,230);c.restore();}
   c.strokeStyle='#b7c9cf20';c.lineWidth=1;for(let y=100;y<700;y+=80){c.beginPath();c.moveTo(24,y);c.lineTo(36,y);c.moveTo(964,y);c.lineTo(976,y);c.stroke();}
   const lift=Math.min(1,t/5),x=260+lift*330,y=575-lift*160,angle=lift*.63,scale=.78;
   c.save();c.strokeStyle='#f3c49b30';c.setLineDash([4,10]);c.lineWidth=2;c.beginPath();c.moveTo(260,699);c.bezierCurveTo(240,580,410,520,x,y+70);c.stroke();c.setLineDash([]);c.restore();
   c.save();c.translate(260,715+progress*260);c.fillStyle='#778896';c.fillRect(-95,0,190,9);c.fillStyle='#2a3c4f';c.fillRect(-80,9,160,16);c.strokeStyle='#8293a0';c.lineWidth=5;c.beginPath();c.moveTo(-106,12);c.lineTo(-106,-205);c.lineTo(-88,-205);c.moveTo(-106,-180);c.lineTo(-43,-180);c.stroke();c.fillStyle='#e8b991';c.fillRect(-111,-213,10,5);c.restore();
   if(this.outcome!==state.phase&&ended){this.effectAt=performance.now();this.outcome=state.phase;}if(!ended)this.outcome='';
   const effect=Math.max(0,(performance.now()-this.effectAt)/1000);
   if(state.phase!=='crash'){
    c.save();c.translate(x,y);c.rotate(angle);c.scale(scale,scale);
    if(flying){const len=this.reduced.matches?150:160+Math.sin(motion*37)*13+Math.sin(motion*21)*8,g=c.createLinearGradient(0,130,0,130+len);g.addColorStop(0,'#fff5c6');g.addColorStop(.25,'#ffc484');g.addColorStop(.7,'#ed886966');g.addColorStop(1,'#ed886900');c.fillStyle=g;c.beginPath();c.moveTo(-18,137);c.quadraticCurveTo(-30,195,0,137+len);c.quadraticCurveTo(30,195,18,137);c.fill();c.fillStyle='#fffadc';c.beginPath();c.moveTo(-8,141);c.quadraticCurveTo(-9,185,0,226);c.quadraticCurveTo(9,185,8,141);c.fill();}
    if(this.ship.complete&&this.ship.naturalWidth)c.drawImage(this.ship,-100,-200,200,400);c.restore();
   }
   if(ended&&effect<2.5&&!this.reduced.matches){const win=state.phase==='win',radius=effect*170;c.save();c.globalAlpha=Math.max(0,1-effect/2.5);c.strokeStyle=win?'#f8db9d':'#f6ac82';c.lineWidth=2;c.beginPath();c.arc(x,y,radius,0,Math.PI*2);c.stroke();for(let i=0;i<42;i++){const a=i*2.39996,speed=40+(i*29%130),px=x+Math.cos(a)*effect*speed,py=y+Math.sin(a)*effect*speed+effect*effect*(win?9:55);c.fillStyle=win?(i%2?'#f2dba3':'#a8e3dc'):(i%3?'#faad74':'#788494');c.save();c.translate(px,py);c.rotate(a+effect*2);c.fillRect(-2,-3,win?3:5,win?8:6);c.restore();}c.restore();}
   c.font='11px system-ui';c.fillStyle='#9cb6c366';c.textAlign='right';c.fillText('XAN AEROSPACE / RR–01',960,749);
  }
  destroy(){this.resize.disconnect();}
 }
 window.RocketRunScene=RocketScene;
})();
