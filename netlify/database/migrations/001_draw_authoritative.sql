CREATE TABLE IF NOT EXISTS draw_matches (
  game_id TEXT PRIMARY KEY,
  round_id TEXT NOT NULL,
  state JSONB NOT NULL,
  revision BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS draw_actions (
  game_id TEXT NOT NULL,
  action_id TEXT NOT NULL,
  sequence BIGINT NOT NULL,
  user_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  action_kind TEXT NOT NULL,
  delta INTEGER NOT NULL DEFAULT 0,
  action_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (game_id, action_id),
  UNIQUE (game_id, sequence)
);

CREATE INDEX IF NOT EXISTS draw_actions_game_sequence_idx
  ON draw_actions (game_id, sequence DESC);

CREATE INDEX IF NOT EXISTS draw_actions_game_user_idx
  ON draw_actions (game_id, user_id, sequence DESC);
