import { readFile, writeFile } from 'node:fs/promises';

const indexUrl = new URL('../index.html', import.meta.url);

const obsoleteSceneBlockIds = [
  'rr-v114-image2-lamp-rig',
  'rr-v115-lamp-and-light-runtime',
  'rr-v126-split-lamp-rig',
  'rr-v127-lamp-layer-fix',
  'rr-v130-table-surface-lighting',
  'rr-v134-clean-reactive-lighting',
  'rr-v135-overhead-table-light-fix',
  'rr-v136-center-bright-full-table-extension',
  'rr-v136-table-edge-layer',
  'rr-v137-reference-centered-textured-lighting',
  'rr-v139-visible-reference-lighting',
  'rr-v140-lighting-debug-rebuild',
  'rr-v140-lighting-debug-tools',
  'rr-v141-debug-bootstrap',
  'rr-v141-debug-visible-fix',
  'rr-v142-warm-rough-table-authoritative',
  'rr-v143-clean-moving-light-authoritative',
  'rr-v143-remove-debug-ui',
  'rr-v144-targeted-light-balance',
  'rr-v145-single-driver-light-sync',
  'rr-v145-single-driver-light-sync-script',
  'rr-v146-lamp-art-cleanup',
  'rr-v147-halo-bulb-direction-fix',
  'rr-v148-final-lamp-asset-cleanup',
  'rr-live-lamp-calibration-style',
  'rr-live-lamp-calibration-script',
  'rr-live-lamp-calibration-overrides'
];

const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function removeObsoleteSceneBlocks(source) {
  let html = source;
  for (const id of obsoleteSceneBlockIds) {
    const escapedId = escapeRegex(id);
    const pattern = new RegExp(
      String.raw`(?:\\n)?\s*<(style|script)\b[^>]*\bid=["']${escapedId}["'][^>]*>[\s\S]*?<\/\1>\s*`,
      'gi'
    );
    html = html.replace(pattern, '\n');
  }
  return html;
}

const motionTransformPattern = /    function rouletteMotionTransform\(angle,scale=rouletteMotionScale\(\),x='-50%',y='-50%'\)\{[\s\S]*?\n    \}\n    function rouletteRotationGlint/;
const cleanMotionTransform = `    function rouletteMotionTransform(angle,scale=rouletteMotionScale(),x='-50%',y='-50%'){
      return \`translate(\${x},\${y}) rotate(\${Number(angle)||0}deg) scale(\${scale})\`;
    }
    function rouletteRotationGlint`;

