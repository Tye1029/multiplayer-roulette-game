/* BACK_ALLEY_DERBY_V1 — cached scene and sprite frames, one animation owner. */
(() => {
 'use strict';const rules=window.BackAlleyDerbyRules,motion=window.DerbyMotion;
 const filters=['none','grayscale(.85) brightness(.85)','sepia(.35) brightness(1.3)','grayscale(1) brightness(.65)','sepia(.3) brightness(1.15)','sepia(.7) saturate(.7)'];
 class DerbyScene{
  constructor(canvas){this.canvas=canvas;this.c=canvas.getContext('2d',{alpha:false});this.reduced=matchMedia('(prefers-reduced-motion:reduce)');this.bg=new Image();this.sprite=new Image();this.frames=[];this.last={elapsed:0,selected:0};this.size={width:800,height:533};this.observer=new ResizeObserver(entries=>{this.size=entries[0].contentRect;this.cache();this.draw(this.last);});this.observer.observe(canvas);this.loaded=false;
   this.bg.src='/assets/back-alley-derby/images/alley.webp?v='+rules.build;this.sprite.src='/assets/back-alley-derby/images/rat-run.webp?v='+rules.build;
   this.ready=Promise.all([this.bg.decode(),this.sprite.decode()]).then(()=>{for(let id=0;id<6;id++){this.frames[id]=[];for(let f=0;f<4;f++){const tile=document.createElement('canvas');tile.width=288;tile.height=192;const c=tile.getContext('2d');c.filter=filters[id];c.drawImage(this.sprite,(f%2)*this.sprite.width/2,Math.floor(f/2)*this.sprite.height/2,this.sprite.width/2,this.sprite.height/2,0,0,288,192);this.frames[id].push(tile);}}this.loaded=true;this.cache();this.draw(this.last);});
  }
  cache(){const w=Math.max(1,this.size.width),h=Math.max(1,this.size.height),dpr=Math.min(devicePixelRatio||1,1.5);this.w=w;this.h=h;this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);this.c.setTransform(dpr,0,0,dpr,0,0);if(!this.loaded)return;
   this.back=document.createElement('canvas');this.back.width=Math.round(w*dpr);this.back.height=Math.round(h*dpr);const c=this.back.getContext('2d');c.scale(dpr,dpr);const scale=Math.max(w/this.bg.width,h/this.bg.height);c.drawImage(this.bg,(w-this.bg.width*scale)/2,(h-this.bg.height*scale)/2,this.bg.width*scale,this.bg.height*scale);
   c.fillStyle='#041a2020';c.fillRect(0,0,w,h);c.lineWidth=1;c.setLineDash([8,14]);for(let i=0;i<7;i++){const y=h*(.39+i*.079);c.strokeStyle='#f5ddb327';c.beginPath();c.moveTo(w*.07,y);c.lineTo(w*.91,y);c.stroke();}c.setLineDash([]);
   const finish=w*.9;for(let row=0;row<24;row++)for(let col=0;col<2;col++){c.fillStyle=(row+col)%2?'#182427bb':'#ecdbc0b0';c.fillRect(finish+col*5,h*.39+row*h*.0198,5,h*.02);}
   c.save();c.translate(finish+20,h*.63);c.rotate(-Math.PI/2);c.font='800 9px system-ui';c.textAlign='center';c.fillStyle='#f5e4c5';c.fillText('F I N I S H',0,0);c.restore();
  }
  draw(state){this.last=state;const c=this.c,w=this.w||800,h=this.h||533;c.fillStyle='#172628';c.fillRect(0,0,w,h);if(!this.loaded||!this.back)return;c.drawImage(this.back,0,0,w,h);
   const running=state.order&&state.elapsed>rules.countdownMs,elapsed=Math.max(0,(state.elapsed||0)-rules.countdownMs),rw=Math.min(170,w*.23),rh=rw*2/3,start=rw*.91,finish=w*.9;
   for(let i=0;i<6;i++){const p=state.order?motion.position(i,state.order,state.seed,elapsed):0,nose=start+(finish-start)*p,y=h*(.43+i*.079),frame=running&&p<1&&!this.reduced.matches?Math.floor(elapsed/95+i*.75)%4:1,x=nose-rw*.965;
    if(i===state.selected){c.fillStyle=rules.rats[i].color+'25';c.beginPath();c.ellipse(nose-rw*.33,y+rh*.18,rw*.31,rh*.11,0,0,Math.PI*2);c.fill();}
    if(running&&p<1&&!this.reduced.matches){c.fillStyle='#d8c09b35';for(let d=0;d<3;d++){const phase=(elapsed/480+d/3)%1;c.globalAlpha=(1-phase)*.4;c.beginPath();c.ellipse(nose-rw*.58-phase*22,y+rh*.17-phase*9,1+phase*3,1+phase*2,0,0,7);c.fill();}c.globalAlpha=1;}
    c.fillStyle='#0005';c.beginPath();c.ellipse(nose-rw*.32,y+rh*.16,rw*.28,rh*.075,0,0,7);c.fill();c.drawImage(this.frames[i][frame],x,y-rh*.5,rw,rh);
    const bx=nose-rw*.29,by=y-rh*.14;c.fillStyle=rules.rats[i].color;c.beginPath();c.roundRect(bx-8,by-10,16,14,3);c.fill();c.fillStyle='#142021';c.font='900 10px system-ui';c.textAlign='center';c.fillText(String(i+1),bx,by+1);
    if(i===state.selected){c.fillStyle=rules.rats[i].color;c.beginPath();c.moveTo(bx,by-16);c.lineTo(bx-4,by-22);c.lineTo(bx+4,by-22);c.fill();}
    if(!running){c.strokeStyle='#d8b475aa';c.lineWidth=3;c.beginPath();c.moveTo(start+4,y-12);c.lineTo(start+4,y+16);c.stroke();}
   }
   if(state.win&&!this.reduced.matches){for(let i=0;i<28;i++){const t=((state.now||0)/1800+i*.17)%1;c.globalAlpha=(1-t)*.8;c.fillStyle=['#efcc7c','#7cc6b2','#d5a8b5'][i%3];c.fillRect((motion.hash(i)%1000)/1000*w,h*(.08+t*.7),3,5);}c.globalAlpha=1;}
  }
  destroy(){this.observer.disconnect();}
 }
 window.DerbyScene=DerbyScene;window.DerbyFur=filters;
})();
