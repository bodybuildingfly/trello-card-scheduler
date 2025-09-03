import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock dependencies
jest.unstable_mockModule('../db.js', () => ({
  default: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));

jest.unstable_mockModule('../services/trelloService.js', () => ({
  processCardCreationForSchedule: jest.fn(),
}));

jest.unstable_mockModule('../utils/logger.js', () => ({
  default: jest.fn(),
}));

// Dynamically import modules after mocks are set up
const pool = (await import('../db.js')).default;
const trelloService = await import('../services/trelloService.js');
const logAuditEvent = (await import('../utils/logger.js')).default;
const {
  getAllSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  toggleScheduleStatus,
  triggerSchedule,
  cloneSchedule,
  getUniqueCategories
} = await import('./schedulesController.js');


describe('Schedules Controller', () => {
  let req, res, mockClient;

  beforeEach(() => {
    jest.clearAllMocks();

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
    };

    // Mock the pool.connect method to return a mock client
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(mockClient);
  });

  describe('getAllSchedules', () => {
    it('should retrieve all schedules, group them by category, and return them', async () => {
      const mockSchedules = [
        { id: 1, title: 'Schedule 1', category: 'Category A', checklist_items: [] },
        { id: 2, title: 'Schedule 2', category: 'Category B', checklist_items: [] },
        { id: 3, title: 'Schedule 3', category: 'Category A', checklist_items: [] },
        { id: 4, title: 'Schedule 4', category: null, checklist_items: [] },
      ];
      const mockItems = [{ id: 1, schedule_id: 1, item_name: 'Item 1' }];

      pool.query
        .mockResolvedValueOnce({ rows: mockSchedules })
        .mockResolvedValueOnce({ rows: mockItems });
      
      req = {};

      await getAllSchedules(req, res);

      expect(pool.query).toHaveBeenCalledWith('SELECT * FROM schedules ORDER BY category ASC, id ASC');
      expect(pool.query).toHaveBeenCalledWith('SELECT * FROM checklist_items ORDER BY id ASC');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        'Category A': [
          { id: 1, title: 'Schedule 1', category: 'Category A', checklist_items: [{ id: 1, schedule_id: 1, item_name: 'Item 1' }] },
          { id: 3, title: 'Schedule 3', category: 'Category A', checklist_items: [] },
        ],
        'Category B': [
          { id: 2, title: 'Schedule 2', category: 'Category B', checklist_items: [] },
        ],
        'Uncategorized': [
            { id: 4, title: 'Schedule 4', category: null, checklist_items: [] },
        ]
      });
    });

    it('should return a 500 error if the database query fails', async () => {
      pool.query.mockRejectedValueOnce(new Error('DB Error'));
      
      req = {};

      await getAllSchedules(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Failed to load schedules.',
        details: 'DB Error',
      });
    });
  });

  describe('createSchedule', () => {
    let validScheduleData;

    beforeEach(() => {
      validScheduleData = {
        title: 'New Test Schedule',
        description: 'A description',
        category: 'Testing',
        trello_member_ids: ['member1'],
        frequency: 'daily',
        is_active: true,
        checklist_items: [{ item_name: 'Checklist Item 1' }],
      };
      
      // Mock the transaction begin
      mockClient.query.mockResolvedValueOnce(undefined); 
    });

    it('should create a schedule successfully and return it', async () => {
      const newSchedule = { id: 1, ...validScheduleData };
      mockClient.query
        .mockResolvedValueOnce({ rows: [newSchedule] }) // INSERT into schedules
        .mockResolvedValueOnce(undefined); // INSERT into checklist_items

      req = { body: validScheduleData, user: { id: 1, username: 'testuser' } };

      await createSchedule(req, res);

      expect(pool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO schedules'), expect.any(Array));
      expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO checklist_items'), [1, 'Checklist Item 1']);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ title: 'New Test Schedule' }));
      expect(logAuditEvent).toHaveBeenCalled();
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should return a 400 error for invalid input', async () => {
      const invalidData = { ...validScheduleData, title: '' }; // Missing title
      req = { body: invalidData };

      await createSchedule(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Invalid input.',
      }));
    });
    
    it('should return a 400 error if start time is after due time', async () => {
        const invalidTimeData = {
            ...validScheduleData,
            trigger_hour: '9',
            trigger_minute: '00',
            trigger_ampm: 'am',
            start_hour: '10',
            start_minute: '00',
            start_ampm: 'am',
        };
        req = { body: invalidTimeData };

        await createSchedule(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: 'Validation failed.',
        }));
    });

    it('should return a 500 error if the database query fails', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('DB Error'));
      req = { body: validScheduleData };

      await createSchedule(req, res);

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('updateSchedule', () => {
    let validScheduleData;
    const scheduleId = '1';

    beforeEach(() => {
      validScheduleData = {
        title: 'Updated Test Schedule',
        description: 'An updated description',
        category: 'Testing',
        trello_member_ids: ['member1', 'member2'],
        frequency: 'weekly',
        frequency_details: '1,3,5',
        is_active: true,
        checklist_items: [{ item_name: 'Updated Item 1' }],
      };
      // Mock the transaction begin
      mockClient.query.mockResolvedValue({ rows: [] }); // Default mock for client
    });

    it('should update a schedule successfully', async () => {
      const updatedSchedule = { id: scheduleId, ...validScheduleData };
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: scheduleId, title: 'Old Title' }] }) // SELECT before update
        .mockResolvedValueOnce({ rows: [updatedSchedule] }) // UPDATE
        .mockResolvedValueOnce(undefined) // DELETE items
        .mockResolvedValueOnce(undefined) // INSERT items
        .mockResolvedValueOnce(undefined); // COMMIT

      req = { params: { id: scheduleId }, body: validScheduleData, user: { id: 1 } };
      
      await updateSchedule(req, res);

      expect(pool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('SELECT * FROM schedules WHERE id = $1', [scheduleId]);
      expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE schedules SET'), expect.any(Array));
      expect(mockClient.query).toHaveBeenCalledWith('DELETE FROM checklist_items WHERE schedule_id = $1', [scheduleId]);
      expect(mockClient.query).toHaveBeenCalledWith('INSERT INTO checklist_items (schedule_id, item_name) VALUES ($1, $2)', [scheduleId, 'Updated Item 1']);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ title: 'Updated Test Schedule' }));
      expect(logAuditEvent).toHaveBeenCalled();
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should return 404 if the schedule to update is not found', async () => {
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // SELECT finds nothing

      req = { params: { id: '999' }, body: validScheduleData };

      await updateSchedule(req, res);

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Schedule not found' });
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should return a 400 error for invalid input', async () => {
      const invalidData = { ...validScheduleData, title: '' }; // Missing title
      req = { params: { id: scheduleId }, body: invalidData };

      await updateSchedule(req, res);

      // The validation happens before the transaction starts, so no db calls
      expect(pool.connect).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Invalid input.' }));
    });
    
    it('should return a 500 error if the database query fails', async () => {
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: scheduleId }] }) // SELECT finds a schedule
        .mockRejectedValueOnce(new Error('DB Error')); // UPDATE fails
        
      req = { params: { id: scheduleId }, body: validScheduleData };

      await updateSchedule(req, res);
      
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('deleteSchedule', () => {
    const scheduleId = '1';

    it('should delete a schedule successfully', async () => {
      // Mock the initial SELECT to find the schedule
      pool.query.mockResolvedValueOnce({ rows: [{ id: scheduleId, title: 'Test Schedule' }] });
      // Mock the DELETE query
      pool.query.mockResolvedValueOnce({ rowCount: 1 });
      
      req = { params: { id: scheduleId }, user: { id: 1 } };

      await deleteSchedule(req, res);

      expect(pool.query).toHaveBeenCalledWith('SELECT * FROM schedules WHERE id = $1', [scheduleId]);
      expect(pool.query).toHaveBeenCalledWith('DELETE FROM schedules WHERE id = $1;', [scheduleId]);
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
      expect(logAuditEvent).toHaveBeenCalled();
    });

    it('should return 404 if the schedule to delete is not found', async () => {
      // Mock the initial SELECT to find no schedule
      pool.query.mockResolvedValueOnce({ rows: [] });
      req = { params: { id: '999' } };

      await deleteSchedule(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Schedule not found' });
    });

    it('should return a 500 error if the database query fails', async () => {
      // Mock the initial SELECT to fail
      pool.query.mockRejectedValueOnce(new Error('DB Error'));
      req = { params: { id: scheduleId } };

      await deleteSchedule(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });

  describe('toggleScheduleStatus', () => {
    const scheduleId = '1';

    it('should toggle the status successfully', async () => {
      const updatedSchedule = { id: scheduleId, is_active: false };
      pool.query.mockResolvedValueOnce({ rows: [updatedSchedule] });
      req = { params: { id: scheduleId }, body: { is_active: false }, user: { id: 1 } };

      await toggleScheduleStatus(req, res);

      expect(pool.query).toHaveBeenCalledWith(
        'UPDATE schedules SET is_active = $1 WHERE id = $2 RETURNING *',
        [false, scheduleId]
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(updatedSchedule);
      expect(logAuditEvent).toHaveBeenCalled();
    });

    it('should return 404 if schedule is not found', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });
      req = { params: { id: '999' }, body: { is_active: false } };

      await toggleScheduleStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Schedule not found' });
    });

    it('should return 400 for invalid is_active value', async () => {
      req = { params: { id: scheduleId }, body: { is_active: 'not a boolean' } };

      await toggleScheduleStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid "is_active" value provided.' });
    });

    it('should return 500 on database error', async () => {
      pool.query.mockRejectedValueOnce(new Error('DB Error'));
      req = { params: { id: scheduleId }, body: { is_active: false } };

      await toggleScheduleStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });

  describe('triggerSchedule', () => {
    const scheduleId = '1';
    let mockSchedule;

    beforeEach(() => {
      mockSchedule = {
        id: scheduleId,
        title: 'Test Schedule',
        trello_member_ids: ['userTrelloId'],
      };
    });

    it('should trigger a schedule successfully if user is a member', async () => {
      pool.query.mockResolvedValueOnce({ rows: [mockSchedule] });
      trelloService.processCardCreationForSchedule.mockResolvedValueOnce({
        success: true,
        status: 201,
        card: { id: 'newCardId' },
      });
      req = {
        params: { id: scheduleId },
        appSettings: { /* mock app settings */ },
        user: { role: 'user', trello_id: 'userTrelloId' },
      };

      await triggerSchedule(req, res);

      expect(pool.query).toHaveBeenCalledWith('SELECT * FROM schedules WHERE id = $1', [scheduleId]);
      expect(trelloService.processCardCreationForSchedule).toHaveBeenCalledWith(mockSchedule, req.appSettings, req.user);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ id: 'newCardId' });
    });

    it('should return 403 if a non-admin user is not a member', async () => {
      pool.query.mockResolvedValueOnce({ rows: [mockSchedule] });
      req = {
        params: { id: scheduleId },
        user: { role: 'user', trello_id: 'anotherUser' },
      };

      await triggerSchedule(req, res);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'You are not authorized to trigger this schedule.' });
    });

    it('should allow an admin to trigger any schedule', async () => {
        pool.query.mockResolvedValueOnce({ rows: [mockSchedule] });
        trelloService.processCardCreationForSchedule.mockResolvedValueOnce({ success: true, status: 201, card: { id: 'newCardId' } });
        req = {
            params: { id: scheduleId },
            appSettings: {},
            user: { role: 'admin', trello_id: 'adminTrelloId' }, // Admin is not in trello_member_ids
        };

        await triggerSchedule(req, res);
        expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should return 404 if the schedule is not found', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });
      req = { params: { id: '999' }, user: { role: 'admin' } };

      await triggerSchedule(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Schedule not found.' });
    });

    it('should pass through the status and message from a failed trelloService call', async () => {
        pool.query.mockResolvedValueOnce({ rows: [mockSchedule] });
        trelloService.processCardCreationForSchedule.mockResolvedValueOnce({
            success: false,
            status: 409,
            message: 'Card is still active.',
        });
        req = { params: { id: scheduleId }, appSettings: {}, user: { role: 'admin' } };
        
        await triggerSchedule(req, res);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith({ message: 'Card is still active.' });
    });
  });

  describe('cloneSchedule', () => {
    const scheduleId = '1';
    let originalSchedule, originalChecklistItems, clonedSchedule;

    beforeEach(() => {
      originalSchedule = { id: scheduleId, title: 'Original', trello_member_ids: [] };
      originalChecklistItems = [{ id: 1, schedule_id: scheduleId, item_name: 'Item 1' }];
      clonedSchedule = { ...originalSchedule, id: '2', title: 'Original (Copy)' };
      
      // Default mock for client queries
      mockClient.query.mockResolvedValue({ rows: [] });
    });

    it('should clone a schedule and its checklist items successfully', async () => {
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [originalSchedule] }) // SELECT original schedule
        .mockResolvedValueOnce({ rows: originalChecklistItems }) // SELECT original items
        .mockResolvedValueOnce({ rows: [clonedSchedule] }) // INSERT cloned schedule
        .mockResolvedValueOnce({ rows: [{ ...originalChecklistItems[0], id: 2, schedule_id: '2' }] }) // INSERT cloned item
        .mockResolvedValueOnce(undefined); // COMMIT

      req = { params: { id: scheduleId }, user: { id: 1 } };
      
      await cloneSchedule(req, res);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('SELECT * FROM schedules WHERE id = $1', [scheduleId]);
      expect(mockClient.query).toHaveBeenCalledWith('SELECT * FROM checklist_items WHERE schedule_id = $1', [scheduleId]);
      expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO schedules'), expect.any(Array));
      expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO checklist_items'), ['2', 'Item 1']);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        id: '2',
        title: 'Original (Copy)',
        checklist_items: expect.any(Array),
      }));
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should return 404 if the schedule to clone is not found', async () => {
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // SELECT original schedule finds nothing

      req = { params: { id: '999' }, user: { id: 1 } };

      await cloneSchedule(req, res);

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Schedule to clone not found.' });
    });
    
    it('should return 500 on database error', async () => {
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockRejectedValueOnce(new Error('DB Error')); // SELECT original schedule fails

      req = { params: { id: scheduleId }, user: { id: 1 } };

      await cloneSchedule(req, res);
      
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error.' });
    });
  });

  describe('getUniqueCategories', () => {
    it('should return a unique list of categories', async () => {
      const mockCategories = [{ category: 'Category A' }, { category: 'Category B' }];
      pool.query.mockResolvedValueOnce({ rows: mockCategories });
      req = {};

      await getUniqueCategories(req, res);

      expect(pool.query).toHaveBeenCalledWith("SELECT DISTINCT category FROM schedules WHERE category IS NOT NULL AND category <> '' ORDER BY category ASC");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(['Category A', 'Category B']);
    });

    it('should return 500 on database error', async () => {
      pool.query.mockRejectedValueOnce(new Error('DB Error'));
      req = {};

      await getUniqueCategories(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Failed to fetch categories.' }));
    });
  });
});
