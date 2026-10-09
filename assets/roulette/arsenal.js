(function(global){
  'use strict';
  const key='rouletteGunPreferenceV1';
  const choices=Object.freeze([
    {id:'classic',name:'Midnight Gold',color:'#ba8a40',filter:'none'},
    {id:'silver',name:'Silver Smoke',color:'#c9d5db',filter:'grayscale(1) brightness(1.2)'},
    {id:'copper',name:'Burnished Copper',color:'#bd653e',filter:'sepia(.75) saturate(1.8) hue-rotate(338deg)'},
    {id:'jade',name:'Jade Outlaw',color:'#64a88b',filter:'sepia(.7) saturate(1.5) hue-rotate(94deg)'},
    {id:'violet',name:'Violet Dusk',color:'#a885c0',filter:'sepia(.65) saturate(1.65) hue-rotate(225deg)'},
    {id:'cyber',name:'Neon Frontier',color:'#39c8cf',filter:'none',cyber:true}
  ]);
  function selected(){try{return choices.find(c=>c.id===localStorage.getItem(key))||choices[0];}catch{return choices[0];}}
  function asset(choice=selected()){return choice.cyber?'/assets/roulette/revolver-neon-frontier.webp':'/assets/roulette/revolver-steel-walnut.png';}
  function hammerAsset(choice=selected()){return choice.cyber?'/assets/roulette/revolver-neon-frontier-hammer.webp':'/assets/roulette/revolver-steel-walnut-hammer.png';}
  function decorate(root,choice=selected()){
    const gun=root.querySelector('.rr-revolver');if(!gun)return;
    gun.dataset.finish=choice.id;gun.dataset.revolverModel=choice.cyber?'neon-frontier':'steel-walnut';
    gun.style.setProperty('--rr-finish',choice.filter);
    root.style.setProperty('--rr-muzzle-x',choice.cyber?'0.7%':'0.35%');
    root.style.setProperty('--rr-muzzle-y',choice.cyber?'13%':'10%');
    gun.querySelector('.rr-metal-glint')?.style.setProperty('--rr-gun-mask',`url("${asset(choice)}")`);
  }
  async function choose(root,id){
    const choice=choices.find(c=>c.id===id);if(!choice)return;
    if(rouletteVisualRuntime.busy||root.classList.contains('rr-animation-lock')||global.RouletteTurnLock?.lock?.opening)return;
    const request=root._rrGunChoice=(root._rrGunChoice||0)+1;
    const picture=new Image(),hammer=new Image();picture.src=asset(choice);hammer.src=hammerAsset(choice);await Promise.all([picture.decode(),hammer.decode()]);
    if(!root.isConnected||rouletteVisualRuntime.busy||request!==root._rrGunChoice)return;
    try{localStorage.setItem(key,id);}catch{}
    root.querySelector('.rr-gun-photo').src=picture.src;
    root.querySelector('.rr-hammer-photo').src=hammer.src;
    decorate(root,choice);
    root.querySelectorAll('[data-gun-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.gunChoice===id)));
    root.querySelector('[data-gun-menu]').hidden=true;
    root.querySelector('[data-gun-toggle]').setAttribute('aria-expanded','false');
  }
  function menu(){return `<button type="button" class="rr-gun-toggle" data-gun-toggle aria-expanded="false" aria-label="Choose your gun">GUN FINISH</button><div class="rr-gun-menu" data-gun-menu hidden><b>YOUR REVOLVER</b><small>Only you see this choice · saved on this device</small>${choices.map(c=>`<button type="button" data-gun-choice="${c.id}" aria-pressed="${c.id===selected().id}"><i style="background:${c.color}"></i>${c.name}</button>`).join('')}</div>`;}
  function bind(root){
    decorate(root);
    const gun=root.querySelector('.rr-revolver');
    if(gun&&!gun.querySelector('.rr-drum-roll')){const drum=document.createElement('span');drum.className='rr-drum-roll';drum.setAttribute('aria-hidden','true');gun.append(drum);}
    root.querySelector('[data-gun-toggle]')?.addEventListener('click',()=>{const menu=root.querySelector('[data-gun-menu]');menu.hidden=!menu.hidden;root.querySelector('[data-gun-toggle]').setAttribute('aria-expanded',String(!menu.hidden));});
    root.querySelectorAll('[data-gun-choice]').forEach(button=>button.addEventListener('click',()=>choose(root,button.dataset.gunChoice).catch(()=>{})));
  }
  async function spin(root){
    const drum=root.querySelector('.rr-drum-roll');if(!drum)return;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const choice=selected(),viewBox=choice.cyber?'732 47 144 146':'706 21 209 162';
    // Roll the actual engraved drum texture around its long axis. Repeated
    // registered strips permit continuous travel with no backwards reset frame.
    drum.innerHTML=`<span class="rr-drum-strip">${Array.from({length:8},(_,i)=>`<svg aria-hidden="true" style="top:${i*100}%" viewBox="${viewBox}" preserveAspectRatio="none"><image href="${asset(choice)}" width="1307" height="522"/></svg>`).join('')}</span>`;
    await global.RouletteAudioBindings?.playSpinButtonChamber?.(reduced?250:1350);
    const options={duration:reduced?250:1350,easing:'cubic-bezier(.1,.7,.15,1)',fill:'none'};
    await Promise.all([
      rouletteAnimate(drum,[{opacity:0,offset:0},{opacity:1,offset:.08},{opacity:1,offset:.9},{opacity:0,offset:1}],options),
      rouletteAnimate(drum.firstElementChild,[{transform:'translateY(0)'},{transform:'translateY(-700%)'}],options)
    ]);
    drum.replaceChildren();
  }
  global.RouletteArsenal=Object.freeze({choices,selected,asset,hammerAsset,menu,bind,spin});
})(window);
