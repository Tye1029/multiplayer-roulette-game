import { mkdir, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';

const outDir = new URL('../assets/mountain-race/images/', import.meta.url);
await mkdir(outDir, { recursive: true });

const clamp = (v, lo = 0, hi = 255) => Math.max(lo, Math.min(hi, v));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / Math.max(1e-9, b - a), 0, 1);
  return smooth(t);
};

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

function fbm(x, y, seed = 0, octaves = 4) {
  let sum = 0, amp = 0.56, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i += 1) {
    sum += noise2(x * freq, y * freq, seed + i * 131) * amp;
    norm += amp;
    amp *= 0.49;
    freq *= 2.07;
  }
  return sum / norm;
}

function cellular(x, y, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y);
  let f1 = Infinity, f2 = Infinity, dx1 = 0, dy1 = 0, cellX = 0, cellY = 0;
  for (let oy = -1; oy <= 1; oy += 1) {
    for (let ox = -1; ox <= 1; ox += 1) {
      const gx = ix + ox, gy = iy + oy;
      const px = gx + 0.13 + hash2(gx, gy, seed) * 0.74;
      const py = gy + 0.13 + hash2(gx, gy, seed + 941) * 0.74;
      const dx = x - px, dy = y - py;
      const d = dx * dx + dy * dy;
      if (d < f1) {
        f2 = f1;
        f1 = d;
        dx1 = dx;
        dy1 = dy;
        cellX = gx;
        cellY = gy;
      } else if (d < f2) {
        f2 = d;
      }
    }
  }
  return { f1: Math.sqrt(f1), f2: Math.sqrt(f2), dx: dx1, dy: dy1, cellX, cellY };
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

function pngChunk(type, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
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
    Buffer.from([137,80,78,71,13,10,26,10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND')
  ]);
}

const gauss = (x, center, width) => Math.exp(-((x - center) * (x - center)) / Math.max(1e-6, width * width));

function skyPixel(x, y, w, h) {
  const nx = x / (w - 1), ny = y / (h - 1);
  const t = Math.pow(ny, 0.88);
  let r = mix(73, 184, t), g = mix(137, 208, t), b = mix(188, 229, t);

  const sun = Math.exp(-((nx - 0.18) ** 2 * 17 + (ny - 0.11) ** 2 * 40));
  r += 36 * sun; g += 31 * sun; b += 18 * sun;

  const cloud = smoothstep(0.58, 0.76, fbm(nx * 5.2 + 3, ny * 8.5 + 4, 410, 5));
  const cloudBand = clamp(1 - Math.abs(ny - 0.36) * 3.7, 0, 1);
  const c = cloud * cloudBand * 0.6;
  r = mix(r, 237, c); g = mix(g, 241, c); b = mix(b, 242, c);

  const ridgeBase = 0.70 + Math.sin(nx * 9.7) * 0.025 + Math.sin(nx * 23.2 + 0.8) * 0.017;
  const ridgeNoise = (fbm(nx * 7.2, 1.4, 511, 4) - 0.5) * 0.08;
  const ridgeY = ridgeBase + ridgeNoise;
  if (ny > ridgeY) {
    const depth = clamp((ny - ridgeY) / 0.30, 0, 1);
    const detail = fbm(nx * 15, ny * 17, 512, 4);
    r = mix(82 + detail * 15, 42, depth);
    g = mix(106 + detail * 15, 67, depth);
    b = mix(118 + detail * 16, 78, depth);
  }

  const haze = clamp((ny - 0.56) / 0.30, 0, 1) * 0.28;
  r = mix(r, 185, haze); g = mix(g, 203, haze); b = mix(b, 209, haze);
  return [r, g, b, 255];
}

function cliffEdges(side, ny, seed) {
  const wobbleA = (noise2(ny * 10.8, 0.37, seed) - 0.5) * 0.075;
  const wobbleB = (noise2(ny * 25.0, 1.73, seed + 31) - 0.5) * 0.038;
  const taper = (0.5 - ny) * 0.018;
  const shelfYs = side === 'left' ? [0.13, 0.29, 0.47, 0.66, 0.84] : [0.18, 0.36, 0.53, 0.72, 0.88];
  let shelf = 0;
  for (let i = 0; i < shelfYs.length; i += 1) shelf += gauss(ny, shelfYs[i], 0.010 + (i % 2) * 0.004) * (0.045 + (i % 3) * 0.012);
  const notch = gauss(ny, side === 'left' ? 0.58 : 0.42, 0.022) * 0.05;

  if (side === 'left') {
    const left = 0.045 + wobbleA * 0.45 - wobbleB * 0.30 - taper * 0.4;
    const right = 0.895 + wobbleA + wobbleB + shelf - notch + taper;
    return [clamp(left, 0.015, 0.16), clamp(right, 0.73, 0.985)];
  }
  const left = 0.105 - wobbleA - wobbleB - shelf + notch - taper;
  const right = 0.955 - wobbleA * 0.42 + wobbleB * 0.30 + taper * 0.35;
  return [clamp(left, 0.015, 0.27), clamp(right, 0.84, 0.985)];
}

