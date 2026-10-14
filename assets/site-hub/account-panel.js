/* XAN_SITE_REFINEMENT_V1 — private account statistics and referral controls. */
(() => {
 'use strict';
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;},fmt=n=>Number(n||0).toLocaleString('en-US');
 const storage={get(k){try{return localStorage.getItem(k)||'';}catch{return '';}},set(k,v){try{localStorage.setItem(k,v);}catch{}},remove(k){try{localStorage.removeItem(k);}catch{}}},key=()=>storage.get('tornVisitorApiKey');
 let version=0;
 const dialog=el('dialog',undefined,'xan-dialog xan-account-panel');dialog.id='hub-account-dialog';document.body.append(dialog);
 dialog.addEventListener('close',()=>version++);
 function open(title){version++;document.getElementById('hub-menu-panel').hidden=true;const head=el('div',undefined,'xan-account-heading'),close=el('button','Close','xan-account-close');close.onclick=()=>dialog.close();head.append(el('h2',title),close);dialog.replaceChildren(head);if(!dialog.open)dialog.showModal();return version;}
 const valid=(v,k)=>v===version&&k===key()&&dialog.open;
 function content(node){dialog.append(node);}
 function copyButton(text,label,status){const b=el('button',label);b.onclick=async()=>{try{await navigator.clipboard.writeText(text);status.textContent='Copied.';}catch{status.textContent='Copy this code: '+text;}};return b;}
 async function stats(selected='all'){
  const v=open('Your stats & achievements'),k=key(),status=el('p',k?'Loading your records…':'Connect your Torn API key to view your records.','hub-status');content(status);if(!k)return;
  try{
   const sample={key:k,at:performance.now()},data=await XanHub.api('progress');if(!valid(v,k))return;XanHub.setBalance(data.balance,sample);
   status.remove();const label=el('label','Game'),select=el('select');select.id='hub-stats-game';label.htmlFor=select.id;
   const groups=[['Single Player',true],['Multiplayer',false]],entries=Object.entries(XanHub.games).filter(([id])=>data.progress.stats[id]||data.progress.achievements[id]);select.append(new Option('All games','all'));
   for(const [name,single] of groups){const group=el('optgroup');group.label=name;for(const [id,g] of entries)if((g[1]==='SINGLE PLAYER')===single)group.append(new Option(g[0],id));select.append(group);}
   label.append(select);content(label);const body=el('section');content(body);
   const render=()=>{const all=select.value==='all',ids=all?entries.map(([id])=>id):[select.value],s=all?ids.reduce((a,id)=>{const v=data.progress.stats[id]||{};for(const k of ['games','wins','net','earnings'])a[k]=(a[k]||0)+(v[k]||0);return a;},{}):data.progress.stats[select.value]||{},cards=el('div',undefined,'xan-stat-grid');body.replaceChildren(cards);
    const values=[['Games',fmt(s.games)],['Wins',fmt(s.wins)],['Win rate',s.games?(100*(s.wins||0)/s.games).toFixed(1)+'%':'—']];
    if(all)values.push(['Single-player net',(s.net>0?'+':'')+fmt(s.net)],['Multiplayer winnings',fmt(s.earnings)]);else if(s.net!==undefined)values.push(['Net chips',(s.net>0?'+':'')+fmt(s.net)],['Wagered',fmt(s.wagered)],['Returned',fmt(s.returned)]);else values.push(['Winnings',fmt(s.earnings)]);
    const earned=ids.flatMap(id=>data.progress.achievements[id]||[]).filter(a=>a.unlocked);values.push(['Achievement chips',fmt(earned.reduce((n,a)=>n+a.reward,0))]);
    for(const [name,value] of values){const card=el('div');card.append(el('span',name),el('strong',value));cards.append(card);}
    body.append(el('h3','Achievements'),el('p','Secret challenges. Chip rewards are added automatically when unlocked.','xan-account-note'));
    function trophies(id){const list=el('div',undefined,'xan-trophy-list');for(const a of [...(data.progress.achievements[id]||[])].sort((a,b)=>a.reward-b.reward)){const row=el('article',undefined,a.unlocked?'is-earned':'is-locked');row.append(el('b',a.unlocked?'✓':'◇'),el('strong',a.unlocked?a.title:'Mystery achievement'),el('p',a.unlocked?'Unlocked · reward received':'Unlock requirement hidden'),el('small','+'+fmt(a.reward)+' Chips'));list.append(row);}return list;}
    if(!all)body.append(trophies(select.value));else for(const [name,single] of groups){body.append(el('h3',name));for(const [id,g] of entries.filter(([,g])=>(g[1]==='SINGLE PLAYER')===single)){const list=data.progress.achievements[id]||[],details=el('details',undefined,'xan-game-achievements');details.append(el('summary',g[0]+' · '+list.filter(a=>a.unlocked).length+'/'+list.length+' unlocked'),trophies(id));body.append(details);}}
   };select.onchange=render;if(typeof selected==='string'&&[...select.options].some(o=>o.value===selected))select.value=selected;render();
  }catch(e){if(valid(v,k))status.textContent=e.message;}
 }
 async function referral(){
  const v=open('Referral Code'),k=key(),status=el('p',k?'Loading your referral code…':'Connect your Torn API key to get your referral code.','hub-status');status.setAttribute('role','status');content(el('p','Free 500K Chips for every referral.','xan-referral-title'));content(status);if(!k)return;
  const render=data=>{if(!valid(v,k))return;status.textContent='';const r=data.referral,code=el('code',r.code,'xan-referral-code'),row=el('div',undefined,'hub-actions');row.append(code,copyButton(r.code,'Copy code',status));content(row);content(el('p',r.count+' referrals · '+fmt(r.earned)+' Chips earned'));
   content(el('p','A new player can enter your code when connecting their Torn account. Each verified player counts once.','xan-account-note'));
   if(r.canClaim){const label=el('label','Have a referral code?'),input=el('input'),claim=el('button','Apply referral');input.id='hub-referral-input';input.maxLength=12;input.autocomplete='off';input.spellcheck=false;input.placeholder='XD…';label.htmlFor=input.id;label.append(input);content(label);content(claim);content(el('small','Add it within 24 hours of your first signup. Your referrer receives 500,000 Chips.'));
    claim.onclick=async()=>{claim.disabled=true;try{await XanHub.api('referral',{code:input.value.trim()});if(!valid(v,k))return;input.disabled=true;status.textContent='Referral applied. Your referrer receives 500,000 Chips.';claim.remove();storage.remove('xan-referral-code');}catch(e){if(valid(v,k)){status.textContent=e.message;claim.disabled=false;}}};
   }else if(r.claimed)content(el('p','Your signup referral has been applied.','xan-account-note'));
  };
  try{render(await XanHub.api('referral'));}catch(e){if(valid(v,k))status.textContent=e.message;}
 }
 window.XanAccount={stats};document.getElementById('hub-stats').onclick=()=>stats();document.getElementById('hub-referrals').onclick=referral;
 const active=window.XanSiteAdapter?.current?.().mode;if(XanHub.games[active]?.[1]==='SINGLE PLAYER'){const heading=document.querySelector('main h1'),button=el('button','Stats & achievements','xan-single-progress');button.onclick=()=>stats(active);heading?.after(button);}
 // Public signup codes contain no account credentials. Keep an entered code
 // through verification retries; the server decides eligibility and awards.
 const box=document.querySelector('.hub-key');if(box){const label=el('label','Referral code (optional)','hub-referral-signup'),input=el('input');input.id='hub-signup-referral';input.maxLength=12;input.placeholder='XD…';input.autocomplete='off';input.spellcheck=false;input.value=storage.get('xan-referral-code');label.htmlFor=input.id;label.append(input);box.append(label);input.oninput=()=>storage.set('xan-referral-code',input.value.trim().toUpperCase());}
 window.addEventListener('storage',e=>{if(e.key==='tornVisitorApiKey'&&dialog.open)dialog.close();});
})();
