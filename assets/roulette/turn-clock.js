(function(global){
  'use strict';
  let anchorGame=null,anchorServer=0,anchorLocal=0;
  function bind(root,game){
    if(game!==anchorGame){anchorGame=game;anchorServer=Date.parse(game.serverNow)||Date.now();anchorLocal=performance.now();}
    const button=root.querySelector('[data-roulette-execute]');
    button?.addEventListener('click',event=>rouletteAct('roulette:execute',event));
    tick();
  }
  function tick(){
    const root=document.querySelector('[data-roulette-game]');
    const game=typeof rouletteLatestGame!=='undefined'?rouletteLatestGame:null;
    if(!root||!game)return;
    const state=game.rouletteState||{},timer=root.querySelector('[data-roulette-clock]');
    const now=anchorServer+performance.now()-anchorLocal;
    const seconds=Math.max(0,Math.min(60,Math.ceil((Date.parse(state.turnDeadline)-now)/1000)));
    const active=game.status==='playing'&&rouletteVisualRuntime.openingDone;
    if(timer){timer.textContent=game.status==='complete'?'—':active?(Number.isFinite(seconds)?`${seconds}s`:'60s'):'60s';timer.dataset.urgent=String(active&&seconds<=10);}
    const expired=active&&seconds===0;
    const mine=String(state.turnId)===rouletteMyUserId(game);
    if(expired){const title=root.querySelector('.rr-status strong');if(title)title.textContent=mine?"TIME'S UP":"OPPONENT'S TIME IS UP";}
    const participant=Boolean(game.isPlayer||game.isCreator||game.isJoiner);
    const execution=root.querySelector('[data-roulette-execute]');
    if(execution){execution.hidden=!(expired&&!mine&&participant);execution.disabled=rouletteActionPending||root.classList.contains('rr-animation-lock');}
    if(expired)root.querySelectorAll('[data-roulette-spin],[data-roulette-shoot],[data-roulette-pass]').forEach(button=>button.disabled=true);
  }
  setInterval(()=>{if(!document.hidden)tick();},200);
  global.RouletteTurnClock=Object.freeze({bind});
})(window);