function cliffPixel(side, x, y, w, h, seed) {
  const nx = x / (w - 1), ny = y / (h - 1);
  const [left, right] = cliffEdges(side, ny, seed);
  if (nx < left || nx > right) return [0, 0, 0, 0];

  const edgePx = Math.min((nx - left) * w, (right - nx) * w);
  const alpha = clamp(smoothstep(0, 1.6, edgePx) * 255, 0, 255);

  const warp = (fbm(nx * 3.4 + 2, ny * 15.0 + 3, seed + 101, 3) - 0.5) * 0.72;
  const cells = cellular(nx * 8.2 + warp + (side === 'left' ? 0 : 7), ny * 49.0 + warp * 0.42, seed + 211);
  const gap = cells.f2 - cells.f1;
  const crack = 1 - smoothstep(0.025, 0.095, gap);
  const facet = hash2(cells.cellX, cells.cellY, seed + 250);
  const facetWarm = hash2(cells.cellX, cells.cellY, seed + 251);
  const facetLight = clamp(0.58 - cells.dx * 0.62 - cells.dy * 0.40, 0, 1);

  const broad = fbm(nx * 5.5, ny * 19.0, seed + 301, 4);
  const detail = fbm(nx * 31.0 + 4, ny * 91.0 + 7, seed + 302, 3);
  const diagonalPhase = nx * 7.2 + ny * 23.0 + (broad - 0.5) * 1.8;
  const diagonal = Math.abs((diagonalPhase - Math.floor(diagonalPhase)) - 0.5);
  const fracture = smoothstep(0.455, 0.495, diagonal) * 0.44;

  const ledgeYs = side === 'left' ? [0.13, 0.29, 0.47, 0.66, 0.84] : [0.18, 0.36, 0.53, 0.72, 0.88];
  let shelfShade = 0;
  let shelfHighlight = 0;
  for (let i = 0; i < ledgeYs.length; i += 1) {
    const sy = ledgeYs[i];
    shelfHighlight = Math.max(shelfHighlight, gauss(ny, sy - 0.002, 0.0025));
    shelfShade = Math.max(shelfShade, gauss(ny, sy + 0.006, 0.0065));
  }

  let lum = 68 + facet * 48 + facetLight * 31 + broad * 28 + detail * 10;
  lum -= crack * 80;
  lum -= fracture * 28;
  lum -= shelfShade * 37;
  lum += shelfHighlight * 24;
  lum += (1 - ny) * 8;

  const inner = side === 'left' ? (right - nx) / Math.max(0.001, right - left) : (nx - left) / Math.max(0.001, right - left);
  lum += inner * 10;
  lum -= (1 - smoothstep(0, 22, edgePx)) * 22;

  let r = lum * mix(0.96, 1.04, facetWarm);
  let g = lum * mix(0.95, 1.00, facetWarm);
  let b = lum * mix(0.91, 0.96, facetWarm);

  const mineral = smoothstep(0.78, 0.93, fbm(nx * 15 + 5, ny * 51 + 8, seed + 370, 3)) * 0.18;
  r = mix(r, 160, mineral); g = mix(g, 154, mineral); b = mix(b, 142, mineral);

  const lichen = smoothstep(0.78, 0.94, fbm(nx * 19 + 9, ny * 67 + 2, seed + 390, 3)) * 0.18 * clamp((0.95 - ny) * 1.2, 0.25, 1);
  r = mix(r, 77, lichen); g = mix(g, 92, lichen); b = mix(b, 61, lichen);

  const fleck = hash2(x * 5 + 11, y * 5 + 7, seed + 401);
  if (fleck > 0.992) { r += 24; g += 23; b += 20; }
  if (fleck < 0.006) { r -= 18; g -= 18; b -= 17; }

  return [r, g, b, alpha];
}

function platformPixel(kind, side, x, y, w, h, seed) {
  const nx = x / (w - 1), ny = y / (h - 1);
  const center = Math.abs(nx - 0.5) * 2;
  const edge = (fbm(nx * 11, 0.5, seed, 4) - 0.5) * 0.08;
  const top = (kind === 'start' ? 0.22 : 0.26) + center * center * 0.10 + edge;
  const bottom = 0.90 - center * center * 0.22 + (fbm(nx * 9, 3.1, seed + 2, 4) - 0.5) * 0.07;

  if (ny < top) {
    const blade = hash2(x, 0, seed + 20);
    if (blade > 0.78) {
      const maxH = (5 + hash2(x, 1, seed + 21) * (kind === 'start' ? 26 : 17)) / h;
      if (ny > top - maxH) {
        const t = clamp((top - ny) / maxH, 0, 1);
        return [58 + t * 18, 83 + t * 20, 43 + t * 9, 245];
      }
    }
    return [0, 0, 0, 0];
  }
  if (ny > bottom) return [0, 0, 0, 0];

  const depth = clamp((ny - top) / Math.max(0.01, bottom - top), 0, 1);
  const cell = cellular(nx * 14 + (side === 'left' ? 0 : 5), ny * 9, seed + 30);
  const crack = 1 - smoothstep(0.03, 0.10, cell.f2 - cell.f1);
  const facet = hash2(cell.cellX, cell.cellY, seed + 31);
  const noise = fbm(nx * 24, ny * 22, seed + 32, 3);
  let lum = 83 + facet * 42 + noise * 26 - depth * 46 - crack * 50;
  let r = lum * 0.99, g = lum * 0.96, b = lum * 0.90;

  const grassBand = clamp((top + (kind === 'start' ? 0.16 : 0.10) - ny) / (kind === 'start' ? 0.16 : 0.10), 0, 1);
  const grassNoise = smoothstep(0.28, 0.72, fbm(nx * 48, ny * 21, seed + 44, 3));
  const grass = grassBand * grassNoise * (kind === 'start' ? 0.82 : 0.48);
  r = mix(r, 77, grass); g = mix(g, 101, grass); b = mix(b, 52, grass);

  const edgeAlpha = Math.min((ny - top) * h, (bottom - ny) * h, (0.54 - center * 0.42) * w);
  const alpha = clamp(smoothstep(0, 1.4, edgeAlpha) * 255, 0, 255);
  return [r, g, b, alpha];
}

