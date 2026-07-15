-- Initialize schema for Casper Signal Analytics Dashboard

-- Drop tables if they exist
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS schedule CASCADE;
DROP TABLE IF EXISTS content CASCADE;
DROP TABLE IF EXISTS scores CASCADE;
DROP TABLE IF EXISTS targets CASCADE;
DROP TABLE IF EXISTS daily_reports CASCADE;
DROP TABLE IF EXISTS weekly_evaluations CASCADE;
DROP TABLE IF EXISTS streamer_accounts CASCADE;
DROP TABLE IF EXISTS streamers CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS config CASCADE;


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
    telegram_username VARCHAR(100),
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

-- 4. Targets management table
CREATE TABLE targets (
    id SERIAL PRIMARY KEY,
    streamer_id INTEGER NOT NULL REFERENCES streamers(id) ON DELETE CASCADE,
    target_type VARCHAR(50) NOT NULL CHECK (target_type IN ('live_duration', 'uploads', 'registrations', 'ftds')),
    target_value NUMERIC(10,2) NOT NULL,
    period VARCHAR(50) NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_streamer_target_period UNIQUE (streamer_id, target_type, period)
);

-- 5. Calculated scoring history
CREATE TABLE scores (
    id SERIAL PRIMARY KEY,
    streamer_id INTEGER NOT NULL REFERENCES streamers(id) ON DELETE CASCADE,
    score NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_streamer_score_date UNIQUE (streamer_id, date)
);

-- 6. Streamer Accounts table
CREATE TABLE streamer_accounts (
    id SERIAL PRIMARY KEY,
    streamer_id INTEGER NOT NULL REFERENCES streamers(id) ON DELETE CASCADE,
    platform VARCHAR(100) NOT NULL CHECK (platform IN ('TikTok', 'YouTube', 'Instagram', 'Facebook')),
    username VARCHAR(255) NOT NULL,
    link VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_platform_username UNIQUE (platform, username)
);

-- 7. Social media contents catalog
CREATE TABLE content (
    id SERIAL PRIMARY KEY,
    streamer_id INTEGER NOT NULL REFERENCES streamers(id) ON DELETE CASCADE,
    platform VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    upload_date DATE NOT NULL,
    link VARCHAR(500),
    views INTEGER NOT NULL DEFAULT 0,
    likes INTEGER NOT NULL DEFAULT 0,
    comments INTEGER NOT NULL DEFAULT 0,
    shares INTEGER NOT NULL DEFAULT 0,
    account_id INTEGER REFERENCES streamer_accounts(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Streaming timetables (Live Scheduler)
CREATE TABLE schedule (
    id SERIAL PRIMARY KEY,
    streamer_id INTEGER NOT NULL REFERENCES streamers(id) ON DELETE CASCADE,
    platform VARCHAR(100) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Live', 'Completed', 'Cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Weekly Evaluations table
CREATE TABLE weekly_evaluations (
    id SERIAL PRIMARY KEY,
    streamer_id INTEGER NOT NULL REFERENCES streamers(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    stats JSONB NOT NULL,
    targets JSONB NOT NULL,
    peak_hour VARCHAR(50),
    kelebihan TEXT,
    kekurangan TEXT,
    rekomendasi TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_streamer_weekly_eval UNIQUE (streamer_id, start_date)
);

-- 10. Bot notifications audit logs
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    streamer_id INTEGER REFERENCES streamers(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Unsent' CHECK (status IN ('Unsent', 'Sent', 'Failed')),
    type VARCHAR(50) NOT NULL CHECK (type IN ('Report Reminder', 'Achievement', 'Alert')),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Configuration key-values
CREATE TABLE config (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexing for performance
CREATE INDEX idx_reports_tanggal ON daily_reports(tanggal);
CREATE INDEX idx_reports_streamer ON daily_reports(streamer_id);
CREATE INDEX idx_targets_streamer ON targets(streamer_id);
CREATE INDEX idx_content_streamer ON content(streamer_id);
CREATE INDEX idx_schedule_streamer ON schedule(streamer_id);
CREATE INDEX idx_schedule_times ON schedule(start_time, end_time);

