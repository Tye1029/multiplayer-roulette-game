import { spawnSync } from 'node:child_process';

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
  return result.status === 0;
}

console.log('Running the full validated Roulette build.');
const built = run('npm', ['run', 'build']);

if (built) {
  console.log('Full validated build completed.');
  process.exit(0);
}

console.warn('The generated build failed. Restoring committed files and deploying the edge-injected Scene Settings fallback.');
const restored = run('git', ['reset', '--hard', 'HEAD']);
if (!restored) {
  console.error('Could not restore the clean committed site after the generated build failed.');
  process.exit(1);
}

run('git', ['clean', '-fd']);
console.log('Committed static site restored. Netlify can publish it with the edge settings fallback.');
