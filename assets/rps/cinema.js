/* HAND_OF_DOOM_V3_20261009. Presentation only: never owns picks or round timing. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RPSCinema = api;
})(typeof globalThis === 'object' ? globalThis : this, () => {
  'use strict';
  const frames = { lookback:0, eyes:1, rage:2, tears:3, rock:4, paper:5, scissors:6, victory:7, disbelief:8 };
  const edits = [['lookback','eyes','rage'],['eyes','lookback','rage'],['rage','eyes','lookback'],['lookback','rage','eyes'],['eyes','rage','lookback'],['rage','lookback','eyes']];
  function plan(g,now,calm=false) {
    if (!g || !['reveal','complete'].includes(g.phase)) return {shot:'wide'};
    // A local clock alone cannot reveal a secret. Wait for the server's redacted picks.
    if (!g.picks) {
      if (calm) return {shot:'wide'};
      const elapsed = now - g.cutAt;
      const edit = edits[(g.round + g.variant) % edits.length];
      return {shot:elapsed < 0 ? 'wide' : edit[elapsed < 400 ? 0 : elapsed < 850 ? 1 : 2]};
    }
    const age = now - g.revealAt;
    return {shot:'hands',picks:g.picks, reactions:!calm && (g.phase==='complete' || age>=850),
      reactionFrames:g.roundWinner===null ? [8,8] : [0,1].map(seat=>seat===g.roundWinner ? 7 : (g.round+g.variant)%2 ? 3 : 8)};
  }
  function mount(audio,record=()=>{}) {
    const $=id=>document.getElementById(id), arena=$('arena');
    let last='',characters=['maximus','voss'],ready=new Map();
    const poseNames={lookback:'YOU DARE?',eyes:'ABSOLUTE FOCUS',rage:'LIMIT BREAK'};
    function atlas(id) { return `/assets/rps/images/${id}-cuts.png?v=3`; }
    function preload(id) {
      if (ready.has(id)) return;
      ready.set(id,'loading');const image=new Image();image.src=atlas(id);
      image.decode().then(()=>{ready.set(id,'ready');record('art-ready',{asset:id});}).catch(()=>{ready.set(id,'failed');record('art-failed',{asset:id});});
    }
    function cell(el,id,frame) {
      if (el.dataset.character===id && el.dataset.frame===String(frame)) return;
      el.dataset.character=id;el.dataset.frame=String(frame);
      el.style.backgroundImage=`url("${atlas(id)}")`;
      el.style.backgroundPosition=`${frame%3*50}% ${Math.floor(frame/3)*50}%`;
    }
    function setCharacters(ids) { characters=ids;ids.forEach(preload); }
    function draw(g,now,calm) {
      const p=plan(g,now,calm), key=`${g?.id}:${g?.round}:${p.shot}:${p.reactions}`;
      arena.dataset.shot=p.shot;
      arena.classList.toggle('reaction-cut',Boolean(p.reactions));
      $('hands').setAttribute('aria-hidden',String(p.shot!=='hands'));
      if (p.shot!=='wide' && p.shot!=='hands') {
        characters.forEach((id,i)=>cell($('pose'+(i?'B':'A')),id,frames[p.shot]));
        $('editWord').textContent=poseNames[p.shot];
      }
      if(p.picks) {
        p.picks.forEach((choice,i)=>{
          const seat=i?'B':'A';cell($('reveal'+seat),characters[i],frames[choice]);
          $('hand'+seat).querySelector('span').textContent=choice.toUpperCase();
          cell($('reaction'+seat),characters[i],p.reactionFrames[i]);
          $('reaction'+seat).setAttribute('aria-label',p.reactionFrames[i]===7?'Triumphant victory':p.reactionFrames[i]===3?'Tears of defeat':'Outraged disbelief');
        });
      }
      if(key!==last) {
        last=key;record('camera',{shot:p.shot,round:g?.round,reactions:Boolean(p.reactions)});
        if(!calm && ['lookback','eyes','rage'].includes(p.shot)) {
          audio.cue(p.shot==='eyes'?'cut':'swish');
          if(p.shot==='rage') audio.effort(characters[(g.round+g.variant)%2],g.round,'attack');
        }
        if(p.reactions && g.roundWinner!==null) audio.effort(characters[1-g.roundWinner],g.round,'hurt');
      }
    }
    // Tiny foreground spectators use only transform animation, in four staggered groups.
    for(let group=0;group<4;group++) {
      const row=document.createElement('div');row.className='crowd-group';row.style.setProperty('--delay',`${group*-.27}s`);
      for(let i=0;i<20;i++) {const fan=document.createElement('i');fan.className='fan';fan.style.setProperty('--fan',String((i*7+group)%3));row.append(fan);}
      $('crowdMotion').append(row);
    }
    for(let i=0;i<12;i++) {const e=document.createElement('i');e.style.setProperty('--x',`${(i*37)%100}%`);e.style.setProperty('--delay',`${i*-.43}s`);$('embers').append(e);}
    return {draw,setCharacters,diagnostics:()=>({atlases:Object.fromEntries(ready),shot:arena.dataset.shot}),reset:()=>{last='';draw(null,0,true);}};
  }
  return {plan,frames,mount};
});
