-- Branch and PR deployments can migrate the same database concurrently.
-- A single DO statement keeps the lock and all DDL in one transaction even
-- when the migration runner does not supply an outer transaction.
DO $rps$ BEGIN
PERFORM pg_advisory_xact_lock(hashtext('hand-of-doom-schema-v1'));
CREATE TABLE IF NOT EXISTS rps_sessions (
  token_hash TEXT PRIMARY KEY, player JSONB NOT NULL, expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS rps_matches (
  id TEXT PRIMARY KEY, state JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS rps_results (
  game_id TEXT PRIMARY KEY, player_a TEXT NOT NULL, player_b TEXT NOT NULL,
  name_a TEXT NOT NULL, name_b TEXT NOT NULL, winner TEXT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS rps_results_a ON rps_results(player_a, completed_at DESC);
CREATE INDEX IF NOT EXISTS rps_results_b ON rps_results(player_b, completed_at DESC);
CREATE INDEX IF NOT EXISTS rps_matches_recent ON rps_matches(updated_at DESC);
END $rps$;
