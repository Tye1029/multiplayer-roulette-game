// Summit Sprint build chain. The core load fix stopped unchanged network polls from rebuilding the complete mountain DOM; later stages add state synchronization, reliable persistence, immediate queued controls, a continuous private input runway, and component-wise opponent synchronization.
await import('./patch-mountain-race-load-performance-core.mjs');
await import('./patch-mountain-race-state-sync.mjs');
await import('./patch-mountain-race-authoritative-order-v2.mjs');
await import('./patch-mountain-race-reliable-inputs-v3.mjs');
await import('./patch-mountain-race-reliable-validator-v3.mjs');
await import('./patch-mountain-race-low-latency-inputs-v4.mjs');
await import('./patch-mountain-race-low-latency-validator-v4.mjs');
await import('./patch-mountain-race-instant-input-queue-v5.mjs');
await import('./patch-mountain-race-instant-input-validator-v5.mjs');
await import('./patch-mountain-race-continuous-sync-server-v6.mjs');
await import('./patch-mountain-race-continuous-sync-client-v6.mjs');
await import('./patch-mountain-race-continuous-sync-validator-v6.mjs');
