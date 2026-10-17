# Boardwalk Carnival V10 — seven-game polish pass

- Rooftop Rally now climbs a continuous mountain face, with checkpoint ledges, square directional markers on the next four physical ledges, a following camera, and immediate queued directional feedback.
- Sunset Putt has a larger charging arrow, curved greens and oval hazards, textured surfaces, grounded scenery, continuous conveyor strips, an authoritative hole-in celebration, and everyone’s live points on the scene. The spectator instruction box is hidden. Party course shapes are cloned and adapted locally; the original XAN DUELS golf courses and physics are untouched.
- Harbor Haul has four spaced bites, fixed-size ripples directly proportional to the fish length, six fish appearances, and a more detailed cove. No bite rings appear before play. One successful catch still ends that player’s fishing turn.
- Afterglow has a preparation beat before each pattern, synchronized original note/bass accompaniment, individual button sounds, character steps onto illuminated pads, and an amphitheater with lighting rigs. Rapid taps queue within the server’s existing input limits. Accepted network replies preserve the existing local animation clocks so jumps and lane moves do not restart.
- Coin Cascade visibly dispenses from overhead machines. Across overlapping rows, at most two spikes appear per player, leaving a safe lane. Hits remove up to three collected coins and cause a two-second stun with brief collision immunity and orbiting stars.
- Lantern Landing’s host retrieves a colored card from a pocket and holds it in hand only during play. Eliminated characters fall into the open hatch, surface outside its frame, and swim back to shore.
- Tidal Hop now uses rolling driftwood on a distinct beach. The visible obstacle speed, size-dependent jump duration, and immediate local jump use the same authoritative timing. Three misses still end a run.
- All minigames show final placements and coin awards directly on the scene. Live participant scores sit along its bottom edge. Riff’s detached headphone pieces have been moved back onto the head.
- Debug includes a copyable report with build, room/phase, viewport, renderer statistics, public game state, and input status. Authentication, secret/future sequences, and private patterns are excluded. Clipboard failure leaves a selectable text report.

Validation covers model/API regression tests, 500 generated Cascade layouts, real golf hole physics, seven-game desktop/390px/320px browser interaction checks, every golf course, hole-in animation, fall/swim frames, stun controls, copied diagnostics, and the full four-player minigame regression. The normal build includes protected Roulette, Safe Cracker, Summit Sprint, and shared multiplayer checks.

The old climbing/memory scene implementations were removed when replaced. Legacy XAN DUELS assets remain because the separate original games still reference them. No store, account economy, or legacy game source changes are part of this update. Test sessions continue to award no persistent account rewards.

Preview marker: `BOARDWALK_CARNIVAL_V10`. Room schema remains version 8.
