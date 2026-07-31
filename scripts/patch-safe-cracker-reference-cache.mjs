import { readFile, writeFile } from 'node:fs/promises';

const indexUrl = new URL('../index.html', import.meta.url);
let html = await readFile(indexUrl, 'utf8');

const cssBefore = '/assets/safe-cracker/safe-cracker.css?v=8&polish=2&fit=2&result=1&final=1&refine=1&correct=1&input=1';
const cssAfter = cssBefore + '&reference=1';
if (!html.includes(cssAfter)) html = html.replaceAll(cssBefore, cssAfter);

if (!html.includes('&audio=1&samples=1&stability=1&reference=1')) {
  throw new Error('Safe Cracker reference cache patch requires the reference visual JavaScript version first.');
}
if (!html.includes(cssAfter)) {
  throw new Error('Safe Cracker reference cache patch could not version the reference visual stylesheet.');
}

await writeFile(indexUrl, html);
console.log('Versioned the Safe Cracker reference visual CSS and JavaScript assets for reliable mobile refreshes.');
