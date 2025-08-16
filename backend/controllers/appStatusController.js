import pool from '../db.js';
import logAuditEvent from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

/**
 * @description Gets the application version from the backend's package.json file.
 * @route GET /api/version
 * @access Public
 */
export const getAppVersion = (req, res) => {
    try {
        // Use process.cwd() which is the root of the backend service in the container.
        // This is the most reliable way to find the package.json file.
        const packageJsonPath = path.join(process.cwd(), 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        res.json({ version: packageJson.version });
    } catch (error) {
        console.error('Failed to read package.json version:', error);
        res.status(500).json({ message: 'Could not retrieve application version.' });
    }
};

/**
 * @description Fetches audit log entries with pagination and filtering.
 * @param {object} req - The Express request object.
 * @param {object} res - The Express response object.
 */
export const getAuditLogs = async (req, res) => {
    const { page = 1, limit = 20, filterLevel = 'all', filterText = '' } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM audit_logs';
    let countQuery = 'SELECT COUNT(*) FROM audit_logs';
    const params = [];
    const countParams = [];

    let whereClause = '';
    if (filterLevel !== 'all') {
        whereClause += (whereClause ? ' AND ' : ' WHERE ') + `level = $${params.length + 1}`;
        params.push(filterLevel.toUpperCase());
    }

    if (filterText) {
        whereClause += (whereClause ? ' AND ' : ' WHERE ') + `(message ILIKE $${params.length + 1} OR username ILIKE $${params.length + 1})`;
        params.push(`%${filterText}%`);
    }

    if (whereClause) {
        query += whereClause;
        countQuery += whereClause.replace(/\$\d+/g, (match) => {
            const paramIndex = parseInt(match.substring(1)) - 1;
            if (countParams.includes(params[paramIndex])) {
                return `$${countParams.indexOf(params[paramIndex]) + 1}`;
            }
            countParams.push(params[paramIndex]);
            return `$${countParams.length}`;
        });
    }

    query += ` ORDER BY timestamp DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    try {
        const logsResult = await pool.query(query, params);
        const countResult = await pool.query(countQuery, countParams);

        res.status(200).json({
            logs: logsResult.rows,
            totalCount: parseInt(countResult.rows[0].count, 10)
        });
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