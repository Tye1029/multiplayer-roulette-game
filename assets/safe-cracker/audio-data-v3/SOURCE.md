# Safe Cracker dial sample v22

Source supplied by the user: `Metallic Clicks Sound Effect  SFX.mp3`.

Dial processing:
- Inspected the 13.56-second stereo recording and identified six clean isolated metallic strikes in its first five seconds.
- Extracted six isolated 190 ms metallic clicks and rotated them sequentially during dial movement.
- Converted each click to 24 kHz mono, removed only subsonic rumble below 55 Hz, peak-matched it to -2 dBFS, and added very short edge fades.
- Preserved the original recorded pitch and metallic attack; no arcade oscillator or musical pitch layer is added.
- Runtime playback continues to use two preloaded native HTML audio voices per sample so rapid dial movement can overlap without cutting off the previous click.
- A short dry mechanical fallback remains available only while native media is still loading or if playback is rejected.

The background ambience remains the V21 smooth room tone. The repeating recorded impacts are still disabled. Correct-number, incorrect-number, intro, and vault-opening cues remain separate and unchanged.