const rotateFunctionPattern = /    async function rouletteRotateToTurn\(game,st,gameId,\{duration=1050,targetTurnId\}=\{\}\)\{[\s\S]*?\n    \}\n    function rouletteAngleForPlayer/;
const authoritativeRotateFunction = `    async function rouletteRotateToTurn(game,st,gameId,{duration=1050,targetTurnId}={}){
      const requestedTurnId=String(targetTurnId||st?.turnId||'');
      if(!requestedTurnId)return;
      const latestAtStart=rouletteLatestGame||game;
      if(String(latestAtStart?.gameId||'')!==String(gameId)||
        latestAtStart?.status!=='playing'||
        String(latestAtStart?.rouletteState?.turnId||'')!==requestedTurnId){
        rouletteDebug('discarded stale turn rotation',{requestedTurnId,authoritativeTurnId:String(latestAtStart?.rouletteState?.turnId||'')});
        return;
      }
      const liveRoot=duelActive?.querySelector(\`[data-roulette-game][data-game-id="\${CSS.escape(gameId)}"]\`);
      const motion=liveRoot?.querySelector('[data-roulette-motion]');
      const glint=liveRoot?.querySelector('.rr-metal-glint');
      if(!liveRoot||!motion)return;
      const clearOffsets=element=>{
        if(!element)return;
        element.style.removeProperty('translate');
        element.style.removeProperty('rotate');
        element.style.removeProperty('scale');
      };
      const settleMounted=(angle,turnId)=>{
        const mountedRoot=duelActive?.querySelector(\`[data-roulette-game][data-game-id="\${CSS.escape(gameId)}"]\`);
        const mountedMotion=mountedRoot?.querySelector('[data-roulette-motion]')||motion;
        for(const candidate of new Set([motion,mountedMotion].filter(Boolean))){
          candidate.getAnimations?.().forEach(a=>a.cancel());
          clearOffsets(candidate);
        }
        if(mountedMotion){
          mountedMotion.style.transform=rouletteMotionTransform(angle,rouletteMotionScale());
          mountedMotion.dataset.rouletteFacingTurnId=String(turnId||'');
        }
        return mountedRoot;
      };
      const target=rouletteAngleForPlayer(latestAtStart,requestedTurnId);
      const from=Number.isFinite(rouletteVisualRuntime.currentAngle)?rouletteVisualRuntime.currentAngle:target;
      let delta=((((target-from)%360)+540)%360)-180;
      if(delta===-180)delta=180;
      const mountedClaimsTarget=String(motion.dataset.rouletteFacingTurnId||'')===requestedTurnId;
      const runtimeClaimsTarget=rouletteVisualRuntime.displayTurnId===requestedTurnId&&Math.abs(delta)<.5;
      if(runtimeClaimsTarget&&mountedClaimsTarget){
        settleMounted(target,requestedTurnId);
        rouletteVisualRuntime.currentAngle=target;
        rouletteVisualRuntime.angleHydrated=true;
        rouletteVisualRuntime.lastTurnId=requestedTurnId;
        rouletteVisualRuntime.displayTurnId=requestedTurnId;
        rouletteVisualRuntime.rotationTargetId='';
        return;
      }
      const epoch=++rouletteVisualRuntime.rotationEpoch;
      rouletteVisualRuntime.rotationTargetId=requestedTurnId;
      liveRoot.classList.add('rr-animation-lock');
      clearOffsets(motion);
      motion.getAnimations?.().forEach(a=>a.cancel());
      motion.style.opacity='1';
      try{
        if(Math.abs(delta)>=.5){
          const animatedTarget=from+delta;
          await Promise.all([
            rouletteAnimate(motion,[
              {transform:rouletteMotionTransform(from,rouletteMotionScale())},
              {transform:rouletteMotionTransform(animatedTarget,rouletteMotionScale())}
            ],{duration,easing:'cubic-bezier(.22,.58,.12,1)',fill:'forwards'}),
            rouletteRotationGlint(glint,duration,.18)
          ]);
        }
      }finally{
        const mountedRoot=settleMounted(target,requestedTurnId);
        const mountedGlint=mountedRoot?.querySelector('.rr-metal-glint');
        for(const candidate of new Set([glint,mountedGlint].filter(Boolean))){
          candidate.getAnimations?.().forEach(a=>a.cancel());
          candidate.style.opacity='0';
          candidate.style.backgroundPosition='116% 0';
        }
        liveRoot.classList.remove('rr-animation-lock');
        mountedRoot?.classList.remove('rr-animation-lock');
      }
      if(epoch!==rouletteVisualRuntime.rotationEpoch)return;
      rouletteVisualRuntime.currentAngle=target;
      rouletteVisualRuntime.angleHydrated=true;
      rouletteVisualRuntime.lastTurnId=requestedTurnId;
      rouletteVisualRuntime.displayTurnId=requestedTurnId;
      rouletteVisualRuntime.rotationTargetId='';
      const latestAtFinish=rouletteLatestGame;
      const authoritativeTurnId=String(latestAtFinish?.rouletteState?.turnId||'');
      if(String(latestAtFinish?.gameId||'')===String(gameId)&&latestAtFinish?.status==='playing'&&authoritativeTurnId&&authoritativeTurnId!==requestedTurnId){
        await rouletteRotateToTurn(latestAtFinish,latestAtFinish.rouletteState,gameId,{duration:Math.min(700,duration),targetTurnId:authoritativeTurnId});
      }
    }
    function rouletteAngleForPlayer`;

