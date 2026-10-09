import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import vm from 'node:vm';

const source = path => new URL(`../${path}`, import.meta.url);
const runtime = vm.createContext({ Date, setTimeout });
runtime.window = runtime;
vm.runInContext(await readFile(source('assets/roulette/lamp-config.js'), 'utf8'), runtime);
vm.runInContext(await readFile(source('assets/roulette/lamp.js'), 'utf8'), runtime);
const { samplePendulum, projectLightToSurface } = runtime.RouletteLamp;
const cfg = Object.freeze(runtime.RouletteLampConfig.normalize());
const geometry = Object.freeze({ anchorX: 410, anchorY: 8, length: 155,
  tableY: 230, tableWidth: 738, tableHeight: 389, reducedMotion: false });
const close = (actual, expected, message, epsilon = 1e-8) =>
  assert(Math.abs(actual - expected) < epsilon, `${message}: ${actual} != ${expected}`);

// The light must follow the very same pendulum, even at both turning points.
const period = cfg.speed * 1000;
const center = samplePendulum(cfg, 0, geometry);
const left = samplePendulum(cfg, period / 4, geometry);
const right = samplePendulum(cfg, period * 3 / 4, geometry);
const repeated = samplePendulum(cfg, period, geometry);
close(left.angle, cfg.swing, 'Positive sway maximum');
close(right.angle, -cfg.swing, 'Negative sway maximum');
close(left.bulbX + right.bulbX, geometry.anchorX * 2, 'Bulb path symmetry');
close(left.poolX + right.poolX, center.poolX * 2, 'Light pool follows bulb symmetry');
close(left.poolY, right.poolY, 'Light stays on the table plane');
assert(left.poolX < left.bulbX + geometry.tableWidth * (cfg.lightX - 50) / 100,
  'Positive lamp tilt did not project beyond its bulb');
assert(right.poolX > right.bulbX + geometry.tableWidth * (cfg.lightX - 50) / 100,
  'Negative lamp tilt did not project beyond its bulb');
for (const property of ['angle', 'bulbX', 'bulbY', 'poolX', 'poolY', 'radiusX', 'radiusY'])
  close(repeated[property], center[property], `Continuous ${property} at cycle boundary`);
for (let time = 0; time < period; time += 32) {
  const a = samplePendulum(cfg, time, geometry), b = samplePendulum(cfg, time + 32, geometry);
  assert(Math.abs(a.poolX - b.poolX) < 4, 'Swaying light jumps between animation frames');
}
const longerReach = samplePendulum({ ...cfg, trackSpeed: cfg.trackSpeed * 1.5 }, period / 4, geometry);
close(longerReach.angle, left.angle, 'Tracking settings must not introduce another animation clock');
for (const time of [0, period / 4, period / 2, period * 3 / 4]) {
  const still = samplePendulum(cfg, time, { ...geometry, reducedMotion: true });
  close(still.angle, 0, 'Reduced motion leaves lamp stationary');
  close(still.poolX, center.poolX, 'Reduced motion leaves light stationary');
  const disabled = samplePendulum({ ...cfg, swing: 0 }, time, geometry);
  close(disabled.poolX, center.poolX, 'Zero sway leaves light stationary');
}

