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
  const R = globalThis.PartyRules;
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
    cyl(c, 0, 0.3, 0, R.cannon.bodyRadius, R.cannon.bodyRadius, 0.5, color, 24);
    ring(c, 0, 0.05, 0, R.cannon.bodyRadius, "#fff2c1");
    c.userData.hearts = [-1, 0, 1].map((x) =>
      ball(c, x * 0.32, 2.65, 0, 0.11, 0.11, 0.11, "#f39aac"),
    );
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
        const p = ball(
          w.root,
          0,
          1,
          0,
          R.cannon.shotRadius,
          R.cannon.shotRadius,
          R.cannon.shotRadius,
          "#bb8963",
        );
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
      w.roadDashes = [];
      for (const x of [-1.75, 1.75])
        for (let j = 0; j < 18; j++)
          w.roadDashes.push(
            box(w.root, x, 0.47, -30 + j * 3, 0.09, 0.025, 1.5, "#fff1c8"),
          );
      box(w.root, 0, 0.32, -14, 12, 0.15, 58, "#7d8b9d");
      box(w.root, 0, 0.28, 0, 11.2, 0.3, 25, "#73879c");
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
      w.finishGate = new T.Group();
      w.root.add(w.finishGate);
      for (let x = -5; x < 5; x += 0.8)
        for (let row = 0; row < 2; row++)
          box(
            w.finishGate,
            x,
            0.47,
            -10 + row * 0.5,
            0.8,
            0.03,
            0.5,
            (Math.round(x / 0.8) + row) % 2 ? "#fff3d4" : "#58657e",
          );
      for (const x of [-6.4, 6.4])
        tube(w.finishGate, [x, 0.4, -10], [x, 4.6, -10], 0.15, "#a484a7");
      sign(w.finishGate, "FINISH", 0, 4.8, -10, 0.65);
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
        st.shreds = Array.from({ length: 12 }, (_, j) =>
          box(p, 0, 3, 0, 0.12, 0.22, 0.04, j % 2 ? color : "#fff0d0"),
        );
      } else if (id === "cannon") st.cannon = cannon(p, color);
      else {
        if (id !== "bomb") {
          cyl(p, 0, 0.25, 1, 3.1, 3.35, 0.45, "#e8cba0", 32);
          cyl(p, 0, 0.51, 1, 2.95, 2.95, 0.08, color, 32);
        } else {
          ring(p, 0, 0.07, 0, 1, "#fff0c6");
          st.hearts = [-1, 0, 1].map((x) =>
            ball(p, x * 0.3, 2.6, 0, 0.1, 0.1, 0.1, "#f39aac"),
          );
        }
        if (["confetti", "fuse", "bakery", "rhythm", "fencing"].includes(id)) {
          box(p, 0, 1.1, -0.8, 5.5, 0.25, 2.2, "#d4a77b");
          for (const x of [-2, 2])
            box(p, x, 0.6, -0.8, 0.15, 1, 1.8, "#a68371");
        }
        if (id === "confetti") {
          for (let j = 0; j < 3; j++) {
            const item = new T.Group();
            p.add(item);
            item.position.set((j - 1) * 1.6, 1.3, -0.8);
            cyl(item, 0, 0.3, 0, 0.3, 0.43, 0.7, palette[j], 16);
            torus(item, 0, 0.7, 0, 0.31, 0.07, "#fff2c9").rotation.x =
              Math.PI / 2;
            sign(item, String(j + 1), 0, 0.9, 0, 0.23);
            st.objects.push(item);
            st.paper ||= [];
            for (let k = 0; k < 8; k++) {
              const m = box(p, 0, 0, 0, 0.12, 0.2, 0.03, palette[k % 4]);
              st.paper.push({ m, popper: j, k });
            }
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
          box(p, 0, 0.3, -2, 7, 0.4, 11, "#c49978");
          for (let z = -7; z < 4; z += 0.45)
            box(p, 0, 0.52, z, 6.9, 0.025, 0.025, "#94705d");
          for (const x of [-3.4, 3.4])
            tube(p, [x, 0.5, -7], [x, 4.8, -7], 0.1, "#fff1ce");
          box(p, 0, 4.8, -7.8, 7.2, 0.17, 0.7, palette[slot]);
          for (let k = 0; k < 10; k++)
            box(
              p,
              -3.2 + k * 0.7,
              4.58,
              -7.4,
              0.34,
              0.3,
              0.1,
              k % 2 ? "#fff0d1" : palette[slot],
            );
          box(p, 0, 2.2, -7, 6.8, 3.3, 0.15, "#6c7d99");
          sign(p, "BOARDWALK BULLSEYES", 0, 5.5, -5, 0.32);
          st.target = new T.Group();
          p.add(st.target);
          st.target.position.set(0, 2, -5);
          for (const [radius, color, depth] of [
            [0.9, "#e995ae", 0],
            [0.52, "#fff0ce", 0.015],
            [0.22, "#f7c653", 0.03],
          ]) {
            const face = cyl(
              st.target,
              0,
              0,
              depth,
              radius,
              radius,
              0.04,
              color,
              40,
            );
            face.rotation.x = Math.PI / 2;
          }
          tube(st.target, [0, -2, 0], [0, -0.9, 0], 0.06, "#82604e");
          box(p, 0, 0.35, -5, 8, 0.18, 1, "#bd956e");
          st.sight = torus(p, 0, 2, -4.94, 0.1, 0.022, "#fffefa");
          st.bow = new T.Group();
          p.add(st.bow);
          st.bow.position.set(0, 1.5, 1.6);
          for (let k = 0; k < 12; k++) {
            const a = -1.2 + (k * 2.4) / 12,
              b = -1.2 + ((k + 1) * 2.4) / 12;
            tube(
              st.bow,
              [Math.cos(a) * 0.4, Math.sin(a) * 0.6, 0],
              [Math.cos(b) * 0.4, Math.sin(b) * 0.6, 0],
              0.04,
              "#a06d48",
            );
          }
          tube(st.bow, [0.145, -0.56, 0], [0.145, 0.56, 0], 0.012, "#fff0cc");
          st.arrow = new T.Group();
          p.add(st.arrow);
          tube(st.arrow, [0, 0, 0.35], [0, 0, -0.35], 0.023, "#d7ab6a");
          const head = cyl(st.arrow, 0, 0, -0.45, 0, 0.09, 0.23, "#d7e7ed", 4);
          head.rotation.x = -Math.PI / 2;
          for (const x of [-0.07, 0.07])
            box(st.arrow, x, 0, 0.25, 0.13, 0.025, 0.22, "#e6a7bd");
          st.dots = Array.from({ length: 10 }, () =>
            ball(p, 0, 1.5, 0, 0.075, 0.075, 0.075, "#ffe679"),
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
          Math.cos((slot / count) * TAU) * R.cannon.radius,
          0.4,
          Math.sin((slot / count) * TAU) * R.cannon.radius,
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
        const leader = Math.max(
          ...ids.map((j) => g?.progress[j].distance || 0),
        );
        z =
          2 +
          clamp((leader - distance) / 70, 0, 7) +
          Math.floor(slot / 2) * 1.7;
        if (slot === 0) {
          const raceTime = Math.min(now, g?.end || now);
          w.roadDashes.forEach(
            (m, j) =>
              (m.position.z =
                -34 +
                (((j % 18) * 3 + (raceTime - (g?.start || 0)) * 0.014) % 54)),
          );
          w.finishGate.visible = !!g && g.end - now < 5500;
          w.finishGate.position.z = g
            ? mix(-15, 15, clamp(1 - (g.end - now) / 5500))
            : -15;
        }
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
        const light = R.spotlight(g || { start: 0, cue: b }, now).color;
        const extrapolate =
          v.running && light !== "red"
            ? clamp(now - (v.lastTick || now), 0, 250) * 0.08
            : 0;
        z = 8 - Math.min(1, ((v.distance || 0) + extrapolate) / 1200) * 15;
        st.lamp.material = mat(
          { green: "#95e3ad", amber: "#f8d46f", red: "#ee8795" }[light],
        );
        st.beam.visible = light !== "green";
        st.beam.position.z = z;
        mode = v.running && light !== "red" ? "walk" : "idle";
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
            const q = clamp((now - blocks[j].at) / 480),
              ease = q * q;
            m.position.x = mix(
              blocks[j].dropX ?? blocks[j].x,
              blocks[j].x,
              ease,
            );
            m.position.y = 0.9 + j * 0.35 + (1 - ease) * 2.4;
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
        st.moving.visible = !v.finished && now - (v.dropAt || 0) > 480;
        st.moving.position.set(
          Math.sin(
            (now - (g?.start || 0)) / (650 - Math.min(200, (v.step || 0) * 12)),
          ) * 2.5,
          3.3 + blocks.length * 0.35,
          0,
        );
        st.moving.scale.x = (v.width || 3) / 3;
        z = 3;
        mode = now - v.dropAt < 600 ? "win" : "idle";
      } else if (id === "balloon") {
        const scale = 0.25 + (v.pressure || 0) / 70;
        st.balloon.visible = now - (v.hitAt || 0) >= 700;
        st.shreds.forEach((m, j) => {
          const age = now - (v.hitAt || 0),
            q = clamp(age / 800),
            a = (j / 12) * TAU;
          m.visible = age >= 0 && age < 800;
          m.position.set(
            Math.cos(a) * q * 2,
            3 + Math.sin(a) * q * 2 - q * q * 3,
            Math.sin(a * 2) * q,
          );
          m.rotation.z = q * 8 + j;
          m.scale.setScalar(1 - q);
        });
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
        x = p.x + 1.5;
        z = 2;
        y = 0.6;
        const pump = clamp((now - (v.pumpAt || 0)) / 350);
        y -= Math.sin(pump * Math.PI) * 0.15;
        mode = now < (v.stunnedUntil || 0) ? "sad" : pump < 1 ? "fish" : "idle";
      } else if (id === "cannon") {
        const aim = g
          ? R.cannonAngle(g, i, now)
          : t * 0.75 + (slot * TAU) / count;
        st.cannon.userData.gun.rotation.y = -aim - Math.PI / 2;
        st.cannon.userData.gun.scale.z =
          1 -
          Math.sin(clamp((now - (v.fireAt || 0)) / R.cannon.recoil) * Math.PI) *
            0.12;
        st.cannon.userData.hearts.forEach((h, j) => {
          h.visible = j < (v.health ?? 3);
        });
        x = p.x;
        z = p.z;
        y = 1.05;
        const hit = now - (v.hitAt || 0) < 450;
        st.cannon.children[0].material = mat(hit ? "#fff3b0" : palette[slot]);
      } else if (id === "bomb") {
        z = p.z;
        y = 0.46;
        mode =
          now - v.throwAt < R.bombFlight ||
          (shared.holder === i && !shared.respawnAt)
            ? "fish"
            : "idle";
        st.hearts.forEach((h, j) => {
          h.visible = j < (v.health ?? 3);
        });
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
      } else if (id === "confetti") {
        st.objects.forEach((o, j) => {
          const chosen = b.color % 3;
          o.rotation.z = j === chosen ? Math.sin(t * 5) * 0.06 : 0;
          o.scale.setScalar(j === chosen ? 1.12 : 1);
          if (j === v.popper && now - v.popperAt < 250)
            o.scale.y =
              1 - Math.sin(clamp((now - v.popperAt) / 250) * Math.PI) * 0.2;
        });
        if (st.paper)
          st.paper.forEach(({ m, popper, k }) => {
            const age = now - (v.popperAt || 0),
              q = clamp(age / 1400),
              a = (k / 8) * TAU;
            m.visible = popper === v.popper && age >= 0 && age < 1400;
            m.position.set(
              (popper - 1) * 1.6 + Math.cos(a) * q,
              2 + q * 5 - q * q * 5,
              -0.8 + Math.sin(a) * q,
            );
            m.rotation.z = t * 5 + k;
            m.scale.setScalar(1 - q * 0.6);
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
        const game = g || { start: 0 },
          aim = R.arrowAim(game, now),
          target = R.arrowTarget(game, now);
        st.target.position.x = target;
        st.sight.position.x = aim;
        st.bow.rotation.y = -Math.atan2(aim, 6.6);
        st.dots.forEach((d, j) => {
          const q = j / 9;
          d.position.set(aim * q, 1.5 + q * 0.5, 1.6 - q * 6.6);
        });
        const q = clamp((now - (v.shot?.at || 0)) / R.archery.flight);
        st.arrow.visible = !!v.shot && q < 1;
        st.arrow.position.set(
          (v.shot?.hit || 0) * q,
          1.5 + q * 0.5,
          1.6 - q * 6.6,
        );
        st.arrow.rotation.y = -Math.atan2(v.shot?.hit || 0, 6.6);
        const fresh = v.popup && now - v.popup.at < 500 && v.popup.value > 0;
        st.target.scale.setScalar(
          fresh ? 1 + Math.sin(((now - v.popup.at) / 500) * Math.PI) * 0.08 : 1,
        );
        mode = now - (v.shot?.at || 0) < 420 ? "fish" : "idle";
        z = 2.7;
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
        id === "kart"
          ? Math.PI
          : id === "cannon"
            ? st.cannon.userData.gun.rotation.y + Math.PI
            : circular
              ? Math.atan2(-x, -z)
              : id === "spotlight"
                ? Math.PI
                : 0.2;
      animateCharacter(a, t + slot, mode);
    });
    if (circular) {
      function bombPosition(holder, flight, at) {
        const dst = w.stations[Math.max(0, ids.indexOf(holder))].root.position;
        const dx = dst.x * 0.89,
          dz = dst.z * 0.89;
        if (!flight) return new T.Vector3(dx, 1.65, dz);
        const src =
          w.stations[Math.max(0, ids.indexOf(flight.from))].root.position;
        const q = clamp((at - flight.at) / R.bombFlight),
          ease = q * q * (3 - 2 * q);
        return new T.Vector3(
          mix(src.x * 0.89, dx, ease),
          1.65 + Math.sin(q * Math.PI) * 1.8,
          mix(src.z * 0.89, dz, ease),
        );
      }
      w.bubble.visible = id === "bomb" && !shared.respawnAt;
      const pos = bombPosition(shared.holder ?? ids[0], shared.flight, now);
      const delta = clamp(t - (w.ballTime ?? t), 0, 0.06);
      w.ballTime = t;
      if (w.ballRound !== g?.start || !shared.flight) {
        w.bubble.position.copy(pos);
        w.ballRound = g?.start;
      } else w.bubble.position.lerp(pos, 1 - Math.exp(-35 * delta));
      const q = shared.flight
        ? clamp((now - shared.flight.at) / R.bombFlight)
        : 1;
      w.bubble.rotation.z = Math.sin(q * Math.PI) * 1.2;
      w.bubble.scale.setScalar(1);
      w.bombBody.material = mat(
        shared.fuseEnd - now < 900 ? "#78485c" : "#394058",
      );
      const fuse = shared.fuseEnd
        ? clamp(
            (shared.fuseEnd - now) / (shared.fuseEnd - shared.fuseStarted),
            0.05,
            1,
          )
        : 1;
      w.fuse.scale.setScalar(fuse);
      w.fuse.position.set(0.07 * fuse, 0.4 + 0.18 * fuse, 0);
      w.spark.position.set(0.14 * fuse, 0.4 + 0.36 * fuse, 0);
      w.spark.scale.setScalar(0.8 + Math.sin(t * 36) * 0.2);
      w.spark.rotation.z = t * 9;
      w.spark.visible = s?.phase === "playing";
      w.projectiles.forEach((p, j) => {
        const shot = shared.shots?.[j];
        p.visible =
          id === "cannon" &&
          !!shot &&
          now >= shot.at &&
          now < Math.min(shot.done || Infinity, shot.at + R.cannon.life);
        if (shot)
          p.position.set(
            shot.x + shot.dx * (now - shot.at),
            1.4,
            shot.z + shot.dz * (now - shot.at),
          );
      });
      const burst = id === "bomb" ? shared.popped : shared.impacts?.at(-1);
      const age = burst ? (now - burst.at) / 1000 : 10;
      w.burst.visible = age >= 0 && age < 0.85;
      if (burst) {
        const origin =
          id === "bomb"
            ? bombPosition(burst.holder, burst.flight, burst.at)
            : new T.Vector3(burst.x, 1.4, burst.z);
        w.burst.position.copy(origin);
        w.burst.rotation.set(0, 0, 0);
        w.burst.scale.setScalar(1);
        w.burst.children.forEach((p, j) => {
          const angle = j * 2.399;
          p.position.set(
            Math.cos(angle) * age * 2.8,
            Math.sin(j * 1.7) * age + age * 2 - age * age * 4,
            Math.sin(angle) * age * 2.8,
          );
          p.scale.setScalar(Math.max(0, 1 - age / 0.85));
        });
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
