/* YAHTZEE_ONLINE_V1_20261011 */
(() => {
  'use strict';
  const $=id=>document.getElementById(id), rules=window.YahtzeeRules;
  const store={get(k){try{return localStorage.getItem('yahtzee:'+k);}catch{return null;}},set(k,v){try{localStorage.setItem('yahtzee:'+k,v);}catch{}}};
  let token=store.get('token');
  if(!/^[a-f0-9]{64}$/.test(token||'')){token=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');store.set('token',token);}
  let room=null, busy=false, selected=null, viewed=null, failed=null, timer, messageTimer, audio, muted=store.get('sound')!=='on', completeKey='', spin=0;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const spots={1:[5],2:[1,9],3:[1,5,9],4:[1,3,7,9],5:[1,3,5,7,9],6:[1,3,4,6,7,9]};
  const rotations=[[0,0],[0,-90],[-90,0],[90,0],[0,90],[0,180]];
  const dice=Array.from({length:5},(_,i)=>{
    const button=document.createElement('button');button.className='die';button.type='button';button.disabled=true;
    button.innerHTML='<span class="cube">'+Array.from({length:6},(_,f)=>'<span class="face">'+spots[f+1].map(n=>`<i class="pip" style="grid-area:${Math.ceil(n/3)}/${(n-1)%3+1}"></i>`).join('')+'</span>').join('')+'</span>';
    button.setAttribute('aria-label','Die '+(i+1));button.setAttribute('aria-pressed','false');
    button.onclick=()=>send('hold',{index:i,held:!room.held[i]});$('dice').append(button);return button;
  });
  function notice(text){clearTimeout(messageTimer);$('notice').textContent=text;messageTimer=setTimeout(()=>$('notice').textContent='',6500);}
  function sound(kind){
    if(muted||document.hidden)return;
    try{audio ||= new (window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});
      const notes=kind==='roll'?[220,320,180,400]:kind==='score'?[440,554,660]:[540];
      notes.forEach((hz,i)=>{const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime+i*.055;o.type='sine';o.frequency.setValueAtTime(hz,t);g.gain.setValueAtTime(.045,t);g.gain.exponentialRampToValueAtTime(.001,t+.1);o.connect(g).connect(audio.destination);o.start(t);o.stop(t+.12);});
    }catch{}
  }
  function updateSound(){$('sound').textContent=muted?'Sound off':'Sound on';$('sound').setAttribute('aria-pressed',String(!muted));$('sound').setAttribute('aria-label',muted?'Turn sound on':'Turn sound off');}
  $('sound').onclick=()=>{muted=!muted;store.set('sound',muted?'off':'on');updateSound();sound('hold');};updateSound();
  const me=()=>room?.players.find(p=>p.id===room.you);
  const myTurn=()=>room?.phase==='playing'&&room.players[room.active].id===room.you;
  function setDice(values, held, animate=false, previousHeld=held){
    if(animate)spin++;
    dice.forEach((button,i)=>{
      const value=values[i]||[2,5,1,6,3][i], [x,y]=rotations[value-1];
      // Each die owns its cumulative rotation: kept dice never move during a reroll.
      if((animate&&!previousHeld[i])||button.dataset.value!==String(value)){const cube=button.firstElementChild;cube.style.setProperty('--rx',(x+spin*720)+'deg');cube.style.setProperty('--ry',(y+spin*360)+'deg');button.dataset.value=String(value);}
      button.setAttribute('aria-label',`Die ${i+1}: ${value}${held[i]?', held':', tap to hold'}`);button.setAttribute('aria-pressed',String(held[i]));
      if(animate&&!previousHeld[i]&&!reduced.matches){button.classList.remove('is-rolling');void button.offsetWidth;button.classList.add('is-rolling');setTimeout(()=>button.classList.remove('is-rolling'),750);}
    });
  }
  function controls(){
    dice.forEach(b=>b.disabled=busy||!!failed||!myTurn()||!room.rolls||room.rolls>=3);
    $('roll').disabled=room?.phase==='complete'?false:busy||!!failed||!myTurn()||room.rolls>=3||room.held.every(Boolean);
    $('start').disabled=busy||!!failed||room?.players[0]?.id!==room?.you||room?.players.length<2;
    for(const id of ['create','join','bank','confirm-leave'])$(id).disabled=busy||!!failed;
    $('retry').hidden=!failed;$('rematch').disabled=busy||!!failed||!!room?.rematch.includes(room?.you);
    document.querySelectorAll('.score-row').forEach(b=>b.disabled=busy||!!failed||b.dataset.available!=='true');
  }
  function node(tag,text,cls){const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;}
  function renderPlayers(){
    $('players').replaceChildren();$('seats').replaceChildren();
    for(const [i,p] of room.players.entries()){
      const card=node('div','','player'+(room.phase==='playing'&&i===room.active?' active':''));
      card.append(node('span',p.name.slice(0,1).toUpperCase(),'avatar'));const label=node('div',p.name+(p.id===room.you?' (you)':''),'name');
      label.append(node('small',room.phase==='waiting'?(i===0?'HOST':'READY'):i===room.active&&room.phase==='playing'?'ROLLING NOW':Object.keys(p.card).length+' / 13 SCORED'));card.append(label,node('strong',String(p.total)));$('players').append(card);
      const seat=node('div',p.name,'seat');seat.append(node('small',i===0?'Host':'Ready'));$('seats').append(seat);
    }
    for(let i=room.players.length;i<4;i++){const seat=node('div','Open seat','seat');seat.append(node('small','Invite a friend'));$('seats').append(seat);}
  }
  function renderScore(){
    const player=room.players.find(p=>p.id===viewed)||me();viewed=player.id;
    const select=$('view-player');select.replaceChildren(...room.players.map(p=>{const o=node('option',p.name+(p.id===room.you?' · Your card':''));o.value=p.id;return o;}));select.value=viewed;
    $('total').replaceChildren(document.createTextNode(player.total),node('small','POINTS'));
    $('bonus-label').textContent=player.upper+' / 63';$('bonus-progress').value=Math.min(63,player.upper);
    $('bonus-hint').textContent=player.bonus?'+35 upper bonus earned!':`${Math.max(0,63-player.upper)} more upper points for +35.`;
    // Public totals uses bonus for the upper bonus; repeated Yahtzees are sent separately.
    const available=myTurn()&&viewed===room.you&&room.rolls?rules.options(room.dice,player.card):{};
    $('scores').replaceChildren();
    for(const [key,label,description] of rules.categories){
      const filled=player.card[key]!=null,allowed=Object.hasOwn(available,key);
      const button=node('button','','score-row'+(filled?' filled':allowed?' available':'')+(allowed&&!available[key]?' zero':'')+(selected===key?' selected':''));button.type='button';button.dataset.category=key;button.dataset.available=String(allowed);button.setAttribute('aria-pressed',String(selected===key));
      const title=node('span',label);title.append(node('small',description));button.append(title,node('b',filled?String(player.card[key]):allowed?String(available[key]):'—'));
      button.onclick=()=>{selected=key;renderScore();controls();$('bank').focus({preventScroll:true});};$('scores').append(button);
    }
    if(selected&&!Object.hasOwn(available,selected))selected=null;
    $('score-confirm').hidden=!selected;
    if(selected)$('score-choice').textContent=`${available[selected]===0?'Take a zero in':'Bank '+available[selected]+' points in'} ${rules.categories.find(c=>c[0]===selected)[1]}?`;
    $('score-note').textContent=player.yahtzeeBonus?`Includes +${player.yahtzeeBonus} in extra Yahtzee bonuses.`:myTurn()?'Tap a category to preview, then bank your score.':'You can browse everyone’s scorecard.';
  }
  function celebrate(){
    if(reduced.matches)return;
    const burst=$('burst');burst.replaceChildren();
    for(let i=0;i<30;i++){const e=node('i','','confetti');e.style.setProperty('--x',`${(Math.random()-.5)*600}px`);e.style.setProperty('--y',`${Math.random()*300-130}px`);e.style.setProperty('--r',`${Math.random()*700}deg`);e.style.background=['#d9eda8','#efb08a','#fffbed'][i%3];burst.append(e);}setTimeout(()=>burst.replaceChildren(),1700);
  }
  function results(){
    const sorted=[...room.players].sort((a,b)=>b.total-a.total),winners=sorted.filter(p=>p.total===sorted[0].total);
    $('result-title').textContent=winners.length>1?'It’s a tie!':winners[0].id===room.you?'That’s how you roll.':winners[0].name+' wins!';
    $('result-subtitle').textContent=winners.length>1?winners.map(p=>p.name).join(' & ')+' share the win.':`${sorted[0].total} points. A game well rolled.`;
    $('standings').replaceChildren(...sorted.map((p,i)=>{const row=node('div',`${i+1}. ${p.name}`,'standing');row.append(node('b',p.total+' pts'));return row;}));
    $('rematch-status').textContent=`${room.rematch.length} / ${room.players.length} ready for another game`;
    $('rematch').textContent=room.rematch.includes(room.you)?'Waiting for your friends…':'Play again ↗';
    const key=room.id+':'+room.game;if(completeKey!==key){completeKey=key;$('result-dialog').showModal();celebrate();sound('score');}
  }
  function render(animate=false,oldHeld=room?.held){
    const joined=!!room;$('lobby').hidden=joined;$('players').hidden=!joined;$('room-badge').hidden=!joined;$('edition').hidden=joined;$('leave').hidden=!joined;
    $('waiting').hidden=!joined||room.phase!=='waiting';$('score-panel').hidden=!joined||!['playing','complete'].includes(room.phase);$('steps').hidden=joined;$('roll').hidden=!joined||!['playing','complete'].includes(room.phase);
    if(!joined){setDice([],Array(5).fill(false));controls();return;}
    $('copy-code').textContent=room.id;renderPlayers();
    if(['playing','complete'].includes(room.phase))renderScore();
    setDice(room.dice,room.held,animate,oldHeld);
    const active=room.players[room.active];
    $('round').textContent=room.phase==='waiting'?'YOUR PRIVATE TABLE':room.phase==='complete'?'ALL 13 ROUNDS · COMPLETE':`ROUND ${room.round.toString().padStart(2,'0')} / 13`;
    $('turn-label').textContent=room.phase==='playing'?(myTurn()?'Your turn — make it count.':active.name+' is rolling.'):'2–4 friends. One great game.';
    $('prompt').textContent=room.phase==='waiting'?'The gang’s almost here.':room.phase==='complete'?'A game well rolled.':room.phase==='closed'?'This table has closed.':myTurn()?(room.rolls===0?'Your turn. Let’s roll.':room.rolls===3?'Make it count.':'Keep the good ones.'):`${active.name}’s turn.`;
    $('hint').textContent=room.phase==='waiting'?'Invite your friends, then start when you’re ready.':room.phase==='complete'?'Review the scores or play again with your friends.':room.phase==='closed'?'Leave this room to start a fresh game.':myTurn()?(room.rolls===0?'Roll five dice to get started.':room.rolls===3?'Choose a category below and bank your score.':'Tap dice to hold. Roll again, or bank a score.'):'Follow their rolls live. You’re up soon.';
    $('roll').textContent=room.phase==='complete'?'View results':room.rolls===0?'Roll dice ↗':room.rolls===3?'Choose a score ↓':`Roll again · ${3-room.rolls} left`;
    $('table-caption').textContent=room.phase==='waiting'?'Your lucky seat is waiting.':room.phase==='complete'?'Same time, one more game?':room.rolls?room.dice.every(n=>n===room.dice[0])?'YAHTZEE! Five of a kind.':myTurn()?'TAP A DIE TO HOLD IT':'LIVE FROM THE TABLE':'A fresh roll. A fresh chance.';
    $('last-move').textContent=room.last?.text||'STANDARD SCORING · NO TURN TIMER';
    $('roll-dots').querySelectorAll('i').forEach((e,i)=>e.classList.toggle('used',i<room.rolls));
    $('start').textContent=room.players[0].id===room.you?'Start game →':'Waiting for the host…';
    if(room.phase==='complete')results();else if($('result-dialog').open)$('result-dialog').close();
    controls();if(room.phase==='complete')$('roll').disabled=false;
  }
  async function request(body){
    const response=await fetch('/.netlify/functions/yahtzee-action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
    let data;try{data=await response.json();}catch{throw new Error('Connection interrupted. Retry your move.');}
    if(!response.ok){const e=new Error(data.error||'Please try again.');e.status=response.status;throw e;}return data.room;
  }
  function adopt(next,animate=false,oldHeld){
    if(room&&room.id===next.id&&next.revision<room.revision)return;
    room=next;store.set('room',room.id);history.replaceState({},'',`?room=${room.id}`);render(animate,oldHeld);
  }
  async function send(action,extra={},retryBody){
    if(busy)return;busy=true;clearTimeout(timer);controls();
    if(action==='roll')$('roll').textContent='Rolling…';
    const body=retryBody||{action,room:room?.id,token,requestId:crypto.randomUUID(),revision:room?.revision,game:room?.game,...extra};
    const oldHeld=room?.held?[...room.held]:Array(5).fill(false);failed=null;
    try{
      const next=await request(body),rolling=body.action==='roll';
      selected=null;viewed=next.you;
      if(body.action==='leave'){room=null;store.set('room','');location.assign(location.pathname);return;}
      adopt(next,rolling,oldHeld);
      if(rolling){sound('roll');if(next.dice.every(n=>n===next.dice[0]))celebrate();await new Promise(r=>setTimeout(r,reduced.matches?20:740));}
      else sound(body.action==='score'?'score':'hold');
      $('connection').textContent='Connected';
    }catch(e){
      notice(e.message);
      if(!e.status||e.status>=500){failed=body;$('connection').textContent='Reconnecting · retry your move';}
      else if(e.status===409&&room){try{adopt(await request({action:'get',room:room.id,token}));}catch{}}
    }finally{busy=false;controls();schedule();}
  }
  function schedule(){clearTimeout(timer);if(room&&!document.hidden)timer=setTimeout(poll,room.phase==='waiting'?1800:1400);}
  async function poll(){
    if(busy||!room||document.hidden){schedule();return;}
    const code=room.id;
    try{const next=await request({action:'get',room:code,token});if(!busy&&room?.id===code){if(next.revision>room.revision){const animate=next.game===room.game&&next.active===room.active&&next.rolls>room.rolls;adopt(next,animate,[...room.held]);}if(!failed)$('connection').textContent='Connected';}}
    catch(e){$('connection').textContent='Reconnecting…';if(e.status===404){notice(e.message);clearTimeout(timer);return;}}
    schedule();
  }
  $('retry').onclick=()=>{const body=failed;if(body)send(body.action,{},body);};
  $('create-form').onsubmit=e=>{e.preventDefault();store.set('name',$('name').value.trim());send('create',{name:$('name').value});};
  $('join-form').onsubmit=e=>{e.preventDefault();if(!$('name').reportValidity())return;store.set('name',$('name').value.trim());send('join',{name:$('name').value,room:$('join-code').value.trim().toUpperCase()});};
  $('start').onclick=()=>send('start');$('roll').onclick=()=>room.phase==='complete'?$('result-dialog').showModal():send('roll');
  $('bank').onclick=()=>{if(selected)send('score',{category:selected});};$('cancel-score').onclick=()=>{selected=null;renderScore();controls();};
  $('view-player').onchange=e=>{viewed=e.target.value;selected=null;renderScore();controls();};
  $('rematch').onclick=()=>send('rematch');$('review').onclick=()=>$('result-dialog').close();
  $('leave').onclick=()=>{$('leave-description').textContent=room.phase==='playing'?'This ends the current game for everyone. You can reconnect by reloading instead.':'You can create a new room or join another friend.';$('leave-dialog').showModal();};
  $('confirm-leave').onclick=()=>{$('leave-dialog').close();send('leave');};$('stay').onclick=()=>$('leave-dialog').close();
  async function copy(text){try{await navigator.clipboard.writeText(text);notice('Copied. Send it to your friends!');}catch{$('invite-link').hidden=false;$('invite-link').value=text;$('invite-link').select();notice('Select and copy the invite above.');}}
  $('invite').onclick=()=>copy(`${location.origin}${location.pathname}?room=${room.id}`);$('copy-code').onclick=()=>copy(room.id);
  $('help').onclick=()=>$('help-dialog').showModal();document.querySelectorAll('.dialog-close,.dialog-done').forEach(b=>b.onclick=()=>$('help-dialog').close());
  document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden)poll();else audio?.suspend();});
  $('name').value=store.get('name')||'';
  const code=new URLSearchParams(location.search).get('room')||store.get('room');
  if(code)$('join-code').value=code;
  render();
  if(code){busy=true;controls();request({action:'get',room:code,token}).then(next=>{adopt(next);schedule();}).catch(e=>{if(e.status!==403&&e.status!==404)notice(e.message);if(e.status===404)store.set('room','');}).finally(()=>{busy=false;controls();});}
})();
