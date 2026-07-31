import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const rootUrl = new URL('../', import.meta.url);
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const expected = Object.freeze({
  'safe-body.png': {
    bytes: 14233,
    sha256: 'e22b685648785a0e829235a37774802b9ed4f48bcabead86abc726748ac71eba'
  },
  'dial-face.png': {
    bytes: 7772,
    sha256: 'c23d03bd2bba8c9d0ca1b6e7091fd3c29ef887296d6147226da33081140aca33'
  }
});

function fail(message) {
  throw new Error(`Safe Cracker PNG asset validation failed: ${message}`);
}

for (const [name, expectation] of Object.entries(expected)) {
  const data = await readFile(new URL(`assets/safe-cracker/png-ui/${name}`, rootUrl));
  if (data.length !== expectation.bytes) {
    fail(`${name} has ${data.length.toLocaleString('en-US')} bytes; expected ${expectation.bytes.toLocaleString('en-US')}`);
  }
  if (!data.subarray(0, pngSignature.length).equals(pngSignature)) {
    fail(`${name} does not have a valid PNG signature`);
  }
  const digest = createHash('sha256').update(data).digest('hex');
  if (digest !== expectation.sha256) {
    fail(`${name} SHA-256 is ${digest}; expected ${expectation.sha256}`);
  }
}

console.log('Verified directly committed Safe Cracker PNG layers: supplied safe body and independently rotating dial face.');
