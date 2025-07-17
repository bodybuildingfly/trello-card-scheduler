const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { CronJob } = require('cron');

const app = express();
const port = 5000;

// --- Middleware ---
const corsOptions = {
    origin: 'http://localhost:5000',
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());
// app.use(express.static(path.join(__dirname, 'build')));
app.use(express.static(path.join(__dirname, '../frontend/build')));

// For any other route not handled by the API, serve the React app's index.html
app.get('*', (req, res) => {
    // Corrected path for sending index.html
    res.sendFile(path.resolve(__dirname, '../frontend', 'build', 'index.html'));
});

// --- Global Settings Object ---
let appSettings = {};
let cronJob;

// --- PostgreSQL Connection ---
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    connectionTimeoutMillis: 5000,
});

// --- Audit Logging Helper ---
const logAuditEvent = async (level, message, details = {}) => {
    console.log(`[${level}] ${message}`, JSON.stringify(details));
    try {
        await pool.query('INSERT INTO audit_logs(level, message, details) VALUES($1, $2, $3)', [level, message, details]);
    } catch (err) {
        console.error(`[ERROR] Failed to write to audit log table: ${err.message}`);
    }
};

// --- Settings Management ---
const loadSettings = async () => {
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
            TRELLO_LIST_ID: process.env.TRELLO_LIST_ID || '',
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
        appSettings = settingsFromDB;
        console.log('[INFO] Settings loaded successfully.');
    } catch (err) {
        console.error('[CRITICAL] Failed to load settings.', err);
        process.exit(1);
    } finally {
        client.release();
    }
};

const reinitializeCronJob = () => {
    if (cronJob) {
        cronJob.stop();
    }
    cronJob = new CronJob(
        appSettings.CRON_SCHEDULE,
        runScheduler,
        null,
        true,
        process.env.TZ || "America/New_York"
    );
    console.log(`[INFO] Cron job re-initialized with pattern: "${appSettings.CRON_SCHEDULE}" in timezone ${process.env.TZ || "America/New_York"}`);
};

// --- Database Schema Initialization ---
const initializeDatabaseSchema = async () => {
    const client = await pool.connect();
    try {
        console.log('[INFO] Checking database schema...');
        const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql')).toString();
        await client.query(schemaSql);
        console.log('[INFO] Database schema check complete.');

        const { rows } = await client.query('SELECT COUNT(*) FROM records');
        if (parseInt(rows[0].count, 10) === 0) {
            console.log('[INFO] Records table is empty. Seeding initial data...');
            const seedSql = fs.readFileSync(path.join(__dirname, 'seed.sql')).toString();
            await client.query(seedSql);
            console.log('[INFO] Successfully seeded database with initial demo data.');
        } else {
            console.log('[INFO] Database already contains data. Skipping seed.');
        }
    } catch (err) {
        console.error('[CRITICAL] Failed to initialize database.', err);
        process.exit(1);
    } finally {
        if (client) client.release();
    }
};

// --- Trello API Helpers ---
const getTrelloBoardMembers = (key, token, boardId) => {
    if (!key || !token || !boardId) return Promise.reject('Trello credentials missing');
    const options = { hostname: 'api.trello.com', path: `/1/boards/${boardId}/members?key=${key}&token=${token}`, method: 'GET' };
    return new Promise((resolve, reject) => {
        const req = https.request(options, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => res.statusCode === 200 ? resolve(JSON.parse(data)) : reject({statusCode: res.statusCode, data}));
        });
        req.on('error', reject);
        req.end();
    });
};

const getTrelloCard = async (cardId) => {
    const { TRELLO_API_KEY, TRELLO_API_TOKEN } = appSettings;
    const options = { hostname: 'api.trello.com', path: `/1/cards/${cardId}?key=${TRELLO_API_KEY}&token=${TRELLO_API_TOKEN}`, method: 'GET' };
    return new Promise((resolve, reject) => {
        const req = https.request(options, res => {
            if (res.statusCode === 404) return resolve(null);
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => res.statusCode === 200 ? resolve(JSON.parse(data)) : reject(`Trello API status: ${res.statusCode}`));
        });
        req.on('error', reject);
        req.end();
    });
};

