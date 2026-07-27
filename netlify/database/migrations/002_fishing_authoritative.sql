CREATE TABLE IF NOT EXISTS fishing_matches (
  game_id TEXT PRIMARY KEY,
  round_id TEXT NOT NULL,
  state JSONB NOT NULL,
  revision BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS fishing_actions (
  game_id TEXT NOT NULL REFERENCES fishing_matches(game_id) ON DELETE CASCADE,
  action_id TEXT NOT NULL,
  sequence BIGINT NOT NULL,
  user_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  accepted BOOLEAN NOT NULL DEFAULT FALSE,
  reason TEXT NOT NULL DEFAULT '',
  action_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (game_id, action_id),
  UNIQUE (game_id, sequence)
);
CREATE INDEX IF NOT EXISTS fishing_actions_game_sequence_idx ON fishing_actions(game_id, sequence);
CREATE INDEX IF NOT EXISTS fishing_actions_game_event_idx ON fishing_actions(game_id, event_id);
