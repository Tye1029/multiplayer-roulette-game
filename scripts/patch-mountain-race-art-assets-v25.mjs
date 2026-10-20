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
  let sum = 0, amp = 0.54, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i += 1) {
    sum += noise2(x * freq, y * freq, seed + i * 97) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

function ridged(x, y, seed = 0) {
  return 1 - Math.abs(fbm(x, y, seed, 4) * 2 - 1);
}

function cellular(x, y, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y);
  let f1 = Infinity, f2 = Infinity, cx = 0, cy = 0, cellX = 0, cellY = 0;
  for (let oy = -1; oy <= 1; oy += 1) {
    for (let ox = -1; ox <= 1; ox += 1) {
      const gx = ix + ox, gy = iy + oy;
      const px = gx + 0.15 + hash2(gx, gy, seed) * 0.7;
      const py = gy + 0.15 + hash2(gx, gy, seed + 911) * 0.7;
      const dx = x - px, dy = y - py;
      const d = dx * dx + dy * dy;
      if (d < f1) {
        f2 = f1; f1 = d; cx = dx; cy = dy; cellX = gx; cellY = gy;
      } else if (d < f2) f2 = d;
    }
  }
  return { f1: Math.sqrt(f1), f2: Math.sqrt(f2), dx: cx, dy: cy, cellX, cellY };
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
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND')
  ]);
}

function skyPixel(x, y, w, h) {
  const nx = x / (w - 1), ny = y / (h - 1);
  const horizon = Math.pow(ny, 0.82);
  let r = mix(83, 188, horizon), g = mix(146, 216, horizon), b = mix(188, 235, horizon);

  const sunDx = nx - 0.22, sunDy = ny - 0.11;
  const sun = Math.exp(-(sunDx * sunDx * 12 + sunDy * sunDy * 25));
  r += sun * 42; g += sun * 32; b += sun * 12;

  const cloudBase = fbm(nx * 5.2, ny * 9.5, 601, 5);
  const cloudFine = fbm(nx * 15.0 + 4, ny * 24.0, 602, 3);
  const cloudMask = clamp((cloudBase * 0.78 + cloudFine * 0.22 - 0.59) * 5, 0, 1);
  const cloudBand = clamp(1 - Math.abs(ny - 0.43) * 2.5, 0, 1);
  const c = cloudMask * cloudBand * 0.72;
  r = mix(r, 235, c); g = mix(g, 240, c); b = mix(b, 241, c);

  const mountainY = 0.72 + 0.045 * Math.sin(nx * 13.2) + 0.026 * Math.sin(nx * 31.7 + 1.4) + (fbm(nx * 7, 0.2, 712, 4) - 0.5) * 0.09;
  if (ny > mountainY) {
    const depth = clamp((ny - mountainY) / 0.28, 0, 1);
    const detail = fbm(nx * 14, ny * 18, 713, 4);
    r = mix(76 + detail * 16, 49, depth);
    g = mix(104 + detail * 18, 72, depth);
    b = mix(111 + detail * 16, 78, depth);
  }
  return [r, g, b, 255];
}

