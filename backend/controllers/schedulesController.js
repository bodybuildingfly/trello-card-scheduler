/**
 * @file backend/controllers/schedulesController.js
 * @description This file has been updated to re-introduce the start and end
 * date validation to the manual trigger function, ensuring consistency with
 * the automated scheduler.
 */
import pool from '../db.js';
import * as trelloService from '../services/trelloService.js';
import { calculateNextDueDate } from '../services/schedulerService.js';
import logAuditEvent from '../utils/logger.js';
import { z } from 'zod';

// --- Validation Schemas ---
const scheduleSchema = z.object({
    title: z.string().min(1, { message: "Title is required." }),
    owner_name: z.string().min(1, { message: "Owner is required." }),
    description: z.string().optional(),
    category: z.string().optional(),
    frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
    frequency_interval: z.number().int().positive().optional(),
    frequency_details: z.string().optional(),
    trigger_hour: z.string().optional(),
    trigger_minute: z.string().optional(),
    trigger_ampm: z.string().optional(),
    start_date: z.string().nullable().optional(),
    end_date: z.string().nullable().optional(),
    trello_label_id: z.string().nullable().optional(),
    is_active: z.boolean().optional(),
});

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
 * @description Creates a new schedule after validating input.
 * @route POST /api/schedules
 * @access Private
 */
export const createSchedule = async (req, res) => {
    const validationResult = scheduleSchema.safeParse(req.body);
    if (!validationResult.success) {
        return res.status(400).json({ message: "Invalid input.", errors: validationResult.error.issues });
    }

    const { title, owner_name, description, category, frequency, frequency_interval, frequency_details, trigger_hour, trigger_minute, trigger_ampm, start_date, end_date, trello_label_id, is_active } = validationResult.data;
    
    const query = `
        INSERT INTO schedules (title, owner_name, description, category, frequency, frequency_interval, frequency_details, trigger_hour, trigger_minute, trigger_ampm, start_date, end_date, trello_label_id, is_active) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) 
        RETURNING *;
    `;
    const values = [title, owner_name, description, category || 'Uncategorized', frequency, frequency_interval || 1, frequency_details, trigger_hour, trigger_minute, trigger_ampm, start_date || null, end_date || null, trello_label_id || null, is_active !== false];
    
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
 * @description Updates an existing schedule after validating input.
 * @route PUT /api/schedules/:id
 * @access Private
 */
export const updateSchedule = async (req, res) => {
    const validationResult = scheduleSchema.safeParse(req.body);
    if (!validationResult.success) {
        return res.status(400).json({ message: "Invalid input.", errors: validationResult.error.issues });
    }

    const { id } = req.params;
    const { title, owner_name, description, category, frequency, frequency_interval, frequency_details, trigger_hour, trigger_minute, trigger_ampm, start_date, end_date, trello_label_id, is_active } = validationResult.data;
    
    try {
        const beforeResult = await pool.query('SELECT * FROM schedules WHERE id = $1', [id]);
        if (beforeResult.rows.length === 0) {
            return res.status(404).json({ error: 'Schedule not found' });
        }
        
        const query = `
            UPDATE schedules SET 
            title = $1, owner_name = $2, description = $3, category = $4, frequency = $5, 
            frequency_interval = $6, frequency_details = $7, trigger_hour = $8, 
            trigger_minute = $9, trigger_ampm = $10, start_date = $11, end_date = $12, trello_label_id = $13, is_active = $14
            WHERE id = $15 
            RETURNING *;
        `;
        const values = [title, owner_name, description, category || 'Uncategorized', frequency, frequency_interval || 1, frequency_details, trigger_hour, trigger_minute, trigger_ampm, start_date || null, end_date || null, trello_label_id || null, is_active, id];
        const result = await pool.query(query, values);
        
        await logAuditEvent('INFO', `Schedule updated: "${result.rows[0].title}"`, { before: beforeResult.rows[0], after: result.rows[0] }, req.user);
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error('Update schedule error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * @description Toggles the active status of a schedule.
 * @route PUT /api/schedules/:id/toggle-active
 * @access Private
 */
export const toggleScheduleStatus = async (req, res) => {
    const { id } = req.params;
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
        return res.status(400).json({ error: 'Invalid "is_active" value provided.' });
    }

    try {
        const { rows } = await pool.query(
            'UPDATE schedules SET is_active = $1 WHERE id = $2 RETURNING *',
            [is_active, id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Schedule not found' });
        }
        const status = is_active ? 'enabled' : 'disabled';
        await logAuditEvent('INFO', `Schedule ${status}: "${rows[0].title}"`, { schedule: rows[0] }, req.user);
        res.status(200).json(rows[0]);
    } catch (err) {
        console.error('Toggle schedule status error:', err);
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
        
        let lastDueDateForCalc = null;
        if (schedule.active_card_id) {
            try {
                const activeCard = await trelloService.getTrelloCard(schedule.active_card_id, appSettings);
                if (activeCard && !activeCard.closed && activeCard.idList !== appSettings.TRELLO_DONE_LIST_ID) {
                    const conflictMessage = `Cannot create a new card. The previous card "${activeCard.name}" is still active.`;
                    await logAuditEvent('INFO', `Manual trigger blocked for schedule ${id}.`, { reason: conflictMessage }, req.user);
                    return res.status(409).json({ message: conflictMessage });
                }
                if (activeCard) {
                    lastDueDateForCalc = new Date(activeCard.due);
                }
            } catch (error) {
                await logAuditEvent('ERROR', `Could not verify status of active card ${schedule.active_card_id} during manual trigger. Proceeding with caution.`, { error: String(error) }, req.user);
            }
        }

        const nextDueDate = calculateNextDueDate(schedule, lastDueDateForCalc);
        
        // Validate the calculated due date against the schedule's start and end dates.
        const startDate = schedule.start_date ? new Date(schedule.start_date) : null;
        const endDate = schedule.end_date ? new Date(schedule.end_date) : null;

        if ((startDate && nextDueDate < startDate) || (endDate && nextDueDate > endDate)) {
            const message = `Cannot create card. The next due date (${nextDueDate.toLocaleDateString()}) is outside the schedule's active range.`;
            await logAuditEvent('INFO', `Manual trigger blocked for schedule ${id}.`, { reason: message }, req.user);
            return res.status(400).json({ message });
        }
        
        const newCard = await trelloService.createTrelloCard(schedule, nextDueDate, appSettings);
        
        if (newCard) {
            await logAuditEvent('INFO', `Manual card creation successful: "${newCard.name}"`, { schedule, newCard, dueDate: nextDueDate }, req.user);
            await pool.query(
                'UPDATE schedules SET active_card_id = $1, last_card_created_at = NOW() WHERE id = $2', 
                [newCard.id, schedule.id]
            );
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
        };

        const query = `
            INSERT INTO schedules (title, owner_name, description, category, frequency, frequency_interval, frequency_details, trigger_hour, trigger_minute, trigger_ampm, start_date, end_date, trello_label_id) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
            RETURNING *;
        `;
        const values = [
            newSchedule.title, newSchedule.owner_name, newSchedule.description, newSchedule.category, 
            newSchedule.frequency, newSchedule.frequency_interval, newSchedule.frequency_details, 
            newSchedule.trigger_hour, newSchedule.trigger_minute, newSchedule.trigger_ampm, 
            newSchedule.start_date, newSchedule.end_date, newSchedule.trello_label_id
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