/* YAHTZEE_DUEL_V3_20261011 */
(() => {
  'use strict';
  const $=id=>document.getElementById(id),rules=window.YahtzeeRules;
  const storage={get(k){try{return localStorage.getItem('yahtzee:v2:'+k);}catch{return null;}},set(k,v){try{localStorage.setItem('yahtzee:v2:'+k,v);}catch{}}};
  let identity=null,token='',room=null,busy=false,failed=null,pollTimer,offset=0,zeroCategory=null,resultKey='',animationUntil=0,roundKey='',countdownCue='',tally=null;
  const sounds=window.YahtzeeAudio.create(()=>new (window.AudioContext||window.webkitAudioContext)(),()=>window.XanPreferences.muted||document.hidden);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
  window.XanSiteAdapter={current:()=>({mode:'yahtzee',id:room?.id||'',phase:room?.phase||'lobby'}),diagnostics:()=>({build:'YAHTZEE_DUEL_V3_20261011',round:room?.round})};
  window.dispatchEvent(new Event('xan-navigation'));
  const me=()=>room?.players.find(p=>p.id===room.you);
  const opponent=()=>room?.players.find(p=>p.id!==room.you);
  const serverNow=()=>Date.now()+offset;
  const canPlay=()=>room?.phase==='playing'&&!me()?.locked&&serverNow()<room.deadline;
  const emptyPlayer={card:{},dice:[],held:Array(5).fill(false),rolls:0,rollSerial:0,upper:0,bonus:0,yahtzeeBonus:0,total:0};
  const spots={1:[5],2:[1,9],3:[1,5,9],4:[1,3,7,9],5:[1,3,5,7,9],6:[1,3,4,6,7,9]},rotations=[[0,0],[0,-90],[-90,0],[90,0],[0,90],[0,180]];
  const boards={};
  for(const side of ['me','opponent']){
    const root=$(side==='me'?'dice':'opponent-dice'),buttons=[];
    for(let i=0;i<5;i++){
      const b=el(side==='me'?'button':'div',undefined,'yd-die is-empty');
      if(side==='me'){b.type='button';b.disabled=true;b.onclick=()=>send('hold',{index:i,held:!me().held[i]});}
      else b.setAttribute('role','img');
      const cube=el('span',undefined,'cube');
      for(let f=1;f<=6;f++){const face=el('span',undefined,'yd-face');for(const n of spots[f]){const pip=el('i',undefined,'yd-pip');pip.style.gridArea=Math.ceil(n/3)+'/'+((n-1)%3+1);face.append(pip);}cube.append(face);}
      b.append(cube);b.setAttribute('aria-pressed','false');root.append(b);buttons.push(b);
    }
    boards[side]={buttons,serial:-1,game:0};
  }
  const categoryIcons=['⚀','⚁','⚂','⚃','⚄','⚅','Ⅲ','Ⅳ','⌂','↗','⇗','★','∑'];
  const rows=rules.categories.map(([key,label,description],i)=>{
    const row=el('div',undefined,'yd-score-row');row.dataset.category=key;
    const name=el('span');name.append(el('i',categoryIcons[i],'yd-category-icon'),document.createTextNode(label));name.title=description;
    const button=el('button','');button.type='button';button.dataset.category=key;button.disabled=true;
    const rival=el('b','');row.append(name,button,rival);$('scores').append(row);
    button.onclick=()=>{
      const points=rules.options(me().dice,me().card)[key];
      if(points===0){zeroCategory=key;$('zero-text').textContent=label+' will be used for this game, worth 0 points.';$('zero-dialog').showModal();}
      else send('score',{category:key});
    };
    return {key,label,description,button,rival};
  });
  function notice(text){$('notice').textContent=text;}
  const sound=(kind,delay)=>sounds.play(kind,delay);
  const palettes=[
    ['ivory','Ivory','#fff7e9','#cfbd9d','#3a2829'],['ruby','Ruby','#ffb4b7','#bb414e','#401621'],
    ['ocean','Ocean','#b6e6ff','#4c91ca','#142f50'],['jade','Jade','#bbf0d6','#479e80','#163c32'],
    ['violet','Violet','#e2caff','#9564c2','#3a2055'],['amber','Amber','#ffeab2','#d6a853','#513311']
  ];
  function selectColor(key){
    const selected=palettes.find(p=>p[0]===key)||palettes[0],root=$('dice');
    root.dataset.color=selected[0];['--dice-light','--dice-dark','--dice-pip'].forEach((name,i)=>root.style.setProperty(name,selected[i+2]));
    for(const button of $('dice-colors').children)button.setAttribute('aria-pressed',String(button.dataset.color===selected[0]));
    storage.set('dice-color',selected[0]);
  }
  for(const [key,label,light,dark] of palettes){const b=el('button',undefined,'yd-color');b.type='button';b.dataset.color=key;b.setAttribute('aria-label',label+' dice');const swatch=el('i');swatch.style.background='linear-gradient(145deg,'+light+','+dark+')';b.append(swatch,el('span',label));b.onclick=()=>{selectColor(key);sound('hold');};$('dice-colors').append(b);}
  selectColor(storage.get('dice-color'));
  $('dice-color').onclick=()=>$('color-dialog').showModal();$('color-done').onclick=()=>$('color-dialog').close();
  function paintDice(side,p){
    const board=boards[side],initial=board.serial<0||board.game!==(room?.game||0),rolled=!initial&&p.rollSerial>board.serial;
    board.buttons.forEach((b,i)=>{
      const value=p.dice[i]||[1,3,5,2,6][i],held=p.held[i],cube=b.firstElementChild;
      const spin=rolled&&!p.lastRollHeld[i];
      if(spin||b.dataset.value!==String(value)||initial){const [x,y]=rotations[value-1],turns=Number(cube.dataset.turns||0)+(spin?1:0);cube.dataset.turns=turns;cube.style.setProperty('--rx',(x+turns*720)+'deg');cube.style.setProperty('--ry',(y+turns*360)+'deg');b.dataset.value=value;}
      b.classList.toggle('is-empty',!p.dice.length);b.setAttribute('aria-pressed',String(held));
      b.setAttribute('aria-label',(side==='me'?'Your':'Opponent')+' die '+(i+1)+': '+(p.dice.length?value:'not rolled')+(held?', held':''));
      if(spin&&!reduced.matches){b.classList.remove('is-rolling');void b.offsetWidth;b.classList.add('is-rolling');setTimeout(()=>b.classList.remove('is-rolling'),620);}
    });
    if(rolled&&side==='me')animationUntil=Date.now()+(reduced.matches?0:620);
    board.serial=p.rollSerial;board.game=room?.game||0;
    if(rolled&&side==='me'){
      sound('roll');
      if(p.dice.length&&p.dice.every(n=>n===p.dice[0])){celebrate();sound('yahtzee',.48);}
    }
  }
  function labelPlayer(side,p){
    const mine=side==='me',name=p?.name||(mine?identity?.name||'You':'Opponent');
    $(side+'-name').textContent=name+(mine&&identity?' (you)':'');$(side+'-avatar').textContent=name.slice(0,1).toUpperCase();
    if(mine)$('me-total').textContent=p?.total||0;
    $(side+'-status').textContent=!p?(mine?'Ready to play':'Open seat'):room.phase==='waiting'?(mine?'Host':'Ready'):room.phase==='countdown'?'Get ready':p.locked?'Score locked':room.phase==='playing'?(p.bot?'Test bot · rolling':'Choosing score'):room.phase==='complete'?'Final score':'Match closed';
    $(side+'-player').classList.toggle('is-locked',!!p?.locked);
  }
  function paintScores(){
    const mine=me()||emptyPlayer,theirs=opponent()||emptyPlayer;
    const myOptions=mine.rolls&&!mine.locked?rules.options(mine.dice,mine.card):{},theirOptions=theirs.rolls&&!theirs.locked?rules.options(theirs.dice,theirs.card):{};
    for(const {key,label,description,button,rival} of rows){
      const filled=Object.hasOwn(mine.card,key),value=filled?mine.card[key]:myOptions[key];
      button.textContent=filled?String(value):value>0?String(value):'';
      button.dataset.available=String(!filled&&Object.hasOwn(myOptions,key));button.classList.toggle('filled',filled);button.classList.toggle('preview',!filled&&Object.hasOwn(myOptions,key));
      button.title=filled?label+': '+value+' points already banked':description;
      button.setAttribute('aria-label',filled?label+', banked '+value:label+', score '+(value||0)+' points');
      const rivalFilled=Object.hasOwn(theirs.card,key),rivalValue=rivalFilled?theirs.card[key]:theirOptions[key];
      rival.textContent=rivalFilled?String(rivalValue):rivalValue>0?String(rivalValue):'';rival.classList.toggle('preview',!rivalFilled);
      rival.setAttribute('aria-label','Opponent '+label+': '+(rivalFilled?'banked '+rivalValue:rivalValue>0?'possible '+rivalValue:'not scored'));
    }
    for(const [prefix,p] of [['my',mine],['their',theirs]]){$(prefix+'-upper').textContent=p.upper+' / 63';$(prefix+'-bonuses').textContent=p.bonus+p.yahtzeeBonus;$(prefix+'-card-total').textContent=prefix==='their'&&!tally?.done?'—':p.total;}
  }
  function controls(){
    const p=me(),blocked=busy||!!failed||Date.now()<animationUntil,play=canPlay();
    for(const b of boards.me.buttons)b.disabled=blocked||!play||!p?.rolls||p.rolls>=3;
    $('roll').disabled=room?.phase==='complete'?false:blocked||!play||p.rolls>=3||p.held.every(Boolean);
    for(const row of rows)row.button.disabled=blocked||!play||row.button.dataset.available!=='true';
    for(const id of ['create','join','practice'])$(id).disabled=busy||!!failed||!identity;
    $('start').disabled=busy||!room||room.phase!=='waiting'||room.players[0].id!==room.you||room.players.length!==2;
    $('add-bot').hidden=room?.players.length!==1||room?.players[0].id!==room?.you;$('add-bot').disabled=busy||!!failed;
    $('rematch').disabled=busy||!!failed||!tally?.done||!!room?.rematch.includes(room?.you);$('retry').hidden=!failed;
    $('confirm-zero').disabled=blocked||!play;
  }
  function clock(){
    const remaining=room?.phase==='playing'?Math.max(0,Math.ceil((room.deadline-serverNow())/1000)):room?.phase==='between'?Math.max(0,Math.ceil((room.nextAt-serverNow())/1000)):30;
    const text=room?.phase==='complete'?'END':room?.phase==='closed'?'—':String(remaining);
    if($('clock').dataset.text!==text){$('clock').dataset.text=text;$('clock').replaceChildren(document.createTextNode(text));if(/^[0-9]+$/.test(text))$('clock').append(el('span','s'));}
    $('clock').parentElement.classList.toggle('urgent',room?.phase==='playing'&&remaining<=7);
    $('time-bar').style.width=(room?.phase==='playing'?Math.max(0,(room.deadline-serverNow())/30000)*100:room?.phase==='complete'?0:100)+'%';
    const counting=room?.phase==='countdown',cue=counting?String(Math.max(1,Math.ceil((room.startAt-serverNow())/1000))):'';
    $('countdown').hidden=!counting;
    if(counting&&$('countdown-number').textContent!==cue){$('countdown-number').textContent=cue;$('countdown-number').classList.remove('yd-count-pop');void $('countdown-number').offsetWidth;$('countdown-number').classList.add('yd-count-pop');}
    const cueKey=counting?room.id+':'+room.game+':'+cue:'';
    if(cueKey!==countdownCue){if(counting)sound('countdown');else if(countdownCue&&room?.phase==='playing')sound('go');countdownCue=cueKey;}
    if(tally&&room?.phase==='complete')tickTally();
    controls();
  }
  const TALLY_LEAD=850,TALLY_STEP=720;
  function setupTally(replay=false){
    const players=room.players,parts=players.map(p=>rules.breakdown(p.card,p.yahtzeeBonus));
    const key=room.id+':'+room.game,duration=TALLY_LEAD+parts[0].length*TALLY_STEP;
    const start=!replay&&room.finishedAt&&serverNow()-room.finishedAt<duration?room.finishedAt:serverNow();
    tally={key,start,parts,players,step:-1,done:false,skip:reduced.matches||(!replay&&storage.get('tally:'+key)==='done')};
    $('result-title').textContent='The final count';$('result-subtitle').textContent='Every category. Every point.';
    $('result-actions').hidden=true;$('standings').hidden=true;$('standings').replaceChildren();$('skip-tally').hidden=false;
    $('tally-totals').replaceChildren(...players.map((p,i)=>{const card=el('div',undefined,'yd-tally-player');card.append(el('span',p.name+(p.id===room.you?' (you)':'')),el('strong','0'));card.dataset.player=String(i);return card;}));
    $('tally-columns').replaceChildren(el('span','CATEGORY'),...players.map(p=>el('span',p.id===room.you?'YOU':'OPPONENT')));
    $('tally-rows').replaceChildren(...parts[0].map((entry,i)=>{const row=el('div',undefined,'yd-tally-row');row.dataset.key=entry.key;row.append(el('span',entry.label),el('b',''),el('b',''));return row;}));
    $('tally-rows').scrollTop=0;tickTally();
  }
  function tickTally(){
    if(tally.done||!$('result-dialog').open)return;
    const elapsed=Math.max(0,serverNow()-tally.start-TALLY_LEAD),count=tally.parts[0].length;
    const step=tally.skip?count:serverNow()<tally.start+TALLY_LEAD?-1:Math.min(count,Math.floor(elapsed/TALLY_STEP));
    const rows=[...$('tally-rows').children],totals=[0,0];
    if(step!==tally.step){
      rows.forEach((row,i)=>{row.classList.toggle('is-counted',i<=step);row.classList.toggle('is-current',i===step);for(let p=0;p<2;p++)row.children[p+1].textContent=i<=step?String(tally.parts[p][i].points):'';});
      if(step>=0&&step<count){
        sound('tally');const row=rows[step],root=$('tally-rows');root.scrollTo({top:Math.max(0,row.offsetTop-root.offsetTop-root.clientHeight/2+row.clientHeight/2),behavior:reduced.matches?'instant':'smooth'});
        $('tally-announcement').textContent=tally.parts[0][step].label+': '+tally.players.map((p,i)=>p.name+' '+tally.parts[i][step].points).join(', ');
      }
      tally.step=step;
    }
    for(let p=0;p<2;p++){
      totals[p]=tally.parts[p].reduce((sum,e,i)=>sum+(i<step?e.points:i===step?Math.round(e.points*Math.min(1,(elapsed%TALLY_STEP)/400)):0),0);
      $('tally-totals').children[p].querySelector('strong').textContent=totals[p];
    }
    if(step===count){
      tally.done=true;storage.set('tally:'+tally.key,'done');
      const sorted=[...tally.players].sort((a,b)=>b.total-a.total),tie=sorted[0].total===sorted[1].total;
      $('result-title').textContent=tie?'Draw':sorted[0].id===room.you?'You win!':sorted[0].name+' wins';
      $('result-subtitle').textContent='13 rounds complete';
      $('standings').replaceChildren(...sorted.map(p=>{const row=el('div',undefined,'yd-standing');row.append(el('span',p.name),el('b',p.total+' points'));return row;}));
      for(let i=0;i<2;i++)$('tally-totals').children[i].classList.toggle('is-winner',tie||tally.players[i].id===sorted[0].id);
      $('skip-tally').hidden=true;$('result-actions').hidden=false;$('their-card-total').textContent=opponent()?.total||0;
      $('tally-announcement').textContent=$('result-title').textContent+'. '+sorted.map(p=>p.name+' '+p.total+' points').join(', ');
      if(!tally.skip){sound('win');celebrate();}
    }
  }
  function result(){
    $('rematch-status').textContent=room.rematch.includes(room.you)?'Waiting for your opponent…':'';
    const key=room.id+':'+room.game;if(resultKey!==key){resultKey=key;$('result-dialog').showModal();setupTally();}
  }
  function render(){
    const p=me(),other=opponent(),joined=!!room;
    if(room?.phase!=='complete')tally=null;
    $('lobby').hidden=joined;$('waiting').hidden=!joined||room.phase!=='waiting';$('leave').hidden=!joined;
    if(joined){$('copy-code').textContent=room.id;$('waiting-text').textContent=other?other.name+' joined':'Waiting for an opponent';}
    labelPlayer('me',p);labelPlayer('opponent',other);paintDice('me',p||emptyPlayer);paintDice('opponent',other||emptyPlayer);paintScores();
    $('round').textContent='ROUND '+(room?.round||1)+' / 13';
    $('my-rolls').textContent=(p?.rolls||0)+' / 3 rolls';$('opponent-rolls').textContent=(other?.rolls||0)+' / 3 rolls';
    const last=other?.last;
    $('opponent-move').textContent=last?(last.automatic?'Auto-banked ':'Banked ')+last.score+' · '+rules.categories.find(c=>c[0]===last.category)[1]:other?.rolls?'Watching '+other.name+' roll':other?'Waiting for their first roll':'Waiting for opponent';
    $('hold-hint').textContent=p?.locked?'Score locked':p?.rolls?'Click dice to hold or release':'Roll to begin';
    $('prompt').textContent=!room?'Roll. Hold. Score.':room.phase==='waiting'?'Invite a friend or add a bot':room.phase==='countdown'?'Get ready':room.phase==='complete'?'Match complete':room.phase==='closed'?'Game closed':p.locked?'Waiting for opponent':p.rolls===3?'Choose your score':p.rolls?'Keep your best dice':'Round '+room.round;
    $('hint').textContent=!room?'Both players play each round together.':room.phase==='closed'?'Leave this game to start a new one.':room.phase==='complete'?'Open the results to rematch.':p.locked?'The next round starts when both scores are locked.':p.rolls?'Click a scorecard category to bank it.':'Roll, hold, and score before the timer ends.';
    $('roll').replaceChildren(document.createTextNode(room?.phase==='complete'?'View results':p?.rolls>=3?'Choose score':p?.rolls?'Reroll':'Roll dice'),el('span','↻'));
    $('round-banner').hidden=room?.phase!=='between';$('round-banner').textContent='Round '+(room?.round||1)+' complete';
    $('score-instruction').textContent=p?.locked?'Your score is locked for this round.':'Click a category to bank your points.';
    const key=room?.game+':'+room?.round+':'+room?.phase;
    if(roundKey!==key){if($('zero-dialog').open)$('zero-dialog').close();zeroCategory=null;roundKey=key;}
    if(room?.phase==='complete')result();else if($('result-dialog').open)$('result-dialog').close();
    clock();
  }
  function celebrate(){
    if(reduced.matches)return;const root=$('burst');root.replaceChildren();
    for(let i=0;i<24;i++){const c=el('i',undefined,'yd-confetti');c.style.background=['#e4bf73','#e85c68','#b9d3e8'][i%3];c.style.setProperty('--x',(Math.random()-.5)*500+'px');c.style.setProperty('--y',(Math.random()-.4)*450+'px');c.style.setProperty('--r',Math.random()*650+'deg');root.append(c);}setTimeout(()=>root.replaceChildren(),1450);
  }
  async function request(body,refresh=true){
    const started=Date.now();
    const response=await fetch('/.netlify/functions/yahtzee-action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,token}),signal:AbortSignal.timeout(12000)});
    let data;try{data=await response.json();}catch{throw new Error('Connection interrupted. Retry your move.');}
    if(response.status===401&&refresh){
      const key=localStorage.getItem('tornVisitorApiKey');if(key){const login=await window.XanHub.post('rps-action',{action:'login',visitorKey:key});token=login.token;return request(body,false);}
    }
    if(!response.ok){const e=new Error(data.error||'Please try again.');e.status=response.status;throw e;}
    if(data.room)offset=data.room.serverNow-(started+Date.now())/2;
    identity=data.player||identity;return data;
  }
  function adopt(next){
    if(room&&room.id===next.id&&next.revision<room.revision)return;
    const changed=!room||room.id!==next.id||room.revision!==next.revision;
    room=next;storage.set('room',room.id);history.replaceState({},'','?room='+room.id);
    if(changed)render();
  }
  function schedule(delay){clearTimeout(pollTimer);if(room&&!document.hidden)pollTimer=setTimeout(poll,delay||(['playing','between','countdown'].includes(room.phase)?700:1600));}
  async function poll(){
    if(busy||!room||document.hidden){schedule();return;}const id=room.id;
    try{const data=await request({action:'get',room:id});if(!busy&&room?.id===id){adopt(data.room);$('connection').textContent='Connected';}}
    catch(e){$('connection').textContent='Reconnecting…';if(e.status===404||e.status===410){notice(e.message);return;}schedule(2500);return;}
    schedule();
  }
  async function send(action,extra={},retryBody){
    if(busy)return;sounds.unlock();busy=true;clearTimeout(pollTimer);
    const p=me(),body=retryBody||{action,room:room?.id,game:room?.game,round:room?.round,inputVersion:p?.inputVersion,requestId:crypto.randomUUID(),...extra};
    failed=null;controls();notice('');if(action==='roll')$('roll').textContent='Rolling…';
    try{
      const data=await request(body);
      if(action==='leave'){storage.set('room','');room=null;history.replaceState({},'',location.pathname);render();window.dispatchEvent(new Event('xan-navigation'));return;}
      adopt(data.room);
      if(action==='score')sound('score');else if(action==='hold')sound('hold');
      if(['create','join','start','bot'].includes(action))window.XanHub.refresh();
      $('connection').textContent='Connected';
    }catch(e){
      notice(e.message);
      if(!e.status||e.status>=500){failed=body;$('connection').textContent='Connection interrupted';}
      else if(e.status===409&&room){try{adopt((await request({action:'get',room:room.id})).room);}catch{}}
      else if(e.status===401){identity=null;$('connect').hidden=false;}
    }finally{busy=false;controls();schedule();}
  }
  $('create').onclick=()=>send('create');$('practice').onclick=()=>send('create',{bot:true});
  $('join-form').onsubmit=e=>{e.preventDefault();send('join',{room:$('join-code').value.trim().toUpperCase()});};
  $('start').onclick=()=>send('start');$('add-bot').onclick=()=>send('bot');$('roll').onclick=()=>room?.phase==='complete'?$('result-dialog').showModal():send('roll');
  $('confirm-zero').onclick=()=>{const key=zeroCategory;$('zero-dialog').close();if(key)send('score',{category:key});};
  $('cancel-zero').onclick=()=>$('zero-dialog').close();
  $('retry').onclick=()=>{if(failed)send(failed.action,{},failed);};
  $('help').onclick=()=>$('help-dialog').showModal();document.querySelectorAll('.yd-close,.yd-done').forEach(b=>b.onclick=()=>$('help-dialog').close());
  $('leave').onclick=()=>$('leave-dialog').showModal();$('stay').onclick=()=>$('leave-dialog').close();$('confirm-leave').onclick=()=>{$('leave-dialog').close();send('leave');};
  $('rematch').onclick=()=>send('rematch');$('review').onclick=()=>$('result-dialog').close();
  $('skip-tally').onclick=()=>{if(tally){tally.skip=true;tickTally();controls();}};
  $('replay-tally').onclick=()=>setupTally(true);
  async function copy(value){try{await navigator.clipboard.writeText(value);notice('Invite copied.');}catch{$('invite-link').hidden=false;$('invite-link').value=value;$('invite-link').select();}}
  $('copy-code').onclick=()=>copy(room.id);$('invite').onclick=()=>copy(location.origin+location.pathname+'?room='+room.id);
  document.addEventListener('pointerdown',()=>sounds.unlock(),{passive:true});
  document.addEventListener('keydown',()=>sounds.unlock());
  document.addEventListener('visibilitychange',()=>{clearTimeout(pollTimer);if(!document.hidden)poll();else sounds.pause();});
  window.addEventListener('pagehide',()=>{clearTimeout(pollTimer);clearInterval(ticker);sounds.close();});
  const ticker=setInterval(clock,100);render();
  (async()=>{
    try{
      token=await window.XanHub.authenticate();if(!token)throw new Error('Connect your API key on the home page to play.');
      await request({action:'profile'});$('connection').textContent='Connected';render();controls();
      const code=new URLSearchParams(location.search).get('room')||storage.get('room');
      if(code){$('join-code').value=code;try{adopt((await request({action:'get',room:code})).room);schedule();}
        catch(e){if(e.status===410||e.status===404){storage.set('room','');history.replaceState({},'',location.pathname);notice(e.message);}else if(e.status===403&&new URLSearchParams(location.search).get('join')==='1')await send('join',{room:code});else if(e.status!==403)notice(e.message);}}
    }catch(e){$('identity-status').textContent=e.message;$('connect').hidden=false;$('connection').textContent='Not connected';}
    controls();
  })();
})();
