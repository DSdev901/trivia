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
  extracted_text TEXT,
  question TEXT,
  answer TEXT,
  trivia_date DATE
);

ALTER TABLE photos ADD COLUMN IF NOT EXISTS question TEXT;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS answer TEXT;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS trivia_date DATE;

CREATE INDEX IF NOT EXISTS photos_created_at_idx ON photos (created_at DESC);
CREATE INDEX IF NOT EXISTS photos_trivia_date_idx ON photos (trivia_date DESC);
