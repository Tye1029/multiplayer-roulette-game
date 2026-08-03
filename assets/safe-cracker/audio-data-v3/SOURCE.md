# Safe Cracker dial sample v21

Source supplied by the user: `freesound_community-bank-vault-100469.mp3`.

Dial processing:
- Uses the six longer 190 ms physical detent clips extracted from the three real dial sequences in the uploaded recording.
- The clips retain their original pitch and metallic body.
- Runtime playback now uses preloaded native HTML audio voices instead of Android WebAudio MP3 decoding.
- Two voices are maintained per sample so fast dial movement can overlap without cutting off the previous click.
- A short dry, non-tonal mechanical fallback is used only while the native sample bank is still loading or if media playback fails.

Background ambience:
- The repeating recorded ambience loop and its recurring loud mechanical impacts are no longer used during Safe Cracker gameplay.
- It is replaced at runtime by a quiet 21-second seamless filtered vault-room air tone.
- The room tone contains no impact, latch, scrape, or other repeating foreground event.

Correct-number, incorrect-number, intro, and vault-opening cues remain separate and unchanged.
