-- =============================================================================
-- Trello Card Scheduler Schema
-- =============================================================================
-- This file defines the database structure for the application.
-- It is executed on application startup to ensure all tables exist.
-- =============================================================================


-- =============================================================================
-- Table: users
-- Description: Stores user accounts, credentials, and roles for authentication.
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- =============================================================================
-- Table: records
-- Description: Stores the configuration for each recurring Trello card schedule.
-- =============================================================================
CREATE TABLE IF NOT EXISTS records (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    owner_name VARCHAR(255),
    description TEXT,
    frequency VARCHAR(50) NOT NULL DEFAULT 'once',
    frequency_interval INTEGER DEFAULT 1,
    frequency_details VARCHAR(255),
    trigger_hour VARCHAR(2),
    trigger_minute VARCHAR(2),
    trigger_ampm VARCHAR(2),
    start_date DATE,
    end_date DATE,
    active_card_id VARCHAR(255),
    last_card_created_at TIMESTAMP WITH TIME ZONE,
    needs_new_card BOOLEAN DEFAULT TRUE
);


-- =============================================================================
-- Table: settings
-- Description: A key-value store for global application settings, such as
--              API keys and Trello board/list IDs.
-- =============================================================================
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT
);


-- =============================================================================
-- Table: audit_logs
-- Description: Stores a log of important events and errors that occur within
--              the application for debugging and monitoring purposes.
-- =============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    level VARCHAR(10) NOT NULL,
    message TEXT NOT NULL,
    details JSONB,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    username VARCHAR(255)
);