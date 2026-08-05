// Summit Sprint build chain. The core load fix stopped unchanged network polls from rebuilding the complete mountain DOM; later stages add state synchronization, race-state-first ordering, reliable input persistence, confirmed-first low-latency responses, and updated tests.
await import('./patch-mountain-race-load-performance-core.mjs');
await import('./patch-mountain-race-state-sync.mjs');
await import('./patch-mountain-race-authoritative-order-v2.mjs');
await import('./patch-mountain-race-reliable-inputs-v3.mjs');
await import('./patch-mountain-race-reliable-validator-v3.mjs');
await import('./patch-mountain-race-low-latency-inputs-v4.mjs');
await import('./patch-mountain-race-low-latency-validator-v4.mjs');
