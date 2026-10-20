import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = 'scripts/mountain-race-v28-source';
const names = (await readdir(dir)).filter(name => name.endsWith('.mjs')).sort((a,b) => a.localeCompare(b, undefined, { numeric: true }));
console.log('V28 source files:', names.join(', '));

const groups = new Map();
for (const name of names) {
  const key = name.replace(/(?:[-_]?\d+)?\.mjs$/i, '');
  const list = groups.get(key) || [];
  list.push(name);
  groups.set(key, list);
}

const sig = bytes => [...bytes.subarray(0, 12)].map(v => v.toString(16).padStart(2, '0')).join(' ');
const type = bytes => {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'PNG';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'JPEG';
  return 'UNKNOWN';
};

for (const [key, files] of groups) {
  let joined = '';
  let ok = true;
  for (const file of files) {
    try {
      const mod = await import(pathToFileURL(join(process.cwd(), dir, file)).href + `?diag=${Date.now()}-${Math.random()}`);
      if (typeof mod.default !== 'string') throw new Error('default export is not a string');
      joined += mod.default;
    } catch (error) {
      ok = false;
      console.log(`GROUP ${key}: import failed for ${file}: ${error.message}`);
      break;
    }
  }
  if (!ok || !joined) continue;
  const bytes = Buffer.from(joined, 'base64');
  console.log(`GROUP ${key}: files=${files.length} base64=${joined.length} bytes=${bytes.length} type=${type(bytes)} sig=${sig(bytes)}`);
  if (type(bytes) !== 'UNKNOWN') {
    const ext = type(bytes) === 'PNG' ? 'png' : 'jpg';
    await writeFile(`/tmp/v28-${key.replace(/[^a-z0-9]+/gi, '-')}.${ext}`, bytes);
  }
}

// Also test the known clean series if present, even while incomplete.
const clean = names.filter(n => /^clean-\d+\.mjs$/i.test(n));
if (clean.length) {
  let joined = '';
  for (const file of clean) {
    const mod = await import(pathToFileURL(join(process.cwd(), dir, file)).href + `?clean=${Date.now()}-${Math.random()}`);
    joined += mod.default;
  }
  const bytes = Buffer.from(joined, 'base64');
  console.log(`CLEAN SERIES: files=${clean.length} base64=${joined.length} bytes=${bytes.length} type=${type(bytes)} sig=${sig(bytes)}`);
}
