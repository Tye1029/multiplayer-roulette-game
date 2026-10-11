# Summit Sprint server integration

This folder contains the isolated authoritative multiplayer rules for the `mountainrace` mode.

- `state-model.js` defines the 30-hold sequence, 60-second timer, one-hold wrong-input penalty, duplicate-action protection, prompt privacy, and winner state.
- `integration.js` connects those rules to the shared duel create/join lifecycle, focused polling, simple NPC testing, Remote Network Bot testing, refresh restoration, timeout settlement, and rematches.

Only each viewer's next four prompts are returned publicly. The full sequence remains server-side. Existing Roulette and Safe Cracker assets are not modified by these modules.

V75 commands include four single arrows and four vertical+horizontal pairs. Every generated four-command window is unique; both players share the same server-owned course. Existing rooms retain their saved sequence and deadline.
