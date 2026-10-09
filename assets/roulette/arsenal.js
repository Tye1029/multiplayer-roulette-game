(function(global){
  'use strict';
  const key='rouletteGunPreferenceV1',base='/assets/roulette/';
  const choices=Object.freeze([
    {id:'classic',name:'Midnight Gold',color:'#ba8a40',file:'steel-walnut.png',hammerFilter:'none'},
    {id:'silver',name:'Pearl Marshal',color:'#dfd8c6',file:'pearl-marshal.webp',hammerFilter:'grayscale(.85)'},
    {id:'copper',name:'Crimson Viper',color:'#a64c40',file:'crimson-viper.webp',hammerFilter:'sepia(.45) hue-rotate(335deg)'},
    {id:'jade',name:'Desert Relic',color:'#baa274',file:'desert-relic.webp',hammerFilter:'sepia(.25)'},
    {id:'violet',name:'Cobalt Ranger',color:'#617fa6',file:'cobalt-ranger.webp',hammerFilter:'grayscale(1)'},
    {id:'cyber',name:'Neon Frontier',color:'#39c8cf',file:'neon-frontier.webp',cyber:true,hammerFilter:'none'},
    {id:'laser',name:'Redshift Ranger',color:'#ff464b',file:'redshift-ranger.webp',laser:true,hammerFilter:'none'}
  ]);
  function selected(){try{return choices.find(c=>c.id===localStorage.getItem(key))||choices[0];}catch{return choices[0];}}
  function asset(choice=selected()){return base+'revolver-'+choice.file;}
  function hammerAsset(choice=selected()){return base+(choice.cyber?'revolver-neon-frontier-hammer.webp':'revolver-steel-walnut-hammer.png');}
  function current(root){return choices.find(c=>c.id===root?.querySelector('.rr-revolver')?.dataset.finish)||selected();}
  function decorate(root,choice=selected()){
    const gun=root.querySelector('.rr-revolver');if(!gun)return;
    gun.dataset.finish=choice.id;gun.dataset.revolverModel=choice.laser?'redshift-ranger':choice.cyber?'neon-frontier':'steel-walnut';
    gun.setAttribute('aria-label',choice.name+(choice.laser?' laser sidearm':' revolver'));
    root.dataset.gunType=choice.laser?'laser':'revolver';
    gun.style.setProperty('--rr-hammer-finish',choice.hammerFilter);
    root.style.setProperty('--rr-muzzle-x',choice.laser?'1.1%':choice.cyber?'0.7%':'0.35%');
    root.style.setProperty('--rr-muzzle-y',choice.laser?'17%':choice.cyber?'13%':'10%');
    gun.querySelector('.rr-metal-glint')?.style.setProperty('--rr-gun-mask','url("'+asset(choice)+'")');
    if(choice.laser)charge(root);else gun.querySelector('.rr-charge')?.remove();
  }
  function charge(root){
    const gun=root.querySelector('.rr-revolver');if(!gun)return;
    let bar=gun.querySelector('.rr-charge');
    if(!bar){bar=document.createElement('span');bar.className='rr-charge';bar.setAttribute('aria-hidden','true');bar.innerHTML='<i></i>';gun.append(bar);delete gun.dataset.chargeGame;}
    if(gun.dataset.chargeGame===root.dataset.gameId)return;
    gun.dataset.chargeGame=root.dataset.gameId;
    const fill=bar.firstElementChild,empty=root.dataset.status==='complete';
    fill.style.transform=empty?'scaleX(0)':'scaleX(1)';
    if(!empty)rouletteAnimate(fill,[{transform:'scaleX(0)'},{transform:'scaleX(1)'}],{duration:1500,easing:'cubic-bezier(.2,.7,.2,1)'});
  }
  async function laserFeedback(root,live){
    const bar=root.querySelector('.rr-charge'),fill=bar?.firstElementChild;
    global.RouletteAudio?.laserCue?.(live?'fire':'error');
    if(!fill)return;
    fill.getAnimations?.().forEach(a=>a.cancel());
    if(live){fill.style.transform='scaleX(0)';await rouletteAnimate(fill,[{transform:'scaleX(1)'},{transform:'scaleX(0)'}],{duration:180,easing:'ease-out'});}
    else await rouletteAnimate(bar,[{filter:'brightness(1)'},{filter:'brightness(.15)',offset:.25},{filter:'brightness(1)',offset:.45},{filter:'brightness(.15)',offset:.65},{filter:'brightness(1)'}],{duration:380});
  }
  async function choose(root,id){
    const choice=choices.find(c=>c.id===id);if(!choice)return;
    if(rouletteVisualRuntime.busy||root.classList.contains('rr-animation-lock')||global.RouletteTurnLock?.lock?.opening)return;
    const request=root._rrGunChoice=(root._rrGunChoice||0)+1;
    const picture=new Image(),hammer=new Image();picture.src=asset(choice);hammer.src=hammerAsset(choice);await Promise.all([picture.decode(),hammer.decode()]);
    if(!root.isConnected||rouletteVisualRuntime.busy||request!==root._rrGunChoice)return;
    try{localStorage.setItem(key,id);}catch{}
    root.querySelector('.rr-gun-photo').src=picture.src;root.querySelector('.rr-hammer-photo').src=hammer.src;
    decorate(root,choice);
    root.querySelectorAll('[data-gun-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.gunChoice===id)));
    root.querySelector('[data-gun-menu]').hidden=true;root.querySelector('[data-gun-toggle]').setAttribute('aria-expanded','false');
  }
  function menu(){return '<button type="button" class="rr-gun-toggle" data-gun-toggle aria-expanded="false" aria-label="Choose your gun">YOUR GUN</button><div class="rr-gun-menu" data-gun-menu hidden><b>YOUR SIDEARM</b><small>Only you see this choice · saved on this device</small>'+choices.map(c=>'<button type="button" data-gun-choice="'+c.id+'" aria-pressed="'+(c.id===selected().id)+'"><i style="background:'+c.color+'"></i>'+c.name+'</button>').join('')+'</div>';}
  function bind(root){
    decorate(root);
    root.querySelector('[data-gun-toggle]')?.addEventListener('click',()=>{const menu=root.querySelector('[data-gun-menu]');menu.hidden=!menu.hidden;root.querySelector('[data-gun-toggle]').setAttribute('aria-expanded',String(!menu.hidden));});
    root.querySelectorAll('[data-gun-choice]').forEach(button=>button.addEventListener('click',()=>choose(root,button.dataset.gunChoice).catch(()=>{})));
  }
  // Project the rotating texture onto a fixed side-view cylinder. Whole turns
  // restore the exact source rows, avoiding a fade and a mismatched final frame.
  function cylinderRow(y,phase){return (Math.sin(Math.asin(Math.max(-1,Math.min(1,y*2-1)))+phase)+1)/2;}
  async function spin(root){
    const choice=current(root),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(choice.laser){
      global.RouletteAudio?.laserCue?.('cycle');
      const bar=root.querySelector('.rr-charge');
      await rouletteAnimate(bar,[{filter:'brightness(1)'},{filter:'brightness(2)',offset:.4},{filter:'brightness(1)'}],{duration:reduced?250:900});return;
    }
    const gun=root.querySelector('.rr-revolver'),picture=gun?.querySelector('.rr-gun-photo');if(!picture)return;
    await picture.decode();
    const canvas=document.createElement('canvas');canvas.className='rr-drum-roll';canvas.width=224;canvas.height=144;canvas.setAttribute('aria-hidden','true');
    const ctx=canvas.getContext('2d');if(!ctx)return;
    // Exclude the stationary frame, axle and rear ratchet teeth.
    const box=choice.cyber?[.56,.085,.107,.295]:[.546,.043,.133,.307];
    const [x,y,w,h]=box;canvas.style.cssText='left:'+x*100+'%;top:'+y*100+'%;width:'+w*100+'%;height:'+h*100+'%';
    const sx=x*picture.naturalWidth,sy=y*picture.naturalHeight,sw=w*picture.naturalWidth,sh=h*picture.naturalHeight;
    const draw=phase=>{for(let row=0;row<144;row+=2){const sourceY=cylinderRow((row+1)/144,phase);ctx.drawImage(picture,sx,sy+Math.min(sh-2,sourceY*sh),sw,2,0,row,224,2);}};
    draw(0);gun.append(canvas);
    try{
      await global.RouletteAudioBindings?.playSpinButtonChamber?.(reduced?250:1350);
      await new Promise(resolve=>{
        let start;
        const frame=now=>{if(start===undefined)start=now;const t=Math.min(1,(now-start)/(reduced?250:1350));
          draw((1-Math.pow(1-t,3))*Math.PI*8);
          if(t>=1||!canvas.isConnected)return resolve();requestAnimationFrame(frame);
        };requestAnimationFrame(frame);
      });
    }finally{canvas.remove();}
  }
  global.RouletteArsenal=Object.freeze({choices,selected,current,asset,hammerAsset,menu,bind,spin,cylinderRow,laserFeedback});
})(window);
