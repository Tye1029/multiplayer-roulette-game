// All cast motion and atmosphere are cosmetic; game randomness is never sampled here.
export function animateRoom() {
  const scene = document.getElementById("scene"),
    lamp = scene.querySelector(".pendant");
  const rotor = document.getElementById("gun"),
    gun = document.getElementById("recoil"),
    seats = document.getElementById("seats");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)"),
    between = (a, b) => a + Math.random() * (b - a);
  const effects = document.createElement("div");
  effects.className = "scene-effects";
  effects.setAttribute("aria-hidden", "true");
  scene.append(effects);
  let frame,
    last = 0,
    actors = [],
    width = 1,
    height = 1,
    sourceX = 0,
    sourceY = 0;
  let nextGesture = 0,
    nextStatic = performance.now() + between(12000, 22000),
    nextBreeze = performance.now() + between(8000, 16000),
    breezeAt = -10000,
    breezeDuration = 7000;
  let nextFlicker = performance.now() + between(30000, 55000),
    flickerAt = -1000;
  const counts = { gestures: 0, puffs: 0, static: 0 };
  function measure() {
    width = scene.clientWidth;
    height = scene.clientHeight;
    sourceX = lamp.offsetLeft;
    sourceY = lamp.offsetTop + lamp.offsetHeight - 4;
  }
  const resize = new ResizeObserver(measure);
  resize.observe(scene);
  measure();
  function stopActor(a) {
    for (const animation of a.animations) animation.cancel();
    a.animations.clear();
  }
  function resetActors() {
    actors.forEach(stopActor);
    effects.replaceChildren();
    actors = [...seats.querySelectorAll(".seat")].map((node) => {
      const tip = node.querySelector(".cigarette-tip");
      let emitter = null;
      if (tip) {
        emitter = document.createElement("div");
        emitter.className = "cigarette-effects";
        emitter.dataset.player = node.dataset.player;
        emitter.innerHTML = `<i class="cigarette-ember"></i><svg class="smoke-plume" viewBox="0 0 44 82"><defs><linearGradient id="smoke-${node.dataset.player}" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#cbd0d8" stop-opacity="0"/><stop offset=".5" stop-color="#cbd0d8" stop-opacity=".9"/><stop offset="1" stop-color="#cbd0d8" stop-opacity=".2"/></linearGradient></defs><path stroke="url(#smoke-${node.dataset.player})" d="M18 80 C11 67 29 61 22 48 S10 32 21 19 S30 7 25 2"/></svg><i class="cigarette-ash"></i>`;
        effects.append(emitter);
      }
      return {
        node,
        head: node.querySelector(".head-motion"),
        hand: node.querySelector(".hand-motion"),
        foot: node.querySelector(".foot-motion"),
        figure: node.querySelector(".seat-figure"),
        noise: node.querySelector(".tv-interference"),
        tip,
        emitter,
        animations: new Set(),
        next: performance.now() + between(2000, 7000),
        nextPuff: performance.now() + between(500, 2200),
        previous: null,
        gestures: 0,
        puffs: 0,
        static: 0,
      };
    });
    nextGesture = performance.now() + between(2000, 4500);
  }
  const observer = new MutationObserver(resetActors);
  observer.observe(seats, { childList: true });
  resetActors();
  function perform(a, node, frames, options) {
    const animation = node.animate(frames, options);
    a.animations.add(animation);
    animation.finished
      .catch(() => {})
      .finally(() => a.animations.delete(animation));
  }
  function puff(a, now) {
    perform(
      a,
      a.emitter.querySelector(".smoke-plume"),
      [
        { opacity: 0, transform: "translate(0,3px)" },
        { opacity: 0.7, offset: 0.2 },
        { opacity: 0.45, offset: 0.6 },
        { opacity: 0, transform: "translate(5px,-9px)" },
      ],
      { duration: between(3200, 4200), easing: "ease-out" },
    );
    a.nextPuff = now + between(7500, 13500);
    a.puffs++;
    counts.puffs++;
  }
  function gesture(a, now) {
    const options = [
      "neck-stretch",
      "glance",
      a.tip ? "ash-flick" : "finger-tap",
    ];
    if (a.node.dataset.direction !== "up") options.push("foot-tap");
    if (a.node.dataset.scratch === "true") options.push("scratch");
    const choices = options.filter((x) => x !== a.previous),
      kind = choices[Math.floor(Math.random() * choices.length)];
    const sign = Math.random() < 0.5 ? -1 : 1;
    let duration = 2000;
    if (kind === "neck-stretch") {
      duration = between(2700, 3400);
      perform(
        a,
        a.head,
        [
          { transform: "rotate(0deg)" },
          { transform: `rotate(${sign * -5}deg)`, offset: 0.25 },
          { transform: `rotate(${sign * -5}deg)`, offset: 0.38 },
          { transform: `rotate(${sign * 4}deg)`, offset: 0.65 },
          { transform: "rotate(0deg)" },
        ],
        { duration, easing: "ease-in-out" },
      );
    } else if (kind === "glance") {
      duration = between(1700, 2300);
      perform(
        a,
        a.head,
        [
          { transform: "translateX(0)" },
          {
            transform: `translateX(${sign * 2}px) rotate(${sign * 2}deg)`,
            offset: 0.45,
          },
          { transform: "translateX(0)" },
        ],
        { duration, easing: "ease-in-out" },
      );
    } else if (kind === "foot-tap") {
      duration = 1050;
      perform(
        a,
        a.foot,
        [
          { transform: "rotate(0deg)" },
          { transform: "rotate(-3deg)", offset: 0.13 },
          { transform: "rotate(0deg)", offset: 0.27 },
          { transform: "rotate(-2.4deg)", offset: 0.43 },
          { transform: "rotate(0deg)", offset: 0.57 },
          { transform: "rotate(-2deg)", offset: 0.74 },
          { transform: "rotate(0deg)" },
        ],
        { duration, easing: "ease-in-out" },
      );
    } else if (kind === "scratch") {
      duration = 1450;
      perform(
        a,
        a.hand,
        [
          { transform: "translate(0,0)" },
          { transform: "translate(-3px,1px)", offset: 0.17 },
          { transform: "translate(0,0)", offset: 0.32 },
          { transform: "translate(-3px,1px)", offset: 0.49 },
          { transform: "translate(0,0)", offset: 0.65 },
          { transform: "translate(-2px,1px)", offset: 0.82 },
          { transform: "translate(0,0)" },
        ],
        { duration, easing: "ease-in-out" },
      );
    } else {
      duration = kind === "ash-flick" ? 800 : 1150;
      perform(
        a,
        a.hand,
        [
          { transform: "rotate(0deg)" },
          {
            transform: `rotate(${kind === "ash-flick" ? -3 : -1.5}deg)`,
            offset: 0.22,
          },
          { transform: "rotate(2deg)", offset: 0.4 },
          { transform: "rotate(0deg)", offset: 0.6 },
          { transform: "rotate(-1deg)", offset: 0.78 },
          { transform: "rotate(0deg)" },
        ],
        { duration, easing: "ease-in-out" },
      );
      if (a.tip)
        perform(
          a,
          a.emitter.querySelector(".cigarette-ash"),
          [
            { opacity: 0, transform: "translate(0,0)" },
            { opacity: 0.7, offset: 0.25 },
            { opacity: 0, transform: "translate(7px,32px)" },
          ],
          { duration: 1100, delay: 200, easing: "ease-out" },
        );
    }
    a.node.dataset.gesture = kind;
    a.previous = kind;
    a.gestures++;
    counts.gestures++;
    a.next = now + duration + between(9000, 18000);
    nextGesture = now + duration + between(2200, 5000);
  }
  function interference(a) {
    perform(
      a,
      a.noise,
      [
        { opacity: 0, backgroundPosition: "0 0" },
        { opacity: 0.24, backgroundPosition: "3px 9px", offset: 0.2 },
        { opacity: 0.16, backgroundPosition: "-4px 19px", offset: 0.7 },
        { opacity: 0, backgroundPosition: "0 30px" },
      ],
      { duration: between(260, 460), easing: "linear" },
    );
    a.static++;
    counts.static++;
  }
  function draw(now) {
    frame = requestAnimationFrame(draw);
    if (document.hidden || now - last < 33) return;
    last = now;
    if (now > nextBreeze) {
      breezeAt = now;
      breezeDuration = between(5500, 8500);
      nextBreeze = now + breezeDuration + between(18000, 30000);
    }
    const t = (now - breezeAt) / breezeDuration,
      envelope = t >= 0 && t < 1 ? Math.sin(Math.PI * t) : 0;
    const angle = reduce.matches
      ? 0
      : Math.sin(now / 1550) * (1.6 + envelope * 1.8) +
        Math.sin(now / 4100) * 0.35;
    lamp.style.transform = `translateX(-50%) rotate(${angle}deg)`;
    const shift = -Math.sin((angle * Math.PI) / 180) * sourceY;
    scene.style.setProperty("--light-x", `${sourceX + shift}px`);
    scene.style.setProperty("--light-y", `${sourceY}px`);
    scene.style.setProperty("--pool-x", `${sourceX + shift * 7}px`);
    scene.style.setProperty("--shadow-x", `${Math.round(9 - shift * 1.2)}px`);
    if (now > nextFlicker) {
      flickerAt = now;
      nextFlicker = now + between(35000, 65000);
    }
    const dt = now - flickerAt,
      dim = !reduce.matches && ((dt > 0 && dt < 65) || (dt > 115 && dt < 155));
    scene.style.setProperty("--lamp-strength", dim ? ".84" : "1");
    const matrix = new DOMMatrixReadOnly(getComputedStyle(rotor).transform),
      rotation = Math.atan2(matrix.b, matrix.a),
      incoming = Math.atan2(
        sourceY - height * 0.69,
        sourceX + shift - width * 0.5,
      );
    const alignment = Math.pow(
      Math.abs(Math.cos(rotation - incoming + 0.28)),
      18,
    );
    gun.style.setProperty(
      "--glint",
      (alignment * (dim ? 0.3 : 0.52)).toFixed(3),
    );
    gun.style.setProperty(
      "--glint-angle",
      `${((incoming - rotation) * 180) / Math.PI + 90}deg`,
    );
    gun.style.setProperty("--glint-position", `${47 + shift * 1.2}%`);
    const bounds = effects.getBoundingClientRect(),
      living = [];
    for (const a of actors) {
      const dead = a.node.classList.contains("eliminated");
      if (a.emitter) {
        const tip = a.tip.getBoundingClientRect();
        a.emitter.style.left = `${tip.left - bounds.left}px`;
        a.emitter.style.top = `${tip.top - bounds.top}px`;
        a.emitter.hidden = dead;
      }
      if (dead || reduce.matches) {
        stopActor(a);
        a.next = now + between(3000, 7000);
        a.nextPuff = now + between(1200, 3500);
        continue;
      }
      living.push(a);
      if (a.tip && now >= a.nextPuff) puff(a, now);
    }
    const eligible = living.filter((a) => now >= a.next);
    if (now >= nextGesture && eligible.length)
      gesture(eligible[Math.floor(Math.random() * eligible.length)], now);
    if (now >= nextStatic && living.length) {
      interference(living[Math.floor(Math.random() * living.length)]);
      nextStatic = now + between(20000, 40000);
    }
  }
  frame = requestAnimationFrame(draw);
  document.addEventListener("visibilitychange", () => {
    scene.classList.toggle("is-hidden", document.hidden);
    for (const a of actors) {
      stopActor(a);
      a.next = performance.now() + between(2000, 7000);
      a.nextPuff = performance.now() + between(1000, 3000);
    }
    nextStatic = performance.now() + between(12000, 24000);
  });
  window.addEventListener("pagehide", () => {
    cancelAnimationFrame(frame);
    actors.forEach(stopActor);
    resize.disconnect();
    observer.disconnect();
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      resize.observe(scene);
      observer.observe(seats, { childList: true });
      resetActors();
      measure();
      frame = requestAnimationFrame(draw);
    }
  });
  return {
    status: () => ({
      counts: { ...counts },
      reducedMotion: reduce.matches,
      characters: actors.map((a) => ({
        id: a.node.dataset.player,
        design: a.node.dataset.character,
        gesture: a.previous,
        gestures: a.gestures,
        puffs: a.puffs,
        static: a.static,
        activeAnimations: a.animations.size,
      })),
    }),
  };
}
