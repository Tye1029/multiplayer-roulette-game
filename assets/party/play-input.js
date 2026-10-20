/* Pointer coordinates never become authoritative positions or scores. */
(() => {
  function bind(canvas, get, send, clock, aim) {
    if (!canvas || canvas.dataset.dragBound) return;
    canvas.dataset.dragBound = "true";
    let pointer = null,
      anchor = null,
      current = null,
      puttOrigin = null,
      last = 0,
      keys = new Set();
    function eligible() {
      const r = get();
      if (r?.game?.id === "putt") {
        const i = r.players.findIndex((p) => p.id === r.you),
          v = r.game.progress[i],
          t = r.game.putt,
          at = clock();
        if (
          t.turn !== i ||
          at < r.game.start + t.offset ||
          at >= r.game.start + t.offset + 30000 ||
          v.holed ||
          PartyScene.diagnostics().golfBusy ||
          (v.shot && at < v.shot.at + v.shot.duration + 250)
        )
          return null;
      }
      return r?.phase === "playing" &&
        clock() >= r.game.start &&
        clock() < r.game.end &&
        !document.querySelector("dialog[open]") &&
        ["bumper", "volcano", "putt"].includes(r.game.id) &&
        r.game.participants.includes(r.you) &&
        !r.game.progress[r.players.findIndex((p) => p.id === r.you)].finished
        ? r
        : null;
    }
    function updateAim(e) {
      const r = eligible();
      if (!r || r.game.id !== "putt" || !puttOrigin) return;
      const p = PartyScene.groundAt(
        canvas,
        e.clientX,
        e.clientY,
        "putt" + PartyCatalog.golfIndex(r.game.putt),
      );
      if (!p) return;
      const dx = puttOrigin.x - p.x,
        dz = puttOrigin.z - p.z;
      aim.angle = Math.atan2(dz, dx);
      aim.power = Math.min(1, Math.hypot(dx, dz) / 7);
      aim.dragging = true;
    }
    canvas.addEventListener("pointerdown", (e) => {
      const r = eligible();
      if (!r) return;
      e.preventDefault();
      pointer = e.pointerId;
      anchor = current = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(pointer);
      if (r.game.id === "putt") {
        const i = r.players.findIndex((p) => p.id === r.you),
          v = r.game.progress[i];
        if (r.game.putt.turn !== i) return;
        puttOrigin = PartyScene.groundAt(
          canvas,
          e.clientX,
          e.clientY,
          "putt" + PartyCatalog.golfIndex(r.game.putt),
        );
        updateAim(e);
      }
    });
    canvas.addEventListener("pointermove", (e) => {
      if (e.pointerId !== pointer) return;
      current = { x: e.clientX, y: e.clientY };
      updateAim(e);
    });
    function release(e) {
      if (e && e.pointerId !== pointer) return;
      const r = eligible();
      if (
        r?.game.id === "putt" &&
        puttOrigin &&
        aim.dragging &&
        Math.hypot((current?.x || 0) - anchor.x, (current?.y || 0) - anchor.y) >
          8
      )
        send({
          value: "putt",
          angle: aim.angle,
          power: Math.max(0.05, aim.power),
        });
      else if (r && r.game.id !== "putt") send({ value: "steer", x: 0, z: 0 });
      pointer = null;
      anchor = current = puttOrigin = null;
      aim.dragging = false;
      aim.power = 0;
    }
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", () => {
      const r = eligible();
      if (r && r.game.id !== "putt") send({ value: "steer", x: 0, z: 0 });
      pointer = null;
      anchor = current = puttOrigin = null;
      aim.dragging = false;
      aim.power = 0;
    });
    const directionKeys = [
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "w",
      "a",
      "s",
      "d",
    ];
    const controller = new AbortController();
    window.addEventListener(
      "keydown",
      (e) => {
        const r = eligible();
        if (
          !r ||
          r.game.id === "putt" ||
          !directionKeys.includes(e.key) ||
          /INPUT|TEXTAREA/.test(e.target.tagName)
        )
          return;
        e.preventDefault();
        keys.add(e.key);
      },
      { signal: controller.signal },
    );
    window.addEventListener("keyup", (e) => keys.delete(e.key), {
      signal: controller.signal,
    });
    window.addEventListener(
      "blur",
      () => {
        keys.clear();
        release();
      },
      { signal: controller.signal },
    );
    function frame() {
      if (!canvas.isConnected) {
        controller.abort();
        return;
      }
      requestAnimationFrame(frame);
      const r = eligible(),
        at = clock();
      if (!r || r.game.id === "putt" || at - last < 170) return;
      let x = 0,
        z = 0;
      if (pointer !== null && current && anchor) {
        x = (current.x - anchor.x) / 65;
        z = (current.y - anchor.y) / 65;
      }
      if (keys.size) {
        x =
          Number(keys.has("ArrowRight") || keys.has("d")) -
          Number(keys.has("ArrowLeft") || keys.has("a"));
        z =
          Number(keys.has("ArrowDown") || keys.has("s")) -
          Number(keys.has("ArrowUp") || keys.has("w"));
      }
      if (pointer === null && !keys.size) return;
      const len = Math.max(1, Math.hypot(x, z));
      send({ value: "steer", x: x / len, z: z / len });
      last = at;
    }
    requestAnimationFrame(frame);
  }
  globalThis.PartyPlayInput = { bind };
})();
