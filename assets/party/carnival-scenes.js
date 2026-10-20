import {
  surfaceMaterial,
  island,
} from "./surface-art.js?v=BOARDWALK_CARNIVAL_V12";
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
  function common(kind) {
    const w = world(kind);
    if (w.built) return w;
    w.built = true;
    water(w);
    if (["lantern", "hop"].includes(kind)) {
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
          if (j % 3 === 0 && Math.abs(x) > 16) {
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
        for (let j = 0; j < 12; j++) {
          if (Math.abs(-18 + j * 3.3) < 15) continue;
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
        }
        building(w, 16, -10, 0.75, "#f0c198", "#88b7be", "SURF WATCH");
        for (const x of [-15, 15])
          for (let j = 0; j < 4; j++) {
            const z = -8 + j * 7;
            tube(w.root, [x, 0.3, z], [x, 1.3, z], 0.065, "#b38c66");
            if (j < 3)
              tube(w.root, [x, 1.1, z], [x, 1.1, z + 7], 0.027, "#e6cf9c");
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
      }
    } else if (kind !== "lantern") {
      box(w.root, 0, -0.4, 0, 35, 1, 35, "#e8ce9a");
      box(w.root, 0, 0.13, 0, 34.5, 0.1, 34.5, "#8ec9a0");
    } else box(w.root, 0, -0.4, -14, 35, 1, 6, "#e8ce9a");
    if (!["lantern", "hop"].includes(kind))
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
    if (!["lantern", "hop"].includes(kind))
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
    if (kind === "lantern") {
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
      w.flagGroup.position.set(0.1, -0.52, 0.15);
      w.flag = box(w.flagGroup, 0, -0.36, 0.04, 1.05, 0.78, 0.07, colors[0]);
      box(w.flagGroup, 0, -0.36, 0.085, 0.85, 0.59, 0.015, "#fff5d4");
      w.cardFace = box(w.flagGroup, 0, -0.36, 0.1, 0.73, 0.49, 0.02, colors[0]);
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
        // A flush knot keeps the visible silhouette inside the collision radius.
        cyl(log, 0.6, 0.43, 0, 0.12, 0.12, 0.04, "#d2af83", 12);
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
      w.dizzyStars = Array.from({ length: 4 }, () => {
        const group = new T.Group();
        for (let j = 0; j < 3; j++) {
          const star = label("★", "#e8ae2f", null, 0.45);
          group.add(star);
        }
        w.root.add(group);
        return group;
      });
      w.waves = [w.wave];
      for (let n = 1; n < 4; n++) {
        const next = w.wave.clone(true);
        w.root.add(next);
        w.waves.push(next);
      }
      w.wakes = w.waves.map(() => {
        const wake = torus(w.root, 0, -0.5, -18, 1, 0.035, "#daf7ed");
        wake.rotation.x = Math.PI / 2;
        wake.scale.set(13, 0.65, 1);
        return wake;
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
    if (w.eventSession !== s?.game?.start) {
      w.eventSession = s?.game?.start;
      w.eventClocks = {};
    }
    const eventStart = (key, at) =>
      PartyPresentation.eventStart(w.eventClocks, key, at, t * 1000);
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
    const ps = (g?.progress || []).map((v, i) => {
        if (kind === "hop" && s?.phase === "playing" && !v.finished) {
          const contact = (g.rollers || []).find(
            (b) =>
              b.index > v.resolved &&
              t * 1000 >= g.start + b.at &&
              t * 1000 < g.start + b.at + 2500,
          );
          if (
            contact &&
            !(
              v.hopAttempt?.index === contact.index &&
              R.hopClear(contact, g.start + contact.at, v.jumpAt)
            )
          ) {
            v = {
              ...v,
              hitAt: g.start + contact.at,
              stunUntil: g.start + contact.at + 2500,
            };
          }
        }
        return ["lantern", "hop"].includes(kind)
          ? {
              ...v,
              eliminatedAt: eventStart("fall" + i, v.eliminatedAt),
              hitAt: eventStart("hit" + i, v.hitAt),
            }
          : v;
      }),
      ended = s && ["round-end", "side-result"].includes(s.phase),
      playing = s?.phase === "playing";
    if (kind === "lantern") {
      const last = g?.lanternLast
          ? { ...g.lanternLast, at: eventStart("hatch", g.lanternLast.at) }
          : null,
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
      if (kind === "dash") {
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
        y =
          0.42 +
          R.hopHeight(
            t * 1000 - (v.jumpAt || 0),
            v.hopAttempt?.size || beat.size,
          );
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
      a.position.set(x, y, z);
      if (kind === "lantern" && !v.eliminatedAt && v.moveAt) {
        const from = R.lanternPositions[v.fromLane ?? i],
          to = R.lanternPositions[v.chosen ?? i];
        const q = clamp((t * 1000 - v.moveAt) / 420);
        const facing = Math.atan2(to[0] - from[0], to[1] - from[1]);
        a.rotation.y = mix(facing, 0.2, clamp((q - 0.82) / 0.18));
      } else a.rotation.y = 0.2;
      a.scale.setScalar(0.8);
      const falling =
        kind === "lantern" &&
        v.eliminatedAt &&
        t * 1000 - v.eliminatedAt < 4950;
      if (falling) a.userData.resultMode = null;
      animateCharacter(
        a,
        t + i,
        ended && !falling
          ? g.winners?.includes(a.userData.playerId)
            ? "win"
            : "sad"
          : mode,
      );
      if (kind === "lantern" && !v.eliminatedAt) {
        const q = clamp((t * 1000 - (v.moveAt || 0)) / 420);
        const tuck = Math.sin(q * Math.PI);
        a.userData.rig.position.y = 0;
        a.userData.rig.rotation.x = -tuck * 0.2;
        a.userData.legs.forEach((leg, j) => {
          leg.rotation.x = -tuck * (j ? 0.55 : 0.8);
        });
        a.userData.arms.forEach((arm, j) => {
          arm.rotation.x = -tuck * 1.3;
          arm.rotation.z = (j ? 1 : -1) * tuck * 0.4;
        });
      }
      if (falling) {
        const age = t * 1000 - v.eliminatedAt;
        a.userData.arms.forEach((arm, j) => {
          arm.rotation.z = age < 650 ? (j ? 1 : -1) * 1.6 : (j ? 1 : -1) * 0.7;
          arm.rotation.x =
            age > 1450 && age < 4800
              ? Math.sin(t * 7 + j * Math.PI) * 1.15
              : -0.3;
        });
      }
      if (kind === "hop" && !v.eliminatedAt) {
        const q = clamp((t * 1000 - (v.jumpAt || 0)) / (v.jumpDuration || 820));
        const tuck = Math.sin(q * Math.PI);
        a.userData.rig.position.y = 0;
        a.userData.legs.forEach((leg, j) => {
          leg.rotation.x = tuck * (j ? -0.48 : -0.65);
        });
        a.userData.arms.forEach((arm, j) => {
          arm.rotation.x = -tuck * 1.2;
          arm.rotation.z = (j ? 1 : -1) * tuck * 0.5;
        });
        if (hit) {
          const age = t * 1000 - v.hitAt;
          const knock = Math.sin(clamp(age / 500) * Math.PI);
          const recover = 1 - clamp((age - 1950) / 550);
          a.position.y = 0.42 + knock * 0.3;
          a.position.z += Math.sin(clamp(age / 2500) * Math.PI) * 0.8;
          a.rotation.z = knock * 0.7 + Math.sin(t * 11) * 0.1 * recover;
          a.userData.rig.rotation.x = recover * 0.18;
          a.userData.arms.forEach((arm, j) => {
            arm.rotation.z = (j ? 1 : -1) * 1.4;
          });
        }
      }
    });
    if (kind === "hop")
      w.dizzyStars.forEach((group, i) => {
        const v = ps[i],
          a = w.actors[i];
        group.visible = !!v && !v.eliminatedAt && t * 1000 < (v.stunUntil || 0);
        group.position.copy(a.position).add(new T.Vector3(0, 2.1, 0));
        group.children.forEach((star, j) => {
          const angle = t * 4 + (j * Math.PI * 2) / 3;
          star.position.set(
            Math.cos(angle) * 0.65,
            Math.sin(angle * 2) * 0.12,
            Math.sin(angle) * 0.4,
          );
        });
      });
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
      w.marshal.userData.arms[1].rotation.x = mix(-0.5, -0.12, ease);
      w.marshal.userData.arms[1].rotation.z = mix(-0.35, 1.45, ease);
      w.flagGroup.visible = playing && age >= 0;
      w.flagGroup.scale.setScalar(clamp(age / 280));
      // Counter-rotate the card so its face remains toward the players as the
      // right hand extends past the body. Its top edge stays held in the hand.
      w.flagGroup.rotation.set(0.12, 0, -w.marshal.userData.arms[1].rotation.z);
      if (w.cardColor !== beat.color) {
        w.cardColor = beat.color;
        w.cardChangedAt = t;
      }
      w.flagGroup.rotation.y =
        Math.sin(clamp((t - w.cardChangedAt) / 0.23) * Math.PI) * 0.65;
    }
    if (kind === "hop") {
      const rollers = g?.rollers || [];
      w.waves.forEach((wave, slot) => {
        const b = rollers.find((b) => b.index % 4 === slot);
        const z = b ? 3.5 + (t * 1000 - g.start - b.at) * b.speed : -30;
        const r = R.hopRadius(b?.size);
        wave.visible = playing && !!b && z >= -23 && z < 27;
        // Break the surface, roll onto the beach, then sink into the far shallows.
        const shore = clamp((z + 19) / 6),
          exit = clamp((z - 19) / 7);
        const ground =
          mix(-0.85, 0.32, shore * shore * (3 - 2 * shore)) - exit * 2.6;
        wave.position.set(0, ground + r, z);
        wave.scale.set(1, r / 0.46, r / 0.46);
        wave.children.forEach((log) => {
          log.rotation.x = (z + 23) / r;
        });
        const wake = w.wakes[slot];
        wake.visible = wave.visible && (shore < 1 || exit > 0);
        wake.position.set(0, -0.52, z);
        wake.scale.set(13.5, 0.7 + Math.sin(t * 6) * 0.2, 1);
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
