# Summit Sprint server module

This folder contains server-only helpers for the `mountainrace` duel mode.

It is intentionally not exposed as its own Netlify endpoint and is not yet imported by the shared duel function. The mode will be connected only after its authoritative race rules, persistence, refresh recovery, NPC timing, and winner settlement tests are ready.

Keeping these helpers in a dedicated folder prevents early Summit Sprint work from changing the existing Roulette and Safe Cracker request paths.
