/* PLINKO_V1 — decorative motion follows the exact server-owned path. */
(() => {
 'use strict';const W=960,H=800,DX=48,DY=29,TOP=157,TAU=Math.PI*2;
 const round=(c,x,y,w,h,r,fill,stroke)=>{c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();}};
 const circle=(c,x,y,r,color)=>{c.beginPath();c.arc(x,y,r,0,TAU);c.fillStyle=color;c.fill();};
 const gold=(c,x,y,r)=>{const g=c.createRadialGradient(x-r*.35,y-r*.4,1,x,y,r);g.addColorStop(0,'#fffadb');g.addColorStop(.28,'#ffe6a1');g.addColorStop(.58,'#dbab4e');g.addColorStop(.86,'#8b5927');g.addColorStop(1,'#f7d68f');return g;};
 const color=k=>Math.abs(k-8)>=7?'#e7b461':Math.abs(k-8)>=5?'#dc8b91':Math.abs(k-8)>=3?'#9e9fdb':'#6fc6d3';
 function label(n){return n>=1000?(n/1000).toFixed(0)+'k':Number(n.toFixed(2)).toString().replace(/^0\./,'.');}
 class Board{
  constructor(canvas){this.canvas=canvas;this.c=canvas.getContext('2d');this.back=document.createElement('canvas');this.back.width=W;this.back.height=H;this.result=null;this.frame=0;this.stake=50000;this.risk='medium';this.ro=new ResizeObserver(()=>this.resize());this.ro.observe(canvas);this.resize();}
  resize(){const d=Math.min(2,devicePixelRatio||1),width=Math.max(320,this.canvas.clientWidth);this.canvas.width=Math.round(width*d);this.canvas.height=Math.round(width*d*H/W);this.static();this.paint(this.position);}
  configure(stake,risk){this.stake=stake;this.risk=risk;this.result=null;this.position=null;this.static();this.paint();}
  static(){const c=this.back.getContext('2d');c.clearRect(0,0,W,H);
   const g=c.createLinearGradient(0,0,0,H);g.addColorStop(0,'#142834');g.addColorStop(.5,'#091827');g.addColorStop(1,'#0c1724');round(c,24,13,912,746,24,g,'#355264');
   c.save();round(c,32,20,896,730,20);c.clip();const glow=c.createRadialGradient(480,370,15,480,370,510);glow.addColorStop(0,'#23526565');glow.addColorStop(1,'#0a162900');c.fillStyle=glow;c.fillRect(0,0,W,H);
   c.strokeStyle='#80bace08';c.lineWidth=1;for(let x=-H;x<W;x+=23){c.beginPath();c.moveTo(x,0);c.lineTo(x+H,H);c.stroke();}c.restore();
   // Recessed rails follow the triangular playfield; pegs stay in its interior.
   for(const side of [-1,1]){c.beginPath();c.moveTo(480+side*57,128);c.lineTo(480+side*425,644);c.strokeStyle='#020912';c.lineWidth=15;c.stroke();c.strokeStyle='#527589';c.lineWidth=5;c.stroke();c.strokeStyle='#89cede';c.lineWidth=1.2;c.stroke();}
   for(const x of [43,917])for(const y of [34,739]){circle(c,x,y,6,'#0a1723');circle(c,x-1,y-1,4,'#526b75');c.strokeStyle='#132632';c.beginPath();c.moveTo(x-3,y+2);c.lineTo(x+2,y-3);c.stroke();}
   const chute=c.createLinearGradient(450,0,509,0);chute.addColorStop(0,'#244650');chute.addColorStop(.3,'#91adb0');chute.addColorStop(.55,'#344f55');chute.addColorStop(1,'#172c38');round(c,450,21,60,81,14,chute,'#9ab5b6');round(c,460,26,40,67,10,'#081720','#314a53');round(c,447,86,66,12,4,'#c3ae7c','#e5d7a5');circle(c,480,60,16,gold(c,480,60,16));
   for(let row=0;row<16;row++)for(let j=0;j<=row;j++){const x=480+(j-row/2)*DX,y=TOP+row*DY;circle(c,x+2,y+5,7,'#0006');const p=c.createRadialGradient(x-2,y-2,.5,x,y,5.8);p.addColorStop(0,'#edffff');p.addColorStop(.25,'#a8d7de');p.addColorStop(.75,'#527585');p.addColorStop(1,'#263f50');circle(c,x,y,5.8,p);circle(c,x-1.7,y-2,1.6,'#e4f6ff');}
   round(c,57,663,846,74,12,'#06111b','#2a4758');
   for(let k=0;k<=16;k++){const x=480+(k-8)*DX,tint=color(k),gradient=c.createLinearGradient(0,674,0,720);gradient.addColorStop(0,tint);gradient.addColorStop(1,k<2||k>14?'#80512b':'#274757');round(c,x-22,675,44,46,6,gradient,'#ffffff35');round(c,x-19,678,38,4,2,'#ffffff48');c.fillStyle=k<2||k>14?'#1a2027':'#061724';c.font='bold '+(label(PlinkoRules.multiplier(this.stake,this.risk,k)).length>3?19:24)+'px system-ui';c.textAlign='center';c.fillText(label(PlinkoRules.multiplier(this.stake,this.risk,k)),x,705);}
   c.fillStyle='#698899';c.font='10px system-ui';c.textAlign='center';c.fillText('P L I N K O   /   X A N  D U E L S',480,778);
  }
  paint(position=null,elapsed=0){const c=this.c;c.setTransform(this.canvas.width/W,0,0,this.canvas.height/H,0,0);c.clearRect(0,0,W,H);c.drawImage(this.back,0,0);this.position=position;
   if(position){const {x,y,row}=position;if(row>=0&&row<16){const px=position.pegX,py=TOP+row*DY;c.save();c.shadowBlur=22;c.shadowColor='#79f3ff';circle(c,px,py,7,'#cffaff');c.restore();c.beginPath();c.arc(px,py,13,0,TAU);c.strokeStyle='#a2f4ff66';c.lineWidth=1.5;c.stroke();}
    for(let i=this.trail?.length-1;i>=0;i--){const p=this.trail[i];circle(c,p.x,p.y,Math.max(1,10-i*.9),'rgba(250,208,127,'+Math.max(0,.23-i*.025)+')');}
    circle(c,x+3,y+8,14,'#0005');c.save();c.shadowBlur=19;c.shadowColor='#f4c77280';circle(c,x,y,12.8,gold(c,x,y,12.8));c.restore();c.beginPath();c.arc(x,y,8,.5,2.5);c.strokeStyle='#83532680';c.lineWidth=1.3;c.stroke();circle(c,x-4,y-5,2.2,'#fff8de');
   }
   if(this.result!==null){const x=480+(this.result-8)*DX;c.save();c.shadowBlur=25;c.shadowColor=color(this.result);round(c,x-23,674,46,48,7,null,'#fff2b6');c.lineWidth=2;round(c,x-22,675,44,46,7,null,'#fff2b6');c.restore();if(elapsed){for(let i=0;i<18;i++){const angle=i*2.399,travel=Math.min(1,elapsed/650),distance=(30+i*3)*travel;c.globalAlpha=Math.max(0,1-travel);circle(c,x+Math.cos(angle)*distance,672-Math.abs(Math.sin(angle)*distance)*1.4+travel*travel*30,1.5+i%3,i%2?'#fbdaa0':'#93e5ef');}c.globalAlpha=1;}}
  }
  show(drop){this.result=drop.bucket;this.trail=[];this.paint({x:480+(drop.bucket-8)*DX,y:656,row:-1});}
  animate(drop,audio,onRow){this.stop();this.configure(drop.stake,drop.risk);this.trail=[];const points=[{x:480,y:59},{x:480,y:TOP-13}];let rights=0;for(let row=0;row<16;row++){rights+=drop.path[row];points.push({x:480+(rights-(row+1)/2)*DX,y:TOP+(row+1)*DY-13});}points.push({x:points.at(-1).x,y:656});const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches,start=performance.now();let lastRow=-1,landed=false;
   return new Promise(resolve=>{this.finish=resolve;const tick=now=>{if(document.hidden){this.frame=0;return;}const t=now-start;let p;if(t<350){const u=t/350;p={x:480,y:59+(TOP-72)*u*u,row:-1};}else if(t<3070){const segment=Math.min(15,Math.floor((t-350)/170)),u=((t-350)%170)/170,a=points[segment+1],b=points[segment+2];p={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u-19*Math.sin(Math.PI*u),row:segment,pegX:a.x};if(segment!==lastRow){lastRow=segment;if(!reduced)audio.bounce(segment);onRow?.(segment+1);}}else{const u=Math.min(1,(t-3070)/220),a=points.at(-2),b=points.at(-1);p={x:a.x,y:a.y+(b.y-a.y)*u*u,row:-1};if(u===1&&!landed){landed=true;this.result=drop.bucket;audio.land(drop.payout>drop.stake);}}
    if(reduced){if(t>=3290){this.show(drop);}else this.paint();}else{this.trail.unshift({x:p.x,y:p.y});this.trail.length=Math.min(this.trail.length,9);this.paint(p,landed?t-3290:0);}
    if(t>=PlinkoRules.dropMs){this.frame=0;this.show(drop);this.finish=null;resolve(true);}else this.frame=requestAnimationFrame(tick);
   };this.tick=tick;this.frame=requestAnimationFrame(tick);});
  }
  resume(){if(this.finish&&!this.frame)this.frame=requestAnimationFrame(this.tick);}
  stop(){cancelAnimationFrame(this.frame);this.frame=0;this.finish?.(false);this.finish=null;this.trail=[];}
 }
 window.PlinkoBoard=Board;
})();
