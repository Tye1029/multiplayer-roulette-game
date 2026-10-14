import * as T from "./vendor/three.module.min.js";
const C = globalThis.PartyCatalog,
  TAU = Math.PI * 2,
  clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n)),
  mix = (a, b, t) => a + (b - a) * t;
const mats = new Map(),
  geos = new Map(),
  worlds = new Map(),
  portraits = new Map();
const mat = (color, roughness = 0.72) => {
  const key = color + ":" + roughness;
  if (!mats.has(key))
    mats.set(key, new T.MeshStandardMaterial({ color, roughness }));
  return mats.get(key);
};
const geo = (key, make) => {
  if (!geos.has(key)) geos.set(key, make());
  return geos.get(key);
};
function mesh(parent, g, color, x = 0, y = 0, z = 0) {
  const m = new T.Mesh(g, typeof color === "object" ? color : mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function box(p, x, y, z, w, h, d, color) {
  return mesh(
    p,
    geo("b" + [w, h, d], () => new T.BoxGeometry(w, h, d)),
    color,
    x,
    y,
    z,
  );
}
function ball(p, x, y, z, rx, ry, rz, color) {
  const m = mesh(
    p,
    geo("sphere", () => new T.SphereGeometry(1, 16, 12)),
    color,
    x,
    y,
    z,
  );
  m.scale.set(rx, ry, rz);
  return m;
}
function cyl(p, x, y, z, rt, rb, h, color, n = 20) {
  return mesh(
    p,
    geo("c" + [rt, rb, h, n], () => new T.CylinderGeometry(rt, rb, h, n)),
    color,
    x,
    y,
    z,
  );
}
function tube(p, a, b, r, color) {
  const v = new T.Vector3(...b).sub(new T.Vector3(...a)),
    m = cyl(
      p,
      ...new T.Vector3(...a).addScaledVector(v, 0.5).toArray(),
      r,
      r,
      v.length(),
      color,
      8,
    );
  m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), v.normalize());
  return m;
}
function torus(p, x, y, z, r, t, color) {
  return mesh(
    p,
    geo("t" + [r, t], () => new T.TorusGeometry(r, t, 8, 32)),
    color,
    x,
    y,
    z,
  );
}
function label(text, color = "#253752", bg = null, size = 1) {
  const cv = document.createElement("canvas");
  cv.width = 512;
  cv.height = 128;
  const c = cv.getContext("2d");
  if (bg) {
    c.fillStyle = bg;
    c.beginPath();
    c.roundRect(3, 3, 506, 122, 35);
    c.fill();
  }
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillStyle = color;
  c.font = "900 52px system-ui";
  c.fillText(text, 256, 66, 475);
  const tex = new T.CanvasTexture(cv);
  tex.colorSpace = T.SRGBColorSpace;
  const m = new T.Sprite(
    new T.SpriteMaterial({ map: tex, transparent: true, depthTest: false }),
  );
  m.scale.set(size * 4, size, 1);
  m.renderOrder = 10;
  return m;
}
function discIcon(p, text, x, y, z, color) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const c = cv.getContext("2d");
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.font = "900 58px system-ui";
  c.fillStyle = color;
  c.fillText(text, 64, 70);
  const tex = new T.CanvasTexture(cv);
  tex.colorSpace = T.SRGBColorSpace;
  const m = mesh(
    p,
    new T.PlaneGeometry(0.78, 0.78),
    new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
    x,
    y,
    z,
  );
  m.rotation.x = -Math.PI / 2;
  return m;
}
function mascot(id, skin = "classic") {
  const root = new T.Group(),
    rig = new T.Group();
  root.add(rig);
  const def = C.characters.find((c) => c.id === id) || C.characters[0],
    fur = def.color,
    coat =
      skin === "sunset"
        ? "#f7a760"
        : skin === "electric"
          ? "#9d71e6"
          : skin === "champion"
            ? "#eec457"
            : def.accent;
  const body = ball(
    rig,
    0,
    0.95,
    0,
    id === "frog" ? 0.53 : 0.4,
    0.54,
    0.34,
    coat,
  );
  ball(
    rig,
    0,
    0.93,
    0.3,
    0.27,
    0.36,
    0.09,
    id === "robot" ? "#b5e7de" : "#fff1cd",
  );
  const legs = [],
    arms = [];
  for (const side of [-1, 1]) {
    const leg = new T.Group();
    leg.position.set(side * 0.23, 0.54, 0);
    rig.add(leg);
    cyl(
      leg,
      0,
      -0.14,
      0,
      0.14,
      0.16,
      0.35,
      id === "robot" ? fur : "#48516a",
      12,
    );
    ball(
      leg,
      0,
      -0.36,
      0.14,
      0.21,
      0.15,
      0.29,
      id === "frog" ? fur : "#fff0d0",
    );
    legs.push(leg);
    const arm = new T.Group();
    arm.position.set(side * 0.4, 1.26, 0);
    rig.add(arm);
    ball(arm, side * 0.08, -0.23, 0, 0.16, 0.32, 0.16, coat);
    ball(arm, side * 0.1, -0.45, 0.03, 0.17, 0.17, 0.17, fur);
    arms.push(arm);
  }
  const head = new T.Group();
  head.position.y = 1.77;
  rig.add(head);
  if (id === "robot") {
    box(head, 0, 0, 0, 1.05, 0.85, 0.73, fur);
    box(head, 0, 0.02, 0.39, 0.87, 0.65, 0.07, "#fff1ce");
    for (const x of [-0.22, 0.22])
      ball(head, x, 0.04, 0.445, 0.085, 0.14, 0.025, "#243954");
    tube(head, [0, 0.43, 0], [0.08, 0.78, 0], 0.045, "#fff1ce");
    ball(head, 0.08, 0.83, 0, 0.13, 0.13, 0.13, "#ffc04a");
    for (const side of [-1, 1])
      cyl(head, side * 0.6, 0, 0, 0.17, 0.17, 0.1, "#f5c46d").rotation.z =
        Math.PI / 2;
    box(rig, 0, 1.1, -0.4, 0.58, 0.65, 0.28, "#ee9054");
    for (let i = 0; i < 3; i++)
      ball(
        rig,
        -0.13 + i * 0.13,
        1.02,
        0.405,
        0.04,
        0.04,
        0.025,
        ["#ef826a", "#f5c04b", "#70c5a9"][i],
      );
  } else {
    ball(
      head,
      0,
      0,
      0,
      id === "frog" ? 0.67 : 0.56,
      id === "frog" ? 0.4 : 0.52,
      0.48,
      fur,
    );
    if (id === "raccoon") {
      for (const side of [-1, 1]) {
        ball(head, side * 0.23, 0.04, 0.42, 0.25, 0.18, 0.08, "#474663");
        ball(head, side * 0.44, 0.42, -0.02, 0.21, 0.23, 0.16, fur);
        ball(head, side * 0.44, 0.44, 0.105, 0.12, 0.13, 0.05, "#ffd1be");
      }
      const band = torus(head, 0, 0.07, 0, 0.66, 0.075, "#fdb64d");
      band.scale.y = 1.05;
      for (const side of [-1, 1]) {
        ball(head, side * 0.66, 0.02, 0, 0.13, 0.26, 0.24, "#f8b544");
        ball(head, side * 0.73, 0.02, 0.02, 0.05, 0.18, 0.16, "#36445d");
      }
    }
    if (id === "fox") {
      for (const side of [-1, 1]) {
        const e = cyl(head, side * 0.37, 0.52, -0.03, 0, 0.25, 0.63, fur, 3);
        e.rotation.z = side * -0.16;
        const inn = cyl(
          head,
          side * 0.37,
          0.53,
          0.11,
          0,
          0.135,
          0.39,
          "#ffe8c3",
          3,
        );
        inn.rotation.z = side * -0.16;
      }
    }
    if (id === "frog") {
      for (const side of [-1, 1]) {
        ball(head, side * 0.37, 0.32, 0.15, 0.25, 0.25, 0.23, fur);
        ball(head, side * 0.37, 0.37, 0.34, 0.17, 0.19, 0.07, "#fff4d8");
        ball(head, side * 0.37, 0.38, 0.405, 0.085, 0.13, 0.03, "#243954");
      }
      cyl(head, 0, 0.6, -0.08, 0.67, 0.67, 0.07, "#344965");
      cyl(head, 0, 0.75, -0.08, 0.42, 0.46, 0.3, "#344965");
      cyl(head, 0, 0.64, -0.08, 0.44, 0.46, 0.08, "#e7c165");
    } else
      for (const side of [-1, 1]) {
        ball(head, side * 0.21, 0.05, 0.49, 0.13, 0.16, 0.06, "#fff6e1");
        ball(head, side * 0.205, 0.04, 0.545, 0.065, 0.095, 0.03, "#28384d");
        ball(head, side * 0.22, 0.08, 0.567, 0.025, 0.03, 0.02, "white");
      }
    ball(
      head,
      0,
      -0.18,
      0.42,
      id === "frog" ? 0.38 : 0.32,
      0.22,
      0.22,
      "#fff1ce",
    );
    ball(
      head,
      0,
      -0.12,
      0.62,
      0.095,
      0.065,
      0.06,
      id === "frog" ? fur : "#3e3443",
    );
    const smile = torus(head, 0, -0.23, 0.625, 0.12, 0.018, "#6b4b50");
    smile.scale.y = 0.55;
  }
  if (id === "fox") {
    const scarf = torus(rig, 0, 1.43, 0, 0.37, 0.105, "#d64888");
    scarf.rotation.x = Math.PI / 2;
    box(rig, 0.22, 1.17, 0.39, 0.16, 0.55, 0.07, "#d64888");
  }
  if (id === "raccoon" || id === "fox") {
    const tail = new T.Group();
    tail.position.set(0, 0.67, -0.22);
    tail.rotation.x = -0.6;
    rig.add(tail);
    if (id === "fox") {
      ball(tail, 0, 0.55, -0.35, 0.28, 0.55, 0.33, fur);
      ball(tail, 0, 0.97, -0.35, 0.23, 0.25, 0.28, "#fff1ce");
    } else
      for (let n = 0; n < 5; n++)
        ball(
          tail,
          0,
          0.1 + n * 0.18,
          -0.22 - n * 0.1,
          0.25,
          0.18,
          0.23,
          n % 2 ? "#57506f" : fur,
        );
    root.userData.tail = tail;
  }
  if (skin === "champion") {
    cyl(head, 0, 0.58, 0, 0.32, 0.37, 0.16, "#f7ca4b");
    for (let n = 0; n < 5; n++) {
      const a = (n / 5) * TAU;
      cyl(
        head,
        Math.cos(a) * 0.3,
        0.76,
        Math.sin(a) * 0.3,
        0,
        0.09,
        0.27,
        "#f7ca4b",
        4,
      );
    }
  }
  root.userData = { ...root.userData, rig, head, legs, arms, id };
  return root;
}
function animateCharacter(m, t, mode = "idle", amount = 1) {
  const u = m.userData,
    walk = mode === "walk",
    win = mode === "win",
    fish = mode === "fish",
    climb = mode === "climb";
  u.rig.position.y =
    (walk
      ? Math.abs(Math.sin(t * 10)) * 0.1
      : win
        ? Math.abs(Math.sin(t * 4)) * 0.24
        : Math.sin(t * 2) * 0.018) * amount;
  u.head.rotation.z = Math.sin(t * 1.8) * 0.035;
  u.legs.forEach(
    (l, i) =>
      (l.rotation.x =
        (walk
          ? Math.sin(t * 10 + i * Math.PI) * 0.6
          : climb
            ? Math.sin(t * 5 + i * Math.PI) * 0.4
            : 0) * amount),
  );
  u.arms.forEach((a, i) => {
    a.rotation.x =
      (walk
        ? -Math.sin(t * 10 + i * Math.PI) * 0.65
        : climb
          ? -1.6 + Math.sin(t * 5 + i * Math.PI) * 0.55
          : fish
            ? -1.0
            : 0) * amount;
    a.rotation.z = win
      ? (i ? 1 : -1) * (1.8 + Math.sin(t * 6) * 0.2)
      : Math.sin(t * 2 + i) * 0.06;
  });
  if (u.tail) u.tail.rotation.z = Math.sin(t * 3) * 0.1;
}
let renderer = null,
  failed = false;
