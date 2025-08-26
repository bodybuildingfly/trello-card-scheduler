/**
 * @file 008_add_refresh_token_to_users.js
 * @description This migration adds refresh token support to the users table.
 */

export const up = async (client) => {
    console.log('[MIGRATION] Running 008_add_refresh_token_to_users...');

    await client.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS refresh_token TEXT,
        ADD COLUMN IF NOT EXISTS refresh_token_expires_at TIMESTAMP WITH TIME ZONE;
    `);

    // Add an index for faster lookups of refresh tokens
    await client.query(`
        CREATE INDEX IF NOT EXISTS idx_users_refresh_token ON users (refresh_token);
    `);

    console.log('[MIGRATION] 008_add_refresh_token_to_users completed successfully.');
};
