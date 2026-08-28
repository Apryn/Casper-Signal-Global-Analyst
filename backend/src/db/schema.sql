-- Initialize schema for Casper Signal Analytics Dashboard
-- Schema setup for Casper Signal Analytics (Non-destructive: CREATE TABLE IF NOT EXISTS)

-- 1. Users table (for dashboard access)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    nama VARCHAR(255) NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('Admin', 'Global Analyst')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Streamers table
CREATE TABLE IF NOT EXISTS streamers (
    id SERIAL PRIMARY KEY,
    nama VARCHAR(255) UNIQUE NOT NULL,
    platform VARCHAR(100) NOT NULL DEFAULT 'TikTok',
    telegram_username VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Daily reports table
CREATE TABLE IF NOT EXISTS daily_reports (
    id SERIAL PRIMARY KEY,
    tanggal DATE NOT NULL,
    streamer_id INTEGER NOT NULL REFERENCES streamers(id) ON DELETE CASCADE,
    kategori VARCHAR(50) NOT NULL CHECK (kategori IN ('Streaming', 'Non Streaming')),
    tiktok_upload INTEGER NOT NULL DEFAULT 0,
    youtube_upload INTEGER NOT NULL DEFAULT 0,
    instagram_upload INTEGER NOT NULL DEFAULT 0,
    facebook_upload INTEGER NOT NULL DEFAULT 0,
    live_duration NUMERIC(5,2) NOT NULL DEFAULT 0.0,
    reported_live_duration NUMERIC(5,2) DEFAULT NULL,
    chat_count INTEGER NOT NULL DEFAULT 0,
    registration_count INTEGER NOT NULL DEFAULT 0,
    ftd_count INTEGER NOT NULL DEFAULT 0,
    raw_message TEXT,
    content_submitted BOOLEAN DEFAULT FALSE,
    content_link TEXT,
    status_izin VARCHAR(50) DEFAULT NULL,
    catatan_izin TEXT DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_date_streamer UNIQUE (tanggal, streamer_id)
);

-- 4. Targets management table
CREATE TABLE IF NOT EXISTS targets (
    id SERIAL PRIMARY KEY,
    streamer_id INTEGER NOT NULL REFERENCES streamers(id) ON DELETE CASCADE,
    target_type VARCHAR(50) NOT NULL CHECK (target_type IN ('live_duration', 'uploads', 'registrations', 'ftds')),
    target_value NUMERIC(10,2) NOT NULL,
    period VARCHAR(50) NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_streamer_target_period UNIQUE (streamer_id, target_type, period)
);

-- 5. Calculated scoring history
CREATE TABLE IF NOT EXISTS scores (
    id SERIAL PRIMARY KEY,
    streamer_id INTEGER NOT NULL REFERENCES streamers(id) ON DELETE CASCADE,
    score NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_streamer_score_date UNIQUE (streamer_id, date)
);

-- 6. Streamer Accounts table
CREATE TABLE IF NOT EXISTS streamer_accounts (
    id SERIAL PRIMARY KEY,
    streamer_id INTEGER NOT NULL REFERENCES streamers(id) ON DELETE CASCADE,
    platform VARCHAR(100) NOT NULL CHECK (platform IN ('TikTok', 'YouTube', 'Instagram', 'Facebook')),
    username VARCHAR(255) NOT NULL,
    link VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_streamer_platform_username UNIQUE (streamer_id, platform, username)
);

-- 7. Social media contents catalog
CREATE TABLE IF NOT EXISTS content (
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
CREATE TABLE IF NOT EXISTS schedule (
    id SERIAL PRIMARY KEY,
    streamer_id INTEGER NOT NULL REFERENCES streamers(id) ON DELETE CASCADE,
    platform VARCHAR(100) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Live', 'Completed', 'Cancelled')),
    actual_start_time TIMESTAMP WITH TIME ZONE,
    actual_end_time TIMESTAMP WITH TIME ZONE,
    live_duration NUMERIC(5,2) DEFAULT 0,
    lateness_minutes INTEGER DEFAULT 0,
    substitute_streamer_id INTEGER REFERENCES streamers(id) ON DELETE SET NULL,
    is_sick BOOLEAN DEFAULT FALSE,
    live_link TEXT,
    pre_live_submitted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Weekly Evaluations table
CREATE TABLE IF NOT EXISTS weekly_evaluations (
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
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    streamer_id INTEGER REFERENCES streamers(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Unsent' CHECK (status IN ('Unsent', 'Sent', 'Failed')),
    type VARCHAR(50) NOT NULL CHECK (type IN ('Report Reminder', 'Achievement', 'Alert')),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Configuration key-values
CREATE TABLE IF NOT EXISTS config (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_reports_tanggal ON daily_reports(tanggal);
CREATE INDEX IF NOT EXISTS idx_reports_streamer ON daily_reports(streamer_id);
CREATE INDEX IF NOT EXISTS idx_targets_streamer ON targets(streamer_id);
CREATE INDEX IF NOT EXISTS idx_content_streamer ON content(streamer_id);
CREATE INDEX IF NOT EXISTS idx_schedule_streamer ON schedule(streamer_id);
CREATE INDEX IF NOT EXISTS idx_schedule_times ON schedule(start_time, end_time);

