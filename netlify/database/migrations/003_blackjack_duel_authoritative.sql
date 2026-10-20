CREATE TABLE IF NOT EXISTS blackjack_duel_matches (
  game_id TEXT PRIMARY KEY,
  round_id TEXT NOT NULL,
  state JSONB NOT NULL,
  revision BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS blackjack_duel_matches_updated_idx
  ON blackjack_duel_matches (updated_at DESC);