function engine() {
  if (renderer || failed) return renderer;
  try {
    renderer = new T.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
  } catch (e) {
    failed = true;
    console.warn("Boardwalk 3D unavailable; using map view.");
  }
  return renderer;
}
function world(name) {
  if (worlds.has(name)) return worlds.get(name);
  const scene = new T.Scene();
  scene.background = new T.Color("#aadeda");
  scene.fog = new T.Fog("#b1e3dd", 55, 95);
  scene.add(new T.HemisphereLight("#fff0dc", "#72a8af", 1.65));
  const sun = new T.DirectionalLight("#fff0d1", 2.3);
  sun.position.set(-16, 30, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {
    left: -25,
    right: 25,
    top: 25,
    bottom: -25,
    near: 1,
    far: 80,
  });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.normalBias = 0.06;
  sun.shadow.bias = -0.0002;
  scene.add(sun);
  const fill = new T.DirectionalLight("#a8cfff", 0.8);
  fill.position.set(18, 15, -20);
  scene.add(fill);
  const camera = new T.OrthographicCamera(-20, 20, 15, -15, 0.1, 150),
    root = new T.Group();
  scene.add(root);
  const w = {
    name,
    scene,
    camera,
    root,
    actors: [],
    animated: [],
    labels: [],
    sun,
    center: new T.Vector3(),
    size: 25,
  };
  worlds.set(name, w);
  return w;
}
function water(w, size = 100) {
  const m = mesh(
    w.root,
    new T.PlaneGeometry(size, size, 30, 30),
    "#4bbfc9",
    0,
    -0.7,
    0,
  );
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  w.water = m;
  const p = m.geometry.attributes.position;
  w.waterBase = Float32Array.from(p.array);
  for (let i = 0; i < 42; i++) {
    const a = i * 2.399,
      r = 18 + (i % 8) * 3.1;
    const ripple = torus(
      w.root,
      Math.cos(a) * r,
      -0.61,
      Math.sin(a) * r,
      0.35 + (i % 3) * 0.3,
      0.022,
      "#b5e8dc",
    );
    ripple.rotation.x = -Math.PI / 2;
    w.animated.push((t) =>
      ripple.scale.setScalar(1 + 0.15 * Math.sin(t * 1.1 + i)),
    );
  }
}
function palm(w, x, z, scale = 1) {
  const g = new T.Group();
  g.position.set(x, 0.45, z);
  g.scale.setScalar(scale);
  w.root.add(g);
  tube(g, [0, 0, 0], [0.2, 2.7, 0], 0.14, "#bc885a");
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU,
      leaf = ball(
        g,
        Math.cos(a) * 0.64,
        2.9,
        Math.sin(a) * 0.64,
        0.86,
        0.1,
        0.3,
        i % 2 ? "#60b88d" : "#409c7d",
      );
    leaf.rotation.y = -a;
    leaf.rotation.z = -0.15;
  }
  for (let i = 0; i < 3; i++)
    ball(
      g,
      Math.cos(i * 2) * 0.15,
      2.7,
      Math.sin(i * 2) * 0.15,
      0.17,
      0.2,
      0.17,
      "#96704a",
    );
  w.animated.push((t) => (g.rotation.z = Math.sin(t * 0.7 + x) * 0.018));
}
function building(w, x, z, scale, color, roof, labelText) {
  const g = new T.Group();
  g.position.set(x, 0.45, z);
  g.scale.setScalar(scale);
  w.root.add(g);
  box(g, 0, 1.15, 0, 2.4, 2.3, 1.8, color);
  box(g, 0, 0.12, 0, 2.65, 0.25, 2, "#fff1ce");
  const r = cyl(g, 0, 2.65, 0, 0, 2, 1.2, roof, 4);
  r.rotation.y = Math.PI / 4;
  r.scale.z = 0.8;
  for (const a of [-0.72, 0.72]) {
    box(g, a, 1.1, 0.94, 0.7, 1.05, 0.07, "#f7e7bf");
    box(g, a, 1.12, 0.99, 0.51, 0.82, 0.04, "#72c6ce");
    box(g, a, 1.12, 1.02, 0.06, 0.85, 0.03, "#fff1cf");
  }
  const awning = box(g, 0, 1.95, 1.1, 2.55, 0.16, 0.9, "#fff1d7");
  awning.rotation.x = 0.12;
  for (let i = 0; i < 5; i++)
    box(g, -1.02 + i * 0.51, 1.97, 1.11, 0.24, 0.18, 0.9, roof).rotation.x =
      0.12;
  if (labelText) {
    const sign = label(labelText, "#fff7df", "#33445b", 0.42);
    sign.position.set(0, 2.15, 1.08);
    g.add(sign);
  }
  return g;
}
function wheel(w, x, z) {
  const g = new T.Group();
  g.position.set(x, 0.45, z);
  w.root.add(g);
  for (const side of [-1, 1])
    tube(g, [side * 1.9, 0, 0], [0, 3.5, 0], 0.13, "#f7dfba");
  const rotor = new T.Group();
  rotor.position.y = 3.5;
  g.add(rotor);
  torus(rotor, 0, 0, 0, 2.7, 0.1, "#f7d6a2");
  torus(rotor, 0, 0, 0, 2.4, 0.05, "#e78b97");
  const cabins = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    tube(
      rotor,
      [0, 0, 0],
      [Math.cos(a) * 2.7, Math.sin(a) * 2.7, 0],
      0.035,
      "#fff1cb",
    );
    const cab = new T.Group();
    cab.position.set(Math.cos(a) * 2.7, Math.sin(a) * 2.7, 0.05);
    rotor.add(cab);
    box(
      cab,
      0,
      -0.2,
      0.14,
      0.63,
      0.48,
      0.62,
      ["#f18d92", "#7cc9c1", "#c7a1e4", "#f4c259"][i % 4],
    );
    box(cab, 0, 0.15, 0.14, 0.72, 0.08, 0.7, "#fff0cc");
    cabins.push(cab);
  }
  ball(g, 0, 3.5, 0.2, 0.28, 0.28, 0.2, "#f3c051");
  w.animated.push((t) => {
    rotor.rotation.z = t * 0.075;
    cabins.forEach((c) => (c.rotation.z = -t * 0.075));
  });
}
function tent(w, x, z) {
  const g = new T.Group();
  g.position.set(x, 0.4, z);
  w.root.add(g);
  cyl(g, 0, 0.9, 0, 1.45, 1.45, 1.8, "#fff1d5", 12);
  const materials = Array.from({ length: 12 }, (_, i) =>
    mat(i % 2 ? "#f18c93" : "#fff1cf"),
  );
  const roof = new T.Mesh(new T.ConeGeometry(2, 1.7, 12, 1, true), materials);
  roof.geometry.clearGroups();
  for (let i = 0; i < roof.geometry.index.count / 3; i++)
    roof.geometry.addGroup(i * 3, 3, i % 2);
  roof.position.y = 2.6;
  g.add(roof);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    box(
      g,
      Math.cos(a) * 1.44,
      0.95,
      Math.sin(a) * 1.44,
      0.23,
      1.7,
      0.15,
      i % 2 ? "#f18c93" : "#fff1cf",
    ).rotation.y = -a;
  }
  tube(g, [0, 3.3, 0], [0, 4.1, 0], 0.04, "#fff1cf");
  const flag = box(g, 0.3, 3.9, 0, 0.6, 0.3, 0.03, "#8b7bd7");
  w.animated.push((t) => (flag.rotation.y = Math.sin(t * 2) * 0.2));
  return g;
}
function lighthouse(w, x, z) {
  const g = new T.Group();
  g.position.set(x, 0.4, z);
  w.root.add(g);
  for (let i = 0; i < 5; i++)
    cyl(
      g,
      0,
      0.5 + i * 0.72,
      0,
      0.58 - i * 0.035,
      0.64 - i * 0.035,
      0.75,
      i % 2 ? "#ed827b" : "#fff0cf",
    );
  cyl(g, 0, 4.1, 0, 0.7, 0.7, 0.18, "#3e6573");
  cyl(g, 0, 4.5, 0, 0.45, 0.45, 0.7, "#ffd77c");
  cyl(g, 0, 5, 0, 0, 0.8, 0.55, "#df8173");
  w.animated.push((t) => (g.children[6].rotation.y = t * 0.2));
}
function cloud(w, x, y, z, s) {
  const g = new T.Group();
  g.position.set(x, y, z);
  for (let i = 0; i < 4; i++)
    ball(
      g,
      (i - 1.5) * s * 0.7,
      Math.sin(i) * s * 0.15,
      0,
      s * 0.75,
      s * 0.35,
      s * 0.5,
      "#fff4df",
    );
  w.root.add(g);
  w.animated.push((t) => (g.position.x = x + Math.sin(t * 0.08 + z) * 1.5));
}
function trophy(p, x, y, z, scale = 1) {
  const g = new T.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(scale);
  p.add(g);
  cyl(g, 0, 0.1, 0, 0.4, 0.4, 0.18, "#fff0bd");
  cyl(g, 0, 0.4, 0, 0.1, 0.13, 0.45, "#edaf3e");
  cyl(g, 0, 0.83, 0, 0.43, 0.16, 0.57, "#ffcf5d");
  for (const side of [-1, 1]) {
    const h = torus(g, side * 0.4, 0.82, 0, 0.22, 0.06, "#efb644");
    h.scale.y = 1.15;
  }
  return g;
}
function boardWorld() {
  const w = world("board");
  if (w.built) return w;
  w.built = true;
  water(w);
  const outline = C.spaces
    .slice(0, 32)
    .map((n) => new T.Vector2(n.x * 1.065, n.z * 1.1));
  const shape = new T.Shape(outline);
  const land = mesh(
    w.root,
    new T.ExtrudeGeometry(shape, {
      depth: 0.9,
      bevelEnabled: true,
      bevelSize: 0.4,
      bevelThickness: 0.1,
      bevelSegments: 2,
      steps: 1,
    }),
    "#efd6a3",
    0,
    0.28,
    0,
  );
  land.rotation.x = Math.PI / 2;
  const lawn = mesh(w.root, new T.ShapeGeometry(shape), "#9ad1a0", 0, 0.4, 0);
  lawn.rotation.x = Math.PI / 2;
  lawn.material = new T.MeshStandardMaterial({
    color: "#9ad1a0",
    side: T.DoubleSide,
    roughness: 1,
  });
  lawn.receiveShadow = true;
  for (const n of C.spaces) {
    for (const next of n.next) {
      const b = C.spaces[next],
        a = new T.Vector3(n.x, n.y - 0.12, n.z),
        end = new T.Vector3(b.x, b.y - 0.12, b.z),
        d = end.clone().sub(a),
        bridge = box(
          w.root,
          ...a.clone().addScaledVector(d, 0.5).toArray(),
          1.28,
          0.19,
          d.length() + 0.1,
          "#d9b281",
        );
      bridge.quaternion.setFromUnitVectors(
        new T.Vector3(0, 0, 1),
        d.normalize(),
      );
      const count = Math.ceil(a.distanceTo(end) / 0.3);
      for (let i = 1; i < count; i++) {
        const at = a.clone().lerp(end, i / count),
          plank = box(w.root, ...at.toArray(), 1.25, 0.025, 0.035, "#b78e65");
        plank.position.y += 0.11;
        plank.quaternion.copy(bridge.quaternion);
      }
      if (n.id >= 32 || next >= 32) {
        for (const side of [-1, 1]) {
          const v = new T.Vector3(-d.z, 0, d.x).multiplyScalar(side * 0.66);
          tube(
            w.root,
            a
              .clone()
              .add(v)
              .add(new T.Vector3(0, 0.7, 0))
              .toArray(),
            end
              .clone()
              .add(v)
              .add(new T.Vector3(0, 0.7, 0))
              .toArray(),
            0.035,
            "#f6e2b7",
          );
          tube(
            w.root,
            a.clone().add(v).toArray(),
            a
              .clone()
              .add(v)
              .add(new T.Vector3(0, 0.8, 0))
              .toArray(),
            0.05,
            "#ba8763",
          );
        }
        cyl(
          w.root,
          n.x,
          (n.y - 0.7) / 2,
          n.z,
          0.13,
          0.16,
          n.y + 0.7,
          "#a97c59",
        );
      }
    }
    const info = C.spaceInfo[n.type];
    cyl(w.root, n.x, n.y, n.z, 0.65, 0.68, 0.19, "#fff0d0", 24);
    cyl(w.root, n.x, n.y + 0.12, n.z, 0.55, 0.55, 0.08, info.color, 24);
    discIcon(w.root, info.icon, n.x, n.y + 0.167, n.z, "#28465c");
  }
  const pond = ball(w.root, 0, 0.41, 0, 3.7, 0.06, 2.1, "#4bafbe");
  pond.receiveShadow = true;
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU;
    ball(
      w.root,
      Math.cos(a) * 3.75,
      0.46,
      Math.sin(a) * 2.16,
      0.22,
      0.12,
      0.16,
      "#e9d9ae",
    );
  }
  for (let i = 0; i < 24; i++) {
    const x = -7 + (i % 6) * 2.4,
      z = i < 12 ? -5.9 : 5.7;
    ball(w.root, x, 0.47, z, 0.25, 0.1, 0.25, "#4fa482");
    for (let j = 0; j < 3; j++)
      ball(
        w.root,
        x + Math.sin(j * 2 + i) * 0.15,
        0.61,
        z + Math.cos(j * 2 + i) * 0.15,
        0.085,
        0.09,
        0.085,
        ["#ed8e9b", "#f6c75b", "#b49bd8"][i % 3],
      );
  }
  w.podium = new T.Group();
  w.root.add(w.podium);
  cyl(w.podium, 0, 0.73, 3.4, 1.6, 1.8, 0.65, "#f2c464", 32);
  cyl(w.podium, 0, 1.08, 3.4, 1.6, 1.6, 0.08, "#fff0c6", 32);
  trophy(w.podium, 2, 1, 3.6, 0.8);
  w.podium.visible = false;
  wheel(w, -5.8, -0.4);
  tent(w, 5.5, 1.1);
  lighthouse(w, 10.1, 0.2);
  building(w, 0, -5.2, 1.18, "#f3a58f", "#9e85cb", "ARCADE");
  building(w, -8, -3.9, 0.66, "#8bc4b7", "#f4b75c", "SNACKS");
  building(w, 5, -5.2, 0.63, "#b5a5da", "#ec9c83", "ITEMS");
  building(w, -3.2, 5.3, 0.55, "#edc269", "#f39c9b", "POST");
  for (const [x, z, s] of [
    [-9, 1, 0.8],
    [-8, 1.7, 0.65],
    [9, 4, 0.8],
    [7, -4, 0.6],
    [-2, -6.8, 0.7],
    [2, 5.3, 0.65],
    [-4, 1.3, 0.55],
  ])
    palm(w, x, z, s);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU,
      x = Math.cos(a) * 13.8,
      z = Math.sin(a) * 9.9;
    ball(
      w.root,
      x,
      -0.5,
      z,
      0.6 + (i % 3) * 0.25,
      0.55,
      0.65,
      ["#c7bba1", "#cbbfb5", "#b2bdb0"][i % 3],
    );
  }
  for (let i = 0; i < 12; i++) {
    const n = C.spaces[(i * 3) % 32];
    tube(
      w.root,
      [n.x + 0.8, n.y, n.z],
      [n.x + 0.8, n.y + 1.4, n.z],
      0.04,
      "#786b72",
    );
    ball(w.root, n.x + 0.8, n.y + 1.55, n.z, 0.14, 0.18, 0.14, "#fff2b3");
  }
  for (let i = 0; i < 6; i++) {
    const a = i * 1.7,
      g = new T.Group();
    g.position.set(Math.cos(a) * 17, -0.35, Math.sin(a) * 13);
    w.root.add(g);
    ball(g, 0, 0, 0, 0.8, 0.25, 0.33, ["#ee997d", "#f8d98d", "#a59ad3"][i % 3]);
    tube(g, [0, 0, 0], [0, 1.5, 0], 0.025, "#fff0d0");
    const sail = mesh(
      g,
      new T.ConeGeometry(0.65, 1.3, 3),
      "#fff1ce",
      0.2,
      0.85,
      0,
    );
    sail.scale.z = 0.08;
    w.animated.push((t) => {
      g.position.y = -0.35 + Math.sin(t * 1.4 + i) * 0.07;
      g.rotation.y = a + Math.sin(t * 0.2 + i) * 0.12;
    });
  }
  for (let i = 0; i < 6; i++)
    cloud(w, -25 + i * 10, 9 + (i % 2) * 3, -20 - (i % 3) * 4, 1.5 + (i % 2));
  w.goal = trophy(w.root, 0, 0, 0, 0.95);
  w.goalRing = torus(w.root, 0, 0, 0, 0.85, 0.055, "#fff2a6");
  w.goalRing.rotation.x = Math.PI / 2;
  w.dice = [];
  for (let j = 0; j < 2; j++) {
    const materials = [1, 6, 2, 5, 3, 4].map((value) => {
      const cv = document.createElement("canvas");
      cv.width = cv.height = 128;
      const c = cv.getContext("2d");
      c.fillStyle = "#fff5df";
      c.fillRect(0, 0, 128, 128);
      c.strokeStyle = "#e6caa0";
      c.lineWidth = 5;
      c.strokeRect(2, 2, 124, 124);
      c.fillStyle = "#35465f";
      const positions = {
        1: [[0, 0]],
        2: [
          [-1, -1],
          [1, 1],
        ],
        3: [
          [-1, -1],
          [0, 0],
          [1, 1],
        ],
        4: [
          [-1, -1],
          [-1, 1],
          [1, -1],
          [1, 1],
        ],
        5: [
          [-1, -1],
          [-1, 1],
          [1, -1],
          [1, 1],
          [0, 0],
        ],
        6: [
          [-1, -1],
          [-1, 0],
          [-1, 1],
          [1, -1],
          [1, 0],
          [1, 1],
        ],
      };
      for (const [x, y] of positions[value]) {
        c.beginPath();
        c.arc(64 + x * 31, 64 + y * 31, 10, 0, TAU);
        c.fill();
      }
      const tex = new T.CanvasTexture(cv);
      tex.colorSpace = T.SRGBColorSpace;
      return new T.MeshStandardMaterial({ map: tex, roughness: 0.35 });
    });
    const die = mesh(w.root, new T.BoxGeometry(1.5, 1.5, 1.5), materials);
    w.dice.push(die);
  }
  const batches = new Map();
  for (const m of [...w.root.children]) {
    if (
      !m.isMesh ||
      Array.isArray(m.material) ||
      !["BoxGeometry", "CylinderGeometry", "SphereGeometry"].includes(
        m.geometry.type,
      )
    )
      continue;
    const key = m.geometry.uuid + ":" + m.material.uuid;
    const list = batches.get(key) || [];
    list.push(m);
    batches.set(key, list);
  }
  for (const list of batches.values()) {
    if (list.length < 3) continue;
    const batch = new T.InstancedMesh(
      list[0].geometry,
      list[0].material,
      list.length,
    );
    batch.castShadow = true;
    batch.receiveShadow = true;
    list.forEach((m, i) => {
      m.updateMatrix();
      batch.setMatrixAt(i, m.matrix);
      w.root.remove(m);
    });
    w.root.add(batch);
  }
  return w;
}
function roster(w, state) {
  const ps =
      state?.players ||
      C.characters.map((p, i) => ({
        id: p.id,
        name: p.name,
        character: p.id,
        skin: "classic",
        position: i * 8,
      })),
    key = ps.map((p) => p.id + p.character + p.skin).join("|");
  if (w.roster === key) return;
  for (const a of w.actors) {
    w.root.remove(a);
    a.userData.nameLabel?.material.map.dispose();
    a.userData.nameLabel?.material.dispose();
  }
  w.actors = ps.map((p) => {
    const a = mascot(p.character, p.skin);
    a.userData.playerId = p.id;
    a.userData.smoothStep = 0;
    const l = label(p.name, "#2e4058", "#fff6de", 0.3);
    l.position.y = 2.65;
    a.add(l);
    a.userData.nameLabel = l;
    w.root.add(a);
    return a;
  });
  w.roster = key;
}
function updateBoard(w, s, t, extra) {
  roster(w, s);
  const ps =
      s?.players || C.characters.map((p, i) => ({ id: p.id, position: i * 8 })),
    m = s?.lastMove;
  w.actors.forEach((a, i) => {
    const p = ps[i],
      n = C.spaces[p.position] || C.spaces[0];
    let x = n.x,
      y = n.y + 0.2,
      z = n.z,
      walking = false;
    if (m?.player === p.id && t * 1000 < m.at + m.duration) {
      const f = clamp((t * 1000 - m.at) / m.duration) * (m.path.length - 1),
        j = Math.min(m.path.length - 2, Math.floor(f)),
        a1 = C.spaces[m.path[j]],
        b = C.spaces[m.path[j + 1]],
        q = f - j;
      x = mix(a1.x, b.x, q);
      y = mix(a1.y, b.y, q) + 0.2 + Math.sin(q * Math.PI) * (m.warp ? 3 : 0.24);
      z = mix(a1.z, b.z, q);
      a.rotation.y = Math.atan2(b.x - a1.x, b.z - a1.z);
      walking = true;
    }
    const crowd = ps.filter((v) => v.position === p.position).length;
    if (crowd > 1 && !walking) {
      x += (i % 2 ? 1 : -1) * 0.35;
      z += (i < 2 ? 1 : -1) * 0.25;
    }
    a.position.set(x, y, z);
    a.scale.setScalar(0.72);
    if (!walking) a.rotation.y = 0.28;
    animateCharacter(
      a,
      t + i,
      walking ? "walk" : s?.phase === "complete" ? "win" : "idle",
      extra.motion === false ? 0 : 1,
    );
    a.userData.nameLabel.visible = s?.phase !== "complete";
  });
  const complete = s?.phase === "complete";
  w.podium.visible = complete;
  w.goal.visible = !complete;
  w.goalRing.visible = !complete;
  if (complete) {
    const winner = w.actors.find((a) => a.userData.playerId === s.winner);
    if (winner) {
      winner.position.set(0, 1.15, 3.4);
      winner.scale.setScalar(1.35);
      winner.rotation.y = 0.5;
    }
  }
  const n = C.spaces[s?.goal ?? 8];
  w.goal.position.set(n.x, n.y + 1.1 + Math.sin(t * 2) * 0.15, n.z);
  w.goal.rotation.y = t * 0.8;
  w.goalRing.position.set(n.x, n.y + 0.2, n.z);
  w.goalRing.scale.setScalar(1 + Math.sin(t * 2) * 0.06);
  const dice = s?.dice,
    turn = s?.players[s?.turn],
    at = C.spaces[turn?.position ?? 0];
  w.dice.forEach((d, i) => {
    d.visible = !!dice && i < dice.values.length && s.phase === "rolling";
    if (!d.visible) return;
    const age = t * 1000 - dice.at,
      settled = age >= 1150;
    d.position.set(
      at.x + (i ? 1.8 : -0.3),
      at.y + 2.8 + (settled ? 0 : Math.abs(Math.sin(age / 130)) * 0.8),
      at.z + 0.5,
    );
    const angles = {
      1: [0, 0, Math.PI / 2],
      2: [0, 0, 0],
      3: [-Math.PI / 2, 0, 0],
      4: [Math.PI / 2, 0, 0],
      5: [Math.PI, 0, 0],
      6: [0, 0, -Math.PI / 2],
    };
    const r = angles[dice.values[i]];
    d.rotation.set(...(settled ? r : [age * 0.012, age * 0.008, age * 0.009]));
  });
  let target = new T.Vector3(0, 0, 0),
    extent = 26;
  if (complete) {
    target.set(0, 1.6, 3.4);
    extent = 14;
  }
  if (
    s &&
    !extra.overview &&
    ["board", "rolling", "walking", "choice", "space"].includes(s.phase)
  ) {
    const a = w.actors[s.turn];
    if (a) {
      target.copy(a.position).multiplyScalar(0.55);
      target.y = 0.5;
      extent = 19;
    }
  }
  w.center.lerp(target, 0.06);
  w.size = mix(w.size, extent, 0.06);
  return { target: w.center, extent: w.size, position: [27, 33, 35] };
}

