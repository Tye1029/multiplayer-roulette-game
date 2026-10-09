import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', root);
const prototypeUrl = new URL('assets/mountain-race/mountain-race.js', root);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', root);
const indexUrl = new URL('index.html', root);
const previewUrl = new URL('mountain-race-preview.html', root);
const marker = 'MOUNTAIN_RACE_FLIP_MOTION_V42';
const oldReplacement = `    if (currentElement.classList.contains('mr-climber') && currentAnimationKey !== nextAnimationKey) {
      currentElement.replaceWith(nextElement.cloneNode(true));
      return;
    }`;
const persistentSetup = `    const animateClimber = currentElement.classList.contains('mr-climber') && currentAnimationKey !== nextAnimationKey;
    const previousClimberRect = animateClimber ? currentElement.getBoundingClientRect() : null;
    // MOUNTAIN_RACE_FLIP_MOTION_V42`;
const loopEnd = `      morphMountainNode(currentChild, nextChild);
      index += 1;
    }
  }`;
const animatedLoopEnd = `      morphMountainNode(currentChild, nextChild);
      index += 1;
    }
    if (animateClimber && previousClimberRect && typeof currentElement.animate === 'function') {
      const nextClimberRect = currentElement.getBoundingClientRect();
      const deltaX = previousClimberRect.left - nextClimberRect.left;
      const deltaY = previousClimberRect.top - nextClimberRect.top;
      const slipping = currentElement.classList.contains('slip');
      const celebrating = currentElement.classList.contains('celebrate');
      const duration = celebrating ? 900 : slipping ? 720 : 680;
      currentElement.getAnimations().forEach(animation => animation.cancel());
      const keyframes = slipping
        ? [
            { translate: deltaX + 'px ' + deltaY + 'px', rotate: '0deg', offset: 0 },
            { translate: (deltaX + 8) + 'px ' + (deltaY * .52) + 'px', rotate: '6deg', offset: .48 },
            { translate: '0px 0px', rotate: '0deg', offset: 1 }
          ]
        : [
            { translate: deltaX + 'px ' + deltaY + 'px', offset: 0 },
            { translate: (deltaX * .22) + 'px ' + (deltaY * .18 - 5) + 'px', offset: .76 },
            { translate: '0px 0px', offset: 1 }
          ];
      const motion = currentElement.animate(keyframes, {
        duration,
        easing: 'cubic-bezier(.2,.72,.22,1)',
        fill: 'both'
      });
      motion.addEventListener('finish', () => motion.cancel(), { once: true });
      const frame = currentElement.querySelector('.mr-motion-frame-0');
      if (frame) {
        frame.style.animation = 'none';
        void frame.offsetWidth;
        frame.style.removeProperty('animation');
      }
    }
  }`;

let [runtime, prototype, css, html, preview] = await Promise.all([
  readFile(runtimeUrl, 'utf8'), readFile(prototypeUrl, 'utf8'), readFile(cssUrl, 'utf8'),
  readFile(indexUrl, 'utf8'), readFile(previewUrl, 'utf8')
]);

for (const [name, source] of [['multiplayer', runtime], ['prototype', prototype]]) {
  if (!source.includes(marker) && (!source.includes(oldReplacement) || !source.includes(loopEnd))) {
    throw new Error(`Summit Sprint V42 could not find ${name} legacy climber replacement.`);
  }
}
if (!runtime.includes(marker)) runtime = runtime.replace(oldReplacement, persistentSetup).replace(loopEnd, animatedLoopEnd);
if (!prototype.includes(marker)) prototype = prototype.replace(oldReplacement, persistentSetup).replace(loopEnd, animatedLoopEnd);

if (!css.includes(marker)) css += String.raw`

/* MOUNTAIN_RACE_FLIP_MOTION_V42
   Legacy parent keyframes are retired. The persistent climber node is animated
   from its measured prior screen rectangle to its measured new rectangle. */
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber:is(.climb-up,.climb-left,.climb-right,.climb-down,.slip,.celebrate) {
  animation: none !important;
  will-change: translate, rotate;
}
[data-mountain-race-mount][data-mr-generated-assets="29"] .mr-climber {
  transition: none !important;
}
`;

html = html.replace(/(?:&visual=\d+)+/g, '&visual=42');
preview = preview.replace(/(?:&visual=\d+)+/g, '&visual=42');
await Promise.all([
  writeFile(runtimeUrl, runtime), writeFile(prototypeUrl, prototype), writeFile(cssUrl, css),
  writeFile(indexUrl, html), writeFile(previewUrl, preview)
]);
console.log('Applied Summit Sprint V42 persistent-node FLIP climbing motion.');
