/* Tiny deterministic, local textures: no downloads and no per-frame allocations. */
export function surfaceMaterial(T, kind, color, repeats = 4) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const c = canvas.getContext("2d");
  c.fillStyle = color;
  c.fillRect(0, 0, 256, 256);
  let seed = 73;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < (kind === "water" ? 85 : 1900); i++) {
    const x = rand() * 256,
      y = rand() * 256;
    c.strokeStyle = c.fillStyle = i % 2 ? "#ffffff20" : "#243b3418";
    if (kind === "grass") {
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + rand() * 3 - 1, y - 2 - rand() * 4);
      c.stroke();
    } else if (kind === "water") {
      c.strokeStyle = "#efffff40";
      c.lineWidth = 0.7;
      c.beginPath();
      c.ellipse(x, y, 3 + rand() * 18, 1 + rand() * 3, 0, 0, Math.PI * 1.5);
      c.stroke();
    } else {
      c.fillRect(x, y, 0.5 + rand() * 1.4, 0.5 + rand() * 1.4);
    }
  }
  const texture = new T.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(repeats, repeats);
  texture.colorSpace = T.SRGBColorSpace;
  return new T.MeshStandardMaterial({
    map: texture,
    roughness: kind === "water" ? 0.3 : 0.9,
  });
}
export function island(T, parent, material, x, y, z, rx, rz, depth = 0.8) {
  const shape = new T.Shape();
  for (let i = 0; i <= 60; i++) {
    const a = (i / 60) * Math.PI * 2,
      r = 1 + 0.026 * Math.sin(a * 5) + 0.018 * Math.cos(a * 9),
      px = Math.cos(a) * rx * r,
      pz = Math.sin(a) * rz * r;
    i ? shape.lineTo(px, pz) : shape.moveTo(px, pz);
  }
  const m = new T.Mesh(
    new T.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelSize: 0.18,
      bevelThickness: 0.15,
      bevelSegments: 2,
      steps: 1,
    }),
    material,
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y - depth - 0.15, z);
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function ovalPatch(T, parent, material, x, y, z, rx, rz) {
  const shape = new T.Shape();
  shape.absellipse(0, 0, rx, rz, 0, Math.PI * 2, false, 0);
  const m = new T.Mesh(new T.ShapeGeometry(shape, 48), material);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