const shotSystemPattern = /\n    (?:async function rouletteOrientToShotActor\(game,st,gameId\)\{[\s\S]*?\n    \}\n    )?async function rouletteShotSequence\(game,st,gameId\)\{[\s\S]*?\n    \}\n    function rouletteHandleEffects/;
const stableShotSystem = `
    async function rouletteShotSequence(game,st,gameId){
      // A shot may animate the mounted gun, but it never changes direction.
      // If an older shot reaches the queue after the display has moved to a
      // different player, skip that stale visual instead of flipping backward.
      const actorId=String(st?.lastActorId||'');
      const displayedTurnId=String(rouletteVisualRuntime.displayTurnId||rouletteVisualRuntime.lastTurnId||'');
      if(actorId&&displayedTurnId&&actorId!==displayedTurnId){
        rouletteDebug('skipped stale shot visual',{actorId,displayedTurnId,revision:st?.revision});
        return;
      }
      const liveRoot=duelActive?.querySelector(\`[data-roulette-game][data-game-id="\${CSS.escape(gameId)}"]\`);
      const motion=liveRoot?.querySelector('[data-roulette-motion]');
      const hammer=liveRoot?.querySelector('.rr-hammer-photo');
      const cover=liveRoot?.querySelector('.rr-hammer-cover');
      const glint=liveRoot?.querySelector('.rr-metal-glint');
      const flash=liveRoot?.querySelector('.rr-shot-flash');
      const smoke=[...(liveRoot?.querySelectorAll('.rr-shot-smoke i')||[])];
      if(!liveRoot||!motion)return;
      const base=Number.isFinite(rouletteVisualRuntime.currentAngle)
        ?rouletteVisualRuntime.currentAngle
        :rouletteAngleForPlayer(game,displayedTurnId||actorId||st?.turnId);
      const facingSign=Math.cos((base+4)*Math.PI/180)>=0?1:-1;
      const clearShotOffsets=element=>{
        if(!element)return;
        element.style.removeProperty('translate');
        element.style.removeProperty('rotate');
        element.style.removeProperty('scale');
      };
      motion.style.transform=rouletteMotionTransform(base,rouletteMotionScale());
      motion.dataset.rouletteFacingTurnId=displayedTurnId||actorId||String(st?.turnId||'');
      clearShotOffsets(motion);
      liveRoot.classList.add('rr-animation-lock');
      [motion,hammer,cover,glint,flash,...smoke].filter(Boolean).forEach(el=>el.getAnimations?.().forEach(a=>a.cancel()));
      if(cover)cover.style.opacity='0';
      if(hammer){
        hammer.style.opacity='1';
        rouletteShotIndexSound();
        const hammerMotion=rouletteAnimate(hammer,[
          {transform:'rotate(0deg)',offset:0},
          {transform:'rotate(23deg)',offset:.46},
          {transform:'rotate(23deg)',offset:.60},
          {transform:'rotate(-2.5deg)',offset:.76},
          {transform:'rotate(0deg)',offset:1}
        ],{duration:420,easing:'cubic-bezier(.22,.03,.16,1)',fill:'none'});
        await rouletteWait(255);
        liveRoot._rrHammerMotion=hammerMotion;
      }else await rouletteWait(255);
      const live=st.lastOutcome==='live';
      if(live){
        rouletteGunshotSound();navigator.vibrate?.([90,35,220]);
        const shotFx=[];
        if(flash)shotFx.push(rouletteAnimate(flash,[
          {opacity:0,transform:'translate(-50%,-50%) scale(.1)'},
          {opacity:1,transform:'translate(-50%,-50%) scale(1.7)',offset:.16},
          {opacity:.75,transform:'translate(-50%,-50%) scale(2.7)',offset:.42},
          {opacity:0,transform:'translate(-50%,-50%) scale(4.2)'}
        ],{duration:380,easing:'ease-out'}));
        smoke.forEach((p,i)=>shotFx.push(rouletteAnimate(p,[
          {opacity:0,transform:'translate(0,0) scale(.25)'},
          {opacity:.62,transform:\`translate(\${-18-i*7}px,\${-8-i*5}px) scale(\${.85+i*.14})\`,offset:.24},
          {opacity:0,transform:\`translate(\${-55-i*18}px,\${-32-i*13}px) scale(\${1.7+i*.26})\`}
        ],{duration:1050+i*170,delay:i*55,easing:'cubic-bezier(.2,.55,.2,1)'})));
        const recoilMotion=rouletteAnimate(motion,[
          {translate:'0px 0px',rotate:'0deg',scale:'1',offset:0},
          {translate:\`\${20*facingSign}px \${7*facingSign}px\`,rotate:'10deg',scale:'1.035',offset:.2},
          {translate:\`\${-5*facingSign}px \${-2*facingSign}px\`,rotate:'-2deg',scale:'1',offset:.55},
          {translate:'0px 0px',rotate:'0deg',scale:'1',offset:1}
        ],{duration:560,easing:'cubic-bezier(.16,.85,.2,1)'});
        await Promise.all([liveRoot._rrHammerMotion||Promise.resolve(),recoilMotion,...shotFx]);
      }else{
        rouletteBlankSound();navigator.vibrate?.(30);
        await Promise.all([liveRoot._rrHammerMotion||Promise.resolve(),rouletteAnimate(motion,[
          {translate:'0px 0px',rotate:'0deg',scale:'1',offset:0},
          {translate:\`\${-3*facingSign}px 0px\`,rotate:'0deg',scale:'1',offset:.42},
          {translate:'0px 0px',rotate:'0deg',scale:'1',offset:1}
        ],{duration:165,easing:'ease-out'})]);
      }
      delete liveRoot._rrHammerMotion;
      const mountedRoot=duelActive?.querySelector(\`[data-roulette-game][data-game-id="\${CSS.escape(gameId)}"]\`);
      const mountedMotion=mountedRoot?.querySelector('[data-roulette-motion]');
      const mountedHammer=mountedRoot?.querySelector('.rr-hammer-photo');
      const mountedCover=mountedRoot?.querySelector('.rr-hammer-cover');
      for(const candidate of new Set([motion,mountedMotion].filter(Boolean))){
        candidate.getAnimations?.().forEach(a=>a.cancel());
        clearShotOffsets(candidate);
      }
      const restoreAngle=Number.isFinite(rouletteVisualRuntime.currentAngle)?rouletteVisualRuntime.currentAngle:base;
      const restoreTurnId=String(rouletteVisualRuntime.displayTurnId||displayedTurnId||actorId||'');
      const finalMotion=mountedMotion||motion;
      if(finalMotion){
        finalMotion.style.transform=rouletteMotionTransform(restoreAngle,rouletteMotionScale());
        finalMotion.dataset.rouletteFacingTurnId=restoreTurnId;
      }
      for(const candidate of new Set([hammer,mountedHammer].filter(Boolean))){candidate.style.opacity='1';candidate.style.transform='rotate(0deg)'}
      for(const candidate of new Set([cover,mountedCover].filter(Boolean)))candidate.style.opacity='0';
      await rouletteWait(live?420:120);
      liveRoot.classList.remove('rr-animation-lock');
      mountedRoot?.classList.remove('rr-animation-lock');
    }
    function rouletteHandleEffects`;

