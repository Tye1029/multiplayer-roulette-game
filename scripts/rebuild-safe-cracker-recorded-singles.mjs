import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const recordings = Object.freeze([
  {
    name: 'submit',
    chunks: ['submit-1.b64', 'submit-2.b64'],
    output: 'submit-mechanism.b64',
    bytes: 3104,
    sha256: '6ba8244a330907ba20c5cff48d5725a1e9b81d37165b7d150f57e96e583151ab'
  },
  {
    name: 'incorrect',
    chunks: ['incorrect-1.b64', 'incorrect-2.b64'],
    output: 'incorrect-number.b64',
    bytes: 3281,
    sha256: '2a09cc9abdc736be9a0820f4e5b2e9d378bf9b3a5b7f9a0766dafeca20126307'
  },
  {
    name: 'latch',
    chunks: ['latch-open-1.b64', 'latch-open-2.b64', 'latch-open-3.b64'],
    output: 'correct-latch-open.b64',
    bytes: 6258,
    sha256: '368b8e8fe5f6b7795ffbe5754d1ab0cf695a2c75d57f518f5c0e0ec95064798d'
  }
]);

for (const recording of recordings) {
  const chunks = await Promise.all(recording.chunks.map(file =>
    readFile(new URL(`assets/safe-cracker/audio-data-v13/${file}`, root), 'utf8')
  ));
  const encoded = chunks.join('').replace(/\s+/g, '');
  const decoded = Buffer.from(encoded, 'base64');
  const hash = createHash('sha256').update(decoded).digest('hex');
  if (decoded.length !== recording.bytes) {
    throw new Error(`${recording.name} recording rebuilt to ${decoded.length} bytes, expected ${recording.bytes}.`);
  }
  if (hash !== recording.sha256) {
    throw new Error(`${recording.name} recording checksum ${hash} did not match ${recording.sha256}.`);
  }
  await writeFile(new URL(`assets/safe-cracker/audio-data-v2/${recording.output}`, root), encoded);
}

console.log('Rebuilt the submit, incorrect-number, and latch recordings byte-for-byte from transport-safe chunks.');
