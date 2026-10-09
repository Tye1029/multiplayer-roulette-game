# Three-stage Safe Cracker — heist28

New rounds are a 180-second race through eight fasteners, ten wires, and the
existing three tumblers. Existing persisted version-one rounds retain their
60-second dial-only rules. The shared account, authentication, balance, lobby,
result receipt, rematch and admin/API paths remain in use.

`netlify/functions/safe-cracker/heist.js` owns randomized puzzles and tool rules.
`_data.js` applies those actions under the existing multiplayer lock, revision,
idempotency and completion guards. A new round generates fresh private puzzles.
The opponent receives only phase and progress counts. The viewer’s own note is preloaded privately for instant pickup; it is rendered
only while open. Opponents receive no note or screw layout. The server-owned
card-open flag still rejects cuts until the preceding close action is committed.

The shared `heist-catalog.js` defines 24 distinct head symbols and their matching
printed driver marks. Each new panel selects six types, includes all six plus two
random duplicates across eight sockets, and supplies exactly those six drivers.
The server rejects drivers outside that player’s kit. Legacy rounds derive their
kit from their existing screws. Five routing families independently randomize
the wire arrangement, terminal crossings, and bends; every wire retains a clear
center cutting span. Physical wire order is independent of randomized note order.
A mismatched driver strips a screw. Three subsequent correct uses remove it;
another incorrect use does not erase earned turns. Removed screws stay removed.

Each wire can be cut once. An incorrect wire stays cut, adds a fault and is
skipped when its place in the order arrives, until five faults trigger an automatic loss. Existing twelve-wire rounds retain
their original wire count.
One fault hides the central number, two map yellow feedback to orange, and three
mask every proximity tier. Correct latches and locked digits remain available.
There is no client-only penalty that can reveal the true proximity in a response.

The browser's `heist.js` owns drag-only pointer tools, card
focus, and stable board updates. `heist.css` scopes the new shell and dial finish.
The generated backplate is static; wires, screws, tools and feedback are live.
`heist-input.js` immediately projects each tool action, serializes writes, and
reconciles action-ID acknowledgments without replaying effects. Failed requests
retry once with the same ID, then roll back to the last authoritative state.
Quitting or rematching discards outstanding presentation work. Dial checks retain
the authoritative 500ms interval; the dial stage unlocks after wire writes settle.
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

Validation: `node scripts/validate-safe-cracker-heist.mjs`,
`node scripts/validate-safe-cracker-heist-input.mjs`, plus `npm run build`.
The behavioral test covers randomized plans, stripping, private cards, cut
penalties, bot progression, actor/phase/deadline guards, duplicate requests,
legacy compatibility and fresh rematch state.

## Color assistance and kit presentation

The compact Color assist menu provides Off, Protan, Deutan, and Tritan display
palettes, with labeled original/adjusted samples. The choice is stored locally.
These are alternative palettes, not medical simulations; users can compare them
to choose what they can distinguish. Wire-name labels remain visible in all
modes, following https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html .
The option never changes wire identities, order, penalties, or note ink.

The solid metal case, fitted tool recesses, head marks, and colored wire-guide
strips are lightweight live CSS/SVG. The old roll, straps, stitching, and
transparent disabled-tool treatment have been removed. No new bitmap media is required. Replaced
six-head artwork, rigid parallel-wire generator, and old kit styles were removed;
existing texture/audio files remain referenced runtime or validation inputs.

Additional validation: `node scripts/validate-safe-cracker-kit.mjs`.

## Stage flow and result report

The cutter ghost anchors its jaw opening at the pointer, including while rotated.
Only cable strokes accept cuts; labels, sockets and off-wire drops do not. Outer
wire bundles have asymmetric crossings while the central cutting lanes stay clear.

The countdown restores the rotating vault mechanism and six staggered locking
bolts. Panel removal tilts the plate away; wiring completion rotates the back out
and the front in. Polls do not restart these transitions, round changes cancel
pending transitions, and reduced-motion users get a short static handoff.

Server-owned per-player metrics record stage completion timestamps and wrong
screwdriver/wire/dial actions through the existing idempotent write path. Timing
includes the short stage handoffs and server confirmation, equally for both
players. Results compare both players' stage times and misses, explicitly label
unfinished/unreached stages, and freeze elapsed time at completion. Older rounds
without metrics retain their legacy report rather than inventing stage times.
The dial-only result renderer remains necessary for those persisted rounds.

No media files became unused: this pass reuses existing textures and removes
superseded kit styles and markup directly, without adding bitmap downloads.
