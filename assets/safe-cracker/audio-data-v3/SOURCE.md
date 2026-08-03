# Safe Cracker dial sample v23

Source supplied by the user: `Metallic Clicks Sound Effect  SFX.mp3`.

Dial processing:
- Selected one exact 400 ms metallic click from the strongest isolated strike in the uploaded recording.
- Converted it to 24 kHz mono, removed only subsonic rumble below 55 Hz, normalized the peak, and preserved the full recorded metallic attack and tail.
- The MP3 is embedded directly into the generated Safe Cracker JavaScript as a data URI, so the browser cannot reuse the previous dial asset URL or stale cached sample.
- Six native HTML audio voices all use this same exact recording so quick dial movement can overlap without cutting off the preceding click.
- Playback remains at the original pitch and full native volume.
- There is no previous dial bank or synthesized fallback in the final detent route. A failed media play retries the same embedded recording instead.

The background ambience remains the smooth 21-second vault-room tone. Correct-number, incorrect-number, intro, and vault-opening cues remain separate and unchanged.
