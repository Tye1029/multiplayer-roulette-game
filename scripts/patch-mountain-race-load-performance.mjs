// Summit Sprint build chain: first apply the load-performance core that stopped unchanged network polls from rebuilding the complete mountain DOM, then add state synchronization, then apply the race-state-first authoritative ordering repair.
await import('./patch-mountain-race-load-performance-core.mjs');
await import('./patch-mountain-race-state-sync.mjs');
await import('./patch-mountain-race-authoritative-order-v2.mjs');
