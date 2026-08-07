import { writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const rootUrl = new URL('../', import.meta.url);
const patchEntry = new URL('scripts/patch-mountain-race-generated-assets-v29.mjs', rootUrl);
const validatorEntry = new URL('scripts/validate-mountain-race-generated-assets-v29.mjs', rootUrl);

// Netlify/CI build handoff only: keep historical tracked V29 entry files intact in Git,
// but route this build workspace to the final verified implementation before npm build.
await writeFile(patchEntry, "await import('./patch-mountain-race-generated-assets-v29-final.mjs');\n");
await writeFile(validatorEntry, "await import('./validate-mountain-race-generated-assets-v29-final.mjs');\n");

const result = spawnSync('npm', ['run', 'build'], {
  cwd: new URL('.', rootUrl),
  stdio: 'inherit',
  shell: process.platform === 'win32'
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);

await import('./validate-mountain-race-generated-assets-v29-final.mjs');
console.log('Summit Sprint V29 Netlify handoff build completed with final generated assets.');
