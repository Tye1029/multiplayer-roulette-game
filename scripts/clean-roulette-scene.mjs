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

const oldMotionTransform = `    function rouletteMotionTransform(angle,scale=rouletteMotionScale(),x='-50%',y='-50%'){
      const normalized=((Number(angle)||0)%360+360)%360;
      if(normalized>=145&&normalized<=215){
        const local=normalized-180;
        return \`translate(\${x},\${y}) rotate(\${local}deg) scale(\${-scale},\${scale})\`;
      }
      return \`translate(\${x},\${y}) rotate(\${angle}deg) scale(\${scale})\`;
    }`;

const newMotionTransform = `    function rouletteMotionTransform(angle,scale=rouletteMotionScale(),x='-50%',y='-50%'){
      return \`translate(\${x},\${y}) rotate(\${Number(angle)||0}deg) scale(\${scale})\`;
    }`;

const oldTurnTransition = `      liveRoot.classList.add('rr-animation-lock');
      try{
        motion.getAnimations?.().forEach(a=>a.cancel());
        await rouletteAnimate(motion,[{opacity:1},{opacity:.12}],{duration:120,easing:'ease-out',fill:'forwards'});
        motion.getAnimations?.().forEach(a=>a.cancel());
        motion.style.transform=rouletteMotionTransform(target,scale);
        await Promise.all([
          rouletteAnimate(motion,[{opacity:.12},{opacity:1}],{duration:180,easing:'ease-in',fill:'forwards'}),
          rouletteRotationGlint(glint,300,.18)
        ]);
      }finally{`;

const newTurnTransition = `      liveRoot.classList.add('rr-animation-lock');
      try{
        motion.getAnimations?.().forEach(a=>a.cancel());
        motion.style.opacity='1';
        const animatedTarget=from+delta;
        await Promise.all([
          rouletteAnimate(motion,[
            {transform:rouletteMotionTransform(from,scale)},
            {transform:rouletteMotionTransform(animatedTarget,scale)}
          ],{duration,easing:'cubic-bezier(.22,.58,.12,1)',fill:'forwards'}),
          rouletteRotationGlint(glint,duration,.18)
        ]);
      }finally{`;

const oldTurnFinalize = `      }finally{
        const latestAtFinish=rouletteLatestGame;
        const stillAuthoritative=String(latestAtFinish?.gameId||'')===String(gameId)&&
          latestAtFinish?.status==='playing'&&
          String(latestAtFinish?.rouletteState?.turnId||'')===requestedTurnId;
        if(epoch===rouletteVisualRuntime.rotationEpoch&&stillAuthoritative){
          motion.getAnimations?.().forEach(a=>a.cancel());
          motion.style.transform=rouletteMotionTransform(target,scale);
          rouletteVisualRuntime.currentAngle=target;
          rouletteVisualRuntime.angleHydrated=true;
          rouletteVisualRuntime.lastTurnId=requestedTurnId;
          rouletteVisualRuntime.displayTurnId=requestedTurnId;
          rouletteVisualRuntime.rotationTargetId='';
        }else if(epoch===rouletteVisualRuntime.rotationEpoch){
          motion.getAnimations?.().forEach(a=>a.cancel());
          motion.style.transform=rouletteMotionTransform(rouletteVisualRuntime.currentAngle,scale);
          rouletteVisualRuntime.rotationTargetId='';
          rouletteDebug('cancelled stale turn rotation finish',{requestedTurnId,authoritativeTurnId:String(latestAtFinish?.rouletteState?.turnId||'')});
        }
        if(glint){glint.getAnimations?.().forEach(a=>a.cancel());glint.style.opacity='0';glint.style.backgroundPosition='116% 0'}
        liveRoot.classList.remove('rr-animation-lock');
      }`;