const effectsTailPattern = /      const incomingTurnId=String\(st\.turnId\|\|''\);[\s\S]*?\n    \}\n    async function rouletteAct/;
const authoritativeEffectsTail = `      const incomingTurnId=String(st.turnId||'');
      const displayedTurnId=String(rouletteVisualRuntime.displayTurnId||rouletteVisualRuntime.lastTurnId||'');
      const turnChanged=rouletteVisualRuntime.openingDone&&incomingTurnId&&displayedTurnId!==incomingTurnId;
      const effectKey=\`\${gameId}:\${st.revision}:\${st.lastAction}:\${st.lastOutcome}\`;
      const effectIsNew=Boolean(st.lastAction)&&!rouletteVisualRuntime.processed.has(effectKey);
      const syncNewestTurn=async duration=>{
        const newest=rouletteLatestGame||game;
        const newestTurnId=String(newest?.rouletteState?.turnId||'');
        if(String(newest?.gameId||'')===gameId&&newest?.status==='playing'&&newestTurnId){
          await rouletteRotateToTurn(newest,newest.rouletteState,gameId,{duration,targetTurnId:newestTurnId});
        }
      };

      if(effectIsNew&&st.lastAction==='shoot'){
        rouletteVisualRuntime.processed.add(effectKey);
        rouletteQueueVisual(async()=>{
          await rouletteShotSequence(game,st,gameId);
          await syncNewestTurn(900);
        });
        return;
      }

      if(effectIsNew&&st.lastAction==='pass'){
        rouletteVisualRuntime.processed.add(effectKey);
        rouletteQueueVisual(()=>syncNewestTurn(900));
        return;
      }

      // Repeated authoritative polls are also allowed to repair direction. This
      // closes the gap where bookkeeping says a turn was displayed but a scene
      // replacement or delayed effect left the mounted gun at another angle.
      if(turnChanged&&!rouletteVisualRuntime.busy&&rouletteVisualRuntime.rotationTargetId!==incomingTurnId){
        rouletteQueueVisual(()=>syncNewestTurn(700));
      }

      if(!effectIsNew)return;
      rouletteVisualRuntime.processed.add(effectKey);
      if(st.lastAction==='spin'){
        rouletteQueueVisual(async()=>{
          const liveRoot=duelActive?.querySelector(\`[data-roulette-game][data-game-id="\${CSS.escape(gameId)}"]\`);
          if(!liveRoot)return;
          liveRoot.classList.add('rr-animation-lock');rouletteSpinSound();await rouletteWait(950);liveRoot.classList.remove('rr-animation-lock');
          await syncNewestTurn(700);
        });
      }
    }
    async function rouletteAct`;

