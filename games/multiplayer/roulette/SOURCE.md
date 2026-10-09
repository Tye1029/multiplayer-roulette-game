# Russian Roulette

[presentation.js](presentation.js) contains the game-owned presentation assembled
into the shared shell. Edit [index.template.html](../../../shared/site/index.template.html),
then run `npm run build`; never hand-edit generated `index.html`.

## Warm room and smooth motion release: warm-v3

The complete oval table and rustic pendant remain. Chairs, people and their fall
animation were removed at the user's request. The room uses one 1100×825 WebP
with worn plaster, scuffed floorboards and small broken-bottle/paper details.
It replaces the two chair/person sprites, deleted after checking direct, dynamic,
admin and validation references. Images preload only when Roulette is selected.

One pendulum clock controls the lamp, bulb bloom, diffuse room spill, tabletop
illumination and world-space gun highlight. No polygon-clipped light cone remains.
The warm pool has broad radial falloff. Constant calibration styles are applied
only at mount/configuration/resize; the frame loop updates moving light. Lighting
pauses in hidden or offscreen scenes. Calibration V12 replaces earlier settings.

The gun's facing/recoil layers are present in the initial markup. Its art decodes
before becoming visible or starting the opening audio. The 5.30-second opening
uses three continuous clockwise turns and a smooth acceleration/friction curve,
without reverse bounce or keyframe speed jumps. The recording tracks the real
animation clock. Both handoffs use one eased rotation and one matching movement
sound. The facing guard retains transitions observed during other feedback; shot
completion no longer attempts its own rotation. Lamp style updates no longer
trigger the guard. Audio fades clamp progress and volume to handle rAF timestamps
preceding registration time.

Spin is available from the player's first turn, in either turn phase, once per
player per game. Server checks enforce turn ownership and the one-use flag;
duplicate action IDs remain idempotent. Inactive buttons retain their colors.

The requested animation changes update the two pinned Roulette module hashes;
the protected-file check still rejects unrecognized contents. Safe Cracker and
other games remain covered by the existing full build.

## Assets and generation

New file: [saloon-room-v3.webp](../../../assets/roulette/decor/saloon-room-v3.webp).
Retained: [rustic-pendant-v2.png](../../../assets/roulette/decor/rustic-pendant-v2.png),
[oval-table-v2.png](../../../assets/roulette/decor/oval-table-v2.png), wall props,
chain, gun and hammer art. Built-in imagegen produced the room, resized with its
aspect ratio preserved and encoded as WebP quality 84. No API/CLI generation.

Final prompt:

> Create a background texture artwork for a rustic, dingy Western saloon Russian Roulette game. One empty room seen frontally from a slightly elevated angle, landscape 4:3 composition. Upper 60 percent is aged dirty brown plaster wall with fine cracks, water stains, subtle mottled texture, dark worn timber baseboard at horizon 60 percent from top. Lower 40 percent is scuffed dark wooden floorboards in believable perspective, very subtle dusty grime. A small broken dark green glass bottle on its side and 3 tiny scattered glass fragments near the far lower left floor corner, a tiny crumpled dirty paper near far lower right. These props are unobtrusive, occupy less than 6 percent of image each. Center completely empty for a separately rendered oval table and gun. No table, no chairs, no people, no legs, no gun, no lamp, no posters, no furniture. Dim neutral amber-brown ambient room lighting, no baked spotlight, no cone of light, no bright highlights, no vignette cutting objects. Realistic detailed wood and plaster material textures, natural photographic game background, restrained contrast, clearly visible texture without high contrast noise. Edge-to-edge room background, opaque, no text, no frame, no watermark.

## Validation

`validate-roulette-repair.mjs` exercises production rules, duplicate actions,
both players' one-use spins, all six chamber outcomes, private-field filtering,
and queued handoffs during shot feedback. `validate-roulette-motion.mjs` checks
continuous spin travel, gradual stopping, bounded audio fades and one facing
owner. `validate-roulette-scene.mjs` checks shared lighting geometry, reduced
motion, alpha edges, and media budgets. All three run in the protected build.

`node scripts/preview-roulette-repair.mjs` serves an isolated production-rule
fixture at `http://127.0.0.1:8788/`, with no account, balance or wager. It measures
animation frames, clipping, media readiness and audio starts. Optional
`?base=https://deploy-preview-20--famous-piroshki-b621da.netlify.app/` loads shipped
presentation/styles/media while keeping actions on the local fixture.


## Frontier update — 9 October 2026

