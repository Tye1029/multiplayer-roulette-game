/* XAN_PUBLIC_POLISH_V2 — presentation shared by the game-owned scenes. */
(() => {
 'use strict';
 const e=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
 const img=(src,cls)=>{const n=e('img',cls);n.src=src;n.alt='';n.decoding='async';return n;};
 window.XanRules={
  roulette:['Take turns shooting until one person remains.','You get 1 spin per game to reset the bullet’s location to a random spot.','Don’t die.'],
  'roulette-four':['Take turns shooting. Take at least one shot before passing.','You get one spin per game to reset the bullet’s location and the next shot award.','Safe shots earn Chips from the pot. When a player dies, survivors share the remaining pot according to their safe shots.','Don’t die.'],
  fishing:['Wait for a ripple, then tap it while the fish is biting.','You get one cast. Bigger ripples mean bigger fish—choose your moment before time runs out.','Your biggest fish decides the winner. Equal sizes are a draw.','Common fish appear most often. Uncommon, rare, and mythical fish become progressively harder to find.'],
  safecracker:['Drag the matching screwdriver onto each screw. Turn it three times to remove it.','Open the wire guide. Use the cutters to cut the listed wires in order.','Turn the dial in the shown direction and confirm each target to open the vault.','Finish before your opponent. Wrong tools, cuts, or guesses damage the safe; five faults trigger lockdown.'],
  mountainrace:['Follow the next holds shown above your climber.','Press the matching direction, or the directions together for a combination hold.','Wrong inputs make you slip. Recover and keep climbing.','Reach the summit first.'],
  bluff:['Both players start with ten random cards.','Select any number of cards and claim they match the required symbol. Lock them within 30 seconds or lose.','Choose Believe or Bluff for your opponent’s play.','All cards are revealed. A caught bluffer takes their cards back. An incorrect challenge takes the opponent’s genuine cards.','Empty your hand after all card transfers to win.'],
  yahtzee:['Both players play each round at the same time.','Roll up to three times. Tap dice to hold or release them.','Choose one unused scorecard category within 30 seconds.','Fill all thirteen categories. The highest total wins.'],
  rps:['Choose rock, paper, or scissors before the timer ends.','Rock beats scissors. Scissors beats paper. Paper beats rock.','Ties replay. Win two rounds to win the match.'],
  draw:['Watch the saloon for targets.','Shoot criminals before they disappear. Spare civilians.','Some targets need more than one hit. Keep aiming until they fall.','Score more points than your opponent before time runs out.']
 };
 window.XanMenuArt={mount(root,mode){
  root.classList.add('xg-object-art');root.setAttribute('aria-hidden','true');
  const glow=e('div','xg-art-glow');root.append(glow);
  if(['roulette','roulette-four','draw'].includes(mode)){
   const table=e('div','xg-mini-table');table.append(img('/assets/roulette/decor/oval-table-v2.png','xg-table-photo'),img('/assets/roulette/revolver-steel-walnut.png','xg-hero-gun'));root.append(table);
   for(let i=0;i<3;i++){const b=e('i','xg-brass');b.style.setProperty('--i',i);root.append(b);}
  }else if(mode==='yahtzee'){
   for(let i=0;i<3;i++){const d=e('div','xg-hero-die');d.style.setProperty('--i',i);for(let j=0;j<9;j++){const pip=e('i');pip.style.opacity=([[0,2,4,6,8],[0,2,3,5,6,8],[0,4,8]][i].includes(j))?'1':'0';d.append(pip);}root.append(d);}
  }else if(mode==='safecracker'){
   root.append(img('/assets/site-hub/images/safecracker-foreground.webp','xg-vault-object'));const ring=e('div','xg-vault-ring');root.append(ring);
  }else if(mode==='fishing'){
   root.append(img('/assets/fishing/images/v2/fish/electric-eel-v2.png','xg-fish-object'),img('/assets/fishing/images/v2/rare/aurora-koi-v2.png','xg-fish-small'));for(let i=0;i<7;i++){const b=e('i','xg-bubble');b.style.setProperty('--i',i);root.append(b);}
  }else if(mode==='rps'){
   root.append(img('/assets/site-hub/images/rps-foreground.webp','xg-gladiator-object'));
   for(const [i,name] of ['rock','paper','scissors'].entries()){const hand=img('/assets/rps/images/'+name+'-icon.png','xg-hand-object');hand.style.setProperty('--i',i);root.append(hand);}
  }else if(mode==='mountainrace'){
   root.append(img('/assets/mountain-race/images/summit-sprint-reboot-background-v44.png','xg-mountain-object'));for(let i=0;i<3;i++){const cloud=e('i','xg-cloud');cloud.style.setProperty('--i',i);root.append(cloud);}
  }
 }};
 function whenReady(){
  const menu=document.getElementById('hub-menu-panel');if(!menu)return setTimeout(whenReady,60);
  const wallet=e('button','hub-wallet','Deposit/Withdraw');wallet.id='hub-wallet';document.querySelector('.xan-account').append(wallet);
  const dialog=e('dialog','xan-dialog xg-wallet');document.body.append(dialog);
  let requestId=crypto.randomUUID();
  wallet.onclick=()=>{
   dialog.replaceChildren(e('h2',null,'Your Chips'),e('strong','xg-exchange','1 Xan = 800,000 Chips'));
   const text=e('p');text.append('Send Xanax to ');text.append(e('strong',null,'CowBoyCookie [4300885]'));text.append(' With The Message XanDuel to receive chips.');dialog.append(text);
   const check=e('button',null,'Check deposit'),input=e('input'),withdraw=e('button',null,'Request withdrawal'),close=e('button',null,'Close'),status=e('p','hub-status');status.setAttribute('role','status');
   const label=e('label',null,'Chips to withdraw');Object.assign(input,{type:'number',min:800000,step:800000,value:800000});label.append(input);
   dialog.append(check,label,e('small',null,'Withdrawals use 800,000-Chip increments. Requests are sent to the admin.'),withdraw,status,close);close.onclick=()=>dialog.close();
   async function run(action){check.disabled=withdraw.disabled=true;try{const key=localStorage.getItem('tornVisitorApiKey');if(!key)throw Error('Connect your Torn API key on the home page first.');let result;if(action==='withdraw'){if(!input.reportValidity())return;result=await window.XanHub.post('request-withdraw',{visitorKey:key,amount:Number(input.value),withdrawalId:requestId});requestId=crypto.randomUUID();}else result=await window.XanHub.post('check-xans',{visitorKey:key});status.textContent=result.message||(Number(result.addedTickets||0).toLocaleString()+' Chips added.');window.XanHub.refresh();}catch(err){status.textContent=err.message;}finally{check.disabled=withdraw.disabled=false;}}
   check.onclick=()=>run('deposit');withdraw.onclick=()=>run('withdraw');dialog.showModal();
  };
  // A visible tab checks quietly; a shared lease avoids duplicating checks across tabs.
  let checking=false;
  async function checkDeposits(){
   if(document.hidden||checking||!window.XanPlayerProfile?.id)return;
   const key=localStorage.getItem('tornVisitorApiKey');if(!key)return;
   const lease='xan-deposit-check:'+window.XanPlayerProfile.id;
   const check=async()=>{if(Date.now()-Number(localStorage.getItem(lease)||0)<300000)return;localStorage.setItem(lease,String(Date.now()));checking=true;try{const d=await window.XanHub.post('check-xans',{visitorKey:key});if(d.addedTickets>0){window.XanHub.refresh();window.dispatchEvent(new CustomEvent('xan-deposit',{detail:d.addedTickets}));}}catch{localStorage.setItem(lease,String(Date.now()+600000));}finally{checking=false;}};
   if(navigator.locks)await navigator.locks.request(lease,{ifAvailable:true},lock=>lock?check():undefined);else await check();
  }
  const depositTimer=setInterval(checkDeposits,30000);window.addEventListener('xan-hub-sync',checkDeposits);document.addEventListener('visibilitychange',checkDeposits);window.addEventListener('pagehide',()=>clearInterval(depositTimer));
  document.querySelectorAll('details').forEach(n=>{if(/art.*credits|audio.*credits/i.test(n.querySelector('summary')?.textContent||''))n.remove();});
  // Keep local debug tools available to developers without exposing their controls.
  document.querySelectorAll('a[href*="credits"],a[href*="attribution"],a[href*="ATTRIBUTION"]').forEach(n=>n.hidden=true);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',whenReady,{once:true});else whenReady();
})();
