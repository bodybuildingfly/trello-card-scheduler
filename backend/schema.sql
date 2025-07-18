-- Creates the necessary tables if they do not already exist.
-- This script is safe to run multiple times.

CREATE TABLE IF NOT EXISTS records (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    owner_name VARCHAR(255) NOT NULL,
    frequency VARCHAR(50),
    frequency_interval INTEGER DEFAULT 1,
    frequency_details VARCHAR(255),
    trigger_hour INTEGER,
    trigger_minute INTEGER,
    trigger_ampm VARCHAR(2),
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    active_card_id VARCHAR(255),
    last_card_created_at TIMESTAMPTZ,
    needs_new_card BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    level VARCHAR(10),
    message TEXT,
    details JSONB
);

CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
