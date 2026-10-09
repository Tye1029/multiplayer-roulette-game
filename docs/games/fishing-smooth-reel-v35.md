# Fishing smooth reel and quiet atmosphere v35

- Removed the pointed wispy cloud from both scenes and retired its unused PNG.
  Original clouds and the approved compact puff remain. Per-scene cloud periods
  vary from 85–150 seconds, with random phase, height and opacity.
- One decorative swimmer replaces three repeated routes. Each 6.5–10.5 second
  pass is followed by 28–50 seconds of clear water, with newly randomized
  direction, endpoints and depth. Routes stay below 83.1% scene height, safely
  away from the bite/bobber zone at 66.5%, and within the exposed-water clip.
- The original fishermen PNGs remain unchanged. A small cached canvas rig moves
  the hands, arms and rod during confirmed pulls. Lower body and feet are not
  deformed. Rod-tip anchors use the same deformation and are measured together.
  Canvas work stops after the 1.15-second reel; reduced motion keeps the still PNG.
- Hook/path elements are cached. Geometry reads are batched before line updates.
  Unchanged positional styles are not rewritten. Water paints at most 30 times
  per second, with cached gradients and fewer sample points; hidden-page work
  and repeated collapsed debug writes are skipped.
  Background open-match list reads pause only during an active Fishing round.
- Noise buffers are reused. Splash layers use WebAudio scheduling instead of
  timers. Visible reel/surface events own deduplicated catch sounds; poll audio
  no longer repeats catches or plays an early duplicate result fanfare.
- Old lifecycle/state snapshots cannot restart Fishing's countdown. Delayed
  animation callbacks skip countdown sounds whose numeric cue has expired.

The supplied report recorded a 1,456 ms catch request and occasional slower
reads. These are network waits, not proof of client frame lag. The server still
confirms the species before reeling; no predicted fish, changed odds, networking
rules or reduced gameplay validation are used to disguise that wait.

Scene debug exports now include frame-gap, water-paint, arm-paint and layout-read
counters. These are diagnostics, not a claim that every device is now lag-free.
Historical v34 generation notes are retained as provenance; the retired cloud
has no runtime, admin/API or build dependency.
