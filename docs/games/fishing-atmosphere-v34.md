# Fishing atmosphere and countdown v34

The server keeps its existing five-second start window. The client now shows
CASTING while more than three seconds remain, then 3, 2, 1 and GO at one-second
intervals. Preparation is silent; the existing painted-number sound scheduling
and authoritative start time are unchanged. Other games keep their countdowns.

Ambient fish are canvas-only decorations: three staggered, gently curving passes
with tail movement, soft fade envelopes, and long clear-water gaps. They never
create bites, change fish odds, or accept catches. They share the existing dock
exclusion clip. Reduced motion and completed rounds disable them.

New cloud files under `assets/fishing/images/v2/`:

- `cloud-wisps-v1.png` (640 × 213, 41,296 bytes)
- `cloud-puff-v1.png` (640 × 320, 29,443 bytes)

Generated with the built-in image-generation tool, using `clouds-v2.png` as a
style reference. PNG optimization preserves alpha and aspect ratio. The existing
cloud remains in use; no prior referenced game art was replaced or deleted.

## Final generation prompts

Wisps: Use case: stylized-concept. Asset type: transparent PNG cloud sprite for
the existing Fishing Duel game. Input image: style reference only, not a scene
to repaint. Create ONE new, distinctly different, long slender cloud formation:
airy wispy feathered cirrus mixed with a few small softly rounded cloudlets,
much lower profile and more open than the towering cumulus reference. Match
the reference's polished painterly realism, warm white sunlit edges and very
soft pale cool-blue shaded undersides. Wide horizontal isolated formation,
generous transparent padding all around, no cropped edges, natural asymmetrical
silhouette with delicate translucent feather tips. Actual transparent background;
no sky, lake, characters, shadows cast onto a background, text or watermark.
The new cloud should complement the existing lake art without replacing it.

Puff: Use case: stylized-concept. Asset type: transparent PNG cloud sprite for
Fishing Duel. Input image is a style reference only. Generate ONE small,
isolated, softly rounded fair-weather cumulus puff, asymmetrical with three
uneven lobes and a trailing soft thin strand; distinctly compact compared with
the huge towering reference cluster. Match the existing high-quality
painterly-realistic lake game's lighting: warm white sunlit upper edges, very
gentle pale-blue shaded underside. Full cloud comfortably centered in a
horizontal canvas with generous genuine transparent padding, fine airy
translucent edges and no crop. No sky, water, other objects, text, watermark,
ground plane or baked checkerboard. Keep it light and airy, not stormy. Actual
alpha transparent background.