const liveCameraShakeRule = ".rr-game.rr-fired{animation:rrLiveCameraShake .42s cubic-bezier(.18,.8,.2,1) 1}";
const stableLiveSceneRule = ".rr-game.rr-fired{animation:none!important}";
const legacyThreeDimensionalGunRule = '.rr-gun-motion{backface-visibility:hidden;transform-style:preserve-3d}';
const flatGunRule = '.rr-gun-motion{backface-visibility:visible;transform-style:flat}';

let html = await readFile(indexUrl, 'utf8');
html = removeObsoleteSceneBlocks(html);

if (!motionTransformPattern.test(html)) throw new Error('Could not locate the roulette transform helper.');
html = html.replace(motionTransformPattern, cleanMotionTransform);
if (!rotateFunctionPattern.test(html)) throw new Error('Could not locate the authoritative turn rotation function.');
html = html.replace(rotateFunctionPattern, authoritativeRotateFunction);
if (!shotSystemPattern.test(html)) throw new Error('Could not locate the roulette firing system.');
html = html.replace(shotSystemPattern, stableShotSystem);
if (!effectsTailPattern.test(html)) throw new Error('Could not locate the roulette visual effect scheduler.');
html = html.replace(effectsTailPattern, authoritativeEffectsTail);

if (html.includes(liveCameraShakeRule)) html = html.replace(liveCameraShakeRule, stableLiveSceneRule);
if (html.includes(legacyThreeDimensionalGunRule)) html = html.replace(legacyThreeDimensionalGunRule, flatGunRule);

for (const id of obsoleteSceneBlockIds) {
  if (html.includes(`id="${id}"`) || html.includes(`id='${id}'`)) throw new Error(`Obsolete scene patch survived: ${id}`);
}
for (const forbidden of [
  'scale(${-scale},${scale})',
  'rouletteOrientToShotActor(',
  'shot actor orientation locked',
  'const shotActorId=String(st?.lastActorId',
  'rouletteMotionTransform(base+10',
  'rouletteMotionTransform(base-2',
  '.rr-game.rr-fired{animation:rrLiveCameraShake',
  'backface-visibility:hidden;transform-style:preserve-3d'
]) {
  if (html.includes(forbidden)) throw new Error(`Conflicting roulette animation survived cleanup: ${forbidden}`);
}
for (const required of [
  'const mountedClaimsTarget=',
  'runtimeClaimsTarget&&mountedClaimsTarget',
  'await rouletteRotateToTurn(latestAtFinish',
  "rouletteDebug('skipped stale shot visual'",
  'const restoreAngle=Number.isFinite(rouletteVisualRuntime.currentAngle)',
  'const displayedTurnId=String(rouletteVisualRuntime.displayTurnId',
  'await syncNewestTurn(900)',
  'Repeated authoritative polls are also allowed to repair direction',
  flatGunRule
]) {
  if (!html.includes(required)) throw new Error(`Authoritative roulette animation is incomplete: ${required}`);
}

await writeFile(indexUrl, html);
console.log(`Cleaned ${obsoleteSceneBlockIds.length} obsolete scene patch IDs; one authoritative turn state now owns all gun direction.`);
