/* POCKET_PUTT_V5 — fixed-step deterministic ball simulation, no client score input. */
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.PuttPhysics=value;})(globalThis,()=>{
  'use strict';
  const R=9,DT=1/120,MAX_SPEED=660,DRAG=155,MAX_SECONDS=12;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const inside=(x,y,points)=>{let yes=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const [a,b]=points[i],[c,d]=points[j];if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)yes=!yes;}return yes;};
  const inRect=(b,r)=>b.x>r.x&&b.x<r.x+r.w&&b.y>r.y&&b.y<r.y+r.h;
  function closest(x,y,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1),0,1);return [a[0]+dx*t,a[1]+dy*t];}
  function gateSegment(h,time){const g=h.gate;if(!g)return null;const a=time*g.speed;return [[g.x-Math.cos(a)*g.length,g.y-Math.sin(a)*g.length],[g.x+Math.cos(a)*g.length,g.y+Math.sin(a)*g.length]];}
  function safe(h,p){if(!inside(p[0],p[1],h.floor))return false;return !h.water?.some(r=>inRect({x:p[0],y:p[1]},r));}
  // Smooth compact hills: positive height rolls outwards, negative height draws
  // the ball into a divot. The slope and its force reach zero at the outer edge.
  function terrainAt(h,x,y){
    let height=0,ax=0,ay=0;
    for(const t of h.terrain||[]){const dx=x-t.x,dy=y-t.y,q=(dx/t.rx)**2+(dy/t.ry)**2;if(q>=1)continue;
      const rim=1-q;height+=t.height*rim*rim;const force=800*4*t.height*rim;ax+=force*dx/(t.rx*t.rx);ay+=force*dy/(t.ry*t.ry);
    }
    return {height,ax,ay};
  }
  function rampHeight(h,x,y){
    let z=0;for(const r of h.ramps||[]){const dx=x-r.x,dy=y-r.y,f=dx*Math.cos(r.angle)+dy*Math.sin(r.angle),side=-dx*Math.sin(r.angle)+dy*Math.cos(r.angle);if(f>=-r.length&&f<=0&&Math.abs(side)<=r.width/2)z=Math.max(z,(1+f/r.length)*r.height);}return z;
  }
  const PORTAL_SECONDS=1.5;
  // One shared curve drives both the visible covered chute and ball transport.
  function portalPoint(h,t){const p=h.portal,a=[p.mouth[0],p.mouth[1]-125],b=[a[0],a[1]-75],c=[p.exit[0]-Math.cos(p.angle)*75,p.exit[1]-Math.sin(p.angle)*75],d=p.exit,u=1-t;return a.map((v,i)=>u*u*u*v+3*u*u*t*b[i]+3*u*t*t*c[i]+t*t*t*d[i]);}
  function simulate(h,position,angle,power,startMs=0,record=true){
    if(!Number.isFinite(angle)||!Number.isFinite(power)||power<=0||power>1)throw new Error('Invalid shot.');
    let b={x:position[0],y:position[1],vx:Math.cos(angle)*MAX_SPEED*power,vy:Math.sin(angle)*MAX_SPEED*power};
    const frames=[[0,b.x,b.y,1,0]],events=[];let time=0,holed=false,penalty=0,portalUsed=false,transit=0,steps=0,z=0,vz=0,airborne=false;const launched=new Set();
    const edges=h.floor.map((p,i)=>[p,h.floor[(i+1)%h.floor.length]]);
    function frame(alpha=1){if(record)frames.push([Math.round(time*1000),+b.x.toFixed(3),+b.y.toFixed(3),alpha,+z.toFixed(3)]);}
    function collide(a,c,radius=R+4,restitution=0.79){const q=closest(b.x,b.y,a,c),dx=b.x-q[0],dy=b.y-q[1],d=Math.hypot(dx,dy);if(d>=radius)return;let nx=dx/(d||1),ny=dy/(d||1);if(d<0.0001){const length=Math.hypot(c[0]-a[0],c[1]-a[1])||1;nx=-(c[1]-a[1])/length;ny=(c[0]-a[0])/length;}b.x=q[0]+nx*(radius+0.02);b.y=q[1]+ny*(radius+0.02);const dot=b.vx*nx+b.vy*ny;if(dot<0){b.vx-=(1+restitution)*dot*nx;b.vy-=(1+restitution)*dot*ny;if(!events.length||time*1000-events.at(-1).at>85)events.push({type:'bank',at:Math.round(time*1000),x:b.x,y:b.y});}}
    // Never leave a ball stranded inside a chute at the simulation time limit.
    while(time<MAX_SECONDS||transit>0){
      time+=DT;steps++;
      if(transit>0){transit-=DT;if(transit<=0){const p=h.portal;b.x=p.exit[0];b.y=p.exit[1];b.vx=Math.cos(p.angle)*180;b.vy=Math.sin(p.angle)*180;events.push({type:'pop',at:Math.round(time*1000),x:b.x,y:b.y});frame(1);}else {const progress=(PORTAL_SECONDS-transit-.3)/(PORTAL_SECONDS-.3);if(progress>=0){[b.x,b.y]=portalPoint(h,clamp(progress,0,1));}if(steps%4===0)frame(progress>=0?1:0);}continue;}
      if(airborne){
        b.x+=b.vx*DT;b.y+=b.vy*DT;vz-=500*DT;z+=vz*DT;
        if(z>0){if(steps%4===0)frame();continue;}
        z=0;airborne=false;events.push({type:'land',at:Math.round(time*1000),x:b.x,y:b.y});b.vx*=.4;b.vy*=.4;
        if(!safe(h,[b.x,b.y])){events.push({type:'splash',at:Math.round(time*1000),x:b.x,y:b.y});frame(0);time+=.65;b.x=position[0];b.y=position[1];b.vx=b.vy=0;penalty=1;frame();break;}
      }
      const terrain=terrainAt(h,b.x,b.y);b.vx+=terrain.ax*DT;b.vy+=terrain.ay*DT;
      let beltX=0,beltY=0;for(const c of h.conveyors||[])if(inRect(b,c)){beltX+=Math.cos(c.angle)*c.force;beltY+=Math.sin(c.angle)*c.force;}b.vx+=beltX*DT;b.vy+=beltY*DT;
      const px=b.x,py=b.y;b.x+=b.vx*DT;b.y+=b.vy*DT;
      for(const [i,r] of (h.ramps||[]).entries()){
        const co=Math.cos(r.angle),si=Math.sin(r.angle),before=(px-r.x)*co+(py-r.y)*si,after=(b.x-r.x)*co+(b.y-r.y)*si,side=-(b.x-r.x)*si+(b.y-r.y)*co,forward=b.vx*co+b.vy*si;
        if(!launched.has(i)&&before<=0&&after>0&&Math.abs(side)<r.width/2-R&&forward>70&&forward>Math.hypot(b.vx,b.vy)*.65){launched.add(i);airborne=true;z=r.height;vz=forward*r.lift;events.push({type:'launch',at:Math.round(time*1000),x:b.x,y:b.y});frame();break;}
      }
      if(airborne)continue;
      for(let pass=0;pass<2;pass++){for(const [a,c] of edges)collide(a,c,R+2);for(const [a,c] of h.walls||[])collide(a,c);const gate=gateSegment(h,startMs/1000+time);if(gate)collide(...gate,R+7,0.85);}
      if(!inside(b.x,b.y,h.floor)){b.x=px;b.y=py;b.vx*=-0.7;b.vy*=-0.7;}
      for(const p of h.bumpers||[]){const dx=b.x-p.x,dy=b.y-p.y,d=Math.hypot(dx,dy),r=p.r+R;if(d<r){const nx=dx/(d||1),ny=dy/(d||1);b.x=p.x+nx*(r+0.1);b.y=p.y+ny*(r+0.1);const dot=b.vx*nx+b.vy*ny;if(dot<0){b.vx-=2.05*dot*nx;b.vy-=2.05*dot*ny;events.push({type:'bumper',at:Math.round(time*1000),x:p.x,y:p.y});}}}
      if(h.water?.some(r=>inRect(b,r))){events.push({type:'splash',at:Math.round(time*1000),x:b.x,y:b.y});frame();time+=0.65;b.x=position[0];b.y=position[1];b.vx=b.vy=0;penalty=1;frame();break;}
      if(h.portal&&!portalUsed&&Math.hypot(b.x-h.portal.mouth[0],b.y-h.portal.mouth[1])<22){portalUsed=true;transit=PORTAL_SECONDS;b.vx=b.vy=0;events.push({type:'gulp',at:Math.round(time*1000),x:b.x,y:b.y});frame(0);continue;}
      let speed=Math.hypot(b.vx,b.vy),distance=Math.hypot(b.x-h.cup[0],b.y-h.cup[1]);
      if(distance<15&&speed<220){b.x=h.cup[0];b.y=h.cup[1];b.vx=b.vy=0;holed=true;events.push({type:'cup',at:Math.round(time*1000),x:b.x,y:b.y});frame(0);break;}
      const drag=(h.sand||[]).some(r=>inRect(b,r))?460:DRAG;
      const next=Math.max(0,speed-drag*DT);if(speed){b.vx*=next/speed;b.vy*=next/speed;}
      if(steps%4===0)frame();
      if(next<3&&Math.hypot(terrain.ax+beltX,terrain.ay+beltY)<=drag){b.vx=b.vy=0;break;}
    }
    frame(holed?0:1);
    return {position:[+b.x.toFixed(3),+b.y.toFixed(3)],holed,penalty,portalUsed,duration:Math.max(180,Math.round(time*1000)),frames,events};
  }
  function botShot(h,position,now){
    // Prefer routes around rails using a coarse distance field, then test real shots.
    const targets=[h.cup,...(h.portal?[h.portal.mouth]:[])];let best={angle:0,power:0.4,score:Infinity};
    const cell=32,n=23,dist=Array.from({length:n*n},()=>Infinity),queue=[];
    function cellAt(p){return [clamp(Math.round(p[0]/cell),0,n-1),clamp(Math.round(p[1]/cell),0,n-1)];}
    const legal=(x,y)=>safe(h,[x*cell,y*cell])&&!(h.walls||[]).some(([a,b])=>{const q=closest(x*cell,y*cell,a,b);return Math.hypot(x*cell-q[0],y*cell-q[1])<21;});
    for(const p of targets){const [x,y]=cellAt(p);dist[y*n+x]=p===h.cup?0:4;queue.push([x,y]);}
    for(let head=0;head<queue.length;head++){const [x,y]=queue[head];for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=n||yy>=n||!legal(xx,yy))continue;const d=dist[y*n+x]+1;if(d<dist[yy*n+xx]){dist[yy*n+xx]=d;queue.push([xx,yy]);}}}
    const candidates=Array.from({length:48},(_,i)=>i*Math.PI/24);for(const p of targets)candidates.push(Math.atan2(p[1]-position[1],p[0]-position[0]));
    for(const angle of candidates)for(const power of [0.16,0.24,0.34,0.46,0.6,0.76,0.94]){const r=simulate(h,position,angle,power,now,false);const [x,y]=cellAt(r.position);let score=r.holed?-10000:r.penalty?10000:Math.min(200,dist[y*n+x])*32+Math.hypot(r.position[0]-h.cup[0],r.position[1]-h.cup[1])*0.14;if(Math.hypot(r.position[0]-position[0],r.position[1]-position[1])<18)score+=500;if(score<best.score)best={angle,power,score};}
    return {angle:best.angle,power:best.power};
  }
  return {R,DT,MAX_SPEED,DRAG,simulate,inside,closest,safe,portalPoint,PORTAL_SECONDS,gateSegment,terrainAt,rampHeight,botShot};
});
