# Safe Cracker dial sample v20

Source supplied by the user: `freesound_community-bank-vault-100469.mp3`.

Processing:
- Inspected the 12.072-second stereo bank-vault recording and identified its three real mechanical dial sequences.
- Extracted six longer 190 ms windows around distinct physical detents, including material from all three sequences.
- Converted the clips to 24 kHz mono, removed only subsonic rumble below 45 Hz, peak-matched them to -2.5 dBFS, and added tiny edge fades.
- Preserved the original recorded pitch and metallic body; no brightening filter, pitch variation, compression, or generated ratchet layer is used for the dial.
- The base64 MP3 text is fetched immediately when the page loads, then decoded as soon as Android unlocks WebAudio on the first interaction.
- If the first dial step happens while decoding finishes, that real recorded click is queued for up to 650 ms rather than being dropped silently.
- Runtime sample gain is 1.18 before the existing Safe Cracker compressor, making the clicks clearly audible without bypassing the game audio bus.

The uploaded recording is used only for Safe Cracker dial movement. Correct-number, incorrect-number, intro, ambience, and vault-opening cues remain separate and unchanged.
