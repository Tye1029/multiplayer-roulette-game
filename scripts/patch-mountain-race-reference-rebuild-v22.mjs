import { readFile, writeFile } from 'node:fs/promises';

const rootUrl = new URL('../', import.meta.url);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', rootUrl);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', rootUrl);
const indexUrl = new URL('index.html', rootUrl);
const marker = 'MOUNTAIN_RACE_REFERENCE_REBUILD_V22';

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint Reference Rebuild V22 could not find ${label}.`);
  return source.replace(before, after);
}

let [css, runtime, html] = await Promise.all([
  readFile(cssUrl, 'utf8'),
  readFile(runtimeUrl, 'utf8'),
  readFile(indexUrl, 'utf8')
]);

if (!runtime.includes(marker)) {
  const runtimePatch = String.raw`

// MOUNTAIN_RACE_REFERENCE_REBUILD_V22
// Rebuild the approved concept art as crisp, aspect-correct PNG terrain tiles.
// V21 stretched one tall crop across the complete scrolling wall; V22 instead
// stacks square photographic rock sections, preserving detail at phone scale.
function ensureReferenceRebuildV22(root) {
  if (!root) return;
  root.dataset.mrReferenceRebuild = '22';

  const install = atlas => {
    if (!atlas || !root?.style) return;
    root.style.setProperty('--mr-v22-left-terrain', 'url("' + atlas.leftTerrain + '")');
    root.style.setProperty('--mr-v22-right-terrain', 'url("' + atlas.rightTerrain + '")');
    root.style.setProperty('--mr-v22-grass', 'url("' + atlas.grass + '")');
    root.dataset.mrReferenceRebuildReady = '1';
  };

  if (window.__mountainRaceReferenceRebuildV22) {
    install(window.__mountainRaceReferenceRebuildV22);
    return;
  }

  if (!window.__mountainRaceReferenceRebuildV22Promise) {
    window.__mountainRaceReferenceRebuildV22Promise = new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => {
        try {
          const W = image.naturalWidth || image.width;
          const H = image.naturalHeight || image.height;
          if (!W || !H) throw new Error('reference image has no dimensions');

          // Coordinate helpers are normalized from the approved 896x1536 concept,
          // but scale against the real source dimensions at runtime.
          const sx = value => Math.round((value / 896) * W);
          const sy = value => Math.round((value / 1536) * H);
          const sw = value => Math.max(1, Math.round((value / 896) * W));
          const sh = value => Math.max(1, Math.round((value / 1536) * H));

          const makeTerrain = (side = 'left') => {
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 2048;
            const ctx = canvas.getContext('2d', { alpha: false });
            if (!ctx) throw new Error('terrain canvas unavailable');

            const leftX = 70;
            const rightX = 530;
            const x = side === 'left' ? leftX : rightX;
            const otherX = side === 'left' ? rightX : leftX;
            const crops = [
              [x, 150, 290, 290, false],
              [x, 430, 290, 290, true],
              [otherX, 205, 290, 290, side === 'left'],
              [x, 555, 290, 290, side !== 'left']
            ];

            ctx.fillStyle = '#75634c';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.filter = 'brightness(1.20) contrast(1.08) saturate(.88)';

            crops.forEach(([cx, cy, cw, ch, mirror], index) => {
              const dy = index * 512;
              ctx.save();
              if (mirror) {
                ctx.translate(512, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(image, sx(cx), sy(cy), sw(cw), sh(ch), 0, dy, 512, 512);
              } else {
                ctx.drawImage(image, sx(cx), sy(cy), sw(cw), sh(ch), 0, dy, 512, 512);
              }
              ctx.restore();
            });
            ctx.filter = 'none';

            // Directional daylight and localized crevice depth without blackening
            // the entire cliff face.
            const sun = ctx.createLinearGradient(0, 0, 512, 2048);
            sun.addColorStop(0, 'rgba(255,238,197,.19)');
            sun.addColorStop(.28, 'rgba(255,232,188,.045)');
            sun.addColorStop(.72, 'rgba(20,18,14,.025)');
            sun.addColorStop(1, 'rgba(8,9,7,.13)');
            ctx.fillStyle = sun;
            ctx.fillRect(0, 0, 512, 2048);

            const rim = ctx.createLinearGradient(0, 0, 512, 0);
            rim.addColorStop(0, 'rgba(20,19,15,.18)');
            rim.addColorStop(.08, 'rgba(0,0,0,0)');
            rim.addColorStop(.88, 'rgba(0,0,0,0)');
            rim.addColorStop(1, 'rgba(8,9,7,.24)');
            ctx.fillStyle = rim;
            ctx.fillRect(0, 0, 512, 2048);

            return canvas.toDataURL('image/png');
          };

          const makeGrass = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 768;
            canvas.height = 190;
            const ctx = canvas.getContext('2d', { alpha: false });
            if (!ctx) throw new Error('grass canvas unavailable');

            // Clean strips from both platforms avoid the baked climbers while keeping
            // the real grass, dirt and small flowers from the approved reference.
            const strips = [
              [104, 930, 82, 150],
              [318, 930, 42, 150],
              [530, 930, 72, 150],
              [720, 930, 70, 150]
            ];
            ctx.fillStyle = '#4b3d2b';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.filter = 'brightness(1.08) contrast(1.05) saturate(.88)';

            const tileW = 96;
            for (let x = 0, i = 0; x < canvas.width; x += tileW, i += 1) {
              const strip = strips[i % strips.length];
              ctx.save();
              if (i % 2) {
                ctx.translate(x + tileW, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(image, sx(strip[0]), sy(strip[1]), sw(strip[2]), sh(strip[3]), 0, 0, tileW + 1, canvas.height);
              } else {
                ctx.drawImage(image, sx(strip[0]), sy(strip[1]), sw(strip[2]), sh(strip[3]), x, 0, tileW + 1, canvas.height);
              }
              ctx.restore();
            }
            ctx.filter = 'none';

            const light = ctx.createLinearGradient(0, 0, 0, canvas.height);
            light.addColorStop(0, 'rgba(255,239,194,.16)');
            light.addColorStop(.42, 'rgba(255,239,194,0)');
            light.addColorStop(1, 'rgba(16,14,10,.13)');
            ctx.fillStyle = light;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            return canvas.toDataURL('image/png');
          };

          const atlas = {
            leftTerrain: makeTerrain('left'),
            rightTerrain: makeTerrain('right'),
            grass: makeGrass()
          };
          window.__mountainRaceReferenceRebuildV22 = atlas;
          resolve(atlas);
        } catch (error) {
          reject(error);
        }
      };
      image.onerror = () => reject(new Error('V22 reference image failed to load'));
      image.src = 'assets/mountain-race/images/summit-sprint-reference-v21.jpg?reference=22';
    }).catch(error => {
      console.warn('[Summit Sprint V22] reference terrain fallback active:', error);
      return null;
    });
  }

  window.__mountainRaceReferenceRebuildV22Promise.then(install);
}
`;

  runtime += runtimePatch;
  runtime = replaceRequired(
    runtime,
    '    ensureReferenceAtlasV21(root);',
    "    ensureReferenceAtlasV21(root);\n    ensureReferenceRebuildV22(root);",
    'V21 reference installation'
  );
}

if (!css.includes(marker)) {
  css += String.raw`

