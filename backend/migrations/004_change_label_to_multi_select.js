/**
 * @file 004_change_label_to_multi_select.js
 * @description This migration updates the 'schedules' table to support multiple Trello labels.
 * It renames the 'trello_label_id' column to 'trello_label_ids' and changes its
 * data type from a single VARCHAR to an array of VARCHARs (TEXT[]).
 * Any existing single label ID is migrated into an array.
 */

export const up = async (client) => {
    console.log('[MIGRATION] Running 004_change_label_to_multi_select...');

    await client.query('BEGIN');

    try {
        // Step 1: Add the new array-based column
        await client.query(`
            ALTER TABLE schedules
            ADD COLUMN trello_label_ids TEXT[] DEFAULT ARRAY[]::TEXT[];
        `);

        // Step 2: Migrate data from the old column to the new one
        await client.query(`
            UPDATE schedules
            SET trello_label_ids = ARRAY[trello_label_id]
            WHERE trello_label_id IS NOT NULL AND trello_label_id <> '';
        `);

        // Step 3: Drop the old column
        await client.query('ALTER TABLE schedules DROP COLUMN trello_label_id;');

        await client.query('COMMIT');
        console.log('[MIGRATION] Successfully migrated to multiple Trello labels.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[CRITICAL] Failed to run 004_change_label_to_multi_select migration. Rolling back.', error);
        throw error;
    }
};
