import { mkdir, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';

const outDir = new URL('../assets/mountain-race/images/', import.meta.url);
await mkdir(outDir, { recursive: true });

const clamp = (v, lo = 0, hi = 255) => Math.max(lo, Math.min(hi, v));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);

function hash2(x, y, seed = 0) {
  let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967295;
}

function noise2(x, y, seed = 0) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const tx = smooth(x - x0), ty = smooth(y - y0);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  return mix(mix(a, b, tx), mix(c, d, tx), ty);
}

function fbm(x, y, seed = 0, octaves = 5) {
  let sum = 0, amp = 0.55, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i += 1) {
    sum += noise2(x * freq, y * freq, seed + i * 101) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.04;
  }
  return sum / norm;
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(width, height, draw) {
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * stride;
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a = 255] = draw(x, y, width, height);
      const i = row + 1 + x * 4;
      raw[i] = clamp(Math.round(r));
      raw[i + 1] = clamp(Math.round(g));
      raw[i + 2] = clamp(Math.round(b));
      raw[i + 3] = clamp(Math.round(a));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND')
  ]);
}

function skyPixel(x, y, w, h) {
  const nx = x / (w - 1), ny = y / (h - 1);
  const horizon = Math.pow(ny, 0.9);
  let r = mix(76, 178, horizon);
  let g = mix(137, 205, horizon);
  let b = mix(188, 226, horizon);

  const sunDx = nx - 0.20, sunDy = ny - 0.08;
  const sunGlow = Math.exp(-(sunDx * sunDx * 18 + sunDy * sunDy * 42));
  r += sunGlow * 48; g += sunGlow * 40; b += sunGlow * 22;

  const highCloud = clamp((fbm(nx * 5.8, ny * 11.0, 510, 5) - 0.61) * 5.2, 0, 1);
  const cloudBand = clamp(1 - Math.abs(ny - 0.36) * 3.0, 0, 1);
  const cloud = highCloud * cloudBand * 0.52;
  r = mix(r, 235, cloud); g = mix(g, 240, cloud); b = mix(b, 242, cloud);

  const farLine = 0.73 + Math.sin(nx * 9.7 + 0.6) * 0.035 + Math.sin(nx * 23.3) * 0.018 + (fbm(nx * 7, 1.3, 530, 4) - 0.5) * 0.07;
  if (ny > farLine) {
    const depth = clamp((ny - farLine) / 0.27, 0, 1);
    const detail = fbm(nx * 17, ny * 12, 531, 4);
    r = mix(83 + detail * 15, 49, depth);
    g = mix(109 + detail * 16, 72, depth);
    b = mix(119 + detail * 17, 84, depth);
  }

  const nearLine = 0.86 + Math.sin(nx * 14 + 1.9) * 0.022 + (fbm(nx * 11, 2.7, 540, 3) - 0.5) * 0.035;
  if (ny > nearLine) {
    const d = clamp((ny - nearLine) / 0.16, 0, 1);
    r = mix(r, 38, d * 0.72); g = mix(g, 57, d * 0.72); b = mix(b, 63, d * 0.72);
  }

  return [r, g, b, 255];
}

function cliffProfile(side, ny, seed) {
  const large = fbm(ny * 4.2, 0.73, seed, 5) - 0.5;
  const medium = fbm(ny * 12.5, 4.2, seed + 9, 4) - 0.5;
  const ledges = Math.sin(ny * 31 + seed * 0.01) * 0.018;
  const inner = 0.78 + large * 0.17 + medium * 0.075 + ledges;
  const outer = 0.035 + (fbm(ny * 8.5, 8.1, seed + 17, 4) - 0.5) * 0.065;
  return side === 'left'
    ? { outer: clamp(outer, 0.005, 0.09), inner: clamp(inner, 0.61, 0.94) }
    : { outer: clamp(1 - outer, 0.91, 0.995), inner: clamp(1 - inner, 0.06, 0.39) };
}