/* MOUNTAIN_RACE_REFERENCE_REBUILD_V22
   Corrects V21's vertically stretched photographic crop. Rock is now rendered
   at its natural aspect ratio as repeating PNG terrain, with real ledge bodies
   restored beneath the live directional controls. */

[data-mountain-race-mount][data-mr-reference-rebuild="22"] .mr-climb-viewport {
  padding-inline: clamp(10px, 2.2vw, 16px) !important;
  background: linear-gradient(180deg, #8cc8df 0%, #6aa9c3 50%, #416f7d 100%) !important;
}

[data-mountain-race-mount][data-mr-reference-rebuild="22"] .mr-climb-viewport::before {
  content: '' !important;
  position: absolute !important;
  inset: 0 !important;
  z-index: 9 !important;
  pointer-events: none !important;
  background:
    radial-gradient(circle at 10% 3%, rgba(255,244,205,.20), transparent 27%),
    linear-gradient(105deg, rgba(255,236,195,.07), transparent 36%, rgba(4,8,7,.04) 100%) !important;
  mix-blend-mode: normal !important;
  opacity: 1 !important;
}

[data-mountain-race-mount][data-mr-reference-rebuild="22"] .mr-climb-viewport::after {
  content: none !important;
}

[data-mountain-race-mount][data-mr-reference-rebuild="22"] .mr-lanes,
[data-mountain-race-mount][data-mr-reference-rebuild="22"] .mr-race-lanes,
[data-mountain-race-mount][data-mr-reference-rebuild="22"] .mr-lane-grid {
  width: 100% !important;
  max-width: 100% !important;
  margin-inline: auto !important;
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  gap: clamp(8px, 2vw, 14px) !important;
  justify-content: center !important;
}

[data-mountain-race-mount][data-mr-reference-rebuild="22"] .mr-lane {
  width: 100% !important;
  min-width: 0 !important;
  margin: 0 !important;
  justify-self: stretch !important;
  overflow: hidden !important;
}

[data-mountain-race-mount][data-mr-reference-rebuild="22"] .mr-mountain-wall {
  left: 0 !important;
  right: 0 !important;
  width: 100% !important;
  margin: 0 !important;
  background-color: #76624a !important;
  background-image:
    linear-gradient(108deg, rgba(255,237,198,.08) 0%, transparent 35%, rgba(8,9,7,.09) 100%),
    var(--mr-v22-left-terrain, var(--mr-cliff-detail-v19)) !important;
  background-size: 100% 100%, 100% auto !important;
  background-position: center top, center top !important;
  background-repeat: no-repeat, repeat-y !important;
  filter: brightness(1.08) contrast(1.04) saturate(.94) !important;
  box-shadow:
    inset 10px 0 20px rgba(255,232,186,.055),
    inset -14px 0 23px rgba(5,7,6,.16) !important;
}

[data-mountain-race-mount][data-mr-reference-rebuild="22"] .mr-lane.opponent .mr-mountain-wall {
  background-image:
    linear-gradient(108deg, rgba(255,237,198,.07) 0%, transparent 36%, rgba(8,9,7,.10) 100%),
    var(--mr-v22-right-terrain, var(--mr-cliff-detail-v19)) !important;
  background-size: 100% 100%, 100% auto !important;
  background-position: center top, center top !important;
  background-repeat: no-repeat, repeat-y !important;
}

[data-mountain-race-mount][data-mr-reference-rebuild="22"] .mr-mountain-wall::before {
  background:
    radial-gradient(ellipse at 18% 5%, rgba(255,238,195,.11), transparent 32%),
    linear-gradient(104deg, rgba(255,229,184,.045), transparent 34%, rgba(4,7,6,.07) 100%) !important;
  mix-blend-mode: normal !important;
  opacity: 1 !important;
}

[data-mountain-race-mount][data-mr-reference-rebuild="22"] .mr-mountain-wall::after {
  background:
    linear-gradient(90deg, rgba(0,0,0,.10), transparent 7%, transparent 92%, rgba(0,0,0,.14)) !important;
  opacity: 1 !important;
}

/* Restore visible physical rock ledges. Only the arrow itself is hidden for
   unrevealed future prompts, matching the approved reference composition. */
[data-mountain-race-mount][data-mr-reference-rebuild="22"] .mr-rock-hold {
  width: 78px !important;
  height: 52px !important;
  border: 0 !important;
  border-radius: 0 !important;
  background-color: transparent !important;
  background-image: var(--mr-ledge-sprite-v19) !important;
  background-size: 600% 100% !important;
  background-repeat: no-repeat !important;
  box-shadow: none !important;
  filter: saturate(.72) brightness(.88) contrast(1.10) drop-shadow(5px 7px 5px rgba(4,5,4,.38)) !important;
  opacity: .97 !important;
}

[data-mountain-race-mount][data-mr-reference-rebuild="22"] .mr-rock-hold:nth-of-type(6n + 1) { background-position: 0% 50% !important; }
[data-mountain-race-mount][data-mr-reference-rebuild="22"] .mr-rock-hold:nth-of-type(6n + 2) { background-position: 20% 50% !important; }
[data-mountain-race-mount][data-mr-reference-rebuild="22"] .mr-rock-hold:nth-of-type(6n + 3) { background-position: 40% 50% !important; }
[data-mountain-race-mount][data-mr-reference-rebuild="22"] .mr-rock-hold:nth-of-type(6n + 4) { background-position: 60% 50% !important; }
[data-mountain-race-mount][data-mr-reference-rebuild="22"] .mr-rock-hold:nth-of-type(6n + 5) { background-position: 80% 50% !important; }
[data-mountain-race-mount][data-mr-reference-rebuild="22"] .mr-rock-hold:nth-of-type(6n) { background-position: 100% 50% !important; }

[data-mountain-race-mount][data-mr-reference-rebuild="22"] .mr-rock-hold.unknown {
  opacity: .92 !important;
}

[data-mountain-race-mount][data-mr-reference-rebuild="22"] .mr-rock-hold.unknown b {
  display: none !important;
}

[data-mountain-race-mount][data-mr-reference-rebuild="22"] .mr-rock-hold b {
  display: grid;
  place-items: center;
  width: 31px !important;
  height: 31px !important;
  margin: 9px auto 0 !important;
  border-radius: 50% !important;
  border: 1px solid rgba(225,216,193,.55) !important;
  background:
    radial-gradient(circle at 34% 24%, rgba(255,255,255,.17), transparent 34%),
    linear-gradient(180deg, rgba(25,29,27,.94), rgba(7,10,9,.98)) !important;
  box-shadow: 0 5px 8px rgba(0,0,0,.50), inset 0 1px 0 rgba(255,255,255,.11) !important;
  filter: none !important;
}

[data-mountain-race-mount][data-mr-reference-rebuild="22"] .mr-rock-hold.current {
  filter: saturate(.80) brightness(.96) contrast(1.10) drop-shadow(5px 7px 5px rgba(4,5,4,.40)) drop-shadow(0 0 9px rgba(255,181,54,.42)) !important;
}

[data-mountain-race-mount][data-mr-reference-rebuild="22"] .mr-lane.opponent .mr-rock-hold.current {
  filter: saturate(.78) brightness(.94) contrast(1.10) drop-shadow(5px 7px 5px rgba(4,5,4,.40)) drop-shadow(0 0 9px rgba(72,184,245,.36)) !important;
}

[data-mountain-race-mount][data-mr-reference-rebuild="22"] .mr-start-ledge,
[data-mountain-race-mount][data-mr-reference-rebuild="22"] .mr-finish-ledge {
  left: 50% !important;
  right: auto !important;
  width: min(84%, 292px) !important;
  max-width: calc(100% - 18px) !important;
  margin: 0 !important;
  transform: translateX(-50%) !important;
  border-radius: 18px 18px 14px 14px !important;
  background-image:
    linear-gradient(180deg, rgba(255,239,197,.05), rgba(9,12,8,.10)),
    var(--mr-v22-grass, var(--mr-grass-detail-v19)) !important;
  background-size: 100% 100%, cover !important;
  background-position: center !important;
  background-repeat: no-repeat !important;
  box-shadow:
    0 13px 18px rgba(3,7,5,.34),
    inset 0 1px 0 rgba(255,239,199,.12),
    inset 0 -10px 15px rgba(4,7,5,.18) !important;
}

[data-mountain-race-mount][data-mr-reference-rebuild="22"] .mr-start-ledge::before,
[data-mountain-race-mount][data-mr-reference-rebuild="22"] .mr-finish-ledge::before {
  content: none !important;
  display: none !important;
  animation: none !important;
}

[data-mountain-race-mount][data-mr-reference-rebuild="22"] .mr-start-ledge::after,
[data-mountain-race-mount][data-mr-reference-rebuild="22"] .mr-finish-ledge::after {
  content: '' !important;
  position: absolute !important;
  left: 14% !important;
  right: 14% !important;
  bottom: -7px !important;
  height: 14px !important;
  border-radius: 50% !important;
  background: radial-gradient(ellipse, rgba(0,0,0,.30), transparent 70%) !important;
}

[data-mountain-race-mount][data-mr-reference-rebuild="22"] .mr-route-rope {
  opacity: .28 !important;
  filter: sepia(.72) brightness(.78) contrast(1.12) drop-shadow(2px 2px 2px rgba(0,0,0,.42)) !important;
}

[data-mountain-race-mount][data-mr-reference-rebuild="22"] .mr-climber {
  z-index: 12 !important;
  filter:
    drop-shadow(5px 8px 5px rgba(3,5,4,.39))
    drop-shadow(-1px -1px 1px rgba(255,232,190,.10)) !important;
}

[data-mountain-race-mount][data-mr-reference-rebuild="22"] .mr-command-deck {
  width: calc(100% - clamp(18px, 4vw, 30px)) !important;
  max-width: 620px !important;
  margin-inline: auto !important;
  left: auto !important;
  right: auto !important;
  box-sizing: border-box !important;
}

@media (max-width: 720px) {
  [data-mountain-race-mount][data-mr-reference-rebuild="22"] .mr-climb-viewport {
    padding-inline: 8px !important;
  }

  [data-mountain-race-mount][data-mr-reference-rebuild="22"] .mr-lanes,
  [data-mountain-race-mount][data-mr-reference-rebuild="22"] .mr-race-lanes,
  [data-mountain-race-mount][data-mr-reference-rebuild="22"] .mr-lane-grid {
    gap: 7px !important;
  }

  [data-mountain-race-mount][data-mr-reference-rebuild="22"] .mr-rock-hold {
    width: 70px !important;
    height: 48px !important;
  }

  [data-mountain-race-mount][data-mr-reference-rebuild="22"] .mr-start-ledge,
  [data-mountain-race-mount][data-mr-reference-rebuild="22"] .mr-finish-ledge {
    width: 82% !important;
    max-width: calc(100% - 12px) !important;
  }
}
`;
}

html = html.replace(/mountain-race-multiplayer\.js\?([^"']*)/g, (full, query) => full.includes('referenceRebuild=22') ? full : `mountain-race-multiplayer.js?${query}&referenceRebuild=22`);
html = html.replace(/mountain-race\.css\?([^"']*)/g, (full, query) => full.includes('referenceRebuild=22') ? full : `mountain-race.css?${query}&referenceRebuild=22`);

await Promise.all([
  writeFile(cssUrl, css),
  writeFile(runtimeUrl, runtime),
  writeFile(indexUrl, html)
]);

console.log('Applied Summit Sprint Reference Rebuild V22: crisp aspect-correct photographic rock tiles, restored physical ledges, natural grass and centered mobile composition.');
