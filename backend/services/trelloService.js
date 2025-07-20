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
 * @description Creates a new Trello card using axios. This function no longer handles logging.
 * @param {object} schedule - The schedule record from the database.
 * @param {Date} dueDate - The calculated due date for the new card.
 * @param {object} appSettings - The application settings object.
 * @returns {Promise<object|null>} A promise that resolves to the new card object or null on failure.
 */
export const createTrelloCard = async (schedule, dueDate, appSettings) => {
    const { TRELLO_API_KEY, TRELLO_API_TOKEN, TRELLO_TO_DO_LIST_ID, TRELLO_BOARD_ID, TRELLO_LABEL_ID } = appSettings;

    if (!TRELLO_TO_DO_LIST_ID) {
        // Throw an error instead of logging, so the caller can handle it.
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

    if (TRELLO_LABEL_ID) {
        cardData.idLabels = [TRELLO_LABEL_ID];
    }

    const url = `https://api.trello.com/1/cards?key=${TRELLO_API_KEY}&token=${TRELLO_API_TOKEN}`;
    
    // Axios will throw an error automatically on a non-2xx response,
    // which will be caught by the calling function (e.g., runScheduler).
    const response = await axios.post(url, cardData);
    
    return response.data;
};