const createTrelloCard = async (schedule, dueDate) => {
    const { TRELLO_API_KEY, TRELLO_API_TOKEN, TRELLO_LIST_ID, TRELLO_BOARD_ID } = appSettings;
    const members = await getTrelloBoardMembers(TRELLO_API_KEY, TRELLO_API_TOKEN, TRELLO_BOARD_ID);
    const member = members.find(m => m.fullName === schedule.owner_name);
    if (!member) {
        await logAuditEvent('ERROR', `Card creation failed: Trello member "${schedule.owner_name}" not found.`, { schedule });
        return null;
    }
    const card = { name: schedule.title, desc: schedule.description, idList: TRELLO_LIST_ID, idMembers: [member.id], due: dueDate.toISOString() };
    const postData = JSON.stringify(card);
    const options = { hostname: 'api.trello.com', path: `/1/cards?key=${TRELLO_API_KEY}&token=${TRELLO_API_TOKEN}`, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': postData.length } };
    return new Promise((resolve, reject) => {
        const req = https.request(options, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    const newCard = JSON.parse(data);
                    logAuditEvent('INFO', `Card creation successful: "${newCard.name}"`, { schedule, newCard, dueDate });
                    resolve(newCard);
                } else {
                    logAuditEvent('ERROR', 'Card creation failed: Trello API error.', { schedule, statusCode: res.statusCode, response: data });
                    reject(data);
                }
            });
        });
        req.on('error', (error) => {
            logAuditEvent('ERROR', 'Card creation failed: Network error.', { schedule, error: error.message });
            reject(error);
        });
        req.write(postData);
        req.end();
    });
};

// --- Date & Frequency Logic ---
const calculateNextDueDate = (schedule) => {
    const { frequency, frequency_interval, frequency_details, last_card_created_at, start_date, trigger_hour, trigger_minute, trigger_ampm } = schedule;
    const baseDate = last_card_created_at ? new Date(Math.max(new Date(last_card_created_at), new Date(start_date || 0))) : new Date(start_date || Date.now());
    let nextDate = new Date(baseDate);
    const interval = frequency_interval || 1;
    let hour = parseInt(trigger_hour, 10) || 9;
    if (trigger_ampm === 'pm' && hour !== 12) hour += 12;
    if (trigger_ampm === 'am' && hour === 12) hour = 0;
    nextDate.setHours(hour, parseInt(trigger_minute, 10) || 0, 0, 0);

    switch (frequency) {
        case 'daily':
            nextDate.setDate(nextDate.getDate() + interval);
            break;
        case 'weekly':
            const scheduledDays = (frequency_details || '').split(',').map(d => parseInt(d, 10));
            nextDate.setDate(baseDate.getDate() + 1);
            let lookahead = 0;
            while (!scheduledDays.includes(nextDate.getDay()) && lookahead < 14) {
                nextDate.setDate(nextDate.getDate() + 1);
                lookahead++;
            }
            break;
        case 'monthly':
            nextDate.setMonth(baseDate.getMonth() + interval, parseInt(frequency_details, 10) || 1);
            break;
        case 'yearly':
            const [month, day] = (frequency_details || '1-1').split('-').map(d => parseInt(d, 10));
            nextDate.setFullYear(baseDate.getFullYear() + interval, month - 1, day);
            break;
        default:
            return new Date();
    }
    return nextDate;
};

// --- Scheduler Logic ---
const runScheduler = async () => {
    const runId = Math.random().toString(36).substring(2, 8);
    await logAuditEvent('INFO', 'Scheduler starting evaluation run.', { runId });
    const startTime = Date.now();
    const { rows: schedules } = await pool.query('SELECT * FROM records WHERE frequency != \'once\'');
    for (const schedule of schedules) {
        let shouldCreateNewCard = schedule.needs_new_card;
        if (schedule.active_card_id && !shouldCreateNewCard) {
            try {
                const activeCard = await getTrelloCard(schedule.active_card_id);
                if (!activeCard || activeCard.closed || activeCard.idList === appSettings.TRELLO_DONE_LIST_ID) {
                    await logAuditEvent('INFO', `Active card for schedule ${schedule.id} is completed.`, { cardId: schedule.active_card_id, runId });
                    shouldCreateNewCard = true;
                    await pool.query('UPDATE records SET needs_new_card = TRUE, active_card_id = NULL WHERE id = $1', [schedule.id]);
                }
            } catch (error) {
                await logAuditEvent('ERROR', `Failed to check status of active card for schedule ${schedule.id}.`, { cardId: schedule.active_card_id, error: String(error), runId });
            }
        }
        if (shouldCreateNewCard) {
            const nextDueDate = calculateNextDueDate(schedule);
            const startDate = schedule.start_date ? new Date(schedule.start_date) : null;
            const endDate = schedule.end_date ? new Date(schedule.end_date) : null;
            if ((startDate && nextDueDate < startDate) || (endDate && nextDueDate > endDate)) {
                await logAuditEvent('INFO', `Next due date for schedule ${schedule.id} is outside the defined start/end range. Skipping.`, { nextDueDate, startDate, endDate, runId });
                continue;
            }
            try {
                const newCard = await createTrelloCard(schedule, nextDueDate);
                if (newCard) {
                    await pool.query('UPDATE records SET active_card_id = $1, last_card_created_at = NOW(), needs_new_card = FALSE WHERE id = $2', [newCard.id, schedule.id]);
                }
            } catch (error) {
                await logAuditEvent('ERROR', `Scheduler failed to create new card for schedule ID ${schedule.id}.`, { error: String(error), runId });
            }
        }
    }
    const duration = Date.now() - startTime;
    await logAuditEvent('INFO', 'Scheduler run finished.', { durationMs: duration, runId });
};

