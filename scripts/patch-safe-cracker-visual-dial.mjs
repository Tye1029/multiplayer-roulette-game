import { readFile, writeFile } from 'node:fs/promises';

const clientUrl = new URL('../assets/safe-cracker/safe-cracker.js', import.meta.url);
const cssUrl = new URL('../assets/safe-cracker/safe-cracker.css', import.meta.url);
const indexUrl = new URL('../index.html', import.meta.url);
const cssStart = '/* SAFE_CRACKER_VISUAL_DIAL_V2_START */';
const cssEnd = '/* SAFE_CRACKER_VISUAL_DIAL_V2_END */';
const jsStart = '// SAFE_CRACKER_DIAL_PHYSICS_V2_START';

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Safe Cracker visual-dial patch could not find ${label}.`);
  return source.replace(before, after);
}

let client = await readFile(clientUrl, 'utf8');
if (!client.includes(jsStart)) {
  client = replaceRequired(
    client,
    '    feedbackFresh: false',
    '    feedbackFresh: false,\n    dialSettleAnimation: null,\n    lastDragDirection: 0',
    'dial runtime state'
  );

  client = replaceRequired(
    client,
    '      return `<span class="sc-dial-number" style="--digit-angle:${angle}deg">${digit}</span>`;',
    '      return `<span class="sc-dial-number${digit === runtime.selected ? \' selected\' : \'\'}" data-sc-digit="${digit}" style="--digit-angle:${angle}deg"><span>${digit}</span></span>`;',
    'engraved dial-number markup'
  );

  const helpers = [
    `  ${jsStart}`,
    '  function cancelDialSettle() {',
    '    const animation = runtime.dialSettleAnimation;',
    '    runtime.dialSettleAnimation = null;',
    '    try { animation?.cancel?.(); } catch {}',
    "    document.querySelector('[data-sc-dial-face]')?.classList.remove('settling');",
    '  }',
    '',
    '  function animateDialSettle(fromRotation, toRotation, direction = 0) {',
    "    const face = document.querySelector('[data-sc-dial-face]');",
    '    if (!face || !Number.isFinite(fromRotation) || !Number.isFinite(toRotation)) return;',
    '    cancelDialSettle();',
    '    face.style.transform = `rotate(${toRotation}deg)`;',
    "    if (Math.abs(toRotation - fromRotation) < .05 || typeof face.animate !== 'function' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;",
    '    const travel = toRotation - fromRotation;',
    '    const motionDirection = Number(direction) || Math.sign(travel) || 1;',
    '    const overshoot = motionDirection * Math.min(5.5, Math.max(2, Math.abs(travel) * .12));',
    "    face.classList.add('settling');",
    '    const animation = face.animate([',
    '      { transform: `rotate(${fromRotation}deg)`, offset: 0 },',
    '      { transform: `rotate(${toRotation + overshoot}deg)`, offset: .72 },',
    '      { transform: `rotate(${toRotation}deg)`, offset: 1 }',
    "    ], { duration: 240, easing: 'cubic-bezier(.18,.78,.22,1)' });",
    '    runtime.dialSettleAnimation = animation;',
    '    const cleanup = () => {',
    '      if (runtime.dialSettleAnimation === animation) runtime.dialSettleAnimation = null;',
    "      face.classList.remove('settling');",
    '      face.style.transform = `rotate(${toRotation}deg)`;',
    '    };',
    "    animation.addEventListener('finish', cleanup, { once: true });",
    "    animation.addEventListener('cancel', cleanup, { once: true });",
    '  }',
    '  // SAFE_CRACKER_DIAL_PHYSICS_V2_END',
    '',
  ].join('\n');

  client = replaceRequired(
    client,
    '  function applyDialVisual() {',
    `${helpers}  function applyDialVisual() {`,
    'dial-physics helper insertion point'
  );

  client = replaceRequired(
    client,
    `  function applyDialVisual() {
    const face = document.querySelector('[data-sc-dial-face]');
    const current = document.querySelector('[data-sc-current]');
    const dial = document.querySelector('[data-sc-dial]');
    if (face) face.style.transform = \`rotate(\${runtime.rotation}deg)\`;
    if (current) current.textContent = String(runtime.selected);
    if (dial) dial.setAttribute('aria-valuenow', String(runtime.selected));
  }`,
    `  function applyDialVisual() {
    const face = document.querySelector('[data-sc-dial-face]');
    const current = document.querySelector('[data-sc-current]');
    const dial = document.querySelector('[data-sc-dial]');
    if (face) face.style.transform = \`rotate(\${runtime.rotation}deg)\`;
    if (current) current.textContent = String(runtime.selected);
    document.querySelectorAll('[data-sc-digit]').forEach(number => {
      number.classList.toggle('selected', Number(number.dataset.scDigit) === Number(runtime.selected));
    });
    if (dial) {
      dial.setAttribute('aria-valuenow', String(runtime.selected));
      dial.setAttribute('aria-valuetext', \`Number \${runtime.selected}\`);
    }
  }`,
    'selected-number visual synchronization'
  );

  client = replaceRequired(
    client,
    `  function setSelected(digit, { sound = true } = {}) {
    const next = modulo(Number(digit) || 0, 10);
    runtime.selected = next;
    runtime.rotation = nearestRotationForDigit(next, runtime.rotation);
    runtime.lastDetent = next;
    applyDialVisual();
    if (sound) playDetent(next);
  }`,
    `  function setSelected(digit, { sound = true } = {}) {
    const next = modulo(Number(digit) || 0, 10);
    const previousRotation = runtime.rotation;
    runtime.selected = next;
    runtime.rotation = nearestRotationForDigit(next, runtime.rotation);
    runtime.lastDetent = next;
    applyDialVisual();
    animateDialSettle(previousRotation, runtime.rotation, Math.sign(runtime.rotation - previousRotation));
    if (sound) playDetent(next);
  }`,
    'button and keyboard dial settling'
  );

  client = replaceRequired(
    client,
    `        resumeAudio();
        runtime.dragging = true;`,
    `        resumeAudio();
        cancelDialSettle();
        runtime.lastDragDirection = 0;
        runtime.dragging = true;`,
    'pointer-down settle cancellation'
  );

  client = replaceRequired(
    client,
    `        runtime.lastPointerAngle = angle;
        runtime.rotation += delta;`,
    `        runtime.lastPointerAngle = angle;
        if (Math.abs(delta) > .08) runtime.lastDragDirection = Math.sign(delta);
        runtime.rotation += delta;`,
    'drag-direction tracking'
  );

  client = replaceRequired(
    client,
    `        runtime.dragging = false;
        runtime.pointerId = null;
        dial.classList.remove('dragging');
        runtime.rotation = nearestRotationForDigit(runtime.selected, runtime.rotation);
        applyDialVisual();
        event.preventDefault();`,
    `        runtime.dragging = false;
        runtime.pointerId = null;
        dial.classList.remove('dragging');
        const releasedRotation = runtime.rotation;
        runtime.rotation = nearestRotationForDigit(runtime.selected, runtime.rotation);
        applyDialVisual();
        animateDialSettle(releasedRotation, runtime.rotation, runtime.lastDragDirection);
        runtime.lastDragDirection = 0;
        event.preventDefault();`,
    'physical release and snap settle'
  );
}
await writeFile(clientUrl, client);

