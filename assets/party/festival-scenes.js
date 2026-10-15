export function festivalScenes(H) {
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
    mat,
    mix,
    clamp,
  } = H;
  const palette = ["#83d5ed", "#f2a3c4", "#8fd5aa", "#f7cf72"],
    TAU = Math.PI * 2;
  const lanes = ["kart", "orchard", "volley", "boats", "spotlight"];
  function sign(parent, text, x, y, z, size = 0.35, color = "#624d7a") {
    const p = label(text, "#fff6d9", color, size);
    p.position.set(x, y, z);
    parent.add(p);
    return p;
  }
  function ring(parent, x, y, z, r, color) {
    const m = torus(parent, x, y, z, r, 0.07, color);
    m.rotation.x = Math.PI / 2;
    return m;
  }
  function fruit(parent, color) {
    const p = new T.Group();
    parent.add(p);
    ball(p, 0, 0, 0, 0.38, 0.4, 0.38, color);
    tube(p, [0, 0.3, 0], [0.07, 0.59, 0], 0.04, "#7d6849");
    const leaf = ball(p, 0.2, 0.48, 0, 0.22, 0.06, 0.1, "#5b9c79");
    leaf.rotation.z = 0.35;
    return p;
  }
  function kart(parent, color) {
    const k = new T.Group();
    parent.add(k);
    box(k, 0, 0.45, 0, 1.35, 0.38, 1.9, color);
    box(k, 0, 0.7, -0.5, 1, 0.35, 0.5, "#fff0c5");
    for (const x of [-0.72, 0.72])
      for (const z of [-0.65, 0.65]) {
        const wheel = cyl(k, x, 0.3, z, 0.32, 0.32, 0.24, "#44445e", 16);
        wheel.rotation.z = Math.PI / 2;
        const hub = cyl(k, x * 1.12, 0.3, z, 0.15, 0.15, 0.03, "#f6d27b", 12);
        hub.rotation.z = Math.PI / 2;
      }
    const steering = torus(k, 0, 1, -0.2, 0.28, 0.06, "#685672");
    steering.rotation.x = -0.5;
    box(k, 0, 0.6, 1.05, 1.7, 0.12, 0.3, "#fff1c9");
    return k;
  }
  function cannon(parent, color) {
    const c = new T.Group();
    parent.add(c);
    cyl(c, 0, 0.3, 0, 0.9, 1.1, 0.5, color, 20);
    const gun = new T.Group();
    c.add(gun);
    const barrel = cyl(gun, 0, 1, -0.45, 0.35, 0.44, 1.6, "#725d83", 20);
    barrel.rotation.x = Math.PI / 2;
    const rim = torus(gun, 0, 1, -1.25, 0.35, 0.08, "#edc578");
    ball(gun, 0, 1, -0.3, 0.48, 0.48, 0.48, "#8e79a5");
    tube(gun, [0, 1, -1.3], [0, 1, -5], 0.018, "#ffeaa0");
    c.userData.gun = gun;
    return c;
  }
  function build(id) {
    const w = world(id);
    if (w.built) return w;
    w.built = true;
    water(w);
    w.stations = [];
    w.fx = [];
    const aquatic = ["boats", "bomb", "cannon", "volley", "rope"].includes(id);
    if (!aquatic) {
      box(w.root, 0, -0.3, 0, 39, 0.8, 33, "#e8cfa3");
      box(w.root, 0, 0.12, 0, 38.5, 0.1, 32.5, "#a0cca5");
    } else box(w.root, 0, -0.2, -12, 39, 0.9, 6, "#e9d2a8");
    for (let i = 0; i < 7; i++) {
      palm(w, -17 + i * 5.5, -13, 0.75 + (i % 2) * 0.2);
      if (i % 2 === 0)
        building(
          w,
          -16 + i * 5,
          -16,
          0.55,
          palette[i % 4],
          "#f7dbab",
          ["FESTIVAL", "SNACKS", "PLAY", "TICKETS"][i / 2],
        );
      cloud(w, -30 + i * 10, 12, -22, 1.8);
    }
    sign(
      w.root,
      C.games.find((g) => g.id === id).name.toUpperCase(),
      0,
      6,
      -11,
      0.75,
    );
    if (["bomb", "cannon"].includes(id)) {
      cyl(w.root, 0, 0.1, 0, 9.7, 10, 0.55, "#d6af85", 48);
      cyl(w.root, 0, 0.4, 0, 9.4, 9.4, 0.08, "#8dbec1", 48);
      ring(w.root, 0, 0.49, 0, 8, "#fff0b7");
      w.bubble = new T.Group();
      w.root.add(w.bubble);
      w.bombBody = ball(w.bubble, 0, 0, 0, 0.34, 0.36, 0.34, "#394058");
      ball(w.bubble, -0.1, 0.12, 0.27, 0.08, 0.12, 0.025, "#8a91af");
      cyl(w.bubble, 0, 0.36, 0, 0.12, 0.14, 0.13, "#b3a084", 12);
      w.fuse = tube(w.bubble, [0, 0.4, 0], [0.14, 0.76, 0], 0.025, "#e7c38d");
      w.spark = new T.Group();
      w.bubble.add(w.spark);
      ball(w.spark, 0, 0, 0, 0.085, 0.085, 0.085, "#ffe8a1");
      w.sparks = Array.from({ length: 6 }, (_, i) =>
        ball(
          w.spark,
          Math.cos(i) * 0.15,
          Math.sin(i) * 0.15,
          0,
          0.025,
          0.025,
          0.025,
          i % 2 ? "#ffa859" : "#fff3ae",
        ),
      );
      w.projectiles = Array.from({ length: 24 }, () => {
        const p = ball(w.root, 0, 1, 0, 0.28, 0.28, 0.28, "#bb8963");
        p.visible = false;
        return p;
      });
      w.burst = new T.Group();
      w.root.add(w.burst);
      for (let i = 0; i < 14; i++)
        ball(
          w.burst,
          Math.cos(i) * 0.8,
          Math.sin(i * 2) * 0.5,
          Math.sin(i) * 0.8,
          0.12,
          0.12,
          0.12,
          palette[i % 4],
        );
    }
    if (id === "rope") {
      w.rope = new T.Group();
      w.root.add(w.rope);
      for (let i = 0; i < 32; i++) {
        const x = -15 + (i * 30) / 31;
        ball(
          w.rope,
          x,
          Math.sin((i / 31) * Math.PI) * 0.3,
          0,
          0.5,
          0.09,
          0.09,
          i % 2 ? "#f6d87b" : "#d691b7",
        );
      }
      for (const x of [-16, 16]) {
        tube(w.root, [x, 0.3, 0], [x, 4, 0], 0.16, "#9a7480");
        ball(w.root, x, 4, 0, 0.45, 0.45, 0.45, "#ffd77c");
      }
    }
    if (id === "tug") {
      w.tugRope = box(w.root, 0, 1.2, 0, 19, 0.12, 0.12, "#e4b779");
      w.buoy = ball(w.root, 0, 1.3, 0, 0.5, 0.75, 0.5, "#ed8c9d");
      for (const x of [-8, 8]) ring(w.root, x, 0.3, 0, 2, "#ffdb8b");
    }
    if (id === "kart") {
      box(w.root, 0, 0.28, 0, 11.2, 0.3, 25, "#73879c");
      for (const x of [-1.8, 1.8])
        for (let z = -11; z < 12; z += 1.4)
          box(w.root, x, 0.46, z, 0.09, 0.03, 0.75, "#fff0c6");
      for (const side of [-1, 1])
        for (let j = 0; j < 32; j++)
          box(
            w.root,
            side * 5.75,
            0.55,
            -12 + j * 0.78,
            0.4,
            0.35,
            0.72,
            j % 2 ? "#f1d7bc" : "#cf8d9e",
          );
      for (let x = -5; x < 5; x += 0.8)
        for (let row = 0; row < 2; row++)
          box(
            w.root,
            x,
            0.47,
            -10 + row * 0.5,
            0.8,
            0.03,
            0.5,
            (Math.round(x / 0.8) + row) % 2 ? "#fff3d4" : "#58657e",
          );
      for (const x of [-6.4, 6.4])
        tube(w.root, [x, 0.4, -10], [x, 4.6, -10], 0.15, "#a484a7");
      sign(w.root, "CORAL GRAND PRIX", 0, 4.8, -10, 0.65);
      for (const side of [-1, 1])
        for (let n = 0; n < 4; n++) {
          box(w.root, side * 8.4, 0.8, -7 + n * 4, 2.4, 0.4, 2.5, "#d1ad83");
          const fan = H.mascot(C.characters[(n + (side > 0 ? 4 : 0)) % 8].id);
          fan.position.set(side * 8.4, 1.05, -7 + n * 4);
          fan.scale.setScalar(0.6);
          w.root.add(fan);
          w.animated.push((t) => animateCharacter(fan, t + n, "win"));
        }
    }
    for (let slot = 0; slot < 4; slot++) {
      const p = new T.Group();
      w.root.add(p);
      const st = { root: p, objects: [], slot };
      w.stations.push(st);
      const color = palette[slot];
      if (lanes.includes(id)) {
        if (id !== "kart") {
          box(
            p,
            0,
            0.25,
            0,
            6.6,
            0.25,
            23,
            id === "boats"
              ? "#6fc1ce"
              : id === "volley"
                ? "#f1d6a5"
                : "#8e9caf",
          );
          for (const x of [-1, 1])
            box(p, x, 0.4, 0, 0.07, 0.04, 22.5, "#fff2cc");
          for (let i = 0; i < 14; i++)
            box(
              p,
              0,
              0.42,
              -10 + i * 1.5,
              6.5,
              0.02,
              0.08,
              i % 2 ? "#c2b8b6" : "#e9dcbf",
            );
          box(p, 0, 0.44, 6, 6.5, 0.04, 0.18, "#ffe29a");
        }
        if (id === "kart") {
          st.kart = kart(p, color);
          st.barrel = cyl(p, 0, 0.9, -6, 0.45, 0.45, 1, "#b57d60", 16);
          for (let i = 0; i < 3; i++) {
            const b = box(
              p,
              0,
              0.46,
              -5 + i * 0.35,
              1.45,
              0.05,
              0.16,
              "#b4f08b",
            );
            st.objects.push(b);
          }
          st.flame = ball(st.kart, 0, 0.4, 1.6, 0.25, 0.22, 0.9, "#f9d07c");
        } else if (id === "orchard") {
          st.fruit = palette.map((c) => fruit(p, c));
          st.basket = cyl(p, 0, 0.8, 6, 0.65, 0.5, 0.6, "#bc9768", 14);
          for (let k = 0; k < 4; k++) {
            box(p, -2.1 + k * 1.4, 0.7, 9, 1.1, 0.6, 1, palette[k]);
            sign(p, ["B", "P", "M", "G"][k], -2.1 + k * 1.4, 1.25, 9, 0.2);
          }
        } else if (id === "boats") {
          st.boat = new T.Group();
          p.add(st.boat);
          ball(st.boat, 0, 0.5, 0, 0.85, 0.4, 1.65, color);
          box(st.boat, 0, 0.7, 0, 1.1, 0.16, 1.7, "#f3d9a8");
          st.paddles = [-1, 1].map((x) => {
            const pad = new T.Group();
            st.boat.add(pad);
            tube(pad, [x * 0.3, 1, 0], [x * 1.7, 0.3, 0.4], 0.05, "#f2d0a0");
            ball(pad, x * 1.7, 0.3, 0.4, 0.3, 0.08, 0.55, "#d1aa78");
            return pad;
          });
          st.wave = box(p, 0, 0.65, -8, 6.3, 0.45, 0.8, "#d0f1e1");
        } else if (id === "spotlight") {
          st.lamp = ball(p, 0, 3, -9, 0.8, 0.8, 0.8, "#9fe6af");
          tube(p, [0, 0.2, -9], [0, 3, -9], 0.09, "#8d7391");
          st.beam = cyl(p, 0, 0.47, 0, 2.5, 2.5, 0.02, "#fff2c1", 24);
        } else if (id === "volley") {
          st.ball = ball(p, 0, 2, -8, 0.4, 0.4, 0.4, "#f7edc9");
          for (const x of [-3.1, 3.1])
            tube(p, [x, 0.3, -2], [x, 2.6, -2], 0.09, "#b59373");
          for (let x = -3; x <= 3; x += 0.5)
            tube(p, [x, 1, -2], [x, 2.4, -2], 0.018, "#fff2d0");
          for (const y of [1, 1.5, 2, 2.4])
            tube(p, [-3, y, -2], [3, y, -2], 0.018, "#fff2d0");
        }
      } else if (id === "maze") {
        box(p, 0, 0.25, 0, 7.8, 0.3, 7.8, "#e6cba6");
        st.cells = [];
        st.walls = [];
        for (let k = 0; k < 25; k++) {
          const x = ((k % 5) - 2) * 1.5,
            z = (Math.floor(k / 5) - 2) * 1.5;
          st.cells.push(box(p, x, 0.44, z, 1.4, 0.08, 1.4, "#b1a8d3"));
          if (k % 5 < 4)
            st.walls.push({
              a: k,
              b: k + 1,
              mesh: box(p, x + 0.75, 0.8, z, 0.12, 0.7, 1.5, "#779b9e"),
            });
          if (k < 20)
            st.walls.push({
              a: k,
              b: k + 5,
              mesh: box(p, x, 0.8, z + 0.75, 1.5, 0.7, 0.12, "#779b9e"),
            });
        }
        st.flag = new T.Group();
        p.add(st.flag);
        tube(st.flag, [0, 0.5, 0], [0, 2.2, 0], 0.045, "#94715e");
        box(st.flag, 0.35, 1.9, 0, 0.7, 0.4, 0.04, "#ffdc80");
      } else if (id === "stack") {
        cyl(p, 0, 0.3, 0, 2.6, 2.8, 0.5, "#b7a1cb", 24);
        box(p, 0, 0.6, 0, 3, 0.3, 2.5, "#f1c988");
        st.blocks = Array.from({ length: 50 }, (_, j) =>
          box(p, 0, 0.9 + j * 0.35, 0, 1, 0.33, 2.5, palette[j % 4]),
        );
        st.moving = box(p, 0, 1.5, 0, 3, 0.33, 2.5, "#f9df97");
        st.falling = box(p, 0, 1.5, 0, 3, 0.33, 2.5, "#f3bc8a");
      } else if (id === "balloon") {
        cyl(p, 0, 0.3, 0, 2.6, 2.8, 0.5, color, 24);
        st.balloon = ball(p, 0, 3, 0, 1, 1.25, 1, color);
        tube(p, [0, 0.5, 0], [0, 3, 0], 0.025, "#eee2bd");
        st.pump = box(p, 1.5, 0.9, 1, 0.6, 1.1, 0.6, "#e6bc7d");
        box(st.pump, 0, 0.65, 0, 1, 0.14, 0.2, "#796980");
        st.release = ball(p, 0, 2, 0, 1, 1.25, 1, color);
      } else if (id === "cannon") st.cannon = cannon(p, color);
      else {
        cyl(p, 0, 0.25, 1, 3.1, 3.35, 0.45, "#e8cba0", 32);
        cyl(p, 0, 0.51, 1, 2.95, 2.95, 0.08, color, 32);
        if (
          [
            "confetti",
            "draft",
            "fuse",
            "bakery",
            "rhythm",
            "ricochet",
            "fencing",
          ].includes(id)
        ) {
          box(p, 0, 1.1, -0.8, 5.5, 0.25, 2.2, "#d4a77b");
          for (const x of [-2, 2])
            box(p, x, 0.6, -0.8, 0.15, 1, 1.8, "#a68371");
        }
        if (["confetti", "draft"].includes(id)) {
          for (let j = 0; j < 3; j++) {
            const item = new T.Group();
            p.add(item);
            item.position.set((j - 1) * 1.6, 1.3, -0.8);
            if (id === "confetti") {
              cyl(item, 0, 0.3, 0, 0.3, 0.43, 0.7, palette[j], 16);
              torus(item, 0, 0.7, 0, 0.31, 0.07, "#fff2c9").rotation.x =
                Math.PI / 2;
            } else {
              cyl(item, 0, 0.03, 0, 0.6, 0.6, 0.08, "#fff2d0", 20);
              for (let c = 0; c < 4; c++) {
                cyl(
                  item,
                  ((c % 2) - 0.5) * 0.4,
                  0.12 + Math.floor(c / 2) * 0.15,
                  0,
                  0.22,
                  0.22,
                  0.12,
                  "#be8d59",
                  14,
                );
              }
            }
            sign(item, String(j + 1), 0, 0.9, 0, 0.23);
            st.objects.push(item);
          }
        } else if (id === "fuse") {
          for (let j = 0; j < 3; j++) {
            const r = torus(
              p,
              (j - 1) * 1.7,
              1.6,
              -0.7,
              0.55,
              0.12,
              palette[j],
            );
            box(r, 0, 0, 0.05, 0.075, 0.65, 0.06, "#fff3d1");
            tube(r, [-0.22, 0.13, 0.05], [0, 0.35, 0.05], 0.045, "#fff3d1");
            tube(r, [0.22, 0.13, 0.05], [0, 0.35, 0.05], 0.045, "#fff3d1");
            st.objects.push(r);
          }
          st.rocket = cyl(p, 0, 3, -2, 0.3, 0.4, 1.2, "#f5d48b", 12);
          cyl(st.rocket, 0, 0.8, 0, 0, 0.4, 0.6, "#e995ac", 12);
        } else if (id === "bakery") {
          st.pastry = Array.from({ length: 3 }, (_, j) =>
            cyl(p, 0, 1.4 + j * 0.25, -0.8, 0.6, 0.6, 0.2, palette[j], 20),
          );
          for (let j = 0; j < 4; j++)
            cyl(p, -2 + j * 1.3, 1.35, -1.3, 0.35, 0.4, 0.2, palette[j], 16);
        } else if (id === "rhythm") {
          st.drums = [-1.1, 1.1].map((x, j) => {
            const d = cyl(p, x, 1.35, -0.6, 0.65, 0.55, 0.65, palette[j], 20);
            cyl(d, 0, 0.36, 0, 0.66, 0.66, 0.08, "#fff1c9", 20);
            return d;
          });
          st.note = ball(p, 0, 2, -4, 0.3, 0.3, 0.3, "#ffda8a");
        } else if (id === "ricochet") {
          st.target = torus(p, 0, 2, -5, 0.6, 0.17, "#e995ae");
          torus(st.target, 0, 0, 0.03, 0.27, 0.12, "#ffe59b");
          box(p, 0, 1, -4, 8, 0.7, 0.2, "#8f9fbe");
          st.sight = ball(p, 0, 2, -5, 0.12, 0.12, 0.12, "#fff5b5");
          st.ball = ball(p, 0, 1.5, 0, 0.18, 0.18, 0.18, "#f7dd96");
          st.dots = Array.from({ length: 14 }, () =>
            ball(p, 0, 1.5, 0, 0.045, 0.045, 0.045, "#fff3bd"),
          );
        } else if (id === "simon") {
          st.order = sign(p, "AYE!", 0, 3.6, -2, 0.55);
          st.hat = cyl(p, 0, 3, -2, 0.5, 0.75, 0.35, "#f1d292", 5);
        } else if (id === "fencing") {
          st.hands = ["ROCK", "PAPER", "SCISSORS"].map((name, j) => {
            const card = new T.Group();
            p.add(card);
            card.position.set((j - 1) * 1.9, 1.6, 0);
            box(card, 0, 0, -0.12, 1.65, 1.9, 0.14, "#fff0cf");
            if (j === 0) {
              const rock = new T.Mesh(
                new T.IcosahedronGeometry(0.5, 0),
                mat("#9c92ba"),
              );
              card.add(rock);
            }
            if (j === 1) {
              box(card, 0, 0.08, 0.05, 0.7, 1, 0.08, "#fffefa");
              for (let n = 0; n < 4; n++)
                box(
                  card,
                  0,
                  0.35 - n * 0.18,
                  0.11,
                  0.45,
                  0.035,
                  0.025,
                  "#8db6c8",
                );
            }
            if (j === 2) {
              for (const side of [-1, 1]) {
                const blade = box(
                  card,
                  side * 0.17,
                  0.22,
                  0.03,
                  0.12,
                  0.85,
                  0.08,
                  "#a6b6c6",
                );
                blade.rotation.z = side * 0.38;
                torus(card, side * 0.2, -0.35, 0.04, 0.19, 0.065, "#a67ac4");
              }
              ball(card, 0, -0.03, 0.1, 0.08, 0.08, 0.06, "#f3c76e");
            }
            sign(card, name, 0, -0.72, 0.15, 0.19);
            return card;
          });
        }
      }
      st.scoreBar = box(p, 0, 0.65, 10, 4, 0.08, 0.18, "#fff1b8");
    }
    return w;
  }
  function update(w, s, t) {
    roster(w, s);
    const g = s?.game,
      now = t * 1000,
      id = w.name,
      b = g?.cue || {
        at: 3000,
        window: 700,
        index: 0,
        lane: 1,
        boost: 2,
        color: 1,
        values: [3, 6, 4],
      };
    const ids = s
      ? s.players
          .map((p, i) => (!g || g.participants.includes(p.id) ? i : -1))
          .filter((i) => i >= 0)
      : [0, 1, 2, 3];
    const dt = g ? now - g.start - b.at : -1000,
      count = ids.length,
      shared = g?.shared || {};
    const circular = ["bomb", "cannon"].includes(id),
      spacing = id === "maze" ? 8.6 : 7.4;
    w.stations.forEach((st, slot) => {
      st.root.visible = slot < count;
      if (circular)
        st.root.position.set(
          Math.cos((slot / count) * TAU) * 7,
          0.4,
          Math.sin((slot / count) * TAU) * 7,
        );
      else if (id === "kart") st.root.position.set(0, 0, 0);
      else st.root.position.set((slot - (count - 1) / 2) * spacing, 0, 0);
    });
    w.actors.forEach((a, i) => {
      const slot = ids.indexOf(i);
      a.visible = slot >= 0;
      if (slot < 0) return;
      const st = w.stations[slot],
        p = st.root.position,
        v = g?.progress[i] || {
          lane: 1,
          stamina: 100,
          width: 3,
          rings: [0, 0, 0],
        };
      let x = p.x,
        z = p.z + (lanes.includes(id) ? 6 : 2.5),
        y = 0.6,
        mode = "idle";
      const move = clamp((now - (v.moveAt || 0)) / 260),
        lane = mix(v.fromLane ?? 1, v.lane ?? 1, move);
      st.scoreBar.visible = !circular && id !== "kart";
      st.scoreBar.scale.x =
        0.15 + Math.min(1, (g?.scores[i] || 0) / 3000) * 0.85;
      if (lanes.includes(id)) {
        x += (lane - 1) * 2;
        if (move < 1) mode = "walk";
      }
      if (id === "kart") {
        const distance = v.distance || 0;
        x = (lane - 1) * 3.5 + (slot % 2 ? 0.92 : -0.92);
        z = 5 - (distance / 4200) * 15 + Math.floor(slot / 2) * 2.65;
        st.kart.position.set(x - p.x, 0.1 + Math.sin(t * 14 + slot) * 0.025, z);
        st.kart.rotation.z =
          move < 1
            ? (v.lane - (v.fromLane ?? 1)) * -0.13 * Math.sin(move * Math.PI)
            : 0;
        st.flame.visible = v.boosted > 0;
        st.flame.scale.z = 1 + Math.sin(t * 35) * 0.25;
        y = 0.8;
        mode = "duck";
        const q = clamp((dt + 1000) / (1000 + b.window));
        st.barrel.visible = slot === 0;
        st.barrel.position.set((b.lane - 1) * 3.5, 0.8, mix(-10, z + 2, q));
        st.barrel.rotation.x = t * 5;
        st.objects.forEach((o, j) => {
          o.visible = slot === 0;
          o.position.set(
            (b.boost - 1) * 3.5,
            0.46,
            mix(-10, z + 2, q) - 1.8 + j * 0.35,
          );
        });
      } else if (id === "orchard") {
        st.basket.position.x = x - p.x;
        st.fruit.forEach((f, j) => {
          f.visible = j === b.color && v.actedBeat !== b.index;
          f.position.set(
            (b.lane - 1) * 2,
            1.4,
            mix(-10, 6, clamp((dt + 1800) / 1500)),
          );
          f.rotation.z = t * 2;
        });
        y = 0.5;
        z = 7.5;
      } else if (id === "volley") {
        const q = clamp((dt + 1600) / (1600 + b.window));
        st.ball.position.set(
          ((v.ballLane ?? b.lane) - 1) * 2,
          1.3 + Math.sin(q * Math.PI) * 5,
          mix(-10, 6, q),
        );
        y += Math.sin(clamp((now - v.moveAt) / 600) * Math.PI) * 0.6;
      } else if (id === "boats") {
        x = p.x;
        z = 6 - ((v.distance || 0) / 2400) * 14;
        st.boat.position.set(0, Math.sin(t * 3 + slot) * 0.06, z);
        st.boat.rotation.z = Math.sin(t * 2 + slot) * 0.035;
        st.paddles.forEach(
          (pad, j) =>
            (pad.rotation.y =
              (j ? -1 : 1) *
              Math.sin(t * 7) *
              (now - v.moveAt < 650 ? 0.7 : 0.08)),
        );
        st.wave.position.z = mix(
          -10,
          z + 2,
          clamp((dt + 1800) / (1800 + b.window)),
        );
        mode = now - v.braceAt < 650 ? "duck" : "fish";
        y = 0.75;
      } else if (id === "spotlight") {
        x = p.x;
        z = 8 - Math.min(1, (v.distance || 0) / 1200) * 15;
        st.lamp.material = mat(
          dt < -650 ? "#95e3ad" : dt < 0 ? "#f8d46f" : "#ee8795",
        );
        st.beam.visible = dt >= -650;
        st.beam.position.z = z;
        mode = v.running && dt < 0 ? "walk" : "idle";
      } else if (id === "maze") {
        const cell = v.cell || 0,
          prev = v.previousCell ?? cell;
        x += mix((prev % 5) - 2, (cell % 5) - 2, move) * 1.5;
        z = mix(Math.floor(prev / 5) - 2, Math.floor(cell / 5) - 2, move) * 1.5;
        y = 0.5;
        mode = move < 1 ? "walk" : "idle";
        st.walls.forEach(
          (o) =>
            (o.mesh.visible = g
              ? !g.maze[o.a].includes(o.b)
              : (o.a + o.b) % 3 === 0),
        );
        const target = v.target ?? 24;
        st.flag.position.set(
          ((target % 5) - 2) * 1.5,
          0,
          (Math.floor(target / 5) - 2) * 1.5,
        );
      } else if (id === "stack") {
        const blocks = v.stack || [];
        st.blocks.forEach((m, j) => {
          m.visible = j < blocks.length;
          if (blocks[j]) {
            m.position.x = blocks[j].x;
            m.scale.x = blocks[j].width;
            m.rotation.z = Math.sin(t * 2 + j) * 0.005 * j;
          }
        });
        st.falling.visible = !!v.fallenBlock && now - v.fallenBlock.at < 1300;
        if (v.fallenBlock) {
          const q = clamp((now - v.fallenBlock.at) / 1300);
          st.falling.position.set(
            v.fallenBlock.x,
            1.4 + blocks.length * 0.35 - q * q * 10,
            q * 2,
          );
          st.falling.rotation.z = q * 1.2;
          st.falling.scale.x = v.width / 3;
        }
        st.moving.visible = !v.finished;
        st.moving.position.set(
          Math.sin(
            (now - (g?.start || 0)) / (650 - Math.min(200, (v.step || 0) * 12)),
          ) * 2.5,
          1.4 + blocks.length * 0.35,
          0,
        );
        st.moving.scale.x = (v.width || 3) / 3;
        z = 3;
        mode = now - v.dropAt < 600 ? "win" : "idle";
      } else if (id === "balloon") {
        const scale = 0.25 + (v.pressure || 0) / 70;
        st.balloon.scale.setScalar(scale);
        st.balloon.position.y = 2.3 + scale;
        st.balloon.rotation.z = Math.sin(t * 2) * 0.1;
        st.pump.position.y =
          0.9 - Math.sin(clamp((now - (v.pumpAt || 0)) / 350) * Math.PI) * 0.25;
        const release = v.released;
        st.release.visible = !!release && now - release.at < 2500;
        if (release) {
          st.release.position.y = 3 + (now - release.at) / 220;
          st.release.scale.setScalar(0.25 + release.size / 70);
        }
        mode = now - v.pumpAt < 300 ? "duck" : "idle";
      } else if (id === "cannon") {
        const aim =
          (((now - (v.fireAt || 0) < 250 ? v.fireAt : now) - (g?.start || 0)) *
            0.00135 +
            (slot * TAU) / count) %
          TAU;
        st.cannon.userData.gun.rotation.y = -aim - Math.PI / 2;
        st.cannon.userData.gun.position.z =
          Math.sin(clamp((now - (v.fireAt || 0)) / 300) * Math.PI) * 0.2;
        x += Math.cos((slot * TAU) / count) * 1.6;
        z = p.z + Math.sin((slot * TAU) / count) * 1.6;
      } else if (id === "bomb") {
        z = p.z;
        mode = now - v.throwAt < 550 || shared.holder === i ? "fish" : "idle";
      } else if (id === "rope") {
        z = 1;
        y += Math.sin(clamp((now - (v.jumpAt || 0)) / 900) * Math.PI) * 2;
        mode = now - (v.duckAt || 0) < 750 ? "duck" : "idle";
      } else if (id === "simon") {
        st.order.visible = !b.fake || Math.sin(t * 5) > -0.6;
        st.hat.rotation.z = Math.sin(t * 3) * 0.2;
        if (now - v.moveAt < 700) {
          mode =
            v.pose === "duck" ? "duck" : v.pose === "jump" ? "jump" : "walk";
          if (v.pose === "jump")
            y += Math.sin(clamp((now - v.moveAt) / 700) * Math.PI) * 1.5;
          x += v.pose === "left" ? -0.7 : v.pose === "right" ? 0.7 : 0;
        }
      } else if (id === "confetti" || id === "draft") {
        st.objects.forEach((o, j) => {
          o.rotation.z = j === b.lane ? Math.sin(t * 5) * 0.06 : 0;
          o.scale.setScalar(j === b.lane ? 1.1 : 1);
        });
        mode = now - v.moveAt < 550 ? "win" : "idle";
      } else if (id === "fuse") {
        st.objects.forEach(
          (o, j) => (o.rotation.z = (-(v.rings?.[j] || 0) * Math.PI) / 2),
        );
        st.rocket.position.y =
          3 +
          (now - (v.launchAt || 0) < 1600
            ? (now - v.launchAt) / 160
            : Math.sin(t * 2) * 0.1);
        mode = now - v.launchAt < 1000 ? "win" : "fish";
      } else if (id === "bakery") {
        st.pastry.forEach((m, j) => {
          m.visible = j < (v.cursor || 0);
          m.material = mat(palette[v.recipe?.[j] ?? j]);
        });
        mode = now - v.moveAt < 400 ? "fish" : "idle";
      } else if (id === "rhythm") {
        st.note.position.set(
          b.color % 2 ? 1.1 : -1.1,
          1.9,
          mix(-9, -0.6, clamp((dt + 1600) / 1600)),
        );
        st.note.material = mat(
          b.color === 3 ? palette[3] : palette[b.color % 2],
        );
        st.drums.forEach(
          (d, j) =>
            (d.scale.y =
              now - v.moveAt < 200 && (v.pose === "left" ? j === 0 : j === 1)
                ? 0.75
                : 1),
        );
        mode = now - v.moveAt < 450 ? "fish" : "idle";
      } else if (id === "ricochet") {
        const elapsed = now - (g?.start || 0),
          aim = Math.sin(elapsed / 850) * 4,
          target =
            Math.sin(elapsed / (b.index < 4 ? 1800 : 1250) + b.color) * 3.4;
        st.target.position.x = target;
        st.sight.position.x = aim;
        st.dots.forEach((d, j) => {
          const q = j / 13;
          d.position.set(
            q < 0.5 ? mix(0, -aim, q * 2) : mix(-aim, aim, (q - 0.5) * 2),
            1.5 + q * 0.5,
            q < 0.5 ? mix(0, -4, q * 2) : mix(-4, -5, (q - 0.5) * 2),
          );
        });
        const q = clamp((now - (v.shot?.at || 0)) / 700);
        st.ball.visible = q < 1;
        st.ball.position.set(
          q < 0.5
            ? mix(0, -(v.shot?.hit || 0), q * 2)
            : mix(-(v.shot?.hit || 0), v.shot?.hit || 0, (q - 0.5) * 2),
          1.5 + q * 0.5,
          q < 0.5 ? mix(0, -4, q * 2) : mix(-4, -5, (q - 0.5) * 2),
        );
      } else if (id === "tug") {
        x = slot === 0 ? -8 : 8;
        z = 0;
        x += shared.rope || 0;
        mode = now - v.pullAt < 500 ? "fish" : "idle";
      } else if (id === "fencing") {
        const reveal = v.reveal,
          fresh = now - (reveal?.at || 0) < 1800;
        st.hands.forEach((card, j) => {
          const selected = ["rock", "paper", "scissors"][j] === reveal?.value;
          const scale = fresh ? (selected ? 1.15 : 0.55) : 0.85;
          card.scale.lerp(new T.Vector3(scale, scale, scale), 0.18);
          card.position.y = mix(
            card.position.y,
            fresh && selected ? 2.3 : 1.6,
            0.18,
          );
          card.rotation.y = fresh ? 0 : Math.sin(t * 1.5 + j) * 0.04;
        });
        mode = fresh ? "fish" : "idle";
      }
      if (now - (v.hitAt || 0) < 650 || v.failedAt) mode = "sad";
      if (st.cannon) st.cannon.visible = true;
      if (v.eliminatedAt) {
        const fall = clamp((now - v.eliminatedAt) / 1100);
        y -= fall * fall * 7;
        if (id === "rope") st.root.position.y = -fall * fall * 7;
        if (circular) {
          x += Math.cos((slot / count) * TAU) * fall * 4;
          z += Math.sin((slot / count) * TAU) * fall * 4;
          if (st.cannon) st.cannon.visible = fall < 1;
        }
        a.rotation.z = fall * 1.4;
        a.visible = fall < 1;
      } else a.rotation.z = 0;
      const smooth =
        a.userData.positionTime === undefined
          ? 1
          : 1 -
            Math.exp(
              -20 * Math.min(0.06, Math.max(0, t - a.userData.positionTime)),
            );
      a.userData.positionTime = t;
      a.position.set(
        mix(a.position.x, x, smooth),
        y,
        mix(a.position.z, z, smooth),
      );
      a.scale.setScalar(id === "maze" ? 0.45 : id === "kart" ? 0.55 : 0.78);
      a.rotation.y =
        id === "kart" ? Math.PI : circular ? Math.atan2(-x, -z) : 0.2;
      animateCharacter(a, t + slot, mode);
    });
    if (circular) {
      const slot = ids.indexOf(shared.holder ?? ids[0]),
        from = ids.indexOf(shared.from ?? shared.holder ?? ids[0]);
      const at = w.stations[Math.max(0, slot)].root.position,
        prev = w.stations[Math.max(0, from)].root.position;
      const q = clamp((now - (shared.passedAt || 0)) / 500),
        ease = q * q * (3 - 2 * q);
      w.bubble.visible = id === "bomb";
      w.bubble.position.set(
        mix(prev.x, at.x, ease),
        1.55 + Math.sin(q * Math.PI) * 2,
        mix(prev.z, at.z, ease),
      );
      w.bubble.rotation.z =
        q < 1 ? Math.sin(q * Math.PI) * 1.5 : Math.sin(t * 2) * 0.035;
      w.bubble.scale.setScalar(
        1 + (shared.fuseEnd - now < 900 ? Math.sin(t * 18) * 0.045 : 0),
      );
      w.bombBody.material = mat(
        shared.fuseEnd - now < 900 ? "#78485c" : "#394058",
      );
      const fuse = shared.fuseEnd
        ? clamp((shared.fuseEnd - now) / 3200, 0.05, 1)
        : 1;
      w.fuse.scale.setScalar(fuse);
      w.fuse.position.set(0.07 * fuse, 0.4 + 0.18 * fuse, 0);
      w.spark.position.set(0.14 * fuse, 0.4 + 0.36 * fuse, 0);
      w.spark.scale.setScalar(0.8 + Math.sin(t * 36) * 0.2);
      w.spark.rotation.z = t * 9;
      w.spark.visible = s?.phase === "playing";
      w.projectiles.forEach((p, j) => {
        const shot = shared.shots?.[j];
        p.visible = !!shot && (!shot.done || now < shot.done);
        if (shot)
          p.position.set(
            shot.x + shot.dx * (now - shot.at),
            1.45,
            shot.z + shot.dz * (now - shot.at),
          );
      });
      const burst =
        id === "bomb"
          ? { at: shared.poppedAt || 0, x: at.x, z: at.z }
          : shared.burst;
      w.burst.visible = !!burst && now - burst.at < 800;
      if (burst) {
        w.burst.position.set(burst.x, 1.8, burst.z);
        w.burst.scale.setScalar(0.5 + clamp((now - burst.at) / 800) * 3);
        w.burst.rotation.y = t * 3;
      }
    }
    if (id === "rope") {
      const q = clamp((dt + 1600) / (1600 + b.window));
      w.rope.position.set(0, b.high ? 1.8 : 0.7, mix(-8, 5, q));
    }
    if (id === "tug") {
      w.buoy.position.x = shared.rope || 0;
      w.tugRope.position.x = (shared.rope || 0) * 0.35;
    }
    const height =
      id === "stack"
        ? Math.min(
            7,
            Math.max(0, ...(g?.progress || []).map((v) => v.step || 0)) * 0.18,
          )
        : 1;
    return {
      target: new T.Vector3(0, height, 0),
      extent: id === "kart" ? 23 : circular ? 25 : count === 2 ? 23 : 32,
      position: circular ? [15, 24, 27] : [8, 29, 34],
    };
  }
  return { build, update };
}
