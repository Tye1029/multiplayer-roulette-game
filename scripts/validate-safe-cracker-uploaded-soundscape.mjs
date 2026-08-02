// Compatibility entry point retained for the dedicated uploaded-soundscape workflow.
// V13 validation is centralized in the main audio validator so every build checks
// the same asset hashes, runtime wiring, Android unlock, and protected boundaries.
await import('./validate-safe-cracker-audio.mjs');

console.log('Safe Cracker uploaded soundscape v13 validation passed through the canonical recorded-audio validator.');