const visualDial = String.raw`${cssStart}
.sc-dial-wrap {
  width: min(74vw, 305px);
  height: min(74vw, 305px);
  max-width: 305px;
  max-height: 305px;
  margin: 2px auto 5px;
  isolation: isolate;
  filter: drop-shadow(0 18px 18px rgba(0,0,0,.42));
}

.sc-dial-wrap::before {
  content: '';
  position: absolute;
  z-index: -1;
  inset: -17px;
  border: 1px solid rgba(210,220,222,.32);
  border-radius: 50%;
  background:
    radial-gradient(circle at 34% 25%, rgba(255,255,255,.17), transparent 17%),
    repeating-conic-gradient(from 1deg, rgba(255,255,255,.035) 0 1deg, transparent 1deg 8deg),
    radial-gradient(circle, #141b1f 0 71%, #798489 72% 74%, #232c30 75% 82%, #080c0e 83% 100%);
  box-shadow:
    inset 0 0 0 5px rgba(5,8,9,.9),
    inset 0 0 30px rgba(0,0,0,.78),
    0 0 0 2px rgba(109,122,127,.2),
    0 15px 24px rgba(0,0,0,.5);
}

.sc-dial-wrap::after {
  content: '';
  position: absolute;
  z-index: 7;
  left: 50%;
  top: -25px;
  width: 54px;
  height: 28px;
  transform: translateX(-50%);
  border: 1px solid #0a0e10;
  border-radius: 8px 8px 4px 4px;
  background:
    linear-gradient(180deg, rgba(255,255,255,.2), transparent 34%),
    linear-gradient(90deg, #171e21, #677277 48%, #252d30 72%, #0d1214);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.18), 0 5px 8px rgba(0,0,0,.55);
}

.sc-dial-pointer {
  top: -13px;
  z-index: 9;
  width: 20px;
  height: 38px;
  border: 0;
  border-radius: 4px 4px 8px 8px;
  transform: translateX(-50%);
  clip-path: polygon(12% 0, 88% 0, 75% 48%, 50% 100%, 25% 48%);
  background:
    linear-gradient(90deg, #5f431b 0%, #f3d894 42%, #b98131 62%, #4b3215 100%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.45), 0 3px 4px rgba(0,0,0,.7);
  filter: drop-shadow(0 2px 2px rgba(0,0,0,.7)) drop-shadow(0 0 7px rgba(237,196,111,.22));
}

.sc-dial {
  inset: 6px;
  border-radius: 50%;
  transition: transform .12s ease, filter .12s ease;
  filter: drop-shadow(0 12px 12px rgba(0,0,0,.56));
}

.sc-dial.dragging {
  transform: scale(.992);
  filter: drop-shadow(0 8px 9px rgba(0,0,0,.62));
}

.sc-dial-face {
  overflow: hidden;
  border: 9px solid #0a0f11;
  background:
    radial-gradient(circle at 34% 25%, rgba(255,255,255,.32), transparent 17%),
    radial-gradient(circle at 67% 76%, rgba(0,0,0,.32), transparent 33%),
    radial-gradient(circle, #20292d 0 25%, #11181b 26% 36%, transparent 37%),
    repeating-conic-gradient(from -1deg, #8e713a 0deg 1.2deg, #33291b 1.2deg 2.5deg, #1b2327 2.5deg 36deg),
    radial-gradient(circle, #68757a 0 66%, #141a1d 67% 72%, #ae8540 73% 78%, #101619 79% 100%);
  box-shadow:
    inset 0 0 0 3px #849095,
    inset 0 0 0 7px rgba(17,23,26,.92),
    inset 0 0 31px rgba(0,0,0,.8),
    inset 11px 10px 16px rgba(255,255,255,.035),
    0 0 0 2px rgba(177,188,191,.12);
  transition: transform .2s cubic-bezier(.2,.82,.2,1), box-shadow .14s ease, filter .14s ease;
}

.sc-dial-face::before {
  content: '';
  position: absolute;
  inset: 5px;
  border-radius: 50%;
  pointer-events: none;
  background:
    repeating-conic-gradient(from -1.8deg, rgba(247,226,170,.78) 0deg .75deg, transparent .75deg 3.6deg),
    repeating-conic-gradient(from -1.8deg, rgba(255,239,193,.96) 0deg 1.25deg, transparent 1.25deg 36deg);
  -webkit-mask: radial-gradient(circle, transparent 0 69%, #000 70% 78%, transparent 79% 100%);
  mask: radial-gradient(circle, transparent 0 69%, #000 70% 78%, transparent 79% 100%);
  opacity: .86;
  filter: drop-shadow(0 1px 0 rgba(0,0,0,.9));
}

.sc-dial-face::after {
  content: '';
  position: absolute;
  inset: 11px;
  border-radius: 50%;
  pointer-events: none;
  background:
    linear-gradient(118deg, transparent 0 25%, rgba(255,255,255,.085) 36%, transparent 47%),
    radial-gradient(circle at 50% 50%, transparent 0 57%, rgba(218,171,83,.16) 58% 60%, transparent 61%);
  mix-blend-mode: screen;
}

.sc-dial.dragging .sc-dial-face {
  box-shadow:
    inset 0 0 0 3px #919da1,
    inset 0 0 0 7px rgba(17,23,26,.92),
    inset 0 0 38px rgba(0,0,0,.86),
    0 0 14px rgba(208,170,91,.1);
}

.sc-dial-face.settling {
  will-change: transform;
}

.sc-dial-number {
  --radius: 112px;
  width: 32px;
  height: 32px;
  margin: -16px;
  color: #d9c38f;
  font-size: 1rem;
  text-shadow: 0 2px 2px #000, 0 -1px 0 rgba(255,255,255,.12);
}

.sc-dial-number > span {
  width: 27px;
  height: 27px;
  display: grid;
  place-items: center;
  border: 1px solid transparent;
  border-radius: 50%;
  background: rgba(4,7,8,.2);
  box-shadow: inset 0 1px 2px rgba(0,0,0,.72);
  transition: color .13s ease, transform .13s ease, background .13s ease, border-color .13s ease, box-shadow .13s ease;
}

.sc-dial-number.selected > span {
  color: #fff4ca;
  transform: scale(1.14) translateY(-1px);
  border-color: rgba(244,212,134,.72);
  background: radial-gradient(circle, rgba(196,142,51,.28), rgba(20,15,7,.62));
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.22),
    inset 0 0 9px rgba(244,212,134,.18),
    0 0 10px rgba(244,212,134,.3);
  text-shadow: 0 2px 2px #000, 0 0 8px rgba(255,228,153,.55);
}

.sc-dial-hub {
  width: 40%;
  border: 7px solid #0d1214;
  background:
    radial-gradient(circle at 34% 26%, rgba(255,255,255,.34), transparent 18%),
    radial-gradient(circle, #8c979b 0 12%, #536066 24%, #263136 48%, #111719 73%);
  box-shadow:
    inset 0 0 17px rgba(0,0,0,.78),
    inset 0 1px 0 rgba(255,255,255,.2),
    0 0 0 3px #9b7638,
    0 0 0 6px #171d20,
    0 9px 14px rgba(0,0,0,.62);
}

.sc-current-number {
  width: 68px;
  height: 68px;
  border: 1px solid rgba(230,198,126,.5);
  color: #fff2bd;
  background:
    radial-gradient(circle at 40% 28%, rgba(255,255,255,.1), transparent 28%),
    radial-gradient(circle, #171407, #080b0c 72%);
  box-shadow:
    inset 0 0 15px rgba(0,0,0,.8),
    inset 0 0 8px rgba(221,174,79,.12),
    0 1px 0 rgba(255,255,255,.12);
  font-size: 2.05rem;
  letter-spacing: -.04em;
}

.sc-step-controls button {
  border-color: #0a0e10;
  color: #f1d28b;
  background:
    linear-gradient(180deg, rgba(255,255,255,.17), transparent 35%),
    linear-gradient(#4d595e, #20282c 68%, #111619);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.2),
    inset 0 -4px 8px rgba(0,0,0,.25),
    0 4px 0 #090d0f,
    0 7px 10px rgba(0,0,0,.35);
}

@media (max-width: 700px) {
  .sc-dial-wrap {
    width: min(76vw, 296px);
    height: min(76vw, 296px);
  }
  .sc-dial-wrap::before { inset: -12px; }
  .sc-dial-wrap::after { top: -21px; width: 48px; height: 25px; }
  .sc-dial-pointer { top: -10px; width: 18px; height: 34px; }
  .sc-dial-number { --radius: min(28.2vw, 108px); }
}

@media (max-height: 720px) and (max-width: 700px) {
  .sc-dial-wrap { width: min(61vw, 240px); height: min(61vw, 240px); }
  .sc-dial-number { --radius: min(23.3vw, 86px); }
  .sc-current-number { width: 58px; height: 58px; font-size: 1.72rem; }
}
${cssEnd}`;

let css = await readFile(cssUrl, 'utf8');
const markerPattern = /\/\* SAFE_CRACKER_VISUAL_DIAL_V2_START \*\/[\s\S]*?\/\* SAFE_CRACKER_VISUAL_DIAL_V2_END \*\/\s*/m;
css = css.replace(markerPattern, '').trimEnd() + `\n\n${visualDial}\n`;
await writeFile(cssUrl, css);

let html = await readFile(indexUrl, 'utf8');
html = html.replaceAll('/assets/safe-cracker/safe-cracker.css?v=5', '/assets/safe-cracker/safe-cracker.css?v=6');
html = html.replaceAll('/assets/safe-cracker/safe-cracker.js?v=5', '/assets/safe-cracker/safe-cracker.js?v=6');
await writeFile(indexUrl, html);

console.log('Applied Safe Cracker visual pass 2: precision dial materials, engraved selection, and tactile snap-settle motion.');