- Added a server-owned 60-second deadline per turn. Passing resets it; shooting again and spinning do not extend the same turn. The first clock starts after the opening presentation allowance. Expired actors cannot act; their opponent can claim Shoot Em Dead. Spectators cannot claim. The existing payout ledger remains idempotent. Roulette game writes now use Blob ETag compare-and-swap, and actions/polls reread strong state. The local queue releases only its own tail.
- Initial chamber and each player's one spin independently use crypto.randomInt(1,7), with no exclusion of the previous position. The chamber advances without rerolling on a blank.
- Fixed the opening lock through its final announcement, prevented NPC input during the chooser, and isolated old-game animation completion from a newer game. Countdown synth is restored and its context unlocked by a trusted Roulette gesture.
- Disabled/off-turn/used buttons are gray with a normal cursor. Timer is beside the pot. Softer orange light, stronger moving room shadows, a solid table pedestal and a textured full-page surround replace the empty blue area.
- Flash and smoke anchor at each model's actual muzzle; a 190ms radial room illumination follows that point through recoil. Hammer and cylinder animations retain their own layers and do not own facing.
- Midnight Gold plus Silver Smoke, Burnished Copper, Jade Outlaw and Violet Dusk use reusable native CSS material filters, so they add no texture downloads. Neon Frontier uses a separate body and hammer. Selection stays in this browser's rouletteGunPreferenceV1 local storage and is never sent to the server or other players. Images decode before a swap.

New project assets (built-in imagegen; proportionally downsampled, original alpha retained):
- assets/roulette/revolver-neon-frontier.webp
- assets/roulette/revolver-neon-frontier-hammer.webp

Body prompt: Reference the original revolver only for orthographic left-facing camera, registration and 1307:522 proportions. Create a completely new cowboy cyberpunk revolver in worn dark titanium, copper fittings, restrained turquoise conduits, engraved frontier motifs, angular long barrel and dark leather grip. Muzzle at x0.5%, y10%; cylinder x54–70%, y4–35%; grip on right. Remove the hammer and leave a recessed socket. No floor, external shadow, labels or background; genuine transparent alpha, neutral studio illumination.

Hammer prompt: Edit the original isolated hammer sprite with the new revolver as a style reference. Replace only the hammer with angular titanium, copper trim and a small cyan inset. Preserve full transparent 1307:522 canvas and original registration, without centering or enlarging the hammer; no other gun parts, text or external shadows. The returned pivot is registered separately in CSS for the new model.

Generated originals:
- C:/Users/tyeta/.codex/generated_images/01a11f0a-2a0d-7ad2-94ff-404ff74605c5/exec-e1c2f508-2ffa-4007-90fa-2528ddca0096.png
- C:/Users/tyeta/.codex/generated_images/01a11f0a-2a0d-7ad2-94ff-404ff74605c5/exec-dfc2543e-83b0-4d28-89ca-01efc013db3d.png

Historical patch scripts/audio aliases are retained because assembly compatibility paths and diagnostic validators still reference them. Existing classic sprites remain in use for the five material finishes. No new assets are preloaded before Roulette is selected; Neon Frontier loads only when selected or restored as the saved choice.

Validation: validate-roulette-frontier executes production chamber/deadline rules, all six positions, identical-position respins, timeout authorization and duplicate claims, competing ETag writes, opponent opening delay, countdown synth/muting, local preference fallback, and repeated mounts during the announcement. The protected baseline includes this test plus existing Roulette motion/scene and other-game regressions.


## Arsenal refinement — 9 October 2026

Four whole-image tints are replaced by separately generated Pearl Marshal, Crimson Viper, Desert Relic and Cobalt Ranger artwork. The original preference IDs are retained so saved choices migrate. Midnight Gold and Neon Frontier remain. Redshift Ranger is a cosmetic laser sidearm with a 1.5-second charge bar, blank/error cue and live red discharge; all server chamber, spin and payout rules remain unchanged.

Cylinder rotation now samples the actual model texture onto a fixed cylinder silhouette with a sinusoidal cylindrical projection. Four full rotations return to the original texture without opacity fades or changing the gun's facing. The stationary frame and rear ratchet remain outside the crop. Classic-pattern models reuse the registered, animated original hammer with material treatment on the hammer only; Neon Frontier keeps its own hammer. Laser Spin is shown as an electronic recalibration using the same one-use gameplay action.

Startup stays hidden until both images decode and two layout frames pass. The lamp gleam stays hidden until its first world-space projection; initial markup uses the selected art mask. The outer blur/grid are removed, the floor no longer repeats the room image, and an attached two-leg wooden trestle scales with the table.

Built-in imagegen mode used for all five new assets. Originals retained under the Codex generated_images directory. Production WebP files proportionally downsampled to 1306×522 with generated alpha preserved; only the selected model loads.

Final prompts and project asset paths:

### pearl-marshal

