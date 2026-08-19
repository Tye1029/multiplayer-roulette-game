import { readFile, writeFile } from 'node:fs/promises';

const indexUrl = new URL('../index.html', import.meta.url);
let html = await readFile(indexUrl, 'utf8');

const before = "else if(openingConcealed){status='CHOOSING FIRST PLAYER';sub='The revolver is spinning. The starting player stays hidden until it stops.';controlNote='Choosing first player…';}";
const after = "else if(openingConcealed){status='';sub='';controlNote='';}";
const keptBanner = '<div class="rr-opening-banner">Choosing First Player</div>';

if (!html.includes(after)) {
  const first = html.indexOf(before);
  if (first < 0) throw new Error('Roulette opening copy patch could not find the duplicate top status.');
  if (html.indexOf(before, first + before.length) >= 0) {
    throw new Error('Roulette opening copy patch found more than one duplicate top status.');
  }
  html = html.slice(0, first) + after + html.slice(first + before.length);
}

if (html.includes('The revolver is spinning. The starting player stays hidden until it stops.')) {
  throw new Error('The top revolver-spinning message remains in the generated page.');
}
if (!html.includes(keptBanner)) {
  throw new Error('The black-box Choosing First Player banner was removed unexpectedly.');
}
if (!html.includes(after)) {
  throw new Error('The duplicate top Choosing First Player status was not removed.');
}

await writeFile(indexUrl, html);
console.log('Removed the duplicate top opening text while preserving the black-box Choosing First Player banner.');
