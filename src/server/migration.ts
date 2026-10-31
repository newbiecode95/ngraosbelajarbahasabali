export const migrationSql = `
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS players (
 id text PRIMARY KEY, auth_user_id uuid UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
 name text NOT NULL, locale text NOT NULL DEFAULT 'id' CHECK(locale IN ('id','en')),
 demo_token_hash text UNIQUE, expires_at timestamptz, xp integer NOT NULL DEFAULT 0 CHECK(xp>=0),
 streak integer NOT NULL DEFAULT 0, last_active_date text, stars jsonb NOT NULL DEFAULT '{}',
 albums jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS game_sessions (
 id text PRIMARY KEY, player_id text NOT NULL REFERENCES players(id) ON DELETE CASCADE,
 level_id text NOT NULL CHECK(level_id IN ('warung','kos','pasar','boss')),
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','quiz','completed')),
 turns jsonb NOT NULL DEFAULT '[]', completed_objectives jsonb NOT NULL DEFAULT '[]',
 hints_used integer NOT NULL DEFAULT 0, quiz jsonb, result jsonb,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS game_sessions_player_idx ON game_sessions(player_id,updated_at DESC);
CREATE TABLE IF NOT EXISTS corpus_entries (
 id text PRIMARY KEY, entry jsonb NOT NULL, embedding vector(1536), embedding_model text,
 enabled boolean NOT NULL DEFAULT true, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS corpus_embedding_idx ON corpus_entries USING hnsw (embedding vector_cosine_ops);
CREATE TABLE IF NOT EXISTS mistakes (
 id text PRIMARY KEY, player_id text NOT NULL REFERENCES players(id) ON DELETE CASCADE,
 session_id text NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
 turn_id text NOT NULL, correction jsonb NOT NULL, source_id text NOT NULL REFERENCES corpus_entries(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mistakes_session_idx ON mistakes(session_id);
CREATE TABLE IF NOT EXISTS reward_events (
 id text PRIMARY KEY, player_id text NOT NULL REFERENCES players(id) ON DELETE CASCADE,
 session_id text NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
 xp integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ai_usage (
 id text PRIMARY KEY, player_id text REFERENCES players(id) ON DELETE CASCADE,
 stage text NOT NULL, model text NOT NULL, provider text, input_tokens integer NOT NULL DEFAULT 0,
 output_tokens integer NOT NULL DEFAULT 0, latency_ms integer NOT NULL,
 metadata jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_usage_created_idx ON ai_usage(created_at DESC);
CREATE TABLE IF NOT EXISTS rate_limits (
 key text PRIMARY KEY, count integer NOT NULL DEFAULT 1, resets_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS reports (
 id text PRIMARY KEY, player_id text NOT NULL REFERENCES players(id) ON DELETE CASCADE,
 session_id text REFERENCES game_sessions(id) ON DELETE CASCADE, turn_id text, message text NOT NULL,
 resolved boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS app_settings (key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
INSERT INTO schema_migrations(id) VALUES ('0001_initial') ON CONFLICT DO NOTHING;
`;
