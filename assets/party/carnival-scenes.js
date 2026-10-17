import {
  surfaceMaterial,
  island,
} from "./surface-art.js?v=BOARDWALK_CARNIVAL_V10";
export function carnivalScenes(H) {
  const {
    T,
    C,
    world,
    water,
    box,
    ball,
    cyl,
    tube,
    torus,
    label,
    mascot,
    roster,
    animateCharacter,
    palm,
    building,
    cloud,
    mix,
    clamp,
  } = H;
  const R = globalThis.PartyRules;
  const colors = ["#8fcce7", "#eaa5bf", "#93d3af", "#f7ce72"];
  function coin(parent, x, y, z, size = 0.34) {
    const g = new T.Group();
    parent.add(g);
    g.position.set(x, y, z);
    const m = cyl(g, 0, 0, 0, size, size, 0.12, "#f9ca53", 20);
    m.rotation.x = Math.PI / 2;
    const rim = torus(g, 0, 0, 0.075, size * 0.77, 0.035, "#fff2ae");
    ball(g, 0, 0, 0.09, size * 0.22, size * 0.42, 0.03, "#e09a2f");
    return g;
  }
  function common(kind) {
    const w = world(kind);
    if (w.built) return w;
    w.built = true;
    water(w);
    if (["cascade", "lantern", "hop"].includes(kind)) {
      w.water.material = surfaceMaterial(
        T,
        "water",
        kind === "lantern" ? "#497e99" : "#63c9ce",
        16,
      );
      if (kind === "hop") {
        island(
          T,
          w.root,
          surfaceMaterial(T, "sand", "#f0d5a1", 9),
          0,
          0.31,
          3,
          24,
          17,
          1,
        );
        island(
          T,
          w.root,
          surfaceMaterial(T, "grass", "#a1c594", 6),
          -19,
          0.42,
          -5,
          6,
          8,
          0.4,
        );
        island(
          T,
          w.root,
          surfaceMaterial(T, "grass", "#a1c594", 6),
          19,
          0.42,
          -5,
          6,
          8,
          0.4,
        );
        for (const x of [-19, 19]) {
          palm(w, x, -4, 1.4);
          palm(w, x + 1, 4, 0.95);
        }
        for (let j = 0; j < 16; j++) {
          const x = -21 + j * 2.8,
            z = 12 + Math.sin(j) * 1.2;
          ball(
            w.root,
            x,
            0.4,
            z,
            0.16 + (j % 3) * 0.08,
            0.08,
            0.12,
            j % 2 ? "#eab4a7" : "#fff1ce",
          );
          if (j % 3 === 0) {
            box(w.root, x, 0.5, z - 1, 1.4, 0.1, 2.2, colors[j % 4]);
            const parasol = cyl(
              w.root,
              x,
              3.4,
              z,
              0,
              1.5,
              0.65,
              colors[j % 4],
              12,
            );
            tube(w.root, [x, 0.3, z], [x, 3.5, z], 0.055, "#e8bc8a");
          }
        }
        // Weathered coastal boulders, a lifeguard hut and a rope boundary.
        for (let j = 0; j < 12; j++)
          ball(
            w.root,
            -18 + j * 3.3,
            0.25,
            -10,
            0.9,
            0.5,
            0.7,
            j % 2 ? "#b8bcb0" : "#c7c5b3",
          );
        building(w, 16, -10, 0.75, "#f0c198", "#88b7be", "SURF WATCH");
        for (let j = 0; j < 4; j++) {
          const x = -11 + j * 7.4;
          tube(w.root, [x, 0.3, 9], [x, 1.3, 9], 0.065, "#b38c66");
          if (j < 3)
            tube(w.root, [x, 1.1, 9], [x + 7.4, 1.1, 9], 0.027, "#e6cf9c");
        }
      } else if (kind === "lantern") {
        island(
          T,
          w.root,
          surfaceMaterial(T, "sand", "#c4b995", 7),
          0,
          0.2,
          -17,
          24,
          6,
          1,
        );
        for (let j = 0; j < 10; j++) {
          const x = -20 + j * 4.3;
          palm(w, x, -17, 0.8 + (j % 3) * 0.12);
        }
        for (const x of [-11, 11]) {
          box(w.root, x, 0.2, -5, 2, 0.4, 16, "#a48470");
          for (let j = 0; j < 8; j++)
            box(w.root, x, 0.42, -12 + j * 2, 1.96, 0.02, 0.04, "#785f57");
          for (let j = 0; j < 4; j++) {
            tube(
              w.root,
              [x, 0.4, -11 + j * 4],
              [x, 3.8, -11 + j * 4],
              0.06,
              "#85695e",
            );
            ball(w.root, x, 3.7, -11 + j * 4, 0.35, 0.5, 0.35, colors[j]);
          }
        }
        w.scene.background = new T.Color("#a1bdc5");
        w.scene.fog.color.set("#a1bdc5");
      } else {
        island(
          T,
          w.root,
          surfaceMaterial(T, "sand", "#e4c19f", 8),
          0,
          0.1,
          0,
          24,
          18,
          1,
        );
        for (let j = 0; j < 9; j++) {
          const x = -20 + j * 5;
          box(w.root, x, 1, -7, 4, 2, 4, colors[j % 4]);
          cyl(
            w.root,
            x,
            2.9,
            -7,
            0,
            3,
            1.9,
            j % 2 ? "#d5a5bf" : "#f1cb83",
            4,
          ).rotation.y = Math.PI / 4;
          const sign = label(
            ["PRIZES", "ARCADE", "TOKENS"][j % 3],
            "#fff1d2",
            "#72546d",
            0.4,
          );
          sign.position.set(x, 2, -4.9);
          w.root.add(sign);
        }
        for (let j = 0; j < 18; j++)
          ball(w.root, -20 + j * 2.4, 5, -5, 0.12, 0.16, 0.12, colors[j % 4]);
        tube(w.root, [-21, 5, -5], [21, 5, -5], 0.025, "#93775d");
      }
    } else if (kind !== "lantern") {
      box(w.root, 0, -0.4, 0, 35, 1, 35, "#e8ce9a");
      box(w.root, 0, 0.13, 0, 34.5, 0.1, 34.5, "#8ec9a0");
    } else box(w.root, 0, -0.4, -14, 35, 1, 6, "#e8ce9a");
    if (!["cascade", "lantern", "hop"].includes(kind))
      for (let i = 0; i < 9; i++) {
        palm(w, -15 + i * 3.7, -13, 0.65 + (i % 3) * 0.12);
        if (i % 2 === 0)
          building(
            w,
            -14 + i * 3.7,
            -15,
            0.48,
            colors[i % 4],
            "#f5d6a0",
            ["SODA", "PLAY", "CAFE"][i % 3],
          );
      }
    for (let i = 0; i < 5; i++) cloud(w, -20 + i * 10, 10, -22, 2);
    if (!["cascade", "lantern", "hop"].includes(kind))
      for (const x of [-15, 15])
        for (let i = 0; i < 5; i++) {
          const z = -10 + i * 5;
          tube(
            w.root,
            [x, kind === "lantern" ? -1.2 : 0.2, z],
            [x, 3.6, z],
            0.055,
            "#8e7975",
          );
          ball(w.root, x, 3.6, z, 0.25, 0.3, 0.25, "#ffeab3");
        }
    const title = label(
      C.games.find((g) => g.id === kind).name.toUpperCase(),
      "#fff3d5",
      "#71558b",
      0.75,
    );
    title.position.set(0, 6, -10);
    w.root.add(title);
    return w;
  }
  function build(kind) {
    const existing = world(kind);
    if (existing.built) return existing;
    const w = common(kind);
    w.props = [];
    w.tiles = [];
    if (kind === "cascade") {
      w.objects = [];
      for (let p = 0; p < 4; p++) {
        const base = (p - 1.5) * 7;
        box(w.root, base, 0.5, 6, 6.5, 0.45, 4.7, "#ceaa88");
        for (let j = 0; j < 8; j++)
          box(w.root, base, 0.74, 4 + j * 0.55, 6.4, 0.025, 0.03, "#ac886d");
        for (const side of [-1, 1])
          tube(
            w.root,
            [base + side * 3.2, 0.7, 6],
            [base + side * 3.2, 10, 6],
            0.07,
            "#c79b73",
          );
        box(w.root, base, 11.2, 6, 6.7, 2, 2.2, colors[p]);
        box(w.root, base, 11.4, 7.15, 5.8, 1.15, 0.08, "#625475");
        const sign = label("COIN SHOWER", "#fff1c4", null, 0.45);
        sign.position.set(base, 11.6, 7.24);
        w.root.add(sign);
        for (let lane = 0; lane < 3; lane++) {
          const x = base + (lane - 1) * 1.9;
          cyl(w.root, x, 10.2, 6, 0.55, 0.7, 0.5, "#e7b55d");
          cyl(w.root, x, 9.94, 6, 0.43, 0.43, 0.04, "#5d4c66");
          ball(w.root, x, 12.3, 6, 0.18, 0.18, 0.18, "#fff0a7");
        }
        for (let slot = 0; slot < 3; slot++)
          for (let lane = 0; lane < 3; lane++) {
            const g = new T.Group();
            w.root.add(g);
            const prize = coin(g, 0, 0, 0, 0.4),
              bundle = coin(g, 0.25, 0.3, 0, 0.3),
              spike = new T.Group();
            g.add(spike);
            ball(spike, 0, 0, 0, 0.42, 0.42, 0.42, "#6d657d");
            for (let j = 0; j < 8; j++) {
              const a = (j / 8) * Math.PI * 2,
                m = cyl(
                  spike,
                  Math.cos(a) * 0.46,
                  Math.sin(a) * 0.46,
                  0,
                  0,
                  0.13,
                  0.35,
                  "#e1d5be",
                  5,
                );
              m.rotation.z = a - Math.PI / 2;
            }
            w.objects.push({ g, prize, bundle, spike, p, lane, slot });
          }
        for (let lane = 0; lane < 3; lane++) {
          const x = base + (lane - 1) * 1.9;
          const ring = torus(w.root, x, 0.77, 6, 0.66, 0.035, "#f9de89");
          ring.rotation.x = Math.PI / 2;
        }
      }
    } else if (kind === "lantern") {
      for (let i = 0; i < 4; i++) {
        const [x, z] = R.lanternPositions[i],
          g = new T.Group();
        g.position.set(x, 0, z);
        w.root.add(g);
        const surface = box(g, 0, 0.35, 0, 6.2, 0.24, 6.2, colors[i]);
        g.userData.surface = surface;
        for (let k = -2.5; k <= 2.5; k += 0.5)
          box(g, k, 0.48, 0, 0.025, 0.015, 6.1, "#fff0cf");
        const number = label(String(i + 1), "#fff7dc", "#4d5773", 0.65);
        number.position.set(0, 0.52, 1.8);
        g.add(number);
        w.tiles.push(g);
        for (const side of [-1, 1]) {
          box(w.root, x + side * 3.26, 0.35, z, 0.28, 0.45, 6.7, "#866b5d");
          box(w.root, x, 0.35, z + side * 3.26, 6.7, 0.45, 0.28, "#866b5d");
          for (const edge of [-1, 1])
            cyl(
              w.root,
              x + side * 3.26,
              -0.8,
              z + edge * 3.26,
              0.17,
              0.2,
              2.8,
              "#866b5d",
              12,
            );
        }
      }
      box(w.root, 0, 0.2, -9, 5, 0.5, 3, "#bda080");
      w.marshal = mascot("shopkeeper");
      w.marshal.position.set(0, 0.48, -9);
      w.marshal.scale.setScalar(1.15);
      w.root.add(w.marshal);
      w.flagGroup = new T.Group();
      w.marshal.userData.arms[1].add(w.flagGroup);
      w.flagGroup.position.set(0, -0.58, 0.12);
      w.flag = box(w.flagGroup, 0, 0.26, 0.04, 0.85, 0.66, 0.07, colors[0]);
      box(w.flagGroup, 0, 0.26, 0.085, 0.65, 0.47, 0.015, "#fff5d4");
      w.cardFace = box(w.flagGroup, 0, 0.26, 0.1, 0.55, 0.37, 0.02, colors[0]);
      w.flagGroup.visible = false;
      box(
        w.marshal.userData.rig,
        0.28,
        0.85,
        0.34,
        0.32,
        0.28,
        0.06,
        "#a07160",
      );
      w.splashes = Array.from({ length: 4 }, () => {
        const ring = torus(w.root, 0, -0.57, 0, 0.6, 0.045, "#d5f0e9");
        ring.rotation.x = Math.PI / 2;
        return ring;
      });
    } else if (kind === "hop") {
      // Driftwood rollers arrive from the wet sand. Cylinders give an honest,
      // stable collision edge and read clearly even on small touch screens.
      w.wave = new T.Group();
      w.root.add(w.wave);
      for (let i = 0; i < 4; i++) {
        const log = new T.Group();
        log.position.x = (i - 1.5) * 6.6;
        w.wave.add(log);
        const trunk = cyl(log, 0, 0, 0, 0.43, 0.48, 5.8, "#bc926b", 18);
        trunk.rotation.z = Math.PI / 2;
        for (const x of [-2.92, 2.92]) {
          const end = cyl(log, x, 0, 0, 0.39, 0.39, 0.025, "#e4c79a", 20);
          end.rotation.z = Math.PI / 2;
          for (let k = 1; k < 4; k++) {
            const r = torus(log, x, 0, 0, k * 0.09, 0.013, "#b99068");
            r.rotation.y = Math.PI / 2;
          }
        }
        for (let k = 0; k < 7; k++) {
          const a = (k / 7) * Math.PI * 2;
          tube(
            log,
            [-2.8, Math.cos(a) * 0.44, Math.sin(a) * 0.44],
            [2.8, Math.cos(a) * 0.44, Math.sin(a) * 0.44],
            0.025,
            "#9c795c",
          );
        }
        cyl(log, 0.6, 0.44, 0, 0.08, 0.17, 0.4, "#c8a079", 8).rotation.z = -0.5;
      }
      for (let i = 0; i < 4; i++) {
        const x = (i - 1.5) * 6.6;
        const ring = torus(w.root, x, 0.34, 3.5, 1.05, 0.055, "#e7b451");
        ring.rotation.x = Math.PI / 2;
        for (const side of [-1, 1])
          tube(
            w.root,
            [x + side * 2.9, 0.32, -9],
            [x + side * 2.9, 0.32, 7],
            0.025,
            "#d2b88b",
          );
      }
      w.splashes = Array.from({ length: 4 }, () => {
        const ring = torus(w.root, 0, 0.34, 0, 0.6, 0.035, "#fff0ce");
        ring.rotation.x = Math.PI / 2;
        return ring;
      });
    } else if (kind === "dash") {
      w.obstacles = [];
      for (let p = 0; p < 4; p++) {
        const base = (p - 1.5) * 7;
        box(w.root, base, 0.3, -1, 6.5, 0.2, 25, "#d1b1a0");
        box(w.root, base, 0.43, 6.5, 6.4, 0.04, 0.18, "#ffe18c");
        for (let lane = 0; lane < 2; lane++)
          box(
            w.root,
            base - 0.95 + lane * 1.9,
            0.42,
            -1,
            0.06,
            0.02,
            25,
            "#fff0ce",
          );
        const barrel = new T.Group(),
          hurdle = new T.Group(),
          bunting = new T.Group();
        for (const g of [barrel, hurdle, bunting]) w.root.add(g);
        const b = cyl(barrel, 0, 0.4, 0, 0.45, 0.45, 0.9, "#bc805c", 16);
        b.rotation.z = Math.PI / 2;
        for (const x of [-0.32, 0.32]) {
          const r = torus(barrel, x, 0.4, 0, 0.46, 0.06, "#e5c99d");
          r.rotation.y = Math.PI / 2;
        }
        box(hurdle, 0, 0.55, 0, 1.8, 0.2, 0.25, "#f4ce79");
        for (const x of [-0.7, 0.7])
          box(hurdle, x, 0.27, 0, 0.1, 0.55, 0.2, "#9e7866");
        for (const x of [-0.8, 0.8])
          tube(bunting, [x, 0, 0], [x, 2, 0], 0.05, "#947267");
        box(bunting, 0, 1.6, 0, 1.8, 0.65, 0.06, "#b28cca");
        w.obstacles.push({ barrel, hurdle, bunting });
      }
      for (let j = 0; j < 6; j++) {
        const z = -12 + j * 4;
        for (const side of [-1, 1]) {
          const g = box(
            w.root,
            side * 15,
            1.4,
            z,
            1.6,
            2.2,
            2.3,
            colors[j % 4],
          );
          box(w.root, side * 15, 2.7, z, 2, 0.2, 2.7, "#fff0d4");
        }
      }
    } else if (kind === "signal") {
      cyl(w.root, 0, 0.35, 1, 12, 12.5, 0.5, "#edd0a2", 48);
      cyl(w.root, 0, 0.65, 1, 11.5, 11.5, 0.15, "#9a88b9", 48);
      for (let i = 0; i < 4; i++) {
        const x = (i - 1.5) * 5.7;
        cyl(w.root, x, 0.85, 4, 2.1, 2.3, 0.35, colors[i], 24);
        box(w.root, x, 1.3, 2.5, 1.8, 0.8, 0.8, "#e6ba83");
        for (let k = 0; k < 4; k++)
          ball(
            w.root,
            x - 0.6 + k * 0.4,
            1.8,
            2.7,
            0.13,
            0.07,
            0.13,
            colors[k],
          );
      }
      w.signalFace = box(w.root, 0, 4, -5, 7, 3.8, 0.4, "#403959");
      w.signalLamp = ball(w.root, 0, 4, -4.7, 0.8, 0.8, 0.12, "#e5b371");
      for (const x of [-4, 4])
        tube(w.root, [x, 0.2, -5], [x, 6, -5], 0.12, "#d9c29e");
      w.signs = ["WAIT", "GO!"].map((text, i) => {
        const l = label(
          text,
          i ? "#fff5c9" : "#f6becd",
          i ? "#5f9c7b" : "#6c537b",
          0.8,
        );
        l.position.set(0, 6.7, -5);
        w.root.add(l);
        return l;
      });
    }
    return w;
  }
  function update(w, s, t) {
    roster(w, s);
    const kind = w.name,
      g = s?.game,
      beat = g?.cue || {
        index: 0,
        at: 3000,
        window: 1000,
        color: 1,
        lane: 1,
        kind: "barrel",
        values: [1, 3, -1],
      },
      dt = g ? t * 1000 - g.start - beat.at : -1000;
    const ps = g?.progress || [],
      ended = s && ["round-end", "side-result"].includes(s.phase),
      playing = s?.phase === "playing";
    if (kind === "lantern") {
      const last = g?.lanternLast,
        age = last ? t * 1000 - last.at : 2000;
      const layout = (age < 1100 ? last.layout : beat.layout) || [0, 1, 2, 3];
      w.tiles.forEach((tile, index) => {
        let drop = 0;
        if (last && index !== last.safeTile && age >= 0 && age < 1100)
          drop =
            age < 650 ? clamp(age / 650) ** 2 : 1 - clamp((age - 650) / 450);
        tile.position.y = -drop * 7;
        tile.rotation.x = drop * 0.12;
        tile.visible = drop < 0.99;
        tile.userData.surface.material = H.mat(colors[layout[index]]);
      });
    }
    w.actors.forEach((a, i) => {
      const v = ps[i] || { lane: i % 3, chosen: i, moveAt: 0 },
        hit = t * 1000 < (v.stunUntil || 0) || t * 1000 - (v.hitAt || 0) < 700,
        jump = clamp((t * 1000 - (v.jumpAt || 0)) / (v.jumpDuration || 900)),
        duck = t * 1000 - (v.duckAt || 0) < 850;
      let x = (i - 1.5) * 7,
        z = 6.5,
        y = 1,
        mode = "idle";
      if (["cascade", "dash"].includes(kind)) {
        const lane = v.lane,
          previous = v.fromLane ?? lane;
        const q = clamp((t * 1000 - (v.moveAt || 0)) / 250);
        x += (mix(previous, lane, q) - 1) * 1.9;
        mode = kind === "dash" ? "walk" : q < 1 ? "walk" : "idle";
        if (kind === "dash") {
          y += Math.sin(jump * Math.PI) * 1.6;
          if (duck) mode = "duck";
        }
      }
      if (kind === "lantern") {
        const tile = v.chosen ?? i,
          prev = v.fromLane ?? i,
          q = clamp((t * 1000 - (v.moveAt || 0)) / 420),
          ease = q * q * (3 - 2 * q);
        const pos = R.lanternPositions[tile],
          from = R.lanternPositions[prev];
        x = mix(from[0], pos[0], ease) + (i % 2 ? 1 : -1) * 0.7;
        z = mix(from[1], pos[1], ease) + (i < 2 ? -0.5 : 0.5);
        y =
          0.48 +
          (q < 1 ? Math.sin(q * Math.PI) * 1.5 : w.tiles[tile].position.y);
        mode = q < 1 ? "jump" : "idle";
      }
      if (kind === "hop") {
        x = (i - 1.5) * 6.6;
        z = 3.5;
        y = 0.42 + Math.sin(jump * Math.PI) * 2.1;
        mode = jump > 0 && jump < 1 ? "jump" : "idle";
      }
      if (kind === "signal") {
        x = (i - 1.5) * 5.7;
        z = 4;
        y = 1.1;
        mode = t * 1000 - (v.last || 0) < 600 ? "fish" : "idle";
      }
      if (hit) {
        mode = "sad";
        y -= Math.sin(clamp((t * 1000 - v.hitAt) / 700) * Math.PI) * 0.4;
      }
      a.rotation.x = 0;
      a.rotation.z = 0;
      if (v.eliminatedAt) {
        const age = t * 1000 - v.eliminatedAt;
        if (kind === "lantern") {
          const pos = R.lanternPositions[v.fallTile ?? v.chosen ?? i],
            side = pos[0] < 0 ? -1 : 1;
          const dive = clamp(age / 650),
            escape = clamp((age - 650) / 800),
            swim = clamp((age - 1450) / 3500);
          x = mix(pos[0] + (i % 2 ? 0.65 : -0.65), side * 9.5, escape);
          z = mix(pos[1], -13.5, swim);
          y =
            age < 650
              ? 0.48 - dive * dive * 2.2
              : age < 1450
                ? -1.75
                : mix(-1.25, 0.25, clamp((age - 4500) / 500));
          a.rotation.x = age < 1450 ? dive * 0.5 : age < 4800 ? -0.8 : 0;
          mode = age < 4800 ? "walk" : "sad";
        } else {
          const q = clamp(age / 900);
          x = (i - 1.5) * 6.6;
          z = mix(3.5, 8, q);
          y = 0.42 + Math.sin(q * Math.PI) * 0.5;
          mode = "sad";
          a.rotation.z = Math.sin(q * Math.PI) * 1.3;
        }
      }
      if (w.splashes) {
        const age = t * 1000 - (v.eliminatedAt || 0),
          ring = w.splashes[i];
        ring.visible = !!v.eliminatedAt && age > 300 && age < 1600;
        ring.position.x = x;
        ring.position.z = z;
        ring.scale.setScalar(0.5 + clamp((age - 300) / 1300) * 1.8);
      }
      if (kind === "cascade") {
        if (!a.userData.stars) {
          const stars = new T.Group();
          a.add(stars);
          a.userData.stars = stars;
          for (let j = 0; j < 3; j++) {
            const m = ball(
              stars,
              Math.cos(j * 2.094) * 0.6,
              2.5,
              Math.sin(j * 2.094) * 0.6,
              0.12,
              0.12,
              0.12,
              "#ffe085",
            );
          }
        }
        a.userData.stars.visible = t * 1000 < (v.stunUntil || 0);
        a.userData.stars.rotation.y = t * 4;
        if (hit) a.rotation.z = Math.sin(t * 9) * 0.12;
      }
      a.position.set(x, y, z);
      a.rotation.y = 0.2;
      a.scale.setScalar(0.8);
      animateCharacter(
        a,
        t + i,
        ended
          ? g.winners?.includes(a.userData.playerId)
            ? "win"
            : "sad"
          : mode,
      );
    });
    if (kind === "cascade") {
      const drops = g?.drops || [
        { index: 0, at: 3000, window: 1000, values: [1, 3, -3] },
      ];
      w.objects.forEach((o) => {
        const drop = drops.find((b) => b.index % 3 === o.slot),
          due = (g?.start || 0) + (drop?.at || 0) + (drop?.window || 0),
          age = t * 1000 - (due - 2000),
          q = clamp(age / 2000);
        o.g.visible =
          !!drop &&
          playing &&
          !ended &&
          age >= 0 &&
          age < 2200 &&
          (!g || g.active.includes(o.p));
        const value = drop?.values[o.lane] || 0;
        o.g.position.set(
          (o.p - 1.5) * 7 + (o.lane - 1) * 1.9,
          10.2 - 8.4 * q * q,
          6,
        );
        if (age > 2000) {
          o.g.position.y = 1.8 - (age - 2000) / 110;
          o.g.scale.setScalar(1 - clamp((age - 2000) / 200));
        } else o.g.scale.setScalar(1);
        o.prize.visible = value > 0;
        o.bundle.visible = value >= 3;
        o.spike.visible = value < 0;
        o.prize.rotation.y = t * 2.4;
        o.spike.rotation.z = t * 3;
      });
    }
    if (kind === "lantern") {
      const reveal = Math.max(
          (g?.start || 0) + beat.at - 1800,
          (g?.lanternLast?.at || 0) + 1100,
        ),
        age = t * 1000 - reveal;
      const q = clamp(age / 650),
        ease = q * q * (3 - 2 * q);
      w.flag.material = w.cardFace.material = H.mat(colors[beat.color]);
      animateCharacter(w.marshal, t, "idle");
      w.marshal.userData.arms[1].rotation.x = mix(-0.1, -1.55, ease);
      w.marshal.userData.arms[1].rotation.z = mix(-0.35, 0.25, ease);
      w.flagGroup.visible = playing && age >= 0;
      w.flagGroup.scale.setScalar(clamp(age / 280));
      w.flagGroup.rotation.x = 0.15;
    }
    if (kind === "hop") {
      const height = { small: 0.75, medium: 1, large: 1.35 }[beat.size] || 1;
      w.wave.visible = playing && dt > -2400 && dt < 950;
      w.wave.position.set(0, 0.32 + 0.46 * height, 3.5 + dt * 0.005);
      w.wave.scale.set(1, height, height);
      w.wave.children.forEach((log) => {
        log.rotation.x = (dt * 0.005) / (0.46 * height);
      });
    }
    if (kind === "dash")
      w.obstacles.forEach((o, p) => {
        for (const [name, mesh] of Object.entries(o)) {
          mesh.visible = name === beat.kind && !ended;
          mesh.position.set(
            (p - 1.5) * 7 + (beat.lane - 1) * 1.9,
            0.5,
            mix(-12, 8, clamp((dt + 1800) / (1800 + beat.window))),
          );
          if (name === "barrel") mesh.rotation.x = t * 3;
        }
      });
    if (kind === "signal") {
      const go = dt >= 0 && dt < beat.window;
      w.signalLamp.material = H.mat(
        go
          ? colors[beat.color]
          : beat.fake && dt > -900
            ? "#ee98a7"
            : "#f6c875",
      );
      w.signs[0].visible = !go;
      w.signs[1].visible = go;
    }
    return {
      target: new T.Vector3(0, 1, kind === "lantern" ? 1 : 0),
      extent: kind === "lantern" ? 22 : kind === "signal" ? 25 : 27,
      position: kind === "lantern" ? [13, 23, 26] : [10, 27, 35],
    };
  }
  return { build, update };
}
