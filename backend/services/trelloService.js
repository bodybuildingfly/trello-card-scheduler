import https from 'https';
import axios from 'axios';

const getTrelloBoardMembers = (key, token, boardId) => {
    if (!key || !token || !boardId) return Promise.reject('Trello credentials missing');
    const options = { hostname: 'api.trello.com', path: `/1/boards/${boardId}/members?key=${key}&token=${token}`, method: 'GET' };
    return new Promise((resolve, reject) => {
        const req = https.request(options, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => res.statusCode === 200 ? resolve(JSON.parse(data)) : reject({statusCode: res.statusCode, data}));
        });
        req.on('error', reject);
        req.end();
    });
};

const getTrelloCard = async (cardId) => {
    const { TRELLO_API_KEY, TRELLO_API_TOKEN } = appSettings;
    const options = { hostname: 'api.trello.com', path: `/1/cards/${cardId}?key=${TRELLO_API_KEY}&token=${TRELLO_API_TOKEN}`, method: 'GET' };
    return new Promise((resolve, reject) => {
        const req = https.request(options, res => {
            if (res.statusCode === 404) return resolve(null);
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => res.statusCode === 200 ? resolve(JSON.parse(data)) : reject(`Trello API status: ${res.statusCode}`));
        });
        req.on('error', reject);
        req.end();
    });
};

const createTrelloCard = async (schedule, dueDate) => {
    const { TRELLO_API_KEY, TRELLO_API_TOKEN, TRELLO_TO_DO_LIST_ID, TRELLO_BOARD_ID, TRELLO_LABEL_ID } = appSettings;
    const members = await getTrelloBoardMembers(TRELLO_API_KEY, TRELLO_API_TOKEN, TRELLO_BOARD_ID);
    const member = members.find(m => m.fullName === schedule.owner_name);
    if (!member) {
        await logAuditEvent('ERROR', `Card creation failed: Trello member "${schedule.owner_name}" not found.`, { schedule });
        return null;
    }
    const card = { name: schedule.title, desc: schedule.description, idList: TRELLO_TO_DO_LIST_ID, idMembers: [member.id], idLabels: [TRELLO_LABEL_ID], due: dueDate.toISOString() };
    const postData = JSON.stringify(card);
    const options = { hostname: 'api.trello.com', path: `/1/cards?key=${TRELLO_API_KEY}&token=${TRELLO_API_TOKEN}`, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': postData.length } };
    return new Promise((resolve, reject) => {
        const req = https.request(options, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    const newCard = JSON.parse(data);
                    logAuditEvent('INFO', `Card creation successful: "${newCard.name}"`, { schedule, newCard, dueDate });
                    resolve(newCard);
                } else {
                    logAuditEvent('ERROR', 'Card creation failed: Trello API error.', { schedule, statusCode: res.statusCode, response: data });
                    reject(data);
                }
            });
        });
        req.on('error', (error) => {
            logAuditEvent('ERROR', 'Card creation failed: Network error.', { schedule, error: error.message });
            reject(error);
        });
        req.write(postData);
        req.end();
    });
};

export {
  getTrelloBoardMembers,
  getTrelloCard,
  createTrelloCard
};
