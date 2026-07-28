import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packParts = Array.from({ length: 12 }, (_, index) =>
  path.join(projectRoot, 'scripts/audio-pack', `part-${String(index + 1).padStart(2, '0')}.b64`)
);
const pack = Buffer.concat(await Promise.all(packParts.map(async part =>
  Buffer.from((await readFile(part, 'utf8')).trim(), 'base64')
)));
const magic = pack.subarray(0, 8).toString('ascii');
if (magic !== 'RRAUD001') throw new Error(`Unexpected roulette audio bundle signature: ${magic}`);

const headerLength = pack.readUInt32BE(8);
const headerStart = 12;
const dataStart = headerStart + headerLength;
const header = JSON.parse(pack.subarray(headerStart, dataStart).toString('utf8'));
if (header.version !== 1 || !Array.isArray(header.files)) {
  throw new Error('Unsupported roulette audio bundle format.');
}

for (const entry of header.files) {
  const relativePath = String(entry.path || '').replaceAll('\\', '/');
  const allowed = relativePath.startsWith('assets/audio/roulette/') ||
    relativePath === 'assets/roulette/roulette-audio.js';
  if (!allowed || relativePath.includes('../')) {
    throw new Error(`Unsafe roulette audio path: ${relativePath}`);
  }
  const start = dataStart + Number(entry.offset || 0);
  const end = start + Number(entry.size || 0);
  if (start < dataStart || end > pack.length || end < start) {
    throw new Error(`Invalid roulette audio range: ${relativePath}`);
  }
  const data = pack.subarray(start, end);
  const digest = createHash('sha256').update(data).digest('hex');
  if (digest !== entry.sha256) throw new Error(`Roulette audio checksum failed: ${relativePath}`);
  const destination = path.join(projectRoot, relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, data);
}

console.log(`Extracted ${header.files.length} normalized roulette audio and runtime assets.`);
