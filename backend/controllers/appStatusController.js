import pool from '../db.js';
import logAuditEvent from '../utils/logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Helper to get __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * @description Gets the application version from the backend's package.json file.
 * @route GET /api/version
 * @access Public
 */
export const getAppVersion = (req, res) => {
    try {
        // Correct the path to point to the backend's package.json file.
        // It navigates up from /controllers to the /backend directory.
        const packageJsonPath = path.resolve(__dirname, '../package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        res.json({ version: packageJson.version });
    } catch (error) {
        console.error('Failed to read package.json version:', error);
        res.status(500).json({ message: 'Could not retrieve application version.' });
    }
};

/**
 * @description Fetches the 100 most recent audit log entries.
 * @param {object} req - The Express request object.
 * @param {object} res - The Express response object.
 */
export const getAuditLogs = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100');
        res.status(200).json(result.rows);
    } catch (err) {
        await logAuditEvent('ERROR', 'Failed to fetch audit logs.', { error: String(err) }, req.user);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * @description Fetches the current status of the cron scheduler.
 * @param {object} req - The Express request object.
 * @param {object} res - The Express response object.
 */
export const getSchedulerStatus = async (req, res) => {
    const { cronJob } = req;

    if (!cronJob) {
        return res.status(500).json({ error: "Scheduler not initialized." });
    }
    try {
        const { rows } = await pool.query("SELECT details->>'runId' as run_id, timestamp FROM audit_logs WHERE message = 'Scheduler starting evaluation run.' ORDER BY timestamp DESC LIMIT 1");
        if (rows.length === 0) {
            return res.json({ lastRun: 'Never', duration: 'N/A', cardsCreated: 0, nextRun: cronJob.nextDate().toISO() });
        }
        
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
        await logAuditEvent('ERROR', 'Failed to fetch scheduler status.', { error: String(error) }, req.user);
        res.status(500).json({ error: 'Failed to fetch scheduler status.' });
    }
};