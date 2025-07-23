/**
 * @file 002_remove_once_frequency.js
 * @description This migration script updates existing schedules with a 'once' frequency.
 * Instead of deleting them, it changes their frequency to 'daily' and sets them
 * to inactive. This preserves the user's data while removing the deprecated
 * frequency option from use.
 */

// Each migration file should export an 'up' function.
// This function receives a database client and should perform the migration.
export const up = async (client) => {
    console.log('[MIGRATION] Running 002_remove_once_frequency...');
    
    // Update any schedules that have a frequency of 'once' to be 'daily' and inactive.
    const result = await client.query(
        "UPDATE schedules SET frequency = 'daily', is_active = false WHERE frequency = 'once'"
    );

    if (result.rowCount > 0) {
        console.log(`[MIGRATION] Updated ${result.rowCount} schedule(s) from 'once' to 'daily' and set to inactive.`);
    } else {
        console.log("[MIGRATION] No schedules with 'once' frequency found to update.");
    }

    console.log('[MIGRATION] 002_remove_once_frequency completed successfully.');
};