import '../roulette/arsenal.js';
const arsenal = window.RouletteArsenal;
export function createGun(trace) {
  const root = document.getElementById('recoil'), picture = document.getElementById('gun-photo'), hammer = document.getElementById('gun-hammer');
  let choice = arsenal.selected(), request = 0, frame = 0;
  const animations = new Set();
  function animate(node, keyframes, options) {
    const animation = node.animate(keyframes, { ...options, fill: 'none' });
    animations.add(animation); animation.finished.catch(() => {}).finally(() => animations.delete(animation));
  }
  function stop() { cancelAnimationFrame(frame); for (const animation of animations) animation.cancel(); animations.clear(); root.querySelector('canvas')?.remove(); }
  async function select(id) {
    const next = arsenal.choices.find(c => c.id === id); if (!next) return;
    const token = ++request, photo = new Image(), part = new Image();
    photo.src = arsenal.asset(next); part.src = arsenal.hammerAsset(next);
    try { await Promise.all([photo.decode(), part.decode()]); } catch { trace('gun-load-failed', { id }); return; }
    if (token !== request) return;
    stop(); choice = next; picture.src = photo.src; hammer.src = part.src;
    root.dataset.finish = id; root.dataset.laser = String(!!choice.laser);
    hammer.style.filter = choice.hammerFilter;
    document.getElementById('gun-options').value = id;
    try { localStorage.setItem('rouletteGunPreferenceV1', id); } catch {}
    trace('gun-selected', { id, name: choice.name });
  }
  document.getElementById('gun-options').innerHTML = arsenal.choices.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  document.getElementById('gun-options').value = choice.id;
  function roll(duration = 1350, turns = 4) {
    if (choice.laser) {
      animate(document.getElementById('gun-charge'), [{ filter: 'brightness(.4)' }, { filter: 'brightness(3)', offset: .5 }, { filter: 'brightness(1)' }], { duration }); return;
    }
    cancelAnimationFrame(frame); root.querySelector('canvas')?.remove();
    if (!picture.complete || !picture.naturalWidth) return;
    const canvas = document.createElement('canvas'); canvas.className = 'gun-cylinder'; canvas.width = 160; canvas.height = 96;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const [x, y, w, h] = choice.cyber ? [.56, .085, .107, .295] : [.546, .043, .133, .307];
    canvas.style.cssText = `left:${x * 100}%;top:${y * 100}%;width:${w * 100}%;height:${h * 100}%`;
    root.append(canvas); const start = performance.now();
    function draw(now) {
      const t = Math.min(1, (now - start) / duration), phase = (1 - (1 - t) ** 3) * Math.PI * 2 * turns;
      for (let row = 0; row < 96; row += 2) {
        const sourceY = arsenal.cylinderRow((row + 1) / 96, phase);
        ctx.drawImage(picture, x * picture.naturalWidth, y * picture.naturalHeight + Math.min(h * picture.naturalHeight - 2, sourceY * h * picture.naturalHeight), w * picture.naturalWidth, 2, 0, row, 160, 2);
      }
      if (t < 1 && canvas.isConnected) frame = requestAnimationFrame(draw); else canvas.remove();
    }
    frame = requestAnimationFrame(draw);
  }
  function cock() {
    if (!choice.laser) animate(hammer, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(23deg)', offset: .46 },
      { transform: 'rotate(23deg)', offset: .60 }, { transform: 'rotate(-2.5deg)', offset: .76 }, { transform: 'rotate(0deg)' }], { duration: 420, easing: 'linear' });
    roll(235, 1);
  }
  function strike(live) {
    animate(root, [{ transform: 'translateX(0)' }, { transform: `translateX(${live ? 4 : 1}px) rotate(${live ? -3 : -.5}deg)`, offset: .22 }, { transform: 'translateX(0)' }], { duration: live ? 420 : 160 });
    if (choice.laser) animate(document.getElementById('gun-charge'), [{ opacity: 1 }, { opacity: .1, offset: .2 }, { opacity: 1 }], { duration: 500 });
    if (live) animate(document.getElementById('muzzle-flash'), [{ opacity: 1, transform: 'scale(.5)' }, { opacity: .8, transform: 'scale(1.5)', offset: .2 }, { opacity: 0, transform: 'scale(2)' }], { duration: 240 });
  }
  return { select, stop, roll, cock, strike, selected: () => choice, ready: () => select(choice.id) };
}
