-- Initialize schema for Casper Signal Analytics Dashboard

-- Drop tables if they exist
DROP TABLE IF EXISTS daily_reports;
DROP TABLE IF EXISTS streamers;
DROP TABLE IF EXISTS users;

-- 1. Users table (for dashboard access)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    nama VARCHAR(255) NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('Admin', 'Global Analyst')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Streamers table
CREATE TABLE streamers (
    id SERIAL PRIMARY KEY,
    nama VARCHAR(255) UNIQUE NOT NULL,
    platform VARCHAR(100) NOT NULL DEFAULT 'TikTok',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Daily reports table
CREATE TABLE daily_reports (
    id SERIAL PRIMARY KEY,
    tanggal DATE NOT NULL,
    streamer_id INTEGER NOT NULL REFERENCES streamers(id) ON DELETE CASCADE,
    kategori VARCHAR(50) NOT NULL CHECK (kategori IN ('Streaming', 'Non Streaming')),
    tiktok_upload INTEGER NOT NULL DEFAULT 0,
    youtube_upload INTEGER NOT NULL DEFAULT 0,
    instagram_upload INTEGER NOT NULL DEFAULT 0,
    facebook_upload INTEGER NOT NULL DEFAULT 0,
    live_duration NUMERIC(5,2) NOT NULL DEFAULT 0.0,
    chat_count INTEGER NOT NULL DEFAULT 0,
    registration_count INTEGER NOT NULL DEFAULT 0,
    ftd_count INTEGER NOT NULL DEFAULT 0,
    raw_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_date_streamer UNIQUE (tanggal, streamer_id)
);

-- Indexing for performance
CREATE INDEX idx_reports_tanggal ON daily_reports(tanggal);
CREATE INDEX idx_reports_streamer ON daily_reports(streamer_id);
