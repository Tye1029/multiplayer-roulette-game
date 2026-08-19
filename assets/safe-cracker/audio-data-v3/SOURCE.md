# Safe Cracker dial audio v27

Source supplied by the user: `Metallic Clicks Sound Effect  SFX.mp3`.

Active dial route:
- The metallic click approved in v25 was matched back to approximately 4.57 seconds in the original 44.1 kHz stereo upload.
- A 440 ms window was extracted directly from that original source, including substantially more of its natural metallic decay than the earlier 300 ms low-resolution copy.
- The nearly identical stereo channels were folded to mono, the small DC offset was removed, and only tiny 0.8 ms entry and 70 ms exit fades were applied.
- The result is stored as 32 kHz signed 16-bit PCM: 14,080 samples and 28,160 bytes.
- The raw PCM SHA-256 is `f083e8341eaab8dd5c345128a2f084b9e93f7bdc7c48a2ab5b7fb978b38977cc`.
- The base64 representation is split into seven text chunks only to survive GitHub transport, then reassembled and checksum-verified during every production build. The seventh chunk restores the exact final zero-valued fade tail that GitHub shortened from part 6.
- The browser reconstructs the signed 16-bit waveform directly into an AudioBuffer and plays it through the WebAudio destination that is audible on the target Android device.
- Playback uses the recorded pitch and timing with no interpolation, smoothing, compression, normalization, limiting, EQ, pitch shift, media element, MP3 decoder, generated oscillator, or synthesized ratchet layer.

The background ambience remains the smooth 21-second vault-room tone. Correct-number, incorrect-number, intro, and vault-opening cues remain separate and unchanged.
