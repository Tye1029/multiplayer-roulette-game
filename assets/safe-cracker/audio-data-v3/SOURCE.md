# Safe Cracker dial audio v25

Source supplied by the user: `Metallic Clicks Sound Effect  SFX.mp3`.

Active dial route:
- Uses the exact waveform from `Metallic Clicks Sound Effect  SFX.mp3`, taken from one of the strongest isolated metallic strikes in the recording.
- The selected 300 ms click is converted to 16 kHz unsigned 8-bit PCM and stored as a transport-safe base64 payload.
- The build embeds those exact PCM bytes directly into the Safe Cracker JavaScript.
- The browser reconstructs an AudioBuffer synchronously and plays it through the same direct WebAudio destination that was audible on the target Android device.
- Playback remains at the recorded pitch and timing, with no filter, pitch shift, media element, MP3 decoder, generated oscillator, or synthesized ratchet layer.
- Repeated dial steps may overlap naturally because each detent creates its own AudioBufferSourceNode.

The background ambience remains the smooth 21-second vault-room tone. Correct-number, incorrect-number, intro, and vault-opening cues remain separate and unchanged.
