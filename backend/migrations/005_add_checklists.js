/**
 * @file 005_add_checklists.js
 * @description This migration updates the 'schedules' table to support associating a checklist.
 * It also ensures that the checklist_items table exists and creates it if not present
 */

export const up = async (client) => {
    console.log('[MIGRATION] Running 005_add_checklists...');

    // Add checklist_name column to schedules table
    await client.query(`
        ALTER TABLE schedules
        ADD COLUMN IF NOT EXISTS checklist_name VARCHAR(255);
    `);

    // Create checklist_items table
    await client.query(`
        CREATE TABLE IF NOT EXISTS checklist_items (
            id SERIAL PRIMARY KEY,
            schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
            item_name VARCHAR(255) NOT NULL
        );
    `);

    console.log('[MIGRATION] 005_add_checklists completed successfully.');
};