const replacementSafeTurnFinalize = `      }finally{
        const latestAtFinish=rouletteLatestGame;
        const stillAuthoritative=String(latestAtFinish?.gameId||'')===String(gameId)&&
          latestAtFinish?.status==='playing'&&
          String(latestAtFinish?.rouletteState?.turnId||'')===requestedTurnId;
        const mountedRoot=duelActive?.querySelector(\`[data-roulette-game][data-game-id="\${CSS.escape(gameId)}"]\`);
        const mountedMotion=mountedRoot?.querySelector('[data-roulette-motion]');
        const mountedGlint=mountedRoot?.querySelector('.rr-metal-glint');
        const applyAngleToMountedGun=angle=>{
          const finalMotion=mountedMotion||motion;
          for(const candidate of new Set([motion,mountedMotion].filter(Boolean))){
            candidate.getAnimations?.().forEach(a=>a.cancel());
            candidate.style.removeProperty('translate');
            candidate.style.removeProperty('rotate');
            candidate.style.removeProperty('scale');
          }
          if(finalMotion)finalMotion.style.transform=rouletteMotionTransform(angle,rouletteMotionScale());
        };
        if(epoch===rouletteVisualRuntime.rotationEpoch&&stillAuthoritative){
          applyAngleToMountedGun(target);
          rouletteVisualRuntime.currentAngle=target;
          rouletteVisualRuntime.angleHydrated=true;
          rouletteVisualRuntime.lastTurnId=requestedTurnId;
          rouletteVisualRuntime.displayTurnId=requestedTurnId;
          rouletteVisualRuntime.rotationTargetId='';
        }else if(epoch===rouletteVisualRuntime.rotationEpoch){
          applyAngleToMountedGun(rouletteVisualRuntime.currentAngle);
          rouletteVisualRuntime.rotationTargetId='';
          rouletteDebug('cancelled stale turn rotation finish',{requestedTurnId,authoritativeTurnId:String(latestAtFinish?.rouletteState?.turnId||'')});
        }
        for(const candidate of new Set([glint,mountedGlint].filter(Boolean))){
          candidate.getAnimations?.().forEach(a=>a.cancel());
          candidate.style.opacity='0';
          candidate.style.backgroundPosition='116% 0';
        }
        liveRoot.classList.remove('rr-animation-lock');
        mountedRoot?.classList.remove('rr-animation-lock');
      }`;

const shotSystemPattern = /\n    (?:async function rouletteOrientToShotActor\(game,st,gameId\)\{[\s\S]*?\n    \}\n    )?async function rouletteShotSequence\(game,st,gameId\)\{[\s\S]*?\n    \}\n    function rouletteHandleEffects/;

const replacementShotSystem = `
    async function rouletteShotSequence(game,st,gameId){
      // Firing never rewrites the authoritative facing transform. Recoil uses
      // additive individual transform properties so the 176deg opponent pose
      // never crosses the browser's +/-180deg matrix interpolation boundary.
      const liveRoot=duelActive?.querySelector(\`[data-roulette-game][data-game-id="\${CSS.escape(gameId)}"]\`);
      const motion=liveRoot?.querySelector('[data-roulette-motion]');
      const hammer=liveRoot?.querySelector('.rr-hammer-photo');
      const cover=liveRoot?.querySelector('.rr-hammer-cover');
      const glint=liveRoot?.querySelector('.rr-metal-glint');
      const flash=liveRoot?.querySelector('.rr-shot-flash');
      const smoke=[...(liveRoot?.querySelectorAll('.rr-shot-smoke i')||[])];
      if(!liveRoot||!motion)return;
      const shotActorId=String(st?.lastActorId||rouletteVisualRuntime.displayTurnId||st?.turnId||'');
      const base=shotActorId?rouletteAngleForPlayer(game,shotActorId):(Number.isFinite(rouletteVisualRuntime.currentAngle)?rouletteVisualRuntime.currentAngle:rouletteOpeningFinalAngle(game,st));
      const scale=rouletteMotionScale();
      const facingSign=Math.cos((base+4)*Math.PI/180)>=0?1:-1;
      const clearShotOffsets=element=>{
        if(!element)return;
        element.style.removeProperty('translate');
        element.style.removeProperty('rotate');
        element.style.removeProperty('scale');
      };
      rouletteVisualRuntime.currentAngle=base;
      rouletteVisualRuntime.angleHydrated=true;
      motion.style.transform=rouletteMotionTransform(base,scale);
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
      const finalMotion=mountedMotion||motion;
      if(finalMotion)finalMotion.style.transform=rouletteMotionTransform(base,rouletteMotionScale());
      for(const candidate of new Set([hammer,mountedHammer].filter(Boolean))){candidate.style.opacity='1';candidate.style.transform='rotate(0deg)'}
      for(const candidate of new Set([cover,mountedCover].filter(Boolean)))candidate.style.opacity='0';
      await rouletteWait(live?420:120);
      liveRoot.classList.remove('rr-animation-lock');
      mountedRoot?.classList.remove('rr-animation-lock');
    }
    function rouletteHandleEffects`;

