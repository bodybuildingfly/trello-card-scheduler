import pool from '../db.js';
import * as trelloService from '../services/trelloService.js';
import { calculateNextDueDate } from '../services/schedulerService.js';

/**
 * @description Gets all schedules, grouped by category.
 * @route GET /api/schedules
 * @access Private
 */
export const getAllSchedules = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM schedules ORDER BY category ASC, id ASC');
        
        // Group schedules by category before sending to the client
        const groupedSchedules = result.rows.reduce((acc, schedule) => {
            const category = schedule.category || 'Uncategorized';
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(schedule);
            return acc;
        }, {});

        res.status(200).json(groupedSchedules);
    } catch (err) {
        console.error('Failed to load schedules.', err);
        res.status(500).json({ error: 'Failed to load schedules.', details: err.message });
    }
};

/**
 * @description Creates a new schedule.
 * @route POST /api/schedules
 * @access Private
 */
export const createSchedule = async (req, res) => {
    const { logAuditEvent } = req;
    const { title, owner_name, description, category, frequency, frequency_interval, frequency_details, trigger_hour, trigger_minute, trigger_ampm, start_date, end_date } = req.body;
    
    if (!title || !owner_name) {
        return res.status(400).json({ error: 'Title and Owner are required.' });
    }

    const query = `
        INSERT INTO schedules (title, owner_name, description, category, frequency, frequency_interval, frequency_details, trigger_hour, trigger_minute, trigger_ampm, start_date, end_date) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
        RETURNING *;
    `;
    const values = [title, owner_name, description, category || 'Uncategorized', frequency, frequency_interval || 1, frequency_details, trigger_hour, trigger_minute, trigger_ampm, start_date || null, end_date || null];
    
    try {
        const result = await pool.query(query, values);
        await logAuditEvent('INFO', `New schedule created: "${result.rows[0].title}"`, { schedule: result.rows[0] });
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Create schedule error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * @description Updates an existing schedule.
 * @route PUT /api/schedules/:id
 * @access Private
 */
export const updateSchedule = async (req, res) => {
    const { logAuditEvent } = req;
    const { id } = req.params;
    const { title, owner_name, description, category, frequency, frequency_interval, frequency_details, trigger_hour, trigger_minute, trigger_ampm, start_date, end_date } = req.body;
    
    if (!title || !owner_name) {
        return res.status(400).json({ error: 'Title and Owner are required.' });
    }
    
    try {
        const beforeResult = await pool.query('SELECT * FROM schedules WHERE id = $1', [id]);
        if (beforeResult.rows.length === 0) {
            return res.status(404).json({ error: 'Schedule not found' });
        }
        
        const query = `
            UPDATE schedules SET 
            title = $1, owner_name = $2, description = $3, category = $4, frequency = $5, 
            frequency_interval = $6, frequency_details = $7, trigger_hour = $8, 
            trigger_minute = $9, trigger_ampm = $10, start_date = $11, end_date = $12 
            WHERE id = $13 
            RETURNING *;
        `;
        const values = [title, owner_name, description, category || 'Uncategorized', frequency, frequency_interval || 1, frequency_details, trigger_hour, trigger_minute, trigger_ampm, start_date || null, end_date || null, id];
        const result = await pool.query(query, values);
        
        await logAuditEvent('INFO', `Schedule updated: "${result.rows[0].title}"`, { before: beforeResult.rows[0], after: result.rows[0] });
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error('Update schedule error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * @description Deletes a schedule.
 * @route DELETE /api/schedules/:id
 * @access Private
 */
export const deleteSchedule = async (req, res) => {
    const { logAuditEvent } = req;
    const { id } = req.params;
    try {
        const beforeResult = await pool.query('SELECT * FROM schedules WHERE id = $1', [id]);
        if (beforeResult.rows.length === 0) {
            return res.status(404).json({ error: 'Schedule not found' });
        }
        
        await pool.query('DELETE FROM schedules WHERE id = $1;', [id]);
        await logAuditEvent('INFO', `Schedule deleted: "${beforeResult.rows[0].title}"`, { deletedSchedule: beforeResult.rows[0] });
        res.status(204).send();
    } catch (err) {
        console.error('Delete schedule error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * @description Manually triggers the creation of a Trello card for a schedule.
 * @route POST /api/schedules/:id/trigger
 * @access Private
 */
export const triggerSchedule = async (req, res) => {
    const { logAuditEvent, appSettings } = req;
    const { id } = req.params;
    try {
        const { rows } = await pool.query('SELECT * FROM schedules WHERE id = $1', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Schedule not found.' });
        }
        
        const schedule = rows[0];
        const nextDueDate = calculateNextDueDate(schedule);
        
        const newCard = await trelloService.createTrelloCard(schedule, nextDueDate, appSettings, logAuditEvent);
        
        if (newCard) {
            await pool.query('UPDATE schedules SET active_card_id = $1, last_card_created_at = NOW(), needs_new_card = FALSE WHERE id = $2', [newCard.id, schedule.id]);
            res.status(201).json(newCard);
        } else {
            res.status(500).json({ error: 'Failed to create Trello card.' });
        }
    } catch (error) {
        await logAuditEvent('ERROR', `Manual trigger failed for schedule ${id}.`, { error: String(error) });
        res.status(500).json({ error: 'Internal server error.' });
    }
};