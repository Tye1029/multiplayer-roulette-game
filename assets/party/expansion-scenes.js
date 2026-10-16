export function expansionScenes(H) {
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
    mat,
    mix,
    clamp,
  } = H;
  const R = globalThis.PartyExpansionRules,
    colors = ["#79cbe8", "#ee9bbd", "#88d0a5", "#f4cc70"];
  const sign = (root, text, x, y, z, size = 0.4) => {
    const s = label(text, "#fff6df", "#55486d", size);
    s.position.set(x, y, z);
    root.add(s);
    return s;
  };
  function grain(root, color, spread = 20, height = 0.24, count = 150) {
    const geo = new T.PlaneGeometry(0.1, 0.035),
      mesh = new T.InstancedMesh(geo, mat(color), count),
      dummy = new T.Object3D();
    for (let i = 0; i < count; i++) {
      dummy.position.set(
        Math.sin(i * 73.13) * spread,
        height,
        Math.sin(i * 21.91) * spread,
      );
      dummy.rotation.set(-Math.PI / 2, 0, i);
      dummy.scale.setScalar(0.6 + (i % 7) * 0.18);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    root.add(mesh);
  }
  function booth(root, x, color, name) {
    const p = new T.Group();
    p.position.x = x;
    root.add(p);
    box(p, 0, 0.2, -3, 5.7, 0.4, 11, "#cbab89");
    for (let z = -8; z < 3; z += 0.45)
      box(p, 0, 0.43, z, 5.7, 0.035, 0.025, "#8d6e66");
    for (const side of [-1, 1]) {
      box(p, side * 2.7, 2, -7, 0.15, 3.2, 0.15, "#f5e6cd");
      box(p, side * 2.7, 2, 0, 0.15, 3.2, 0.15, "#f5e6cd");
    }
    box(p, 0, 4.1, -7.5, 5.9, 0.2, 0.7, color);
    for (let k = 0; k < 8; k++)
      box(
        p,
        -2.6 + k * 0.74,
        3.92,
        -7.1,
        0.36,
        0.38,
        0.12,
        k % 2 ? "#fff0d1" : color,
      );
    box(p, 0, 0.9, 0.8, 5.5, 1, 0.45, color);
    sign(p, name, 0, 4.5, -6, 0.35);
    return p;
  }
  function build(id) {
    const w = world(id);
    if (w.built) return w;
    w.built = true;
    water(w);
    w.stations = [];
    w.scoreLabels = [];
    const sea = ["bumper", "volcano"].includes(id);
    if (!sea) {
      box(
        w.root,
        0,
        -0.2,
        0,
        38,
        0.75,
        32,
        id === "baseball" ? "#b3ba7b" : "#e0bc92",
      );
      box(
        w.root,
        0,
        0.2,
        0,
        37.8,
        0.06,
        31.8,
        id === "baseball" ? "#9cc48b" : "#e9c999",
      );
      grain(w.root, id === "baseball" ? "#739a6a" : "#ba9477", 18);
    }
    for (let i = 0; i < 7; i++) {
      cloud(w, -25 + i * 9, 12, -25, 1.5);
      if (!sea) palm(w, -17 + i * 5.5, -14, 0.7);
    }
    if (id === "bumper") {
      const shape = new T.Shape();
      shape.absarc(0, 0, 9.5, 0, Math.PI * 2, false);
      for (const [x, z, r] of R.holes) {
        const hole = new T.Path();
        hole.absarc(x, -z, r, 0, Math.PI * 2, true);
        shape.holes.push(hole);
      }
      const geometry = new T.ExtrudeGeometry(shape, {
          depth: 0.65,
          bevelEnabled: false,
          curveSegments: 64,
        }),
        floor = new T.Mesh(geometry, mat("#9eb6d3"));
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.15;
      floor.receiveShadow = true;
      w.root.add(floor);
      for (const [x, z, r] of R.holes) {
        const edge = torus(w.root, x, 0.52, z, r + 0.08, 0.09, "#f5ce77");
        edge.rotation.x = Math.PI / 2;
      }
      for (let k = 0; k < 40; k++) {
        const a = (k / 40) * Math.PI * 2;
        const stripe = box(
          w.root,
          Math.cos(a) * 9.25,
          0.52,
          Math.sin(a) * 9.25,
          0.18,
          0.03,
          0.8,
          k % 2 ? "#524862" : "#f9cd71",
        );
        stripe.rotation.y = -a;
      }
      sign(w.root, "BUMPER BLUFF", 0, 4, -11, 0.8);
    } else if (id === "volcano") {
      cyl(w.root, 0, -0.3, 0, 11.5, 12.5, 1.2, "#87757b", 48);
      cyl(w.root, 0, 0.32, 0, 10.5, 11, 0.1, "#c7a180", 48);
      for (let i = 0; i < 32; i++) {
        const a = (i / 32) * Math.PI * 2;
        ball(
          w.root,
          Math.cos(a) * 11,
          -0.2,
          Math.sin(a) * 11,
          1.2,
          0.9,
          1,
          "#776778",
        );
      }
      cyl(w.root, 0, 3, -17, 2, 7, 7, "#705a70", 32);
      cyl(w.root, 0, 6.6, -17, 1.7, 2.1, 0.5, "#ec9568", 24);
      w.smoke = [];
      for (let j = 0; j < 6; j++)
        w.smoke.push(
          ball(
            w.root,
            Math.sin(j) * 1.2,
            8 + j * 0.8,
            -17,
            0.8 + j * 0.2,
            0.8 + j * 0.2,
            0.8 + j * 0.2,
            "#a78e9c",
          ),
        );
      for (let j = 0; j < 5; j++) {
        const a = (j / 5) * Math.PI * 2;
        tube(
          w.root,
          [Math.cos(a) * 1.6, 6.7, -17 + Math.sin(a) * 1.6],
          [Math.cos(a) * 5.5, 0.5, -17 + Math.sin(a) * 5.5],
          0.13,
          "#fca76b",
        );
      }
      w.rocks = Array.from({ length: 5 }, () => {
        const root = new T.Group();
        w.root.add(root);
        const shadow = cyl(root, 0, 0.4, 0, 1, 1, 0.015, "#75564f", 32),
          rim = torus(root, 0, 0.43, 0, 1, 0.04, "#f1c58b");
        rim.rotation.x = Math.PI / 2;
        const rock = ball(root, 0, 10, 0, 0.7, 0.9, 0.7, "#695268");
        ball(rock, 0.4, 0.2, 0.5, 0.15, 0.34, 0.09, "#ed9562");
        return { root, shadow, rim, rock };
      });
    } else if (id === "band") {
      box(w.root, 0, 0.5, -4, 23, 0.6, 12, "#694f78");
      for (let x = -11; x < 12; x += 0.65)
        box(w.root, x, 0.82, -4, 0.035, 0.035, 11.8, "#987593");
      for (const x of [-11, 11]) {
        tube(w.root, [x, 0, -8], [x, 8, -8], 0.13, "#5b6279");
        for (let j = 0; j < 3; j++) {
          box(w.root, x, 1.2 + j * 1.8, -8, 1.6, 1.5, 0.8, "#46455b");
          cyl(
            w.root,
            x,
            1.2 + j * 1.8,
            -7.5,
            0.44,
            0.44,
            0.1,
            "#a68bac",
          ).rotation.x = Math.PI / 2;
        }
      }
      tube(w.root, [-11, 8, -8], [11, 8, -8], 0.12, "#5b6279");
      for (let j = 0; j < 8; j++) {
        const x = -9 + j * 2.6;
        ball(w.root, x, 7.7, -8, 0.18, 0.18, 0.18, colors[j % 4]);
      }
      sign(w.root, "THE BOARDWALK BAND", 0, 6.2, -9, 0.7);
      w.crowd = Array.from({ length: 16 }, (_, i) => {
        const c = mascot(C.characters[i % 8].id);
        c.position.set(-12 + (i % 8) * 3.5, 0.2, 6 + Math.floor(i / 8) * 2);
        c.scale.setScalar(0.55);
        c.rotation.y = Math.PI;
        w.root.add(c);
        return c;
      });
    } else if (id === "math") {
      box(w.root, 0, 0.5, -7, 13, 0.55, 5, "#ae806c");
      box(w.root, 0, 3.7, -9, 12, 5, 0.3, "#607a72");
      box(w.root, 0, 1.3, -7.6, 7, 1.1, 1.3, "#c89d74");
      sign(w.root, "PROFESSOR POPPY", 0, 6.7, -9, 0.6);
      w.teacher = mascot("shopkeeper");
      w.teacher.position.set(0, 0.8, -6.5);
      w.teacher.scale.setScalar(1.35);
      w.root.add(w.teacher);
      w.card = box(w.root, 0, 3, -5.9, 4.4, 2, 0.08, "#fff0ce");
      for (let j = 0; j < 4; j++) {
        const p = new T.Group();
        p.position.x = (j - 1.5) * 5;
        w.root.add(p);
        box(p, 0, 0.85, 1, 3.2, 1.4, 1.5, colors[j]);
        box(p, 0, 1.6, 1, 3.4, 0.16, 1.7, "#fff0ce");
        w.stations.push({ root: p });
      }
    } else if (id === "baseball") {
      box(w.root, 0, 0.26, -2, 30, 0.05, 18, "#c6a17d");
      for (let j = 0; j < 4; j++) {
        const x = (j - 1.5) * 7;
        box(w.root, x, 0.3, 4, 2, 0.06, 2, "#fff1d9");
        tube(w.root, [x - 2, 0.32, 6], [x - 2, 0.32, -10], 0.025, "#fff1d9");
        tube(w.root, [x + 2, 0.32, 6], [x + 2, 0.32, -10], 0.025, "#fff1d9");
        const pitcher = mascot("robot");
        pitcher.position.set(x, 0.3, -10);
        pitcher.scale.setScalar(0.65);
        w.root.add(pitcher);
        const b = ball(w.root, x, 1.3, -9, 0.16, 0.16, 0.16, "#fff1d9");
        w.stations.push({ root: new T.Group(), pitcher, ball: b });
      }
      sign(w.root, "SUNSET SLUGGERS", 0, 6, -13, 0.7);
      for (const x of [-17, 17])
        for (let j = 0; j < 8; j++)
          tube(
            w.root,
            [x, 0.3, -12 + j * 3],
            [x, 4, -12 + j * 3],
            0.04,
            "#adb3ad",
          );
    } else {
      for (let j = 0; j < 4; j++) {
        const p = booth(
            w.root,
            (j - 1.5) * 7,
            colors[j],
            id === "basket"
              ? "MIDWAY HOOPS"
              : id === "puzzle"
                ? "POSTCARD SHOP"
                : "POPPY’S WORKSHOP",
          ),
          st = { root: p };
        w.stations.push(st);
        if (id === "basket") {
          const hoop = new T.Group();
          p.add(hoop);
          hoop.position.set(0, 2.8, -5);
          box(hoop, 0, 0.7, -0.12, 2.7, 1.8, 0.15, "#f8e7cc");
          box(hoop, 0, 0.55, 0, 1, 0.75, 0.025, "#d8957d");
          const ring = torus(hoop, 0, 0, 0.6, 0.62, 0.055, "#e97857");
          ring.rotation.x = Math.PI / 2;
          for (let n = 0; n < 12; n++) {
            const a = (n / 12) * Math.PI * 2;
            tube(
              hoop,
              [Math.cos(a) * 0.62, 0, 0.6 + Math.sin(a) * 0.62],
              [Math.cos(a + 0.3) * 0.42, -0.7, 0.6 + Math.sin(a + 0.3) * 0.42],
              0.012,
              "#fff7de",
            );
          }
          st.hoop = hoop;
          st.ball = ball(p, 0, 1.25, 2.1, 0.23, 0.23, 0.23, "#db8950");
          for (const axis of [0, Math.PI / 2]) {
            const seam = torus(st.ball, 0, 0, 0, 1.01, 0.025, "#644b45");
            seam.rotation.y = axis;
          }
          st.line = tube(p, [0, 0.5, 1], [0, 0.5, -5], 0.035, "#fff0aa");
        } else {
          box(
            p,
            0,
            1.7,
            -3,
            4,
            2.5,
            0.5,
            id === "puzzle" ? "#b0d3c4" : "#64798c",
          );
          for (let k = 0; k < 3; k++)
            cyl(
              p,
              -1.1 + k * 1.1,
              1.7,
              -2.67,
              0.38,
              0.38,
              0.12,
              colors[k],
              20,
            ).rotation.x = Math.PI / 2;
        }
      }
    }
    return w;
  }
  function instrument(actor, slot) {
    if (actor.userData.instrument) return;
    const p = new T.Group();
    actor.userData.rig.add(p);
    p.position.set(0, 0.85, 0.55);
    actor.userData.instrument = p;
    if (slot < 2) {
      ball(p, -0.1, 0, 0, 0.4, 0.55, 0.12, slot ? "#e5b45d" : "#d58da6");
      ball(p, 0.05, 0.2, 0, 0.28, 0.32, 0.13, "#f0cf8a");
      box(p, 0.35, 0.65, 0, 0.12, 1.3, 0.1, "#806478");
      p.rotation.z = -0.5;
      for (let j = 0; j < 4; j++)
        tube(
          p,
          [-0.05 + j * 0.035, -0.25, 0.14],
          [0.35 + j * 0.025, 1.25, 0.14],
          0.006,
          "#fff2d1",
        );
    } else if (slot === 2) {
      box(p, 0, 0, 0.15, 1.7, 0.2, 0.55, "#5f4e73");
      for (let j = 0; j < 12; j++)
        box(
          p,
          -0.76 + j * 0.135,
          0.13,
          0.18,
          0.11,
          0.035,
          0.45,
          j % 3 ? "#fff3dc" : "#4b465d",
        );
    } else {
      for (const x of [-0.45, 0.45]) {
        cyl(p, x, 0, 0.1, 0.35, 0.35, 0.5, "#cb8aa3");
        cyl(p, x, 0.26, 0.1, 0.33, 0.33, 0.03, "#fff3dc");
      }
      for (const a of actor.userData.arms)
        tube(a, [0, -0.3, 0], [0, -0.6, 0.6], 0.025, "#edce92");
    }
  }
  function update(w, s, t) {
    roster(w, s);
    const g = s?.game,
      id = w.name,
      now = t * 1000,
      ids = g?.active || [0, 1, 2, 3],
      count = ids.length;
    if (id === "volcano") {
      w.smoke.forEach((m, j) => {
        m.position.x = Math.sin(t + j) * 0.6;
        m.position.y = 8 + j * 0.8 + Math.sin(t * 0.6 + j) * 0.2;
      });
      w.rocks.forEach((o, j) => {
        const r = g?.rocks?.[j];
        o.root.visible = !!r;
        if (!r) return;
        const dt = now - g.start - r.at,
          q = clamp(1 + dt / r.lead);
        o.root.position.set(r.x, 0, r.z);
        o.shadow.scale.set(r.radius * q, 1, r.radius * q);
        o.rim.scale.set(r.radius, 1, r.radius);
        o.rim.visible = dt < 0;
        o.rock.visible = dt > -260;
        o.rock.position.y =
          dt < 0 ? 0.7 + (-dt / 260) ** 2 * 12 : Math.max(-3, 0.7 - dt / 300);
        o.rock.rotation.z = t * 3;
        o.rock.scale.setScalar(r.radius * 0.65);
      });
    }
    if (id === "math") {
      animateCharacter(w.teacher, t, "fish", 0.65);
      w.card.rotation.z = Math.sin(t) * 0.015;
      if (g?.cue && w.questionText !== g.cue.text) {
        w.questionText = g.cue.text;
        if (w.question) {
          w.root.remove(w.question);
          w.question.material.map?.dispose();
          w.question.material.dispose();
        }
        w.question = sign(w.root, g.cue.text + " = ?", 0, 3, -5.82, 0.22);
      }
    }
    if (id === "band")
      w.crowd.forEach((a, j) => animateCharacter(a, t + j * 0.4, "win", 0.6));
    w.actors.forEach((a, i) => {
      const slot = ids.indexOf(i);
      a.visible = slot >= 0;
      if (slot < 0) return;
      const v = g?.progress[i] || {},
        st = w.stations[slot];
      let x = (slot - (count - 1) / 2) * 7,
        z = 3,
        y = 0.45,
        pose = "idle";
      if (st?.root && !["baseball", "math"].includes(id))
        st.root.position.x = x;
      if (id === "bumper" || id === "volcano") {
        const targetX = v.x ?? Math.cos((slot * Math.PI) / 2 + 0.8) * 5,
          targetZ = v.z ?? Math.sin((slot * Math.PI) / 2 + 0.8) * 5;
        const dt = Math.min(
            0.05,
            Math.max(0.001, t - (a.userData.positionAt || t - 0.016)),
          ),
          blend = 1 - Math.exp(-18 * dt);
        a.userData.positionAt = t;
        if (!a.userData.motionReady) {
          a.position.set(targetX, 0.5, targetZ);
          a.userData.motionReady = true;
        }
        x = mix(a.position.x, targetX, blend);
        z = mix(a.position.z, targetZ, blend);
        if (Math.hypot(v.vx || 0, v.vz || 0) > 0.2)
          a.rotation.y = Math.atan2(v.vx, v.vz);
        if (id === "bumper") {
          if (!a.userData.car) {
            const car = new T.Group();
            a.add(car);
            box(car, 0, 0.35, 0, 1.6, 0.45, 1.8, colors[slot]);
            const bumper = torus(car, 0, 0.2, 0, 0.9, 0.13, "#52516c");
            bumper.rotation.x = Math.PI / 2;
            box(car, 0, 0.5, 0.6, 1, 0.1, 0.5, "#fff1d3");
            tube(car, [0, 0.5, -0.8], [0, 3, -0.8], 0.02, "#ddd0b5");
            ball(car, 0, 3, -0.8, 0.1, 0.1, 0.1, "#f7d269");
            a.userData.car = car;
          }
          a.userData.rig.position.y = 0.3;
          pose = "duck";
        } else pose = Math.hypot(v.vx || 0, v.vz || 0) > 0.3 ? "walk" : "idle";
        if (v.eliminatedAt) {
          const q = clamp((now - v.eliminatedAt) / 1100);
          y = 0.5 - 8 * q * q;
          a.rotation.z = q * 1.3;
        }
      } else {
        a.rotation.y = 0.12;
        if (id === "basket") {
          const shot = v.shot,
            q = shot ? Math.max(0, (now - shot.at) / R.ballFlight) : 0;
          st.hoop.position.x = R.hoop(g || { start: 0 }, now);
          st.ball.visible = !shot || q < 1.48;
          if (!shot || q >= 1.48) st.ball.position.set(0, 1.25, 2.1);
          else if (q <= 1) {
            st.ball.position.set(
              0,
              mix(1.25, 2.8, q) + 10 * q * (1 - q),
              mix(2.1, -4.4, q),
            );
            st.ball.rotation.x = -q * 8;
          } else {
            const d = ((q - 1) * R.ballFlight) / 1000,
              hit = Math.abs(shot.hoop) < 0.39;
            st.ball.position.set(
              hit ? 0 : -Math.sign(shot.hoop) * d * 4,
              2.8 + (hit ? -1 : 2) * d - 9 * d * d,
              -4.4 + d * (hit ? 0 : 3),
            );
          }
          pose = shot && now - shot.at < 650 ? "win" : "fish";
        } else if (id === "band") {
          x = (slot - (count - 1) / 2) * 4.8;
          z = -4;
          y = 0.85;
          instrument(a, slot);
          pose = now - (v.hitAt || 0) < 450 ? "sad" : "fish";
          const hit = now - (v.moveAt || 0) < 240;
          a.userData.arms.forEach((arm, j) => {
            arm.rotation.x = -0.9 + Math.sin(t * (hit ? 25 : 5) + j) * 0.12;
          });
          a.rotation.z =
            now - (v.hitAt || 0) < 450
              ? Math.sin(t * 30) * 0.12
              : Math.sin(t * 2 + slot) * 0.025;
        } else if (id === "baseball") {
          z = 4.4;
          x -= 0.65;
          const b = g?.cue,
            dt = b ? now - g.start - b.at : -3000,
            duration =
              b?.type === "fastball"
                ? 900
                : b?.type === "change-up"
                  ? 1700
                  : 1250,
            q = clamp((dt + duration) / duration);
          st.pitcher.position.x = x + 0.65;
          animateCharacter(st.pitcher, t, q < 0.1 ? "fish" : "idle");
          const h = v.batHit,
            hit = h?.pitch === b?.index && h.points && now >= h.at;
          st.ball.visible =
            (!!b && dt > -duration && dt < 500) || (!!hit && now - h.at < 1300);
          if (hit) {
            const d = (now - h.at) / 1000;
            st.ball.position.set(
              x + 0.65 + d * 6,
              1.3 + d * 13 - d * d * 4,
              4 - d * 22,
            );
          } else
            st.ball.position.set(
              x +
                0.65 +
                (b?.type === "curve" ? Math.sin(q * Math.PI) * 1.1 : 0),
              1.2 + Math.sin(q * Math.PI) * 0.35,
              mix(-9, 4, q),
            );
          if (!a.userData.bat) {
            const bat = cyl(
              a.userData.arms[1],
              0,
              -0.65,
              0.3,
              0.06,
              0.12,
              1.2,
              "#d2a474",
              12,
            );
            bat.rotation.x = 0.8;
            a.userData.bat = bat;
          }
          pose = "fish";
          const swing = clamp((now - (v.moveAt || 0)) / 500);
          a.rotation.y =
            swing < 1 ? -0.8 + Math.sin(swing * Math.PI) * 2.1 : -0.8;
        } else if (id === "math") {
          x = (slot - (count - 1) / 2) * 5;
          z = 2.4;
          pose = g?.cue?.reveal
            ? v.roundScores?.[g.cue.index]
              ? "win"
              : "sad"
            : "fish";
        } else {
          pose =
            now - (v.hitAt || 0) < 650
              ? "sad"
              : now - (v.moveAt || 0) < 500
                ? "fish"
                : "idle";
        }
      }
      a.position.set(x, y, z);
      a.scale.setScalar(id === "band" ? 1.05 : 0.8);
      animateCharacter(a, t, pose, 0.85);
      if (id === "band")
        a.userData.arms.forEach(
          (arm, j) => (arm.rotation.x += Math.sin(t * 12 + j) * 0.12),
        );
      if (v.finished && !v.eliminatedAt) animateCharacter(a, t, "win", 0.7);
    });
    if (id === "bumper" || id === "volcano")
      return {
        target: new T.Vector3(0, 1, 0),
        extent: 25,
        position: [0, 30, 22],
      };
    if (id === "band")
      return {
        target: new T.Vector3(0, -3, -1),
        extent: 23,
        position: [0, 15, 32],
      };
    if (id === "math")
      return {
        target: new T.Vector3(0, 1, -3),
        extent: 25,
        position: [0, 20, 32],
      };
    return {
      target: new T.Vector3(0, 1, -2),
      extent: 27,
      position: [0, 25, 35],
    };
  }
  function overlay(c, canvas, w, s, t) {
    if (!s?.game) return;
    const g = s.game,
      id = g.id,
      W = canvas.clientWidth,
      Ht = canvas.clientHeight,
      now = t * 1000;
    if (id === "band") {
      const width = Math.min(W * 0.75, 310),
        left = (W - width) / 2,
        top = Ht * 0.43,
        bottom = Ht * 0.77;
      c.fillStyle = "#273047eF";
      c.beginPath();
      c.roundRect(left - 7, top - 8, width + 14, bottom - top + 25, 15);
      c.fill();
      for (let lane = 0; lane < 4; lane++) {
        c.fillStyle = colors[lane] + "38";
        c.fillRect(left + (lane * width) / 4, top, width / 4 - 3, bottom - top);
      }
      c.strokeStyle = "#ffe29a";
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(left, bottom);
      c.lineTo(left + width, bottom);
      c.stroke();
      for (const n of g.notes || []) {
        const dt = g.start + n.at - now,
          y = bottom - (dt / 4000) * (bottom - top);
        if (y < top || y > bottom + 10) continue;
        c.fillStyle = colors[n.lane];
        c.beginPath();
        c.roundRect(
          left + (n.lane * width) / 4 + 7,
          y - 6,
          width / 4 - 17,
          13,
          5,
        );
        c.fill();
      }
      c.font = "800 11px system-ui";
      c.textAlign = "center";
      c.fillStyle = "#fff5d5";
      c.fillText(R.songs[g.song || 0].name.toUpperCase(), W / 2, top - 17);
    }
    for (const [i, a] of w.actors.entries()) {
      if (!a.visible || !g.active.includes(i)) continue;
      const p = a.position.clone();
      p.y += 3.3;
      p.project(w.camera);
      const x = (p.x * 0.5 + 0.5) * W,
        y = (-p.y * 0.5 + 0.5) * Ht;
      c.font = "800 12px system-ui";
      c.textAlign = "center";
      const score = g.scores[i] + " pts",
        tw = c.measureText(score).width;
      c.fillStyle = "#3d3a57dc";
      c.beginPath();
      c.roundRect(x - tw / 2 - 7, y - 13, tw + 14, 19, 6);
      c.fill();
      c.fillStyle = "#fff3c7";
      c.fillText(score, x, y + 1);
    }
  }
  return { build, update, overlay };
}