function cliffPixel(side, x, y, w, h) {
  const nx = x / (w - 1), ny = y / (h - 1);
  const broad = fbm(nx * 6.5 + (side === 'left' ? 0 : 11), ny * 18.0, 1101, 5);
  const fine = fbm(nx * 38.0, ny * 118.0, 1102, 3);
  const grain = hash2(x, y, 1109) - 0.5;

  const coarse = cellular(x / 74, y / 92, 1130);
  const medium = cellular(x / 34, y / 44, 1140);
  const coarseGap = coarse.f2 - coarse.f1;
  const mediumGap = medium.f2 - medium.f1;
  const coarseCrack = clamp((0.082 - coarseGap) / 0.082, 0, 1);
  const mediumCrack = clamp((0.046 - mediumGap) / 0.046, 0, 1) * 0.42;
  const crack = Math.max(coarseCrack, mediumCrack);

  const facet = hash2(coarse.cellX, coarse.cellY, 1150);
  const facet2 = hash2(medium.cellX, medium.cellY, 1151);
  const localLight = clamp(0.58 - coarse.dx * 0.52 - coarse.dy * 0.24, 0, 1);
  const strataPhase = ny * 34 + broad * 2.6 + nx * 1.7;
  const strataFrac = Math.abs((strataPhase - Math.floor(strataPhase)) - 0.5);
  const strataShadow = strataFrac > 0.455 ? (strataFrac - 0.455) / 0.045 : 0;

  let lum = 54 + broad * 44 + fine * 20 + facet * 34 + facet2 * 11 + localLight * 24 + grain * 16;
  lum -= crack * 79;
  lum -= strataShadow * 19;

  const inner = side === 'left' ? nx : 1 - nx;
  lum += Math.pow(inner, 1.35) * 28 - Math.pow(1 - inner, 1.8) * 17;
  lum += (1 - ny) * 6;

  let r = lum * 1.01;
  let g = lum * 0.93;
  let b = lum * 0.82;

  // Moss only collects in protected pockets and cracks, not as a soft wash.
  const mossField = fbm(nx * 18 + 2, ny * 44 + 7, 1160, 4);
  const moss = clamp((mossField - 0.69) * 4.7, 0, 0.68) * clamp((0.94 - ny) * 1.2, 0.18, 1) * (0.45 + crack * 0.8);
  r = mix(r, 54, moss); g = mix(g, 83, moss); b = mix(b, 45, moss);

  // Fine mineral flecks keep downscaled textures crisp instead of smeared.
  const fleck = hash2(x * 3 + 7, y * 3 + 17, 1180);
  if (fleck > 0.985) { r += 30; g += 28; b += 23; }
  if (fleck < 0.012) { r -= 24; g -= 23; b -= 21; }

  return [r, g, b, 255];
}

function platformPixel(kind, x, y, w, h) {
  const nx = x / (w - 1), ny = y / (h - 1);
  const center = Math.abs(nx - 0.5) * 2;
  const edgeNoise = fbm(nx * 12, 0.35, kind === 'start' ? 2101 : 2201, 4) - 0.5;
  const top = 0.24 + center * center * 0.11 + edgeNoise * 0.10;
  const bottom = 0.91 - center * center * 0.18 + (fbm(nx * 9, 3.7, kind === 'start' ? 2102 : 2202, 4) - 0.5) * 0.09;

  // Individual grass blades rise above the turf silhouette.
  if (ny < top) {
    const bladeRoll = hash2(x, 0, kind === 'start' ? 2130 : 2230);
    if (bladeRoll > 0.68) {
      const bladeHeight = (4 + hash2(x, 1, 2131) * 18) / h;
      const lean = (hash2(x, 2, 2132) - 0.5) * 3;
      const bladeX = Math.round(x + (top - ny) * h * lean * 0.08);
      if (Math.abs(bladeX - x) <= 1 && ny > top - bladeHeight) {
        const t = clamp((top - ny) / bladeHeight, 0, 1);
        return [55 + t * 16, 102 + t * 18, 40 + t * 8, 245];
      }
    }
    return [0,0,0,0];
  }
  if (ny > bottom) return [0,0,0,0];

  const depth = clamp((ny - top) / Math.max(0.01, bottom - top), 0, 1);
  const cell = cellular(x / 48, y / 38, kind === 'start' ? 2140 : 2240);
  const gap = cell.f2 - cell.f1;
  const crack = clamp((0.055 - gap) / 0.055, 0, 1);
  const facet = hash2(cell.cellX, cell.cellY, kind === 'start' ? 2141 : 2241);
  const rock = fbm(nx * 25, ny * 31, kind === 'start' ? 2110 : 2210, 4);
  const grain = (hash2(x, y, 2190) - 0.5) * 14;
  const strata = Math.abs(((ny * 16 + rock * 0.8) % 1) - 0.5) > 0.455 ? 1 : 0;
  let lum = 70 + rock * 55 + facet * 29 - depth * 44 - crack * 60 - strata * 13 + grain;
  let r = lum * 1.00, g = lum * 0.92, b = lum * 0.80;

  // Dense turf cap with crisp yellow-green highlights and darker roots.
  const grassBand = clamp((top + 0.14 - ny) / 0.14, 0, 1);
  const grassNoise = fbm(nx * 55, ny * 28, kind === 'start' ? 2120 : 2220, 4);
  let green = grassBand * clamp((grassNoise - 0.18) * 1.55, 0, 1);
  if (kind === 'summit') green *= 0.72;
  r = mix(r, kind === 'start' ? 66 : 76, green);
  g = mix(g, kind === 'start' ? 118 : 108, green);
  b = mix(b, kind === 'start' ? 43 : 55, green);

  if (kind === 'summit') {
    const snowLine = top + 0.035 + (fbm(nx * 30, 2.1, 2290, 3) - 0.5) * 0.035;
    const snow = ny < snowLine + 0.065 ? clamp((snowLine + 0.065 - ny) / 0.065, 0, 0.82) : 0;
    r = mix(r, 226, snow); g = mix(g, 231, snow); b = mix(b, 226, snow);
  }

  const rim = clamp((top + 0.025 - ny) / 0.025, 0, 1);
  r += rim * 30; g += rim * 27; b += rim * 20;
  return [r, g, b, 255];
}