function holdPixel(variant, x, y, w, h) {
  const nx = (x / (w - 1) - 0.5) * 2;
  const ny = (y / (h - 1) - 0.5) * 2;
  const angle = Math.atan2(ny, nx);
  const radial = Math.sqrt(nx * nx + ny * ny);
  const seed = 7000 + variant * 313;
  const shape = 0.76 + Math.sin(angle * (3 + variant % 3) + variant * 0.8) * 0.075 + Math.sin(angle * (6 + variant % 2) + 1.1) * 0.035 + (noise2(Math.cos(angle) * 2.5 + 4, Math.sin(angle) * 2.5 + 4, seed) - 0.5) * 0.07;
  const squash = Math.abs(ny) * (0.19 + (variant % 3) * 0.025);
  const d = radial + squash;
  if (d > shape) return [0, 0, 0, 0];

  const cell = cellular((nx + 1) * 4.2, (ny + 1) * 3.5, seed + 1);
  const crack = 1 - smoothstep(0.035, 0.12, cell.f2 - cell.f1);
  const facet = hash2(cell.cellX, cell.cellY, seed + 2);
  const tex = fbm(nx * 5 + 7, ny * 6 + 5, seed + 3, 3);
  const topLight = clamp(0.72 - ny * 0.48 - nx * 0.13, 0, 1);
  const underside = clamp((ny - 0.12) * 1.7, 0, 1);
  let lum = 67 + facet * 40 + tex * 31 + topLight * 37 - underside * 43 - crack * 54;
  let r = lum * 1.00, g = lum * 0.97, b = lum * 0.91;
  const lichen = smoothstep(0.79, 0.94, fbm(nx * 8 + 4, ny * 9 + 8, seed + 9, 3)) * 0.18;
  r = mix(r, 74, lichen); g = mix(g, 91, lichen); b = mix(b, 58, lichen);
  const alpha = clamp(smoothstep(0, 0.025, shape - d) * 255, 0, 255);
  return [r, g, b, alpha];
}

const assets = [
  ['summit-sprint-sky-v27.png', 1200, 1800, skyPixel],
  ['summit-sprint-cliff-left-mobile-v27.png', 390, 4560, (x,y,w,h) => cliffPixel('left', x,y,w,h, 1201)],
  ['summit-sprint-cliff-right-mobile-v27.png', 390, 4560, (x,y,w,h) => cliffPixel('right', x,y,w,h, 1301)],
  ['summit-sprint-cliff-left-desktop-v27.png', 720, 3420, (x,y,w,h) => cliffPixel('left', x,y,w,h, 1401)],
  ['summit-sprint-cliff-right-desktop-v27.png', 720, 3420, (x,y,w,h) => cliffPixel('right', x,y,w,h, 1501)],
  ['summit-sprint-start-left-v27.png', 720, 288, (x,y,w,h) => platformPixel('start', 'left', x,y,w,h, 2101)],
  ['summit-sprint-start-right-v27.png', 720, 288, (x,y,w,h) => platformPixel('start', 'right', x,y,w,h, 2201)],
  ['summit-sprint-summit-left-v27.png', 720, 256, (x,y,w,h) => platformPixel('summit', 'left', x,y,w,h, 2301)],
  ['summit-sprint-summit-right-v27.png', 720, 256, (x,y,w,h) => platformPixel('summit', 'right', x,y,w,h, 2401)]
];

for (let i = 0; i < 8; i += 1) {
  assets.push([`summit-sprint-hold-${i + 1}-v27.png`, 320, 200, (x,y,w,h) => holdPixel(i + 1, x,y,w,h)]);
}

for (const [name, width, height, draw] of assets) {
  const png = encodePng(width, height, draw);
  await writeFile(new URL(name, outDir), png);
  console.log(`Generated ${name} (${width}x${height}, ${png.length} bytes)`);
}
