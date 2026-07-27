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

await writeFile(indexUrl, html);
console.log(`Cleaned ${obsoleteSceneBlockIds.length} obsolete scene patch IDs and rebuilt turn rotation with the opening-spin animation path.`);
