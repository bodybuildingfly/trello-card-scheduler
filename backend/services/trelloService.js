import axios from 'axios';
import pool from '../db.js';
import { calculateNextDueDate } from './schedulerService.js';
import logAuditEvent from '../utils/logger.js';

/**
 * @description Fetches all members for a given Trello board using axios.
 * @param {string} key - The Trello API key.
 * @param {string} token - The Trello API token.
 * @param {string} boardId - The ID of the Trello board.
 * @returns {Promise<object[]>} A promise that resolves to an array of member objects.
 */
export const getTrelloBoardMembers = async (key, token, boardId) => {
    if (!key || !token || !boardId) {
        throw new Error('Trello credentials or Board ID are missing');
    }
    const url = `https://api.trello.com/1/boards/${boardId}/members?key=${key}&token=${token}`;
    const response = await axios.get(url);
    return response.data;
};

/**
 * @description Fetches a single Trello card by its ID using axios.
 * @param {string} cardId - The ID of the Trello card.
 * @param {object} appSettings - The application settings object containing API credentials.
 * @returns {Promise<object|null>} A promise that resolves to the card object or null if not found.
 */
export const getTrelloCard = async (cardId, appSettings) => {
    const { TRELLO_API_KEY, TRELLO_API_TOKEN } = appSettings;
    const url = `https://api.trello.com/1/cards/${cardId}?key=${TRELLO_API_KEY}&token=${TRELLO_API_TOKEN}`;
    try {
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        if (error.response && error.response.status === 404) {
            return null;
        }
        throw error;
    }
};

/**
 * @description Processes a schedule to determine if a new card should be created, and if so, creates it.
 * @param {object} schedule - The schedule object from the database.
 * @param {object} appSettings - The application settings object.
 * @param {object} [user=null] - The user object, for auditing manual triggers.
 * @returns {Promise<{success: boolean, message: string, card?: object, status?: number}>}
 */
export const processCardCreationForSchedule = async (schedule, appSettings, user = null) => {
    const logContext = { scheduleId: schedule.id, trigger: user ? 'manual' : 'scheduled' };

    let lastDueDateForCalc = null;
    if (schedule.active_card_id) {
        try {
            const activeCard = await getTrelloCard(schedule.active_card_id, appSettings);
            if (activeCard && !activeCard.closed && activeCard.idList !== appSettings.TRELLO_DONE_LIST_ID) {
                const message = `Cannot create a new card. The previous card "${activeCard.name}" is still active.`;
                await logAuditEvent('INFO', `Card creation blocked for schedule ${schedule.id}.`, { ...logContext, reason: message }, user);
                return { success: false, message, status: 409 };
            }
            if (activeCard) {
                lastDueDateForCalc = new Date(activeCard.due);
            }
        } catch (error) {
            await logAuditEvent('ERROR', `Could not verify status of active card ${schedule.active_card_id}. Proceeding with caution.`, { ...logContext, error: String(error) }, user);
        }
    }

    let nextDueDate = calculateNextDueDate(schedule, lastDueDateForCalc);
    const startDate = schedule.start_date ? new Date(schedule.start_date) : null;
    const endDate = schedule.end_date ? new Date(schedule.end_date) : null;

    // If the calculated due date is before the schedule's start date, we need to recalculate
    // using the start date as the baseline to find the *first* valid due date.
    if (startDate && nextDueDate < startDate) {
        nextDueDate = calculateNextDueDate(schedule, lastDueDateForCalc, startDate);
    }

    // Now that we have the correct next due date based on frequency and start date,
    // we check if this date falls outside the schedule's end date.
    if (endDate && nextDueDate > endDate) {
        const message = `Cannot create card. The schedule's frequency settings do not produce any valid due dates within the active date range.`;
        await logAuditEvent('INFO', `Card creation blocked for schedule ${schedule.id}.`, { ...logContext, reason: message, dueDate: nextDueDate.toLocaleDateString() }, user);
        return { success: false, message, status: 400 };
    }
    
    try {
        // Ensure checklist items are loaded for the createTrelloCard function
        if (!schedule.checklist_items) {
            const itemsResult = await pool.query('SELECT * FROM checklist_items WHERE schedule_id = $1 ORDER BY id ASC', [schedule.id]);
            schedule.checklist_items = itemsResult.rows;
        }

        const newCard = await createTrelloCard(schedule, nextDueDate, appSettings);
        
        if (newCard) {
            await logAuditEvent('INFO', `Card creation successful: "${newCard.name}"`, { ...logContext, newCard, dueDate: nextDueDate }, user);
            await pool.query(
                'UPDATE schedules SET active_card_id = $1, last_card_created_at = NOW() WHERE id = $2', 
                [newCard.id, schedule.id]
            );
            return { success: true, message: "Card created successfully.", card: newCard, status: 201 };
        } else {
            // This case might be redundant if createTrelloCard throws, but it's here for safety.
            const message = 'Failed to create Trello card for an unknown reason.';
            await logAuditEvent('ERROR', message, logContext, user);
            return { success: false, message, status: 500 };
        }
    } catch (error) {
        const errorDetails = {
            ...logContext,
            statusCode: error.response?.status,
            response: error.response?.data || error.message,
        };
        await logAuditEvent('ERROR', `Card creation failed during API call.`, errorDetails, user);
        return { success: false, message: 'Failed to create Trello card.', status: error.response?.status || 500, error: error.message };
    }
};

