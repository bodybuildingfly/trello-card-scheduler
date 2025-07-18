import pool from '../db.js';

export const getSettings = (req, res) => {
    // Get appSettings from the request object
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

export const updateSettings = async (req, res) => {
    // Get everything needed from the request object
    const { appSettings, loadSettings, reinitializeCronJob, logAuditEvent } = req;
    
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

        res.status(200).json({ message: 'Settings updated successfully.' });
    } catch (error) {
        await client.query('ROLLBACK');
        await logAuditEvent('ERROR', 'Failed to update settings.', { error: String(error) });
        res.status(500).json({ error: 'Failed to update settings.' });
    } finally {
        client.release();
    }
};

export const updateCredentials = async (req, res) => {
    const { loadSettings, logAuditEvent } = req;
    
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

        res.status(200).json({ message: 'Credentials saved successfully.' });
    } catch (error) {
        await client.query('ROLLBACK');
        await logAuditEvent('ERROR', 'Failed to save credentials.', { error: String(error) });
        res.status(500).json({ error: 'Failed to save credentials.' });
    } finally {
        client.release();
    }
};