import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

// Mock dependencies using the modern API for ES Modules
jest.unstable_mockModule('../db.js', () => ({
    default: {
        query: jest.fn(),
    }
}));

jest.unstable_mockModule('../utils/logger.js', () => ({
    default: jest.fn(),
}));

jest.unstable_mockModule('./schedulerService.js', () => ({
    calculateNextDueDate: jest.fn(),
}));

// Dynamically import modules after mocks are set up
const pool = (await import('../db.js')).default;
const logAuditEvent = (await import('../utils/logger.js')).default;
const { calculateNextDueDate } = await import('./schedulerService.js');
const { getTrelloBoardMembers, getTrelloCard, createTrelloCard, processCardCreationForSchedule } = await import('./trelloService.js');


describe('Trello Service', () => {
    let mock;

    beforeEach(() => {
        mock = new MockAdapter(axios);
        // Clear mocks before each test
        pool.query.mockClear();
        logAuditEvent.mockClear();
        calculateNextDueDate.mockClear();
    });

    afterEach(() => {
        mock.restore();
    });

    describe('getTrelloBoardMembers', () => {
        it('should fetch board members successfully', async () => {
            const members = [{ id: '1', fullName: 'Test User' }];
            mock.onGet('https://api.trello.com/1/boards/boardId/members?key=key&token=token').reply(200, members);

            const result = await getTrelloBoardMembers('key', 'token', 'boardId');
            expect(result).toEqual(members);
        });

        it('should throw an error if credentials or board ID are missing', async () => {
            await expect(getTrelloBoardMembers(null, 'token', 'boardId')).rejects.toThrow('Trello credentials or Board ID are missing');
            await expect(getTrelloBoardMembers('key', null, 'boardId')).rejects.toThrow('Trello credentials or Board ID are missing');
            await expect(getTrelloBoardMembers('key', 'token', null)).rejects.toThrow('Trello credentials or Board ID are missing');
        });
    });

    describe('getTrelloCard', () => {
        const appSettings = { TRELLO_API_KEY: 'key', TRELLO_API_TOKEN: 'token' };
        const cardId = 'cardId';

        it('should fetch a card successfully', async () => {
            const card = { id: cardId, name: 'Test Card' };
            mock.onGet(`https://api.trello.com/1/cards/${cardId}?key=key&token=token`).reply(200, card);

            const result = await getTrelloCard(cardId, appSettings);
            expect(result).toEqual(card);
        });

        it('should return null if the card is not found (404)', async () => {
            mock.onGet(`https://api.trello.com/1/cards/${cardId}?key=key&token=token`).reply(404);

            const result = await getTrelloCard(cardId, appSettings);
            expect(result).toBeNull();
        });

        it('should throw an error for other API errors', async () => {
            mock.onGet(`https://api.trello.com/1/cards/${cardId}?key=key&token=token`).reply(500);

            await expect(getTrelloCard(cardId, appSettings)).rejects.toThrow();
        });
    });

    describe('createTrelloCard', () => {
        const appSettings = {
            TRELLO_API_KEY: 'key',
            TRELLO_API_TOKEN: 'token',
            TRELLO_TO_DO_LIST_ID: 'todoListId',
            TRELLO_BOARD_ID: 'boardId',
        };
        const dueDate = new Date('2024-08-15T13:00:00Z');
        const baseSchedule = {
            id: 1,
            title: 'Test Card',
            description: 'Test Description',
            trello_member_ids: ['member1'],
        };

        beforeEach(() => {
            // Mock getTrelloBoardMembers to always return valid members
            mock.onGet('https://api.trello.com/1/boards/boardId/members?key=key&token=token').reply(200, [
                { id: 'member1', fullName: 'Test User 1' },
                { id: 'member2', fullName: 'Test User 2' },
            ]);
        });

        it('should create a basic card successfully', async () => {
            const expectedCard = { id: 'newCardId', name: 'Test Card' };
            mock.onPost(/https:\/\/api\.trello\.com\/1\/cards\?key=key&token=token/).reply(201, expectedCard);

            const result = await createTrelloCard(baseSchedule, dueDate, appSettings);

            expect(result).toEqual(expectedCard);
            expect(mock.history.post[0].data).toContain('"name":"Test Card"');
            expect(mock.history.post[0].data).toContain('"idMembers":["member1"]');
        });

        it('should create a card with all options: labels, start date, and checklist', async () => {
            const schedule = {
                ...baseSchedule,
                trello_label_ids: ['label1', 'label2'],
                start_hour: '9',
                start_minute: '30',
                start_ampm: 'am',
                checklist_name: 'My Checklist',
                checklist_items: [{ item_name: 'Item 1' }, { item_name: 'Item 2' }],
            };
            const newCard = { id: 'card123', name: schedule.title };
            const newChecklist = { id: 'checklist123', name: schedule.checklist_name };

            mock.onPost(/https:\/\/api\.trello\.com\/1\/cards\?key=key&token=token/).reply(201, newCard);
            mock.onPost(`https://api.trello.com/1/checklists?idCard=${newCard.id}&name=${schedule.checklist_name}&key=key&token=token`).reply(201, newChecklist);
            mock.onPost(new RegExp(`https://api.trello.com/1/checklists/${newChecklist.id}/checkItems`)).reply(200);

            const result = await createTrelloCard(schedule, dueDate, appSettings);

            expect(result).toEqual(newCard);
            const cardPayload = JSON.parse(mock.history.post[0].data);
            expect(cardPayload.idLabels).toBe('label1,label2');
            expect(cardPayload.start).toBe('2024-08-15T13:30:00.000Z');
            expect(mock.history.post.length).toBe(4); // 1 for card, 1 for checklist, 2 for items
        });

        it('should throw an error if "To Do List ID" is not configured', async () => {
            const settingsWithoutListId = { ...appSettings, TRELLO_TO_DO_LIST_ID: null };
            await expect(createTrelloCard(baseSchedule, dueDate, settingsWithoutListId)).rejects.toThrow(
                "Card creation failed: 'To Do List ID' is not configured in settings."
            );
        });

        it('should throw an error if no members are assigned', async () => {
            const scheduleWithoutMembers = { ...baseSchedule, trello_member_ids: [] };
            await expect(createTrelloCard(scheduleWithoutMembers, dueDate, appSettings)).rejects.toThrow(
                'Card creation failed: No Trello members assigned to the schedule.'
            );
        });

        it('should throw an error if an assigned member is not on the board', async () => {
            const scheduleWithInvalidMember = { ...baseSchedule, trello_member_ids: ['member1', 'invalidMember'] };
            await expect(createTrelloCard(scheduleWithInvalidMember, dueDate, appSettings)).rejects.toThrow(
                'Card creation failed: The following assigned user IDs are not on the Trello board: invalidMember'
            );
        });

        it('should throw an error if the card creation API call fails', async () => {
            mock.onPost(/https:\/\/api\.trello\.com\/1\/cards\?key=key&token=token/).reply(500, { message: 'Internal Server Error' });
            await expect(createTrelloCard(baseSchedule, dueDate, appSettings)).rejects.toThrow();
        });

        it('should throw an error if the checklist creation API call fails', async () => {
            const scheduleWithChecklist = {
                ...baseSchedule,
                checklist_name: 'My Checklist',
                checklist_items: [{ item_name: 'Item 1' }],
            };
            mock.onPost(/https:\/\/api\.trello\.com\/1\/cards\?key=key&token=token/).reply(201, { id: 'card123' });
            mock.onPost(/checklists/).reply(500); // Fail checklist creation

            await expect(createTrelloCard(scheduleWithChecklist, dueDate, appSettings)).rejects.toThrow();
        });
    });

    describe('processCardCreationForSchedule', () => {
        const appSettings = {
            TRELLO_API_KEY: 'key',
            TRELLO_API_TOKEN: 'token',
            TRELLO_DONE_LIST_ID: 'doneListId',
            TRELLO_TO_DO_LIST_ID: 'todoListId',
            TRELLO_BOARD_ID: 'boardId',
        };
        const baseSchedule = {
            id: 1,
            title: 'Recurring Task',
            description: 'A task that recurs.',
            frequency: 'daily',
            active_card_id: null,
            trello_member_ids: ['member1'],
        };
        const nextDueDate = new Date('2024-08-20T12:00:00Z');

        beforeEach(() => {
            // Mock dependencies that are almost always called
            calculateNextDueDate.mockReturnValue(nextDueDate);
            // Mock for createTrelloCard's internal member check
            mock.onGet(/members/).reply(200, [{ id: 'member1' }]);
            // Mock for createTrelloCard's card creation
            mock.onPost(/cards/).reply(201, { id: 'newCardId', name: baseSchedule.title });
            // A generic mock for the database. Specific tests can override this.
            pool.query.mockResolvedValue({ rows: [] });
        });

        it('should create a new card if none is active', async () => {
            // Pass a copy of baseSchedule to prevent mutation across tests
            const result = await processCardCreationForSchedule({ ...baseSchedule }, appSettings);

            expect(calculateNextDueDate).toHaveBeenCalledWith(expect.any(Object), null);
            expect(mock.history.post.some(req => req.url.includes('cards'))).toBe(true);
            expect(pool.query).toHaveBeenCalledWith(
                'UPDATE schedules SET active_card_id = $1, last_card_created_at = NOW() WHERE id = $2',
                ['newCardId', baseSchedule.id]
            );
            expect(result.success).toBe(true);
            expect(result.status).toBe(201);
            expect(result.card.id).toBe('newCardId');
        });

        it('should block card creation if a previous card is still active', async () => {
            const schedule = { ...baseSchedule, active_card_id: 'activeCardId' };
            const activeCard = { id: 'activeCardId', name: 'Still Active', closed: false, idList: 'inProgressListId' };
            mock.onGet(/cards\/activeCardId/).reply(200, activeCard);

            const result = await processCardCreationForSchedule(schedule, appSettings);

            expect(mock.history.post.some(req => req.url.includes('cards'))).toBe(false);
            expect(pool.query).not.toHaveBeenCalledWith(expect.stringContaining('UPDATE'));
            expect(result.success).toBe(false);
            expect(result.status).toBe(409);
            expect(result.message).toContain('is still active');
        });

        it('should create a card if the previous card is in the "Done" list', async () => {
            const schedule = { ...baseSchedule, active_card_id: 'doneCardId' };
            const doneCard = { id: 'doneCardId', name: 'Done Task', closed: false, idList: appSettings.TRELLO_DONE_LIST_ID, due: '2024-08-19T12:00:00Z' };
            mock.onGet(/cards\/doneCardId/).reply(200, doneCard);

            const result = await processCardCreationForSchedule(schedule, appSettings);

            expect(calculateNextDueDate).toHaveBeenCalledWith(schedule, new Date(doneCard.due));
            expect(result.success).toBe(true);
            expect(result.status).toBe(201);
        });

        it('should block creation if the next due date is past the schedule end date', async () => {
            const schedule = { ...baseSchedule, end_date: new Date('2024-08-19T23:59:59Z') };
            calculateNextDueDate.mockReturnValue(new Date('2024-08-20T12:00:00Z')); // This is after the end date

            const result = await processCardCreationForSchedule(schedule, appSettings);

            expect(result.success).toBe(false);
            expect(result.status).toBe(400);
            expect(result.message).toContain('valid due dates within the active date range');
        });

        it('should correctly recalculate the first due date based on the schedule start date', async () => {
            const schedule = { ...baseSchedule, start_date: new Date('2024-09-01T00:00:00Z') };
            const firstCalculatedDate = new Date('2024-08-20T12:00:00Z'); // Before start date
            const secondCalculatedDate = new Date('2024-09-02T12:00:00Z'); // Corrected date

            // First call returns a date before the start_date
            calculateNextDueDate.mockReturnValueOnce(firstCalculatedDate);
            // The function should call it again, and we mock the second, corrected return value
            calculateNextDueDate.mockReturnValueOnce(secondCalculatedDate);

            await processCardCreationForSchedule(schedule, appSettings);

            expect(calculateNextDueDate).toHaveBeenCalledTimes(2);
            expect(calculateNextDueDate).toHaveBeenNthCalledWith(1, schedule, null);
            expect(calculateNextDueDate).toHaveBeenNthCalledWith(2, schedule, null, schedule.start_date);
            const cardPayload = JSON.parse(mock.history.post.find(req => req.url.includes('cards')).data);
            expect(cardPayload.due).toBe(secondCalculatedDate.toISOString());
        });

        it('should load checklist items from DB if not present on the schedule object', async () => {
            const scheduleWithoutChecklist = { ...baseSchedule, checklist_name: 'My Checklist' };
            const dbChecklistItems = { rows: [{ id: 1, item_name: 'DB Item' }] };
            
            // Isolate the DB mock for this test to avoid conflicts
            pool.query.mockReset();
            pool.query
                .mockResolvedValueOnce(dbChecklistItems) // For the SELECT call
                .mockResolvedValueOnce({ rows: [] });    // For the subsequent UPDATE call

            // Mock checklist creation API calls
            mock.onPost(/checklists\?idCard=/).reply(201, { id: 'checklist123' });
            mock.onPost(/checklists\/checklist123\/checkItems/).reply(200);

            await processCardCreationForSchedule(scheduleWithoutChecklist, appSettings);

            expect(pool.query).toHaveBeenCalledWith('SELECT * FROM checklist_items WHERE schedule_id = $1 ORDER BY id ASC', [scheduleWithoutChecklist.id]);
            // Verify that the checklist item from the DB was sent to Trello
            expect(mock.history.post.find(req => req.url.includes('checkItems')).data).toContain('DB Item');
        });

        it('should return a failure response if createTrelloCard throws an error', async () => {
            mock.onPost(/cards/).reply(500, { message: 'Trello API Error' });
            
            const result = await processCardCreationForSchedule(baseSchedule, appSettings);
            
            expect(result.success).toBe(false);
            expect(result.status).toBe(500);
            expect(result.message).toBe('Failed to create Trello card.');
            expect(logAuditEvent).toHaveBeenCalledWith('ERROR', 'Card creation failed during API call.', expect.any(Object), null);
            expect(pool.query).not.toHaveBeenCalledWith(expect.stringContaining('UPDATE'));
        });
    });
});
