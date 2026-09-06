import { readFile, writeFile } from 'node:fs/promises';
import referenceBase64 from './mountain-race-reference-atlas-v21-source.mjs';

const rootUrl = new URL('../', import.meta.url);
const cssUrl = new URL('assets/mountain-race/mountain-race.css', rootUrl);
const runtimeUrl = new URL('assets/mountain-race/mountain-race-multiplayer.js', rootUrl);
const indexUrl = new URL('index.html', rootUrl);
const sourceImageUrl = new URL('assets/mountain-race/images/summit-sprint-reference-v21.jpg', rootUrl);
const marker = 'MOUNTAIN_RACE_REFERENCE_ATLAS_V21';

function assert(condition, message) {
  if (!condition) throw new Error(`Summit Sprint Reference Atlas V21 patch failed: ${message}`);
}

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`Summit Sprint Reference Atlas V21 could not find ${label}.`);
  return source.replace(before, after);
}

assert(typeof referenceBase64 === 'string' && referenceBase64.length > 50000, 'reference source is missing or too small');
const sourceBytes = Buffer.from(referenceBase64.replace(/\s+/g, ''), 'base64');
assert(sourceBytes.length > 30000, 'decoded reference image is unexpectedly small');
assert(sourceBytes[0] === 0xff && sourceBytes[1] === 0xd8, 'reference source is not a JPEG');
await writeFile(sourceImageUrl, sourceBytes);

let [css, runtime, html] = await Promise.all([
  readFile(cssUrl, 'utf8'),
  readFile(runtimeUrl, 'utf8'),
  readFile(indexUrl, 'utf8')
]);

if (!runtime.includes(marker)) {
  runtime = replaceRequired(
    runtime,
    '  // MOUNTAIN_RACE_SCREENSHOT_BASE_V20',
    `  // MOUNTAIN_RACE_SCREENSHOT_BASE_V20\n  // ${marker}`,
    'V20 runtime marker'
  );

  const atlasRuntime = String.raw`

// MOUNTAIN_RACE_REFERENCE_ATLAS_V21
// The approved concept image is kept as a build artifact. The browser crops it once
// into PNG data URLs so the live game uses clean mountain/grass PNG layers while
// climbers, arrows and authoritative gameplay remain independent DOM layers.
function ensureReferenceAtlasV21(root) {
  if (!root) return;
  root.dataset.mrReferenceAtlas = '21';

  const installAtlas = atlas => {
    if (!atlas || !root?.style) return;
    root.style.setProperty('--mr-v21-left-cliff', 'url("' + atlas.leftCliff + '")');
    root.style.setProperty('--mr-v21-right-cliff', 'url("' + atlas.rightCliff + '")');
    root.style.setProperty('--mr-v21-grass-strip', 'url("' + atlas.grass + '")');
    root.style.setProperty('--mr-v21-rock-texture', 'url("' + atlas.rock + '")');
    root.dataset.mrReferenceAtlasReady = '1';
  };

  if (window.__mountainRaceReferenceAtlasV21) {
    installAtlas(window.__mountainRaceReferenceAtlasV21);
    return;
  }

  if (!window.__mountainRaceReferenceAtlasV21Promise) {
    window.__mountainRaceReferenceAtlasV21Promise = new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => {
        try {
          const W = image.naturalWidth || image.width;
          const H = image.naturalHeight || image.height;
          if (!W || !H) throw new Error('reference image has no dimensions');

          const pngCrop = (nx, ny, nw, nh, outW, outH, options = {}) => {
            const canvas = document.createElement('canvas');
            canvas.width = outW;
            canvas.height = outH;
            const ctx = canvas.getContext('2d', { alpha: true });
            if (!ctx) throw new Error('canvas 2d context unavailable');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            const sx = Math.round(nx * W);
            const sy = Math.round(ny * H);
            const sw = Math.max(1, Math.round(nw * W));
            const sh = Math.max(1, Math.round(nh * H));

            if (options.tileMirror) {
              const tileW = Math.max(64, Math.round(outW / 6));
              for (let x = 0, index = 0; x < outW; x += tileW, index += 1) {
                ctx.save();
                if (index % 2) {
                  ctx.translate(x + tileW, 0);
                  ctx.scale(-1, 1);
                  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, tileW + 2, outH);
                } else {
                  ctx.drawImage(image, sx, sy, sw, sh, x, 0, tileW + 2, outH);
                }
                ctx.restore();
              }
            } else {
              ctx.drawImage(image, sx, sy, sw, sh, 0, 0, outW, outH);
            }

            if (options.light) {
              const light = ctx.createLinearGradient(0, 0, outW, outH);
              light.addColorStop(0, 'rgba(255,236,194,.12)');
              light.addColorStop(.42, 'rgba(255,236,194,0)');
              light.addColorStop(1, 'rgba(7,10,8,.18)');
              ctx.fillStyle = light;
              ctx.fillRect(0, 0, outW, outH);
            }
            return canvas.toDataURL('image/png');
          };

          // Normalized crops are based on the approved 896 x 1536 reference.
          // The clean cliff ranges intentionally stop above the reference climbers/UI.
          const atlas = {
            leftCliff: pngCrop(70 / 896, 120 / 1536, 290 / 896, 730 / 1536, 512, 1536, { light: true }),
            rightCliff: pngCrop(530 / 896, 120 / 1536, 290 / 896, 730 / 1536, 512, 1536, { light: true }),
            // Narrow edge crop contains grass/earth but excludes the baked climber.
            grass: pngCrop(108 / 896, 958 / 1536, 88 / 896, 116 / 1536, 768, 184, { tileMirror: true, light: true }),
            rock: pngCrop(188 / 896, 284 / 1536, 178 / 896, 250 / 1536, 512, 512, { light: true })
          };
          window.__mountainRaceReferenceAtlasV21 = atlas;
          resolve(atlas);
        } catch (error) {
          reject(error);
        }
      };
      image.onerror = () => reject(new Error('reference image failed to load'));
      image.src = 'assets/mountain-race/images/summit-sprint-reference-v21.jpg?reference=21';
    }).catch(error => {
      console.warn('[Summit Sprint V21] PNG atlas fallback active:', error);
      return null;
    });
  }

  window.__mountainRaceReferenceAtlasV21Promise.then(installAtlas);
}
`;

  runtime += atlasRuntime;
  runtime = replaceRequired(
    runtime,
    "    root.dataset.mrScreenshotBase = '20';",
    "    root.dataset.mrScreenshotBase = '20';\n    ensureReferenceAtlasV21(root);",
    'V20 dataset installation'
  );
}

