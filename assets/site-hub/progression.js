(() => {
 'use strict';
 const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 let profile=null,board=null,lastMode='',pending=false,lastLoad=0,section,tab='game';
 const names=['classic','silver','copper','jade','violet','cyber','royal','laser'];
 const challenges=['Available','Win One Game','Win 5 Games','Win 20 Games','Win 50 Games','Win 100 Games','Win 250 Games','Shoot 5 Times In A Row Without Spinning Or Dying'];
 const money=n=>Number(n||0).toLocaleString()+' Chips';
 const store={get(k){try{return localStorage.getItem(k);}catch{}},set(k,v){try{localStorage.setItem(k,v);}catch{}}};
 function mode(){return window.XanSiteAdapter?.current?.().mode||'';}
 window.XanProgress={get profile(){return profile;},challenges,names,
  unlocked(id){return id==='classic'||!!profile?.roulette.unlocked[names.indexOf(id)];},
  async selectGun(id){if(!this.unlocked(id))throw Error('Complete this gun’s challenge first.');await window.XanHub.api('preferences',{settings:{gun:id}});if(profile)profile.settings.gun=id;store.set('rouletteGunPreferenceV1',id);window.dispatchEvent(new CustomEvent('xan-gun-selected',{detail:{id}}));},
  async character(id){await window.XanHub.api('preferences',{settings:{character:id}});if(profile)profile.settings.character=id;},refresh:()=>load(true)
 };
 function toast(title,description,reward,key){
  if(store.get(key))return;store.set(key,'shown');const root=el('section',undefined,'xg-award-toast');root.setAttribute('role','status');const text=el('div');text.append(el('small','ACHIEVEMENT UNLOCKED'),el('strong',title),el('span',description+(reward?' · +'+money(reward):'')));const close=el('button','×');close.setAttribute('aria-label','Dismiss achievement');close.onclick=()=>root.remove();root.append(el('b','✦'),text,close);let host=document.getElementById('xg-award-stack');if(!host){host=el('div',undefined,'xg-award-stack');host.id='xg-award-stack';document.body.prepend(host);}host.append(root);
  if(!document.hidden&&!window.XanPreferences?.muted){const a=new Audio('/assets/bluff/audio/win.wav');a.volume=.18;a.play().catch(()=>{});}
 }
 function notify(){if(window.XanHub?.awaitingResult())return;const id=window.XanHub.profile?.id;if(!id||!profile)return;for(const [m,items] of Object.entries(profile.achievements))for(const a of items)if(a.unlocked)toast(a.title,'Reward received',a.reward,`xan-award:${id}:${m}:${a.id}`);
  for(let i=1;i<names.length;i++)if(profile.roulette.unlocked[i])toast('New sidearm unlocked',challenges[i],0,`xan-gun:${id}:${names[i]}`);
 }
 function achievements(){window.XanAccount?.stats(mode());}
 function mount(){const host=document.querySelector('.xg-open');if(!host)return;if(!section){section=el('section',undefined,'xg-leaderboard');const head=el('div',undefined,'hub-heading');head.append(el('h2','Leaderboards'));const trophies=el('button','Achievements');trophies.onclick=achievements;head.append(trophies);const tabs=el('div',undefined,'xg-board-tabs');for(const [id,label] of [['game','This game'],['overall','Overall winnings']]){const b=el('button',label);b.dataset.tab=id;b.onclick=()=>{tab=id;render();};tabs.append(b);}section.append(head,tabs,el('div',undefined,'xg-board-list'));}if(section.previousElementSibling!==host)host.after(section);section.hidden=!mode();}
 function render(){mount();if(!section)return;section.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===tab)));const list=section.querySelector('.xg-board-list');list.replaceChildren();const rows=board?.[tab]||[];if(!rows.length){list.append(el('p','The first record is waiting to be set.','xg-muted'));return;}rows.forEach((p,i)=>{const row=el('div',undefined,'xg-board-row'),name=el('a',p.name);name.href='https://www.torn.com/profiles.php?XID='+encodeURIComponent(p.owner);name.target='_blank';name.rel='noopener';let value=tab==='overall'?money(p.amount):board.metric==='size'?`${p.stats.size.toFixed(2)} cm · ${p.stats.fish}`:board.metric==='fast'?`${(p.stats.fast/1000).toFixed(2)} seconds`:board.metric==='score'?`${p.stats.score} points`:`${p.stats.wins} wins`;row.append(el('b',String(i+1)),name,el('strong',value));list.append(row);});}
 async function load(force=false){mount();const m=mode();if(!m||pending||document.hidden||!window.XanHub||!store.get('tornVisitorApiKey'))return;if(!force&&m===lastMode&&Date.now()-lastLoad<30000)return;pending=true;const sample={key:store.get('tornVisitorApiKey'),at:performance.now()};try{const data=await window.XanHub.api('progress',{mode:m});if(sample.key!==store.get('tornVisitorApiKey'))return;profile=data.progress;board=data.board;window.XanHub.setBalance(data.balance,sample);lastMode=m;lastLoad=Date.now();if(profile.settings.gun)store.set('rouletteGunPreferenceV1',profile.settings.gun);window.dispatchEvent(new CustomEvent('xan-progress',{detail:profile}));render();notify();}catch{if(section)section.querySelector('.xg-board-list').textContent='Records are temporarily unavailable.';}finally{pending=false;}}
 window.addEventListener('xan-balance-revealed',notify);
 const boot=()=>setTimeout(()=>{mount();render();load();},200);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();window.addEventListener('xan-navigation',()=>load());window.addEventListener('xan-hub-sync',()=>load());document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});const timer=setInterval(()=>load(),10000);window.addEventListener('pagehide',()=>clearInterval(timer));
})();
