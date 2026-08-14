CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  original_name TEXT,
  mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
  width INTEGER,
  height INTEGER,
  byte_size INTEGER NOT NULL,
  image BYTEA NOT NULL,
  thumb BYTEA,
  note TEXT,
  extracted_text TEXT
);

CREATE INDEX IF NOT EXISTS photos_created_at_idx ON photos (created_at DESC);
