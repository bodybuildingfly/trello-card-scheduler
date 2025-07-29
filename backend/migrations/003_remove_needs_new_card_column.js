/**
 * @file 003_remove_needs_new_card_column.js
 * @description This migration removes the 'needs_new_card' column from the
 * schedules table. This logic is now handled by checking the 'active_card_id'
 * directly, which simplifies the scheduler's state management.
 */

export const up = async (client) => {
    console.log('[MIGRATION] Running 004_remove_needs_new_card_column...');
    
    // Check if the 'needs_new_card' column exists before trying to drop it.
    const columnCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='schedules' AND column_name='needs_new_card'
    `);

    // If the column exists, drop it.
    if (columnCheck.rows.length > 0) {
        console.log('[MIGRATION] "needs_new_card" column found. Dropping it from the "schedules" table.');
        await client.query('ALTER TABLE schedules DROP COLUMN needs_new_card;');
    } else {
        console.log('[MIGRATION] "needs_new_card" column already removed.');
    }

    console.log('[MIGRATION] 004_remove_needs_new_card_column completed successfully.');
};
