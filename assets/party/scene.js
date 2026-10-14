/* Original vector scenery and characters, rendered at a capped device ratio. */
window.PartyScene=(()=>{
  'use strict';
  const C=window.PartyCatalog,TAU=Math.PI*2;
  let climbKey='',climbPositions=[];
  const round=(c,x,y,w,h,r,fill,stroke)=>{c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();}};
  const circle=(c,x,y,r,fill)=>{c.beginPath();c.arc(x,y,r,0,TAU);c.fillStyle=fill;c.fill();};
  const line=(c,x,y,a,b,color,width=2)=>{c.beginPath();c.moveTo(x,y);c.lineTo(a,b);c.strokeStyle=color;c.lineWidth=width;c.stroke();};
  const text=(c,t,x,y,size=18,color='#fff',align='center',weight=800)=>{c.font=`${weight} ${size}px "Trebuchet MS",sans-serif`;c.fillStyle=color;c.textAlign=align;c.fillText(t,x,y);};
  function character(c,id,x,y,size=1,skin='classic',time=0){
    const ch=C.characters.find(v=>v.id===id)||C.characters[0];c.save();c.translate(x,y);c.scale(size,size);const bob=Math.sin(time*3)*1.8;c.translate(0,bob);
    c.save();c.scale(1,.32);circle(c,0,111,29,'#0d102642');c.restore();
    const coat=skin==='sunset'?'#f19c65':skin==='electric'?'#a985ed':skin==='champion'?'#ebc25e':ch.accent;
    round(c,-18,16,36,30,12,coat);round(c,-18,37,13,12,5,'#34334e');round(c,5,37,13,12,5,'#34334e');
    c.lineCap='round';line(c,-18,23,-27,32,ch.color,9);line(c,18,23,27,30,ch.color,9);line(c,-3,21,-3,43,'#ffffff45',2);
    if(id==='fox'){c.beginPath();c.moveTo(-27,-15);c.lineTo(-29,-47);c.lineTo(-7,-28);c.fillStyle=ch.color;c.fill();c.beginPath();c.moveTo(27,-15);c.lineTo(29,-47);c.lineTo(7,-28);c.fill();}
    if(id==='raccoon'){circle(c,-22,-27,13,ch.color);circle(c,22,-27,13,ch.color);circle(c,-22,-27,7,'#57506b');circle(c,22,-27,7,'#57506b');}
    if(id==='robot'){line(c,0,-29,0,-43,ch.color,4);circle(c,0,-46,5,'#ffd68c');round(c,-34,-13,9,20,4,ch.accent);round(c,25,-13,9,20,4,ch.accent);}
    round(c,-28,-30,56,51,id==='robot'?15:24,ch.color);if(id==='frog'){circle(c,-17,-27,14,ch.color);circle(c,17,-27,14,ch.color);}
    if(id==='fox'){c.beginPath();c.moveTo(-27,-8);c.quadraticCurveTo(0,5,27,-8);c.quadraticCurveTo(20,25,0,22);c.quadraticCurveTo(-20,25,-27,-8);c.fillStyle='#fff1d7';c.fill();}
    if(id==='raccoon'){round(c,-25,-12,50,21,10,'#4a435e');}if(id==='robot')round(c,-23,-21,46,29,9,'#263c56');
    circle(c,-10,-4,4,id==='robot'?'#9affd4':'#252638');circle(c,10,-4,4,id==='robot'?'#9affd4':'#252638');circle(c,-11,-5.5,1.3,'white');circle(c,9,-5.5,1.3,'white');
    c.beginPath();c.arc(0,4,7,.15,Math.PI-.15);c.strokeStyle=id==='robot'?'#9affd4':'#574257';c.lineWidth=2;c.stroke();
    if(skin==='champion'){c.beginPath();c.moveTo(-18,-29);c.lineTo(-22,-45);c.lineTo(-8,-38);c.lineTo(0,-51);c.lineTo(8,-38);c.lineTo(22,-45);c.lineTo(18,-29);c.closePath();c.fillStyle='#ffe594';c.fill();}
    c.restore();
  }
  function sky(c,time){const gr=c.createLinearGradient(0,0,0,660);gr.addColorStop(0,'#26213f');gr.addColorStop(.55,'#43466c');gr.addColorStop(1,'#3b6f88');c.fillStyle=gr;c.fillRect(0,0,900,660);circle(c,760,85,31,'#f5deb0');circle(c,749,76,30,'#29243f');
    for(let i=0;i<45;i++)circle(c,(i*163+52)%900,(i*83+26)%255,.8+(i%3)*.4,`rgba(255,245,221,${.2+.3*(Math.sin(time+i)+1)/2})`);
    for(let i=0;i<19;i++){const x=i*52-15,h=55+(i*37)%100;c.fillStyle=i%2?'#31304f':'#353352';c.fillRect(x,270-h,46,h+90);for(let a=0;a<3;a++)for(let b=0;b<5;b++)if((i+a+b)%3){c.fillStyle=(i+b)%3?'#c2a4ce55':'#edc18b77';c.fillRect(x+8+a*12,285-h+b*16,4,7);}}
  }
  function trophy(c,x,y,s=1){c.save();c.translate(x,y);c.scale(s,s);c.strokeStyle='#ffcf6d';c.lineWidth=4;c.beginPath();c.arc(-10,-8,8,0,TAU);c.stroke();c.beginPath();c.arc(10,-8,8,0,TAU);c.stroke();round(c,-11,-19,22,26,5,'#ffe6a1');line(c,0,6,0,19,'#ffcf6d',5);round(c,-13,17,26,7,3,'#e4ad54');c.restore();}
  const node=i=>{const a=Math.PI*1.08+i/24*TAU;return [450+322*Math.cos(a),377+159*Math.sin(a)];};
  function building(c,x,y,w,h,color,label){c.fillStyle='#0002';c.beginPath();c.ellipse(x+w/2,y+10,w*.7,18,0,0,TAU);c.fill();round(c,x,y-h,w,h,8,color);c.fillStyle='#ffffff12';c.fillRect(x+6,y-h+7,w-12,8);round(c,x+7,y-h+19,w-14,h<80?17:28,5,'#292341');text(c,label,x+w/2,y-h+(h<80?31:39),h<80?9:12,'#f8dd9f');for(let i=0;i<Math.floor(w/26);i++)round(c,x+11+i*26,y-(h<80?23:34),16,h<80?18:27,3,'#a3dce0');}
  function board(c,state,time){sky(c,time);
    // Harbor and reflections behind the floating promenade.
    c.fillStyle='#30516d';c.fillRect(0,360,900,300);for(let i=0;i<40;i++){const y=375+i*7,x=((i*79+time*9)%1000)-60;line(c,x,y,x+25+i%5*7,y,'#96c4cf1f',2);}
    c.fillStyle='#17283b66';c.beginPath();c.ellipse(450,473,385,150,0,0,TAU);c.fill();
    c.fillStyle='#4a5063';c.beginPath();c.ellipse(450,396,375,198,0,0,TAU);c.fill();
    c.fillStyle='#8f88a0';c.beginPath();c.ellipse(450,373,375,190,0,0,TAU);c.fill();
    c.fillStyle='#696980';c.beginPath();c.ellipse(450,367,350,165,0,0,TAU);c.fill();
    c.lineWidth=9;c.strokeStyle='#e6d8bb';c.beginPath();c.ellipse(450,377,322,159,0,0,TAU);c.stroke();
    // Ferris wheel, games pavilion, gardens, string lights.
    const wx=658,wy=227,wr=69;line(c,wx-39,wy+91,wx,wy,'#c6bed8',6);line(c,wx+39,wy+91,wx,wy,'#c6bed8',6);c.strokeStyle='#bfb1d6';c.lineWidth=4;c.beginPath();c.arc(wx,wy,wr,0,TAU);c.stroke();
    for(let i=0;i<10;i++){const a=i/10*TAU+time*.045,x=wx+Math.cos(a)*wr,y=wy+Math.sin(a)*wr;line(c,wx,wy,x,y,'#bda9d87a',2);round(c,x-9,y-4,18,17,6,['#ecb5d0','#a3d9cb','#f5d090'][i%3]);}circle(c,wx,wy,9,'#f6dfa7');
    building(c,333,370,166,94,'#bd88a9','THE NIGHT ARCADE');building(c,244,340,69,63,'#9bb5a7','SNACKS');
    round(c,351,284,129,13,3,'#d9b5f4');text(c,'B O A R D W A L K',415,279,15,'#f8e4b7');
    for(let i=0;i<5;i++){const x=350+i*29;line(c,x,375,x,387,'#e4bda5',3);}round(c,342,387,159,8,3,'#c4a1a8');
    for(const [x,y] of [[570,385],[297,403],[526,283]]){round(c,x-22,y+6,45,13,5,'#576a68');circle(c,x,y-9,22,'#699b89');circle(c,x-11,y-13,14,'#85b69b');}
    for(const [x,y] of [[176,320],[731,397],[286,496],[567,525]]){line(c,x,y,x,y-57,'#33334c',5);circle(c,x,y-63,10,'#ffe6b0');const g=c.createRadialGradient(x,y-63,0,x,y-63,46);g.addColorStop(0,'#ffe1a033');g.addColorStop(1,'#ffe1a000');circle(c,x,y-63,46,g);}
    for(let i=0;i<24;i++){const [x,y]=node(i),sp=C.spaces[i];c.save();c.translate(x,y);c.scale(1,.62);round(c,-17,-17,34,34,9,sp.type==='rain'?'#8b93c7':sp.type==='gift'?'#edb1ca':sp.type==='tokens'?'#ead398':'#c8c2cb','#e8e2e0');c.restore();if(sp.type==='tokens')text(c,'●',x,y+4,14,'#9c7133');if(sp.type==='gift')text(c,'✦',x,y+5,18,'#96597e');if(sp.type==='rain')text(c,'☂',x,y+5,17,'#555783');}
    const goal=node(state?.goal??6);trophy(c,goal[0],goal[1]-31,1.05);text(c,'6 tokens',goal[0],goal[1]+23,10,'#fff1cb');
    const players=state?.players||C.characters.map((p,i)=>({id:p.id,character:p.id,position:[1,5,12,19][i],skin:'classic'}));
    const ordered=players.map((p,i)=>{let pos=p.position;const m=state?.lastMove;if(m?.player===p.id&&time*1000-m.at<1200)pos=m.from+Math.max(0,Math.min(1,(time*1000-m.at)/1200))*m.steps;return {p,i,pos,xy:node(pos)};}).sort((a,b)=>a.xy[1]-b.xy[1]);
    for(const {p,i,xy} of ordered){const same=players.filter(x=>x.position===p.position).length,offset=same>1?(i%2?13:-13):0;character(c,p.character,xy[0]+offset,xy[1]-24,.61,p.skin,time+i);if(p.id===state?.you){circle(c,xy[0]+offset,xy[1]-75,4,'#fff');}}
    line(c,156,261,572,163,'#e1c49b88',2);for(let i=0;i<=12;i++)circle(c,156+i*34.6,261-i*8.16+Math.sin(i/12*Math.PI)*19,3.3,i%2?'#edb0df':'#ffdb9e');
  }
  function climb(c,s,t){sky(c,t);const ps=s?.players||C.characters.map(p=>({character:p.id,skin:'classic'})),g=s?.game;
    const key=(s?.id||'preview')+':'+(g?.start||0);if(key!==climbKey){climbKey=key;climbPositions=ps.map((p,i)=>g?.progress[i]?.step||0);}
    for(let i=0;i<ps.length;i++){const x=130+i*(640/Math.max(1,ps.length-1)),v=g?.progress[i],step=v?.step||0;climbPositions[i]=(climbPositions[i]||0)+(step-(climbPositions[i]||0))*.22;round(c,x-50,140,100,470,8,['#615b83','#756479','#557d7c','#596b88'][i%4]);for(let n=0;n<24;n++){const y=572-n*17;round(c,x-34,y,68,6,3,n<step?'#f5d89f':'#a8a0be');if(n%4===0){round(c,x-22,y+8,12,9,2,'#f6d6a555');round(c,x+10,y+8,12,9,2,'#f6d6a555');}}
      round(c,x-61,129,122,17,5,'#b4a8c7');trophy(c,x,101,.6);character(c,ps[i].character,x,560-Math.min(24,climbPositions[i])*17,.75,ps[i].skin,t+i);text(c,ps[i].name||C.characters[i].name,x,633,18,'#eee9f5');}
    text(c,'UP, UP & AWAY',450,50,24,'#f3deac');
  }
  function fish(c,s,t){sky(c,t);c.fillStyle='#244562';c.fillRect(0,285,900,375);for(let i=0;i<35;i++){const y=290+i*10;line(c,(i*83+t*18)%950-50,y,(i*83+t*18)%950+50,y,'#75c3cf22',3);}
    const ps=s?.players||C.characters.map(p=>({character:p.id,skin:'classic'}));for(let i=0;i<ps.length;i++){const x=125+i*650/Math.max(1,ps.length-1);round(c,x-48,355,96,17,4,'#bf9b97');for(let j=0;j<4;j++)line(c,x-36+j*24,355,x-36+j*24,372,'#806d7b');line(c,x-30,372,x-30,460,'#765e73',9);line(c,x+30,372,x+30,450,'#765e73',9);character(c,ps[i].character,x,318,.75,ps[i].skin,t+i);line(c,x+20,330,x+53,266,'#eacba7',4);line(c,x+53,266,x+75,417,'#d6ced4',1);circle(c,x+75,420+Math.sin(t*3+i)*3,6,'#f5b4b5');
      const score=s?.game?.scores[i]||0;text(c,String(score),x,490,24,'#e3eeed');}
    const g=s?.game,idx=s?.players.findIndex(p=>p.id===s.you)??0,v=g?.progress[idx],attempt=v?.attempts||0,target=.5+.23*Math.sin(attempt*2.1),pos=.5+.46*Math.sin((t*1000-(g?.start||0))/1000*2.1);
    round(c,160,540,580,30,15,'#172c43');round(c,160+(target-.085)*580,540,.17*580,30,10,'#eac989');circle(c,160+pos*580,555,14,'#fff3db');text(c,'REEL INSIDE THE GOLD ZONE',450,610,18,'#d7e5e9');
  }
  function memory(c,s,t,pattern){sky(c,t);round(c,190,150,520,410,30,'#b699b6');round(c,205,165,490,380,23,'#433551');round(c,250,107,400,57,12,'#e6b6d2');text(c,'A F T E R G L O W',450,145,28,'#5d3c68');
    const idx=s?.players.findIndex(p=>p.id===s.you)??0,v=s?.game?.progress[idx],at=v?.showAt||0,a=Math.floor((t*1000-at)/650),active=pattern&&t*1000>=at&&a<pattern.length&&(t*1000-at)%650<460?pattern[a]:-1;
    for(let i=0;i<4;i++){const x=243+(i%2)*213,y=204+Math.floor(i/2)*145,col=['#81bce5','#db9ab9','#9dc9b2','#dfc17f'][i];c.save();if(active===i){c.shadowColor=col;c.shadowBlur=35;}round(c,x,y,198,128,20,active===i?'#fff4dc':col);c.restore();text(c,String(i+1),x+99,y+79,40,active===i?'#7b6582':'#43364f');}
    text(c,active>=0?'WATCH THE LIGHTS':s?.phase==='playing'?'YOUR TURN TO SHINE':'REMEMBER THE RHYTHM',450,604,19,'#f2dce8');
  }
  function putt(c,s,t,aim){sky(c,t);c.save();c.translate(140,20);c.scale(.87,.87);const h=C.hole;
    round(c,85,75,550,570,24,'#806e9b');round(c,100,90,520,540,15,'#7cb89b');for(let i=0;i<12;i++){c.fillStyle=i%2?'#ffffff08':'#ffffff00';c.fillRect(100,90+i*45,520,45);}for(const r of h.sand){round(c,r.x,r.y,r.w,r.h,16,'#dfcca0');for(let i=0;i<20;i++)circle(c,r.x+(i*31)%r.w,r.y+9+(i*13)%(r.h-18),1,'#aa957366');}
    for(const [a,b] of h.walls){line(c,...a,...b,'#425d65',20);line(c,a[0],a[1]-7,b[0],b[1]-7,'#e5d8ea',14);}for(const b of h.bumpers){circle(c,b.x,b.y,b.r+4,'#517e75');circle(c,b.x,b.y,b.r,'#db96b8');circle(c,b.x-6,b.y-8,8,'#f5cde3');}
    circle(c,...h.cup,17,'#204e43');line(c,h.cup[0],h.cup[1],h.cup[0],h.cup[1]-75,'#faf0da',4);c.fillStyle='#b38bdf';c.beginPath();c.moveTo(h.cup[0],h.cup[1]-75);c.lineTo(h.cup[0]+44,h.cup[1]-59);c.lineTo(h.cup[0],h.cup[1]-45);c.fill();
    const i=s?.players.findIndex(p=>p.id===s.you)??0,shot=s?.game?.progress[i]?.shot;let ball=h.tee,alpha=1;
    if(shot){const elapsed=t*1000-shot.at,frames=shot.frames;let a=frames[0],b=frames.at(-1);for(let j=1;j<frames.length;j++)if(frames[j][0]>=elapsed){a=frames[j-1];b=frames[j];break;}const q=Math.max(0,Math.min(1,(elapsed-a[0])/(b[0]-a[0]||1)));ball=[a[1]+(b[1]-a[1])*q,a[2]+(b[2]-a[2])*q];alpha=a[3]+(b[3]-a[3])*q;}
    if(!shot||t*1000>shot.at+shot.duration+600){ball=h.tee;alpha=1;if(aim){c.setLineDash([8,8]);line(c,...ball,ball[0]+Math.cos(aim.angle)*150*aim.power,ball[1]+Math.sin(aim.angle)*150*aim.power,'#fff4d9',4);c.setLineDash([]);}}
    c.globalAlpha=alpha;circle(c,ball[0]+2,ball[1]+5,10,'#346a5d66');circle(c,...ball,9,'#fff8de');circle(c,ball[0]-3,ball[1]-3,3,'#fff');c.globalAlpha=1;
    c.restore();const p=s?.players[i];character(c,p?.character||'frog',130,580,.85,p?.skin,t);text(c,'THREE CHANCES. FIND YOUR LINE.',450,632,17,'#eee2cb');
  }
  function confetti(c,t){for(let i=0;i<65;i++){const x=(i*139)%900,y=((t*75+i*43)%720)-50;c.save();c.translate(x,y);c.rotate(t+i);c.fillStyle=['#ffcb83','#bba8f1','#99d9be','#eca4c7'][i%4];c.fillRect(-3,-6,6,12);c.restore();}}
  function render(canvas,kind,state,time=0,extra={}){if(!canvas)return;const w=canvas.clientWidth||900,h=canvas.clientHeight||660,d=Math.min(devicePixelRatio||1,2);if(canvas.width!==Math.round(w*d)||canvas.height!==Math.round(h*d)){canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);}const c=canvas.getContext('2d');c.setTransform(canvas.width/900,0,0,canvas.height/660,0,0);c.clearRect(0,0,900,660);
    if(kind==='climb')climb(c,state,time);else if(kind==='fish')fish(c,state,time);else if(kind==='memory')memory(c,state,time,extra.pattern);else if(kind==='putt')putt(c,state,time,extra.aim);else board(c,state,time);
    if(state?.phase==='complete'){confetti(c,time);const winner=state.players.find(p=>p.id===state.winner);if(winner){round(c,270,135,360,285,30,'#302743ec');character(c,winner.character,450,266,1.8,winner.skin,time);text(c,winner.name,450,379,28);trophy(c,450,162,.7);}}
  }
  function portrait(canvas,id,skin='classic'){const c=canvas.getContext('2d');canvas.width=180;canvas.height=190;c.clearRect(0,0,180,190);character(c,id,90,89,1.65,skin);}
  return {render,portrait};
})();