// Model the gun's rendered facing/recoil plane independently. The viewport pool
// and its elliptical footprint must remain fixed as that plane turns and scales.
const worldLight = { x: left.poolX + 100, y: left.poolY + 75 };
for (const degrees of [-4, 0, 45, 90, 176, 270, 361, 720]) {
  const angle = degrees * Math.PI / 180;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const matrix = { a: cos * .74, b: sin * .74,
    c: (cos * .12 - sin) * .78, d: (sin * .12 + cos) * .78 };
  const origin = { x: 430 + Math.sin(angle) * 7, y: 360 + Math.cos(angle) * 5 };
  const forward = (x, y) => ({ x: origin.x + matrix.a * x + matrix.c * y,
    y: origin.y + matrix.b * x + matrix.d * y });
  const plane = { a: forward(0, 0), b: forward(350, 0), c: forward(0, 140), width: 350, height: 140 };
  const local = projectLightToSurface(plane, worldLight.x, worldLight.y);
  assert(local, `No light projection at gun angle ${degrees}`);
  const projectedCenter = forward(local.x, local.y);
  close(projectedCenter.x, worldLight.x, `Fixed world light x at ${degrees}deg`);
  close(projectedCenter.y, worldLight.y, `Fixed world light y at ${degrees}deg`);
  for (const phase of [0, Math.PI / 4, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const x = left.radiusX * Math.cos(phase), y = left.radiusY * Math.sin(phase);
    const edge = forward(local.x + local.a * x + local.c * y,
      local.y + local.b * x + local.d * y);
    close(edge.x, worldLight.x + x, `World footprint x at ${degrees}deg`);
    close(edge.y, worldLight.y + y, `World footprint y at ${degrees}deg`);
  }
}
assert.equal(projectLightToSurface({ a: { x: 0, y: 0 }, b: { x: 10, y: 0 },
  c: { x: 20, y: 0 }, width: 10, height: 10 }, 1, 1), null, 'Collapsed plane must skip rendering');

// Decode production PNG alpha directly, including the indexed mobile assets.
// This keeps the checks independent of Python, browser APIs and image libraries.
function pngAlpha(bytes, name) {
  assert(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), `${name}: PNG signature`);
  let width, height, depth, type, interlace, palette, transparency;
  const compressed = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset), chunk = bytes.toString('ascii', offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    assert.equal(data.length, length, `${name}: truncated ${chunk}`);
    if (chunk === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      depth = data[8]; type = data[9]; interlace = data[12];
    } else if (chunk === 'PLTE') palette = data;
    else if (chunk === 'tRNS') transparency = data;
    else if (chunk === 'IDAT') compressed.push(data);
    offset += length + 12;
    if (chunk === 'IEND') break;
  }
  assert.equal(depth, 8, `${name}: expected 8-bit asset`);
  assert.equal(interlace, 0, `${name}: expected noninterlaced asset`);
  assert([3, 6].includes(type), `${name}: asset needs alpha transparency`);
  if (type === 3) assert(palette && transparency, `${name}: indexed alpha palette missing`);
  const channels = type === 6 ? 4 : 1, stride = width * channels;
  const scanlines = inflateSync(Buffer.concat(compressed));
  assert.equal(scanlines.length, (stride + 1) * height, `${name}: PNG row length`);
  const alpha = new Uint8Array(width * height);
  let previous = Buffer.alloc(stride);
  const paeth = (a, b, c) => {
    const p = a + b - c, da = Math.abs(p - a), db = Math.abs(p - b), dc = Math.abs(p - c);
    return da <= db && da <= dc ? a : db <= dc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (stride + 1), filter = scanlines[rowOffset], row = Buffer.alloc(stride);
    assert(filter <= 4, `${name}: invalid PNG filter`);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? row[x - channels] : 0, b = previous[x], c = x >= channels ? previous[x - channels] : 0;
      const predictor = [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)][filter];
      row[x] = (scanlines[rowOffset + 1 + x] + predictor) & 255;
    }
    for (let x = 0; x < width; x++)
      alpha[y * width + x] = type === 6 ? row[x * 4 + 3] : transparency[row[x]] ?? 255;
    previous = row;
  }
  return { width, height, alpha };
}

const assets = [
  { name: 'rustic-pendant-v2.png', maxBytes: 300000, ratio: 640 / 427 },
  { name: 'oval-table-v2.png', maxBytes: 400000, ratio: 1200 / 632 },
  { name: 'saloon-chair-v2.png', maxBytes: 120000, ratio: 2 / 3 },
  { name: 'seated-player-v2.png', maxBytes: 130000, ratio: 2 / 3, croppedWaist: true }
];
let assetBytes = 0, decodedPixels = 0;
for (const asset of assets) {
  const bytes = await readFile(source(`assets/roulette/decor/${asset.name}`));
  assert(bytes.length < asset.maxBytes, `${asset.name}: exceeds mobile transfer budget`);
  assetBytes += bytes.length;
  const { width, height, alpha } = pngAlpha(bytes, asset.name);
  decodedPixels += width * height;
  close(width / height, asset.ratio, `${asset.name}: aspect ratio changed`, .001);
  for (const index of [0, width - 1, (height - 1) * width, width * height - 1])
    assert.equal(alpha[index], 0, `${asset.name}: opaque background corner`);
  let opaque = 0, transparent = 0;
  for (const value of alpha) { if (value > 200) opaque++; if (value === 0) transparent++; }
  assert(opaque > width * height * .1, `${asset.name}: physical object missing`);
  assert(transparent > width * height * .15, `${asset.name}: background not extracted`);
  for (let x = 0; x < width; x++) {
    if (!asset.croppedWaist) assert(alpha[x] <= 3, `${asset.name}: top edge cuts the object`);
    assert(alpha[(height - 1) * width + x] <= 3, `${asset.name}: bottom edge cuts the object`);
  }
  for (let y = 0; y < height; y++) {
    assert(alpha[y * width] <= 3, `${asset.name}: left edge cuts the object`);
    assert(alpha[y * width + width - 1] <= 3, `${asset.name}: right edge cuts the object`);
  }
}
assert(assetBytes < 900000, 'New scene sprites exceed combined mobile transfer budget');
assert(decodedPixels < 1800000, 'New scene sprites exceed decoded mobile memory budget');

console.log(`Roulette scene passed: one pendulum clock, continuous light projection, reduced motion, fixed world light through eight gun rotations, clean sprite alpha, ${(assetBytes / 1024).toFixed(0)} KiB scene media.`);