`assets/roulette/revolver-pearl-marshal.webp`

> Game sprite asset. Use attached original only as a strict registration reference. Keep EXACT silhouette, left-facing orthographic side-view, muzzle at left x0.5% y10%, cylinder x54-70% y4-35%, grip at right, same 2.504:1 transparent canvas. NO hammer (separate animated part), no extra gun, background, shadow, text or watermark. Preserve all outside contours and mechanical joint locations, but replace material treatment, engraving patterns and grip with the following new bespoke design. Photorealistic detailed worn metal, neutral diffuse lighting, restrained highlights, no baked shine flare. Genuine transparent alpha. Pearl Marshal: satin silver frame and cylinder with deep charcoal engraving of flowing feathers and a small silver marshal star. Blued-black barrel, tasteful narrow warm brass seams, carved aged ivory grip with dark inset medallion. Clearly separate realistic materials, not a global color tint.

### crimson-viper

`assets/roulette/revolver-crimson-viper.webp`

> Game sprite asset. Use attached original only as a strict registration reference. Keep EXACT silhouette, left-facing orthographic side-view, muzzle at left x0.5% y10%, cylinder x54-70% y4-35%, grip at right, same 2.504:1 transparent canvas. NO hammer (separate animated part), no extra gun, background, shadow, text or watermark. Preserve all outside contours and mechanical joint locations, but replace material treatment, engraving patterns and grip with the following new bespoke design. Photorealistic detailed worn metal, neutral diffuse lighting, restrained highlights, no baked shine flare. Genuine transparent alpha. Crimson Viper: dark gunmetal barrel and frame, rose-copper cylinder with engraved serpent and geometric scale bands. Deep oxblood burgundy leather grip with stitching and small copper snake medallion. Fine copper details on charcoal frame; no red tint over metal.

### desert-relic

`assets/roulette/revolver-desert-relic.webp`

> Game sprite asset. Use attached original only as a strict registration reference. Keep EXACT silhouette, left-facing orthographic side-view, muzzle at left x0.5% y10%, cylinder x54-70% y4-35%, grip at right, same 2.504:1 transparent canvas. NO hammer (separate animated part), no extra gun, background, shadow, text or watermark. Preserve all outside contours and mechanical joint locations, but replace material treatment, engraving patterns and grip with the following new bespoke design. Photorealistic detailed worn metal, neutral diffuse lighting, restrained highlights, no baked shine flare. Genuine transparent alpha. Desert Relic: weathered bronze frame with sand-colored ceramic inlay panels, dark steel barrel, aged brass cylinder with sunburst and desert mesa engraving. Carved dark walnut grip with small pale bone sun medallion. Layered archaeology-meets-western design, no global sepia wash.

### cobalt-ranger

`assets/roulette/revolver-cobalt-ranger.webp`

> Game sprite asset. Use attached original only as a strict registration reference. Keep EXACT silhouette, left-facing orthographic side-view, muzzle at left x0.5% y10%, cylinder x54-70% y4-35%, grip at right, same 2.504:1 transparent canvas. NO hammer (separate animated part), no extra gun, background, shadow, text or watermark. Preserve all outside contours and mechanical joint locations, but replace material treatment, engraving patterns and grip with the following new bespoke design. Photorealistic detailed worn metal, neutral diffuse lighting, restrained highlights, no baked shine flare. Genuine transparent alpha. Cobalt Ranger: brushed titanium frame, blackened steel barrel, fine silver constellation engraving on midnight blue enamel cylinder panels. Warm walnut grip with cobalt ceramic inset and thin silver border. Selective blue details only, silver/black structural metal, richly detailed distinct design.

### redshift-ranger

`assets/roulette/revolver-redshift-ranger.webp`

> Create one photorealistic game sprite of a futuristic high-tech cowboy laser pistol named internally Redshift Ranger. Reference attached gun only for strict left-facing side-on orthographic registration and 2.504:1 canvas: entire gun fills same canvas with barrel muzzle at x0.5% y12%, grip far right downward, fixed camera. Entirely NEW silhouette and futuristic construction. Long angular dark graphite barrel shroud with silver titanium rails, restrained copper western scroll inlays, black leather grip with small star badge, red lens at left muzzle. NO revolving cylinder and NO hammer. In the upper middle receiver where the cylinder would be (roughly x48-70%, y12-25%), create a single horizontal recessed dark glass LED strip socket, unlit empty, for an animated red charge bar to be overlaid. Finely machined parts, small cooling fins, sophisticated functional sci-fi design blended with rugged western craftsmanship. Keep all parts inside canvas; no external light beam or blast, no floor or shadows or text or labels, genuine transparent alpha. Neutral dim diffuse studio illumination without blown highlights.
