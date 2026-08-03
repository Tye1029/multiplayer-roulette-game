# Safe Cracker dial audio v26

Source supplied by the user: `Metallic Clicks Sound Effect  SFX.mp3`.

Active dial route:
- Keeps the same uploaded metallic-click waveform used in v25 so the character of the approved sound does not change.
- Removes the small DC offset and applies only an 18% three-sample smoothing blend to soften audible 8-bit stair-stepping without dulling the initial metal strike.
- Reconstructs the waveform into a 32 kHz 32-bit floating-point AudioBuffer with cubic interpolation before playback.
- Adds a 1.5 ms equal-power fade-in and a 42 ms equal-power fade-out so the beginning and tail do not sound abruptly clipped.
- Plays at the original pitch through the same direct WebAudio destination that was audible on the target Android device.
- Uses no dynamics compressor, limiting, EQ filter, media element, MP3 decoder, generated oscillator, or synthesized ratchet layer.
- The cleanup reduces quantization harshness and edge chopping, but it does not restore information absent from the source waveform.

The background ambience remains the smooth 21-second vault-room tone. Correct-number, incorrect-number, intro, and vault-opening cues remain separate and unchanged.
