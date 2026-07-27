import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const obsoleteLampFiles = [
  new URL('../assets/roulette/decor/workshop-lamp-body-game-small-2.png', import.meta.url)
];
const removed = [];

for (const fileUrl of obsoleteLampFiles) {
  const filePath = fileURLToPath(fileUrl);
  try {
    await rm(filePath, { force: true });
    removed.push(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

console.log(removed.length
  ? `Removed confirmed obsolete lamp files: ${removed.join(', ')}`
  : 'No confirmed obsolete lamp files remained.');