// --- API Routes ---
app.post('/api/trello/test', async (req, res) => {
    const { TRELLO_API_KEY, TRELLO_API_TOKEN, TRELLO_BOARD_ID } = req.body;
    try {
        await getTrelloBoardMembers(TRELLO_API_KEY, TRELLO_API_TOKEN, TRELLO_BOARD_ID);
        res.status(200).json({ message: 'Connection successful!' });
    } catch (error) {
        let errorMessage = 'Connection failed. Check credentials and Board ID.';
        if (error.statusCode === 401) errorMessage = 'Connection failed: Invalid API Key or Token.';
        if (error.statusCode === 404) errorMessage = 'Connection failed: Board not found. Check Board ID.';
        res.status(400).json({ message: errorMessage, details: error.data });
    }
});

/* Old version
app.get('/api/settings', (req, res) => {
    // Never send sensitive keys to the frontend
    const { TRELLO_API_KEY, TRELLO_API_TOKEN, ...safeSettings } = appSettings;
    res.json(safeSettings);
}); */

app.get('/api/settings', (req, res) => {
    // Start with a copy of all current settings
    const responseSettings = { ...appSettings };

    // Mask sensitive keys for frontend display.
    // This tells the frontend that a value is present without exposing it.
    responseSettings.TRELLO_API_KEY = appSettings.TRELLO_API_KEY ? '******' : '';
    responseSettings.TRELLO_API_TOKEN = appSettings.TRELLO_API_TOKEN ? '******' : '';

    // Add an `isConfigured` flag for the frontend banner logic, as discussed.
    // This is the most secure way for the frontend to know the configuration status.
    responseSettings.isConfigured = !!appSettings.TRELLO_API_KEY && !!appSettings.TRELLO_API_TOKEN &&
                                   !!appSettings.TRELLO_BOARD_ID && !!appSettings.TRELLO_LIST_ID;

    // Send the modified settings object to the frontend
    res.json(responseSettings);
});

app.put('/api/settings', async (req, res) => {
    const newSettings = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const key in newSettings) {
            // Only update keys that exist in our app settings
            if (appSettings.hasOwnProperty(key)) {
                // For sensitive keys, only update if a new value is provided.
                if ((key === 'TRELLO_API_KEY' || key === 'TRELLO_API_TOKEN') && newSettings[key] === '') {
                    continue; // Skip update if the password field is empty
                }
                await client.query('UPDATE settings SET value = $1 WHERE key = $2', [newSettings[key], key]);
            }
        }
        await client.query('COMMIT');
        
        await loadSettings(); // Reload settings into the application
        reinitializeCronJob(); // Restart the cron job with the new schedule

        // await logAuditEvent('INFO', 'Application settings updated.');
        res.status(200).json({ message: 'Settings updated successfully.' });
    } catch (error) {
        await client.query('ROLLBACK');
        await logAuditEvent('ERROR', 'Failed to update settings.', { error: String(error) });
        res.status(500).json({ error: 'Failed to update settings.' });
    } finally {
        client.release();
    }
});

app.get('/api/audit-logs', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100');
        res.status(200).json(result.rows);
    } catch (err) {
        await logAuditEvent('ERROR', 'Failed to fetch audit logs.', { error: String(err) });
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/records/:id/trigger', async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await pool.query('SELECT * FROM records WHERE id = $1', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Schedule not found.' });
        const schedule = rows[0];
        const nextDueDate = calculateNextDueDate(schedule);
        const newCard = await createTrelloCard(schedule, nextDueDate);
        if (newCard) {
            await pool.query('UPDATE records SET active_card_id = $1, last_card_created_at = NOW(), needs_new_card = FALSE WHERE id = $2', [newCard.id, schedule.id]);
            res.status(201).json(newCard);
        } else {
            res.status(500).json({ error: 'Failed to create Trello card.' });
        }
    } catch (error) {
        await logAuditEvent('ERROR', `Manual trigger failed for schedule ${id}.`, { error: String(error) });
        res.status(500).json({ error: 'Internal server error.' });
    }
});

