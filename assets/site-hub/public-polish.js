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
  let pendingWithdrawal=null,view=0;
  wallet.onclick=()=>{
   const generation=++view,key=localStorage.getItem('tornVisitorApiKey'),rate=800000;let balance=null,busy=false;
   if(pendingWithdrawal?.key!==key)pendingWithdrawal=null;
   dialog.replaceChildren(e('h2',null,'Your Chips'),e('strong','xg-exchange','1 Xan = 800,000 Chips'));
   const total=e('p','xg-wallet-balance','Loading balance…');dialog.append(total);
   const instructions=e('section','xg-deposit-instructions'),text=e('p');text.append('Send Xanax to ',e('strong',null,'CowBoyCookie [4300885]'),' With The Message ',e('strong',null,'XanDuel'),' to receive chips.');instructions.append(text);
   const copies=e('div','hub-actions');for(const [value,label] of [['CowBoyCookie','Copy name'],['XanDuel','Copy message']]){const copy=e('button',null,label);copy.onclick=async()=>{try{await navigator.clipboard.writeText(value);status.textContent=label+' copied.';}catch{status.textContent='Copy: '+value;}};copies.append(copy);}instructions.append(copies);dialog.append(instructions);
   const check=e('button',null,'Check deposit'),select=e('select'),custom=e('input'),max=e('button',null,'Max'),withdraw=e('button',null,'Request withdrawal'),close=e('button',null,'Close'),status=e('p','hub-status'),cost=e('small','xg-withdraw-cost');status.setAttribute('role','status');
   select.id='hub-withdraw-xans';custom.id='hub-withdraw-custom';custom.type='number';custom.min='1';custom.step='1';custom.hidden=true;custom.setAttribute('aria-label','Custom Xan amount');
   const label=e('label',null,'Xans to withdraw');label.htmlFor=select.id;const controls=e('div','xg-withdraw-controls');controls.append(select,max);label.append(controls,custom,cost);
   dialog.append(check,label,withdraw,status,e('small','xg-withdraw-time','Xans will be sent within 24 Hours'),close);close.onclick=()=>dialog.close();
   const valid=()=>dialog.open&&generation===view&&key===localStorage.getItem('tornVisitorApiKey');
   const amount=()=>Number(select.value==='custom'?custom.value:select.value),limit=()=>Math.floor((balance||0)/rate);
   function controlsState(){const retry=!!pendingWithdrawal,n=amount();custom.hidden=select.value!=='custom';select.disabled=custom.disabled=max.disabled=busy||retry||limit()<1;check.disabled=busy;withdraw.disabled=busy||(!retry&&(!Number.isSafeInteger(n)||n<1||n>limit()));withdraw.textContent=retry?'Retry withdrawal':'Request withdrawal';cost.textContent=Number.isSafeInteger(n)&&n>0?(n*rate).toLocaleString()+' Chips':'Minimum 1 Xan';}
   function update(value){if(!Number.isSafeInteger(value)||value<0)return;balance=value;total.textContent=value.toLocaleString()+' Chips = '+(value/rate).toLocaleString('en-US',{maximumFractionDigits:8})+' Xans';const chosen=pendingWithdrawal?pendingWithdrawal.amount/rate:amount();select.replaceChildren();for(let n=1;n<=Math.min(100,limit());n++)select.append(new Option(n+' '+(n===1?'Xan':'Xans'),String(n)));if(limit()>100){select.append(new Option(limit().toLocaleString()+' Xans (max)',String(limit())),new Option('Custom amount','custom'));}if(!limit())select.append(new Option('Not enough Chips for 1 Xan','0'));if(pendingWithdrawal){if(![...select.options].some(o=>o.value===String(chosen)))select.append(new Option(chosen+' Xans (pending)',String(chosen)));select.value=String(chosen);}else if(chosen>100&&chosen!==limit()){select.value='custom';custom.value=String(chosen);}else if(chosen>0&&chosen<=limit())select.value=String(chosen);custom.max=String(limit());controlsState();}
   async function refreshBalance(){try{const sample={key,at:performance.now()},r=await XanHub.api('balance');if(valid()){update(r.balance);XanHub.setBalance(r.balance,sample);}}catch(err){if(valid()){total.textContent=key?'Balance unavailable. Try reopening this panel.':'Connect your Torn API key to see your balance.';status.textContent=err.message;controlsState();}}}
   async function run(action){if(busy)return;busy=true;controlsState();try{
    if(!key)throw Error('Connect your Torn API key on the home page first.');let result;
    if(action==='withdraw'){if(!pendingWithdrawal){const n=amount();if(!Number.isSafeInteger(n)||n<1||n>limit())throw Error('Choose a Xan amount within your balance.');pendingWithdrawal={key,amount:n*rate,id:crypto.randomUUID()};}const receipt=pendingWithdrawal;result=await XanHub.post('request-withdraw',{visitorKey:key,amount:receipt.amount,withdrawalId:receipt.id});if(pendingWithdrawal===receipt)pendingWithdrawal=null;
    }else result=await XanHub.post('check-xans',{visitorKey:key});
    if(!valid())return;status.textContent=result.message||(result.addedTickets>0?Number(result.addedTickets).toLocaleString()+' Chips added.':'No new deposit detected.');if(Number.isSafeInteger(result.serverBalance))update(result.serverBalance);await refreshBalance();XanHub.refresh();
   }catch(err){if(valid()){if(action==='withdraw'&&err.status>=400&&err.status<500)pendingWithdrawal=null;status.textContent=err.message+(pendingWithdrawal?' Retry to confirm this same withdrawal.':'');}}finally{busy=false;if(valid())controlsState();}}
   select.onchange=custom.oninput=controlsState;max.onclick=()=>{select.value=String(limit());controlsState();};check.onclick=()=>run('deposit');withdraw.onclick=()=>run('withdraw');dialog.showModal();controlsState();refreshBalance();
  };
  window.addEventListener('storage',event=>{if(event.key==='tornVisitorApiKey'){view++;pendingWithdrawal=null;dialog.close();}});
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