function holdPixel(seed, x, y, w, h) {
  const nx = (x / (w - 1)) * 2 - 1;
  const ny = (y / (h - 1)) * 2 - 1;
  const angle = Math.atan2(ny, nx);
  const radial = Math.sqrt(nx * nx + ny * ny);
  const boundary = 0.79 + Math.sin(angle * 3 + seed) * 0.07 + Math.sin(angle * 5 + seed * 0.03) * 0.045 + (noise2(Math.cos(angle) * 2 + 3, Math.sin(angle) * 2 + 3, seed) - 0.5) * 0.08;
  const verticalShape = ny < -0.62 ? (ny + 0.62) * 1.7 : ny > 0.62 ? (ny - 0.62) * 1.8 : 0;
  if (radial + Math.abs(verticalShape) > boundary) return [0,0,0,0];

  const cell = cellular(x / 31, y / 28, seed + 19);
  const crack = clamp((0.055 - (cell.f2 - cell.f1)) / 0.055, 0, 1);
  const facet = hash2(cell.cellX, cell.cellY, seed + 21);
  const texture = fbm(nx * 6 + 5, ny * 8 + 5, seed + 31, 4);
  const grain = (hash2(x, y, seed + 71) - 0.5) * 17;
  const topLight = clamp(0.62 - ny * 0.62 - nx * 0.16, 0, 1);
  const underside = clamp((ny - 0.15) * 1.8, 0, 1);
  let lum = 63 + texture * 57 + facet * 29 + topLight * 33 - underside * 42 - crack * 55 + grain;
  let r = lum * 1.01, g = lum * 0.93, b = lum * 0.81;

  const lichen = clamp((fbm(nx * 10 + 8, ny * 12 + 8, seed + 83, 3) - 0.73) * 4.2, 0, 0.55);
  r = mix(r, 67, lichen); g = mix(g, 91, lichen); b = mix(b, 53, lichen);

  const edgeDist = clamp((boundary - radial) * 9, 0, 1);
  const alpha = clamp(edgeDist * 320, 0, 255);
  return [r, g, b, alpha];
}

const assets = [
  ['summit-sprint-sky-v25.png', 1080, 1600, skyPixel],
  ['summit-sprint-cliff-left-v25.png', 840, 2400, (x,y,w,h) => cliffPixel('left', x,y,w,h)],
  ['summit-sprint-cliff-right-v25.png', 840, 2400, (x,y,w,h) => cliffPixel('right', x,y,w,h)],
  ['summit-sprint-start-platform-v25.png', 1200, 320, (x,y,w,h) => platformPixel('start', x,y,w,h)],
  ['summit-sprint-summit-platform-v25.png', 1000, 280, (x,y,w,h) => platformPixel('summit', x,y,w,h)]
];

for (let i = 0; i < 6; i += 1) {
  assets.push([`summit-sprint-hold-${i + 1}-v25.png`, 280, 180, (x,y,w,h) => holdPixel(3000 + i * 127, x,y,w,h)]);
}

for (const [name, width, height, draw] of assets) {
  const png = encodePng(width, height, draw);
  await writeFile(new URL(name, outDir), png);
  console.log(`Generated ${name} (${width}x${height}, ${png.length} bytes)`);
}
