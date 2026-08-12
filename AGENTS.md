# Repository Instructions

These instructions apply to the entire `Tye1029/multiplayer-roulette-game`
repository. Preserve user changes and follow narrower `AGENTS.md` files if any
are added later.

## Git and pull request boundaries

- Perform Summit Sprint work only on `mountain-race-development`.
- PR #20 must remain open, draft, and unmerged with base branch
  `safe-cracker-development`.
- Do not modify, merge, rebase, or force-push `main`.
- Before changing files, fetch the remote, verify the current branch/HEAD, and
  inspect the working tree for unrelated changes.
- Stage and commit only files that belong to the requested change. Never discard
  or overwrite unrelated user work.
- Do not merge PR #20. Push completed, validated changes to
  `mountain-race-development` and report the commit SHA.

## Protected games

- Do not directly modify protected Roulette or Safe Cracker source files unless
  the user explicitly expands the task to those games.
- Never weaken, remove, or bypass Roulette, Safe Cracker, multiplayer, gameplay,
  networking, or protected-file validation to make a Summit Sprint check pass.
- Run the existing protected-game regression checks whenever a shared runtime or
  build-pipeline change could affect another game.

## Summit Sprint invariants

- Preserve the 24 authoritative directional holds and their server-owned order.
- Preserve live directional controls, climbers, the next-four-move system,
  wrong-input fall/slip behavior, continuous competitive input, Remote Network
  Bot behavior, multiplayer synchronization, rematches, and mobile controls.
- Preserve the completed-race result overlay, winner celebration, confetti, and
  accurate winner/loser labels.
- Keep climbing symbols aligned with visible physical rock ledges on both lanes.
  Opponent upcoming ledges must remain visible before the opponent reaches them.
- Camera movement and climber travel must remain smooth and must not expose an
  empty band above the summit.
- Treat the current V47 Summit Sprint finish presentation and V48 shared-runtime
  stability pass as the minimum working baseline unless the user asks to replace
  them.

## Visual and asset work

- Use real image files under `assets/mountain-race/images/`; do not transport PNG
  assets as base64 source chunks when the filesystem is available.
- Preserve image aspect ratios. Do not stretch, repeat, polygon-mask, or reshape
  reference art into artificial vertical UI panels.
- Keep directional arrows and other gameplay indicators as live overlays above
  physical ledge artwork.
- When the user asks to preview a new visual direction, show the preview and wait
  for approval before integrating it into the game.
- Favor optimized, reusable PNG assets and lightweight animation techniques that
  keep the game responsive on mobile hardware.

## Validation and delivery

- Run `npm run build` after implementation. Also run the relevant targeted
  Summit Sprint validators and any affected protected-game validators.
- Test meaningful visual or interaction changes in the browser at desktop and
  mobile viewport sizes. For finish-flow work, complete or observe a full live
  race on the Netlify preview.
- Verify deployed image assets are served with the expected MIME type and confirm
  the Netlify PR preview contains the new cache/version marker.
- Use the existing Netlify deploy preview for PR #20:
  `https://deploy-preview-20--famous-piroshki-b621da.netlify.app/`.
- In the final handoff, summarize the change, validation results, final commit
  SHA, GitHub Actions status, and preview URL. Explicitly confirm that PR #20 is
  still open, draft, and unmerged.