function climbWorld() {
  const w = world("climb");
  if (w.built) return w;
  w.built = true;
  w.scene.background = new T.Color("#b9dce8");
  w.scene.fog = new T.Fog("#bfdfe5", 45, 85);
  box(w.root, 0, -0.5, 0, 24, 1, 12, "#dcad95");
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * 3.8,
      col = ["#9b91ca", "#f0a487", "#81bda7", "#79b7cd"][i];
    box(w.root, x, 8.1, 0, 3.1, 16.2, 2.4, col);
    box(w.root, x, 16.3, 0, 3.35, 0.35, 2.7, "#fff0d4");
    for (let n = 0; n < 24; n++) {
      const y = 0.6 + n * 0.64;
      box(
        w.root,
        x,
        y,
        1.5,
        2.2,
        0.13,
        0.75,
        n % 6 === 5 ? "#ffc858" : "#e8d8b7",
      );
      for (const side of [-1, 1]) {
        box(
          w.root,
          x + side * 0.82,
          y + 0.32,
          1.23,
          0.35,
          0.36,
          0.06,
          "#486a8a",
        );
        tube(
          w.root,
          [x + side * 1.16, y, 1.22],
          [x + side * 1.16, y + 0.45, 1.22],
          0.035,
          "#e7cfaf",
        );
      }
    }
    trophy(w.root, x, 16.5, 0, 0.65);
    box(w.root, x - 0.65, 16.65, -0.5, 0.7, 0.65, 0.7, "#6c929c");
  }
  for (let i = 0; i < 16; i++) {
    const x = (i - 8) * 3.5,
      h = 4 + ((i * 7) % 9);
    box(
      w.root,
      x,
      h / 2,
      -7 - (i % 3) * 2,
      2.8,
      h,
      3,
      ["#9dbbc6", "#a6c5cf", "#c3c7d3"][i % 3],
    );
    for (let j = 0; j < 4; j++)
      box(
        w.root,
        x,
        h - j * 2 - 1,
        -5.45 - (i % 3) * 2,
        1.7,
        0.5,
        0.05,
        "#f2d8a8",
      );
  }
  for (let i = 0; i < 6; i++) cloud(w, -16 + i * 7, 19 + (i % 3) * 2, -13, 1.6);
  return w;
}
function updateClimb(w, s, t) {
  roster(w, s);
  const g = s?.game;
  w.actors.forEach((a, i) => {
    const step = g?.progress[i]?.step ?? [12, 9, 14, 7][i],
      v = g?.progress[i];
    a.userData.smoothStep = mix(a.userData.smoothStep, step, 0.16);
    a.position.set((i - 1.5) * 3.8, 0.7 + a.userData.smoothStep * 0.64, 2);
    a.rotation.y = Math.PI;
    a.scale.setScalar(0.75);
    a.userData.nameLabel.rotation.y = Math.PI;
    animateCharacter(
      a,
      t + i,
      Math.abs(a.userData.smoothStep - step) > 0.03
        ? "climb"
        : v?.finished
          ? "win"
          : "idle",
    );
  });
  return {
    target: new T.Vector3(0, 8.7, 0),
    extent: 21,
    position: [15, 19, 34],
  };
}
function fishWorld() {
  const w = world("fish");
  if (w.built) return w;
  w.built = true;
  water(w);
  box(w.root, 0, -0.1, -4, 27, 0.8, 4, "#c7996a");
  for (let i = 0; i < 44; i++)
    box(w.root, -13 + i * 0.6, 0.33, -4, 0.04, 0.04, 4, "#b0845d");
  w.rods = [];
  w.bobbers = [];
  w.fishes = [];
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * 5.2;
    box(w.root, x, 0.15, 0, 2.3, 0.35, 6, "#d4ab76");
    for (let j = 0; j < 12; j++)
      box(w.root, x, 0.35, -2.7 + j * 0.48, 2.3, 0.025, 0.045, "#ac805c");
    for (const side of [-1, 1]) {
      cyl(w.root, x + side * 1, 0.0, 2.5, 0.12, 0.15, 2, "#8f7660");
      cyl(w.root, x + side * 1, 0, -2, 0.12, 0.15, 2, "#8f7660");
    }
    const rod = new T.Group();
    rod.position.set(x, 0.7, 1.2);
    w.root.add(rod);
    tube(rod, [0.25, 0.8, 0.1], [0.3, 2, 2.2], 0.035, "#34475c");
    tube(rod, [0.3, 2, 2.2], [0.3, -0.9, 3.6], 0.008, "#fff4ce");
    w.rods.push(rod);
    const bob = ball(w.root, x + 0.3, -0.5, 4.8, 0.11, 0.19, 0.11, "#f27b77");
    w.bobbers.push(bob);
    const fish = new T.Group();
    ball(
      fish,
      0,
      0,
      0,
      0.4,
      0.18,
      0.17,
      ["#ffd277", "#9bd2bd", "#df9cb8", "#8ed0e0"][i],
    );
    const tail = cyl(fish, -0.4, 0, 0, 0, 0.2, 0.3, "#efad68", 3);
    tail.rotation.z = Math.PI / 2;
    ball(fish, 0.25, 0.07, 0.13, 0.04, 0.04, 0.03, "#2c4453");
    fish.visible = false;
    w.root.add(fish);
    w.fishes.push(fish);
  }
  lighthouse(w, 12, -6);
  building(w, -10, -5, 0.9, "#f3b489", "#98bba7", "FRESH CATCH");
  for (const x of [-6, 3, 8]) palm(w, x, -6, 0.8);
  for (let i = 0; i < 5; i++) cloud(w, -20 + i * 10, 9, -14, 2);
  return w;
}
function updateFish(w, s, t) {
  roster(w, s);
  w.actors.forEach((a, i) => {
    a.position.set((i - 1.5) * 5.2, 0.4, 0.6);
    a.rotation.y = 0;
    a.scale.setScalar(1);
    const v = s?.game?.progress[i],
      age = v?.catch ? (t * 1000 - v.catch.at) / 1000 : 10;
    animateCharacter(
      a,
      t + i,
      v?.hook ? "fish" : age < 1.5 && v.catch.score ? "win" : "idle",
    );
    w.rods[i].rotation.x = v?.hook
      ? -0.15 + Math.sin(t * 10) * 0.03
      : Math.sin(t * 1.4 + i) * 0.02;
    w.bobbers[i].position.y = -0.5 + Math.sin(t * 3 + i) * 0.07;
    const f = w.fishes[i];
    f.visible = !!v?.catch?.score && age >= 0 && age < 1.8;
    if (f.visible) {
      f.position.set(
        a.position.x + 0.3,
        -0.3 + Math.sin((age / 1.8) * Math.PI) * 2.5,
        4.8 - age * 2,
      );
      f.rotation.z = t * 4;
    }
  });
  return {
    target: new T.Vector3(0, 0.4, 0),
    extent: 18,
    position: [13, 17, 29],
  };
}
function memoryWorld() {
  const w = world("memory");
  if (w.built) return w;
  w.built = true;
  w.scene.background = new T.Color("#34365f");
  w.scene.fog = new T.Fog("#34365f", 35, 80);
  box(w.root, 0, -0.35, 0, 24, 0.7, 15, "#776fa1");
  box(w.root, 0, 0.03, 0, 23, 0.09, 14, "#47456c");
  w.pads = [];
  const spots = [
      [0, 3],
      [-7, -3],
      [0, -4],
      [7, -3],
    ],
    colors = ["#60c1f0", "#f28fb8", "#77d3ac", "#f5c75f"];
  for (let j = 0; j < 4; j++) {
    const [x, z] = spots[j];
    cyl(w.root, x, 0.12, z, 3.2, 3.35, 0.25, "#d7c0f0", 32);
    const pads = [];
    for (let i = 0; i < 4; i++) {
      const m = box(
        w.root,
        x + (i % 2 ? 1 : -1) * 1.08,
        0.32,
        z + (i < 2 ? -1 : 1) * 1.08,
        1.96,
        0.28,
        1.96,
        new T.MeshStandardMaterial({
          color: colors[i],
          roughness: 0.28,
          emissive: colors[i],
          emissiveIntensity: 0.04,
        }),
      );
      pads.push(m);
      discIcon(
        w.root,
        String(i + 1),
        m.position.x,
        0.48,
        m.position.z,
        "#35405a",
      );
    }
    w.pads.push(pads);
  }
  for (const x of [-10, 10]) {
    box(w.root, x, 2.1, -4, 1.4, 4.2, 1.5, "#292e4d");
    for (const y of [1, 3]) {
      const r = torus(w.root, x, y, -3.2, 0.48, 0.1, "#a998cd");
      ball(w.root, x, y, -3.2, 0.3, 0.3, 0.08, "#3c4561");
    }
  }
  tube(w.root, [-10, 0, -6], [-10, 7, -6], 0.12, "#bdb6dd");
  tube(w.root, [10, 0, -6], [10, 7, -6], 0.12, "#bdb6dd");
  tube(w.root, [-10, 7, -6], [10, 7, -6], 0.12, "#bdb6dd");
  const disco = ball(
    w.root,
    0,
    6.5,
    -3,
    0.8,
    0.8,
    0.8,
    new T.MeshStandardMaterial({
      color: "#cae5ee",
      metalness: 0.75,
      roughness: 0.25,
      flatShading: true,
    }),
  );
  w.animated.push((t) => (disco.rotation.y = t * 0.4));
  for (let i = 0; i < 7; i++) {
    const x = -9 + i * 3,
      beam = mesh(
        w.root,
        new T.ConeGeometry(1.3, 7, 16, 1, true),
        new T.MeshBasicMaterial({
          color: colors[i % 4],
          transparent: true,
          opacity: 0.08,
          depthWrite: false,
          side: T.DoubleSide,
        }),
        x,
        3,
        -4,
      );
    beam.rotation.z = 0.3 * Math.sin(i);
    w.animated.push((t) => (beam.rotation.z = Math.sin(t * 0.6 + i) * 0.4));
    ball(w.root, x, 7, -5, 0.2, 0.2, 0.2, colors[i % 4]);
  }
  const sign = label("AFTERGLOW", "#fff0c9", "#68568f", 0.75);
  sign.position.set(0, 5, -6);
  w.root.add(sign);
  return w;
}
function updateMemory(w, s, t, extra) {
  roster(w, s);
  const you = Math.max(0, s?.players.findIndex((p) => p.id === s.you) ?? 0),
    spots = [
      [0, 3],
      [-7, -3],
      [0, -4],
      [7, -3],
    ],
    order = [you, ...w.actors.map((_, i) => i).filter((i) => i !== you)],
    v = s?.game?.progress[you],
    a = Math.floor((t * 1000 - (v?.showAt || 0)) / 650),
    pattern = extra.pattern || [],
    flash =
      a >= 0 && a < pattern.length && (t * 1000 - v.showAt) % 650 < 460
        ? pattern[a]
        : -1;
  order.forEach((idx, j) => {
    const actor = w.actors[idx],
      pos = spots[j];
    actor.position.set(pos[0], 0.65, pos[1]);
    actor.scale.setScalar(j ? 0.8 : 1);
    actor.rotation.y = 0.2;
    animateCharacter(actor, t + idx, !s || v?.combo ? "win" : "idle", 0.45);
    w.pads[j].forEach((p, i) => {
      p.material.emissiveIntensity = j === 0 && flash === i ? 1.25 : 0.04;
      p.position.y = j === 0 && flash === i ? 0.4 : 0.32;
    });
  });
  return { target: new T.Vector3(0, 1, 0), extent: 18, position: [16, 22, 29] };
}
function puttWorld(index) {
  const w = world("putt" + index);
  if (w.built) return w;
  w.built = true;
  water(w);
  const h = C.holes[index],
    conv = ([x, z]) => [(x - 360) / 25, (z - 360) / 25];
  w.conv = conv;
  box(w.root, 0, -0.15, 0, 23, 1, 24, "#eac898");
  box(w.root, 0, 0.42, 0, 21, 0.16, 22, "#80bd94");
  for (let i = 0; i < 11; i++)
    box(
      w.root,
      0,
      0.51,
      -10 + i * 2,
      20.7,
      0.015,
      0.8,
      i % 2 ? "#8cc79d" : "#86c098",
    );
  const vertices = h.floor;
  for (let i = 0; i < vertices.length; i++) {
    const a = conv(vertices[i]),
      b = conv(vertices[(i + 1) % vertices.length]),
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      m = box(
        w.root,
        (a[0] + b[0]) / 2,
        0.72,
        (a[1] + b[1]) / 2,
        0.25,
        0.5,
        Math.hypot(dx, dz) + 0.2,
        "#fff0cf",
      );
    m.rotation.y = Math.atan2(dx, dz);
  }
  for (const [a, b] of h.walls) {
    const p = conv(a),
      q = conv(b),
      m = box(
        w.root,
        (p[0] + q[0]) / 2,
        0.8,
        (p[1] + q[1]) / 2,
        0.35,
        0.65,
        Math.hypot(q[0] - p[0], q[1] - p[1]),
        "#ec9c8c",
      );
    m.rotation.y = Math.atan2(q[0] - p[0], q[1] - p[1]);
  }
  for (const b of h.bumpers) {
    const [x, z] = conv([b.x, b.y]);
    cyl(w.root, x, 0.75, z, b.r / 25, b.r / 25, 0.5, "#dca1bf");
    cyl(w.root, x, 1, z, (b.r / 25) * 0.95, (b.r / 25) * 0.95, 0.08, "#fff0d2");
  }
  for (const b of h.sand) {
    const [x, z] = conv([b.x + b.w / 2, b.y + b.h / 2]);
    box(w.root, x, 0.53, z, b.w / 25, 0.04, b.h / 25, "#e9d49b");
  }
  const cup = conv(h.cup);
  cyl(w.root, cup[0], 0.535, cup[1], 0.45, 0.45, 0.03, "#345e58");
  tube(w.root, [cup[0], 0.54, cup[1]], [cup[0], 3, cup[1]], 0.045, "#fff1d2");
  const flag = box(
    w.root,
    cup[0] + 0.45,
    2.65,
    cup[1],
    0.9,
    0.55,
    0.04,
    "#d576aa",
  );
  w.animated.push((t) => (flag.rotation.y = Math.sin(t * 2) * 0.15));
  w.ball = ball(w.root, 0, 0.72, 0, 0.22, 0.22, 0.22, "#fff8e8");
  w.aimDots = Array.from({ length: 14 }, () =>
    ball(w.root, 0, 0.56, 0, 0.065, 0.03, 0.065, "#fff6d5"),
  );
  palm(w, -12, -8, 1.2);
  palm(w, 12, 4, 1);
  building(w, 12, -7, 0.9, "#f2b8a1", "#afa1d3", "PUTT CLUB");
  const rotor = new T.Group();
  rotor.position.set(-12, 3, 2);
  w.root.add(rotor);
  cyl(w.root, -12, 1.2, 2, 0.7, 0.9, 2.4, "#fff1d4");
  for (let i = 0; i < 4; i++) {
    const blade = box(rotor, 0, 1, 0, 0.3, 2.3, 0.13, "#ec9a86");
    blade.position.set(
      Math.sin((i * Math.PI) / 2),
      Math.cos((i * Math.PI) / 2),
      0,
    );
    blade.rotation.z = (-i * Math.PI) / 2;
  }
  w.animated.push((t) => (rotor.rotation.z = t * 0.6));
  return w;
}
function updatePutt(w, s, t, extra) {
  roster(w, s);
  const i = Math.max(0, s?.players.findIndex((p) => p.id === s.you) ?? 0),
    v = s?.game?.progress[i],
    shot = v?.shot,
    h = C.holes[Number(w.name.slice(4))];
  let position = h.tee,
    rolling = false;
  if (shot && shot.course === Number(w.name.slice(4))) {
    const elapsed = t * 1000 - shot.at;
    if (elapsed <= shot.duration + 450) {
      rolling = true;
      let a = shot.frames[0],
        b = shot.frames.at(-1);
      for (let j = 1; j < shot.frames.length; j++)
        if (shot.frames[j][0] >= elapsed) {
          a = shot.frames[j - 1];
          b = shot.frames[j];
          break;
        }
      const q = clamp((elapsed - a[0]) / (b[0] - a[0] || 1));
      position = [mix(a[1], b[1], q), mix(a[2], b[2], q)];
      w.ball.scale.setScalar(0.22 * mix(a[3], b[3], q));
    }
  }
  const [x, z] = w.conv(position);
  w.ball.position.set(x, 0.76, z);
  if (!rolling) w.ball.scale.setScalar(0.22);
  const aim = extra.aim || { angle: -1.2, power: 0.5 },
    tee = w.conv(h.tee);
  w.aimDots.forEach((p, j) => {
    p.visible = !rolling && !v?.finished;
    p.position.set(
      tee[0] + Math.cos(aim.angle) * (j + 1) * aim.power * 0.55,
      0.57,
      tee[1] + Math.sin(aim.angle) * (j + 1) * aim.power * 0.55,
    );
  });
  w.actors.forEach((a, j) => {
    a.visible = j === i;
    a.position.set(tee[0] - 1.1, 0.55, tee[1] + 0.5);
    a.rotation.y = 1;
    a.scale.setScalar(0.75);
    animateCharacter(a, t, rolling ? "win" : "idle", 0.4);
  });
  return { target: new T.Vector3(0, 0, 0), extent: 28, position: [15, 31, 30] };
}
function sceneFrame(w, t, view, canvas) {
  const r = engine(),
    width = canvas.width,
    height = canvas.height,
    aspect = width / height,
    extent = view.extent,
    cam = w.camera;
  cam.left = (-extent * aspect) / 2;
  cam.right = (extent * aspect) / 2;
  cam.top = extent / 2;
  cam.bottom = -extent / 2;
  cam.position.copy(view.target).add(new T.Vector3(...view.position));
  cam.lookAt(view.target);
  cam.updateProjectionMatrix();
  const scenicTime = w.motion === false ? 0 : t;
  for (const f of w.animated) f(scenicTime);
  if (w.water) {
    const a = w.water.geometry.attributes.position,
      base = w.waterBase;
    for (let i = 0; i < a.count; i++)
      a.setZ(
        i,
        Math.sin(base[i * 3] * 0.6 + scenicTime * 0.8) * 0.04 +
          Math.cos(base[i * 3 + 1] * 0.8 + scenicTime) * 0.035,
      );
    a.needsUpdate = true;
  }
  r.setSize(width, height, false);
  r.render(w.scene, cam);
  const c = canvas.getContext("2d");
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.drawImage(r.domElement, 0, 0);
  return c;
}
function text(c, str, x, y, size, color = "#fff4df", align = "center") {
  c.fillStyle = color;
  c.font = "800 " + size + "px system-ui";
  c.textAlign = align;
  c.fillText(str, x, y);
}
function gauge(c, x, y, w, h, position, center, width, reel) {
  c.fillStyle = "#203d59d9";
  c.beginPath();
  c.roundRect(x, y, w, h, h / 2);
  c.fill();
  c.fillStyle = reel ? "#8be4a7" : "#ffcc67";
  c.beginPath();
  c.roundRect(x + (center - width / 2) * w, y + 3, width * w, h - 6, 5);
  c.fill();
  c.fillStyle = "#fff5d9";
  c.beginPath();
  c.arc(x + clamp(position) * w, y + h / 2, h * 0.55, 0, TAU);
  c.fill();
}
function overlay(c, canvas, kind, s, t, extra) {
  const W = canvas.width,
    H = canvas.height,
    d = W / (canvas.clientWidth || W);
  c.save();
  c.scale(d, d);
  const w = W / d,
    h = H / d,
    v = s?.game?.progress[s.players.findIndex((p) => p.id === s.you)];
  if (kind === "fish") {
    const hook = v?.hook,
      position = hook
        ? 0.5 + 0.46 * Math.sin(((t * 1000 - hook.at) / 1000) * 3.2 - 1)
        : 0.5 + 0.46 * Math.sin((t - (s?.game?.start || 0) / 1000) * 2.1),
      center = hook ? 0.56 : 0.5 + 0.2 * Math.sin((v?.attempts || 0) * 2.1),
      width = hook
        ? hook.risk === "deep"
          ? 0.28
          : 0.5
        : extra.fishRisk === "deep"
          ? 0.32
          : 0.6;
    gauge(c, w * 0.15, h - 44, w * 0.7, 17, position, center, width, !!hook);
    text(
      c,
      hook ? "REEL IN GREEN" : "HOOK IN GOLD",
      w / 2,
      h - 11,
      10,
      "#24465c",
    );
  }
  if (kind === "memory" && v?.reverse) {
    c.fillStyle = "#542f76e0";
    c.beginPath();
    c.roundRect(w / 2 - 86, h - 34, 172, 25, 12);
    c.fill();
    text(c, "↶ REVERSE THE PATTERN", w / 2, h - 17, 10);
  }
  if (kind === "climb" && v?.combo >= 2) {
    text(c, "×" + v.combo + " COMBO", w / 2, h - 17, 13, "#243e58");
  }
  if (kind === "putt") {
    const course =
      v?.shot && t * 1000 < v.shot.at + v.shot.duration + 450
        ? v.shot.course
        : Math.min(2, v?.attempts || 0);
    text(c, "COURSE " + (course + 1) + " / 3", w / 2, h - 14, 11, "#24465c");
  }
  if (
    kind === "board" &&
    s?.phase === "rolling" &&
    s.dice &&
    t * 1000 - s.dice.at > 1150
  ) {
    c.fillStyle = "#263d58e8";
    c.beginPath();
    c.roundRect(w / 2 - 76, h - 49, 152, 34, 15);
    c.fill();
    text(
      c,
      s.dice.values.join(" + ") + "  ·  " + s.dice.total + " SPACES",
      w / 2,
      h - 27,
      12,
    );
  }
  if (s?.phase === "complete" && extra.motion !== false) {
    for (let i = 0; i < 55; i++) {
      const x = (i * 139) % w,
        y = ((t * 65 + i * 43) % (h + 40)) - 20;
      c.save();
      c.translate(x, y);
      c.rotate(t + i);
      c.fillStyle = ["#ffce73", "#d5a8ef", "#80d8b4", "#f29ca8"][i % 4];
      c.fillRect(-2, -5, 4, 10);
      c.restore();
    }
  }
  c.restore();
}
function fallback(canvas, kind, s) {
  const c = canvas.getContext("2d"),
    W = canvas.width,
    H = canvas.height;
  c.fillStyle = "#a5dcd5";
  c.fillRect(0, 0, W, H);
  if (kind === "board") {
    const xy = (n) => [W / 2 + (n.x * W) / 32, H / 2 + (n.z * H) / 23];
    for (const n of C.spaces) {
      for (const id of n.next) {
        const b = C.spaces[id];
        c.strokeStyle = "#d6b187";
        c.lineWidth = W / 70;
        c.beginPath();
        c.moveTo(...xy(n));
        c.lineTo(...xy(b));
        c.stroke();
      }
      c.fillStyle = C.spaceInfo[n.type].color;
      c.beginPath();
      c.arc(...xy(n), W / 70, 0, TAU);
      c.fill();
    }
    for (const [i, p] of (s?.players || []).entries()) {
      const [x, y] = xy(C.spaces[p.position]);
      text(c, String(i + 1), x, y - 10, W / 30, "#263d58");
    }
  } else
    text(
      c,
      C.games.find((g) => g.id === kind)?.name || "Boardwalk",
      W / 2,
      H * 0.45,
      W / 18,
      "#263d58",
    );
}
function render(canvas, kind, state, time = 0, extra = {}) {
  if (!canvas) return;
  const width = canvas.clientWidth || 600,
    height = canvas.clientHeight || 440,
    d = Math.min(devicePixelRatio || 1, 1.6);
  if (
    canvas.width !== Math.round(width * d) ||
    canvas.height !== Math.round(height * d)
  ) {
    canvas.width = Math.round(width * d);
    canvas.height = Math.round(height * d);
  }
  const stillKey = [
    kind,
    state?.id,
    state?.revision,
    state?.phase,
    width,
    height,
    extra.overview,
  ].join(":");
  if (
    extra.motion === false &&
    kind === "board" &&
    ["waiting", "board", "choice", "space", "expired"].includes(state?.phase) &&
    canvas.dataset.stillFrame === stillKey
  )
    return;
  canvas.dataset.stillFrame = stillKey;
  if (!engine()) {
    fallback(canvas, kind, state);
    overlay(canvas.getContext("2d"), canvas, kind, state, time, extra);
    return;
  }
  let w, view;
  if (kind === "board") {
    w = boardWorld();
    view = updateBoard(w, state, time, extra);
  } else if (kind === "climb") {
    w = climbWorld();
    view = updateClimb(w, state, time);
  } else if (kind === "fish") {
    w = fishWorld();
    view = updateFish(w, state, time);
  } else if (kind === "memory") {
    w = memoryWorld();
    view = updateMemory(w, state, time, extra);
  } else {
    const v =
        state?.game?.progress[
          state.players.findIndex((p) => p.id === state.you)
        ],
      index =
        v?.shot && time * 1000 < v.shot.at + v.shot.duration + 450
          ? v.shot.course
          : Math.min(2, v?.attempts || 0);
    w = puttWorld(index || 0);
    view = updatePutt(w, state, time, extra);
  }
  w.motion = extra.motion !== false;
  overlay(sceneFrame(w, time, view, canvas), canvas, kind, state, time, extra);
}
function portrait(canvas, id, skin = "classic") {
  const key = id + skin;
  canvas.width = 180;
  canvas.height = 190;
  const ctx = canvas.getContext("2d");
  if (portraits.has(key)) {
    ctx.drawImage(portraits.get(key), 0, 0);
    return;
  }
  if (!engine()) {
    ctx.fillStyle = C.characters.find((x) => x.id === id)?.color || "#ad9dcc";
    ctx.beginPath();
    ctx.arc(90, 90, 55, 0, TAU);
    ctx.fill();
    return;
  }
  const w = world("portrait");
  w.scene.background = new T.Color("#eee9df");
  if (w.portrait) w.root.remove(w.portrait);
  w.portrait = mascot(id, skin);
  w.portrait.rotation.y = 0.25;
  w.root.add(w.portrait);
  const c = sceneFrame(
    w,
    0,
    { target: new T.Vector3(0, 1.2, 0), extent: 3, position: [2, 2, 8] },
    canvas,
  );
  const copy = document.createElement("canvas");
  copy.width = 180;
  copy.height = 190;
  copy.getContext("2d").drawImage(canvas, 0, 0);
  portraits.set(key, copy);
}
globalThis.PartyScene = { render, portrait };
