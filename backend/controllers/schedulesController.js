import pool from '../db.js';
import * as trelloService from '../services/trelloService.js';
import { calculateNextDueDate } from '../services/schedulerService.js';
import logAuditEvent from '../utils/logger.js';

/**
 * @description Gets all schedules, grouped by category.
 * @route GET /api/schedules
 * @access Private
 */
export const getAllSchedules = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM schedules ORDER BY category ASC, id ASC');
        
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
 * @description Gets a unique list of all categories.
 * @route GET /api/schedules/categories
 * @access Private
 */
export const getUniqueCategories = async (req, res) => {
    try {
        const result = await pool.query("SELECT DISTINCT category FROM schedules WHERE category IS NOT NULL AND category <> '' ORDER BY category ASC");
        const categories = result.rows.map(row => row.category);
        res.status(200).json(categories);
    } catch (err) {
        console.error('Failed to fetch categories.', err);
        res.status(500).json({ error: 'Failed to fetch categories.', details: err.message });
    }
};

/**
 * @description Creates a new schedule.
 * @route POST /api/schedules
 * @access Private
 */
export const createSchedule = async (req, res) => {
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
        await logAuditEvent('INFO', `New schedule created: "${result.rows[0].title}"`, { schedule: result.rows[0] }, req.user);
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
        
        await logAuditEvent('INFO', `Schedule updated: "${result.rows[0].title}"`, { before: beforeResult.rows[0], after: result.rows[0] }, req.user);
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
    const { id } = req.params;
    try {
        const beforeResult = await pool.query('SELECT * FROM schedules WHERE id = $1', [id]);
        if (beforeResult.rows.length === 0) {
            return res.status(404).json({ error: 'Schedule not found' });
        }
        
        await pool.query('DELETE FROM schedules WHERE id = $1;', [id]);
        await logAuditEvent('INFO', `Schedule deleted: "${beforeResult.rows[0].title}"`, { deletedSchedule: beforeResult.rows[0] }, req.user);
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
    const { appSettings } = req;
    const { id } = req.params;
    try {
        const { rows } = await pool.query('SELECT * FROM schedules WHERE id = $1', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Schedule not found.' });
        }
        
        const schedule = rows[0];

        if (req.user.role !== 'admin' && req.user.username !== schedule.owner_name) {
            await logAuditEvent('ERROR', `Unauthorized attempt to trigger schedule by user '${req.user.username}'.`, { scheduleId: id, owner: schedule.owner_name }, req.user);
            return res.status(403).json({ error: 'You are not authorized to trigger this schedule.' });
        }
        
        const nextDueDate = calculateNextDueDate(schedule);
        
        const newCard = await trelloService.createTrelloCard(schedule, nextDueDate, appSettings);
        
        if (newCard) {
            await logAuditEvent('INFO', `Manual card creation successful: "${newCard.name}"`, { schedule, newCard, dueDate: nextDueDate }, req.user);
            await pool.query('UPDATE schedules SET active_card_id = $1, last_card_created_at = NOW(), needs_new_card = FALSE WHERE id = $2', [newCard.id, schedule.id]);
            res.status(201).json(newCard);
        } else {
            return res.status(400).json({ error: 'Failed to create Trello card. This may be due to a configuration issue (e.g., missing Trello member).' });
        }
    } catch (error) {
        const errorDetails = {
            scheduleId: id,
            statusCode: error.response?.status,
            response: error.response?.data || error.message,
        };
        await logAuditEvent('ERROR', `Manual trigger failed for schedule ${id}.`, errorDetails, req.user);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

/**
 * @description Clones an existing schedule, creating a new one with a modified title.
 * @route POST /api/schedules/:id/clone
 * @access Private
 */
export const cloneSchedule = async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await pool.query('SELECT * FROM schedules WHERE id = $1', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Schedule to clone not found.' });
        }
        
        const originalSchedule = rows[0];
        const newSchedule = {
            ...originalSchedule,
            title: `${originalSchedule.title} (Copy)`,
            active_card_id: null,
            last_card_created_at: null,
            needs_new_card: true,
        };

        const query = `
            INSERT INTO schedules (title, owner_name, description, category, frequency, frequency_interval, frequency_details, trigger_hour, trigger_minute, trigger_ampm, start_date, end_date, needs_new_card) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
            RETURNING *;
        `;
        const values = [
            newSchedule.title, newSchedule.owner_name, newSchedule.description, newSchedule.category, 
            newSchedule.frequency, newSchedule.frequency_interval, newSchedule.frequency_details, 
            newSchedule.trigger_hour, newSchedule.trigger_minute, newSchedule.trigger_ampm, 
            newSchedule.start_date, newSchedule.end_date, newSchedule.needs_new_card
        ];

        const result = await pool.query(query, values);
        const clonedSchedule = result.rows[0];

        await logAuditEvent('INFO', `Schedule cloned: "${clonedSchedule.title}"`, { originalId: id, newId: clonedSchedule.id }, req.user);
        res.status(201).json(clonedSchedule);

    } catch (error) {
        console.error('Clone schedule error:', error);
        await logAuditEvent('ERROR', `Failed to clone schedule ${id}.`, { error: String(error) }, req.user);
        res.status(500).json({ error: 'Internal server error.' });
    }
};