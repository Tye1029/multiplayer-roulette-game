(function fishingControllerBootstrap(global){
  "use strict";

  const VERSION="fishing-controller-v17";
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
      this.seconds=clamp(Math.ceil(Number(seconds)||0),0,60);
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
      this.stopReel(rig);rig.pending=null;
      rig.x=side==="left"?.42:.58;rig.y=.665;rig.baseY=.665;rig.caught=false;rig.catchId="";rig.anim=null;
      const hook=this.hook(side);hook?.classList.remove("has-catch","is-reeling");
      this.water?.classList.remove(side==="left"?"pull-left":"pull-right");
      if(removeCatch)hook?.querySelector(".fishing-hook-catch")?.replaceWith(this.emptyCatch(side));
    }

    emptyCatch(side){
      const empty=document.createElement("div");empty.className=`fishing-hook-catch ${side}`;empty.dataset.catchId="";return empty;
    }

    syncCatch(side,catchId,animate=false){
      const rig=this.rigs[side];if(!rig||this.destroyed)return;
      const nextId=String(catchId||"");
      // Pending requests and older empty polls must not reset this round's pull.
      if(!nextId){if(!rig.pending&&!rig.caught&&rig.anim?.kind!=="return")this.resetRig(side,false);return;}
      const changed=rig.catchId!==nextId;
      if(!changed&&rig.caught)return;
      rig.catchId=nextId;rig.caught=true;
      this.hook(side)?.classList.add("has-catch");
      if(rig.pending||changed&&animate)this.reel(side,nextId);
      else{rig.y=this.catchRestY(side);rig.baseY=rig.y;rig.anim=null;}
      this.updateDebug();
    }

    stopReel(rig){
      clearTimeout(rig.reelTimer);rig.reelTimer=null;
      rig.resolveReel?.();rig.resolveReel=null;rig.anim=null;
    }

    beginPull(side,eventId){
      const rig=this.rigs[side];
      if(!rig||this.destroyed||rig.caught||rig.pending||!eventId)return false;
      const now=performance.now();this.advanceRig(rig,now);this.stopReel(rig);
      rig.pending={eventId:String(eventId),startedAt:now};
      this.hook(side)?.classList.add("is-reeling");
      this.water?.classList.add(side==="left"?"pull-left":"pull-right");
      this.setPhase("reeling",{side,pending:true});
      // Lift the actual line/bobber now, but never invent an unconfirmed fish.
      // Slow responses hold at an intermediate point before the final lift.
      rig.anim={kind:"pending",startedAt:now,duration:this.reducedMotion?80:900,fromX:rig.x,fromY:rig.y,toX:rig.x,toY:.565};
      this.log("pull-requested",{side,eventId:String(eventId)});
      return true;
    }

    cancelPendingPull(side,eventId){
      const rig=this.rigs[side];
      if(!rig||this.destroyed||rig.caught||rig.pending?.eventId!==String(eventId))return false;
      const now=performance.now();this.advanceRig(rig,now);this.stopReel(rig);rig.pending=null;
      this.hook(side)?.classList.remove("is-reeling");
      this.water?.classList.remove(side==="left"?"pull-left":"pull-right");
      rig.anim={kind:"return",startedAt:now,duration:this.reducedMotion?80:350,fromX:rig.x,fromY:rig.y,toX:side==="left"?.42:.58,toY:.665};
      if(this.phase!=="complete"&&!SIDES.some(s=>this.rigs[s].pending||this.rigs[s].anim?.kind==="reel"))this.setPhase("waiting",{side});
      this.log("pull-cancelled",{side,eventId:String(eventId)});
      return true;
    }

    reel(side,catchId=""){
      const rig=this.rigs[side];if(!rig||this.destroyed)return Promise.resolve();
      const now=performance.now(),pending=rig.pending;
      this.advanceRig(rig,now);this.stopReel(rig);rig.pending=null;
      const duration=this.reducedMotion?80:pending?clamp(1150-(now-pending.startedAt),160,450):1250;
      const hook=this.hook(side);hook?.classList.add("has-catch","is-reeling");
      this.water?.classList.add(side==="left"?"pull-left":"pull-right");
      if(this.phase!=="complete")this.setPhase("reeling",{side});
      rig.caught=true;rig.catchId=String(catchId||rig.catchId||"");
      const fromY=rig.y;
      rig.baseY=this.catchRestY(side);
      rig.anim={kind:"reel",startedAt:now,duration,fromX:rig.x,fromY,toX:side==="left"?.42:.58,toY:rig.baseY};
      this.log(pending?"pull-confirmed":"reel-started",{side,catchId:rig.catchId,duration,...(pending?{confirmationMs:round(now-pending.startedAt)}:{})});
      return new Promise(resolve=>{rig.resolveReel=resolve;rig.reelTimer=setTimeout(()=>{
        rig.reelTimer=null;rig.resolveReel=null;
        if(this.destroyed){resolve();return;}
        this.advanceRig(rig,performance.now());
        hook?.classList.remove("is-reeling");
        this.water?.classList.remove(side==="left"?"pull-left":"pull-right");
        if(this.phase!=="complete"&&!SIDES.some(s=>this.rigs[s].pending||this.rigs[s].anim?.kind==="reel"))this.setPhase("caught",{side});
        this.log("catch-secured",{side,catchId:rig.catchId});
        resolve();
      },duration+30);});
    }

    hook(side){return this.scene?.querySelector(`.fishing-hook-node.${side}`)||null;}

    catchRestY(side){
      // Keep the newly top-attached fish AND its caption inside narrow scenes.
      // Move the whole rig; the line endpoint and bobber use this same position.
      const height=this.water?.getBoundingClientRect().height||430;
      const caughtHeight=this.hook(side)?.querySelector('.fishing-catch-unit')?.offsetHeight||0;
      return Math.min(.48,Math.max(.2,1-(caughtHeight+8)/height));
    }

    rodTip(side){
      const img=this.scene?.querySelector(`.fishing-angler.${side} img`);
      const waterRect=this.water?.getBoundingClientRect();
      if(!img||!waterRect)return{x:0,y:0};
      const r=img.getBoundingClientRect();
      return{x:side==="left"?r.right-r.width*.018:r.left+r.width*.018,y:r.top+r.height*.045};
    }

    resize(){
      if(!this.water||!this.canvas)return;
      const rect=this.water.getBoundingClientRect(),dpr=Math.min(1.5,global.devicePixelRatio||1);
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

    advanceRig(rig,now){
      if(rig.anim){
        const progress=clamp((now-rig.anim.startedAt)/rig.anim.duration,0,1);
        const eased=rig.anim.kind==="cast"?easeInOutCubic(progress):easeOutCubic(progress);
        rig.x=rig.anim.fromX+(rig.anim.toX-rig.anim.fromX)*eased;
        rig.y=rig.anim.fromY+(rig.anim.toY-rig.anim.fromY)*eased;
        if(progress>=1){rig.x=rig.anim.toX;rig.y=rig.anim.toY;rig.baseY=rig.anim.toY;rig.anim=null;}
      }
    }

    updateRig(rig,now){
      this.advanceRig(rig,now);
      const hook=this.hook(rig.side);if(!hook||!this.water)return;
      const bob=this.reducedMotion?0:Math.sin(now/1280+rig.phaseOffset)*(rig.caught?2.25:1.35);
      hook.style.left=`${rig.x*100}%`;
      hook.style.top=`${rig.y*100}%`;
      hook.style.transform=`translate3d(-50%,${bob.toFixed(2)}px,0)`;
      const waterRect=this.water.getBoundingClientRect(),tip=this.rodTip(rig.side);
      const sx=clamp((tip.x-waterRect.left)/Math.max(1,waterRect.width)*1000,0,1000);
      const sy=clamp((tip.y-waterRect.top)/Math.max(1,waterRect.height)*430,0,430);
      const ex=rig.x*1000,ey=(rig.y+bob/Math.max(1,waterRect.height))*430;
      const cx=sx+(ex-sx)*.64,cy=Math.min(sy,ey)-Math.max(18,Math.abs(ex-sx)*.095);
      const path=this.scene.querySelector(`.fishing-line-svg.${rig.side}`);
      path?.setAttribute("d",`M${sx.toFixed(1)} ${sy.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`);
      this.geometry[rig.side]={rodTip:{x:round(sx),y:round(sy)},lineEnd:{x:round(ex),y:round(ey)},connectedDelta:0,catchId:rig.catchId||"",caught:rig.caught,pendingEvent:rig.pending?.eventId||""};
    }

    drawWater(now){
      if(!this.ctx||!this.canvas)return;
      const ctx=this.ctx,dpr=this.canvasDpr||1,w=this.canvas.width/dpr,h=this.canvas.height/dpr,horizon=h*.42;
      ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
      const phase=this.reducedMotion?0:now*.00115;
      const gradient=ctx.createLinearGradient(0,horizon,0,h);gradient.addColorStop(0,"rgba(86,238,244,.035)");gradient.addColorStop(.55,"rgba(18,171,205,.075)");gradient.addColorStop(1,"rgba(0,83,128,.105)");ctx.fillStyle=gradient;ctx.fillRect(0,horizon,w,h-horizon);
      ctx.globalCompositeOperation="screen";
      for(let row=0;row<18;row++){
        const y=horizon+14+row*((h-horizon-20)/18),amp=1.8+row*.16,freq=.0112+row*.00032;
        ctx.beginPath();
        for(let x=-8;x<=w+8;x+=8){const wave=Math.sin(x*freq+phase*(1.6+row*.034)+row*.73)*amp+Math.sin(x*.0041-phase*.9)*1.05; if(x===-8)ctx.moveTo(x,y+wave);else ctx.lineTo(x,y+wave);}
        ctx.strokeStyle=`rgba(${row%3===0?"221,254,255":"92,231,235"},${.09+(row%4)*.018})`;ctx.lineWidth=row%4===0?1.25:.75;ctx.stroke();
      }
      for(let band=0;band<3;band++){
        const y=horizon+(band+1)*(h-horizon)/4;
        ctx.beginPath();
        for(let x=-40;x<=w+40;x+=12){const wave=Math.sin(x*.0078+phase*.58+band*1.8)*(4+band*.65);if(x===-40)ctx.moveTo(x,y+wave);else ctx.lineTo(x,y+wave);}
        ctx.strokeStyle="rgba(214,252,255,.08)";ctx.lineWidth=3.5+band;ctx.stroke();
      }
      ctx.globalCompositeOperation="source-over";
    }

    frame(now){
      if(this.destroyed)return;
      if(!this.root.isConnected){this.destroy();return;}
      for(const side of SIDES)this.updateRig(this.rigs[side],now);
      if(now-this.lastWaterFrame>32){this.lastWaterFrame=now;this.drawWater(now);}
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
      if(global.navigator?.clipboard?.writeText)await global.navigator.clipboard.writeText(text);
      else{
        const area=document.createElement("textarea");area.value=text;area.style.position="fixed";area.style.opacity="0";document.body.appendChild(area);area.select();document.execCommand("copy");area.remove();
      }
      this.log("debug-report-copied",{characters:text.length});
      return text;
    }

    updateDebug(){
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
      for(const side of SIDES){this.stopReel(this.rigs[side]);this.rigs[side].pending=null;}
      this.destroyed=true;cancelAnimationFrame(this.frameHandle);this.resizeObserver?.disconnect();global.removeEventListener("resize",this.boundResize);global.removeEventListener("error",this.boundError);global.removeEventListener("unhandledrejection",this.boundRejection);
    }
  }

  global.FishingSceneController=FishingSceneController;
  global.FISHING_CONTROLLER_VERSION=VERSION;
})(window);
