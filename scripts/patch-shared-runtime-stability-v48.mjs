import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const indexUrl = new URL('index.html', root);
const openingAudioUrl = new URL('assets/roulette/opening-spin-sync.js', root);
const marker = 'SHARED_RUNTIME_STABILITY_V48';

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Shared runtime V48 could not find ${label}.`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Shared runtime V48 found more than one ${label}.`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

let [html, openingAudio] = await Promise.all([
  readFile(indexUrl, 'utf8'),
  readFile(openingAudioUrl, 'utf8')
]);

openingAudio = openingAudio.replaceAll(
  'baseVolume = Math.max(0, Number(clip.volume) || 0);',
  'baseVolume = clamp(Number(clip.volume) || 0, 0, 1);'
);
openingAudio = replaceOnce(
  openingAudio,
  'clip.volume = baseVolume * openingVolumeEnvelope(progress);',
  `// ${marker}\n      clip.volume = clamp(baseVolume * openingVolumeEnvelope(progress), 0, 1);`,
  'opening-spin volume assignment'
);

if (!openingAudio.includes('baseVolume = clamp(Number(clip.volume) || 0, 0, 1);')) {
  throw new Error('Shared runtime V48 did not clamp the opening-spin base volume.');
}

const oldFocusedCatch = `          } catch (error) {
            focusedGetFailed = true;
            // Never tear down or replace an active board because one poll was
            // delayed or failed. Keep the newest accepted focused snapshot.
            if (duelLastActiveGame && String(duelLastActiveGame.gameId) === String(duelCurrentGameId)) {
              active = duelLastActiveGame;
            }
            console.warn("DRAW focused refresh failed; retaining current game", error?.message || error);
          }`;

const newFocusedCatch = `          } catch (error) {
            // ${marker}
            const focusedMessage = String(error?.message || error || "");
            const focusedMissing = /duel was not found/i.test(focusedMessage);
            if (focusedMissing) {
              // A confirmed missing game is terminal, not a transient polling
              // failure. Clear the persisted focus so deleted/completed races
              // cannot keep retrying or remounting a stale result snapshot.
              const missingGameId = String(duelCurrentGameId || "");
              duelKnownRevisionByGame.delete(missingGameId);
              duelAcceptedStatusByGame.delete(missingGameId);
              duelRememberCurrentGame("");
              duelLastActiveGame = null;
              active = null;
              console.info("Focused duel no longer exists; returned to the lobby.");
            } else {
              focusedGetFailed = true;
              // Preserve the newest accepted board for genuinely transient
              // network failures without mislabelling every mode as DRAW.
              if (duelLastActiveGame && String(duelLastActiveGame.gameId) === String(duelCurrentGameId)) {
                active = duelLastActiveGame;
              }
              console.warn("Focused duel refresh failed; retaining current game", focusedMessage);
            }
          }`;

html = replaceOnce(html, oldFocusedCatch, newFocusedCatch, 'focused-duel refresh catch');
html = html.replaceAll(
  '/assets/roulette/opening-spin-sync.js?v=5&trim=1',
  '/assets/roulette/opening-spin-sync.js?v=6&trim=1&clamp=1'
);

if (!html.includes('/assets/roulette/opening-spin-sync.js?v=6&trim=1&clamp=1')) {
  throw new Error('Shared runtime V48 did not install the opening-spin cache boundary.');
}

await Promise.all([
  writeFile(indexUrl, html),
  writeFile(openingAudioUrl, openingAudio)
]);

console.log('Applied shared runtime V48 stability: opening-spin volume is bounded and confirmed-missing focused games return cleanly to the lobby.');
