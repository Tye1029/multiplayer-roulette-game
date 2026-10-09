// Presentation randomness is independent of chamber and bot randomness.
export function animateRoom() {
  const scene = document.getElementById('scene'), lamp = scene.querySelector('.pendant');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let frame, last = 0, nextFlicker = performance.now() + 30000 + Math.random() * 25000, flickerAt = -1000;
  function draw(now) {
    frame = requestAnimationFrame(draw);
    if (document.hidden || now - last < 32) return;
    last = now;
    const angle = reduce.matches ? 0 : Math.sin(now / 1100) * 1.65;
    lamp.style.transform = `translateX(-50%) rotate(${angle}deg)`;
    scene.style.setProperty('--lamp-shift', `${angle * 3}px`);
    if (now > nextFlicker) { flickerAt = now; nextFlicker = now + 35000 + Math.random() * 30000; }
    const dt = now - flickerAt, dim = !reduce.matches && ((dt > 0 && dt < 65) || (dt > 115 && dt < 155));
    scene.style.setProperty('--lamp-strength', dim ? '.78' : '1');
  }
  frame = requestAnimationFrame(draw);
  window.addEventListener('pagehide', () => cancelAnimationFrame(frame));
  window.addEventListener('pageshow', event => { if (event.persisted) frame = requestAnimationFrame(draw); });
}
