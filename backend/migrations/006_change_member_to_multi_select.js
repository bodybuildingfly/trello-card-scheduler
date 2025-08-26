/**
 * @file 006_change_member_to_multi_select.js
 * @description This migration updates the 'schedules' table to support multiple Trello members.
 * It renames the 'owner_name' column to 'trello_member_ids' and changes its
 * data type from a single VARCHAR to an array of VARCHARs (TEXT[]).
 * Any existing single member ID is migrated into an array.
 * It assumes that the owner_name is the Trello member ID.
 */

export const up = async (client) => {
    console.log('[MIGRATION] Running 006_change_member_to_multi_select...');

    await client.query('BEGIN');

    try {
        // Step 1: Add the new array-based column
        await client.query(`
            ALTER TABLE schedules
            ADD COLUMN trello_member_ids TEXT[] DEFAULT ARRAY[]::TEXT[];
        `);

        // Step 2: Migrate data from the old column to the new one
        // This assumes owner_name is a Trello member ID.
        await client.query(`
            UPDATE schedules
            SET trello_member_ids = ARRAY[owner_name]
            WHERE owner_name IS NOT NULL AND owner_name <> '';
        `);

        // Step 3: Drop the old column
        await client.query('ALTER TABLE schedules DROP COLUMN owner_name;');

        await client.query('COMMIT');
        console.log('[MIGRATION] Successfully migrated to multiple Trello members.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[CRITICAL] Failed to run 006_change_member_to_multi_select migration. Rolling back.', error);
        throw error;
    }
};
