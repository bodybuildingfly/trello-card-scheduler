/**
 * @file backend/controllers/schedulesController.js
 * @description This file has been updated to handle an array of Trello label IDs (`trello_label_ids`)
 * instead of a single ID, aligning with the new multi-select functionality.
 */
import pool from '../db.js';
import * as trelloService from '../services/trelloService.js';
import logAuditEvent from '../utils/logger.js';
import { z } from 'zod';

// --- Validation Schemas ---
const scheduleSchema = z.object({
    title: z.string().min(1, { message: "Title is required." }),
    description: z.string().optional().nullable(),
    category: z.string().optional().nullable(),
    trello_member_ids: z.array(z.string()).min(1, { message: "At least one member must be assigned." }),
    frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
    frequency_interval: z.number().int().positive().optional(),
    frequency_details: z.string().optional().nullable(),
    trigger_hour: z.string().optional().nullable(),
    trigger_minute: z.string().optional().nullable(),
    trigger_ampm: z.string().optional().nullable(),
    start_date: z.string().nullable().optional(),
    start_hour: z.string().optional().nullable(),
    start_minute: z.string().optional().nullable(),
    start_ampm: z.string().optional().nullable(),
    end_date: z.string().nullable().optional(),
    trello_label_ids: z.array(z.string()).optional(),
    is_active: z.boolean().optional(),
    checklist_name: z.string().optional().nullable(),
    checklist_items: z.array(z.object({
        item_name: z.string(),
    })).optional(),
});

/**
 * @description Gets all schedules, grouped by category.
 * @route GET /api/schedules
 * @access Private
 */
