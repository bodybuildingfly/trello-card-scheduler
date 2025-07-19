import axios from 'axios';

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
            return null; // Card not found is not a critical error
        }
        // Re-throw other errors to be handled by the caller
        throw error;
    }
};

/**
 * @description Creates a new Trello card using axios.
 * @param {object} schedule - The schedule record from the database.
 * @param {Date} dueDate - The calculated due date for the new card.
 * @param {object} appSettings - The application settings object.
 * @param {function} logAuditEvent - The audit logging function.
 * @param {string} runId - The ID of the scheduler run, for auditing purposes.
 * @returns {Promise<object|null>} A promise that resolves to the new card object or null on failure.
 */
export const createTrelloCard = async (schedule, dueDate, appSettings, logAuditEvent, runId) => {
    const { TRELLO_API_KEY, TRELLO_API_TOKEN, TRELLO_TO_DO_LIST_ID, TRELLO_BOARD_ID, TRELLO_LABEL_ID } = appSettings;

    if (!TRELLO_TO_DO_LIST_ID) {
        await logAuditEvent('ERROR', `Card creation failed: 'To Do List ID' is not configured in settings.`, { schedule, runId });
        return null;
    }

    try {
        const members = await getTrelloBoardMembers(TRELLO_API_KEY, TRELLO_API_TOKEN, TRELLO_BOARD_ID);
        const member = members.find(m => m.fullName === schedule.owner_name);
        if (!member) {
            await logAuditEvent('ERROR', `Card creation failed: Trello member "${schedule.owner_name}" not found.`, { schedule, runId });
            return null;
        }

        const cardData = {
            name: schedule.title,
            desc: schedule.description,
            idList: TRELLO_TO_DO_LIST_ID,
            idMembers: [member.id],
            due: dueDate.toISOString()
        };

        if (TRELLO_LABEL_ID) {
            cardData.idLabels = [TRELLO_LABEL_ID];
        }

        const url = `https://api.trello.com/1/cards?key=${TRELLO_API_KEY}&token=${TRELLO_API_TOKEN}`;
        
        const response = await axios.post(url, cardData);
        
        const newCard = response.data;
        // --- UPDATED: Include the runId in the audit log details ---
        await logAuditEvent('INFO', `Card creation successful: "${newCard.name}"`, { schedule, newCard, dueDate, runId });
        return newCard;

    } catch (error) {
        const errorDetails = {
            schedule,
            statusCode: error.response?.status,
            response: error.response?.data || error.message,
            runId // --- UPDATED: Include the runId in error logs as well ---
        };
        await logAuditEvent('ERROR', 'Card creation failed: Trello API error.', errorDetails);
        throw new Error(error.response?.data?.message || 'Failed to create Trello card');
    }
};