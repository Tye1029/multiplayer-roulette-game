import { readFile, writeFile } from 'node:fs/promises';

const indexUrl = new URL('../index.html', import.meta.url);
let html = await readFile(indexUrl, 'utf8');

// The old adjustable-smoke override loaded after every stylesheet and could
// reduce or cancel the permanent smoke. Remove it; smoke.css is authoritative.
html = html.replace(
  /\s*<style\b[^>]*\bid=["']rr-v153-adjustable-smoke-priority["'][^>]*>[\s\S]*?<\/style>\s*/gi,
  '\n'
);

await writeFile(indexUrl, html);
console.log('Removed obsolete adjustable-smoke override; permanent smoke.css is authoritative.');
