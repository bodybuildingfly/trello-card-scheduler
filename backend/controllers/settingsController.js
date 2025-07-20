import pool from '../db.js';
import logAuditEvent from '../utils/logger.js';

/**
 * @description Gets the current application settings, masking sensitive values.
 * @param {object} req - The Express request object.
 * @param {object} res - The Express response object.
 */
export const getSettings = (req, res) => {
    const { appSettings } = req; 
    
    const responseSettings = { ...appSettings };
    responseSettings.areCredentialsSaved = !!appSettings.TRELLO_API_KEY && !!appSettings.TRELLO_API_TOKEN;
    responseSettings.TRELLO_API_KEY = responseSettings.areCredentialsSaved ? '******' : '';
    responseSettings.TRELLO_API_TOKEN = responseSettings.areCredentialsSaved ? '******' : '';
    responseSettings.isConfigured = responseSettings.areCredentialsSaved &&
                                     !!appSettings.TRELLO_BOARD_ID &&
                                     !!appSettings.TRELLO_TO_DO_LIST_ID &&
                                     !!appSettings.TRELLO_DONE_LIST_ID;
    res.json(responseSettings);
};

/**
 * @description Updates the general application settings.
 * @param {object} req - The Express request object.
 * @param {object} res - The Express response object.
 */
export const updateSettings = async (req, res) => {
    const { appSettings, loadSettings, reinitializeCronJob } = req;
    
    const { TRELLO_BOARD_ID, TRELLO_TO_DO_LIST_ID, TRELLO_DONE_LIST_ID, TRELLO_LABEL_ID, CRON_SCHEDULE } = req.body;
    const newSettings = { TRELLO_BOARD_ID, TRELLO_TO_DO_LIST_ID, TRELLO_DONE_LIST_ID, TRELLO_LABEL_ID, CRON_SCHEDULE };

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const key in newSettings) {
            if (newSettings[key] !== undefined && appSettings.hasOwnProperty(key)) {
                await client.query('UPDATE settings SET value = $1 WHERE key = $2', [newSettings[key], key]);
            }
        }
        await client.query('COMMIT');
        
        await loadSettings();
        reinitializeCronJob();
        
        await logAuditEvent('INFO', 'Application settings updated.', { updatedSettings: Object.keys(newSettings) }, req.user);
        res.status(200).json({ message: 'Settings updated successfully.' });
    } catch (error) {
        await client.query('ROLLBACK');
        await logAuditEvent('ERROR', 'Failed to update settings.', { error: String(error) }, req.user);
        res.status(500).json({ error: 'Failed to update settings.' });
    } finally {
        client.release();
    }
};

/**
 * @description Updates the sensitive Trello API credentials.
 * @param {object} req - The Express request object.
 * @param {object} res - The Express response object.
 */
export const updateCredentials = async (req, res) => {
    const { loadSettings } = req;
    
    const { TRELLO_API_KEY, TRELLO_API_TOKEN } = req.body;
    if (!TRELLO_API_KEY || !TRELLO_API_TOKEN) {
        return res.status(400).json({ message: "API Key and Token are required." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('UPDATE settings SET value = $1 WHERE key = $2', [TRELLO_API_KEY, 'TRELLO_API_KEY']);
        await client.query('UPDATE settings SET value = $1 WHERE key = $2', [TRELLO_API_TOKEN, 'TRELLO_API_TOKEN']);
        await client.query('COMMIT');

        await loadSettings();

        await logAuditEvent('INFO', 'Trello API credentials updated.', {}, req.user);
        res.status(200).json({ message: 'Credentials saved successfully.' });
    } catch (error) {
        await client.query('ROLLBACK');
        await logAuditEvent('ERROR', 'Failed to save credentials.', { error: String(error) }, req.user);
        res.status(500).json({ error: 'Failed to save credentials.' });
    } finally {
        client.release();
    }
};