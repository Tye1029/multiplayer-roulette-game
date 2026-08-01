import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const rootUrl = new URL('../', import.meta.url);
const assetDirectoryUrl = new URL('assets/safe-cracker/png-ui/', rootUrl);
const expectedAssets = Object.freeze({
  'safe-body.png': {
    width: 432,
    height: 561,
    gitBlobSha1: 'dd55e63a55b3d6933e5d3e8819bf3c0d71154cdd'
  },
  'dial-face.png': {
    width: 170,
    height: 170,
    gitBlobSha1: '7a6a2d5cfc0657be041862a36c1db074d7c35d86'
  }
});
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function fail(message) {
  throw new Error(`Safe Cracker PNG asset validation failed: ${message}`);
}
function gitBlobSha1(data) {
  return createHash('sha1')
    .update(Buffer.from(`blob ${data.length}\0`, 'utf8'))
    .update(data)
    .digest('hex');
}

for (const [name, expected] of Object.entries(expectedAssets)) {
  const data = await readFile(new URL(name, assetDirectoryUrl));
  if (data.length < 24 || !data.subarray(0, pngSignature.length).equals(pngSignature)) {
    fail(`${name} has an invalid PNG signature`);
  }
  const width = data.readUInt32BE(16);
  const height = data.readUInt32BE(20);
  if (width !== expected.width || height !== expected.height) {
    fail(`${name} dimensions changed to ${width}x${height}`);
  }
  if (gitBlobSha1(data) !== expected.gitBlobSha1) {
    fail(`${name} does not match the directly committed reference asset`);
  }
}

console.log('Verified directly committed Safe Cracker PNG layers.');