const liveCameraShakeRule = ".rr-game.rr-fired{animation:rrLiveCameraShake .42s cubic-bezier(.18,.8,.2,1) 1}";
const stableLiveSceneRule = ".rr-game.rr-fired{animation:none!important}";

let html = await readFile(indexUrl, 'utf8');
html = removeObsoleteSceneBlocks(html);

if (html.includes(oldMotionTransform)) {
  html = html.replace(oldMotionTransform, newMotionTransform);
} else if (!html.includes(newMotionTransform)) {
  throw new Error('Could not locate the roulette gun transform helper to cleanly rebuild it.');
}

if (html.includes(oldTurnTransition)) {
  html = html.replace(oldTurnTransition, newTurnTransition);
} else if (!html.includes(newTurnTransition)) {
  throw new Error('Could not locate the roulette turn transition to cleanly rebuild it.');
}

if (html.includes(oldTurnFinalize)) {
  html = html.replace(oldTurnFinalize, replacementSafeTurnFinalize);
} else if (!html.includes(replacementSafeTurnFinalize)) {
  throw new Error('Could not make the turn rotation replacement-safe.');
}

if (shotSystemPattern.test(html)) {
  html = html.replace(shotSystemPattern, replacementShotSystem);
} else if (!html.includes('additive individual transform properties')) {
  throw new Error('Could not rebuild the opponent-safe firing animation.');
}

if (html.includes(liveCameraShakeRule)) {
  html = html.replace(liveCameraShakeRule, stableLiveSceneRule);
} else if (!html.includes(stableLiveSceneRule)) {
  throw new Error('Could not isolate live-shot recoil from the lamp and room root.');
}

for (const id of obsoleteSceneBlockIds) {
  if (html.includes(`id="${id}"`) || html.includes(`id='${id}'`)) {
    throw new Error(`Obsolete scene patch still exists after cleanup: ${id}`);
  }
}

if (/scale\(\$\{-scale\},\$\{scale\}\)/.test(html)) {
  throw new Error('The old mirrored gun transform is still present.');
}
if (html.includes("rouletteAnimate(motion,[{opacity:1},{opacity:.12}]")) {
  throw new Error('The old fade-and-swap turn animation is still present.');
}
if (html.includes('rouletteOrientToShotActor(') || html.includes('shot actor orientation locked')) {
  throw new Error('A shot effect can still independently rotate the gun.');
}
if (html.includes('rouletteMotionTransform(base+10') || html.includes('rouletteMotionTransform(base-2')) {
  throw new Error('Shot recoil still crosses the opponent-facing 180 degree boundary.');
}
if (html.includes(liveCameraShakeRule)) {
  throw new Error('Live shots can still move the lamp and whole room.');
}
if (!html.includes('const mountedMotion=mountedRoot?.querySelector')) {
  throw new Error('A completed turn rotation can still finish on a detached gun node.');
}

await writeFile(indexUrl, html);
console.log(`Cleaned ${obsoleteSceneBlockIds.length} obsolete scene patch IDs; opponent-facing shots use additive recoil and never move the lamp root.`);
