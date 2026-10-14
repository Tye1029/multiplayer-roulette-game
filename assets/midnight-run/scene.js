/* MIDNIGHT_RUN_V6_STORM_FLOW — original art with world-space lighting, rain and character animation. */
(() => {
 'use strict';
 const W=720,H=780,images=new Map();
 function art(name){if(!images.has(name)){const img=new Image();img.src='/assets/midnight-run/images/'+name+'.webp?v=MIDNIGHT_RUN_V6_STORM_FLOW';images.set(name,img);}return images.get(name);}
 const loaded=img=>img.complete&&img.naturalWidth>0;
 const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
 class MidnightScene{
  constructor(canvas){
   this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.reduced=matchMedia('(prefers-reduced-motion:reduce)');
   this.streets=['neon-strip','old-quarter','dockside','market-row'].map(art);this.runner=art('runner');this.patrol=art('patrol');this.state={phase:'preview',elapsed:0};
   this.effectAt=0;this.effectKey='';this.previewId='preview-'+crypto.randomUUID();this.routeId='';this.lots=[];
   this.rect={width:0,height:0};this.glows=new Map();this.properties=new Map();this.blocks=new Map();this.prepared=new Set();this.runnerFrames=[];this.road=null;this.curb=0;this.lastFrame=performance.now();this.pixelCap=2;this.drawCost=0;this.samples=0;
   this.resize=new ResizeObserver(entries=>{this.rect=entries[0].contentRect;this.draw(this.state);});this.resize.observe(canvas);
   for(const img of images.values())img.decode().then(()=>{this.prepare(img);this.draw(this.state);}).catch(()=>{});
   this.fog=document.createElement('canvas');this.fog.width=this.fog.height=128;
   const fc=this.fog.getContext('2d'),fg=fc.createRadialGradient(64,64,0,64,64,64);fg.addColorStop(0,'#adc2c252');fg.addColorStop(.5,'#adc2c225');fg.addColorStop(1,'#adc2c200');fc.fillStyle=fg;fc.fillRect(0,0,128,128);
  }
  get ready(){return this.streets.every(img=>this.prepared.has(img))&&this.prepared.has(this.runner);}
  property(image,section,side){
   const key=image+':'+section+':'+side;if(this.properties.has(key))return this.properties.get(key);
   const img=this.streets[image],{lotWidth,lotHeight}=window.MidnightRunStreets,x=side?W-lotWidth:0,scale=img.naturalWidth/W;
   const tile=document.createElement('canvas');tile.width=lotWidth;tile.height=lotHeight;const ctx=tile.getContext('2d');
   ctx.drawImage(img,x*scale,section*lotHeight*scale,lotWidth*scale,lotHeight*scale,0,0,lotWidth,lotHeight);
   const edge=ctx.createLinearGradient(0,0,0,24);edge.addColorStop(0,'#08131bd9');edge.addColorStop(1,'#08131b00');ctx.fillStyle=edge;ctx.fillRect(0,0,lotWidth,24);this.properties.set(key,tile);return tile;
  }
  prepare(img){
   const image=this.streets.indexOf(img);
   if(image>=0)for(let section=0;section<3;section++)for(let side=0;side<2;side++)this.property(image,section,side);
   if(img===this.streets[1]){this.road=document.createElement('canvas');this.road.width=216;this.road.height=1080;const scale=img.naturalWidth/W;this.road.getContext('2d').drawImage(img,252*scale,0,216*scale,1080*scale,0,0,216,1080);}
   if(img===this.runner)for(let frame=0;frame<4;frame++){
    const tile=document.createElement('canvas');tile.width=tile.height=188;const sw=img.naturalWidth/2,sh=img.naturalHeight/2;
    tile.getContext('2d').drawImage(img,frame%2*sw,Math.floor(frame/2)*sh,sw,sh,0,0,188,188);this.runnerFrames.push(tile);
   }
   this.prepared.add(img);
  }
  glow(c,x,y,r,color,alpha=1){
   if(!this.glows.has(color)){const tile=document.createElement('canvas');tile.width=tile.height=128;const ctx=tile.getContext('2d'),g=ctx.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,color);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);this.glows.set(color,tile);}
   c.save();c.globalAlpha=alpha;c.drawImage(this.glows.get(color),x-r,y-r,r*2,r*2);c.restore();
  }
  block(row){
   if(this.blocks.has(row))return this.blocks.get(row);
   const {lotHeight,lotWidth}=window.MidnightRunStreets,lot=this.lots[(((row+4)%this.lots.length)+this.lots.length)%this.lots.length];
   const tile=document.createElement('canvas');tile.width=W;tile.height=lotHeight;const c=tile.getContext('2d',{alpha:false});c.fillStyle='#142127';c.fillRect(0,0,W,lotHeight);
   const sy=((-row*lotHeight)%1080+1080)%1080;c.drawImage(this.road,0,sy,216,lotHeight,252,0,216,lotHeight);
   for(let side=0;side<2;side++)c.drawImage(this.property(lot[side].image,lot[side].section,side),side?W-lotWidth:0,0);
   const seam=sy===0?0:sy+lotHeight===1080?lotHeight:null;
   if(seam!==null){const g=c.createLinearGradient(0,seam-25,0,seam+25);g.addColorStop(0,'#0b182500');g.addColorStop(.5,'#0b182585');g.addColorStop(1,'#0b182500');c.fillStyle=g;c.fillRect(252,seam-25,216,50);}
   this.blocks.set(row,tile);return tile;
  }
  street(c,travel,t){
   // Compose static road and properties once; only nearby strips stay resident.
   const {lotHeight}=window.MidnightRunStreets,first=Math.floor((travel-300-H)/lotHeight),last=Math.ceil((travel-300)/lotHeight);
   if(!this.ready)return;
   for(let row=first-1;row<=last+1;row++)this.block(row);
   for(const row of this.blocks.keys())if(row<first-1||row>last+1)this.blocks.delete(row);
   for(let row=first;row<=last;row++)c.drawImage(this.block(row),0,travel-300-row*lotHeight);
   for(let row=first;row<=last;row++){
    const top=travel-300-row*lotHeight,lot=this.lots[(((row+4)%this.lots.length)+this.lots.length)%this.lots.length];
    for(let side=0;side<2;side++){
     const {image,section}=lot[side];
     if(image===0){
      const colors=side?['#ff39cf','#29caff','#ff3975']:['#ffaf35','#28d7ff','#df38ff'];
      const pulse=this.reduced.matches?1:.9+.1*Math.sin(t*1.7+row);
      this.glow(c,side?510:210,top+175,170,colors[section],.2*pulse);
     }
    }
   }
   if(!this.reduced.matches){
    for(let i=0;i<8;i++){
     const cycle=(t*.19+i*.37)%1,x=(i%2?531:185)+Math.sin(cycle*3+i)*26,y=((i*291+travel*.83)%1050)-100-cycle*55;
     c.globalAlpha=Math.sin(cycle*Math.PI)*.21;c.drawImage(this.fog,x-38-cycle*30,y-25,90+cycle*80,45+cycle*45);
    }c.globalAlpha=1;
    c.strokeStyle='#bdd8e829';c.lineWidth=.8;
    c.beginPath();for(let i=0;i<46;i++){const x=(i*179.7+t*24)%W,y=(i*111.37+t*(290+i%5*31))%H;c.moveTo(x,y);c.lineTo(x-3,y+11);}c.stroke();
    // Small raindrop ripples sit in the road, beneath the character and vehicles.
    for(let i=0;i<9;i++){const p=(t*.8+i*.371)%1,x=260+(i*71%190),y=(i*163+travel)%H;c.globalAlpha=(1-p)*.11;c.strokeStyle='#d1dfe0';c.beginPath();c.ellipse(x,y,3+p*9,1+p*3,0,0,Math.PI*2);c.stroke();}c.globalAlpha=1;
   }
  }
  vehicle(c,x,y,t,scale=1){
   if(!loaded(this.patrol))return;
   c.save();c.translate(x,y);c.scale(scale,scale);
   const beam=c.createLinearGradient(0,-80,0,-260);beam.addColorStop(0,'#dbe7bc27');beam.addColorStop(1,'#dbe7bc00');c.fillStyle=beam;
   for(const side of [-1,1]){c.beginPath();c.moveTo(side*23,-73);c.lineTo(side*23-56,-272);c.lineTo(side*23+56,-272);c.closePath();c.fill();}
   c.fillStyle='#0008';c.beginPath();c.ellipse(1,10,38,72,0,0,Math.PI*2);c.fill();
   c.drawImage(this.patrol,-53,-80,106,159);
   const pulse=this.reduced.matches?.4:.38+.22*Math.sin(t*7);
   this.glow(c,-12,0,95,'#ec625b',pulse*.17);this.glow(c,12,0,95,'#629bdf',(1-pulse)*.14);
   c.fillStyle='rgba(255,111,97,'+(.55+pulse*.4)+')';c.fillRect(-17,-3,12,3);c.fillStyle='rgba(117,181,247,'+(1-pulse*.4)+')';c.fillRect(5,-3,12,3);
   c.restore();
  }
  draw(state=this.state){
   const frameStart=performance.now();
   const routeId=state.id||this.previewId;if(routeId!==this.routeId){this.routeId=routeId;this.lots=window.MidnightRunStreets.plan(routeId);this.blocks.clear();}
   this.state=state;if(!this.rect.width)return;
   const rect=this.rect,dpr=Math.min(this.pixelCap,rect.width<500?1.5:2,window.devicePixelRatio||1),pw=Math.round(rect.width*dpr),ph=Math.round(rect.height*dpr);
   if(this.canvas.width!==pw||this.canvas.height!==ph){this.canvas.width=pw;this.canvas.height=ph;}
   const c=this.ctx,scale=Math.max(pw/W,ph/H);c.setTransform(scale,0,0,scale,(pw-W*scale)/2,(ph-H*scale)/2);c.fillStyle='#142127';c.fillRect(0,0,W,H);
   const reduced=this.reduced.matches,preview=state.phase==='preview',running=state.phase==='running',terminal=['caught','escape'].includes(state.phase);
   const key=(state.id||'')+':'+state.phase;if(terminal&&this.effectKey!==key){this.effectKey=key;this.effectAt=performance.now();}
   const effect=terminal?Math.min(3,(performance.now()-this.effectAt)/1000):0;
   const elapsed=Math.max(0,state.elapsed||0)/1000,t=reduced?0:performance.now()/1000;
   const travel=reduced?0:preview?(t%10000)*14:elapsed*140;
   this.street(c,travel,t);
   const x=360+(reduced?0:Math.sin(elapsed*.61)*28+Math.sin(elapsed*1.3)*8),baseY=520;
   if(!preview&&state.phase!=='countdown')this.vehicle(c,x+17,state.phase==='caught'?H+85-clamp(effect/1.15)*210:H+85+Math.sin(t*.6)*12,t);
   const now=performance.now(),dt=Math.min(.1,(now-this.lastFrame)/1000);this.lastFrame=now;
   const resting=['corner','securing','waiting'].includes(state.phase),curbTarget=resting?1:0;
   this.curb=reduced?curbTarget:this.curb+(curbTarget-this.curb)*(1-Math.exp(-dt*5));
   let px=x+this.curb*(427-x),py=baseY+this.curb*(reduced?0:Math.sin(t*2)*1.8),alpha=1;
   if(resting)this.glow(c,427,baseY+20,85,'#9cdacc',.11+(reduced?0:Math.sin(t*2)*.025));
   if(state.phase==='escape'){
    const p=clamp(effect/1.75);px+=Math.sin(p*3)*55;py-=p*p*750;alpha=1-clamp((p-.75)*4);
    this.glow(c,x,baseY,145,'#deb678',Math.max(0,.22-effect*.12));
   }
   const moving=(preview||running||state.phase==='escape')&&!reduced;
   c.save();c.globalAlpha=alpha;
   c.fillStyle='#0009';c.beginPath();c.ellipse(px,py+24,16,8,0,0,Math.PI*2);c.fill();
   this.glow(c,px,py+18,37,'#e1c296',.14);
   if(moving){const step=(t*2.2)%1;c.strokeStyle='rgba(191,215,217,'+((1-step)*.3)+')';c.lineWidth=1.4;c.beginPath();c.ellipse(px+(Math.floor(t*2.2)%2?7:-7),py+24+step*11,3+step*10,1+step*4,0,0,Math.PI*2);c.stroke();}
   if(this.runnerFrames.length===4){
    const frame=moving?Math.floor(t*8.8)%4:1,bob=moving?Math.sin(t*13.8)*1.2:0;
    c.translate(px,py+bob);c.rotate(moving?Math.sin(elapsed*.61)*.065:0);c.drawImage(this.runnerFrames[frame],-47,-47,94,94);
   }
   c.restore();
   if(state.phase==='caught'){
    const g=c.createRadialGradient(x,570,50,x,570,500);g.addColorStop(0,'#16161e00');g.addColorStop(1,'#4e1d2828');c.fillStyle=g;c.fillRect(0,0,W,H);
   }
   if(!this.vignette){this.vignette=document.createElement('canvas');this.vignette.width=W;this.vignette.height=H;const ctx=this.vignette.getContext('2d'),g=ctx.createRadialGradient(360,420,180,360,420,590);g.addColorStop(0,'#06121a00');g.addColorStop(1,'#06121a8c');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);}
   c.drawImage(this.vignette,0,0);
   if(state.lightning&&!reduced){c.fillStyle='rgba(211,229,255,'+clamp(state.lightning,0,.18)+')';c.fillRect(0,0,W,H);this.glow(c,550,-80,800,'#d9ebff',state.lightning*.5);}
   this.drawCost=this.drawCost*.9+(performance.now()-frameStart)*.1;
   if(++this.samples%30===0&&this.drawCost>10&&this.pixelCap>1)this.pixelCap=Math.max(1,Math.min(this.pixelCap,rect.width<500?1.5:2)-.25);
  }
 }
 window.MidnightRunScene=MidnightScene;
})();