/**
 * @description Creates a new Trello card using axios.
 * @param {object} schedule - The schedule object from the database.
 * @param {Date} dueDate - The calculated due date for the new card.
 * @param {object} appSettings - The application settings object.
 * @returns {Promise<object|null>} A promise that resolves to the new card object or null on failure.
 */
export const createTrelloCard = async (schedule, dueDate, appSettings) => {
    const { TRELLO_API_KEY, TRELLO_API_TOKEN, TRELLO_TO_DO_LIST_ID, TRELLO_BOARD_ID } = appSettings;

    if (!TRELLO_TO_DO_LIST_ID) {
        throw new Error(`Card creation failed: 'To Do List ID' is not configured in settings.`);
    }

    const members = await getTrelloBoardMembers(TRELLO_API_KEY, TRELLO_API_TOKEN, TRELLO_BOARD_ID);
    const member = members.find(m => m.fullName === schedule.owner_name);
    if (!member) {
        throw new Error(`Card creation failed: Trello member "${schedule.owner_name}" not found.`);
    }

    const cardData = {
        name: schedule.title,
        desc: schedule.description,
        idList: TRELLO_TO_DO_LIST_ID,
        idMembers: [member.id],
        due: dueDate.toISOString()
    };

    if (schedule.trello_label_ids && schedule.trello_label_ids.length > 0) {
        cardData.idLabels = schedule.trello_label_ids.join(',');
    }

    const cardUrl = `https://api.trello.com/1/cards?key=${TRELLO_API_KEY}&token=${TRELLO_API_TOKEN}`;
    const cardResponse = await axios.post(cardUrl, cardData);
    const newCard = cardResponse.data;

    if (schedule.checklist_name && schedule.checklist_items && schedule.checklist_items.length > 0) {
        const checklistUrl = `https://api.trello.com/1/checklists?idCard=${newCard.id}&name=${schedule.checklist_name}&key=${TRELLO_API_KEY}&token=${TRELLO_API_TOKEN}`;
        const checklistResponse = await axios.post(checklistUrl);
        const newChecklist = checklistResponse.data;

        for (const item of schedule.checklist_items) {
            const itemUrl = `https://api.trello.com/1/checklists/${newChecklist.id}/checkItems?key=${TRELLO_API_KEY}&token=${TRELLO_API_TOKEN}`;
            await axios.post(itemUrl, { name: item.item_name, checked: false });
        }
    }
    
    return newCard;
};