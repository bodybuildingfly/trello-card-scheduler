import { calculateNextDueDate } from './schedulerService.js';

// The function under test uses the server's local time for calculations (e.g., `setHours`),
// while `toISOString()` returns a UTC string. This test suite is written to simulate a server
// running in the 'America/New_York' timezone to ensure the logic is correct.
//
// We account for both EDT (UTC-4, during summer) and EST (UTC-5, during winter).
//
// All date initializations and expectations are in UTC to make the tests deterministic.

describe('calculateNextDueDate', () => {
  // Mock 'now' to be 10:00 AM EDT on a Thursday. 10:00 EDT = 14:00 UTC.
  const now = new Date('2024-08-15T14:00:00Z');

  // Base schedule for 9:00 AM. In EDT, this is 13:00 UTC.
  const baseSchedule = {
    trigger_hour: '9',
    trigger_minute: '00',
    trigger_ampm: 'am',
  };

  describe('Daily Frequency', () => {
    it('should calculate the next daily occurrence for the following day', () => {
      const schedule = { ...baseSchedule, frequency: 'daily', frequency_interval: 1 };
      const nextDueDate = calculateNextDueDate(schedule, null, now);
      // now is 10am EDT, schedule is 9am EDT. Time has passed.
      // Expect next day at 9am EDT, which is 1pm (13:00) UTC.
      expect(nextDueDate.toISOString()).toBe('2024-08-16T13:00:00.000Z');
    });

    it('should calculate the next daily occurrence with an interval of 3 days', () => {
      const schedule = { ...baseSchedule, frequency: 'daily', frequency_interval: 3 };
      const lastDueDate = new Date('2024-08-15T13:00:00Z'); // Aug 15, 9am EDT
      const nextDueDate = calculateNextDueDate(schedule, lastDueDate, now);
      expect(nextDueDate.toISOString()).toBe('2024-08-18T13:00:00.000Z');
    });

     it('should calculate the correct date if the trigger time for "today" has not passed yet', () => {
      // Schedule for 11am EDT. now is 10am EDT.
      const schedule = { ...baseSchedule, frequency: 'daily', trigger_hour: '11', trigger_ampm: 'am' };
      const nextDueDate = calculateNextDueDate(schedule, null, now);
      expect(nextDueDate.toISOString()).toBe('2024-08-15T15:00:00.000Z'); // Today at 11am EDT (15:00 UTC)
    });
  });

  describe('Weekly Frequency', () => {
    it('should calculate the next occurrence on a specified weekday', () => {
      // Schedule for Friday (5). Today is Thursday (4).
      const schedule = { ...baseSchedule, frequency: 'weekly', frequency_interval: 1, frequency_details: '5' };
      const nextDueDate = calculateNextDueDate(schedule, null, now);
      expect(nextDueDate.toISOString()).toBe('2024-08-16T13:00:00.000Z'); // Friday, Aug 16 @ 9am EDT
    });

    it('should calculate the next occurrence for the following week if the day has passed', () => {
      // Schedule for Wednesday (3). Today is Thursday (4).
      const schedule = { ...baseSchedule, frequency: 'weekly', frequency_interval: 1, frequency_details: '3' };
      const nextDueDate = calculateNextDueDate(schedule, null, now);
      expect(nextDueDate.toISOString()).toBe('2024-08-21T13:00:00.000Z'); // Wednesday, Aug 21 @ 9am EDT
    });

    it('should handle multiple weekdays, picking the next available one', () => {
       // Schedule for Mon (1), Wed (3), Fri (5). Today is Thursday (4).
      const schedule = { ...baseSchedule, frequency: 'weekly', frequency_interval: 1, frequency_details: '1,3,5' };
      const nextDueDate = calculateNextDueDate(schedule, null, now);
      expect(nextDueDate.toISOString()).toBe('2024-08-16T13:00:00.000Z'); // Friday, Aug 16 @ 9am EDT
    });

    it('should handle weekly interval of 2, skipping a week', () => {
      const schedule = { ...baseSchedule, frequency: 'weekly', frequency_interval: 2, frequency_details: '5' };
      const lastDueDate = new Date('2024-08-09T13:00:00Z'); // Friday Aug 9 @ 9am EDT
      const nextDueDate = calculateNextDueDate(schedule, lastDueDate, now);
      expect(nextDueDate.toISOString()).toBe('2024-08-23T13:00:00.000Z');
    });
  });

  describe('Monthly Frequency', () => {
    it('should calculate the next occurrence for a specific day of the next month', () => {
      const schedule = { ...baseSchedule, frequency: 'monthly', frequency_interval: 1, frequency_details: '10' };
      const nextDueDate = calculateNextDueDate(schedule, null, now);
      expect(nextDueDate.toISOString()).toBe('2024-09-10T13:00:00.000Z');
    });

    it('should calculate for the current month if the day has not passed', () => {
      const schedule = { ...baseSchedule, frequency: 'monthly', frequency_interval: 1, frequency_details: '20' };
      const nextDueDate = calculateNextDueDate(schedule, null, now);
      expect(nextDueDate.toISOString()).toBe('2024-08-20T13:00:00.000Z');
    });

    it('should handle "last" day of the month', () => {
      const schedule = { ...baseSchedule, frequency: 'monthly', frequency_interval: 1, frequency_details: 'last' };
      const nextDueDate = calculateNextDueDate(schedule, null, now);
      expect(nextDueDate.toISOString()).toBe('2024-08-31T13:00:00.000Z');
    });

    it('should handle "last" day for a month with 30 days', () => {
      const schedule = { ...baseSchedule, frequency: 'monthly', frequency_interval: 1, frequency_details: 'last' };
      const lastDueDate = new Date('2024-08-31T13:00:00Z');
      const nextDueDate = calculateNextDueDate(schedule, lastDueDate, now);
      expect(nextDueDate.toISOString()).toBe('2024-09-30T13:00:00.000Z');
    });

    it('should handle monthly interval of 2', () => {
        const schedule = { ...baseSchedule, frequency: 'monthly', frequency_interval: 2, frequency_details: '15' };
        const lastDueDate = new Date('2024-08-15T13:00:00Z');
        const nextDueDate = calculateNextDueDate(schedule, lastDueDate, now);
        expect(nextDueDate.toISOString()).toBe('2024-10-15T13:00:00.000Z');
    });
  });

  describe('Yearly Frequency', () => {
    it('should calculate the next occurrence for the next year', () => {
      // Jan 15 is in EST (UTC-5), so 9am EST is 14:00 UTC.
      const schedule = { ...baseSchedule, frequency: 'yearly', frequency_interval: 1, frequency_details: '1-15' };
      const nextDueDate = calculateNextDueDate(schedule, null, now);
      expect(nextDueDate.toISOString()).toBe('2025-01-15T14:00:00.000Z');
    });

    it('should calculate for the current year if the date has not passed', () => {
      // Dec 25 is in EST (UTC-5), so 9am EST is 14:00 UTC.
      const schedule = { ...baseSchedule, frequency: 'yearly', frequency_interval: 1, frequency_details: '12-25' };
      const nextDueDate = calculateNextDueDate(schedule, null, now);
      expect(nextDueDate.toISOString()).toBe('2024-12-25T14:00:00.000Z');
    });
  });

  describe('Time Handling', () => {
    it('should correctly handle 12 PM', () => {
        // 12pm EDT is 16:00 UTC.
        const schedule = { ...baseSchedule, trigger_hour: '12', trigger_ampm: 'pm' };
        const nextDueDate = calculateNextDueDate({ ...schedule, frequency: 'daily' }, null, now);
        expect(nextDueDate.toISOString()).toBe('2024-08-15T16:00:00.000Z');
    });

    it('should correctly handle 12 AM', () => {
        // 12am EDT is 04:00 UTC.
        const schedule = { ...baseSchedule, trigger_hour: '12', trigger_ampm: 'am' };
        const lastDueDate = new Date('2024-08-14T04:00:00Z'); // Aug 14 @ 12am EDT
        const nextDueDate = calculateNextDueDate({ ...schedule, frequency: 'daily' }, lastDueDate, now);
        // last due was 14th 12am EDT. next is 15th 12am EDT. now is 15th 10am EDT.
        // Since 12am is before 10am, the next due date is the 16th at 12am EDT.
        expect(nextDueDate.toISOString()).toBe('2024-08-16T04:00:00.000Z');
    });
  });
});