export const getAllSchedules = async (req, res) => {
    try {
        const scheduleResult = await pool.query('SELECT * FROM schedules ORDER BY category ASC, id ASC');
        const itemsResult = await pool.query('SELECT * FROM checklist_items ORDER BY id ASC');
        
        const schedules = scheduleResult.rows;
        const checklistItems = itemsResult.rows;

        const schedulesWithItems = schedules.map(schedule => ({
            ...schedule,
            checklist_items: checklistItems.filter(item => item.schedule_id === schedule.id)
        }));

        const groupedSchedules = schedulesWithItems.reduce((acc, schedule) => {
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

    const { title, description, category, trello_member_ids, frequency, frequency_interval, frequency_details, trigger_hour, trigger_minute, trigger_ampm, start_date, start_hour, start_minute, start_ampm, end_date, trello_label_ids, is_active, checklist_name, checklist_items } = validationResult.data;
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const scheduleQuery = `
            INSERT INTO schedules (title, description, category, trello_member_ids, frequency, frequency_interval, frequency_details, trigger_hour, trigger_minute, trigger_ampm, start_date, start_hour, start_minute, start_ampm, end_date, trello_label_ids, is_active, checklist_name) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) 
            RETURNING *;
        `;
        const scheduleValues = [title, description, category || 'Uncategorized', trello_member_ids, frequency, frequency_interval || 1, frequency_details, trigger_hour, trigger_minute, trigger_ampm, start_date || null, start_hour, start_minute, start_ampm, end_date || null, trello_label_ids || [], is_active !== false, checklist_name];
        
        const scheduleResult = await client.query(scheduleQuery, scheduleValues);
        const newSchedule = scheduleResult.rows[0];

        if (checklist_items && checklist_items.length > 0) {
            const itemQuery = 'INSERT INTO checklist_items (schedule_id, item_name) VALUES ($1, $2)';
            for (const item of checklist_items) {
                await client.query(itemQuery, [newSchedule.id, item.item_name]);
            }
        }

        await client.query('COMMIT');
        
        const finalSchedule = { ...newSchedule, checklist_items };
        await logAuditEvent('INFO', `New schedule created: "${newSchedule.title}"`, { schedule: finalSchedule }, req.user);
        res.status(201).json(finalSchedule);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Create schedule error:', err);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
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
    const { title, description, category, trello_member_ids, frequency, frequency_interval, frequency_details, trigger_hour, trigger_minute, trigger_ampm, start_date, start_hour, start_minute, start_ampm, end_date, trello_label_ids, is_active, checklist_name, checklist_items } = validationResult.data;
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const beforeResult = await pool.query('SELECT * FROM schedules WHERE id = $1', [id]);
        if (beforeResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Schedule not found' });
        }

        const scheduleQuery = `
            UPDATE schedules SET 
            title = $1, description = $2, category = $3, trello_member_ids = $4, frequency = $5, 
            frequency_interval = $6, frequency_details = $7, trigger_hour = $8, 
            trigger_minute = $9, trigger_ampm = $10, start_date = $11, start_hour = $12, 
            start_minute = $13, start_ampm = $14, end_date = $15, trello_label_ids = $16, 
            is_active = $17, checklist_name = $18
            WHERE id = $19 
            RETURNING *;
        `;
        const scheduleValues = [title, description, category || 'Uncategorized', trello_member_ids, frequency, frequency_interval || 1, frequency_details, trigger_hour, trigger_minute, trigger_ampm, start_date || null, start_hour, start_minute, start_ampm, end_date || null, trello_label_ids || [], is_active, checklist_name, id];
        const scheduleResult = await client.query(scheduleQuery, scheduleValues);
        const updatedSchedule = scheduleResult.rows[0];

        await client.query('DELETE FROM checklist_items WHERE schedule_id = $1', [id]);

        if (checklist_items && checklist_items.length > 0) {
            const itemQuery = 'INSERT INTO checklist_items (schedule_id, item_name) VALUES ($1, $2)';
            for (const item of checklist_items) {
                await client.query(itemQuery, [id, item.item_name]);
            }
        }
        
        await client.query('COMMIT');
        
        const finalSchedule = { ...updatedSchedule, checklist_items };
        await logAuditEvent('INFO', `Schedule updated: "${updatedSchedule.title}"`, { before: beforeResult.rows[0], after: finalSchedule }, req.user);
        res.status(200).json(finalSchedule);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Update schedule error:', err);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
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
            return res.status(404).json({ message: 'Schedule not found.' });
        }
        
        const schedule = rows[0];

        if (req.user.role !== 'admin' && !schedule.trello_member_ids.includes(req.user.trello_id)) {
            await logAuditEvent('ERROR', `Unauthorized attempt to trigger schedule by user '${req.user.username}'.`, { scheduleId: id, members: schedule.trello_member_ids }, req.user);
            return res.status(403).json({ message: 'You are not authorized to trigger this schedule.' });
        }

        const result = await trelloService.processCardCreationForSchedule(schedule, appSettings, req.user);

        if (result.success) {
            res.status(result.status).json(result.card);
        } else {
            res.status(result.status).json({ message: result.message });
        }
    } catch (error) {
        // This outer catch block handles unexpected errors, like the initial DB query failing.
        const errorDetails = {
            scheduleId: id,
            error: error.message,
        };
        await logAuditEvent('ERROR', `Manual trigger failed unexpectedly for schedule ${id}.`, errorDetails, req.user);
        res.status(500).json({ message: 'An unexpected internal server error occurred.' });
    }
};

/**
 * @description Clones an existing schedule, creating a new one with a modified title.
 * @route POST /api/schedules/:id/clone
 * @access Private
 */
export const cloneSchedule = async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const scheduleResult = await client.query('SELECT * FROM schedules WHERE id = $1', [id]);
        if (scheduleResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Schedule to clone not found.' });
        }
        const originalSchedule = scheduleResult.rows[0];

        const itemsResult = await client.query('SELECT * FROM checklist_items WHERE schedule_id = $1', [id]);
        const originalChecklistItems = itemsResult.rows;

        const newScheduleData = {
            ...originalSchedule,
            title: `${originalSchedule.title} (Copy)`,
            active_card_id: null,
            last_card_created_at: null,
            trello_member_ids: originalSchedule.trello_member_ids,
        };

        const insertScheduleQuery = `
            INSERT INTO schedules (title, description, category, frequency, frequency_interval, frequency_details, trigger_hour, trigger_minute, trigger_ampm, start_date, start_hour, start_minute, start_ampm, end_date, trello_label_ids, trello_member_ids, checklist_name) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) 
            RETURNING *;
        `;
        const insertScheduleValues = [
            newScheduleData.title, newScheduleData.description, newScheduleData.category, 
            newScheduleData.frequency, newScheduleData.frequency_interval, newScheduleData.frequency_details, 
            newScheduleData.trigger_hour, newScheduleData.trigger_minute, newScheduleData.trigger_ampm, 
            newScheduleData.start_date, newScheduleData.start_hour, newScheduleData.start_minute, newScheduleData.start_ampm, newScheduleData.end_date, newScheduleData.trello_label_ids, newScheduleData.trello_member_ids,
            newScheduleData.checklist_name
        ];

        const clonedScheduleResult = await client.query(insertScheduleQuery, insertScheduleValues);
        const clonedSchedule = clonedScheduleResult.rows[0];

        let newChecklistItems = [];
        if (originalChecklistItems.length > 0) {
            const itemQuery = 'INSERT INTO checklist_items (schedule_id, item_name) VALUES ($1, $2) RETURNING *';
            for (const item of originalChecklistItems) {
                const newItemResult = await client.query(itemQuery, [clonedSchedule.id, item.item_name]);
                newChecklistItems.push(newItemResult.rows[0]);
            }
        }
        
        await client.query('COMMIT');

        const finalClonedSchedule = { ...clonedSchedule, checklist_items: newChecklistItems };

        await logAuditEvent('INFO', `Schedule cloned: "${clonedSchedule.title}"`, { originalId: id, newId: clonedSchedule.id }, req.user);
        res.status(201).json(finalClonedSchedule);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Clone schedule error:', error);
        await logAuditEvent('ERROR', `Failed to clone schedule ${id}.`, { error: String(error) }, req.user);
        res.status(500).json({ error: 'Internal server error.' });
    } finally {
        client.release();
    }
};
