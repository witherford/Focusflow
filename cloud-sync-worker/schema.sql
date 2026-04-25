CREATE TABLE IF NOT EXISTS blobs (
  sync_code     TEXT PRIMARY KEY,
  ciphertext    TEXT NOT NULL,
  last_updated  INTEGER NOT NULL,
  size_bytes    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_blobs_updated ON blobs(last_updated);