if (!css.includes(marker)) {
  css += String.raw`

/* MOUNTAIN_RACE_REFERENCE_ATLAS_V21
   Reference-derived PNG terrain with a centering repair. This layer intentionally
   comes after V20 and leaves all authoritative gameplay/networking untouched. */

[data-mountain-race-mount][data-mr-reference-atlas="21"] {
  --mr-v21-left-cliff-fallback: url("images/summit-sprint-reference-v21.jpg");
  --mr-v21-right-cliff-fallback: url("images/summit-sprint-reference-v21.jpg");
  --mr-v21-sunlight: rgba(255, 229, 177, .18);
  --mr-v21-rim-shadow: rgba(3, 7, 6, .42);
}

/* Center the two playable lanes as one balanced unit. */
[data-mountain-race-mount][data-mr-reference-atlas="21"] .mr-climb-viewport {
  box-sizing: border-box;
  padding-inline: clamp(8px, 2vw, 16px) !important;
  overflow: hidden !important;
}

[data-mountain-race-mount][data-mr-reference-atlas="21"] .mr-lanes,
[data-mountain-race-mount][data-mr-reference-atlas="21"] .mr-race-lanes,
[data-mountain-race-mount][data-mr-reference-atlas="21"] .mr-lane-grid {
  width: 100% !important;
  max-width: 100% !important;
  margin-inline: auto !important;
  box-sizing: border-box !important;
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  justify-content: center !important;
  justify-items: stretch !important;
  gap: clamp(7px, 1.8vw, 14px) !important;
}

[data-mountain-race-mount][data-mr-reference-atlas="21"] .mr-lane {
  position: relative !important;
  min-width: 0 !important;
  width: 100% !important;
  max-width: none !important;
  margin-inline: 0 !important;
  justify-self: stretch !important;
  overflow: hidden !important;
  box-sizing: border-box !important;
}

/* Preserve the wall's vertical gameplay transform; only correct its horizontal box. */
[data-mountain-race-mount][data-mr-reference-atlas="21"] .mr-mountain-wall {
  left: 0 !important;
  right: 0 !important;
  width: 100% !important;
  margin-inline: 0 !important;
  transform-origin: 50% 50% !important;
  background-color: #4b4539 !important;
  background-image:
    linear-gradient(108deg, rgba(255,235,190,.12) 0%, transparent 37%, rgba(4,7,6,.20) 100%),
    var(--mr-v21-left-cliff, var(--mr-v21-left-cliff-fallback)) !important;
  background-size: 100% 100%, 100% 100% !important;
  background-position: center, center top !important;
  background-repeat: no-repeat !important;
  filter: saturate(1.02) contrast(1.10) brightness(.98) !important;
  box-shadow:
    inset 12px 0 24px rgba(255,226,171,.07),
    inset -18px 0 28px rgba(1,5,4,.30) !important;
}

[data-mountain-race-mount][data-mr-reference-atlas="21"] .mr-lane.opponent .mr-mountain-wall {
  background-image:
    linear-gradient(108deg, rgba(255,235,190,.10) 0%, transparent 38%, rgba(4,7,6,.22) 100%),
    var(--mr-v21-right-cliff, var(--mr-v21-right-cliff-fallback)) !important;
  background-position: center, center top !important;
}

[data-mountain-race-mount][data-mr-reference-atlas="21"] .mr-mountain-wall::before {
  background:
    radial-gradient(ellipse at 16% 4%, rgba(255,240,199,.18), transparent 31%),
    linear-gradient(106deg, rgba(255,231,181,.08), transparent 32%, rgba(6,9,8,.14) 78%, rgba(1,4,4,.23)) !important;
  opacity: .78 !important;
  mix-blend-mode: soft-light;
}

[data-mountain-race-mount][data-mr-reference-atlas="21"] .mr-mountain-wall::after {
  background:
    linear-gradient(90deg, rgba(0,0,0,.18), transparent 7%, transparent 92%, rgba(0,0,0,.22)),
    linear-gradient(180deg, rgba(255,255,255,.025), transparent 18%, transparent 84%, rgba(0,0,0,.10)) !important;
}

/* Reference-derived PNG grass replaces the synthetic neon-looking V20 blades. */
[data-mountain-race-mount][data-mr-reference-atlas="21"] .mr-start-ledge,
[data-mountain-race-mount][data-mr-reference-atlas="21"] .mr-finish-ledge {
  left: 50% !important;
  right: auto !important;
  width: min(88%, 310px) !important;
  max-width: calc(100% - 16px) !important;
  margin-left: 0 !important;
  margin-right: 0 !important;
  transform: translateX(-50%) !important;
  box-sizing: border-box !important;
  border-radius: 18px 18px 14px 14px !important;
  background:
    linear-gradient(180deg, rgba(255,236,184,.06), rgba(4,8,6,.17)),
    var(--mr-v21-grass-strip, linear-gradient(180deg, #718943 0 31%, #433726 32% 100%)) !important;
  background-size: 100% 100%, cover !important;
  background-position: center !important;
  background-repeat: no-repeat !important;
  box-shadow:
    0 14px 18px rgba(2,6,5,.42),
    inset 0 1px 0 rgba(255,239,197,.13),
    inset 0 -12px 20px rgba(3,7,5,.22) !important;
}

[data-mountain-race-mount][data-mr-reference-atlas="21"] .mr-start-ledge::before,
[data-mountain-race-mount][data-mr-reference-atlas="21"] .mr-finish-ledge::before {
  content: none !important;
  display: none !important;
  animation: none !important;
}

[data-mountain-race-mount][data-mr-reference-atlas="21"] .mr-start-ledge::after,
[data-mountain-race-mount][data-mr-reference-atlas="21"] .mr-finish-ledge::after {
  content: '' !important;
  position: absolute !important;
  left: 13% !important;
  right: 13% !important;
  bottom: -8px !important;
  height: 16px !important;
  border-radius: 50% !important;
  background: radial-gradient(ellipse, rgba(0,0,0,.35), transparent 69%) !important;
  pointer-events: none !important;
}

/* Center climbers relative to their own lane without replacing vertical motion. */
[data-mountain-race-mount][data-mr-reference-atlas="21"] .mr-climber {
  margin-left: auto !important;
  margin-right: auto !important;
  transform-origin: 50% 100% !important;
  z-index: 12 !important;
  filter:
    drop-shadow(5px 8px 5px rgba(2,5,4,.46))
    drop-shadow(-1px -1px 1px rgba(255,229,185,.11)) !important;
}

/* Keep the live direction controls legible but let the photographic ledges dominate. */
[data-mountain-race-mount][data-mr-reference-atlas="21"] .mr-rock-hold {
  background: transparent !important;
  background-image: none !important;
  border: 0 !important;
  box-shadow: none !important;
}

[data-mountain-race-mount][data-mr-reference-atlas="21"] .mr-rock-hold b {
  width: 29px !important;
  height: 29px !important;
  margin-inline: auto !important;
  border: 1px solid rgba(232,216,177,.52) !important;
  background:
    radial-gradient(circle at 32% 24%, rgba(255,255,255,.16), transparent 35%),
    linear-gradient(180deg, rgba(24,28,26,.94), rgba(6,9,8,.98)) !important;
  box-shadow: 0 5px 8px rgba(0,0,0,.56), inset 0 1px 0 rgba(255,255,255,.12) !important;
}

[data-mountain-race-mount][data-mr-reference-atlas="21"] .mr-rock-hold.current b {
  border-color: rgba(255,220,135,.94) !important;
  box-shadow:
    0 6px 10px rgba(0,0,0,.58),
    0 0 10px rgba(255,187,59,.78),
    0 0 21px rgba(255,147,40,.28),
    inset 0 1px 0 rgba(255,255,255,.20) !important;
}

[data-mountain-race-mount][data-mr-reference-atlas="21"] .mr-lane.opponent .mr-rock-hold.current b {
  border-color: rgba(181,229,255,.92) !important;
  box-shadow:
    0 6px 10px rgba(0,0,0,.58),
    0 0 10px rgba(79,190,255,.76),
    0 0 20px rgba(44,145,215,.28),
    inset 0 1px 0 rgba(255,255,255,.18) !important;
}

/* Keep the control deck itself centered after the terrain correction. */
[data-mountain-race-mount][data-mr-reference-atlas="21"] .mr-command-deck {
  width: calc(100% - clamp(16px, 4vw, 28px)) !important;
  max-width: 620px !important;
  margin-left: auto !important;
  margin-right: auto !important;
  box-sizing: border-box !important;
}

@media (max-width: 560px) {
  [data-mountain-race-mount][data-mr-reference-atlas="21"] .mr-climb-viewport {
    padding-inline: 5px !important;
  }

  [data-mountain-race-mount][data-mr-reference-atlas="21"] .mr-lanes,
  [data-mountain-race-mount][data-mr-reference-atlas="21"] .mr-race-lanes,
  [data-mountain-race-mount][data-mr-reference-atlas="21"] .mr-lane-grid {
    gap: 5px !important;
  }

  [data-mountain-race-mount][data-mr-reference-atlas="21"] .mr-start-ledge,
  [data-mountain-race-mount][data-mr-reference-atlas="21"] .mr-finish-ledge {
    width: calc(100% - 14px) !important;
    max-width: none !important;
  }
}
`;
}

html = html.replace(/mountain-race-multiplayer\.js\?([^"']*)/g, (full, query) => full.includes('reference=21') ? full : `mountain-race-multiplayer.js?${query}&reference=21`);
html = html.replace(/mountain-race\.css\?([^"']*)/g, (full, query) => full.includes('reference=21') ? full : `mountain-race.css?${query}&reference=21`);

await Promise.all([
  writeFile(cssUrl, css),
  writeFile(runtimeUrl, runtime),
  writeFile(indexUrl, html)
]);
