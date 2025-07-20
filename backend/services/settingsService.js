import pool from '../db.js';

/**
 * @description Loads all settings from the database. It checks for default
 * settings defined by environment variables and inserts them if they don't
 * exist in the database.
 * @returns {Promise<object>} A promise that resolves to the application settings object.
 */
export const loadSettings = async () => {
    console.log('[INFO] Loading settings from database...');
    const client = await pool.connect();
    try {
        const { rows } = await client.query('SELECT key, value FROM settings');
        const settingsFromDB = rows.reduce((acc, row) => {
            acc[row.key] = row.value;
            return acc;
        }, {});

        const defaultSettings = {
            TRELLO_API_KEY: process.env.TRELLO_API_KEY || '',
            TRELLO_API_TOKEN: process.env.TRELLO_API_TOKEN || '',
            TRELLO_BOARD_ID: process.env.TRELLO_BOARD_ID || '',
            TRELLO_TO_DO_LIST_ID: process.env.TRELLO_TO_DO_LIST_ID || '',
            TRELLO_DONE_LIST_ID: process.env.TRELLO_DONE_LIST_ID || '',
            CRON_SCHEDULE: process.env.CRON_SCHEDULE || '0 1 * * *',
        };

        for (const key in defaultSettings) {
            if (!settingsFromDB.hasOwnProperty(key)) {
                console.log(`[INFO] Setting '${key}' not found in DB, inserting default.`);
                await client.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING', [key, defaultSettings[key]]);
                settingsFromDB[key] = defaultSettings[key];
            }
        }
        
        console.log('[INFO] Settings loaded successfully.');
        return settingsFromDB;

    } catch (err) {
        console.error('[CRITICAL] Failed to load settings.', err);
        // Re-throw the error to be handled by the main server start function
        throw err;
    } finally {
        client.release();
    }
};