function rockPixel(side, x, y, w, h) {
  const nx = x / (w - 1), ny = y / (h - 1);
  const seed = side === 'left' ? 1200 : 2200;
  const profile = cliffProfile(side, ny, seed);
  const inside = side === 'left'
    ? nx >= profile.outer && nx <= profile.inner
    : nx <= profile.outer && nx >= profile.inner;
  if (!inside) return [0, 0, 0, 0];

  const innerDistance = side === 'left' ? profile.inner - nx : nx - profile.inner;
  const outerDistance = side === 'left' ? nx - profile.outer : profile.outer - nx;
  const edgeDistance = Math.min(innerDistance, outerDistance);
  const edgeAlpha = clamp(edgeDistance * w * 1.8, 0, 1);

  const broad = fbm(nx * 5.1 + seed * 0.01, ny * 15.5, seed + 31, 5);
  const mid = fbm(nx * 17.0, ny * 48.0, seed + 47, 4);
  const fine = fbm(nx * 48.0, ny * 133.0, seed + 61, 3);
  const face = Math.floor((nx * 4.2 + ny * 15.0 + broad * 2.8) * 2.0);
  const faceTone = hash2(face, Math.floor(ny * 18), seed + 71);

  // Broad diagonal and horizontal fractures. These are intentionally much larger
  // than V25's cellular pattern so the cliff reads as mountain geology, not bark.
  const diagonalPhase = nx * 5.4 - ny * 8.8 + broad * 1.7;
  const diagonal = Math.abs((diagonalPhase - Math.floor(diagonalPhase)) - 0.5);
  const diagonalCrack = clamp((0.055 - diagonal) / 0.055, 0, 1);
  const shelfPhase = ny * 17.0 + nx * 2.4 + mid * 1.3;
  const shelf = Math.abs((shelfPhase - Math.floor(shelfPhase)) - 0.5);
  const shelfCrack = clamp((0.035 - shelf) / 0.035, 0, 1);
  const majorFaultCenter = 0.36 + 0.15 * Math.sin(ny * 8.5 + seed) + (fbm(ny * 7.5, 9.0, seed + 80, 4) - 0.5) * 0.16;
  const majorFault = Math.exp(-Math.pow((nx - majorFaultCenter) * 24, 2));

  const lightFromUpperLeft = clamp(0.82 - ny * 0.22 - nx * 0.24 + broad * 0.15, 0.36, 0.95);
  const plane = 0.68 + faceTone * 0.42 + (mid - 0.5) * 0.24 + (fine - 0.5) * 0.11;
  let lum = 112 * plane * lightFromUpperLeft + 35;
  lum -= diagonalCrack * 49;
  lum -= shelfCrack * 36;
  lum -= majorFault * 52;

  // Recess the open-air edge and darken undersides of rock shelves.
  const innerShade = clamp(1 - innerDistance * 7.5, 0, 1);
  lum -= innerShade * 24;
  const shelfUnderside = clamp((Math.sin(shelfPhase * Math.PI * 2) + 0.72) * 0.46, 0, 1) * clamp(0.62 - fine, 0, 1);
  lum -= shelfUnderside * 16;

  let r = lum * 1.02;
  let g = lum * 0.91;
  let b = lum * 0.78;

  const coolStone = clamp((broad - 0.57) * 1.7, 0, 0.38);
  r = mix(r, 102, coolStone); g = mix(g, 106, coolStone); b = mix(b, 103, coolStone);
  const warmStone = clamp((0.48 - broad) * 1.8, 0, 0.34);
  r = mix(r, 132, warmStone); g = mix(g, 111, warmStone); b = mix(b, 84, warmStone);

  const lichen = clamp((fbm(nx * 23, ny * 52, seed + 93, 4) - 0.72) * 3.6, 0, 0.42) * clamp(1 - ny * 0.45, 0.5, 1);
  r = mix(r, 73, lichen); g = mix(g, 91, lichen); b = mix(b, 60, lichen);

  const grit = hash2(x, y, seed + 111);
  if (grit > 0.986) { r += 20; g += 18; b += 15; }
  if (grit < 0.012) { r -= 19; g -= 18; b -= 16; }

  return [r, g, b, edgeAlpha * 255];
}

function platformPixel(side, kind, x, y, w, h) {
  const nx = x / (w - 1), ny = y / (h - 1);
  const seed = (kind === 'start' ? 3100 : 4100) + (side === 'left' ? 0 : 500);
  const center = side === 'left' ? 0.47 : 0.53;
  const dx = Math.abs(nx - center);
  const topNoise = (fbm(nx * 12, 1.5, seed, 4) - 0.5) * 0.065;
  const top = (kind === 'start' ? 0.28 : 0.34) + dx * 0.16 + topNoise;
  const leftCut = 0.035 + (fbm(ny * 7, 2, seed + 2, 3) - 0.5) * 0.04;
  const rightCut = 0.965 + (fbm(ny * 7, 5, seed + 3, 3) - 0.5) * 0.04;
  const bottom = 0.91 - dx * 0.26 + (fbm(nx * 10, 4.7, seed + 4, 4) - 0.5) * 0.075;

  // Grass blades above the irregular turf line.
  if (ny < top) {
    const blade = hash2(x, 0, seed + 9);
    if (blade > (kind === 'start' ? 0.62 : 0.78)) {
      const height = (5 + hash2(x, 2, seed + 10) * (kind === 'start' ? 25 : 15)) / h;
      const widthGate = Math.abs((x % 4) - 1.5) < 1.3;
      if (widthGate && ny > top - height) {
        const t = clamp((top - ny) / Math.max(height, 0.001), 0, 1);
        return [53 + t * 20, 102 + t * 20, 39 + t * 8, 235];
      }
    }
    return [0, 0, 0, 0];
  }

  if (ny > bottom || nx < leftCut || nx > rightCut) return [0, 0, 0, 0];

  const depth = clamp((ny - top) / Math.max(0.03, bottom - top), 0, 1);
  const broad = fbm(nx * 8, ny * 13, seed + 20, 5);
  const mid = fbm(nx * 27, ny * 37, seed + 21, 4);
  const diagonal = Math.abs((((nx * 4.3 - ny * 6.2 + broad) % 1) + 1) % 1 - 0.5);
  const crack = clamp((0.048 - diagonal) / 0.048, 0, 1);
  let lum = 112 + broad * 47 + (mid - 0.5) * 24 - depth * 56 - crack * 42;
  let r = lum * 1.02, g = lum * 0.90, b = lum * 0.75;

  const grassDepth = kind === 'start' ? 0.15 : 0.085;
  const grass = clamp((top + grassDepth - ny) / grassDepth, 0, 1) * clamp((fbm(nx * 48, ny * 21, seed + 31, 4) - 0.18) * 1.45, 0, 1);
  r = mix(r, kind === 'start' ? 67 : 78, grass);
  g = mix(g, kind === 'start' ? 118 : 108, grass);
  b = mix(b, kind === 'start' ? 45 : 56, grass);

  const roots = kind === 'start' ? clamp((ny - top) / 0.19, 0, 1) * clamp((top + 0.2 - ny) / 0.2, 0, 1) : 0;
  r = mix(r, 70, roots * 0.25); g = mix(g, 63, roots * 0.25); b = mix(b, 43, roots * 0.25);

  const edge = Math.min(nx - leftCut, rightCut - nx, bottom - ny);
  return [r, g, b, clamp(edge * Math.max(w, h) * 1.7, 0, 1) * 255];
}

