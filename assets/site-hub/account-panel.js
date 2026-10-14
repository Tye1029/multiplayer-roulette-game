/* XAN_SITE_REFINEMENT_V1 — private account statistics and referral controls. */
(() => {
 'use strict';
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;},fmt=n=>Number(n||0).toLocaleString('en-US');
 const storage={get(k){try{return localStorage.getItem(k)||'';}catch{return '';}},set(k,v){try{localStorage.setItem(k,v);}catch{}},remove(k){try{localStorage.removeItem(k);}catch{}}},key=()=>storage.get('tornVisitorApiKey');
 let version=0;
 const dialog=el('dialog',undefined,'xan-dialog xan-account-panel');dialog.id='hub-account-dialog';document.body.append(dialog);
 dialog.addEventListener('close',()=>version++);
 function open(title){version++;document.getElementById('hub-menu-panel').hidden=true;dialog.replaceChildren(el('h2',title));const close=el('button','Close','xan-account-close');close.onclick=()=>dialog.close();dialog.append(close);dialog.showModal();return version;}
 const valid=(v,k)=>v===version&&k===key()&&dialog.open;
 function content(node){dialog.insertBefore(node,dialog.lastElementChild);}
 function copyButton(text,label,status){const b=el('button',label);b.onclick=async()=>{try{await navigator.clipboard.writeText(text);status.textContent='Copied.';}catch{status.textContent='Copy this code: '+text;}};return b;}
 async function stats(){
  const v=open('Your stats & achievements'),k=key(),status=el('p',k?'Loading your records…':'Connect your Torn API key to view your records.','hub-status');content(status);if(!k)return;
  try{
   const data=await XanHub.api('progress');if(!valid(v,k))return;
   status.remove();const label=el('label','Game'),select=el('select');select.id='hub-stats-game';label.htmlFor=select.id;
   for(const [id,g] of Object.entries(XanHub.games))if(data.progress.stats[id]||data.progress.achievements[id])select.append(new Option(g[0],id));
   label.append(select);content(label);const body=el('section');content(body);
   const render=()=>{const s=data.progress.stats[select.value]||{},cards=el('div',undefined,'xan-stat-grid');body.replaceChildren(cards);
    const values=[['Games',fmt(s.games)],['Wins',fmt(s.wins)],['Win rate',s.games?(100*(s.wins||0)/s.games).toFixed(1)+'%':'—']];
    if(s.net!==undefined)values.push(['Net chips',(s.net>0?'+':'')+fmt(s.net)],['Wagered',fmt(s.wagered)],['Returned',fmt(s.returned)]);else if(s.earnings!==undefined)values.push(['Winnings',fmt(s.earnings)]);
    for(const [name,value] of values){const card=el('div');card.append(el('span',name),el('strong',value));cards.append(card);}
    body.append(el('h3','Achievements'));const trophies=el('div',undefined,'xan-trophy-list');for(const a of data.progress.achievements[select.value]||[]){const row=el('article',undefined,a.unlocked?'is-earned':'is-locked');row.append(el('b',a.unlocked?'✓':'◇'),el('strong',a.title||'Mystery achievement'),el('p',a.description||'Keep playing to discover this achievement.'));if(a.reward)row.append(el('small',fmt(a.reward)+' Chips'));trophies.append(row);}body.append(trophies);
   };select.onchange=render;const active=window.XanSiteAdapter?.current?.().mode;if([...select.options].some(o=>o.value===active))select.value=active;render();
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
 document.getElementById('hub-stats').onclick=stats;document.getElementById('hub-referrals').onclick=referral;
 // Public signup codes contain no account credentials. Keep an entered code
 // through verification retries; the server decides eligibility and awards.
 const box=document.querySelector('.hub-key');if(box){const label=el('label','Referral code (optional)','hub-referral-signup'),input=el('input');input.id='hub-signup-referral';input.maxLength=12;input.placeholder='XD…';input.autocomplete='off';input.spellcheck=false;input.value=storage.get('xan-referral-code');label.htmlFor=input.id;label.append(input);box.append(label);input.oninput=()=>storage.set('xan-referral-code',input.value.trim().toUpperCase());}
 window.addEventListener('storage',e=>{if(e.key==='tornVisitorApiKey'&&dialog.open)dialog.close();});
})();