app.get('/api/scheduler/status', async (req, res) => {
    if (!cronJob) {
        return res.status(500).json({ error: "Scheduler not initialized." });
    }
    try {
        const { rows } = await pool.query("SELECT details->>'runId' as run_id, timestamp FROM audit_logs WHERE message = 'Scheduler starting evaluation run.' ORDER BY timestamp DESC LIMIT 1");
        if (rows.length === 0) return res.json({ lastRun: 'Never', duration: 'N/A', cardsCreated: 0, nextRun: cronJob.nextDate().toISO() });
        const lastRunId = rows[0].run_id;
        const lastRunTimestamp = rows[0].timestamp;
        const { rows: finishLog } = await pool.query("SELECT details->'durationMs' as duration FROM audit_logs WHERE message = 'Scheduler run finished.' AND details->>'runId' = $1", [lastRunId]);
        const { rows: createdCount } = await pool.query("SELECT COUNT(*) FROM audit_logs WHERE message LIKE 'Card creation successful%' AND details->>'runId' = $1", [lastRunId]);
        res.json({
            lastRun: lastRunTimestamp,
            duration: finishLog.length > 0 ? `${finishLog[0].duration} ms` : 'In progress...',
            cardsCreated: parseInt(createdCount[0].count, 10),
            nextRun: cronJob.nextDate().toISO()
        });
    } catch (error) {
        await logAuditEvent('ERROR', 'Failed to fetch scheduler status.', { error: String(error) });
        res.status(500).json({ error: 'Failed to fetch scheduler status.' });
    }
});

app.get('/api/trello/members', async (req, res) => {
    try {
        const members = await getTrelloBoardMembers(appSettings.TRELLO_API_KEY, appSettings.TRELLO_API_TOKEN, appSettings.TRELLO_BOARD_ID);
        res.status(200).json(members);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch members from Trello.' });
    }
});

app.get('/api/records', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM records ORDER BY id ASC');
        res.status(200).json(result.rows);
    } catch (err) {
        // res.status(500).json({ error: 'Internal server error' });
        res.status(500).json({ error: 'Failed to load scheduled cards.', details: err.message });
    }
});

app.post('/api/records', async (req, res) => {
    const { title, owner_name, description, frequency, frequency_interval, frequency_details, trigger_hour, trigger_minute, trigger_ampm, start_date, end_date } = req.body;
    if (!title || !owner_name) return res.status(400).json({ error: 'Title and Owner are required.' });
    const query = `INSERT INTO records (title, owner_name, description, frequency, frequency_interval, frequency_details, trigger_hour, trigger_minute, trigger_ampm, start_date, end_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *;`;
    const values = [title, owner_name, description, frequency, frequency_interval || 1, frequency_details, trigger_hour, trigger_minute, trigger_ampm, start_date || null, end_date || null];
    try {
        const result = await pool.query(query, values);
        await logAuditEvent('INFO', `New schedule created: "${result.rows[0].title}"`, { record: result.rows[0] });
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.put('/api/records/:id', async (req, res) => {
    const { id } = req.params;
    const { title, owner_name, description, frequency, frequency_interval, frequency_details, trigger_hour, trigger_minute, trigger_ampm, start_date, end_date } = req.body;
    if (!title || !owner_name) return res.status(400).json({ error: 'Title and Owner are required.' });
    
    try {
        const beforeResult = await pool.query('SELECT * FROM records WHERE id = $1', [id]);
        if (beforeResult.rows.length === 0) return res.status(404).json({ error: 'Record not found' });
        
        const query = `UPDATE records SET title = $1, owner_name = $2, description = $3, frequency = $4, frequency_interval = $5, frequency_details = $6, trigger_hour = $7, trigger_minute = $8, trigger_ampm = $9, start_date = $10, end_date = $11 WHERE id = $12 RETURNING *;`;
        const values = [title, owner_name, description, frequency, frequency_interval || 1, frequency_details, trigger_hour, trigger_minute, trigger_ampm, start_date || null, end_date || null, id];
        const result = await pool.query(query, values);
        
        await logAuditEvent('INFO', `Schedule updated: "${result.rows[0].title}"`, { before: beforeResult.rows[0], after: result.rows[0] });
        res.status(200).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/api/records/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const beforeResult = await pool.query('SELECT * FROM records WHERE id = $1', [id]);
        if (beforeResult.rows.length === 0) return res.status(404).json({ error: 'Record not found' });
        
        await pool.query('DELETE FROM records WHERE id = $1;', [id]);
        await logAuditEvent('INFO', `Schedule deleted: "${beforeResult.rows[0].title}"`, { deletedRecord: beforeResult.rows[0] });
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Main Application Start Function ---
const startServer = async () => {
    try {
        await initializeDatabaseSchema();
        await loadSettings();
        reinitializeCronJob();
        app.listen(port, () => console.log(`Server is running on http://localhost:${port}`));
    } catch (err) {
        console.error("Failed to start the server.", err);
        process.exit(1);
    }
};

startServer();