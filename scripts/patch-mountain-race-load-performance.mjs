// Summit Sprint build chain: apply load-performance safeguards, state synchronization,
// race-state-first ordering, then the final reliable-input persistence repair.
await import('./patch-mountain-race-load-performance-core.mjs');
await import('./patch-mountain-race-state-sync.mjs');
await import('./patch-mountain-race-authoritative-order-v2.mjs');
await import('./patch-mountain-race-reliable-inputs-v3.mjs');
