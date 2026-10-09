// Cosmetic randomness never consumes chamber or bot randomness.
export function animateRoom() {
  const scene = document.getElementById('scene'), lamp = scene.querySelector('.pendant');
  const rotor = document.getElementById('gun'), gun = document.getElementById('recoil');
  const seats = document.getElementById('seats'), reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const between = (a, b) => a + Math.random() * (b - a);
  let frame, last = 0, nextFlicker = performance.now() + between(30000, 55000), flickerAt = -1000;
  let actors = [], width = 1, height = 1, sourceX = 0, sourceY = 0;
  function measure() {
    width = scene.clientWidth; height = scene.clientHeight;
    sourceX = lamp.offsetLeft; sourceY = lamp.offsetTop + lamp.offsetHeight - 4;
  }
  const resize = new ResizeObserver(measure); resize.observe(scene); measure();
  function resetActors() {
    for (const actor of actors) actor.animations.forEach(a => a.cancel());
    actors = [...seats.querySelectorAll('.seat')].map(node => ({ node, figure: node.querySelector('.seat-figure'),
      head: node.querySelector('.head-motion'), next: performance.now() + between(1500, 9000), previous: -1, animations: [] }));
  }
  const observer = new MutationObserver(resetActors); observer.observe(seats, { childList: true }); resetActors();
  function gesture(actor, now) {
    // Different head checks, nods and small posture adjustments, separated by stillness.
    const kind = (actor.previous + 1 + Math.floor(between(0, 3))) % 4;
    actor.previous = kind;
    const direction = Math.random() < .5 ? -1 : 1, amount = between(.7, 1.25);
    const duration = between(2100, 3900);
    const head = kind === 0 ? `rotate(${direction * 1.8 * amount}deg) translateX(${direction * amount}px)`
      : kind === 1 ? `translateY(${1.3 * amount}px) rotate(${direction * .5}deg)`
      : kind === 2 ? `rotate(${direction * .8}deg) translateY(-${amount}px)` : `rotate(${direction * 1.1}deg)`;
    const body = kind === 2 ? `rotate(${direction * .32 * amount}deg) translateY(-${amount * .5}px)`
      : kind === 3 ? `translateX(${direction * amount * .65}px) rotate(${direction * .2}deg)` : 'none';
    const options = { duration, easing: 'ease-in-out' };
    actor.animations = [actor.head.animate([{ transform: 'none' }, { transform: head, offset: .36 },
      { transform: head, offset: .62 }, { transform: 'none' }], options),
      actor.figure.animate([{ transform: 'none' }, { transform: body, offset: .5 }, { transform: 'none' }], options)];
    actor.node.dataset.gesture = ['glance', 'nod', 'settle', 'shift'][kind];
    actor.next = now + duration + between(4500, 13000);
  }
  function draw(now) {
    frame = requestAnimationFrame(draw);
    if (document.hidden || now - last < 48) return;
    last = now;
    const angle = reduce.matches ? 0 : Math.sin(now / 1350) * 1.55 + Math.sin(now / 3100) * .2;
    lamp.style.transform = `translateX(-50%) rotate(${angle}deg)`;
    const shift = -Math.sin(angle * Math.PI / 180) * sourceY;
    // The bulb position and broader projected pool move together.
    scene.style.setProperty('--light-x', `${sourceX + shift}px`);
    scene.style.setProperty('--light-y', `${sourceY}px`);
    scene.style.setProperty('--pool-x', `${sourceX + shift * 5}px`);
    scene.style.setProperty('--shadow-x', `${9 - shift * .9}px`);
    if (now > nextFlicker) { flickerAt = now; nextFlicker = now + between(35000, 65000); }
    const dt = now - flickerAt, dim = !reduce.matches && ((dt > 0 && dt < 65) || (dt > 115 && dt < 155));
    scene.style.setProperty('--lamp-strength', dim ? '.8' : '1');
    const matrix = new DOMMatrixReadOnly(getComputedStyle(rotor).transform);
    const rotation = Math.atan2(matrix.b, matrix.a);
    const incoming = Math.atan2(sourceY - height * .69, sourceX + shift - width * .5);
    const alignment = Math.pow(Math.abs(Math.cos(rotation - incoming + .28)), 18);
    gun.style.setProperty('--glint', (alignment * (dim ? .3 : .52)).toFixed(3));
    gun.style.setProperty('--glint-angle', `${(incoming - rotation) * 180 / Math.PI + 90}deg`);
    gun.style.setProperty('--glint-position', `${47 + shift * 1.2}%`);
    for (const actor of actors) {
      if (reduce.matches || actor.node.classList.contains('eliminated')) {
        actor.animations.forEach(a => a.cancel()); actor.animations = []; actor.next = now + between(3500, 9500);
      } else if (now >= actor.next) gesture(actor, now);
    }
  }
  frame = requestAnimationFrame(draw);
  window.addEventListener('pagehide', () => {
    cancelAnimationFrame(frame); actors.forEach(a => a.animations.forEach(animation => animation.cancel()));
    resize.disconnect(); observer.disconnect();
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted) { resize.observe(scene); observer.observe(seats, { childList: true }); resetActors(); measure(); frame = requestAnimationFrame(draw); }
  });
}
