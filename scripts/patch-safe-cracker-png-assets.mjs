import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const rootUrl = new URL('../', import.meta.url);
const chunkDirectoryUrl = new URL('assets/safe-cracker/png-ui-v6-data/', rootUrl);
const outputDirectoryUrl = new URL('assets/safe-cracker/png-ui/', rootUrl);
const expectedChunks = Object.freeze([
  ['chunk-00.txt', 6_000, '1b9299eceb67a65f8a7e8c5b61288d5d3c51e8a805fbd62be2e1fee89b302f71'],
  ['chunk-01.txt', 6_000, 'e1ca2aa85a3758e5622b405a41c1b0e1295f6ee396f8d8032dd0c16b54408aa0'],
  ['chunk-02.txt', 18_000, 'fa698d4e4be37674e7f7fe88fd84953f0c84ccd37ebfde48a22b9d82b1a72bc5'],
  ['chunk-03.txt', 18_000, '13313caed9ff8413b962e4d0c82a732b13768a2b4532d5ab8db2e5cc93b19e5b'],
  ['chunk-04.txt', 18_000, 'c268144784740633ce70381b56bdd52eea9587b218b8ad2db04f169b387292f3'],
  ['chunk-05.txt', 8_660, '90689e27835479128179ebf15d244343bfd64c512d5a5c47ceca956d37a54c6d']
]);
const knownTransportRepairs = Object.freeze({
  'chunk-00.txt': {
    length: 5_998,
    sha256: '3785676517748374a8ccfb80aa308a0d914cdfa4ea42cfce4f14a1755d8ba666',
    offset: 4_398,
    text: 'an'
  }
});
const expectedFiles = Object.freeze({
  'safe-body.png': {
    bytes: 42_449,
    width: 432,
    height: 561,
    sha256: '96128cc36a50ee38b743b08fad7cafb59552eabbc3e610f134002abbdf4129ec'
  },
  'dial-face.png': {
    bytes: 13_498,
    width: 226,
    height: 226,
    sha256: '1eec8dab3287dfd47e881fec3adcaec1be66d45f5f687e8c9508b885f57a648e'
  }
});
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function fail(message) {
  throw new Error(`Safe Cracker PNG asset reconstruction failed: ${message}`);
}
function digest(data) {
  return createHash('sha256').update(data).digest('hex');
}

const encodedChunks = [];
for (const [name, expectedLength, expectedDigest] of expectedChunks) {
  let text = (await readFile(new URL(name, chunkDirectoryUrl), 'utf8')).replace(/\s+/g, '');
  const repair = knownTransportRepairs[name];
  if (repair && text.length === repair.length && digest(text) === repair.sha256) {
    text = text.slice(0, repair.offset) + repair.text + text.slice(repair.offset);
  }
  if (text.length !== expectedLength) fail(`${name} has ${text.length} characters; expected ${expectedLength}`);
  if (digest(text) !== expectedDigest) fail(`${name} checksum does not match the verified complete artwork bundle`);
  encodedChunks.push(text);
}

const bundle = Buffer.from(encodedChunks.join(''), 'base64');
const magic = Buffer.from('SCPNG6\n', 'ascii');
let offset = 0;
if (!bundle.subarray(0, magic.length).equals(magic)) fail('bundle header is invalid');
offset += magic.length;
if (offset + 2 > bundle.length) fail('bundle file count is missing');
const fileCount = bundle.readUInt16BE(offset);
offset += 2;
if (fileCount !== Object.keys(expectedFiles).length) fail(`expected 2 files, found ${fileCount}`);

const decoded = new Map();
for (let index = 0; index < fileCount; index += 1) {
  if (offset + 2 > bundle.length) fail(`entry ${index + 1} name length is missing`);
  const nameLength = bundle.readUInt16BE(offset);
  offset += 2;
  if (!nameLength || offset + nameLength + 4 > bundle.length) fail(`entry ${index + 1} name is invalid`);
  const name = bundle.subarray(offset, offset + nameLength).toString('utf8');
  offset += nameLength;
  const dataLength = bundle.readUInt32BE(offset);
  offset += 4;
  const expectation = expectedFiles[name];
  if (!expectation) fail(`unexpected file ${name}`);
  if (decoded.has(name)) fail(`duplicate file ${name}`);
  if (dataLength !== expectation.bytes || offset + dataLength > bundle.length) fail(`${name} length is invalid`);
  const data = Buffer.from(bundle.subarray(offset, offset + dataLength));
  offset += dataLength;
  if (!data.subarray(0, pngSignature.length).equals(pngSignature)) fail(`${name} has an invalid PNG signature`);
  const width = data.readUInt32BE(16);
  const height = data.readUInt32BE(20);
  if (width !== expectation.width || height !== expectation.height) fail(`${name} dimensions changed to ${width}x${height}`);
  if (digest(data) !== expectation.sha256) fail(`${name} checksum does not match the complete supplied artwork`);
  decoded.set(name, data);
}
if (offset !== bundle.length) fail(`${bundle.length - offset} trailing bytes remain`);
for (const name of Object.keys(expectedFiles)) if (!decoded.has(name)) fail(`${name} is missing`);

await mkdir(outputDirectoryUrl, { recursive: true });
for (const [name, data] of decoded) await writeFile(new URL(name, outputDirectoryUrl), data);

console.log('Reconstructed the complete verified Safe Cracker body and dial from the SCPNG6 artwork bundle.');
