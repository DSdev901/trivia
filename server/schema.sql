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

CREATE TABLE IF NOT EXISTS site_stats (
  key TEXT PRIMARY KEY,
  value BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS hit_rate (
  ip TEXT PRIMARY KEY,
  last_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One-time: drop the vanity 901 seed so the tally is actual counted visits.
UPDATE site_stats
SET value = GREATEST(0, value - 900)
WHERE key = 'hits'
  AND NOT EXISTS (
    SELECT 1 FROM site_stats s2 WHERE s2.key = 'hits_base_zero'
  );

INSERT INTO site_stats (key, value) VALUES ('hits_base_zero', 1)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS guestbook (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS guestbook_created_at_idx ON guestbook (created_at DESC);

CREATE TABLE IF NOT EXISTS guestbook_rate (
  ip TEXT PRIMARY KEY,
  last_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
