export function midwayScenes(H) {
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
      mat,
      clamp,
      mix,
    } = H,
    R = globalThis.PartyMidwayRules;
  const colors = ["#79cbe8", "#ee9bbd", "#88d0a5", "#f4cc70"];
  function sign(root, text, x, y, z, size = 0.4) {
    const s = label(text, "#fff2cf", "#55496b", size);
    s.position.set(x, y, z);
    root.add(s);
    return s;
  }
  function pizzaModel(root) {
    const p = new T.Group();
    root.add(p);
    const shapes = [
      cyl(p, 0, 0, 0, 0.75, 0.77, 0.13, "#dcaa69", 32),
      box(p, 0, 0, 0, 1.35, 0.13, 1.35, "#dcaa69"),
      new T.Group(),
    ];
    p.add(shapes[2]);
    ball(shapes[2], -0.26, 0, -0.15, 0.47, 0.09, 0.5, "#dcaa69");
    ball(shapes[2], 0.26, 0, -0.15, 0.47, 0.09, 0.5, "#dcaa69");
    const heart = box(shapes[2], 0, 0, 0.2, 0.82, 0.13, 0.82, "#dcaa69");
    heart.rotation.y = Math.PI / 4;
    const cheese = cyl(p, 0, 0.08, 0, 0.64, 0.64, 0.035, "#f9e7aa", 32),
      toppings = [];
    for (let n = 0; n < 4; n++) {
      const a = new T.Group();
      p.add(a);
      for (let k = 0; k < 4; k++) {
        const theta = (k * Math.PI) / 2 + n * 0.45,
          x = Math.cos(theta) * (0.3 + n * 0.05),
          z = Math.sin(theta) * (0.3 + n * 0.05);
        if (n === 0) cyl(a, x, 0.13, z, 0.13, 0.13, 0.025, "#bf6150", 12);
        if (n === 1) {
          ball(a, x, 0.15, z, 0.13, 0.07, 0.1, "#cbb6a0");
          box(a, x, 0.13, z + 0.06, 0.04, 0.04, 0.09, "#f5dfbd");
        }
        if (n === 2) {
          const o = torus(a, x, 0.14, z, 0.09, 0.025, "#515645");
          o.rotation.x = Math.PI / 2;
        }
        if (n === 3) {
          const o = torus(a, x, 0.14, z, 0.1, 0.025, "#79aa67");
          o.rotation.x = Math.PI / 2;
        }
      }
      toppings.push(a);
    }
    return { root: p, shapes, cheese, toppings };
  }
  function robot(root, color) {
    const p = new T.Group();
    root.add(p);
    box(p, 0, 1, 0, 1.1, 1.25, 0.8, color);
    box(p, 0, 1.1, 0.43, 0.65, 0.55, 0.04, "#fff0ce");
    for (const x of [-0.3, 0.3]) {
      cyl(p, x, 0.3, 0, 0.16, 0.2, 0.5, "#697187", 12);
      box(p, x, 0.1, 0.12, 0.45, 0.23, 0.65, "#53566e");
    }
    const head = new T.Group();
    head.position.y = 2;
    p.add(head);
    box(head, 0, 0, 0, 0.95, 0.75, 0.8, color);
    box(head, 0, 0, 0.42, 0.7, 0.26, 0.06, "#374653");
    for (const x of [-0.21, 0.21])
      ball(head, x, 0.03, 0.48, 0.07, 0.07, 0.035, "#f7e9a4");
    box(head, 0, -0.21, 0.43, 0.35, 0.05, 0.035, "#fff1ca");
    const spring = new T.Group();
    p.add(spring);
    for (let j = 0; j < 9; j++) {
      const o = torus(spring, 0, 0, 0, 0.18, 0.035, "#d3d6db");
      o.rotation.x = Math.PI / 2;
    }
    const arms = [-1, 1].map((side) => {
      const a = new T.Group();
      a.position.set(side * 0.7, 1.35, 0);
      p.add(a);
      cyl(a, 0, -0.17, 0.05, 0.15, 0.17, 0.5, "#70758b", 12);
      ball(
        a,
        0,
        -0.34,
        0.3,
        0.28,
        0.28,
        0.34,
        side < 0 ? "#ee9da6" : "#c2d8ef",
      );
      return a;
    });
    return { root: p, head, spring, arms };
  }
  function build(id) {
    const w = world(id);
    if (w.built) return w;
    w.built = true;
    water(w);
    w.stations = [];
    w.robots = [];
    w.cookieTrays = [];
    w.crowd = [];
    box(
      w.root,
      0,
      -0.25,
      -2,
      36,
      0.6,
      27,
      id === "mine" ? "#aa927b" : "#c3a17e",
    );
    for (let x = -17; x < 18; x += 0.6)
      box(w.root, x, 0.065, -2, 0.025, 0.025, 26, "#957e6e");
    for (const x of [-15, 15]) {
      palm(w, x, -10, 1);
      tube(w.root, [x, 0, -11], [x, 8, -11], 0.1, "#6f6374");
    }
    tube(w.root, [-15, 7.5, -11], [15, 7.5, -11], 0.04, "#6e5e73");
    for (let j = 0; j < 15; j++)
      ball(
        w.root,
        -14 + j * 2,
        7.2 + Math.sin((j / 14) * Math.PI) * -0.8,
        -11,
        0.14,
        0.2,
        0.14,
        colors[j % 4],
      );
    sign(
      w.root,
      {
        pizza: "PIER PIZZA · FRESH FROM THE OVEN",
        mine: "POCKET PROSPECTORS · SHARED SHAFT",
        moles: "MOLE MISCHIEF",
        robots: "RIVET RUMBLE",
        draft: "COOKIE CAPER · CHOOSE & REVEAL",
      }[id],
      0,
      6,
      -12,
      0.58,
    );
    if (id === "pizza")
      for (let i = 0; i < 4; i++) {
        const p = new T.Group();
        w.root.add(p);
        p.position.set((i - 1.5) * 7, 0, -5);
        box(p, 0, 1, -1, 6, 1.8, 3.4, "#e9bd91");
        box(p, 0, 1.95, -1, 6.2, 0.16, 3.6, "#fff0cd");
        for (let j = 0; j < 6; j++)
          box(
            p,
            -2.5 + j,
            1.75,
            0.76,
            0.5,
            0.3,
            0.035,
            i % 2 ? "#db8291" : "#78ada8",
          );
        const oven = new T.Group();
        p.add(oven);
        oven.position.set(1.8, 2, -1.6);
        box(oven, 0, 0.6, 0, 1.6, 1.3, 1.5, "#ac8c88");
        box(oven, 0, 0.6, 0.8, 1.25, 0.85, 0.08, "#504451");
        const glow = box(oven, 0, 0.5, 0.85, 1, 0.55, 0.02, "#f7c16f");
        const food = pizzaModel(p);
        food.root.position.set(-0.9, 2.07, -0.3);
        const customer = mascot(C.characters[(i + 4) % 8].id);
        customer.position.set(0, 0.2, -5.4);
        customer.scale.setScalar(0.8);
        p.add(customer);
        const steam = Array.from({ length: 3 }, (_, j) =>
          ball(p, 1.8 + j * 0.12, 3.5, -1.6, 0.12, 0.2, 0.12, "#f7e3ca"),
        );
        w.stations.push({ root: p, food, glow, customer, steam });
      }
    if (id === "moles")
      for (let i = 0; i < 4; i++) {
        const p = new T.Group();
        w.root.add(p);
        p.position.set((i - 1.5) * 7, 0, -6);
        box(p, 0, 0.85, 0, 5.5, 1.6, 3.5, colors[i]);
        box(p, 0, 1.7, 0, 5.6, 0.13, 3.6, "#9cba7f");
        for (let k = 0; k < 9; k++) {
          cyl(
            p,
            ((k % 3) - 1) * 1.5,
            1.79,
            Math.floor(k / 3) - 1,
            0.48,
            0.48,
            0.04,
            "#4f4552",
            20,
          );
        }
        const hammer = new T.Group();
        p.add(hammer);
        tube(hammer, [0, 0, 0], [0, 1.4, 0], 0.08, "#bb8e6c");
        cyl(hammer, 0, 1.4, 0, 0.35, 0.35, 0.7, "#e9bd7a", 20).rotation.z =
          Math.PI / 2;
        w.stations.push({ root: p, hammer });
      }
    if (id === "mine") {
      box(w.root, 0, 0.15, -3, 24, 0.25, 12, "#8b7569");
      box(w.root, 0, 0.4, -3, 8, 0.3, 8, "#554754");
      for (const x of [-4.5, 4.5])
        box(w.root, x, 3, -3, 0.45, 6, 0.5, "#b9926d");
      box(w.root, 0, 6, -3, 10, 0.5, 0.7, "#be9874");
      sign(w.root, "SURFACE MARKET", 0, 4.8, -2.5, 0.4);
      for (let i = 0; i < 4; i++) {
        const p = new T.Group();
        w.root.add(p);
        p.position.set((i - 1.5) * 6, 0, -5);
        box(p, 0, 0.4, 0, 2, 0.7, 1.2, colors[i]);
        for (const x of [-0.7, 0.7]) {
          const wheel = cyl(p, x, 0.15, 0.68, 0.23, 0.23, 0.1, "#55495c", 16);
          wheel.rotation.x = Math.PI / 2;
        }
        w.stations.push({ root: p });
      }
    }
    if (id === "robots") {
      for (const x of [-6.5, 6.5]) {
        box(w.root, x, 0.2, -2, 11, 0.5, 9, "#939cba");
        box(w.root, x, 0.49, -2, 10.4, 0.06, 8.4, "#b8bfd1");
        for (const side of [-1, 1]) {
          cyl(w.root, x + side * 5, 0.9, -6, 0.12, 0.12, 1.8, "#f6d08a");
          tube(
            w.root,
            [x + side * 5, 1.3, -6],
            [x + side * 5, 1.3, 1],
            0.04,
            "#f3e3c7",
          );
        }
      }
      for (let i = 0; i < 4; i++) {
        w.robots.push(robot(w.root, colors[i]));
        w.robots[i].root.scale.setScalar(1.35);
        const console = new T.Group();
        w.root.add(console);
        box(console, 0, 0.9, 0, 1.9, 1.1, 1.1, colors[i]);
        cyl(console, 0, 1.5, 0, 0.25, 0.3, 0.15, "#e48e92", 20);
        w.stations.push({ root: console });
      }
      for (let i = 0; i < 10; i++) {
        const c = mascot(C.characters[i % 8].id);
        c.scale.setScalar(0.55);
        c.position.set(-13 + i * 2.8, 0.15, -10);
        w.root.add(c);
        w.crowd.push(c);
      }
      w.confetti = Array.from({ length: 32 }, (_, i) =>
        box(w.root, 0, -20, 0, 0.12, 0.23, 0.035, colors[i % 4]),
      );
    }
    if (id === "draft") {
      box(w.root, 0, 1, -4, 19, 1.6, 6, "#b48b74");
      box(w.root, 0, 1.85, -4, 19.3, 0.16, 6.2, "#ead5b4");
      for (let j = 0; j < 3; j++) {
        const root = new T.Group();
        w.root.add(root);
        root.position.set((j - 1) * 5.6, 2, -4);
        const plate = cyl(root, 0, 0, 0, 2, 2, 0.1, "#f2e3c6", 32),
          cookies = [];
        for (let k = 0; k < 18; k++) {
          const c = new T.Group();
          root.add(c);
          c.position.set(
            ((k % 3) - 1) * 0.8,
            0.15 + Math.floor(k / 6) * 0.19,
            ((Math.floor(k / 3) % 2) - 0.5) * 0.8,
          );
          cyl(c, 0, 0, 0, 0.35, 0.35, 0.14, "#c9955d", 16);
          for (let n = 0; n < 4; n++)
            ball(
              c,
              Math.cos(n * 2) * 0.18,
              0.09,
              Math.sin(n * 2) * 0.18,
              0.04,
              0.025,
              0.04,
              "#684c46",
            );
          cookies.push(c);
        }
        w.cookieTrays.push({ root, plate, cookies });
      }
      w.cookieFlights = Array.from({ length: 18 }, () =>
        cyl(w.root, 0, -20, 0, 0.25, 0.25, 0.12, "#ca9a64", 16),
      );
    }
    return w;
  }
  function update(w, s, t, extra = {}) {
    roster(w, s);
    const g = s?.game,
      now = t * 1000,
      id = w.kind || g?.id || w.id; // world.kind is populated by the scene adapter below.
    const kind = w.midwayKind,
      active = g?.active || (kind === "draft" ? [0, 1] : [0, 1, 2, 3]),
      count = active.length;
    w.stations.forEach((st, j) => (st.root.visible = j < count));
    w.robots.forEach((bot) => (bot.root.visible = false));
    w.actors.forEach((a, i) => {
      const slot = active.indexOf(i);
      a.visible = slot >= 0;
      if (slot < 0) return;
      const v = g?.progress[i] || {};
      let x = (slot - (count - 1) / 2) * 7,
        y = 0.2,
        z = -1,
        pose = "idle",
        rot = 0;
      if (kind === "pizza") {
        const st = w.stations[slot];
        st.root.position.x = x;
        const p =
            v.ovenAt && v.pizza
              ? v.pizza
              : v.pizza || { shape: 0, cheese: 0, toppings: [0] },
          delivery =
            v.delivery && now - v.delivery.at < 1100 ? v.delivery : null,
          shown = delivery?.pizza || p,
          q = delivery ? clamp((now - delivery.at) / 1100) : 0;
        st.food.shapes.forEach(
          (m, j) => (m.visible = j === (shown.shape ?? 0)),
        );
        st.food.root.visible = shown.shape !== null || !!delivery;
        st.food.cheese.visible = shown.cheese !== 2;
        st.food.cheese.material = mat(
          shown.cheese === 1 ? "#f2c25e" : "#f9e5ae",
        );
        st.food.toppings.forEach(
          (m, j) => (m.visible = shown.toppings.includes(j)),
        );
        st.food.root.position.set(
          mix(-0.9, 0, q),
          2.08 + Math.sin(q * Math.PI) * 0.7,
          mix(-0.3, -5, q),
        );
        if (v.ovenAt && !delivery) {
          st.food.root.position.set(1.8, 2.4, -1.25);
          st.food.root.scale.setScalar(0.7);
        } else st.food.root.scale.setScalar(1);
        st.glow.material = mat(v.ovenAt ? "#ffb251" : "#7b6262");
        st.steam.forEach((m, j) => {
          m.visible = !!v.ovenAt;
          m.position.y = 3.3 + ((t * 0.8 + j * 0.4) % 1.5);
          const puff = 0.6 + ((t * 0.8 + j * 0.4) % 1.5) * 0.5;
          m.scale.set(0.12 * puff, 0.2 * puff, 0.12 * puff);
        });
        animateCharacter(st.customer, t, delivery ? "win" : "idle", 0.6);
        pose = delivery ? "win" : now - v.moveAt < 450 ? "fish" : "idle";
        z = -1.3;
      } else if (kind === "moles") {
        const st = w.stations[slot];
        st.root.position.x = x;
        const target = v.hammer ?? 4;
        st.hammer.position.set(
          ((target % 3) - 1) * 1.5,
          1.9,
          -6 + (Math.floor(target / 3) - 1) + 6,
        );
        st.hammer.rotation.x =
          now - v.moveAt < 280
            ? -Math.sin(clamp((now - v.moveAt) / 280) * Math.PI) * 1.6
            : 0;
        pose =
          now < (v.stunUntil || 0)
            ? "sad"
            : now - v.moveAt < 350
              ? "fish"
              : "idle";
        z = -2.8;
      } else if (kind === "mine") {
        pose =
          now - v.digAt < 350 ? "fish" : now - v.sellAt < 800 ? "win" : "idle";
        z = -2.7;
      } else if (kind === "draft") {
        x = slot === 0 ? -9 : 9;
        z = -1;
        const rev = g?.shared.cookieReveal,
          q = rev ? clamp((now - rev.at) / 1100) : 1;
        pose = rev && now - rev.at < 1300 ? "win" : "idle";
        if (rev && rev.awards[i] === 0) pose = "sad";
        a.rotation.y = slot === 0 ? 0.4 : -0.4;
      } else if (kind === "robots") {
        const stage = g ? R.robotStage(g, now) : { index: 0, fighting: true },
          pairs = g
            ? R.robotPairs(g, stage.index)
            : [
                [0, 1],
                [2, 3],
              ],
          pair = pairs.findIndex((p) => p.includes(i)),
          inPair = pair >= 0,
          pairSlot = inPair ? pairs[pair].indexOf(i) : 0,
          final = stage.index === 1 || g?.robots.single;
        const desiredX = inPair
            ? (final ? 0 : pair === 0 ? -6.5 : 6.5) +
              (pairSlot === 0 ? -1.35 : 1.35)
            : slot % 2
              ? -10
              : 10,
          desiredZ = inPair ? -2 : -8,
          bot = w.robots[i];
        bot.root.position.x = mix(bot.root.position.x, desiredX, 0.12);
        bot.root.position.z = mix(bot.root.position.z, desiredZ, 0.12);
        bot.root.position.y = 0.55;
        bot.root.rotation.y = pairSlot === 0 ? Math.PI / 2 : -Math.PI / 2;
        bot.root.visible = inPair;
        const result = v.robotResult,
          ko =
            result &&
            !result.won &&
            now - result.at < 7000 &&
            result.stage === stage.index,
          dt = ko ? (now - result.at) / 1000 : 0;
        bot.head.position.y =
          2 +
          (ko
            ? Math.min(4.3, dt * 9) + Math.sin(dt * 10) * Math.exp(-dt) * 0.5
            : 0);
        bot.head.rotation.z = ko ? Math.sin(dt * 8) * 0.2 : 0;
        bot.spring.visible = !!ko;
        bot.spring.children.forEach(
          (m, j) =>
            (m.position.y = 1.7 + (j * (bot.head.position.y - 1.7)) / 9),
        );
        const predicted =
            i === s?.players.findIndex((p) => p.id === s.you) &&
            extra.localInput?.game === "robots"
              ? extra.localInput.at
              : 0,
          punchAt = Math.max(v.punchAt || 0, predicted),
          punching = stage.fighting && now - punchAt < 240,
          punchNumber =
            predicted > (v.punchAt || 0)
              ? extra.localInput.fields.punchNumber
              : v.punches || 0;
        bot.arms.forEach((arm, j) => {
          arm.rotation.x =
            punching && j === punchNumber % 2
              ? -Math.sin(clamp((now - punchAt) / 240) * Math.PI) * 1.7
              : result?.won && !stage.fighting
                ? -2.6
                : 0;
        });
        x = inPair
          ? (final ? 0 : pair === 0 ? -6.5 : 6.5) +
            (pairSlot === 0 ? -3.1 : 3.1)
          : bot.root.position.x;
        z = inPair ? 3 : -7;
        y = 0.2;
        const console = w.stations[i];
        console.root.visible = inPair;
        console.root.position.set(x, 0.2, 1.7);
        pose =
          inPair && punching
            ? "fish"
            : inPair && stage.fighting
              ? "idle"
              : result?.won
                ? "win"
                : inPair
                  ? "sad"
                  : "win";
        rot = stage.fighting ? Math.PI : 0;
      }
      a.position.set(x, y, z);
      a.scale.setScalar(kind === "robots" ? 0.85 : 1);
      a.rotation.y = rot;
      animateCharacter(a, t, pose, 0.8);
    });
    if (kind === "draft") {
      const rev = g?.shared.cookieReveal,
        revealing = rev && now - rev.at < 1100,
        c = g?.cue,
        values = revealing
          ? rev.values
          : c?.values.map(
              (n, j) => n + (j === c.lane ? g.shared.jackpot : 0),
            ) || [4, 6, 8],
        gold = revealing ? rev.gold : c?.lane;
      w.cookieTrays.forEach((tr, j) => {
        tr.plate.material = mat(j === gold ? "#f2c966" : "#f2e3c6");
        const claimed = revealing && Object.values(rev.picks).includes(j);
        tr.cookies.forEach((m, k) => {
          m.visible = k < values[j];
          m.scale.setScalar(
            claimed ? 1 - clamp((now - rev.at) / 1100) * 0.85 : 1,
          );
        });
      });
      w.cookieFlights.forEach((m, k) => {
        m.visible = !!revealing;
        if (!revealing) return;
        const seat = g.active[k % g.active.length],
          pick = rev.picks[seat],
          q = clamp((now - rev.at - (k % 5) * 35) / 900);
        m.visible = pick !== null && rev.awards[seat] > 0;
        m.position.set(
          mix((pick - 1) * 5.6, seat === g.active[0] ? -9 : 9, q),
          2 + Math.sin(q * Math.PI) * 3,
          mix(-4, -0.5, q),
        );
        m.rotation.z = q * 5;
      });
    }
    if (kind === "robots") {
      w.crowd.forEach((a, j) => animateCharacter(a, t + j * 0.3, "win", 0.5));
      const r = g?.robots,
        stage = g ? R.robotStage(g, now) : null,
        celebrate = stage && !stage.fighting;
      w.confetti.forEach((m, j) => {
        m.visible = !!celebrate;
        const age =
          (now - (g?.start || 0) - (stage?.index ? 38000 : 15000)) / 1000;
        m.position.set(
          Math.sin(j * 4.8) * 12,
          7 - ((age * 2 + j * 0.21) % 7),
          Math.cos(j * 7) * 5,
        );
        m.rotation.set(t + j, t * 2 + j, t * 0.8);
      });
    }
    return {
      target: new T.Vector3(0, kind === "robots" ? -0.8 : -2, -2),
      extent: kind === "robots" ? 28 : 30,
      position: [0, kind === "robots" ? 20 : 24, 34],
    };
  }
  function overlay(c, canvas, w, s, t) {
    if (!s?.game) return;
    const W = canvas.clientWidth,
      Ht = canvas.clientHeight,
      g = s.game;
    for (const [i, a] of w.actors.entries()) {
      if (!a.visible) continue;
      const p = a.position.clone();
      p.y += 3.3;
      p.project(w.camera);
      const x = (p.x * 0.5 + 0.5) * W,
        y = (-p.y * 0.5 + 0.5) * Ht;
      const robotStage = g.id === "robots" ? R.robotStage(g, t * 1000) : null,
        watching =
          robotStage &&
          !R.robotPairs(g, robotStage.index).some((pair) => pair.includes(i));
      const text =
        g.id === "robots"
          ? watching
            ? "Watching"
            : `${g.robots.counts[i][robotStage.index]}${W < 500 ? "" : " punches"}`
          : `${g.scores[i]} pts`;
      c.font = "800 11px system-ui";
      c.textAlign = "center";
      const width = c.measureText(text).width + 12;
      c.fillStyle = "#514764e8";
      c.beginPath();
      c.roundRect(x - width / 2, y - 12, width, 18, 5);
      c.fill();
      c.fillStyle = "#fff0c7";
      c.fillText(text, x, y + 1);
    }
  }
  return {
    build(id) {
      const w = build(id);
      w.midwayKind = id;
      return w;
    },
    update,
    overlay,
  };
}
