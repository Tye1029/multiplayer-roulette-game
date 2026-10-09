# Three-stage Safe Cracker — heist26

New rounds are a 180-second race through eight fasteners, twelve wires, and the
existing three tumblers. Existing persisted version-one rounds retain their
60-second dial-only rules. The shared account, authentication, balance, lobby,
result receipt, rematch and admin/API paths remain in use.

`netlify/functions/safe-cracker/heist.js` owns randomized puzzles and tool rules.
`_data.js` applies those actions under the existing multiplayer lock, revision,
idempotency and completion guards. A new round generates fresh private puzzles.
The opponent receives only phase and progress counts. The note order is sent
only while its server-owned card-open flag is set; cuts are rejected while open.

The six head symbols are flat, cross, Pozi, hex, star and tri-wing. Every panel
contains all six and two random duplicates, shuffled across eight sockets.
A mismatched driver strips a screw. Three subsequent correct uses remove it;
another incorrect use does not erase earned turns. Removed screws stay removed.

Each wire can be cut once. An incorrect wire stays cut, adds a fault and is
skipped when its place in the order arrives, so every puzzle remains solvable.
One fault hides the central number, two map yellow feedback to orange, and three
mask every proximity tier. Correct latches and locked digits remain available.
There is no client-only penalty that can reveal the true proximity in a response.

The browser's `heist.js` owns pointer dragging, tap/keyboard alternatives, card
focus, and stable board updates. `heist.css` scopes the new shell and dial finish.
The generated backplate is static; wires, screws, tools and feedback are live.
No per-frame work runs while idle. Drag painting uses one animation-frame request
at a time; sparks, panel removal and opening light have bounded durations.

## Artwork and cleanup

Runtime asset: `images/safe-interior-v1.png`, 1200 × 800, 771,588 bytes. Generated
with the built-in image tool, then resized and PNG palette-optimized with Sharp.
The 3:2 source composition is preserved; CSS cover crops instead of stretching.
Original source is retained outside the deployed repository in the session's
generated image archive (`exec-b9a2beaf-f2cc-483c-9f14-3f1f945c676a.png`).

Generation prompt:

> Use case: product-mockup. Asset type: photorealistic game background texture for
> the exposed interior behind a bank safe's back access panel, horizontal 3:2
> composition. Front-on orthographic view, perfectly centered rectangular recessed
> compartment, uniform dark slate gunmetal steel frame and backplate, fine
> authentic machined scratches, subtle cold blue-gray highlights with natural
> neutral color. High-end believable industrial safe mechanism: small brass
> terminals and ceramic electrical connector rails along the left and right
> margins, a few relays and lock components at the top and lower edges, mounting
> sockets, layered steel depths, cool ambient bank lighting. The central seventy
> percent must be relatively uncluttered dark steel, ready for twelve live colored
> wire paths to be laid across it in code. No loose wires, no large cable bundles,
> no visible screws in the central region, no padlocks, no text or numbers, no
> dials, no tools, no people, no dramatic perspective. Real crisp metal rather than
> leather or coarse noise. Fill entire image edge to edge; no surrounding room.
> This is a finished game asset, not a mockup of a screen or UI.

No existing image or sound is superseded by this addition. The former SVG dial
remains an editable rebuild/validation source, as documented in the game's
SOURCE.md; legacy dial UI still renders persisted one-minute games. Historical
patches and their required inputs remain build/validation dependencies. New
interior media loads only when Safe Cracker's existing asset warm-up is invoked.
Local test servers, screenshots and full-resolution source art are not deployed.

Validation: `node scripts/validate-safe-cracker-heist.mjs` plus `npm run build`.
The behavioral test covers randomized plans, stripping, private cards, cut
penalties, bot progression, actor/phase/deadline guards, duplicate requests,
legacy compatibility and fresh rematch state.
