/* XAN_PUBLIC_POLISH_V2: shared menus; each adapter retains its own live game. */
(() => {
  'use strict';
  const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const chips=n=>Number(n||0).toLocaleString()+' Chips';
  const summaries={bluff:'Play your hand. Sell the bluff. Read your opponent and empty your cards first.',yahtzee:'Roll together. Keep your best dice. Build the winning score across thirteen rounds.',rps:'Choose your gladiator, hide your hand, and outguess your rival. First to two wins.',roulette:'A six-chamber showdown. Take your turn, trust your nerve, and be the last one standing.','roulette-four':'Four players. One revolver. Bank safe shots and survive to share the pot.',fishing:'Cast, hook, and reel. Land the biggest catch before your opponent.',safecracker:'Steady hands. Perfect timing. Crack the vault before your rival.',mountainrace:'Find your rhythm and race for the summit. Every hold brings you closer.',draw:'Keep a sharp eye on the saloon. Shoot criminals, spare civilians, and outscore your rival.',blackjackduel:'Hit, stand, and play your stack. Get closer to 21 and outlast your opponent.'};
  const paths={diceduel:'dice-duel',rps:'rps','roulette-four':'roulette-four',bluff:'bluff',yahtzee:'yahtzee',minigolf:'mini-golf'};
  const href=(mode,id='')=>paths[mode]?'/games/multiplayer/'+paths[mode]+'/'+(id?'?'+(mode==='rps'?'arena':'room')+'='+encodeURIComponent(id):''):'/?game='+encodeURIComponent(mode)+(id?'&room='+encodeURIComponent(id):'');
  window.XanGameMenu={href,install({games,showRules}){
    // The isolated four-bot harness owns its setup dialog and has no online adapter.
    if(location.pathname.includes('/roulette-four/')&&new URLSearchParams(location.search).get('practice')==='1')return;
    const host=document.getElementById('duelScreen')||document.querySelector('main');if(!host)return;
    const legacy=host.id==='duelScreen';let mode='',last='',pending=false,quote=null;
    document.body.classList.add('xan-unified');
    const heading=el('header',undefined,'xg-heading'),title=el('h1'),tools=el('div',undefined,'xg-tools'),help=el('button','How to play'),extras=el('div',undefined,'xg-extras');
    help.onclick=()=>showRules(mode);tools.append(help,extras);heading.append(title,tools);
    const menu=el('section',undefined,'xg-menu'),left=el('div',undefined,'xg-intro'),description=el('p',undefined,'xg-description'),art=el('div',undefined,'xg-art');
    const label=el('label','Wager per player · Chips','xg-wager'),stake=el('input');Object.assign(stake,{type:'number',min:'1000',max:'50000',step:'1000',value:'1000',required:true,id:'xg-wager'});label.htmlFor=stake.id;label.append(stake);
    const actions=el('div',undefined,'xg-actions'),create=el('button','Create Game','xg-primary'),privateGame=el('button',undefined,'xg-private'),practice=el('button','Test with bot','xg-practice');
    privateGame.append(el('span','Create Private Game'),el('small','INVITE A FRIEND ↗'));actions.append(create,privateGame);
    const form=el('form',undefined,'xg-join'),code=el('input'),join=el('button','Join Game');Object.assign(code,{id:'xg-code',placeholder:'Private Game Code',maxLength:100,autocomplete:'off',required:true});code.setAttribute('aria-label','Private Game Code');join.type='submit';form.append(code,join);
    const status=document.getElementById('duelStatus')||el('p');status.classList.add('xg-status');status.setAttribute('role','status');
    left.append(description,label,actions,status);menu.append(left,art);
    const waiting=el('section',undefined,'xg-waiting'),waitingTitle=el('h2'),waitingDetail=el('p'),invite=el('div',undefined,'xg-invite'),roomCode=el('input'),link=el('a'),copy=el('button','Invite a friend · Copy link');
    roomCode.readOnly=true;roomCode.setAttribute('aria-label','Your private game code');link.textContent='Open invitation link ↗';invite.append(roomCode,link,copy);const readyButton=el('button','Ready','xg-ready');readyButton.onclick=()=>run(()=>adapter().ready());const cancelButton=el('button','×','xg-cancel');cancelButton.setAttribute('aria-label','Cancel waiting game');cancelButton.onclick=()=>run(()=>window.XanHub.cancelTable(mode,adapter().view().id));waiting.append(cancelButton,waitingTitle,readyButton,waitingDetail);waiting.hidden=true;
    const open=el('section',undefined,'hub-open hub-game-open xg-open'),openHead=el('div',undefined,'hub-heading'),refresh=el('button','Refresh');openHead.append(el('h2','Open Games'),refresh);
    const list=el('div');list.dataset.hubGames='';list.append(el('p','Connect your API key on the home page to see open games.','hub-empty'));const listStatus=el('p',undefined,'hub-status');listStatus.dataset.hubLobbyStatus='';open.append(openHead,list,listStatus,form,invite);
    host.querySelectorAll('.hub-game-open').forEach(e=>e.remove());host.prepend(heading,menu,waiting);host.append(open);refresh.hidden=true;refresh.onclick=()=>window.XanHub.refresh();
    const adapter=()=>window.XanSiteAdapter;
    async function run(fn){if(pending)return;pending=true;create.disabled=privateGame.disabled=join.disabled=practice.disabled=true;status.textContent='Connecting to the table…';try{const result=await fn();if(result?.error)throw new Error(result.error);status.textContent='';quote=null;update();window.XanHub.refresh();}catch(e){status.textContent=e.message;}finally{pending=false;create.disabled=privateGame.disabled=join.disabled=practice.disabled=false;}}
    const make=privacy=>{if(!stake.reportValidity())return;run(()=>adapter().create({wager:Number(stake.value),private:privacy}));};create.onclick=()=>make(false);privateGame.onclick=()=>make(true);practice.onclick=()=>run(()=>adapter().practice());
    // Preserve a quote until the explicit Join click; merely opening a link never reserves Chips.
    form.onsubmit=e=>{e.preventDefault();if(pending)return;const value=code.value.trim();if(quote?.id===value)return run(()=>adapter().join(value,quote.wager));pending=true;join.disabled=true;adapter().quote(value).then(q=>{quote=q;code.value=q.id;join.textContent='Join · '+chips(q.wager);status.textContent=q.name+' · '+chips(q.wager)+' per player · '+'Press Join to accept.';}).catch(e=>status.textContent=e.message).finally(()=>{pending=false;join.disabled=false;});};
    code.oninput=()=>{quote=null;join.textContent='Join Game';};
    copy.onclick=async()=>{try{await navigator.clipboard.writeText(link.href);copy.textContent='Invitation copied ✓';}catch{roomCode.focus();roomCode.select();copy.textContent='Copy the code or open the link';}};
    function bubbles(view){
      const resultRoot=adapter()?.resultRoot?.();if(!resultRoot||!view.finished)return;
      let block=resultRoot.querySelector('.xg-rematch');if(!block){block=el('section',undefined,'xg-rematch');resultRoot.append(block);}
      const key=JSON.stringify([view.id,view.match,view.players,view.votes,view.payout,view.settlement,view.wager]);if(block.dataset.key===key)return;block.dataset.key=key;block.replaceChildren();
      block.append(el('p',view.settlement==='funding'||view.settlement==='reserved'?'Confirming Chip payouts…':view.wager?chips(view.payout)+' credited · '+chips(view.wager)+' stake':'Practice complete','xg-payout'));
      const roster=el('div',undefined,'xg-roster');
      for(const p of view.players||[]){const accepted=(view.votes||[]).includes(p.id)||p.bot;const person=el('div',undefined,'xg-person');person.classList.toggle('accepted',accepted);const portrait=el('div',undefined,'xg-portrait');let source=p.avatar||p.avatarUrl||'';
        if(!/^(https:\/\/|\/assets\/)/.test(source))source=games[mode]?.[2];
        const image=el('img');image.src=source;image.alt=p.name;image.loading='lazy';portrait.append(image,el('span',accepted?'✓':'…'));person.append(portrait,el('small',p.name),el('small',accepted?'Ready':'Waiting'));roster.append(person);}
      block.append(roster,el('p',view.wager?'Each player accepts '+chips(view.wager)+' for the rematch. A new stake is reserved for each new match.':'Ready up for another free practice match.','xg-rematch-note'));
    }
    function update(){
      const a=adapter(),c=a?.current?.();const nextMode=c?.mode||Object.keys(paths).find(m=>location.pathname.includes('/'+paths[m]+'/'));if(!games[nextMode]){heading.hidden=menu.hidden=waiting.hidden=open.hidden=true;return;}heading.hidden=open.hidden=false;
      const view=a?.view?.()||{id:c?.id,phase:c?.phase},active=!!view.id;mode=nextMode;
      heading.hidden=legacy&&['countdown','playing'].includes(view.phase);
      host.classList.toggle('hub-has-game',active);document.body.dataset.xanMode=mode;host.dataset.xanActive=String(active);host.dataset.xanPhase=view.phase||'lobby';
      menu.hidden=active;practice.hidden=true;window.XanGameMenu.addBot=async()=>{if(active&&!(view.phase==='waiting'&&(view.players?.length||0)<2))throw Error('Add a bot before another player joins.');return a?.addBot?a.addBot():a?.practice?.();};window.XanGameMenu.canAddBot=!view.connecting&&!!(a?.addBot||a?.practice)&&(!active||(view.phase==='waiting'&&(view.players?.length||0)<2));stake.min=['bluff','yahtzee','minigolf','diceduel'].includes(mode)?'0':'1000';
      const key=JSON.stringify([mode,view.id,view.phase,view.wager,view.private,view.players?.length]);
      if(key!==last){last=key;title.textContent=games[mode][0];description.textContent=summaries[mode]||games[mode][3];host.style.setProperty('--game-accent',games[mode][4]);
        if(art.dataset.mode!==mode){art.dataset.mode=mode;art.replaceChildren();if(mode==='bluff'){const hero=document.querySelector('#lobby .hero-art');if(hero)art.append(hero);}else window.XanMenuArt?.mount(art,mode);}
        waiting.hidden=!active||!['waiting','ready','funding'].includes(view.phase);form.hidden=active;waitingTitle.textContent=view.phase==='funding'?'Confirming stakes…':(view.players?.length||0)<(view.capacity||2)?'Waiting for another player':'Your table is ready';
        invite.hidden=!view.private||(view.players||[]).some(p=>p.bot);waitingDetail.textContent='';roomCode.value=view.id||'';link.href=href(mode,view.id);copy.textContent='Invite a friend · Copy link';
        if(active)history.replaceState(null,'',href(mode,view.id));
      }
      cancelButton.hidden=!view.canCancel;readyButton.hidden=!a?.ready||!['waiting','ready'].includes(view.phase);readyButton.disabled=pending||!view.canReady;readyButton.textContent=view.ready?'Waiting for opponent'+(view.readyDeadline?' · '+Math.max(0,Math.ceil((view.readyDeadline-Date.now())/1000))+'s':''):(view.players?.length||0)<(view.capacity||2)?'Waiting for another player':'Ready';if(view.finished)bubbles(view);
      if(a?.controls){for(const control of [a.controls()].flat())if(control&&control.parentNode!==extras)extras.append(control);}

    }
    const params=new URLSearchParams(location.search);code.value=params.get('room')||params.get('arena')||'';
    if(code.value)status.textContent='Invitation loaded. Join your private game below.';
    update();const timer=setInterval(()=>{if(!document.hidden)update();},250);window.addEventListener('xan-navigation',update);window.addEventListener('pagehide',()=>clearInterval(timer));
    window.XanGameMenu.update=update;
  }};
})();
