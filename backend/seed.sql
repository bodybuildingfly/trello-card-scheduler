-- This script seeds the database with initial data only if the tables are empty.
-- It includes a variety of schedule types for testing.

INSERT INTO records 
    (title, owner_name, description, frequency, frequency_interval, frequency_details, trigger_hour, trigger_minute, trigger_ampm, start_date, end_date) 
VALUES
    ('[DEMO] Daily Standup Report', 'Jacob Mabb', 'Generate and post the daily standup summary.', 'daily', 1, NULL, 9, 0, 'am', '2025-07-01', NULL),
    ('[DEMO] Team Sync (Mon/Wed/Fri)', 'Jennie Mabb', 'Schedule the recurring team sync meeting.', 'weekly', 1, '1,3,5', 11, 30, 'am', '2025-07-01', '2025-12-31'),
    ('[DEMO] Process Monthly Invoices', 'Jacob Mabb', 'Review and pay all outstanding invoices for the month.', 'monthly', 1, '15', 14, 0, 'pm', '2025-01-01', NULL),
    ('[DEMO] Annual Performance Review Prep', 'Jennie Mabb', 'Prepare materials for annual performance reviews.', 'yearly', 1, '11-1', 10, 0, 'am', NULL, NULL),
    ('[DEMO] Expired Weekly Task', 'Jacob Mabb', 'This task should no longer generate cards.', 'weekly', 1, '2', 15, 0, 'pm', '2024-01-01', '2024-06-30');