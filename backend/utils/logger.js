import pool from '../db.js';

/**
 * @description Writes an audit event to the console and the database.
 * @param {'INFO' | 'ERROR' | 'CRITICAL'} level - The severity level of the event.
 * @param {string} message - A description of the event.
 * @param {object} [details={}] - A JSON object containing relevant details.
 * @param {object} [user=null] - The user object from the request (req.user), if available.
 */
const logAuditEvent = async (level, message, details = {}, user = null) => {
    const userId = user ? user.id : null;
    const username = user ? user.username : null;

    // Log to the console, including the username if present
    console.log(`[${level}] ${message}`, JSON.stringify({ ...details, user: username }));
    
    try {
        await pool.query(
            'INSERT INTO audit_logs(level, message, details, user_id, username) VALUES($1, $2, $3, $4, $5)',
            [level, message, details, userId, username]
        );
    } catch (err) {
        // Log a secondary, critical error if the logger itself fails.
        console.error(`[CRITICAL] Failed to write to audit log table: ${err.message}`);
    }
};

export default logAuditEvent;