function holdPixel(seed, x, y, w, h) {
  const nx = (x / (w - 1) - 0.5) * 2;
  const ny = (y / (h - 1) - 0.5) * 2;
  const angle = Math.atan2(ny, nx);
  const angular = 0.72 + Math.sin(angle * 3 + seed * 0.01) * 0.09 + Math.sin(angle * 5 + 1.7) * 0.055;
  const flattened = Math.sqrt(nx * nx + Math.pow(ny * 1.55, 2));
  const topShelf = ny < -0.45 ? (Math.abs(ny + 0.45) * 0.72) : 0;
  const chipped = (noise2(Math.cos(angle) * 3 + 4, Math.sin(angle) * 3 + 4, seed) - 0.5) * 0.11;
  const boundary = angular + chipped;
  if (flattened + topShelf > boundary) return [0, 0, 0, 0];

  const broad = fbm(nx * 3 + 5, ny * 5 + 6, seed + 11, 4);
  const mid = fbm(nx * 10 + 3, ny * 12 + 2, seed + 19, 3);
  const diagonal = Math.abs((((nx * 2.3 - ny * 3.5 + broad) % 1) + 1) % 1 - 0.5);
  const crack = clamp((0.055 - diagonal) / 0.055, 0, 1);
  const topLight = clamp(0.78 - ny * 0.52 - nx * 0.16, 0.25, 1);
  const underside = clamp((ny - 0.02) * 1.9, 0, 1);
  let lum = 92 + broad * 58 + (mid - 0.5) * 24 + topLight * 31 - underside * 55 - crack * 43;
  let r = lum * 1.02, g = lum * 0.91, b = lum * 0.78;

  const lichen = clamp((fbm(nx * 8, ny * 10, seed + 31, 3) - 0.75) * 4, 0, 0.42);
  r = mix(r, 71, lichen); g = mix(g, 90, lichen); b = mix(b, 57, lichen);

  const edgeAlpha = clamp((boundary - flattened - topShelf) * 8.5, 0, 1);
  return [r, g, b, edgeAlpha * 255];
}

const assets = [
  ['summit-sprint-sky-v26.png', 1200, 1700, skyPixel],
  ['summit-sprint-cliff-left-v26.png', 420, 2400, (x, y, w, h) => rockPixel('left', x, y, w, h)],
  ['summit-sprint-cliff-right-v26.png', 420, 2400, (x, y, w, h) => rockPixel('right', x, y, w, h)],
  ['summit-sprint-start-left-v26.png', 720, 360, (x, y, w, h) => platformPixel('left', 'start', x, y, w, h)],
  ['summit-sprint-start-right-v26.png', 720, 360, (x, y, w, h) => platformPixel('right', 'start', x, y, w, h)],
  ['summit-sprint-summit-left-v26.png', 660, 300, (x, y, w, h) => platformPixel('left', 'summit', x, y, w, h)],
  ['summit-sprint-summit-right-v26.png', 660, 300, (x, y, w, h) => platformPixel('right', 'summit', x, y, w, h)]
];

for (let i = 0; i < 6; i += 1) {
  assets.push([`summit-sprint-hold-${i + 1}-v26.png`, 320, 220, (x, y, w, h) => holdPixel(6100 + i * 173, x, y, w, h)]);
}

for (const [name, width, height, draw] of assets) {
  const png = encodePng(width, height, draw);
  await writeFile(new URL(name, outDir), png);
  console.log(`Generated ${name} (${width}x${height}, ${png.length} bytes)`);
}
