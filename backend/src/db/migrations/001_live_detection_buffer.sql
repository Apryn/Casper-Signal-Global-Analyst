-- ============================================================
-- Migration: Add live_detection_buffer table
-- Safe (non-destructive) - only creates if not exists
-- Run on VPS: psql $DATABASE_URL -f this_file.sql
-- ============================================================

-- Tabel untuk persistent 2-strike confirmation buffer
-- Sebelumnya menggunakan in-memory Map yang hilang setiap PM2 restart
CREATE TABLE IF NOT EXISTS live_detection_buffer (
    channel_id    VARCHAR(100) PRIMARY KEY,
    video_id      VARCHAR(50)  NOT NULL,
    display_name  VARCHAR(255) NOT NULL,
    first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_detection_buffer_first_seen 
  ON live_detection_buffer(first_seen_at);
