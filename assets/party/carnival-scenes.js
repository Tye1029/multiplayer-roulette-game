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
    roster,
    animateCharacter,
    palm,
    building,
    cloud,
    mix,
    clamp,
  } = H;
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
    if (kind !== "lantern") {
      box(w.root, 0, -0.4, 0, 35, 1, 35, "#e8ce9a");
      box(w.root, 0, 0.13, 0, 34.5, 0.1, 34.5, "#8ec9a0");
    } else box(w.root, 0, -0.4, -14, 35, 1, 6, "#e8ce9a");
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
    for (const x of [-15, 15])
      for (let i = 0; i < 5; i++) {
        const z = -10 + i * 5;
        tube(w.root, [x, 0.2, z], [x, 3.6, z], 0.055, "#8e7975");
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
    if (["cascade", "treasure"].includes(kind)) {
      w.objects = [];
      w.waves = [];
      for (let p = 0; p < 4; p++) {
        const base = (p - 1.5) * 7;
        if (kind === "cascade") {
          box(w.root, base, 0.55, -1, 6.6, 0.5, 21, "#616d85");
          for (let z = -10; z < 9; z += 0.65)
            box(w.root, base, 0.83, z, 6.35, 0.05, 0.06, "#b3c0c6");
          for (const side of [-1, 1])
            box(w.root, base + side * 3.25, 1, -1, 0.12, 0.4, 21, "#f1c582");
        } else {
          box(w.root, base, 0.35, 1, 6.5, 0.35, 16, "#f1dca8");
          const wave = box(w.root, base, 0.66, -6, 6.4, 0.25, 1.1, "#75cdce");
          w.waves.push(wave);
        }
        const row = [];
        for (let lane = 0; lane < 3; lane++) {
          const x = base + (lane - 1) * 1.9;
          box(w.root, x, 0.86, 6, 1.7, 0.12, 0.45, "#f6d478");
          const g = new T.Group();
          w.root.add(g);
          const prize = coin(g, 0, 0, 0, 0.4);
          const crate = box(g, 0, 0, 0, 0.8, 0.8, 0.8, "#9b735f");
          box(crate, 0, 0, 0.42, 0.65, 0.12, 0.04, "#e7c09c");
          const bundle = coin(g, 0.25, 0.3, 0, 0.3);
          const spike = new T.Group();
          g.add(spike);
          ball(spike, 0, 0, 0, 0.45, 0.45, 0.45, "#79677e");
          for (let j = 0; j < 8; j++) {
            const a = (j / 8) * Math.PI * 2;
            const thorn = cyl(
              spike,
              Math.cos(a) * 0.47,
              Math.sin(a) * 0.47,
              0,
              0,
              0.13,
              0.35,
              "#e0c7b5",
              5,
            );
            thorn.rotation.z = a - Math.PI / 2;
          }
          row.push({ g, prize, crate, bundle, spike });
          if (kind === "treasure") {
            const sign = label(
              ["LEFT", "MID", "RIGHT"][lane],
              "#6a4d6b",
              "#fff0c6",
              0.21,
            );
            sign.position.set(x, 1.3, -3);
            w.root.add(sign);
          }
        }
        w.objects.push(row);
      }
    } else if (kind === "lantern") {
      // Open water below the separate platforms makes elimination a real fall.
      const positions = [
        [-4, -3],
        [4, -3],
        [-4, 4],
        [4, 4],
      ];
      for (let i = 0; i < 4; i++) {
        const [x, z] = positions[i],
          g = new T.Group();
        g.position.set(x, 0.6, z);
        w.root.add(g);
        cyl(g, 0, 0, 0, 3, 2.8, 0.65, "#ecdbb5", 32);
        cyl(g, 0, 0.4, 0, 2.7, 2.7, 0.12, colors[i], 32);
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          ball(
            g,
            Math.cos(a) * 2.8,
            0.5,
            Math.sin(a) * 2.8,
            0.12,
            0.12,
            0.12,
            "#fff0c5",
          );
        }
        w.tiles.push(g);
      }
      w.lantern = ball(w.root, 0, 6, 0, 0.8, 1, 0.8, colors[0]);
      tube(w.root, [0, 6.8, 0], [0, 10, 0], 0.04, "#6f6377");
      const arch = torus(w.root, 0, 4, -7, 5, 0.13, "#edb75e");
      arch.scale.y = 0.7;
    } else if (kind === "hop") {
      box(w.root, 0, 0.34, -1, 30, 0.2, 20, "#68c3c9");
      w.wave = new T.Group();
      w.root.add(w.wave);
      for (let x = -13; x < 14; x += 0.6) {
        const crest = ball(w.wave, x, 0.55, 0, 0.55, 0.8, 0.5, "#77d5d7");
        ball(w.wave, x, 0.95, 0.1, 0.4, 0.2, 0.3, "#e0f5dc");
      }
      for (let i = 0; i < 4; i++) {
        const x = (i - 1.5) * 6.6;
        cyl(w.root, x, 0.5, 3.5, 2.7, 2.9, 0.8, "#efd5a0", 32);
        cyl(w.root, x, 0.94, 3.5, 2.5, 2.5, 0.12, colors[i], 32);
        box(w.root, x, 1.03, 4.3, 4.5, 0.04, 0.18, "#ffe28f");
      }
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
      ended = s && ["round-end", "side-result"].includes(s.phase);
    if (kind === "lantern")
      w.tiles.forEach((tile, index) => {
        const hit = ps
          .filter(
            (v) =>
              (v.chosen ?? ps.indexOf(v)) === index &&
              v.eliminatedAt &&
              t * 1000 - v.eliminatedAt < 1600,
          )
          .reduce((n, v) => Math.max(n, v.eliminatedAt), 0);
        const q = hit ? clamp((t * 1000 - hit) / 1100) : 0;
        tile.position.y = 0.6 - q * q * 8;
        tile.rotation.z = q * 0.35;
        tile.visible = q < 1;
      });
    w.actors.forEach((a, i) => {
      const v = ps[i] || { lane: i % 3, chosen: i, moveAt: 0 },
        hit = t * 1000 - (v.hitAt || 0) < 700,
        jump = clamp((t * 1000 - (v.jumpAt || 0)) / 900),
        duck = t * 1000 - (v.duckAt || 0) < 850;
      let x = (i - 1.5) * 7,
        z = 6.5,
        y = 1,
        mode = "idle";
      if (["cascade", "dash", "treasure"].includes(kind)) {
        const lane = kind === "treasure" ? (v.chosen ?? 1) : v.lane,
          previous = v.fromLane ?? lane;
        const q = clamp((t * 1000 - (v.moveAt || 0)) / 250);
        x += (mix(previous, lane, q) - 1) * 1.9;
        mode = kind === "dash" ? "walk" : q < 1 ? "walk" : "idle";
        if (kind === "dash") {
          y += Math.sin(jump * Math.PI) * 1.6;
          if (duck) mode = "duck";
        }
        if (kind === "treasure") y = 0.56;
      }
      if (kind === "lantern") {
        const pos = [
          [-4, -3],
          [4, -3],
          [-4, 4],
          [4, 4],
        ][v.chosen ?? i];
        x = pos[0] + (i % 2 ? 1 : -1) * 0.7;
        z = pos[1] + (i < 2 ? -0.5 : 0.5);
        y = 1.1 + w.tiles[v.chosen ?? i].position.y - 0.6;
        a.userData.landX = mix(a.userData.landX ?? x, x, 0.2);
        a.userData.landZ = mix(a.userData.landZ ?? z, z, 0.2);
        x = a.userData.landX;
        z = a.userData.landZ;
        mode = t * 1000 - v.moveAt < 500 ? "walk" : "idle";
      }
      if (kind === "hop") {
        x = (i - 1.5) * 6.6;
        z = 3.5;
        y = 1.05 + Math.sin(jump * Math.PI) * 2;
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
      if (v.eliminatedAt) {
        const q = clamp((t * 1000 - v.eliminatedAt) / 1100);
        y = 1.1 - q * q * 8;
        a.rotation.z = q;
        a.visible = q < 1;
      } else a.rotation.z = 0;
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
    if (["cascade", "treasure"].includes(kind))
      w.objects.forEach((row, p) => {
        row.forEach((o, lane) => {
          const value = beat.values[lane];
          o.g.visible =
            !ended &&
            value !== 0 &&
            (!s?.game || s.game.participants.includes(s.players[p]?.id));
          o.g.position.set(
            (p - 1.5) * 7 + (lane - 1) * 1.9,
            kind === "cascade" ? 1.5 : 1.2,
            kind === "cascade"
              ? mix(-9, 6, clamp((dt + 2500) / (2500 + beat.window)))
              : mix(-7, 6, clamp((dt + 1000) / (1000 + beat.window))),
          );
          o.prize.visible = value > 0;
          o.bundle.visible = value >= 3;
          o.crate.visible = value < 0 && kind === "cascade";
          o.spike.visible = value < 0 && kind === "treasure";
          o.spike.rotation.z = t * 3;
          o.prize.rotation.y = t * 2.5;
          o.bundle.rotation.y = -t * 3;
          if (kind === "treasure")
            o.g.position.y = 1.2 + Math.sin(t * 2 + lane) * 0.1;
        });
        if (kind === "treasure")
          w.waves[p].position.z = mix(-7, 7, clamp((dt + 2000) / 3000));
      });
    if (kind === "lantern") {
      w.lantern.material = H.mat(colors[beat.color]);
      w.lantern.position.y = 6 + Math.sin(t * 1.5) * 0.2;
    }
    if (kind === "hop")
      w.wave.position.z = mix(-9, 7, clamp((dt + 2300) / 2900));
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
