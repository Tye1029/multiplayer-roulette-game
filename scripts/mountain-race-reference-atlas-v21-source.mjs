import part1 from './mountain-race-reference-atlas-v21-part1.mjs';
import part2 from './mountain-race-reference-atlas-v21-part2.mjs';
import part3 from './mountain-race-reference-atlas-v21-part3.mjs';
import part4 from './mountain-race-reference-atlas-v21-part4.mjs';
import part5 from './mountain-race-reference-atlas-v21-part5.mjs';
import part6 from './mountain-race-reference-atlas-v21-part6.mjs';
import part7 from './mountain-race-reference-atlas-v21-part7.mjs';
import part8 from './mountain-race-reference-atlas-v21-part8.mjs';
import part9 from './mountain-race-reference-atlas-v21-part9.mjs';

const referenceBase64 = [
  part1,
  part2,
  part3,
  part4,
  part5,
  part6,
  part7,
  part8,
  part9
].join('').replace(/\s+/g, '');

if (!referenceBase64.startsWith('/9j/') || referenceBase64.length <= 50000) {
  throw new Error('Summit Sprint V21 reference source is incomplete.');
}

export default referenceBase64;
