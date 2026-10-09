(function (global) {
  'use strict';
  const configApi = global.RouletteLampConfig;
  if (!configApi) throw new Error('lamp-config.js must load before lamp.js');
  const lampAsset = '/assets/roulette/decor/rustic-pendant-v2.png';
  const styleAsset = '/assets/roulette/lamp.css?v=18&scene=rustic-v2&warm=4';
  const phaseEpoch = Number(global.__rrLampPhaseEpoch) || Date.now();
  global.__rrLampPhaseEpoch = phaseEpoch;
  const drivers = new WeakMap();

  function ensureStyles(doc) {
    let link = doc.getElementById('rrLampExternalStyles');
    if (!link) { link = doc.createElement('link'); link.id = 'rrLampExternalStyles'; link.rel = 'stylesheet'; doc.head.append(link); }
    if (!link.href.includes('warm=4')) link.href = styleAsset;
    return link;
  }
  function queryScene(doc) {
    const game = doc.querySelector('[data-roulette-game]');
    const find = selector => game?.querySelector(selector) || null;
    return { game, rig:find('.rr126-lamp-rig'), swing:find('.rr126-swing'), chain:find('.rr126-chain'),
      image:find('#rrLampPng'), sceneLight:find('.rr130-table-illumination'), surface:find('.rr-table'),
      volume:find('.rr-light-volume'), gunGlint:find('.rr-metal-glint') };
  }
  // A single pendulum determines the bulb position AND its projected pool.
  // There is no second animation clock that can drift away from the lamp.
  function samplePendulum(cfg, elapsedMs, geometry) {
    const phase = elapsedMs / (cfg.speed * 1000) * Math.PI * 2;
    const angle = geometry.reducedMotion ? 0 : Math.sin(phase) * cfg.swing;
    const radians = angle * Math.PI / 180;
    const offsetX=Number(geometry.bulbOffsetX)||0;
    const bulbX = geometry.anchorX + Math.cos(radians)*offsetX - Math.sin(radians) * geometry.length;
    const bulbY = geometry.anchorY + Math.sin(radians)*offsetX + Math.cos(radians) * geometry.length;
    const poolY = geometry.tableY + geometry.tableHeight * cfg.lightY / 100;
    const reach = cfg.track / 5 * cfg.trackSpeed / 5.6;
    const poolX = bulbX - Math.tan(radians) * Math.max(0, poolY - bulbY) * reach +
      geometry.tableWidth * (cfg.lightX - 50) / 100;
    return { angle, bulbX, bulbY, poolX, poolY,
      radiusX:geometry.tableWidth * cfg.spreadX / 200,
      radiusY:geometry.tableHeight * cfg.spreadY / 200 };
  }
  // Invert the rendered plane, including every protected facing/recoil transform.
  // Probe points are read only; this module never writes the gun's orientation.
  function projectLightToSurface(points, worldX, worldY) {
    const ax = (points.b.x - points.a.x) / points.width, ay = (points.b.y - points.a.y) / points.width;
    const bx = (points.c.x - points.a.x) / points.height, by = (points.c.y - points.a.y) / points.height;
    const determinant = ax * by - ay * bx;
    if (Math.abs(determinant) < 0.000001) return null;
    const a = by / determinant, b = -ay / determinant, c = -bx / determinant, d = ax / determinant;
    const x = worldX - points.a.x, y = worldY - points.a.y;
    return { x:a*x+c*y, y:b*x+d*y, a,b,c,d };
  }
  function ensureProbes(doc, glint) {
    if (!glint) return null;
    if (glint._rrLightField) return glint._rrLightField;
    for (const suffix of ['a','b','c']) {
      if (!glint.querySelector('.rr-light-probe-' + suffix)) {
        const probe = doc.createElement('i'); probe.className = 'rr-light-probe rr-light-probe-' + suffix; glint.append(probe);
      }
    }
    let field = glint.querySelector('.rr-gun-light-field');
    if (!field) { field = doc.createElement('span'); field.className = 'rr-gun-light-field'; glint.append(field); }
    glint._rrLightProbes = ['a','b','c'].map(suffix => glint.querySelector('.rr-light-probe-' + suffix));
    glint._rrLightField = field;
    return field;
  }
  function point(element) {
    const rect = element.getBoundingClientRect();
    return {x:rect.left,y:rect.top};
  }
  function draw(doc, scene, cfg) {
    if (!scene.game?.isConnected || !scene.surface || !scene.image || !scene.sceneLight || !scene.chain) return;
    const box = scene.game.getBoundingClientRect(), table = scene.surface.getBoundingClientRect();
    if (!box.width || !box.height || !table.width) return;
    const chainLength = scene.swing.clientHeight * cfg.chainHeight / 100 *
      (cfg.chainLeftLength + cfg.chainRightLength) / 200;
    const artTop = chainLength + (cfg.lampArtY - 50);
    const artWidth = scene.swing.clientWidth * cfg.lampWidth / 100 * cfg.lampScale;
    const geometry = {
      anchorX:box.width*cfg.lampX/100, anchorY:cfg.lampY,
      length:artTop + artWidth*427/640*.84,bulbOffsetX:scene.swing.clientWidth*cfg.lampArtX/100,
      tableY:table.top-box.top, tableWidth:table.width, tableHeight:table.height,
      reducedMotion:doc.defaultView.matchMedia('(prefers-reduced-motion: reduce)').matches
    };
    const light = samplePendulum(cfg, Date.now()-phaseEpoch, geometry);
    const field = ensureProbes(doc, scene.gunGlint);
    let projected = null;
    if (field && scene.gunGlint.clientWidth && scene.gunGlint.clientHeight) {
      projected = projectLightToSurface({
        a:point(scene.gunGlint._rrLightProbes[0]),
        b:point(scene.gunGlint._rrLightProbes[1]),
        c:point(scene.gunGlint._rrLightProbes[2]),
        width:scene.gunGlint.clientWidth,height:scene.gunGlint.clientHeight
      }, box.left+light.poolX,box.top+light.poolY);
    }
    // Perform all geometry reads before writing style to avoid layout thrashing.
    scene.swing.style.setProperty('transform','translateX(-50%) rotate('+light.angle+'deg)','important');
    const localX = light.poolX-(table.left-box.left), localY=light.poolY-(table.top-box.top);
    const strength=Math.min(1,cfg.strength);
    scene.sceneLight.style.setProperty('--rr-surface-light','radial-gradient(ellipse '+light.radiusX+'px '+light.radiusY+'px at '+localX+'px '+localY+'px,rgba(0,0,0,'+strength+') 0%,rgba(0,0,0,'+(strength*.75)+') 30%,rgba(0,0,0,'+(strength*.32)+') 60%,transparent 100%)');
    if (projected) {
      const a=projected.a*light.radiusX/50,b=projected.b*light.radiusX/50;
      const c=projected.c*light.radiusY/50,d=projected.d*light.radiusY/50;
      field.style.setProperty('transform','matrix('+[a,b,c,d,projected.x-50*a-50*c,projected.y-50*b-50*d].join(',')+')');
      scene.game.style.setProperty('--rr-shadow-x',((box.width*.5-light.poolX)*.035)+'px');
    }
    if(scene.volume) {
      scene.volume.style.setProperty('left',light.bulbX+'px');
      scene.volume.style.setProperty('top',light.bulbY+'px');
    }
    scene.game.style.setProperty('--rr-room-light-x',light.poolX+'px');
    scene.game.style.setProperty('--rr-room-light-y',(light.bulbY+box.height*.14)+'px');
    scene.game.dataset.lampAngle=light.angle.toFixed(3);
    scene.game.dataset.lightX=light.poolX.toFixed(2);
    scene.game.dataset.lightY=light.poolY.toFixed(2);
    scene.game.dataset.bulbX=light.bulbX.toFixed(2);
    scene.game.dataset.bulbY=light.bulbY.toFixed(2);
  }
  function apply(doc, rawConfig={}) {
    ensureStyles(doc);
    const cfg=configApi.normalize(rawConfig),scene=queryScene(doc);
    if(!scene.game||!scene.swing) return {mounted:false,scene,config:cfg,connectedCount:0,totalControls:25,targets:{}};
    if(!scene.image) {
      scene.image=doc.createElement('img');scene.image.id='rrLampPng';scene.image.alt='';scene.image.src=lampAsset;scene.swing.append(scene.image);
    }
    if(!scene.chain) {scene.chain=doc.createElement('div');scene.chain.className='rr126-chain';scene.swing.prepend(scene.chain);}
    if(!scene.swing.querySelector('.rr-bulb-bloom')) {
      const bloom=doc.createElement('span');bloom.className='rr-bulb-bloom';scene.swing.append(bloom);
    }
    // Calibration/size values change only when mounted or resized. Keep them
    // out of the animation loop, which owns only moving transforms and light.
    const chainLength=scene.swing.clientHeight*cfg.chainHeight/100*(cfg.chainLeftLength+cfg.chainRightLength)/200;
    const artTop=chainLength+(cfg.lampArtY-50);
    const artWidth=scene.swing.clientWidth*cfg.lampWidth/100*cfg.lampScale;
    scene.swing.style.setProperty('left',cfg.lampX+'%','important');
    scene.swing.style.setProperty('top',cfg.lampY+'px','important');
    scene.swing.style.setProperty('--rr-lamp-image-top',artTop+'px');
    scene.swing.style.setProperty('--rr-bulb-local-y',(artTop+artWidth*427/640*.84)+'px');
    scene.chain.style.setProperty('height',chainLength+'px','important');
    scene.chain.style.setProperty('width',cfg.chainWidth+'px','important');
    scene.chain.style.setProperty('transform','translateX(-50%) scaleX('+cfg.chainStretch+')','important');
    scene.image.style.setProperty('width',cfg.lampWidth+'%','important');
    scene.image.style.setProperty('left',(50+cfg.lampArtX)+'%','important');
    scene.image.style.setProperty('transform','translateX(-50%) scale('+cfg.lampScale+')','important');
    scene.image.style.setProperty('filter','brightness('+(1+cfg.lampGlow*.06)+')','important');
    scene.game.style.setProperty('--rr-wall-dark',cfg.wallDark);
    if(scene.volume) {
      scene.volume.style.width=Math.round(scene.game.clientWidth*.72)+'px';
      scene.volume.style.height=Math.round(scene.game.clientHeight*.51)+'px';
    }
    const field=ensureProbes(doc,scene.gunGlint);
    if(field) {
      field.style.setProperty('--rr-gun-light-strength',String(Math.min(1,cfg.strength)*(.40+cfg.gunGleam)));
      field.style.background='radial-gradient(circle,hsla('+cfg.lightHue+','+cfg.lightSaturation+'%,68%,.34),hsla('+cfg.lightHue+','+cfg.lightSaturation+'%,55%,.14) 35%,hsla('+cfg.lightHue+','+cfg.lightSaturation+'%,58%,.06) 65%,transparent 100%)';
    }
    let driver=drivers.get(doc);
    if(!driver) {driver={scene,cfg,frame:0,lastTime:0};drivers.set(doc,driver);}
    driver.scene=scene;driver.cfg=cfg;
    draw(doc,scene,cfg);
    scene.sceneLight?.querySelector('img')?.style.setProperty('filter','brightness(1.32) saturate(1.12) sepia(.42) hue-rotate('+(cfg.lightHue-34)+'deg)');
    const targetExists={lampImage:!!scene.image,swingAndChains:!!scene.swing&&!!scene.chain,swing:!!scene.swing,
      chains:!!scene.chain,leftChain:!!scene.chain,rightChain:!!scene.chain,
      trackedLight:!!scene.sceneLight,roomOverlay:!!scene.game,gunGlint:!!scene.gunGlint};
    const targets=Object.fromEntries(Object.entries(configApi.bindings).map(([key,target])=>[key,Boolean(targetExists[target])]));
    return {mounted:true,image:scene.image,scene,config:cfg,connectedCount:Object.values(targets).filter(Boolean).length,totalControls:25,targets};
  }
  function watch(doc, configProvider, onApply) {
    const view=doc.defaultView||global;
    let stopped=false,frame=0,lastTime=0,observedRoot=null,intersecting=true;
    const intersection=view.IntersectionObserver?new view.IntersectionObserver(entries=>{
      const entry=entries.find(item=>item.target===observedRoot);if(!entry)return;
      intersecting=entry.isIntersecting;
      if(intersecting)run();else {view.cancelAnimationFrame(frame);frame=0;}
    }):null;
    const run=()=>{
      const result=apply(doc,typeof configProvider==='function'?configProvider():configProvider);
      if(result.scene.game!==observedRoot) {
        if(observedRoot)intersection?.unobserve(observedRoot);
        observedRoot=result.scene.game;intersecting=true;
        if(observedRoot)intersection?.observe(observedRoot);
      }
      onApply?.(result);
      if(result.mounted&&intersecting&&!frame&&!doc.hidden&&result.scene.game.getBoundingClientRect().width) frame=view.requestAnimationFrame(tick);
    };
    const tick=time=>{
      frame=0;if(stopped||doc.hidden||!intersecting)return;
      const driver=drivers.get(doc);
      if(!driver?.scene.game?.isConnected)return;
      if(time-lastTime>=32) {draw(doc,driver.scene,driver.cfg);lastTime=time;}
      frame=view.requestAnimationFrame(tick);
    };
    const observer=new view.MutationObserver(()=>{
      if(stopped)return;
      const current=queryScene(doc),previous=drivers.get(doc)?.scene;
      if(current.game!==previous?.game||current.swing!==previous?.swing||current.gunGlint!==previous?.gunGlint)run();
    });
    observer.observe(doc.body||doc.documentElement,{childList:true,subtree:true});
    const visibility=()=>{if(doc.hidden){view.cancelAnimationFrame(frame);frame=0;}else run();};
    view.addEventListener('resize',run,{passive:true});doc.addEventListener('visibilitychange',visibility);run();
    return ()=>{stopped=true;observer.disconnect();intersection?.disconnect();view.cancelAnimationFrame(frame);view.removeEventListener('resize',run);doc.removeEventListener('visibilitychange',visibility);};
  }
  global.RouletteLamp=Object.freeze({lampAsset,styleAsset,ensureStyles,queryScene,samplePendulum,projectLightToSurface,apply,watch});
})(window);
