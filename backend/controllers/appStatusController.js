import pool from '../db.js';

/**
 * @description Fetches the 100 most recent audit log entries.
 */
export const getAuditLogs = async (req, res) => {
    // The logAuditEvent function is attached to the request by our middleware
    const { logAuditEvent } = req; 
    try {
        const result = await pool.query('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100');
        res.status(200).json(result.rows);
    } catch (err) {
        await logAuditEvent('ERROR', 'Failed to fetch audit logs.', { error: String(err) });
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * @description Fetches the current status of the cron scheduler.
 */
export const getSchedulerStatus = async (req, res) => {
    // cronJob and logAuditEvent are attached by middleware
    const { cronJob, logAuditEvent } = req;

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
        await logAuditEvent('ERROR', 'Failed to fetch scheduler status.', { error: String(error) });
        res.status(500).json({ error: 'Failed to fetch scheduler status.' });
    }
};