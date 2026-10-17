/* Original sculpted mountain and concert environments. Gameplay stays server owned. */
export function polishScenes(H) {
  const {
    T,
    C,
    world,
    box,
    ball,
    cyl,
    tube,
    torus,
    label,
    mascot,
    roster,
    animateCharacter,
    cloud,
    mat,
    mix,
    clamp,
  } = H;
  const R = globalThis.PartyRules,
    TAU = Math.PI * 2;
  const colors = ["#67c9ec", "#f3a0c3", "#87d9ae", "#f6ce68"];
  function arrowBadge(symbol, next) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 128;
    const c = cv.getContext("2d");
    c.fillStyle = next ? "#ffdf86" : "#d4ebe3";
    c.beginPath();
    c.roundRect(4, 4, 120, 120, 28);
    c.fill();
    c.strokeStyle = "#715f63";
    c.lineWidth = 5;
    c.stroke();
    c.fillStyle = "#354657";
    c.font = "900 88px system-ui";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(symbol, 64, 66);
    const texture = new T.CanvasTexture(cv);
    texture.colorSpace = T.SRGBColorSpace;
    const sprite = new T.Sprite(
      new T.SpriteMaterial({ map: texture, depthTest: false }),
    );
    sprite.scale.setScalar(next ? 0.85 : 0.66);
    sprite.renderOrder = 12;
    return sprite;
  }
  function rock(parent, x, y, z, s, color) {
    const m = new T.Mesh(new T.IcosahedronGeometry(1, 1), mat(color));
    m.position.set(x, y, z);
    m.scale.set(...s);
    m.rotation.set(0.1 + x * 0.03, y * 0.2, z * 0.06);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function pine(w, x, y, z, s = 1) {
    cyl(w.root, x, y + 0.7 * s, z, 0.12 * s, 0.18 * s, 1.4 * s, "#866e60");
    for (let j = 0; j < 3; j++)
      cyl(
        w.root,
        x,
        y + (1.3 + j * 0.55) * s,
        z,
        0,
        (1.05 - j * 0.2) * s,
        1.5 * s,
        ["#478f85", "#5ba58f", "#7ab79c"][j],
        9,
      );
  }
  const ledge = (i, n) => ({
    x: (i - 1.5) * 4.7 + Math.sin(n * 1.5 + i) * 0.38,
    y: 0.7 + n * 0.85,
    z: 3.6,
  });
  function mountain() {
    const w = world("climb");
    if (w.built) return w;
    w.built = true;
    w.scene.background = new T.Color("#bbdde9");
    w.scene.fog.color.set("#bbdde9");
    // A continuous rock face, framed by distant ridges rather than towers.
    for (let i = 0; i < 9; i++)
      rock(
        w.root,
        -19 + i * 4.8,
        5 + (i % 3) * 2,
        -15,
        [7, 9 + (i % 3) * 3, 5],
        i % 2 ? "#91b5c2" : "#a1c3cf",
      );
    rock(w.root, 0, -1, 0, [15, 2, 8], "#b7b9a0");
    for (let i = 0; i < 4; i++) {
      const x = (i - 1.5) * 4.7;
      rock(w.root, x, 9, -1, [3.9, 12.5, 3.4], i % 2 ? "#b4b7b3" : "#c4bfae");
      for (let j = 0; j < 14; j++) {
        const y = 1 + j * 1.45;
        rock(
          w.root,
          x + Math.sin(j * 2 + i) * 1.6,
          y,
          -0.2,
          [1.5, 0.8, 0.7],
          j % 3 ? "#a4aaa8" : "#cfc8b5",
        );
      }
      for (let n = 0; n <= 24; n++) {
        const p = ledge(i, n);
        rock(
          w.root,
          p.x,
          p.y - 0.16,
          p.z - 0.48,
          [1.25, 0.25, 0.9],
          n % 6 ? "#c5b69c" : "#e4c47d",
        );
        box(
          w.root,
          p.x,
          p.y,
          p.z - 0.1,
          1.9,
          0.1,
          0.9,
          n % 6 ? "#e3d5ba" : "#f4d991",
        );
        if (n % 6 === 0) {
          for (const side of [-1, 1])
            ball(
              w.root,
              p.x + side * 0.8,
              p.y + 0.12,
              p.z,
              0.09,
              0.08,
              0.09,
              "#f2c764",
            );
        }
      }
      tube(w.root, [x - 1.6, 0.7, 1.9], [x - 1.6, 21.4, 1.9], 0.027, "#bc8465");
      pine(w, x - 1, 21.4, -1, 0.7);
    }
    for (const side of [-1, 1])
      for (let j = 0; j < 4; j++)
        pine(w, side * (11 + j * 0.6), -0.2, -2 + j * 1.5, 0.7 + j * 0.08);
    for (let i = 0; i < 5; i++)
      cloud(w, -22 + i * 11, 23 + (i % 2) * 2, -13, 2);
    const sign = label("SUMMIT TRAIL · 24 LEDGES", "#fff5db", "#527f80", 0.8);
    sign.position.set(0, 23, 0);
    w.root.add(sign);
    w.arrows = Array.from({ length: 4 }, () =>
      Array.from({ length: 4 }, () => {
        const l = arrowBadge("↑", true);
        w.root.add(l);
        l.userData.symbol = "↑";
        return l;
      }),
    );
    return w;
  }
  function updateMountain(w, s, t) {
    roster(w, s);
    const own = s?.players.findIndex((p) => p.id === s.you) ?? 0;
    w.actors.forEach((a, i) => {
      const v = s?.game?.progress[i],
        step = v?.step || 0;
      const dt = Math.min(0.06, Math.max(0, t - (a.userData.climbAt ?? t)));
      if (a.userData.gameStart !== s?.game?.start) {
        a.userData.smoothStep = step;
        a.userData.gameStart = s?.game?.start;
      }
      a.userData.smoothStep = mix(
        a.userData.smoothStep ?? step,
        step,
        1 - Math.exp(-13 * dt),
      );
      a.userData.climbAt = t;
      const n = a.userData.smoothStep,
        lo = Math.floor(n),
        q = n - lo,
        p = ledge(i, lo),
        next = ledge(i, Math.ceil(n));
      a.position.set(
        mix(p.x, next.x, q),
        mix(p.y, next.y, q) + Math.sin(q * Math.PI) * 0.18,
        3.95,
      );
      a.rotation.set(0, Math.PI, 0);
      a.scale.setScalar(0.74);
      a.userData.nameLabel.rotation.y = Math.PI;
      animateCharacter(
        a,
        t,
        Math.abs(n - step) > 0.04 ? "climb" : v?.finished ? "win" : "idle",
      );
      w.arrows[i].forEach((l, j) => {
        const direction = i === own ? v?.next?.[j] : null,
          symbol = { up: "↑", down: "↓", left: "←", right: "→" }[direction];
        l.visible = !!symbol && step + j < 24 && s?.phase === "playing";
        if (symbol && symbol !== l.userData.symbol) {
          const nextLabel = arrowBadge(symbol, j === 0);
          l.material.map.dispose();
          l.material.dispose();
          l.material = nextLabel.material;
          l.scale.copy(nextLabel.scale);
          l.userData.symbol = symbol;
        }
        const pos = ledge(i, step + j + 1);
        l.position.set(pos.x, pos.y + 0.44, 4.1);
      });
    });
    const a = w.actors[own],
      y = clamp((a?.position.y || 1) + 1.3, 2.2, 21.2);
    return {
      target: new T.Vector3(a?.position.x * 0.18 || 0, y, 1),
      extent: 15,
      position: [2, 5, 34],
    };
  }
  const centers = [
    [0, 4],
    [-7.6, -2],
    [0, -5],
    [7.6, -2],
  ];
  const pads = [
    [-1.25, -1.25],
    [1.25, -1.25],
    [-1.25, 1.25],
    [1.25, 1.25],
  ];
  function concert() {
    const w = world("memory");
    if (w.built) return w;
    w.built = true;
    w.scene.background = new T.Color("#777ca8");
    w.scene.fog.color.set("#777ca8");
    cyl(w.root, 0, -0.5, 0, 17, 18, 1.5, "#6a6487", 64);
    cyl(w.root, 0, 0.3, 0, 15.8, 16, 0.3, "#393e61", 64);
    for (let i = 0; i < 45; i++) {
      const a = (TAU * i) / 45;
      ball(
        w.root,
        Math.cos(a) * 15.9,
        0.6,
        Math.sin(a) * 15.9,
        0.14,
        0.11,
        0.14,
        colors[i % 4],
      );
    }
    w.pads = [];
    for (const [x, z] of centers) {
      cyl(w.root, x, 0.56, z, 3.6, 3.8, 0.35, "#514f74", 32);
      const ring = torus(w.root, x, 0.77, z, 3.4, 0.035, "#e5b9db");
      ring.rotation.x = Math.PI / 2;
      w.pads.push(
        pads.map(([dx, dz], j) => {
          const m = box(
            w.root,
            x + dx,
            0.8,
            z + dz,
            2.25,
            0.15,
            2.25,
            colors[j],
          );
          m.material = m.material.clone();
          m.material.emissive.set(colors[j]);
          const l = label(String(j + 1), "#31385a", null, 0.45);
          l.position.set(x + dx, 0.95, z + dz + 0.55);
          w.root.add(l);
          return m;
        }),
      );
    }
    // Tiered amphitheater, star panels, lighting truss and real speaker cones.
    for (let j = 0; j < 3; j++)
      for (let i = 0; i < 12; i++) {
        const a = Math.PI + (i / 11) * Math.PI,
          x = Math.cos(a) * (17 + j),
          z = Math.sin(a) * (17 + j);
        box(w.root, x, j * 0.6, z, 1.8, 0.5, 1.7, "#a797b7");
        ball(w.root, x, j * 0.6 + 0.7, z, 0.24, 0.3, 0.24, colors[i % 4]);
      }
    for (const x of [-12, 12]) {
      for (let j = 0; j < 3; j++) {
        box(w.root, x, 1.4 + j * 1.5, -7, 2.2, 1.4, 1.1, "#343c53");
        const cone = cyl(
          w.root,
          x,
          1.4 + j * 1.5,
          -6.4,
          0.49,
          0.56,
          0.13,
          "#777b98",
          24,
        );
        cone.rotation.x = Math.PI / 2;
        const rim = torus(
          w.root,
          x,
          1.4 + j * 1.5,
          -6.3,
          0.57,
          0.045,
          "#bfb8d0",
        );
      }
      tube(w.root, [x, 0.5, -9], [x, 7.2, -9], 0.13, "#d8cad4");
    }
    for (const y of [6.5, 7.2])
      tube(w.root, [-12, y, -9], [12, y, -9], 0.1, "#d8cad4");
    for (let i = 0; i < 12; i++)
      tube(
        w.root,
        [-12 + i * 2, 6.5, -9],
        [-10 + i * 2, 7.2, -9],
        0.045,
        "#d8cad4",
      );
    w.beams = [];
    for (let i = 0; i < 7; i++) {
      const root = new T.Group();
      root.position.set(-10 + i * 3.3, 6.4, -8.5);
      w.root.add(root);
      cyl(root, 0, 0, 0, 0.35, 0.48, 0.6, "#424660");
      const m = new T.Mesh(
        new T.ConeGeometry(2.9, 6, 24, 1, true),
        new T.MeshBasicMaterial({
          color: colors[i % 4],
          transparent: true,
          opacity: 0.065,
          depthWrite: false,
          side: T.DoubleSide,
        }),
      );
      m.position.y = -3.1;
      root.add(m);
      w.beams.push(root);
    }
    const sign = label("AFTERGLOW LIVE", "#fff0cc", "#8b658e", 1);
    sign.position.set(0, 6.2, -10);
    w.root.add(sign);
    return w;
  }
  function updateConcert(w, s, t, extra) {
    roster(w, s);
    const own = s?.players.findIndex((p) => p.id === s.you) ?? 0,
      playing = s?.phase === "playing";
    w.actors.forEach((a, i) => {
      const slot = i === own ? 0 : 1 + (i < own ? i : i - 1),
        [x, z] = centers[slot],
        v = s?.game?.progress[i];
      let pad = null,
        at = 0;
      if (playing && v) {
        if (i === own) {
          const pattern = extra.pattern || v.pattern || [],
            age = t * 1000 - v.showAt - R.memoryReady,
            n = Math.floor(age / R.memoryBeat);
          if (
            n >= 0 &&
            n < pattern.length &&
            age % R.memoryBeat < R.memoryFlash
          ) {
            pad = pattern[n];
            at = v.showAt + R.memoryReady + n * R.memoryBeat;
          }
        } else if (v.demoPad !== null && t * 1000 - v.demoAt < R.memoryFlash) {
          pad = v.demoPad;
          at = v.demoAt;
        }
        if (t * 1000 - (v.padAt || 0) < 400) {
          pad = v.pad;
          at = v.padAt;
        }
      }
      const target = pads[pad] || [0, 0],
        age = clamp((t * 1000 - at) / 400),
        bounce = pad !== null ? Math.sin(age * Math.PI) : 0;
      const dt = Math.min(0.06, Math.max(0, t - (a.userData.danceAt ?? t)));
      a.userData.danceAt = t;
      a.userData.danceX = mix(
        a.userData.danceX || 0,
        target[0],
        1 - Math.exp(-22 * dt),
      );
      a.userData.danceZ = mix(
        a.userData.danceZ || 0,
        target[1],
        1 - Math.exp(-22 * dt),
      );
      a.position.set(
        x + a.userData.danceX,
        0.9 + bounce * 0.18,
        z + a.userData.danceZ,
      );
      a.rotation.set(0, 0, 0);
      a.scale.setScalar(0.85);
      animateCharacter(a, t, pad !== null ? "walk" : "idle", 0.8);
      w.pads[slot].forEach((m, j) => {
        m.material.emissiveIntensity = pad === j ? 1.1 : 0.04;
        m.position.y = pad === j ? 0.73 : 0.8;
      });
    });
    w.beams.forEach((m, j) => {
      m.rotation.z = Math.sin(t * 0.55 + j) * 0.3;
      m.rotation.x = 0.2 + Math.cos(t * 0.4 + j) * 0.15;
    });
    return {
      target: new T.Vector3(0, 1, 0),
      extent: 24,
      position: [0, 25, 29],
    };
  }
  return { mountain, updateMountain, concert, updateConcert, rock };
}
