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
            return null;
        }
        throw error;
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

    // Use the label IDs from the individual schedule object if it exists.
    if (schedule.trello_label_ids && schedule.trello_label_ids.length > 0) {
        cardData.idLabels = schedule.trello_label_ids.join(',');
    }

    const url = `https://api.trello.com/1/cards?key=${TRELLO_API_KEY}&token=${TRELLO_API_TOKEN}`;
    
    const response = await axios.post(url, cardData);
    
    return response.data;
};