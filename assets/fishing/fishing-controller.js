(function fishingControllerBootstrap(global){
  "use strict";

  const VERSION="fishing-controller-v22";
  const SIDES=["left","right"];
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const round=value=>Math.round(Number(value||0)*10)/10;
  const easeOutCubic=t=>1-Math.pow(1-t,3);
  const easeInOutCubic=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;

  class FishingSceneController{
    constructor(root,options={}){
      if(!root)throw new Error("FishingSceneController requires a game root");
      this.root=root;
      this.water=root.querySelector("[data-fishing-water]");
      this.scene=this.water?.querySelector(".fishing-scene-art");
      this.hooks={};this.anchors={};this.paths={};this.armRigs={};
      // Calibrated to the final guide ring in each PNG, in the image's own
      // coordinate space. A child anchor follows every mirrored/casting transform.
      this.scene?.querySelectorAll(".fishing-angler").forEach(angler=>{
        const anchor=angler.querySelector(".fishing-rod-tip")||document.createElement("span");
        anchor.className="fishing-rod-tip";
        anchor.style.left=angler.classList.contains("left")?"98.6%":"95.6%";
        anchor.style.top=angler.classList.contains("left")?"5.35%":"5.6%";
        angler.appendChild(anchor);
        const side=angler.classList.contains("left")?"left":"right";
        this.anchors[side]=anchor;
        this.hooks[side]=this.scene.querySelector(`.fishing-hook-node.${side}`);
        this.paths[side]=this.scene.querySelector(`.fishing-line-svg.${side}`);
        this.armRigs[side]={angler,img:angler.querySelector('img')};
      });
      this.canvas=this.water?.querySelector(".fishing-water-canvas");
      this.ctx=this.canvas?.getContext("2d",{alpha:true});
      this.options={mode:"live",gameId:"",roundId:"",playerSide:"left",botSide:"right",...options};
      this.phase="mounting";
      this.seconds=60;
      this.activeRipple="";
      this.lastInput={status:"none",reason:"No input yet",at:""};
      this.bot={status:"idle",nextActionAt:""};
      this.events=[];
      this.errors=[];
      this.destroyed=false;
      this.castPlayed=false;
      this.lastWaterFrame=0;
      this.stats={frames:0,slowFrames:0,maxFrameGap:0,workMs:0,maxWorkMs:0,waterPaints:0,layoutReads:0,armPaints:0};
      // One occasional swimmer, well below the .665-height bite/bobber zone.
      // Each pass gets a different route; it never reveals a catch or rarity.
      this.ambientEpoch=performance.now();
      this.ambientFish=[{nextAt:9000+Math.random()*14000,pass:0}];
      this.scene?.parentElement?.querySelectorAll('.fishing-cloud-bank img').forEach(cloud=>{
        const duration=85+Math.random()*65;
        cloud.style.animationDuration=`${duration.toFixed(1)}s`;
        cloud.style.animationDelay=`${(-Math.random()*duration).toFixed(1)}s`;
        cloud.style.top=`${(-8+Math.random()*38).toFixed(1)}%`;
        cloud.style.opacity=(.5+Math.random()*.25).toFixed(2);
      });
      this.reducedMotion=Boolean(global.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
      this.rigs={
        left:{side:"left",x:.42,y:.665,baseY:.665,caught:false,catchId:"",anim:null,phaseOffset:0},
        right:{side:"right",x:.58,y:.665,baseY:.665,caught:false,catchId:"",anim:null,phaseOffset:Math.PI}
      };
      this.geometry={water:{width:0,height:0},left:{},right:{}};
      this.boundFrame=this.frame.bind(this);
      this.boundResize=this.resize.bind(this);
      this.boundError=event=>{this.errors.push({at:new Date().toISOString(),type:"error",message:String(event?.message||"Unknown window error"),source:String(event?.filename||"")});if(this.errors.length>10)this.errors.shift();this.updateDebug();};
      this.boundRejection=event=>{this.errors.push({at:new Date().toISOString(),type:"unhandledrejection",message:String(event?.reason?.message||event?.reason||"Unknown rejection")});if(this.errors.length>10)this.errors.shift();this.updateDebug();};
      this.resizeObserver=typeof ResizeObserver!=="undefined"?new ResizeObserver(this.boundResize):null;
      if(this.water)this.resizeObserver?.observe(this.water);
      this.root.querySelectorAll(".fishing-angler img").forEach(img=>img.addEventListener("load",this.boundResize,{once:true}));
      global.addEventListener("resize",this.boundResize);
      global.addEventListener("error",this.boundError);
      global.addEventListener("unhandledrejection",this.boundRejection);
      this.log("controller-mounted",{mode:this.options.mode,version:VERSION});
      this.resize();
      this.debugPanel=root.querySelector('.fishing-debug-panel');
      this.debugPanel?.addEventListener('toggle',()=>this.updateDebug());
      this.frameHandle=requestAnimationFrame(this.boundFrame);
    }

    log(type,data={}){
      this.events.push({at:new Date().toISOString(),type,data});
      if(this.events.length>40)this.events.splice(0,this.events.length-40);
      this.updateDebug();
    }

    setPhase(phase,detail={}){
      if(!phase||phase===this.phase)return;
      this.phase=String(phase);
      this.root.dataset.fishingPhase=this.phase;
      this.log("phase",{phase:this.phase,...detail});
    }

    setTimer(seconds){
      const next=clamp(Math.ceil(Number(seconds)||0),0,60);
      if(next===this.seconds)return;
      this.seconds=next;
      this.updateDebug();
    }

    setRipple(eventId){
      const next=String(eventId||"");
      if(next===this.activeRipple)return;
      this.activeRipple=next;
      this.log(next?"bite-active":"bite-cleared",{eventId:next});
    }

    setBot(status,nextActionAt=""){
      const next={status:String(status||"idle"),nextActionAt:String(nextActionAt||"")};
      if(next.status===this.bot.status&&next.nextActionAt===this.bot.nextActionAt)return;
      this.bot=next;
      this.log("bot-state",next);
    }

    recordInput(status,reason,eventId=""){
      this.lastInput={status:String(status||"unknown"),reason:String(reason||""),eventId:String(eventId||""),at:new Date().toISOString()};
      this.log("input",this.lastInput);
    }

    playCast(options={}){
      if(this.castPlayed&&!options.force)return Promise.resolve();
      this.castPlayed=true;
      this.setPhase("casting");
      this.scene?.classList.remove("is-idle");
      this.scene?.classList.add("is-casting");
      const duration=this.reducedMotion?80:2200;
      return new Promise(resolve=>{
        requestAnimationFrame(()=>{
          for(const side of SIDES){
            const rig=this.rigs[side],tip=this.rodTip(side);
            const waterRect=this.water?.getBoundingClientRect();
            const fromX=waterRect?.width?clamp((tip.x-waterRect.left)/waterRect.width,0,1):(side==="left"?.3:.7);
            const fromY=waterRect?.height?clamp((tip.y-waterRect.top)/waterRect.height,0,1):.16;
            rig.x=fromX;rig.y=fromY;
            rig.anim={kind:"cast",startedAt:performance.now(),duration,fromX,fromY,toX:side==="left"?.42:.58,toY:.665};
          }
          this.log("cast-started",{duration});
          setTimeout(()=>{
            if(this.destroyed){resolve();return;}
            this.scene?.classList.remove("is-casting");
            this.scene?.classList.add("is-idle");
            this.setPhase("waiting");
            this.log("cast-landed");
            this.root.dispatchEvent(new CustomEvent("fishing:cast-complete",{bubbles:false}));
            resolve();
          },duration+30);
        });
      });
    }

    replayCast(){
      this.castPlayed=false;
      for(const side of SIDES)this.resetRig(side,false);
      return this.playCast({force:true});
    }

    resetRig(side,removeCatch=true){
      const rig=this.rigs[side];if(!rig)return;
      rig.x=side==="left"?.42:.58;rig.y=.665;rig.baseY=.665;rig.caught=false;rig.catchId="";rig.anim=null;
      const hook=this.hook(side);hook?.classList.remove("has-catch","is-reeling");
      if(removeCatch)hook?.querySelector(".fishing-hook-catch")?.replaceWith(this.emptyCatch(side));
    }

    emptyCatch(side){
      const empty=document.createElement("div");empty.className=`fishing-hook-catch ${side}`;empty.dataset.catchId="";return empty;
    }

    syncCatch(side,catchId,animate=false){
      const rig=this.rigs[side];if(!rig)return;
      const nextId=String(catchId||"");
      if(!nextId){this.resetRig(side,false);return;}
      const changed=rig.catchId!==nextId;
      // Polling can return the same confirmed catch several times while the
      // reel is still moving. Never let a duplicate snapshot snap that motion
      // straight to its resting position.
      if(!changed){this.updateDebug();return;}
      rig.catchId=nextId;rig.caught=true;
      this.hook(side)?.classList.add("has-catch");
      if(animate)this.reel(side,nextId);
      else{rig.y=this.catchRestY(side);rig.baseY=rig.y;rig.anim=null;}
      this.updateDebug();
    }

    reel(side,catchId=""){
      const rig=this.rigs[side];if(!rig)return Promise.resolve();
      const duration=this.reducedMotion?80:1150;
      const hook=this.hook(side);hook?.classList.add("has-catch","is-reeling");
      this.water?.classList.add(side==="left"?"pull-left":"pull-right");
      this.setPhase("reeling",{side});
      rig.caught=true;rig.catchId=String(catchId||rig.catchId||"");
      const fromY=Math.max(rig.y,.64);
      rig.y=fromY;rig.baseY=this.catchRestY(side);
      rig.anim={kind:"reel",startedAt:performance.now(),duration,fromX:rig.x,fromY,toX:side==="left"?.42:.58,toY:rig.baseY};
      this.prepareArmRig(side);
      this.root?.dispatchEvent(new CustomEvent('fishing:reel-start',{detail:{side,catchId:rig.catchId,duration}}));
      this.log("reel-started",{side,catchId:rig.catchId,duration});
      return new Promise(resolve=>setTimeout(()=>{
        hook?.classList.remove("is-reeling");
        this.water?.classList.remove(side==="left"?"pull-left":"pull-right");
        if(!this.destroyed&&this.phase!=='complete')this.setPhase("caught",{side});
        this.log("catch-secured",{side,catchId:rig.catchId});
        resolve();
      },duration+30));
    }

    hook(side){return this.hooks?.[side]||this.scene?.querySelector(`.fishing-hook-node.${side}`)||null;}

    // Reuse the original PNG, deforming only arms/rod during a confirmed reel.
    // No replacement artwork, network assets, moving feet or always-on filter.
    prepareArmRig(side){
      const arm=this.armRigs?.[side];if(!arm||this.reducedMotion||!arm.img?.naturalWidth)return;
      if(!arm.canvas){
        arm.canvas=document.createElement('canvas');arm.canvas.className='fishing-arm-canvas';
        arm.canvas.setAttribute('aria-hidden','true');arm.angler.appendChild(arm.canvas);
        arm.texture=document.createElement('canvas');
        arm.texture.width=Math.min(512,arm.img.naturalWidth);
        arm.texture.height=Math.round(arm.texture.width*arm.img.naturalHeight/arm.img.naturalWidth);
        arm.texture.getContext('2d').drawImage(arm.img,0,0,arm.texture.width,arm.texture.height);
        arm.canvas.width=arm.texture.width;arm.canvas.height=arm.texture.height;
        arm.ctx=arm.canvas.getContext('2d');
      }
    }

    armPoint(x,y,pulse){
      if(y>=.54)return{x,y}; // Boots and lower body stay exactly on the deck.
      const rod=clamp((x-.3)/.25,0,1)*clamp((.5-y)/.2,0,1);
      const hand=Math.exp(-((x-.35)**2/.014+(y-.39)**2/.005));
      return{x:x-pulse*(rod*.011+hand*.010),y:y-pulse*(rod*.016+hand*.018)};
    }

    paintArms(side,progress){
      const arm=this.armRigs?.[side];if(!arm?.ctx)return;
      const pulse=Math.sin(Math.PI*progress)*(1+.18*Math.sin(progress*Math.PI*4));
      const {ctx,texture,canvas}=arm,w=canvas.width,h=canvas.height;
      ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,w,h);
      const xs=[0,.25,.45,.7,1],ys=[0,.2,.32,.44,.54];
      for(let row=0;row<ys.length-1;row++)for(let col=0;col<xs.length-1;col++){
        const points=[[xs[col],ys[row]],[xs[col+1],ys[row]],[xs[col+1],ys[row+1]],[xs[col],ys[row+1]]];
        for(const indices of [[0,1,2],[0,2,3]]){
          const s=indices.map(i=>({x:points[i][0]*w,y:points[i][1]*h}));
          const p=indices.map(i=>{const v=this.armPoint(...points[i],pulse);return{x:v.x*w,y:v.y*h};});
          const dx1=s[1].x-s[0].x,dy1=s[1].y-s[0].y,dx2=s[2].x-s[0].x,dy2=s[2].y-s[0].y,det=dx1*dy2-dy1*dx2;
          const a=((p[1].x-p[0].x)*dy2-(p[2].x-p[0].x)*dy1)/det,b=((p[1].y-p[0].y)*dy2-(p[2].y-p[0].y)*dy1)/det;
          const c=(dx1*(p[2].x-p[0].x)-dx2*(p[1].x-p[0].x))/det,d=(dx1*(p[2].y-p[0].y)-dx2*(p[1].y-p[0].y))/det;
          ctx.save();ctx.beginPath();ctx.moveTo(p[0].x,p[0].y);ctx.lineTo(p[1].x,p[1].y);ctx.lineTo(p[2].x,p[2].y);ctx.closePath();ctx.clip();
          ctx.setTransform(a,b,c,d,p[0].x-a*s[0].x-c*s[0].y,p[0].y-b*s[0].x-d*s[0].y);ctx.drawImage(texture,0,0);ctx.restore();
        }
      }
      ctx.drawImage(texture,0,h*.54,w,h*.46,0,h*.54,w,h*.46);
      arm.angler.classList.toggle('has-arm-motion',progress>0&&progress<1);
      const tip=this.armPoint(side==='left'?.986:.956,side==='left'?.0535:.056,pulse);
      this.anchors[side].style.left=`${tip.x*100}%`;this.anchors[side].style.top=`${tip.y*100}%`;
      if(this.stats)this.stats.armPaints++;
    }

    catchRestY(side){
      // Keep the newly top-attached fish AND its caption inside narrow scenes.
      // Move the whole rig; the line endpoint and bobber use this same position.
      const height=this.water?.getBoundingClientRect().height||430;
      const caughtHeight=this.hook(side)?.querySelector('.fishing-catch-unit')?.offsetHeight||0;
      return Math.min(.48,Math.max(.2,1-(caughtHeight+8)/height));
    }

    rodTip(side){
      if(this.frameTips?.[side])return this.frameTips[side];
      const anchor=this.anchors?.[side]||this.scene?.querySelector(`.fishing-angler.${side} .fishing-rod-tip`);
      const waterRect=this.water?.getBoundingClientRect();
      if(!anchor||!waterRect)return{x:0,y:0};
      const r=anchor.getBoundingClientRect();
      return{x:r.left,y:r.top};
    }

    resize(){
      if(!this.water||!this.canvas)return;
      const rect=this.water.getBoundingClientRect(),dpr=Math.min(1.25,global.devicePixelRatio||1);
      this.geometry.water={width:round(rect.width),height:round(rect.height)};
      const width=Math.max(1,Math.round(rect.width*dpr)),height=Math.max(1,Math.round(rect.height*dpr));
      if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;this.canvas.style.width=`${rect.width}px`;this.canvas.style.height=`${rect.height}px`;}
      this.canvasDpr=dpr;
      for(const side of SIDES){
        const rig=this.rigs[side];
        if(rig.caught){rig.baseY=this.catchRestY(side);if(!rig.anim)rig.y=rig.baseY;else if(rig.anim.kind==='reel')rig.anim.toY=rig.baseY;}
      }
      this.drawWater(performance.now());
    }

    updateRig(rig,now){
      if(rig.anim){
        const progress=clamp((now-rig.anim.startedAt)/rig.anim.duration,0,1);
        const eased=rig.anim.kind==="cast"?easeInOutCubic(progress):easeOutCubic(progress);
        rig.x=rig.anim.fromX+(rig.anim.toX-rig.anim.fromX)*eased;
        rig.y=rig.anim.fromY+(rig.anim.toY-rig.anim.fromY)*eased;
        if(rig.anim.kind==='reel'){
          if(!rig.anim.surfaced&&progress>=.18){rig.anim.surfaced=true;this.root?.dispatchEvent(new CustomEvent('fishing:fish-surfaced',{detail:{side:rig.side,catchId:rig.catchId}}));}
        }
        if(progress>=1){rig.x=rig.anim.toX;rig.y=rig.anim.toY;rig.baseY=rig.anim.toY;rig.anim=null;}
      }
      const hook=this.hook(rig.side);if(!hook||!this.water)return;
      const floating=!rig.caught&&!rig.anim;
      const bob=this.reducedMotion?0:Math.sin(now/1280+rig.phaseOffset)*(rig.caught?2.25:2.1);
      const left=`${rig.x*100}%`,top=`${rig.y*100}%`;
      if(hook.style.left!==left)hook.style.left=left;
      if(hook.style.top!==top)hook.style.top=top;
      hook.style.transform=`translate3d(-50%,${bob.toFixed(2)}px,0)`;
      hook.classList.toggle("is-floating",floating);
      if(floating){hook.style.setProperty("--bobber-dip",`${(5.5+bob).toFixed(2)}px`);hook.style.setProperty("--surface-offset",`${(-bob).toFixed(2)}px`);}
      const waterRect=this.frameWaterRect||this.water.getBoundingClientRect(),tip=this.rodTip(rig.side);
      const sx=clamp((tip.x-waterRect.left)/Math.max(1,waterRect.width)*1000,0,1000);
      const sy=clamp((tip.y-waterRect.top)/Math.max(1,waterRect.height)*430,0,430);
      // Connect to the bobber's top, not its middle. Gravity bends the line
      // downward immediately after the guide ring instead of looping upward.
      const ex=rig.x*1000,ey=(rig.y+(bob-(rig.caught?7:8))/Math.max(1,waterRect.height))*430;
      const cx=sx+(ex-sx)*.76,cy=sy+(ey-sy)*.36;
      const path=this.paths?.[rig.side]||this.scene.querySelector(`.fishing-line-svg.${rig.side}`);
      path?.setAttribute("d",`M${sx.toFixed(1)} ${sy.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`);
      this.geometry[rig.side]={rodTip:{x:round(sx),y:round(sy)},lineEnd:{x:round(ex),y:round(ey)},connectedDelta:0,catchId:rig.catchId||"",caught:rig.caught};
    }

    drawWater(now){
      if(!this.ctx||!this.canvas)return;
      const ctx=this.ctx,dpr=this.canvasDpr||1,w=this.canvas.width/dpr,h=this.canvas.height/dpr,horizon=h*.42;
      ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
      // The docks are part of the approved background plate. Clip motion to
      // exposed lake, conservatively excluding their decking, posts and braces.
      ctx.save();ctx.beginPath();
      const lake=[[0,.44],[1,.44],[1,.65],[.85,.535],[.65,.50],[.65,.725],[.73,.725],[.73,.88],[.95,1],[.05,1],[.27,.88],[.27,.725],[.35,.725],[.35,.50],[.15,.535],[0,.65]];
      lake.forEach(([x,y],i)=>i?ctx.lineTo(x*w,y*h):ctx.moveTo(x*w,y*h));
      ctx.closePath();ctx.clip();
      this.drawFishShadows(now,w,h);
      const phase=this.reducedMotion?0:now*.00115;
      const gradientKey=`${w}:${h}`;
      if(this.gradientKey!==gradientKey){this.gradientKey=gradientKey;this.waterGradient=ctx.createLinearGradient(0,horizon,0,h);this.waterGradient.addColorStop(0,"rgba(86,238,244,.035)");this.waterGradient.addColorStop(.55,"rgba(18,171,205,.075)");this.waterGradient.addColorStop(1,"rgba(0,83,128,.105)");}
      ctx.fillStyle=this.waterGradient;ctx.fillRect(0,horizon,w,h-horizon);
      ctx.globalCompositeOperation="screen";
      const rows=w<680?9:12;
      for(let row=0;row<rows;row++){
        const y=horizon+14+row*((h-horizon-20)/rows),amp=1.8+row*.2,freq=.0112+row*.0004;
        ctx.beginPath();
        for(let x=-12;x<=w+12;x+=20){const wave=Math.sin(x*freq+phase*(1.6+row*.034)+row*.73)*amp+Math.sin(x*.0041-phase*.9)*1.05; if(x===-12)ctx.moveTo(x,y+wave);else ctx.lineTo(x,y+wave);}
        ctx.strokeStyle=`rgba(${row%3===0?"221,254,255":"92,231,235"},${.09+(row%4)*.018})`;ctx.lineWidth=row%4===0?1.25:.75;ctx.stroke();
      }
      for(let band=0;band<3;band++){
        const y=horizon+(band+1)*(h-horizon)/4;
        ctx.beginPath();
        for(let x=-40;x<=w+40;x+=20){const wave=Math.sin(x*.0078+phase*.58+band*1.8)*(4+band*.65);if(x===-40)ctx.moveTo(x,y+wave);else ctx.lineTo(x,y+wave);}
        ctx.strokeStyle="rgba(214,252,255,.08)";ctx.lineWidth=3.5+band;ctx.stroke();
      }
      ctx.globalCompositeOperation="source-over";
      ctx.restore();
      if(this.stats)this.stats.waterPaints++;
    }

    nextShadowPass(fish,time){
      fish.startedAt=time;fish.duration=6500+Math.random()*4000;
      fish.nextAt=time+fish.duration+28000+Math.random()*22000;fish.pass++;
      fish.direction=Math.random()<.5?-1:1;fish.fromX=.29+Math.random()*.07;fish.toX=.64+Math.random()*.07;
      fish.y=.84+Math.random()*.075;fish.size=.026+Math.random()*.012;fish.bend=Math.random()*Math.PI*2;
    }

    drawFishShadows(now,w,h){
      if(this.reducedMotion||!this.ambientFish||this.phase==='complete')return;
      const ctx=this.ctx,time=now-this.ambientEpoch;
      for(const fish of this.ambientFish){
        if(time>=fish.nextAt)this.nextShadowPass(fish,time);
        if(!Number.isFinite(fish.startedAt))continue;
        const age=time-fish.startedAt;if(age<0||age>=fish.duration)continue;
        const t=age/fish.duration,envelope=Math.sin(Math.PI*t)**2;
        const x=(fish.direction>0?fish.fromX+t*(fish.toX-fish.fromX):fish.toX-t*(fish.toX-fish.fromX))*w;
        const y=(fish.y+Math.sin(t*Math.PI*2+fish.bend)*.009)*h;
        const length=Math.max(12,w*fish.size),tail=Math.sin(now*.005+fish.bend)*2;
        ctx.save();ctx.globalCompositeOperation='source-over';
        ctx.translate(x,y);ctx.rotate(Math.cos(t*Math.PI*2+fish.bend)*.12);ctx.scale(fish.direction,1);
        ctx.fillStyle=`rgba(3,46,57,${(.19*envelope).toFixed(3)})`;
        // Soft, top-down body and fins, with a gently sweeping tail.
        ctx.beginPath();ctx.ellipse(0,0,length*.48,length*.15,0,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.moveTo(-length*.36,0);ctx.lineTo(-length*.72,-length*.19+tail);ctx.quadraticCurveTo(-length*.56,tail,-length*.72,length*.19+tail);ctx.closePath();ctx.fill();
        ctx.beginPath();ctx.moveTo(-length*.06,-length*.08);ctx.lineTo(-length*.2,-length*.27);ctx.lineTo(length*.15,-length*.09);ctx.moveTo(-length*.06,length*.08);ctx.lineTo(-length*.2,length*.27);ctx.lineTo(length*.15,length*.09);ctx.fill();
        ctx.restore();
      }
    }

    frame(now){
      if(this.destroyed)return;
      if(!this.root.isConnected){this.destroy();return;}
      if(this.phase==='complete'&&!SIDES.some(side=>this.rigs[side].anim)){
        this.lastFrame=0;this.frameHandle=requestAnimationFrame(this.boundFrame);return;
      }
      if(!document.hidden){
        const workStart=performance.now();
        if(this.stats){const gap=this.lastFrame?now-this.lastFrame:0;this.stats.frames++;if(gap>50)this.stats.slowFrames++;this.stats.maxFrameGap=Math.max(this.stats.maxFrameGap,gap);}
        this.lastFrame=now;
        for(const side of SIDES){const anim=this.rigs[side].anim;if(anim?.kind==='reel')this.paintArms(side,clamp((now-anim.startedAt)/anim.duration,0,1));}
        // All layout reads happen together, before any hook/line style writes.
        this.frameTips=null;this.frameWaterRect=this.water?.getBoundingClientRect();
        const tips={};
        for(const side of SIDES){const anchor=this.anchors?.[side];if(anchor){const r=anchor.getBoundingClientRect();tips[side]={x:r.left,y:r.top};}}
        this.frameTips=tips;if(this.stats)this.stats.layoutReads+=3;
        for(const side of SIDES){
          this.updateRig(this.rigs[side],now);
        }
        if(!this.reducedMotion&&now-this.lastWaterFrame>=1000/30){this.lastWaterFrame=now;this.drawWater(now);}
        const workMs=performance.now()-workStart;this.stats.workMs+=workMs;this.stats.maxWorkMs=Math.max(this.stats.maxWorkMs,workMs);
      }else this.lastFrame=0;
      this.frameHandle=requestAnimationFrame(this.boundFrame);
    }

    report(extra={}){
      return{
        fishingDebugVersion:VERSION,
        capturedAt:new Date().toISOString(),
        url:global.location?.href||"",
        mode:this.options.mode,
        gameId:this.options.gameId||this.root.dataset.fishingGameId||"preview",
        roundId:this.options.roundId||this.root.dataset.fishingRoundId||"preview-round",
        phase:this.phase,
        secondsRemaining:this.seconds,
        activeRipple:this.activeRipple||null,
        bot:this.bot,
        lastInput:this.lastInput,
        geometry:this.geometry,
        performance:this.stats,
        catches:{left:this.rigs.left.catchId||null,right:this.rigs.right.catchId||null},
        recentEvents:this.events.slice(-25),
        errors:this.errors.slice(-10),
        userAgent:global.navigator?.userAgent||"",
        viewport:{width:global.innerWidth||0,height:global.innerHeight||0},
        ...extra
      };
    }

    async copyReport(extra={}){
      const text=JSON.stringify(this.report(extra),null,2);
      this.root.dataset.fishingPerformance=JSON.stringify(this.stats);
      this.root.dataset.fishingErrorCount=String(this.errors.length);
      if(global.navigator?.clipboard?.writeText)await global.navigator.clipboard.writeText(text);
      else{
        const area=document.createElement("textarea");area.value=text;area.style.position="fixed";area.style.opacity="0";document.body.appendChild(area);area.select();document.execCommand("copy");area.remove();
      }
      this.log("debug-report-copied",{characters:text.length});
      return text;
    }

    updateDebug(){
      const panel=this.debugPanel||this.root?.querySelector('.fishing-debug-panel');
      const health=panel?.querySelector('[data-fishing-debug-health]'),healthText=this.phase==='complete'?'DONE':this.phase==='error'?'ERROR':'LIVE';
      if(health&&health.textContent!==healthText)health.textContent=healthText;
      if(!panel?.open)return;
      const set=(selector,value)=>{const el=this.root.querySelector(selector);if(el)el.textContent=String(value);};
      set("[data-fishing-debug-health]",this.phase==="complete"?"DONE":this.phase==="error"?"ERROR":"LIVE");
      set("[data-fishing-debug-status]",this.phase);
      set("[data-fishing-debug-timer]",`${this.seconds}s`);
      set("[data-fishing-debug-bot]",this.bot.status);
      set("[data-fishing-debug-ripple]",this.activeRipple||"waiting");
      const playerRig=this.rigs[this.options.playerSide]||this.rigs.left;
      const botRig=this.rigs[this.options.botSide]||this.rigs.right;
      set("[data-fishing-debug-player]",playerRig.caught?"secured":"available");
      set("[data-fishing-debug-catch]",botRig.caught?"secured":"waiting");
      set("[data-fishing-debug-input]",`${this.lastInput.status}: ${this.lastInput.reason}`);
    }

    destroy(){
      this.destroyed=true;cancelAnimationFrame(this.frameHandle);this.resizeObserver?.disconnect();global.removeEventListener("resize",this.boundResize);global.removeEventListener("error",this.boundError);global.removeEventListener("unhandledrejection",this.boundRejection);
    }
  }

  global.FishingSceneController=FishingSceneController;
  global.FISHING_CONTROLLER_VERSION=VERSION;
})(window);
