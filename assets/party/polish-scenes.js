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
  const badgeTextures = new Map(),
    badgeMaterials = new Map();
  function arrowBadge(symbol, next) {
    const key = symbol + ":" + next;
    if (badgeTextures.has(key))
      return badgeSprite(badgeTextures.get(key), next);
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
    badgeTextures.set(key, texture);
    H.prepareTexture?.(texture);
    return badgeSprite(texture, next);
  }
  function badgeSprite(texture, next) {
    if (!badgeMaterials.has(texture))
      badgeMaterials.set(
        texture,
        new T.SpriteMaterial({
          map: texture,
          depthTest: false,
          depthWrite: false,
        }),
      );
    const sprite = new T.Sprite(badgeMaterials.get(texture));
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
    y: n >= 24 ? 31 : 0.7 + n * 1.2,
    z: 3.6,
  });
  function mountain() {
    const w = world("climb");
    if (w.built) return w;
    w.built = true;
    w.scene.background = new T.Color("#bbdde9");
    w.scene.fog.color.set("#bbdde9");
    // A connected sandstone wall with layered, chipped facets and a real summit shelf.
    const positions = [],
      colors = [],
      indices = [],
      nx = 32,
      ny = 36;
    const palette = ["#ad7047", "#bd8252", "#976143", "#ca9561", "#a8754c"];
    for (let j = 0; j <= ny; j++)
      for (let k = 0; k <= nx; k++) {
        const y = -1 + (j * 32) / ny;
        const x = (k / nx - 0.5) * (25.5 - Math.max(0, y - 28) * 0.7);
        const z =
          1.25 +
          Math.sin(x * 0.85 + Math.floor(j / 3)) * 0.4 +
          Math.sin(k * 3.17 + j * 1.91) * 0.23;
        positions.push(x, y, z);
        const c = new T.Color(
          palette[(Math.floor(j / 3) + (k % 3)) % palette.length],
        );
        colors.push(c.r, c.g, c.b);
        if (j < ny && k < nx) {
          const n = j * (nx + 1) + k;
          indices.push(n, n + 1, n + nx + 1, n + 1, n + nx + 2, n + nx + 1);
        }
      }
    const faceGeo = new T.BufferGeometry();
    faceGeo.setAttribute(
      "position",
      new T.Float32BufferAttribute(positions, 3),
    );
    faceGeo.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    faceGeo.setIndex(indices);
    const facets = faceGeo.toNonIndexed();
    facets.computeVertexNormals();
    const face = new T.Mesh(
      facets,
      new T.MeshStandardMaterial({
        vertexColors: true,
        roughness: 1,
        flatShading: true,
        side: T.DoubleSide,
      }),
    );
    face.castShadow = face.receiveShadow = true;
    w.root.add(face);
    box(w.root, 0, 15, -2.2, 25, 32, 6.8, "#966648");
    box(w.root, 0, 30.85, 0.6, 23.2, 0.3, 11.6, "#b28755");
    cyl(w.root, 0, -0.35, 5, 43, 45, 1, "#81b85d", 64);
    for (let i = 0; i < 24; i++) {
      const x = Math.sin(i * 2.4) * (15 + (i % 9)),
        z = 6 + Math.cos(i * 1.7) * 12;
      rock(w.root, x, 0.05, z, [1.2, 0.12, 0.7], i % 2 ? "#96c86b" : "#73a957");
    }
    for (let i = 0; i < 7; i++) {
      const x = -19 + i * 6.4;
      rock(
        w.root,
        x,
        8 + (i % 3),
        -18,
        [6, 11 + (i % 3) * 2, 5],
        i % 2 ? "#bba18a" : "#c7b19a",
      );
    }
    rock(w.root, 0, -1.3, 0, [15, 1.5, 8], "#ad8053");
    const shape = new T.Shape();
    [
      [-1.15, -1.75],
      [0.8, -1.85],
      [1.18, -0.75],
      [1, 0.68],
      [0.38, 0.86],
      [-0.95, 0.7],
      [-1.2, -0.2],
    ].forEach(([x, z], i) => (i ? shape.lineTo(x, z) : shape.moveTo(x, z)));
    const shelfGeo = new T.ExtrudeGeometry(shape, {
      depth: 0.22,
      bevelEnabled: true,
      bevelSize: 0.1,
      bevelThickness: 0.07,
      bevelSegments: 1,
      steps: 1,
    });
    for (let i = 0; i < 4; i++) {
      const x = (i - 1.5) * 4.7;
      for (let n = 0; n <= 24; n++) {
        const p = ledge(i, n);
        const support = rock(
          w.root,
          p.x,
          p.y - 0.38,
          1.9,
          [1.2, 0.3, 2],
          n % 3 ? "#a97850" : "#b7865a",
        );
        support.rotation.set(0.02, 0.04 * Math.sin(n), 0);
        const slab = new T.Mesh(shelfGeo, mat(n % 6 ? "#cd9b68" : "#e2b77b"));
        slab.rotation.x = -Math.PI / 2;
        slab.position.set(p.x, p.y - 0.29, 2.9);
        slab.castShadow = slab.receiveShadow = true;
        w.root.add(slab);
        if (n % 6 === 0) {
          const stud = cyl(
            w.root,
            p.x - 0.83,
            p.y + 0.02,
            3.52,
            0.065,
            0.065,
            0.13,
            "#655c55",
            8,
          );
          tube(
            w.root,
            [p.x - 0.85, p.y + 0.02, 3.4],
            [p.x - 0.85, p.y + 0.02, 3.8],
            0.035,
            "#efc363",
          );
        }
      }
      tube(
        w.root,
        [x - 1.6, 0.7, 1.85],
        [x - 1.6, 30.95, 1.85],
        0.025,
        "#68503a",
      );
    }
    for (const x of [-9, -5, 3, 8]) pine(w, x, 31, -2.5, 0.65);
    for (const side of [-1, 1])
      for (let j = 0; j < 4; j++)
        pine(w, side * (12 + j * 0.8), -0.3, -2 + j * 1.4, 0.7 + j * 0.08);
    // Wispy, softly shaded clouds stay behind the mountain instead of balloon clusters.
    const cv = document.createElement("canvas");
    cv.width = 512;
    cv.height = 192;
    const ctx = cv.getContext("2d");
    for (let j = 0; j < 9; j++) {
      const x = 55 + j * 49,
        y = 110 - Math.sin(j * 0.5) * 38,
        r = 45 + Math.sin(j) * 12;
      const gradient = ctx.createRadialGradient(x, y, 3, x, y, r);
      gradient.addColorStop(0, "#ffffffd0");
      gradient.addColorStop(0.6, "#f4fbff90");
      gradient.addColorStop(1, "#ffffff00");
      ctx.fillStyle = gradient;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const texture = new T.CanvasTexture(cv);
    texture.colorSpace = T.SRGBColorSpace;
    for (let i = 0; i < 4; i++) {
      const c = new T.Sprite(
        new T.SpriteMaterial({
          map: texture,
          transparent: true,
          opacity: 0.75,
          depthWrite: false,
        }),
      );
      c.position.set(-24 + i * 16, 33 + (i % 2) * 3, -24);
      c.scale.set(17, 6, 1);
      w.root.add(c);
      w.animated.push(
        (t) => (c.position.x = -24 + i * 16 + Math.sin(t * 0.025 + i) * 2),
      );
    }
    const sign = label("SUMMIT TRAIL · 24 LEDGES", "#fff5db", "#527f80", 0.8);
    sign.position.set(0, 31.4, 0);
    w.root.add(sign);
    for (const symbol of ["↑", "↓", "←", "→"])
      for (const next of [true, false]) arrowBadge(symbol, next);
    w.arrows = Array.from({ length: 4 }, () =>
      Array.from({ length: 4 }, () => {
        const l = arrowBadge("↑", true);
        w.root.add(l);
        l.userData.symbol = "";
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
        mix(5.1, 3.4, clamp(n - 23)),
      );
      a.rotation.set(0, Math.PI * (1 - clamp(n - 23)), 0);
      a.scale.setScalar(0.74);
      a.userData.nameLabel.rotation.y = a.rotation.y;
      animateCharacter(
        a,
        t,
        Math.abs(n - step) > 0.04 ? "climb" : v?.finished ? "win" : "idle",
      );
      w.arrows[i].forEach((l, j) => {
        const direction = i === own ? v?.next?.[j] : null,
          symbol = { up: "↑", down: "↓", left: "←", right: "→" }[direction];
        l.visible = !!symbol && step + j < 24 && s?.phase === "playing";
        if (symbol && symbol + ":" + (j === 0) !== l.userData.symbol) {
          const nextLabel = arrowBadge(symbol, j === 0);
          l.material = nextLabel.material;
          l.scale.copy(nextLabel.scale);
          l.userData.symbol = symbol + ":" + (j === 0);
        }
        const pos = ledge(i, step + j + 1);
        l.position.set(pos.x, pos.y + 0.44, 5.35);
      });
    });
    const a = w.actors[own],
      y = clamp((a?.position.y || 1) + 1.3, 2.2, 29.6);
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
      a.rotation.set(
        0,
        pad !== null ? Math.atan2(target[0], target[1]) * 0.25 : 0,
        bounce * -target[0] * 0.05,
      );
      a.scale.setScalar(0.85);
      animateCharacter(a, t, pad !== null ? "walk" : "idle", 0.8);
      w.pads[slot].forEach((m, j) => {
        const glow = pad === j ? Math.sin(Math.PI * Math.min(1, age)) : 0;
        m.material.emissiveIntensity = mix(
          m.material.emissiveIntensity,
          0.04 + glow * 1.4,
          1 - Math.exp(-24 * dt),
        );
        m.position.y = mix(
          m.position.y,
          0.8 - glow * 0.09,
          1 - Math.exp(-24 * dt),
        );
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
