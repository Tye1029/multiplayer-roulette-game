/* POCKET_PUTT_V6 */
(()=>{
  'use strict';
  const C=window.PuttCourses,P=window.PuttPhysics,M=window.PuttRules,B=window.PuttCosmetics,$=id=>document.getElementById(id),board=$('golf-board'),result=$('golf-result');
  let state=null,local=false,busy=false,polling=false,epoch=0,offset=0,aim=null,drag=null,frames=0,slowFrames=0,lastFrame=0,networkErrors=0,shotSeen='',playedEvents=new Set(),toastUntil=0,resultKey='',createIntent=null,shotRetry=null;
  const now=()=>Date.now()+offset;
  const playback=window.PuttPlayback.create();
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const controls=el('div',undefined,'golf-course-picker'),select=el('select'),label=el('span',C.courses.length+' courses · '+C.holes.length+' holes');select.id='golf-course';select.setAttribute('aria-label','Choose golf course');for(const c of C.courses){const o=el('option',c.name+' · '+c.difficulty);o.value=c.id;select.append(o);}const solo=el('button','Solo practice','golf-solo');controls.append(label,select,solo);
  let ballDialog,selectedBall='pearl',turnEventSeen='';
  const earnedBalls=()=>window.XanProgress?.profile?.achievements?.minigolf?.filter(a=>a.unlocked).map(a=>a.id)||[];
  function ballButton(){const b=el('button','Golf ball','golf-solo golf-ball-button');b.setAttribute('aria-label','Choose golf ball');b.onclick=()=>{ballDialog||=el('dialog',undefined,'xan-dialog golf-ball-dialog');if(!ballDialog.isConnected)document.body.append(ballDialog);drawBallPicker();ballDialog.showModal();window.XanProgress?.refresh();};return b;}
  controls.append(ballButton());
  function drawBallPicker(){
    ballDialog.replaceChildren(el('small','YOUR GOLF LOCKER','xg-kicker'),el('h2','Pick your golf ball'),el('p','Colors unlock through golf achievements against real players. Your choice follows your profile.'));
    const grid=el('div',undefined,'golf-ball-grid'),message=el('p');message.setAttribute('role','status');
    for(const color of B.colors){const unlocked=B.available(color.id,earnedBalls()),button=el('button',undefined,'golf-ball-choice');button.disabled=!unlocked;button.dataset.color=color.id;button.setAttribute('aria-pressed',String(selectedBall===color.id));const swatch=el('i');swatch.style.background=`radial-gradient(circle at 30% 25%,${color.light},${color.base} 60%,${color.dark})`;button.append(swatch,el('strong',color.name),el('small',unlocked?(selectedBall===color.id?'Selected':'Unlocked'):'Locked'),el('span',color.challenge));button.onclick=async()=>{
      if(busy){message.textContent='Wait for your current action to finish.';return;}button.disabled=true;message.textContent='Saving your choice…';
      try{if(state&&!local)await action('color',{ballColor:color.id});else if(hasKey())await window.XanHub.api('preferences',{settings:{golfBall:color.id}});selectedBall=color.id;if(window.XanProgress?.profile)window.XanProgress.profile.settings.golfBall=color.id;if(local&&state)state.players[0].ballColor=color.id;renderUI();drawBallPicker();}
      catch(e){message.textContent=e.message;button.disabled=false;}
    };grid.append(button);}
    const close=el('button','Close');close.onclick=()=>ballDialog.close();ballDialog.append(grid,message,close);
  }
  window.addEventListener('xan-progress',e=>{
    selectedBall=B.get(e.detail?.settings?.golfBall).id;if(ballDialog?.open)drawBallPicker();const owner=window.XanHub?.profile?.id;if(!owner)return;
    for(const c of B.colors.filter(c=>c.achievement&&B.available(c.id,earnedBalls()))){const key=`golf-ball-unlocked:${owner}:${c.id}`;try{if(localStorage.getItem(key))continue;localStorage.setItem(key,'1');}catch{continue;}
      const toast=el('section',undefined,'xg-award-toast');toast.setAttribute('role','status');const text=el('div');text.append(el('small','NEW GOLF BALL'),el('strong',c.name+' unlocked'),el('span','Choose it in your golf locker.'));const swatch=el('b','●');swatch.style.color=c.base;const close=el('button','×');close.setAttribute('aria-label','Dismiss golf ball unlock');close.onclick=()=>toast.remove();toast.append(swatch,text,close);let host=$('xg-award-stack');if(!host){host=el('div');host.id='xg-award-stack';document.body.prepend(host);}host.append(toast);sound('win');
    }
  });
  const retry=el('button','Retry shot','golf-solo');retry.hidden=true;retry.onclick=()=>shotRetry&&shoot(shotRetry);$('golf-caddy')?.append(retry);$('golf-notice').after(retry);
  const hasKey=()=>{try{return !!localStorage.getItem('tornVisitorApiKey');}catch{return false;}};
  function notice(text){$('golf-notice').textContent=text||'';}
  function reset(){notice('');turnEventSeen='';for(const voice of voices)try{voice.stop();}catch{}epoch++;state=null;local=false;aim=drag=null;shotRetry=null;retry.hidden=true;shotSeen='';playback.reset();resultKey='';history.replaceState(null,'','/games/multiplayer/mini-golf/');renderUI();window.dispatchEvent(new Event('xan-navigation'));}
  function accept(s,generation=epoch){
    if(generation!==epoch)return;
    if(state?.id===s.id&&state.revision>s.revision)return;
    offset=local?0:s.serverNow-Date.now();playback.accept(s,performance.now());state=s;if(s.players[s.you]?.ballColor)selectedBall=s.players[s.you].ballColor;
    const turnKey=s.turnEvent?s.id+':'+s.match+':'+s.turnEvent.at:'';if(turnKey&&turnKey!==turnEventSeen){turnEventSeen=turnKey;notice(s.turnEvent.type==='conceded'?s.holeReason:`${s.players[s.turnEvent.player].name}'s time ran out. Turn passed.`);}
    if(s.cancelled){reset();notice(s.reason);return;}
    if(shotRetry&&(s.lastShot?.id===shotRetry.requestId||s.phase!=='playing'||s.revision!==shotRetry.revision)){shotRetry=null;retry.hidden=true;}
    if(aim&&!canShoot())aim=drag=null;
    renderUI();window.XanGameMenu?.update?.();
  }
  async function post(action,extra={},id=state?.id){const token=await window.XanHub.authenticate();return window.XanHub.post('mini-golf-action',{action,token,gameId:id,...extra});}
  async function action(actionName,extra={}){
    if(busy)return;busy=true;const generation=epoch;notice('');
    try{if(local){M.act(state,'local',{action:actionName,...extra});accept({...M.publicState(state,'local'),you:0},generation);}else{const d=await post(actionName,extra);accept(d.game,generation);}return state;}
    catch(e){networkErrors++;notice(e.message);throw e;}
    finally{busy=false;renderUI();}
  }
  async function create(options){
    if(busy)return;busy=true;const generation=++epoch;notice('');
    const payload={...options,course:select.value};const key=JSON.stringify(payload);if(createIntent?.key!==key)createIntent={key,requestId:crypto.randomUUID()};
    try{const d=await post('create',{...payload,requestId:createIntent.requestId},undefined);local=false;accept(d.game,generation);createIntent=null;}
    finally{busy=false;renderUI();}
  }
  async function join(id,wager){if(busy)return;busy=true;const generation=++epoch;try{const d=await post('join',{wager},id.trim().toUpperCase());local=false;accept(d.game,generation);}finally{busy=false;renderUI();}}
  function practice(bot=false){reset();local=true;state=M.create('practice',{id:'local',name:'You',ballColor:selectedBall},select.value);if(bot){M.join(state,{id:'bot:putter',name:'Pip the Putter',bot:true,ballColor:'coral'});M.act(state,'local',{action:'ready'});}else M.start(state,Date.now());accept(M.publicState(state,'local'));}
  solo.onclick=()=>practice(false);
  async function addBot(){
    if(!state){if(hasKey())return create({wager:0,bot:true,private:true});return practice(true);}if(local)return;
    if(!state.wager)return action('add-bot');
    if(busy||state.phase!=='waiting'||state.players.length!==1)throw Error('Add a bot before another player joins.');
    // Keep the course mounted while the old stake is refunded and free practice is created.
    busy=true;const generation=++epoch,oldId=state.id,course=state.course;notice('Returning your stake and bringing Pip to the tee…');
    createIntent||={key:'bot:'+oldId,requestId:crypto.randomUUID()};
    try{await post('cancel',{},oldId);const d=await post('create',{course,wager:0,bot:true,private:true,requestId:createIntent.requestId},undefined);accept(d.game,generation);createIntent=null;notice('Your stake was returned. Ready up for a free round with Pip.');}
    finally{busy=false;renderUI();}
  }
  function canShoot(){return !!state&&state.phase==='playing'&&state.turn===state.you&&!state.balls[state.you]?.holed&&!state.balls[state.you]?.capped&&(!state.lastShot||state.lastShot.resolved)&&!busy&&!shotRetry;}
  function defaultAim(){return {position:[...state.balls[state.you].position],angle:-Math.PI/2,power:Number($('golf-strength').value)/100};}
  function updateShotControls(){
    const playable=canShoot();board.dataset.playable=String(playable);
    $('golf-strength').disabled=!playable;$('golf-putt').disabled=!playable||!aim||!!drag;
    if(aim&&!drag)$('golf-strength').value=Math.round(aim.power*100);
  }
  async function shoot(request){
    if(busy||(!request&&(!canShoot()||!aim)))return;
    const shot=request||{angle:Math.atan2(Math.sin(aim.angle),Math.cos(aim.angle)),power:aim.power,revision:state.revision,requestId:crypto.randomUUID()};aim=drag=null;
    if(!request)sound('shot');
    try{await action('shot',shot);shotRetry=null;retry.hidden=true;}
    catch(e){if(!e.status||e.status>=500){shotRetry=shot;retry.hidden=false;notice('Connection interrupted. Retry the same shot safely, or wait for the game to reconnect.');}}
  }
  function displayColors(){return B.display(state.players.map(p=>p.ballColor),state.you);}
  function total(i){return (state.scores[i]||[]).reduce((a,b)=>a+b,0);}
  function avatar(p){return /^(https:\/\/|\/assets\/)/.test(p?.avatar||'')?p.avatar:'/assets/mini-golf/ball.svg';}
  function renderUI(){
    $('golf-table').hidden=!state;controls.hidden=!!state;updateShotControls();if(!state)return;
    const course=C.get(state.course),h=course.holes[state.hole],you=state.you;
    $('golf-table').dataset.phase=state.phase;$('golf-table').dataset.turn=String(state.turn);$('golf-table').dataset.hole=String(state.hole);
    $('golf-hole-count').textContent=`${course.name.toUpperCase()} · ${state.hole+1} / ${course.holes.length}`;$('golf-hole-name').textContent=h.name;$('golf-par').textContent=`${course.difficulty.toUpperCase()} · PAR ${h.par}`;
    for(let i=0;i<2;i++){
      const root=$(i===0?'golf-player-a':'golf-player-b'),p=state.players[i];
      const display=displayColors()[i];const key=JSON.stringify([p,display,state.balls[i]?.strokes,total(i),local]);if(root.dataset.key===key)continue;root.dataset.key=key;root.replaceChildren();const image=el('img');image.src=avatar(p);image.alt='';root.append(image,el('strong',p?p.name:local?'Solo round':'Open seat'),el('small',p?`${state.balls[i]?.strokes||0} this hole · ${total(i)} total`:local?'Just you & the green':'Waiting for a player'));if(p){const swatch=el('span',B.get(display).name+(i!==you&&display!==p.ballColor?' · opponent view':''),'golf-equipped');swatch.style.setProperty('--ball-color',B.get(display).base);root.append(swatch);}if(i===you)root.append(ballButton());
    }
    const moving=state.lastShot&&!state.lastShot.resolved,own=state.turn===you,finished=['complete','hole-complete'].includes(state.phase);
    $('golf-turn-tag').textContent=finished?'ON THE SCORECARD':state.phase==='waiting'?'ON THE TEE':moving?'BALL IN PLAY':own?'MAKE IT COUNT':'WATCH & PLAN';
    $('golf-turn-title').textContent=finished?'That’s a wrap.':state.phase==='waiting'?'Your course is ready.':moving?'Let it roll.':own?'Your shot.':`${state.players[state.turn]?.name}’s shot.`;
    $('golf-instruction').textContent=finished?'The scorecard is in. Ready up for your next tee.':state.phase==='waiting'?(state.players.length===2?'Press Ready above the course to start.':'Waiting for another player. Add a bot from the top menu to practice.'):moving?'Both players are watching the same shot.':own?'Drag back anywhere on the course, then release. Or click where to aim, adjust power, and press Putt.':'Your ball is marked YOU. Wait for your turn to putt.';
    if(state.phase==='playing'&&!moving&&state.players.length===2){
      const other=1-you,otherDone=state.balls[other]?.holed||state.balls[other]?.capped;
      if(own&&otherDone){$('golf-turn-tag').textContent='OPPONENT FINISHED · YOUR TURN';$('golf-instruction').textContent=(state.lastShot?.player===you&&state.lastShot.penalty?'Water penalty: +1 stroke. Your ball is back at its previous position. ':'')+'Your opponent has finished this hole. Keep putting until you sink it, reach the stroke limit, or run out of time.';}
      else if(!own&&(state.balls[you]?.holed||state.balls[you]?.capped)){$('golf-turn-tag').textContent='YOU’RE FINISHED';$('golf-instruction').textContent='You have finished this hole. Your opponent keeps putting until their hole is complete.';}
    }
    $('golf-tip').textContent=h.tip;$('golf-pot').textContent=state.wager?(state.wager*state.players.length).toLocaleString()+' Chips in pot':local?'Free practice':'Free match';
    $('golf-concede').hidden=!['playing','hole-complete'].includes(state.phase);$('golf-concede').textContent=local?'End practice':'Concede match';
    const scoreKey=JSON.stringify([state.scores,state.hole,state.players]);if($('golf-scorecard').dataset.key!==scoreKey){$('golf-scorecard').dataset.key=scoreKey;const table=el('table'),head=el('thead'),row=el('tr');for(const name of ['PLAYER','1','2','3','Σ'])row.append(el('th',name));head.append(row);const body=el('tbody');state.players.forEach((p,i)=>{const r=el('tr');r.append(el('td',i===you?'You':p.name));for(let j=0;j<3;j++)r.append(el('td',state.scores[i]?.[j]??'—'));r.append(el('td',String(total(i))));body.append(r);});table.append(head,body);$('golf-scorecard').replaceChildren(table);}
    const show=['complete','hole-complete'].includes(state.phase);result.hidden=!show;
    if(show){const key=[state.id,state.match,state.hole,state.phase].join(':');if(resultKey!==key){resultKey=key;result.replaceChildren();const done=state.phase==='complete';result.append(el('span',done?'ROUND COMPLETE':'ON TO THE NEXT GREEN'),el('h2',done?(state.players.length===1?'Nicely putt.':state.winner==='draw'?'An even round.':state.winner===you?'You take the round!':'Opponent takes the round.'):'Hole complete.'));
      const scores=el('div',undefined,'golf-result-scores');state.players.forEach((p,i)=>{const item=el('div');item.append(el('span',i===you?'You':p.name),el('b',String(done?total(i):state.scores[i].at(-1))),el('small',done?'TOTAL STROKES':state.balls[i].conceded?'CONCEDED':'STROKES'));scores.append(item);});result.append(scores,el('p',done?state.reason:state.holeReason||'Both players have finished. Take a breath, then head to the next tee.'));
      const actions=el('div',undefined,'golf-result-actions'),next=el('button',done?'Rematch':'Next hole');next.id='golf-next';next.onclick=()=>action(done?'rematch':'continue',{wager:state.wager||0}).catch(()=>{});actions.append(next);if(done){const fresh=el('button','Create a new game');fresh.onclick=reset;actions.append(fresh);}result.append(actions);
      sound(done&&(state.winner===you||state.players.length===1)?'win':done?'lose':'round');
    }
    const next=$('golf-next'),voted=(state.phase==='complete'?state.rematch:state.continue)?.includes(state.players[you]?.id);if(next){next.disabled=busy||voted||(state.phase==='complete'&&['reserved','funding'].includes(state.settlement));next.textContent=voted?'Waiting for opponent…':state.phase==='complete'?'Rematch':'Next hole';}}
  }
  $('golf-concede').onclick=()=>{
    if(local){reset();return;}
    const dialog=el('dialog',undefined,'xan-dialog');dialog.append(el('h2','Concede this match?'),el('p','Your opponent wins the round and its pot.'));const back=el('button','Keep playing'),confirm=el('button','Concede match');back.onclick=()=>dialog.close();confirm.onclick=async()=>{confirm.disabled=true;try{await action('forfeit');dialog.close();}catch{confirm.disabled=false;}};dialog.append(back,confirm);dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();
  };
  function point(e){const r=board.getBoundingClientRect();return [(e.clientX-r.left)*720/r.width,(e.clientY-r.top)*720/r.height];}
  function blockedShot(){notice(state?.phase==='waiting'?(state.players.length===2?'Press Ready above the course to start playing.':'Waiting for another player. You can add a bot from the top menu.'):busy?'Sending your shot…':shotRetry?'Use Retry shot to recover your last putt.':state?.lastShot&&!state.lastShot.resolved?'Wait for the ball to stop.':state?.phase==='playing'?'It is your opponent’s turn. Your ball is marked YOU.':'Finish this hole, then continue to the next tee.');}
  function pull(e){
    const p=point(e),dx=drag.start[0]-p[0],dy=drag.start[1]-p[1];
    const r=board.getBoundingClientRect();if(Math.hypot(dx,dy)*r.width/720<5&&!drag.moved)return;
    drag.moved=true;aim={position:[...state.balls[state.you].position],angle:Math.atan2(dy,dx),power:Math.min(1,Math.hypot(dx,dy)/170)};
  }
  board.addEventListener('pointerdown',e=>{
    if(e.button!==0||e.isPrimary===false||drag)return;
    if(!canShoot()){blockedShot();return;}
    const p=point(e),ball=state.balls[state.you].position;
    e.preventDefault();notice('');board.focus({preventScroll:true});board.setPointerCapture(e.pointerId);drag={id:e.pointerId,start:p,moved:false};aim=defaultAim();
    if(Math.hypot(p[0]-ball[0],p[1]-ball[1])>25)aim.angle=Math.atan2(p[1]-ball[1],p[0]-ball[0]);
    updateShotControls();unlockAudio();
  });
  board.addEventListener('pointermove',e=>{if(drag?.id===e.pointerId)pull(e);});
  board.addEventListener('pointerup',e=>{
    if(!drag||drag.id!==e.pointerId)return;pull(e);const moved=drag.moved;drag=null;
    if(board.hasPointerCapture(e.pointerId))board.releasePointerCapture(e.pointerId);
    if(moved){if(aim?.power>=.025&&canShoot())shoot();else aim=null;}updateShotControls();
  });
  function cancelAim(){const id=drag?.id;drag=aim=null;if(id!==undefined&&board.hasPointerCapture(id))board.releasePointerCapture(id);updateShotControls();}
  $('golf-strength').addEventListener('input',()=>{if(!canShoot())return;aim||=defaultAim();aim.power=Number($('golf-strength').value)/100;updateShotControls();});
  $('golf-putt').onclick=()=>{if(canShoot()&&aim){unlockAudio();shoot();}};
  board.addEventListener('pointercancel',cancelAim);board.addEventListener('lostpointercapture',()=>{if(drag)cancelAim();});window.addEventListener('blur',cancelAim);document.addEventListener('visibilitychange',()=>{cancelAim();if(!document.hidden)poll();});
  // Resizing changes drag coordinates, but a prepared click/keyboard aim is in
  // course coordinates and remains valid (including mobile browser-chrome resize).
  window.addEventListener('resize',()=>{if(drag)cancelAim();});
  board.addEventListener('keydown',e=>{if(e.key==='Escape'){cancelAim();return;}if(!canShoot()||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key))return;e.preventDefault();aim||={position:[...state.balls[state.you].position],angle:-Math.PI/2,power:.35};if(e.key==='ArrowLeft')aim.angle-=.045;if(e.key==='ArrowRight')aim.angle+=.045;if(e.key==='ArrowUp')aim.power=Math.min(1,aim.power+.04);if(e.key==='ArrowDown')aim.power=Math.max(.025,aim.power-.04);if(e.key===' '){unlockAudio();shoot();}});
  let context,audioLoading;const recordings=new Map(),voices=new Set();
  function loadRecordings(){audioLoading||=Promise.all(['putt','cup','cheer'].map(async name=>{try{const r=await fetch('/assets/mini-golf/audio/'+name+'.mp3');if(r.ok)recordings.set(name,await context.decodeAudioData(await r.arrayBuffer()));}catch{}}));}
  function recording(name,volume,delay=0){const buffer=recordings.get(name);if(!buffer)return false;const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;gain.gain.value=volume;source.connect(gain);gain.connect(context.destination);voices.add(source);source.onended=()=>{voices.delete(source);source.disconnect();gain.disconnect();};source.start(context.currentTime+delay);return true;}
  window.addEventListener('xan-preferences',()=>{if(window.XanPreferences?.muted)for(const voice of voices)try{voice.stop();}catch{}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)for(const voice of voices)try{voice.stop();}catch{}});
  function unlockAudio(){try{context||=new AudioContext();context.resume().catch(()=>{});loadRecordings();}catch{}}
  function sound(type){
    if(!context||window.XanPreferences?.muted||context.state!=='running')return;
    if(type==='round')return;
    if(type==='cup'&&recording('cup',.62)){recording('cheer',.24,.18);return;}
    if(type==='shot'&&recording('putt',.7))return;
    if(type==='land')type='bank';if(type==='launch')type='pop';
    const time=context.currentTime,g=context.createGain();g.connect(context.destination);g.gain.setValueAtTime(.0001,time);
    if(['bank','shot','bumper','splash','gulp','pop'].includes(type)){
      const duration=type==='splash'?.32:type==='gulp'?.24:.065,buffer=context.createBuffer(1,Math.ceil(context.sampleRate*duration),context.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/data.length*6);
      const src=context.createBufferSource(),filter=context.createBiquadFilter();src.buffer=buffer;filter.type='lowpass';filter.frequency.value=type==='splash'?2200:type==='gulp'?280:1500;src.connect(filter);filter.connect(g);g.gain.setValueAtTime(type==='shot'?.18:.09,time);src.start();
      if(type==='pop'||type==='gulp'){const o=context.createOscillator();o.type='sine';o.frequency.setValueAtTime(250,time);o.frequency.exponentialRampToValueAtTime(65,time+.17);o.connect(g);o.start();o.stop(time+.18);}return;
    }
    const notes=type==='win'?[523,659,784,1047]:type==='lose'?[330,277,220]:[784,1047];notes.forEach((f,i)=>{const o=context.createOscillator(),a=context.createGain();o.type='sine';o.frequency.value=f;o.connect(a);a.connect(context.destination);const t=time+i*.10;a.gain.setValueAtTime(0,t);a.gain.linearRampToValueAtTime(.035,t+.01);a.gain.exponentialRampToValueAtTime(.0001,t+.5);o.start(t);o.stop(t+.52);});
  }
  async function poll(){
    if(document.hidden||busy||polling||!state)return;polling=true;const generation=epoch;
    try{if(local){M.bot(state);accept(M.publicState(state,'local'),generation);}else{const d=await post('get');accept(d.game,generation);}}
    catch(e){networkErrors++;notice('Reconnecting to your game… '+e.message);}finally{polling=false;}
  }
  const pollingTimer=setInterval(poll,1100);window.addEventListener('pagehide',()=>clearInterval(pollingTimer));
  const previousArt=window.XanMenuArt.mount.bind(window.XanMenuArt);let heroCanvas;
  window.XanMenuArt.mount=(root,mode)=>{if(mode!=='minigolf')return previousArt(root,mode);root.classList.add('golf-menu-art');const hero=el('div',undefined,'golf-hero');heroCanvas=el('canvas');heroCanvas.setAttribute('aria-hidden','true');const tag=el('div','SMALL COURSE. BIG PERSONALITY.','golf-hero-label');tag.append(el('b','A little off course.'));hero.append(heroCanvas,tag);root.append(hero);};
  window.XanRules.minigolf=['Choose from 20 courses with 60 holes, from Beginner to Expert. Each match has three different holes. Lowest total strokes wins.','Press Ready to start, then take turns. Drag backwards anywhere on the course and release to putt. Or click/tap where to aim, adjust the strength slider, and press Putt. The filled arrow shows direction and power.','Bank off rails, slow down in sand, and find shortcuts. Light hills push the ball downhill; dark divots draw it inward. Water returns your ball to its previous position and adds one penalty stroke.','Aim into a hippo’s mouth to emerge from its bottom on another green. Watch rotating gates and lively bumpers. Ramps launch the ball over hazards: too soft falls short and too hard overshoots. Conveyor lanes carry the ball in their moving direction; the longer dry route is safer.','You have 60 seconds per turn. Running out of time passes the turn without taking a shot. If your opponent has already finished, they win that hole and you score 13 for conceding it. Twelve actual strokes ends a hole. Both players continue to the next tee, or it starts after 30 seconds. Equal match totals are a draw.','Unlock golf ball colors through competitive achievements, and choose them from Golf ball. Solo practice and bots do not unlock achievements.','Keyboard: focus the course; left/right adjust aim, up/down change power, Space putts, and Escape cancels. Solo practice and bots are free.'];
  window.XanSiteAdapter={
    current:()=>({mode:'minigolf',id:state?.id||'',phase:state?.phase||'lobby'}),
    view:()=>state?{...state,votes:state.rematch,finished:state.phase==='complete',ready:state.ready.includes(state.players[state.you]?.id),canReady:state.phase==='waiting'&&state.players.length===2&&!state.ready.includes(state.players[state.you]?.id),canCancel:state.phase==='waiting'&&state.you===0,payout:state.payouts?.[state.players[state.you]?.id]||0,connecting:busy}:{phase:'lobby'},
    create,join,quote:async id=>(await post('quote',{},id.trim().toUpperCase())).quote,ready:()=>action('ready'),addBot,practice:()=>practice(true),controls:()=>controls,resultRoot:()=>result,diagnostics:()=>({build:'POCKET_PUTT_V6',round:(state?.hole||0)+1,revision:state?.revision||0,frames,slowFrames,networkErrors,busy,polling}),cancel:id=>post('cancel',{},id),dismissCancelled:id=>{if(state?.id===id)reset();}
  };
  function animate(timestamp){
    requestAnimationFrame(animate);if(document.hidden)return;frames++;if(lastFrame&&timestamp-lastFrame>60)slowFrames++;lastFrame=timestamp;
    if(!state){if(heroCanvas&&heroCanvas.offsetParent){const c=C.get(select.value);window.PuttRenderer.render(heroCanvas,c.holes[0],{time:Date.now(),balls:[{position:[c.holes[0].tee[0]+Math.sin(timestamp*.0007)*8,c.holes[0].tee[1]],holed:false}]});}return;}
    const h=C.get(state.course).holes[state.hole],balls=state.balls.length?state.balls.map(b=>({...b})):state.players.map(()=>({position:h.tee}));const shot=state.lastShot,t=now();
    if(shot){if(shotSeen!==shot.id){shotSeen=shot.id;playedEvents=new Set();if(shot.player!==state.you&&playback.elapsed(performance.now())<shot.duration)sound('shot');}const elapsed=playback.elapsed(performance.now()),f=shot.frames;
      if(elapsed<shot.duration){let i=Math.min(f.length-2,Math.max(0,Math.floor(elapsed/33.333)));while(i>0&&f[i][0]>elapsed)i--;while(i<f.length-2&&f[i+1][0]<elapsed)i++;const a=f[i],b=f[i+1],mix=Math.max(0,Math.min(1,(elapsed-a[0])/(b[0]-a[0]||1)));balls[shot.player]={position:[a[1]+(b[1]-a[1])*mix,a[2]+(b[2]-a[2])*mix],alpha:a[3],z:(a[4]||0)+((b[4]||0)-(a[4]||0))*mix,holed:false};}
      for(let i=0;i<shot.events.length;i++){const e=shot.events[i];if(e.at<=elapsed&&!playedEvents.has(i)){playedEvents.add(i);if(elapsed-e.at<(e.type==='cup'?1200:250)){sound(e.type);const label={gulp:'Gulp! Shortcut taken.',pop:'A very unorthodox exit.',splash:'Splash! +1 penalty stroke',launch:'Airborne!',land:'Back on the green.',cup:state.balls[shot.player]?.strokes===1?'Hole in one!':'In the cup!'}[e.type];if(label){$('golf-event').textContent=label;toastUntil=Date.now()+1800;}}}}
    }
    const effects=(shot?.events||[]).map(e=>({...e,age:playback.elapsed(performance.now())-e.at,player:shot.player})).filter(e=>e.age>=0&&e.age<M.CUP_FEEDBACK_MS);
    board.dataset.airborne=String(balls.some(b=>b.z>0));
    board.dataset.cupEffect=String(effects.some(e=>e.type==='cup'));
    window.PuttRenderer.render(board,h,{balls,time:t,aim,active:state.turn,you:state.you,playable:canShoot(),ghost:true,colors:displayColors(),effects});$('golf-event').classList.toggle('visible',Date.now()<toastUntil);updateShotControls();
    const power=Math.round((aim?.power||0)*100);$('golf-power-meter').value=power;$('golf-power-value').textContent=power+'%';
    const seconds=Math.max(0,Math.ceil((state.deadline-t)/1000));$('golf-clock').textContent=state.phase==='playing'?(shot&&!shot.resolved?'Ball in motion':(state.turn===state.you?'Your turn · ':'Opponent · ')+seconds+'s'):state.phase==='hole-complete'?'Next tee in '+seconds+'s':'';$('golf-clock').classList.toggle('urgent',state.phase==='playing'&&(!shot||shot.resolved)&&seconds<=10);
  }
  requestAnimationFrame(animate);
  const code=new URLSearchParams(location.search).get('room');
  if(code==='practice')history.replaceState(null,'','/games/multiplayer/mini-golf/');
  else if(code&&hasKey())window.addEventListener('DOMContentLoaded',async()=>{try{const d=await post('get',{},code);accept(d.game);}catch{/* A new guest reviews the wager using the prefilled shared join form. */}},{once:true});
})();
