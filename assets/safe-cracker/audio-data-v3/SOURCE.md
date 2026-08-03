# Safe Cracker dial sample v18

Source supplied by the user: `freesound_community-bank-vault-100469.mp3`.

Processing:
- Inspected the 12.072-second stereo recording and selected clean detents from its three mechanical dial sequences.
- Extracted six 90 ms detent clips.
- Converted each clip to mono, high-passed at 180 Hz, low-passed at 10 kHz, lightly compressed, peak-matched, and faded to remove cut edges.
- Encoded as compact 32 kHz mono MP3 payloads for WebAudio playback.
- The game rotates through all six clips with only subtle playback-rate variation.

The uploaded recording is used only for Safe Cracker dial movement. Correct-number, incorrect-number, intro, ambience, and vault-opening cues remain separate.
