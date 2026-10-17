import { midwayScenes } from "./midway-scenes.js?v=BOARDWALK_CARNIVAL_V9";
import { expansionScenes } from "./expansion-scenes.js?v=BOARDWALK_CARNIVAL_V9";
import * as T from "./vendor/three.module.min.js";
import { carnivalScenes } from "./carnival-scenes.js?v=BOARDWALK_CARNIVAL_V9";
import { festivalScenes } from "./festival-scenes.js?v=BOARDWALK_CARNIVAL_V9";
const C = globalThis.PartyCatalog,
  R = globalThis.PartyRules,
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
const spaceTextures = new Map();
function spaceSymbol(parent, n) {
  if (!spaceTextures.has(n.type)) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 128;
    const c = cv.getContext("2d");
    c.strokeStyle = c.fillStyle = "#253d55";
    c.lineWidth = 7;
    c.lineCap = "round";
    c.lineJoin = "round";
    const line = (x, y, a, b) => {
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(a, b);
      c.stroke();
    };
    if (n.type === "shop") {
      c.fillRect(30, 57, 68, 45);
      c.clearRect(55, 73, 20, 29);
      for (let i = 0; i < 4; i++) {
        c.fillStyle = i % 2 ? "#fff9dd" : "#253d55";
        c.fillRect(22 + i * 21, 29, 21, 30);
      }
      c.strokeRect(22, 29, 84, 30);
    } else if (n.type === "gift") {
      c.strokeRect(28, 43, 72, 57);
      line(64, 39, 64, 100);
      line(28, 63, 100, 63);
      for (const x of [47, 81]) {
        c.beginPath();
        c.ellipse(x, 31, 17, 10, x < 64 ? 0.6 : -0.6, 0, TAU);
        c.stroke();
      }
    } else if (n.type === "duel") {
      line(32, 25, 93, 96);
      line(96, 25, 35, 96);
      line(25, 77, 49, 98);
      line(79, 98, 103, 77);
    } else if (n.type === "loss") {
      for (const [x, y, r] of [
        [42, 50, 19],
        [63, 40, 23],
        [85, 53, 18],
      ]) {
        c.beginPath();
        c.arc(x, y, r, 0, TAU);
        c.fill();
      }
      for (const x of [39, 64, 89]) line(x, 84, x - 7, 99);
    } else if (n.type === "trophy") {
      c.beginPath();
      c.moveTo(39, 27);
      c.lineTo(89, 27);
      c.lineTo(82, 66);
      c.quadraticCurveTo(64, 88, 46, 66);
      c.closePath();
      c.fill();
      line(64, 73, 64, 98);
      line(45, 100, 83, 100);
      c.strokeRect(27, 34, 74, 25);
    } else if (n.type === "lucky") {
      for (const [x, y] of [
        [48, 43],
        [80, 43],
        [48, 75],
        [80, 75],
      ]) {
        c.beginPath();
        c.arc(x, y, 19, 0, TAU);
        c.fill();
      }
      line(66, 75, 81, 105);
    } else {
      c.font = "900 " + (n.type === "coins" ? 52 : 72) + "px system-ui";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(C.spaceInfo[n.type].icon, 64, 67);
    }
    const tex = new T.CanvasTexture(cv);
    tex.colorSpace = T.SRGBColorSpace;
    spaceTextures.set(
      n.type,
      new T.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
      }),
    );
  }
  const m = mesh(
    parent,
    geo("space-icon", () => new T.PlaneGeometry(0.78, 0.78)),
    spaceTextures.get(n.type),
    n.x,
    n.y + 0.21,
    n.z,
  );
  m.rotation.x = -Math.PI / 2;
  return m;
}
function mascot(id, skin = "classic") {
  if (["ghost", "skeleton", "knight", "princess"].includes(id))
    return costumeMascot(id, skin);
  const merchant = id === "shopkeeper";
  if (merchant) id = "frog";
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
        ball(head, side * 1.53, 0.02, 0, 0.13, 0.26, 0.24, "#f8b544");
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
  if (merchant) {
    cyl(head, 0, 0.66, 0, 0.56, 0.56, 0.1, "#f2b659");
    cyl(head, 0, 0.83, 0, 0.32, 0.37, 0.28, "#f4d293");
    box(rig, 0, 0.86, 0.35, 0.54, 0.63, 0.08, "#f6e6c8");
    box(rig, 0, 0.85, 0.41, 0.23, 0.19, 0.04, "#e49865");
  }
  root.userData = { ...root.userData, rig, head, legs, arms, id };
  return root;
}
function costumeMascot(id, skin) {
  const root = new T.Group(),
    rig = new T.Group(),
    head = new T.Group(),
    legs = [],
    arms = [];
  root.add(rig);
  rig.add(head);
  head.position.y = 1.83;
  const def = C.characters.find((c) => c.id === id),
    coat =
      skin === "sunset"
        ? "#ed9b67"
        : skin === "electric"
          ? "#8874d2"
          : skin === "champion"
            ? "#e4b949"
            : def.accent;
  const bone = "#fff0cf",
    face = id === "princess" ? "#af7048" : "#efb78e",
    metal = "#b8d5e0";
  for (const side of [-1, 1]) {
    const leg = new T.Group();
    leg.position.set(side * 0.23, 0.55, 0);
    rig.add(leg);
    cyl(
      leg,
      0,
      -0.14,
      0,
      0.12,
      0.13,
      0.34,
      id === "ghost" ? face : id === "knight" ? metal : coat,
      12,
    );
    ball(
      leg,
      0,
      -0.38,
      0.13,
      0.22,
      0.14,
      0.3,
      id === "ghost"
        ? "#bd775c"
        : id === "skeleton"
          ? "#35334c"
          : id === "knight"
            ? "#789aaa"
            : "#f6c964",
    );
    if (id === "ghost") {
      box(leg, 0, -0.29, 0.27, 0.25, 0.04, 0.08, "#fff6dd");
      box(leg, 0, -0.38, 0.32, 0.28, 0.035, 0.04, "#fff6dd");
    }
    legs.push(leg);
    const arm = new T.Group();
    arm.position.set(side * 0.43, 1.28, 0);
    rig.add(arm);
    ball(
      arm,
      side * 0.07,
      -0.2,
      0,
      0.16,
      0.3,
      0.17,
      id === "ghost" ? bone : id === "knight" ? metal : coat,
    );
    ball(
      arm,
      side * 0.1,
      -0.43,
      0.06,
      0.14,
      0.16,
      0.14,
      id === "skeleton" ? bone : face,
    );
    arms.push(arm);
  }
  ball(
    rig,
    0,
    1,
    0,
    0.43,
    0.55,
    0.34,
    id === "ghost" ? bone : id === "knight" ? metal : coat,
  );
  if (id === "ghost") {
    // An unmistakable homemade costume: cloth drape, cut holes, patch and exposed shoes.
    cyl(rig, 0, 1.02, 0, 0.46, 0.67, 1.12, "#fff8e7", 28);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      ball(
        rig,
        Math.cos(a) * 0.54,
        0.48,
        Math.sin(a) * 0.54,
        0.16,
        0.12,
        0.16,
        "#fff8e7",
      );
    }
    ball(head, 0, -0.07, 0, 0.51, 0.57, 0.46, "#fff8e7");
    for (const side of [-1, 1]) {
      ball(head, side * 0.19, -0.06, 0.429, 0.116, 0.17, 0.035, "#50404a");
      ball(head, side * 0.19, -0.07, 0.461, 0.055, 0.082, 0.012, "#201e30");
    }
    for (const x of [-0.34, 0, 0.34])
      tube(rig, [x, 0.62, 0.49], [x * 0.75, 1.42, 0.42], 0.018, "#e6ddcc");
    box(rig, 0.28, 0.86, 0.527, 0.22, 0.22, 0.018, coat);
    for (const y of [0.78, 0.86, 0.94])
      box(rig, 0.28, y, 0.54, 0.27, 0.012, 0.012, bone);
    // A tied corner and the child's small hands keep it playful rather than supernatural.
    ball(head, 0.42, 0.31, -0.04, 0.15, 0.12, 0.13, "#eee2cf");
  } else {
    ball(head, 0, 0, 0, 0.51, 0.49, 0.44, id === "skeleton" ? bone : face);
    for (const side of [-1, 1]) {
      if (id === "skeleton")
        ball(head, side * 0.2, 0.04, 0.4, 0.16, 0.19, 0.065, "#39344c");
      else {
        ball(head, side * 0.19, 0.02, 0.405, 0.13, 0.14, 0.05, "#fff5dc");
        ball(head, side * 0.18, 0.02, 0.45, 0.065, 0.09, 0.025, "#2d3447");
        ball(head, side * 0.19, 0.06, 0.469, 0.022, 0.025, 0.012, "white");
      }
    }
    if (id === "skeleton") {
      ball(head, 0, -0.15, 0.46, 0.055, 0.07, 0.025, "#39344c");
      box(head, 0, -0.3, 0.36, 0.5, 0.18, 0.15, bone);
      for (let i = -2; i <= 2; i++)
        box(head, i * 0.075, -0.29, 0.445, 0.014, 0.13, 0.01, "#9e907b");
      cyl(head, 0, 0.48, 0, 0.62, 0.62, 0.08, "#303248");
      cyl(head, 0, 0.79, 0, 0.36, 0.4, 0.56, "#303248");
      cyl(head, 0, 0.55, 0, 0.4, 0.41, 0.09, "#bb7bb4");
      box(rig, 0, 1.17, 0.335, 0.2, 0.54, 0.04, bone);
      for (const side of [-1, 1]) {
        const lapel = box(
          rig,
          side * 0.17,
          1.2,
          0.35,
          0.13,
          0.43,
          0.07,
          "#646079",
        );
        lapel.rotation.z = side * -0.35;
        ball(rig, side * 0.085, 1.41, 0.38, 0.09, 0.05, 0.03, "#bd7daf");
      }
      for (const y of [0.85, 1.02])
        ball(rig, 0, y, 0.36, 0.04, 0.04, 0.025, "#efc56b");
    } else if (id === "knight") {
      ball(head, 0, 0.15, -0.1, 0.57, 0.52, 0.43, metal);
      box(head, 0, 0.39, 0.32, 0.8, 0.15, 0.17, "#e0edf0");
      for (const side of [-1, 1])
        box(head, side * 0.43, -0.06, 0.25, 0.16, 0.59, 0.27, metal);
      tube(head, [0, 0.49, 0], [0, 0.88, -0.14], 0.1, coat);
      ball(head, 0, 0.83, -0.25, 0.12, 0.17, 0.27, coat);
      for (const side of [-1, 1])
        ball(rig, side * 0.46, 1.36, 0, 0.26, 0.17, 0.25, metal);
      box(rig, 0, 1.15, 0.35, 0.57, 0.46, 0.08, "#dce9ec");
      box(rig, 0, 1.16, 0.401, 0.09, 0.31, 0.025, coat);
      box(rig, 0, 1.2, 0.401, 0.32, 0.08, 0.025, coat);
      const cape = box(rig, 0, 0.96, -0.35, 0.69, 0.85, 0.05, coat);
      cape.rotation.x = -0.13;
      const shield = cyl(arms[0], -0.1, -0.28, 0.15, 0.29, 0.29, 0.08, coat, 6);
      shield.rotation.x = Math.PI / 2;
      ball(arms[0], -0.1, -0.28, 0.21, 0.09, 0.09, 0.04, "#eac15e");
    } else {
      ball(head, 0, 0.22, -0.13, 0.56, 0.43, 0.45, "#493048");
      for (const side of [-1, 1]) {
        ball(head, side * 0.44, -0.2, -0.02, 0.17, 0.5, 0.25, "#493048");
        ball(head, side * 0.35, -0.15, 0.32, 0.09, 0.05, 0.03, "#d98b7d");
        ball(head, side * 0.49, -0.15, 0.15, 0.055, 0.07, 0.04, "#efc861");
      }
      ball(head, -0.21, 0.31, 0.33, 0.29, 0.15, 0.17, "#493048");
      cyl(rig, 0, 0.65, 0, 0.3, 0.69, 0.65, coat, 24);
      cyl(rig, 0, 0.34, 0, 0.68, 0.68, 0.08, "#ffedc7", 24);
      for (const side of [-1, 1])
        ball(rig, side * 0.42, 1.35, 0, 0.21, 0.2, 0.21, "#f3b4cd");
      box(rig, 0, 1.02, 0.34, 0.49, 0.08, 0.07, "#edc369");
      ball(rig, 0, 1.3, 0.36, 0.08, 0.1, 0.03, "#6ed8d3");
      cyl(head, 0, 0.51, 0, 0.31, 0.34, 0.15, "#f4c65b");
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        cyl(
          head,
          Math.cos(a) * 0.29,
          0.68,
          Math.sin(a) * 0.29,
          0,
          0.085,
          0.26,
          "#f4c65b",
          4,
        );
        ball(
          head,
          Math.cos(a) * 0.29,
          0.8,
          Math.sin(a) * 0.29,
          0.045,
          0.045,
          0.045,
          "#7bcdcb",
        );
      }
    }
  }
  root.userData = { rig, head, legs, arms, id };
  return root;
}
function animateCharacter(m, t, mode = "idle", amount = 1) {
  mode = m.userData.resultMode || mode;
  const u = m.userData,
    blend =
      u.poseAt === undefined
        ? 1
        : 1 - Math.exp(-14 * Math.min(0.06, Math.max(0, t - u.poseAt))),
    walk = mode === "walk",
    win = mode === "win" || mode === "jump",
    fish = mode === "fish",
    climb = mode === "climb";
  u.poseAt = t;
  u.rig.position.y = mix(
    u.rig.position.y,
    (walk
      ? Math.abs(Math.sin(t * 10)) * 0.1
      : win
        ? Math.abs(Math.sin(t * 4)) * 0.24
        : Math.sin(t * 2) * 0.018) * amount,
    blend,
  );
  u.rig.rotation.z = mix(
    u.rig.rotation.z,
    mode === "sad" ? Math.sin(t * 1.8) * 0.08 : 0,
    blend,
  );
  u.head.rotation.x = mix(
    u.head.rotation.x,
    mode === "sad" ? 0.28 : mode === "fish" ? -0.08 : 0,
    blend,
  );
  u.rig.scale.y = mix(u.rig.scale.y, mode === "duck" ? 0.7 : 1, blend);
  u.head.rotation.z = mix(u.head.rotation.z, Math.sin(t * 1.8) * 0.035, blend);
  u.legs.forEach(
    (l, i) =>
      (l.rotation.x = mix(
        l.rotation.x,
        (walk
          ? Math.sin(t * 10 + i * Math.PI) * 0.6
          : climb
            ? Math.sin(t * 5 + i * Math.PI) * 0.4
            : 0) * amount,
        blend,
      )),
  );
  u.arms.forEach((a, i) => {
    a.rotation.x = mix(
      a.rotation.x,
      (walk
        ? -Math.sin(t * 10 + i * Math.PI) * 0.65
        : climb
          ? -1.6 + Math.sin(t * 5 + i * Math.PI) * 0.55
          : fish
            ? -1.0
            : 0) * amount,
      blend,
    );
    a.rotation.z = mix(
      a.rotation.z,
      win
        ? (i ? 1 : -1) * (1.8 + Math.sin(t * 6) * 0.2)
        : Math.sin(t * 2 + i) * 0.06,
      blend,
    );
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
function shopCart(w, tile) {
  const len = Math.hypot(tile.x, tile.z),
    cx = tile.x + (tile.x / len) * 4.1,
    cz = tile.z + (tile.z / len) * 4.1;
  const n = { ...tile, x: cx - 1, z: cz + 0.7 };
  tube(
    w.root,
    [tile.x, tile.y - 0.1, tile.z],
    [cx, tile.y - 0.1, cz],
    0.17,
    "#d9b281",
  );
  box(w.root, n.x + 1, n.y - 0.12, n.z - 0.7, 4, 0.25, 3.7, "#cfad7d");
  if (n.y > 0)
    for (const x of [n.x - 0.6, n.x + 2.6])
      for (const z of [n.z - 2.2, n.z + 0.7])
        cyl(w.root, x, n.y / 2 - 0.2, z, 0.1, 0.13, n.y + 0.4, "#947257");
  w.shopkeepers ||= [];
  const g = new T.Group();
  g.position.set(n.x + 1.7, n.y - 0.1, n.z - 1.4);
  w.root.add(g);
  box(g, 0, 0.7, 0, 1.5, 1.1, 0.8, "#e6ae79");
  box(g, 0, 1.3, 0, 1.8, 0.14, 1, "#fff1d6");
  for (const side of [-1, 1]) {
    tube(g, [side * 0.75, 0, 0], [side * 0.75, 2.4, 0], 0.045, "#8d6c60");
    const wheel = torus(g, side * 0.55, 0.05, 0, 0.25, 0.08, "#66596e");
  }
  for (let i = 0; i < 6; i++)
    box(
      g,
      -0.75 + i * 0.3,
      2.45,
      0,
      0.3,
      0.16,
      1.5,
      i % 2 ? "#fff0d0" : "#e596a8",
    );
  const name = label(
    C.shops[tile.id].name.toUpperCase(),
    "#fff7df",
    "#76416b",
    0.64,
  );
  name.position.set(0, 3.05, 0.2);
  g.add(name);
  const merchant = mascot("shopkeeper");
  merchant.scale.setScalar(0.65);
  merchant.position.set(n.x + 1.7, n.y + 0.1, n.z - 2);
  w.root.add(merchant);
  w.shopkeepers.push(merchant);
}
function nearPath(x, z, r = 2.3) {
  return C.spaces.some((a) =>
    a.next.some((id) => {
      const b = C.spaces[id],
        dx = b.x - a.x,
        dz = b.z - a.z,
        t = clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz));
      return Math.hypot(x - a.x - t * dx, z - a.z - t * dz) < r;
    }),
  );
}
function addBoardDetails(w) {
  // Broad plazas and planted districts fill the enlarged island without covering paths.
  for (const [x, z] of [
    [-13, -1],
    [-8, 3],
    [0, -10],
    [14, 0],
    [4, 11],
    [-12, 9],
  ]) {
    if (nearPath(x, z, 3.2)) continue;
    cyl(w.root, x, 0.43, z, 2.4, 2.4, 0.06, "#e9d6ac", 32);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU;
      cyl(
        w.root,
        x + Math.cos(a) * 2,
        0.6,
        z + Math.sin(a) * 2,
        0.25,
        0.25,
        0.35,
        "#dba375",
      );
      ball(
        w.root,
        x + Math.cos(a) * 2,
        0.87,
        z + Math.sin(a) * 2,
        0.38,
        0.35,
        0.38,
        "#67ae84",
      );
    }
    box(w.root, x, 0.8, z, 1.8, 0.13, 0.55, "#c19166");
    for (const d of [-0.6, 0.6])
      box(w.root, x + d, 0.6, z, 0.1, 0.5, 0.45, "#766666");
  }
  for (let i = 0; i < 36; i++) {
    const n = C.spaces[i % C.outerCount],
      x = n.x * 0.85,
      z = n.z * 0.85;
    if (nearPath(x, z, 2.2)) continue;
    if (i % 3 === 0) palm(w, x, z, 0.45 + (i % 4) * 0.08);
    else {
      ball(w.root, x, 0.6, z, 0.45, 0.24, 0.4, "#6fb17d");
      for (let j = 0; j < 3; j++)
        ball(
          w.root,
          x + Math.sin(j * 2) * 0.28,
          0.85,
          z + Math.cos(j * 2) * 0.24,
          0.09,
          0.12,
          0.09,
          ["#ffd579", "#e595bc", "#b3a0ec"][j],
        );
    }
  }
  for (let i = 0; i < 4; i++) {
    const x = -4 + i * 2.5;
    if (nearPath(x, -12, 2.8)) continue;
    building(
      w,
      x,
      -12,
      0.45,
      ["#e8b877", "#eb9c8d", "#98c4b4", "#b2a0cf"][i],
      "#f8d09e",
      ["SODA", "CAKES", "KITES", "POST"][i],
    );
  }
  for (let j = 0; j < 3; j++) {
    const z = -3 + j * 3;
    for (const x of [-6, 6]) {
      if (!nearPath(x, z, 1.8))
        tube(w.root, [x, 0.5, z], [x, 3.6, z], 0.05, "#786e72");
    }
    tube(w.root, [-6, 3.6, z], [6, 3.6, z], 0.014, "#ded2bc");
    for (let i = 0; i < 20; i++) {
      const flag = mesh(
        w.root,
        new T.ConeGeometry(0.16, 0.4, 3),
        ["#f6cb69", "#ea9aba", "#86c7b4"][i % 3],
        -5.5 + i * 0.58,
        3.3,
        z,
      );
      flag.rotation.z = Math.PI;
    }
  }
  const n = C.spaces[25],
    l = label("HARBOR LOOP", "#fff5d7", "#557c82", 0.38);
  l.position.set(n.x + 2, n.y + 2.4, n.z + 1);
  w.root.add(l);
}
function ferryPoint(q) {
  const from = C.spaces[C.ferry.from],
    to = C.spaces[C.ferry.to],
    a = Math.atan2(from.z / 15, from.x / 20),
    b = Math.atan2(to.z / 15, to.x / 20);
  const point = (angle) =>
    new T.Vector3(Math.cos(angle) * 26, 0.12, Math.sin(angle) * 22);
  if (q < 0.15)
    return new T.Vector3(from.x, from.y + 0.2, from.z).lerp(point(a), q / 0.15);
  if (q > 0.85)
    return point(b).lerp(
      new T.Vector3(to.x, to.y + 0.2, to.z),
      (q - 0.85) / 0.15,
    );
  return point(mix(a, b, (q - 0.15) / 0.7));
}
function boardWorld() {
  const w = world("board");
  if (w.built) return w;
  w.built = true;
  water(w);
  const outline = C.spaces
    .slice(0, C.outerCount)
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
          2.9,
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
          plank = box(w.root, ...at.toArray(), 2.86, 0.025, 0.035, "#b78e65");
        plank.position.y += 0.11;
        plank.quaternion.copy(bridge.quaternion);
      }
      if (n.id >= C.outerCount || next >= C.outerCount) {
        for (const side of [-1, 1]) {
          const v = new T.Vector3(-d.z, 0, d.x)
            .normalize()
            .multiplyScalar(side * 1.53);
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
    const sides = {
      coins: 32,
      loss: 4,
      gift: 4,
      shop: 6,
      chance: 8,
      duel: 3,
      lucky: 12,
      event: 5,
      junction: 6,
      trophy: 10,
      start: 32,
    }[n.type];
    const base = cyl(w.root, n.x, n.y, n.z, 1.08, 1.12, 0.22, "#fff8df", sides);
    const top = cyl(
      w.root,
      n.x,
      n.y + 0.15,
      n.z,
      0.95,
      0.95,
      0.1,
      info.color,
      sides,
    );
    if (["loss", "gift"].includes(n.type))
      base.rotation.y = top.rotation.y = Math.PI / 4;
    const mark = spaceSymbol(w.root, n);
    mark.scale.setScalar(1.85);
    for (const to of n.next) {
      const end = C.spaces[to],
        dx = end.x - n.x,
        dz = end.z - n.z,
        length = Math.hypot(dx, dz);
      const arrow = discIcon(
        w.root,
        "➤",
        n.x + dx * 0.5,
        (n.y + end.y) / 2 + 0.17,
        n.z + dz * 0.5,
        "#284b65",
      );
      arrow.rotation.z = -Math.atan2(dz, dx);
      arrow.scale.setScalar(1.4);
    }
    if (n.next.length > 1) {
      cyl(
        w.root,
        n.x * 1.12,
        n.y + 0.7,
        n.z * 1.12,
        0.06,
        0.06,
        1.4,
        "#927352",
      );
      const sign = label("↖  ROUTES  ↗", "#334d62", "#fff0c6", 0.38);
      sign.position.set(n.x * 1.12, n.y + 1.5, n.z * 1.12);
      w.root.add(sign);
    }
    if (n.type === "shop") shopCart(w, n);
  }
  const pondAt = C.scenery.find((p) => p.kind === "pond");
  if (pondAt) {
    ball(w.root, pondAt.x, 0.41, pondAt.z, 2.1, 0.06, 1.7, "#4bafbe");
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU;
      ball(
        w.root,
        pondAt.x + Math.cos(a) * 2.15,
        0.46,
        pondAt.z + Math.sin(a) * 1.75,
        0.18,
        0.12,
        0.14,
        "#e9d9ae",
      );
    }
  }
  for (let i = 0; i < 24; i++) {
    const x = -7 + (i % 6) * 2.4,
      z = i < 12 ? -5.9 : 5.7;
    if (nearPath(x, z, 1.8)) continue;
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
  for (const p of C.scenery) {
    if (p.kind === "wheel") wheel(w, p.x, p.z);
    if (p.kind === "tent") tent(w, p.x, p.z);
    if (p.kind === "lighthouse") lighthouse(w, p.x, p.z);
    const b = {
      arcade: [1.18, "#f3a58f", "#9e85cb", "ARCADE"],
      snacks: [0.66, "#8bc4b7", "#f4b75c", "SNACKS"],
      kites: [0.63, "#b5a5da", "#ec9c83", "KITES"],
      post: [0.55, "#edc269", "#f39c9b", "POST"],
    }[p.kind];
    if (b) building(w, p.x, p.z, ...b);
  }
  for (const [x, z, s] of [
    [-9, 1, 0.8],
    [-8, 1.7, 0.65],
    [9, 4, 0.8],
    [7, -4, 0.6],
    [-2, -6.8, 0.7],
    [2, 5.3, 0.65],
    [-4, 1.3, 0.55],
  ])
    if (!nearPath(x, z, 2.5)) palm(w, x, z, s);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU,
      x = Math.cos(a) * 21.8,
      z = Math.sin(a) * 16.2;
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
    const n = C.spaces[(i * 4) % C.outerCount];
    tube(
      w.root,
      [n.x * 1.11, n.y, n.z],
      [n.x + 0.8, n.y + 1.4, n.z],
      0.04,
      "#786b72",
    );
    ball(
      w.root,
      n.x + 0.8,
      n.y + 1.55,
      n.z * 1.11,
      0.14,
      0.18,
      0.14,
      "#fff2b3",
    );
  }
  for (let i = 0; i < 6; i++) {
    const a = i * 1.7,
      g = new T.Group();
    g.position.set(Math.cos(a) * 25, -0.35, Math.sin(a) * 20);
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
  addBoardDetails(w);
  w.selection = torus(w.root, 0, 0, 0, 1.24, 0.085, "#fff2a6");
  w.selection.rotation.x = -Math.PI / 2;
  w.selectionOuter = torus(w.root, 0, 0, 0, 1.4, 0.07, "#8e3ed0");
  w.selectionOuter.rotation.x = -Math.PI / 2;
  w.selectionTitle = label("SELECTED", "#fff7df", "#7941a8", 0.45);
  w.root.add(w.selectionTitle);
  w.goalTitle = label("TROPHY · 20 COINS", "#523f24", "#ffe494", 0.64);
  w.root.add(w.goalTitle);
  for (const [id, p] of Object.entries(C.trophyPedestals)) {
    const n = C.spaces[id];
    cyl(w.root, p.x, n.y - 0.2, p.z, 1.1, 1.25, 0.8, "#ba966f", 24);
    cyl(w.root, p.x, n.y + 0.22, p.z, 1.1, 1.1, 0.08, "#ffe2a1", 24);
    tube(
      w.root,
      [n.x, n.y - 0.12, n.z],
      [p.x, n.y - 0.12, p.z],
      0.15,
      "#e3b96e",
    );
  }
  w.ferry = new T.Group();
  w.root.add(w.ferry);
  ball(w.ferry, 0, -0.25, 0, 1.1, 0.45, 1.7, "#65bbc9");
  box(w.ferry, 0, 0.05, 0, 1.6, 0.17, 2.5, "#f3cd8f");
  for (const x of [-0.85, 0.85]) {
    box(w.ferry, x, 0.42, 0, 0.12, 0.6, 2.5, "#fff0c5");
    tube(w.ferry, [x, 0.4, -0.8], [x, 2.2, -0.8], 0.05, "#b47d61");
  }
  box(w.ferry, 0, 2.2, -0.8, 2.1, 0.14, 1.1, "#f2a3ba");
  for (const id of [C.ferry.from, C.ferry.to]) {
    const n = C.spaces[id],
      side = Math.sign(n.x);
    box(w.root, n.x + side * 1.9, 0.32, n.z, 2.1, 0.35, 2.5, "#bd936b");
    for (const dz of [-1, 1])
      cyl(
        w.root,
        n.x + side * 2.6,
        -0.35,
        n.z + dz,
        0.1,
        0.13,
        2,
        "#95735f",
        12,
      );
    const sign = label(
      id === C.ferry.from ? "FERRY · 4 COINS" : "FERRY ARRIVAL",
      "#fff5dc",
      "#426f83",
      0.4,
    );
    sign.position.set(n.x + side * 2.8, 2.3, n.z);
    w.root.add(sign);
  }
  w.goal = trophy(w.root, 0, 0, 0, 0.62);
  w.trophyHost = mascot("shopkeeper");
  w.trophyHost.scale.setScalar(0.65);
  w.root.add(w.trophyHost);
  w.hostWings = [-1, 1].map((side) => {
    const wing = ball(
      w.trophyHost,
      side * 0.8,
      1.4,
      -0.2,
      0.7,
      0.12,
      0.4,
      "#fff0c9",
    );
    return wing;
  });
  w.goalRing = torus(w.root, 0, 0, 0, 0.85, 0.055, "#fff2a6");
  w.goalRing.rotation.x = Math.PI / 2;
  w.dice = [];
  for (let j = 0; j < 3; j++) {
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
    die.castShadow = false;
    die.receiveShadow = false;
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
      C.characters.slice(0, 4).map((p, i) => ({
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
      s?.players ||
      C.characters.slice(0, 4).map((p, i) => ({ id: p.id, position: i * 8 })),
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
    if (m?.ferry && m.player === p.id && t * 1000 < m.at + m.duration) {
      const q = clamp((t * 1000 - m.at) / m.duration),
        pos = ferryPoint(q),
        ahead = ferryPoint(Math.min(1, q + 0.003));
      x = pos.x;
      y = pos.y + 0.18;
      z = pos.z;
      a.rotation.y = Math.atan2(ahead.x - x, ahead.z - z);
      walking = true;
    }
    const crowd = ps.filter((v) => v.position === p.position).length;
    if (crowd > 1 && !walking) {
      const seat = ps
        .filter((v) => v.position === p.position)
        .findIndex((v) => v.id === p.id);
      x += Math.cos((seat / crowd) * TAU) * 0.64;
      z += Math.sin((seat / crowd) * TAU) * 0.55;
    }
    a.position.set(x, y, z);
    a.scale.setScalar(0.72);
    if (!walking)
      a.rotation.y +=
        Math.atan2(
          Math.sin(0.28 - a.rotation.y),
          Math.cos(0.28 - a.rotation.y),
        ) * 0.15;
    animateCharacter(
      a,
      t + i,
      walking
        ? m?.ferry
          ? "idle"
          : "walk"
        : s?.phase === "complete"
          ? p.id === s.winner
            ? "win"
            : "sad"
          : s?.phase === "space" && s.event?.player === p.id
            ? s.event.kind === "loss"
              ? "sad"
              : ["coins", "gift", "lucky"].includes(s.event.kind) ||
                  (s.event.kind === "trophy-purchase" && s.event.bought)
                ? "win"
                : "idle"
            : "idle",
      extra.motion === false ? 0 : 1,
    );
    a.userData.nameLabel.visible =
      s?.phase !== "complete" && (crowd === 1 || i === s?.turn);
  });
  w.ferry.visible = s?.phase === "ferry";
  if (w.ferry.visible) {
    const q = clamp((t * 1000 - m.at) / m.duration),
      pos = ferryPoint(q),
      ahead = ferryPoint(Math.min(1, q + 0.003));
    w.ferry.position.copy(pos);
    w.ferry.rotation.y = Math.atan2(ahead.x - pos.x, ahead.z - pos.z);
    w.ferry.rotation.z = Math.sin(t * 5) * 0.02;
  }
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
  const chosen = C.spaces[extra.selectedSpace];
  w.selectionTitle.visible = !!chosen;
  if (chosen) w.selectionTitle.position.set(chosen.x, chosen.y + 1.4, chosen.z);
  for (const ring of [w.selection, w.selectionOuter]) {
    ring.visible = !!chosen;
    if (chosen) ring.position.set(chosen.x, chosen.y + 0.24, chosen.z);
  }
  const n = C.spaces[s?.goal] || C.spaces[C.trophyStops[0]];
  w.goalTitle.visible = !complete;
  const pedestal = C.trophyPedestals[n.id];
  w.goalTitle.position.set(pedestal.x, n.y + 3, pedestal.z);
  w.goal.position.set(pedestal.x, n.y + 0.3, pedestal.z);
  w.goal.rotation.y = t * 0.8;
  w.trophyHost.position.set(pedestal.x, n.y + 0.3, pedestal.z);
  w.trophyHost.rotation.y = 0.4;
  w.goal.position.x += 0.7;
  w.goal.position.y += 0.7;
  animateCharacter(w.trophyHost, t, "fish", 0.6);
  w.hostWings.forEach(
    (wing, i) => (wing.rotation.z = (i ? 1 : -1) * Math.sin(t * 8) * 0.35),
  );
  if (s?.phase === "trophy-flight") {
    const flight = s.trophyFlight,
      age = t * 1000 - flight.at,
      q = clamp((age - 2200) / 4000),
      ease = q * q * (3 - 2 * q),
      from = C.trophyPedestals[flight.from],
      to = C.trophyPedestals[flight.to];
    const x = mix(from.x, to.x, ease),
      z = mix(from.z, to.z, ease),
      y = 0.95 + Math.sin(q * Math.PI) * 7;
    w.trophyHost.position.set(x, y, z);
    w.trophyHost.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
    w.goal.position.set(x + 0.65, y + 1, z);
    w.goalTitle.visible = false;
  }
  w.goalRing.position.set(n.x, n.y + 0.2, n.z);
  w.goalRing.scale.setScalar(1 + Math.sin(t * 2) * 0.06);
  w.diceData = s?.phase === "rolling" ? s.dice : null;
  w.dice.forEach((d, i) => {
    d.visible = !!w.diceData && i < w.diceData.values.length;
  });
  if (w.shopkeepers)
    w.shopkeepers.forEach((m, i) =>
      animateCharacter(
        m,
        t + i,
        s?.event?.kind === "shop" ? "win" : "idle",
        0.55,
      ),
    );
  const previewKey =
    s?.phase === "choice"
      ? JSON.stringify([s.routePreviews, extra.selectedRoute])
      : "";
  if (w.previewKey !== previewKey) {
    if (w.routePreview) {
      w.root.remove(w.routePreview);
      w.routePreview.traverse((o) => {
        if (o.isLine) {
          o.geometry.dispose();
          o.material.dispose();
        }
        if (o.isSprite) {
          o.material.map?.dispose();
          o.material.dispose();
        }
      });
    }
    w.routePreview = new T.Group();
    w.root.add(w.routePreview);
    w.previewKey = previewKey;
    if (s?.phase === "choice")
      for (const route of s.routePreviews || []) {
        const color = route.option ? "#e89750" : "#8765cd",
          selected =
            extra.selectedRoute == null || extra.selectedRoute === route.next;
        for (const path of route.paths) {
          const geometry = new T.BufferGeometry().setFromPoints(
            path.map((id) => {
              const n = C.spaces[id];
              return new T.Vector3(n.x, n.y + 0.33, n.z);
            }),
          );
          const line = new T.Line(
            geometry,
            new T.LineBasicMaterial({
              color,
              transparent: true,
              opacity: selected ? 1 : 0.35,
            }),
          );
          w.routePreview.add(line);
        }
        for (const id of route.landings) {
          const n = C.spaces[id],
            ring = torus(
              w.routePreview,
              n.x,
              n.y + 0.32,
              n.z,
              1.2,
              selected ? 0.1 : 0.05,
              color,
            );
          ring.rotation.x = Math.PI / 2;
          const sign = label(
            (route.option ? "B" : "A") + " · " + C.spaceInfo[n.type].name,
            "#fff",
            color,
            0.42,
          );
          sign.position.set(n.x, n.y + 1.35, n.z);
          w.routePreview.add(sign);
        }
      }
  }
  let target = new T.Vector3(0, 0, 0),
    extent = 39;
  if (s?.phase === "trophy-flight") {
    target.copy(w.trophyHost.position);
    extent = 22;
  }
  if (complete) {
    target.set(0, 1.6, 3.4);
    extent = 14;
  }
  if (s?.phase === "choice") {
    const points = [
      C.spaces[s.players[s.turn].position],
      ...(s.routePreviews || []).flatMap((r) =>
        r.paths.flat().map((id) => C.spaces[id]),
      ),
    ];
    const xs = points.map((p) => p.x),
      zs = points.map((p) => p.z);
    target.set(
      (Math.min(...xs) + Math.max(...xs)) / 2,
      1,
      (Math.min(...zs) + Math.max(...zs)) / 2,
    );
    extent = Math.max(
      18,
      Math.max(...xs) - Math.min(...xs) + 9,
      Math.max(...zs) - Math.min(...zs) + 9,
    );
  }
  if (
    s &&
    !extra.overview &&
    ["board", "rolling", "walking", "space", "ferry"].includes(s.phase)
  ) {
    const a = w.actors[s.turn];
    if (a) {
      target.copy(a.position);
      target.y += 0.8;
      extent = 12.8;
    }
  }
  const smooth =
    extra.motion === false
      ? 1
      : 1 - Math.exp(-Math.min(0.1, t - (w.lastCameraTime || t - 0.03)) * 5);
  w.lastCameraTime = t;
  w.center.lerp(target, smooth);
  w.size = mix(w.size, extent, smooth);
  return { target: w.center, extent: w.size, position: [27, 33, 35] };
}

function ceremonyWorld() {
  const w = world("ceremony");
  if (w.built) return w;
  w.built = true;
  water(w);
  box(w.root, 0, 0.1, 0, 27, 1, 15, "#b88e79");
  for (let x = -13; x < 14; x += 0.55)
    box(w.root, x, 0.63, 0, 0.025, 0.03, 14.5, "#806875");
  box(w.root, 0, 0.8, -5, 24, 0.4, 4, "#7e628f");
  for (const x of [-12, 12]) {
    tube(w.root, [x, 0.6, -5], [x, 9, -5], 0.17, "#e4ba73");
    palm(w, x * 1.2, -8, 1.3);
  }
  tube(w.root, [-12, 9, -5], [12, 9, -5], 0.15, "#e4ba73");
  for (let i = 0; i < 13; i++)
    ball(
      w.root,
      -11 + i * 1.8,
      8.6,
      -5,
      0.17,
      0.23,
      0.17,
      ["#e6acd2", "#a8dece", "#ffe8a1"][i % 3],
    );
  const title = label("CORAL CARNIVAL", "#fff0c8", "#7f548f", 0.9);
  title.position.set(0, 7, -5);
  w.root.add(title);
  w.award = trophy(w.root, 0, 5, 0, 0.8);
  w.dice = boardWorld().dice.map((d) => {
    const clone = d.clone();
    w.root.add(clone);
    return clone;
  });
  return w;
}
function updateCeremony(w, s, t) {
  roster(w, s);
  const opening = s.phase.startsWith("order-"),
    age = t * 1000 - (s.finale?.at || 0),
    index = Math.floor((age - 2500) / 6500),
    award = s.finale?.awards[index];
  w.actors.forEach((a, i) => {
    const p = s.players[i],
      winner = s.phase === "complete" && p.id === s.winner,
      received = !opening && award?.applied && award.winners.includes(p.id),
      reveal = !opening && award?.applied;
    const targetX = (i - (s.players.length - 1) / 2) * 4.5,
      targetZ = winner ? 2.2 : 0;
    if (!a.userData.stagePlaced) {
      a.position.set(targetX, 0.64, 0);
      a.userData.stagePlaced = true;
    }
    a.position.x = mix(a.position.x, targetX, 0.12);
    a.position.z = mix(a.position.z, targetZ, 0.08);
    a.position.y = 0.64;
    a.scale.setScalar(1.1);
    a.rotation.y = 0.05;
    a.userData.nameLabel.visible = true;
    animateCharacter(
      a,
      t,
      winner || received
        ? "win"
        : s.phase === "complete" || (reveal && !received)
          ? "sad"
          : !opening && age > 2500
            ? "fish"
            : "idle",
      0.85,
    );
  });
  w.award.visible = !opening && s.phase !== "complete" && !!award;
  if (award) {
    const cycle = age - 2500 - index * 6500,
      q = clamp((cycle - 2500) / 1400),
      first = s.players.findIndex((p) => award.winners.includes(p.id)),
      x = (Math.max(0, first) - (s.players.length - 1) / 2) * 4.5;
    w.award.position.set(
      mix(0, x, q),
      mix(5, 3.5, q) + Math.sin(q * Math.PI),
      0,
    );
    w.award.rotation.y = t;
  }
  w.diceData = opening && s.dice && t * 1000 - s.dice.at < 2600 ? s.dice : null;
  w.dice.forEach((d, i) => (d.visible = !!w.diceData && i === 0));
  return { target: new T.Vector3(0, 2, 0), extent: 21, position: [0, 12, 29] };
}
function climbWorld() {
  const w = world("climb");
  if (w.built) return w;
  w.built = true;
  w.scene.background = new T.Color("#b9dce8");
  w.scene.fog = new T.Fog("#bfdfe5", 45, 85);
  box(w.root, 0, -0.7, -3, 90, 1.4, 65, "#dcad95");
  box(w.root, 0, 0.03, 7, 70, 0.06, 6, "#677789");
  for (let i = 0; i < 24; i++)
    box(w.root, -35 + i * 3, 0.08, 7, 1.5, 0.04, 0.14, "#fff2d0");
  for (let i = 0; i < 12; i++) {
    cyl(w.root, -26 + i * 4.7, 1.7, 4, 0.07, 0.08, 3.4, "#5e6376");
    ball(w.root, -26 + i * 4.7, 3.5, 4, 0.25, 0.25, 0.25, "#ffe6a7");
  }
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
  box(w.root, 0, -0.2, -9, 38, 1, 12, "#ead1a1");
  box(w.root, 0, 0.34, -9, 38, 0.08, 12, "#8ab995");
  box(w.root, 0, -0.1, -4, 27, 0.8, 4, "#c7996a");
  for (let i = 0; i < 44; i++)
    box(w.root, -13 + i * 0.6, 0.33, -4, 0.04, 0.04, 4, "#b0845d");
  w.rods = [];
  w.bobbers = [];
  w.fishes = [];
  w.ripples = [];
  w.rulers = [];
  w.measureMarkers = [];
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * 5.2;
    box(w.root, x, 0.15, 0, 3.8, 0.35, 6, "#d4ab76");
    for (let j = 0; j < 12; j++)
      box(w.root, x, 0.35, -2.7 + j * 0.48, 3.8, 0.025, 0.045, "#ac805c");
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
    const bob = ball(
      w.root,
      x + 0.3,
      -0.5,
      4.8,
      0.11,
      0.19,
      0.11,
      ["#60bddf", "#e783ad", "#76c794", "#eec059"][i],
    );
    w.bobbers.push(bob);
    const rings = Array.from({ length: 3 }, () => {
      const ring = torus(w.root, x + 0.3, -0.56, 4.8, 0.8, 0.025, "#fff2cd");
      ring.rotation.x = -Math.PI / 2;
      return ring;
    });
    w.ripples.push(rings);
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
    const ruler = new T.Group();
    ruler.position.set(x, 0.39, 1.9);
    w.root.add(ruler);
    box(ruler, 0, 0, 0, 3.2, 0.06, 0.65, "#fff1cb");
    for (let n = 0; n <= 12; n++)
      box(
        ruler,
        -1.4 + (n * 2.8) / 12,
        0.04,
        0.19,
        0.025,
        0.025,
        n % 3 === 0 ? 0.27 : 0.14,
        "#755b53",
      );
    const zero = label(
      "0             60            120 cm",
      "#644e53",
      "#fff1cb",
      0.21,
    );
    zero.position.set(0, 0.06, 0.72);
    ruler.add(zero);
    const marker = box(ruler, -1.4, 0.09, 0, 0.04, 0.06, 0.7, "#bc668d");
    ruler.visible = false;
    w.rulers.push(ruler);
    w.measureMarkers.push(marker);
    const owner = label(
      ["BLUE", "PINK", "MINT", "GOLD"][i],
      "#33465a",
      ["#a9e4f3", "#f8c3d9", "#b1e9c8", "#ffe39b"][i],
      0.29,
    );
    owner.position.set(x, 0.5, -1.3);
    w.root.add(owner);
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
      (age < 1.8 && v?.catch?.score) || t * 1000 - (v?.reelAt || 0) < 650
        ? "fish"
        : "idle",
    );
    const reelAge = Math.min(age, (t * 1000 - (v?.reelAt || 0)) / 1000);
    w.rods[i].rotation.x =
      reelAge < 1.8
        ? -0.65 * Math.sin(Math.PI * clamp(reelAge / 1.8))
        : Math.sin(t * 1.4 + i) * 0.02;
    const cue = s?.game?.cues?.[i] || (!s ? { at: 3000, window: 1100 } : null),
      dt = t * 1000 - (s?.game?.start || 0) - (cue?.at || 0),
      splash = cue && dt >= 0 && dt < cue.window;
    w.ripples[i].forEach((ring, j) => {
      const phase = (t * 1.3 + j / 3) % 1;
      ring.visible = !!cue && dt > -2200 && dt < cue.window;
      ring.scale.setScalar(
        (cue?.size || 0.7 + i * 0.18) *
          ((splash ? 1.2 : 0.5) + phase * (splash ? 1.4 : 0.6)),
      );
      ring.material = mat("#c9f0ee");
    });
    w.bobbers[i].position.y = -0.5 + Math.sin(t * 3 + i) * 0.07;
    const f = w.fishes[i];
    w.bobbers[i].visible = !v?.catch;
    w.rods[i].visible = !v?.catch || age < 1.8;
    f.visible = !!v?.catch?.score && age >= 0;
    if (f.visible) {
      const q = clamp(age / 1.6),
        ease = q * q * (3 - 2 * q),
        size = ((v.catch.length || v.catch.score) / 120) * 2.8;
      f.scale.setScalar(size);
      f.position.set(
        mix(a.position.x + 0.3, a.position.x - 1.4 + size * 0.55, ease),
        mix(-0.4, 0.48 + size * 0.19, ease) + Math.sin(q * Math.PI) * 2.8,
        mix(4.8, 1.8, ease),
      );
      f.rotation.z =
        q < 1
          ? Math.sin(q * Math.PI) * -0.4
          : Math.sin(t * 18) * 0.08 * Math.exp(-Math.max(0, age - 1.6) * 1.3);
      f.rotation.y = q < 1 ? Math.sin(q * Math.PI) * 0.25 : 0;
    }
    const measure =
      s?.phase === "measuring" ||
      ["round-end", "side-result"].includes(s?.phase);
    w.rulers[i].visible = measure && !!v?.catch;
    if (measure)
      w.measureMarkers[i].position.x =
        -1.4 +
        ((v?.catch?.length || 0) / 120) *
          2.8 *
          clamp((t * 1000 - (s.game.measureAt || 0) - 500) / 4000);
  });
  return {
    target: new T.Vector3(0, 0.4, 0),
    extent: s?.phase === "measuring" ? 26 : 18,
    position: s?.phase === "measuring" ? [0, 26, 22] : [13, 17, 29],
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
  box(w.root, 0, -0.25, 0, 34, 1.3, 34, "#eac898");
  box(w.root, 0, 0.41, 0, 33.7, 0.08, 33.7, "#b3cc91");
  const shape = new T.Shape();
  h.floor.forEach(([x, z], i) => {
    const a = conv([x, z]);
    i ? shape.lineTo(a[0], -a[1]) : shape.moveTo(a[0], -a[1]);
  });
  const green = new T.Mesh(new T.ShapeGeometry(shape), mat("#80bd94"));
  green.rotation.x = -Math.PI / 2;
  green.position.y = 0.52;
  green.receiveShadow = true;
  w.root.add(green);
  for (const water of h.water || []) {
    const [x, z] = conv([water.x + water.w / 2, water.y + water.h / 2]);
    box(w.root, x, 0.535, z, water.w / 25, 0.025, water.h / 25, "#72bfc8");
    for (let j = 0; j < 5; j++)
      box(
        w.root,
        x,
        0.55,
        z - water.h / 65 + (j * water.h) / 125,
        water.w / 30,
        0.012,
        0.025,
        "#b7e1db",
      );
  }
  for (const hill of h.terrain || []) {
    const [x, z] = conv([hill.x, hill.y]);
    const geo = new T.PlaneGeometry(
        (hill.rx * 2) / 25,
        (hill.ry * 2) / 25,
        18,
        18,
      ),
      pos = geo.attributes.position;
    for (let j = 0; j < pos.count; j++) {
      const px = pos.getX(j) * 25 + hill.x,
        py = -pos.getY(j) * 25 + hill.y;
      pos.setZ(
        j,
        Math.max(
          -0.035,
          globalThis.PuttPhysics.terrainAt(h, px, py).height / 25,
        ),
      );
    }
    geo.computeVertexNormals();
    const m = new T.Mesh(geo, mat(hill.height > 0 ? "#8fc49b" : "#72ab86"));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.54, z);
    w.root.add(m);
  }
  for (const ramp of h.ramps || []) {
    const p = new T.Group(),
      [x, z] = conv([ramp.x, ramp.y]);
    p.position.set(x, 0.55, z);
    p.rotation.y = -ramp.angle;
    w.root.add(p);
    const surface = box(
      p,
      -ramp.length / 50,
      ramp.height / 50,
      0,
      ramp.length / 25,
      0.08,
      ramp.width / 25,
      "#d6ae74",
    );
    surface.rotation.z = Math.atan2(ramp.height, ramp.length);
    for (let j = 0; j < 4; j++)
      box(
        p,
        -0.6 - j * 0.7,
        0.12 + j * 0.01,
        0,
        0.12,
        0.02,
        ramp.width / 28,
        "#f9e4ad",
      );
  }
  if (h.gate) {
    const [x, z] = conv([h.gate.x, h.gate.y]);
    w.gate = box(
      w.root,
      x,
      0.85,
      z,
      (h.gate.length * 2) / 25,
      0.3,
      0.35,
      "#dd9cae",
    );
    cyl(w.root, x, 0.8, z, 0.22, 0.3, 0.8, "#f8d18b");
  }
  for (const belt of h.conveyors || []) {
    const [x, z] = conv([belt.x + belt.w / 2, belt.y + belt.h / 2]);
    box(w.root, x, 0.56, z, belt.w / 25, 0.05, belt.h / 25, "#9d93b1");
    for (let j = 0; j < 10; j++) {
      const m = box(
        w.root,
        x - belt.w / 50 + (j * belt.w) / 250,
        0.61,
        z,
        0.045,
        0.025,
        belt.h / 25,
        "#ded2c5",
      );
      const start = m.position.x;
      w.animated.push((t) => (m.position.x = start + (t % 1) * 0.3));
    }
  }
  if (h.portal) {
    const [x, z] = conv(h.portal.mouth),
      [ex, ez] = conv(h.portal.exit);
    ball(w.root, x, 0.9, z - 0.65, 1.3, 0.9, 1.5, "#b4abc9");
    ball(w.root, x, 0.83, z + 0.5, 1.05, 0.5, 0.75, "#c9bed7");
    ball(w.root, x, 0.65, z + 0.95, 0.7, 0.3, 0.12, "#5c536e");
    for (const dx of [-0.55, 0.55]) {
      ball(w.root, x + dx, 1.65, z - 0.4, 0.26, 0.27, 0.26, "#d7c8de");
      ball(w.root, x + dx, 1.7, z - 0.18, 0.08, 0.1, 0.05, "#3e435d");
    }
    cyl(w.root, ex, 0.58, ez, 0.65, 0.65, 0.1, "#706387");
    for (let j = 1; j <= 12; j++) {
      const p = globalThis.PuttPhysics.portalPoint(h, j / 12),
        [px, pz] = conv(p);
      cyl(w.root, px, 0.6, pz, 0.42, 0.42, 0.1, "#a39abb", 16);
    }
  }
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
  const i = s?.game?.putt?.turn ?? 0,
    v = s?.game?.progress[i],
    shot = v?.shot,
    h = C.holes[Number(w.name.slice(4))];
  let position = v?.ball || h.tee,
    elevation = 0,
    rolling = false;
  if (w.gate) w.gate.rotation.y = -t * h.gate.speed;
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
      elevation = mix(a[4] || 0, b[4] || 0, q) / 25;
      w.ball.scale.setScalar(0.22 * mix(a[3], b[3], q));
    }
  }
  const [x, z] = w.conv(position);
  w.ball.position.set(
    x,
    0.76 +
      elevation +
      Math.max(
        globalThis.PuttPhysics.terrainAt(h, ...position).height / 25,
        globalThis.PuttPhysics.rampHeight(h, ...position) / 25,
      ),
    z,
  );
  if (!rolling) w.ball.scale.setScalar(0.22);
  const aim = extra.aim || { angle: -1.2, power: 0.5 },
    tee = w.conv(v?.ball || h.tee);
  w.aimDots.forEach((p, j) => {
    p.visible = !rolling && !v?.finished && (!s || s.players[i].id === s.you);
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
    animateCharacter(
      a,
      t,
      (shot && t * 1000 - shot.at < 700) || t * 1000 - (v?.swingAt || 0) < 700
        ? "fish"
        : v?.finished
          ? "win"
          : "idle",
      0.6,
    );
    if (!a.userData.club) {
      const club = new T.Group();
      tube(club, [0.5, 0.8, 0.3], [0.8, 0.15, 0.85], 0.025, "#62727d");
      box(club, 0.83, 0.13, 0.9, 0.45, 0.12, 0.2, "#d2d4c9");
      a.add(club);
      a.userData.club = club;
    }
    a.userData.club.rotation.x =
      shot && t * 1000 - shot.at < 700
        ? -Math.sin(((t * 1000 - shot.at) / 700) * Math.PI)
        : 0;
  });
  return { target: new T.Vector3(0, 0, 0), extent: 31, position: [0, 36, 22] };
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
  const lift =
    canvas.id === "party-scene" && document.body.dataset.phase === "playing"
      ? 0.1
      : 0;
  cam.top = extent * (0.5 - lift);
  cam.bottom = -extent * (0.5 + lift);
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
  if (w.diceData) {
    const dice = w.diceData,
      age = clamp((t * 1000 - dice.at) / 1450),
      ease = 1 - (1 - age) ** 3,
      forward = new T.Vector3(0, 0, -1).applyQuaternion(cam.quaternion),
      right = new T.Vector3(1, 0, 0).applyQuaternion(cam.quaternion),
      up = new T.Vector3(0, 1, 0).applyQuaternion(cam.quaternion),
      center = cam.position.clone().addScaledVector(forward, 24);
    w.dice.forEach((d, i) => {
      if (!d.visible) return;
      const angles = {
          1: [0, -Math.PI / 2, 0],
          2: [Math.PI / 2, 0, 0],
          3: [0, 0, 0],
          4: [0, Math.PI, 0],
          5: [-Math.PI / 2, 0, 0],
          6: [0, Math.PI / 2, 0],
        },
        a = angles[dice.values[i]];
      d.position
        .copy(center)
        .addScaledVector(right, (i - (dice.values.length - 1) / 2) * 2.3)
        .addScaledVector(up, Math.sin(age * Math.PI * 3) * (1 - age) * 1.8);
      const q = new T.Quaternion().setFromEuler(
        new T.Euler(
          a[0] + TAU * 3 * (1 - ease),
          a[1] + TAU * 2 * (1 - ease),
          a[2] + TAU * (1 - ease),
        ),
      );
      d.quaternion.copy(cam.quaternion).multiply(q);
      d.scale.setScalar(1.15);
    });
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
function overlay(c, canvas, kind, s, t, extra) {
  const W = canvas.width,
    H = canvas.height,
    d = W / (canvas.clientWidth || W);
  c.save();
  c.scale(d, d);
  const w = W / d,
    h = H / d,
    v = s?.game?.progress[s.players.findIndex((p) => p.id === s.you)];
  if (s?.phase === "playing" && s.game?.survival) {
    const alive = s.game.active.filter(
      (i) => !s.game.progress[i].eliminatedAt,
    ).length;
    text(
      c,
      v?.eliminatedAt ? "OUT · Cheer on the survivors" : alive + " STILL IN",
      w / 2,
      88,
      13,
      "#343d60",
    );
  }
  if (
    s?.phase === "playing" &&
    [
      "simon",
      "spotlight",
      "bakery",
      "fuse",
      "confetti",
      "rhythm",
      "rope",
    ].includes(kind)
  ) {
    const b = s.game.cue,
      dt = t * 1000 - s.game.start - (b?.at || 0);
    let title = "";
    if (kind === "simon" && b)
      title =
        (b.fake ? "CAPTAIN: " : "CAPTAIN SAYS: ") + b.action.toUpperCase();
    if (kind === "spotlight")
      title = {
        green: "GREEN · TAP RUN",
        amber: "AMBER · FREEZE NOW",
        red: "RED · STAY FROZEN",
      }[R.spotlight(s.game, t * 1000).color];
    if (kind === "bakery")
      title = v?.recipe
        ? v.recipe.map((n) => ["BLUE", "PINK", "MINT", "GOLD"][n]).join(" → ")
        : "REMEMBER YOUR RECIPE";
    if (kind === "fuse")
      title =
        "TARGET " +
        (v?.recipe || []).map((n) => ["↑", "→", "↓", "←"][n]).join("  ");
    if (kind === "confetti" && b)
      title =
        ["BLUE", "PINK", "MINT"][b.color % 3] +
        (dt >= -180 ? " · READY!" : " · CHARGING…");
    if (kind === "rhythm" && b)
      title =
        b.color === 3 ? "BOTH DRUMS" : b.color % 2 ? "RIGHT DRUM" : "LEFT DRUM";
    if (kind === "rope" && b)
      title = b.high ? "HIGH ROPE · DUCK" : "LOW ROPE · JUMP";
    const width = Math.min(w - 24, 350),
      top = s.game.survival ? 98 : 70;
    c.fillStyle = "#614978e8";
    c.beginPath();
    c.roundRect((w - width) / 2, top, width, 36, 12);
    c.fill();
    text(c, title, w / 2, top + 24, w < 420 ? 12 : 16, "#fff5d5");
  }
  if (kind === "memory" && v?.reverse) {
    c.fillStyle = "#542f76e0";
    c.beginPath();
    c.roundRect(w / 2 - 86, h - 34, 172, 25, 12);
    c.fill();
    text(c, "↶ REVERSE THE PATTERN", w / 2, h - 17, 10);
  }
  if (kind === "climb" && v?.combo >= 2) {
    text(c, "×" + v.combo + " COMBO", w / 2, 90, 13, "#243e58");
  }
  if (kind === "putt") {
    const course = Math.min(2, s?.game?.putt?.course || 0);
    text(c, "COURSE " + (course + 1) + " / 3", w / 2, 90, 11, "#24465c");
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
      s.dice.total + (s.dice.total === 1 ? " SPACE" : " SPACES"),
      w / 2,
      h - 27,
      12,
    );
  }
  if (kind === "board" && s) {
    const scene = worlds.get(
      ["order-roll", "order-reveal", "finale", "complete"].includes(s.phase)
        ? "ceremony"
        : "board",
    );
    if (scene?.camera)
      for (const [i, p] of s.players.entries()) {
        const a = scene.actors[i];
        if (!a) continue;
        const pos = a.position.clone();
        pos.y += 3;
        pos.project(scene.camera);
        const x = (pos.x * 0.5 + 0.5) * w,
          y = (-pos.y * 0.5 + 0.5) * h;
        const popup = p.boardPopup,
          age = popup ? t * 1000 - popup.at : 9999;
        if (
          age >= 0 &&
          age < 2100 &&
          !["finale", "complete"].includes(s.phase)
        ) {
          c.globalAlpha = clamp(1 - age / 2100);
          c.strokeStyle = "#fff8df";
          c.lineWidth = 4;
          c.font = "900 20px system-ui";
          c.textAlign = "center";
          const value = (popup.value > 0 ? "+" : "") + popup.value + " coins";
          c.strokeText(value, x, y - age / 75);
          text(
            c,
            value,
            x,
            y - age / 75,
            20,
            popup.value > 0 ? "#397b5c" : "#b34e64",
          );
          c.globalAlpha = 1;
        }
        if (["finale", "complete"].includes(s.phase)) {
          const cardWidth = Math.min(94, w / s.players.length - 10),
            cx = clamp(x, cardWidth / 2 + 4, w - cardWidth / 2 - 4);
          c.fillStyle = "#fff3d9ed";
          c.beginPath();
          c.roundRect(cx - cardWidth / 2, y - 35, cardWidth, 35, 8);
          c.fill();
          text(
            c,
            p.trophies + " trophies",
            cx,
            y - 21,
            w < 500 ? 10 : 12,
            "#6a4c7e",
          );
          text(c, p.tokens + " coins", cx, y - 7, w < 500 ? 10 : 12, "#6a4c7e");
          if (s.phase === "complete")
            text(
              c,
              "#" + C.standings(s.players, s.mode)[p.id],
              cx,
              y - 43,
              19,
              "#6d4f87",
            );
        }
      }
  }
  if (s?.phase === "finale") {
    const age = t * 1000 - s.finale.at,
      index = Math.floor((age - 2500) / 6500),
      award = s.finale.awards[index],
      width = Math.min(w - 28, 430);
    c.fillStyle = "#fff2d8ed";
    c.beginPath();
    c.roundRect((w - width) / 2, 70, width, 75, 16);
    c.fill();
    const title =
      age < 2500
        ? "THE BONUS TROPHIES"
        : age >= 22000
          ? "AND THE WINNER IS…"
          : award?.title.toUpperCase() || "THE GRAND FINALE";
    text(c, title, w / 2, 94, w < 500 ? 14 : 18, "#6d4b84");
    let detail =
      age < 2500
        ? "Who made their mark on the festival?"
        : age >= 22000
          ? String(Math.max(1, Math.ceil((30000 - age) / 1000)))
          : award?.applied
            ? award.winners.length
              ? award.winners
                  .map((id) => s.players.find((p) => p.id === id).name)
                  .join(" + ")
              : "No award this time"
            : award?.description || "One last celebration";
    if (detail.length > 44) detail = detail.slice(0, 41) + "…";
    text(
      c,
      detail,
      w / 2,
      123,
      age >= 22000 ? 26 : w < 500 ? 11 : 14,
      "#5a4867",
    );
  }
  if (s?.phase === "selection") {
    const q = clamp((t * 1000 - s.selectionAt) / 4600),
      position = 28 * (1 - (1 - q) ** 3),
      center = Math.floor(position),
      offset = position - center,
      ww = Math.min(w - 32, 360),
      top = h * 0.25;
    c.fillStyle = "#fff2d8f5";
    c.beginPath();
    c.roundRect((w - ww) / 2, top - 30, ww, 205, 20);
    c.fill();
    text(c, "NEXT MINIGAME", w / 2, top - 8, 12, "#6b4d82");
    c.save();
    c.beginPath();
    c.rect((w - ww) / 2 + 5, top, ww - 10, 150);
    c.clip();
    for (let j = center - 2; j <= center + 3; j++) {
      if (j < 0 || j >= s.selection.length) continue;
      const y = top + 75 + (j - position) * 43,
        def = C.games.find((g) => g.id === s.selection[j]);
      c.globalAlpha = clamp(1 - Math.abs(y - top - 75) / 95, 0.12, 1);
      text(c, def?.name || "", w / 2, y + 6, w < 440 ? 15 : 18, "#684986");
    }
    c.restore();
    c.globalAlpha = 1;
    c.strokeStyle = "#d5a348";
    c.lineWidth = 3;
    c.beginPath();
    c.roundRect((w - ww) / 2 + 12, top + 53, ww - 24, 43, 10);
    c.stroke();
  }
  if (
    (s?.phase === "complete" ||
      s?.phase === "trophy-flight" ||
      (s?.phase === "finale" && s.finale.awards.some((a) => a.applied))) &&
    extra.motion !== false
  ) {
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
function fallback(canvas, kind, s, extra = {}) {
  const c = canvas.getContext("2d"),
    W = canvas.width,
    H = canvas.height;
  c.fillStyle = "#a5dcd5";
  c.fillRect(0, 0, W, H);
  if (kind === "board") {
    const xy = (n) => [W / 2 + (n.x * W) / 46, H / 2 + (n.z * H) / 36];
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
      if (n.id === extra.selectedSpace) {
        c.strokeStyle = "#ffffff";
        c.lineWidth = 4;
        c.stroke();
      }
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
  if (kind !== "board" && state?.game) {
    if (["intro", "countdown"].includes(state.phase))
      time = state.game.start / 1000;
    const input = extra.localInput;
    if (
      state.phase === "playing" &&
      input &&
      !input.rejected &&
      input.game === state.game.id &&
      input.start === state.game.start &&
      time * 1000 - input.at >= 0 &&
      time * 1000 - input.at < 900
    ) {
      const i = state.players.findIndex((p) => p.id === state.you),
        progress = [...state.game.progress];
      if (input.pending) progress[i] = { ...progress[i], ...input.fields };
      let shared = state.game.shared;
      if (
        input.game === "bomb" &&
        input.pending &&
        shared.holder === i &&
        !shared.respawnAt &&
        ["left", "right"].includes(input.value)
      ) {
        const active = state.game.active.filter(
            (j) => !state.game.progress[j].eliminatedAt,
          ),
          slot = active.indexOf(i);
        shared = {
          ...shared,
          from: i,
          holder:
            active[
              (slot + (input.value === "left" ? -1 : 1) + active.length) %
                active.length
            ],
          passedAt: input.at,
          flight: {
            from: i,
            to: active[
              (slot + (input.value === "left" ? -1 : 1) + active.length) %
                active.length
            ],
            at: input.at,
            duration: R.bombFlight,
          },
        };
      }
      state = { ...state, game: { ...state.game, progress, shared } };
    }
  }
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
    extra.selectedSpace,
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
    fallback(canvas, kind, state, extra);
    overlay(canvas.getContext("2d"), canvas, kind, state, time, extra);
    return;
  }
  let w, view;
  if (kind === "board") {
    if (
      state &&
      ["order-roll", "order-reveal", "finale", "complete"].includes(state.phase)
    ) {
      w = ceremonyWorld();
      view = updateCeremony(w, state, time);
    } else {
      w = boardWorld();
      view = updateBoard(w, state, time, extra);
    }
  } else if (kind === "climb") {
    w = climbWorld();
    view = updateClimb(w, state, time);
  } else if (kind === "fish") {
    w = fishWorld();
    view = updateFish(w, state, time);
  } else if (kind === "memory") {
    w = memoryWorld();
    view = updateMemory(w, state, time, extra);
  } else if (["cascade", "lantern", "hop", "dash", "signal"].includes(kind)) {
    w = extras.build(kind);
    view = extras.update(w, state, time, extra);
  } else if (
    C.games.find((g) => g.id === kind)?.engine === "midway" ||
    kind === "draft"
  ) {
    w = midway.build(kind);
    view = midway.update(w, state, time, extra);
  } else if (C.games.find((g) => g.id === kind)?.engine === "expansion") {
    w = expansion.build(kind);
    view = expansion.update(w, state, time, extra);
  } else if (C.games.find((g) => g.id === kind)?.engine === "festival") {
    w = festival.build(kind);
    view = festival.update(w, state, time, extra);
  } else {
    const index = Math.min(2, state?.game?.putt?.course || 0);
    w = puttWorld(index || 0);
    view = updatePutt(w, state, time, extra);
  }
  if (kind !== "board" && state?.game)
    for (const a of w.actors) {
      const i = state.players.findIndex((p) => p.id === a.userData.playerId),
        v = state.game.progress[i];
      a.visible =
        (kind !== "putt" || i === state.game.putt?.turn) &&
        state.game.participants.includes(a.userData.playerId) &&
        !(v?.eliminatedAt && time * 1000 - v.eliminatedAt >= 1100);
    }
  if (state)
    for (const a of w.actors) {
      a.userData.resultMode = ["round-end", "side-result"].includes(state.phase)
        ? state.game.winners?.includes(a.userData.playerId)
          ? "win"
          : "sad"
        : null;
    }
  if (
    state &&
    width / height < 1 &&
    !(kind === "fish" && state.phase === "measuring") &&
    [
      "cascade",
      "dash",
      "hop",
      "fish",
      "kart",
      "orchard",
      "maze",
      "stack",
      "balloon",
      "boats",
      "spotlight",
      "bakery",
      "fuse",
      "ricochet",
      "volley",
    ].includes(kind)
  ) {
    const actor = w.actors.find((a) => a.userData.playerId === state.you);
    if (actor && actor.visible) {
      view.target = actor.position.clone();
      view.target.y = 1;
      view.target.z -= 3;
      view.extent = kind === "fish" ? 16 : 19;
      view.position = [3, 27, 35];
      if (
        ["maze", "stack", "balloon", "bakery", "fuse", "ricochet"].includes(
          kind,
        )
      ) {
        const slot = state.game.active.indexOf(
            state.players.findIndex((p) => p.id === state.you),
          ),
          station = w.stations?.[slot];
        if (station) {
          view.target = station.root.position.clone();
          view.target.y =
            kind === "stack"
              ? 2 +
                (state.game.progress[
                  state.players.findIndex((p) => p.id === state.you)
                ].step || 0) *
                  0.18
              : 1.5;
          view.extent =
            kind === "stack"
              ? Math.max(
                  12,
                  8 +
                    (state.game.progress[
                      state.players.findIndex((p) => p.id === state.you)
                    ].step || 0) *
                      0.4,
                )
              : kind === "ricochet"
                ? 15
                : 12;
          view.position = kind === "maze" ? [0, 25, 16] : [4, 25, 28];
        }
      }
    }
  } else if (kind !== "board" && width / height < 1) {
    const span =
      C.games.find((g) => g.id === kind)?.engine === "midway" ? 30 : 22;
    view.extent = Math.max(view.extent, span / (width / height));
  }
  if (
    C.games.find((g) => g.id === kind)?.engine === "expansion" &&
    state?.game &&
    width / height < 1 &&
    !["band", "bumper", "volcano", "math"].includes(kind)
  ) {
    const own = state.players.findIndex((p) => p.id === state.you),
      slot = state.game.active.indexOf(own),
      actor = w.actors[own];
    if (actor) {
      view.target.set(actor.position.x, 1, -2);
      view.extent = 18;
      view.position = [0, 18, 32];
    }
  }
  if (kind === "spotlight" && state?.game && width / height < 1) {
    const own = state.players.findIndex((p) => p.id === state.you),
      slot = state.game.active.indexOf(own),
      station = w.stations[slot];
    if (station) {
      view.target.set(station.root.position.x, 1, 0);
      view.extent = 22;
      view.position = [0, 27, 34];
    }
  }
  if (kind === "fish" && state?.phase === "measuring") {
    view.extent = Math.max(14, 22 / (width / height));
    view.target.set(0, 0.5, 1);
  }
  if (kind === "fencing" && state?.game) {
    view.extent = Math.max(12, 15 / (width / height));
    view.target.set(0, 1, 1);
    view.position = [3, 18, 25];
  }
  if (
    kind === "board" &&
    (extra.overview || !state || ["waiting", "board-end"].includes(state.phase))
  )
    view.extent = Math.max(view.extent, 54 / (width / height));
  w.motion = extra.motion !== false;
  const context = sceneFrame(w, time, view, canvas);
  overlay(context, canvas, kind, state, time, extra);
  if (
    C.games.find((g) => g.id === kind)?.engine === "midway" ||
    kind === "draft"
  ) {
    context.save();
    context.scale(
      canvas.width / canvas.clientWidth,
      canvas.height / canvas.clientHeight,
    );
    midway.overlay(context, canvas, w, state, time);
    context.restore();
  }
  if (C.games.find((g) => g.id === kind)?.engine === "expansion") {
    context.save();
    context.scale(
      canvas.width / canvas.clientWidth,
      canvas.height / canvas.clientHeight,
    );
    expansion.overlay(context, canvas, w, state, time);
    context.restore();
  }
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
const extras = carnivalScenes({
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
});
const festival = festivalScenes({
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
});
const midway = midwayScenes({
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
});
const expansion = expansionScenes({
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
});
function groundAt(canvas, x, y, kind) {
  const w = worlds.get(kind);
  if (!w?.built) return null;
  const r = canvas.getBoundingClientRect(),
    ray = new T.Raycaster();
  ray.setFromCamera(
    new T.Vector2(
      ((x - r.left) / r.width) * 2 - 1,
      1 - ((y - r.top) / r.height) * 2,
    ),
    w.camera,
  );
  return ray.ray.intersectPlane(
    new T.Plane(new T.Vector3(0, 1, 0), -0.6),
    new T.Vector3(),
  );
}
function spaceAt(canvas, x, y) {
  const w = worlds.get("board");
  if (!w?.built) {
    const r = canvas.getBoundingClientRect();
    let nearest = null,
      distance = Infinity;
    for (const n of C.spaces) {
      const d = Math.hypot(
        x - r.left - r.width / 2 - (n.x * r.width) / 46,
        y - r.top - r.height / 2 - (n.z * r.height) / 36,
      );
      if (d < Math.max(8, r.width / 70) && d < distance) {
        distance = d;
        nearest = n.id;
      }
    }
    return nearest;
  }
  const r = canvas.getBoundingClientRect(),
    ray = new T.Raycaster();
  ray.setFromCamera(
    new T.Vector2(
      ((x - r.left) / r.width) * 2 - 1,
      1 - ((y - r.top) / r.height) * 2,
    ),
    w.camera,
  );
  let closest = null,
    distance = Infinity;
  for (const n of C.spaces) {
    const point = ray.ray.intersectPlane(
      new T.Plane(new T.Vector3(0, 1, 0), -n.y - 0.22),
      new T.Vector3(),
    );
    if (!point) continue;
    const d = ray.ray.origin.distanceTo(point);
    if (Math.hypot(point.x - n.x, point.z - n.z) <= 1.15 && d < distance) {
      closest = n.id;
      distance = d;
    }
  }
  return closest;
}
globalThis.PartyScene = { render, portrait, spaceAt, groundAt };
