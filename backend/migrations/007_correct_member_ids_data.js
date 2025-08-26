/**
 * @file 007_correct_member_ids_data.js
 * @description This data migration script corrects the `trello_member_ids` in the `schedules` table.
 * It replaces the full names (mistakenly stored by a previous migration) with the correct Trello member IDs.
 * This script is designed to be run once to clean up the existing data.
 */
import { loadSettings } from '../services/settingsService.js';
import { getTrelloBoardMembers } from '../services/trelloService.js';

export const up = async (client) => {
    console.log('[MIGRATION] Running 007_correct_member_ids_data...');

    try {
        // Load application settings to get Trello API credentials
        const appSettings = await loadSettings(client);
        const { TRELLO_API_KEY, TRELLO_API_TOKEN, TRELLO_BOARD_ID } = appSettings;

        if (!TRELLO_API_KEY || !TRELLO_API_TOKEN || !TRELLO_BOARD_ID) {
            console.error('[MIGRATION] Trello API credentials or Board ID are not configured. Skipping data correction.');
            return;
        }

        // Get all members from the Trello board to create a name-to-ID map
        const trelloMembers = await getTrelloBoardMembers(TRELLO_API_KEY, TRELLO_API_TOKEN, TRELLO_BOARD_ID);
        const memberNameMap = new Map(trelloMembers.map(member => [member.fullName, member.id]));

        // Fetch all schedules from the database
        const { rows: schedules } = await client.query('SELECT id, trello_member_ids FROM schedules');

        let updatedCount = 0;

        // Iterate over each schedule and correct its member IDs
        for (const schedule of schedules) {
            // Skip if there are no members or if the members are already in ID format (heuristic check)
            if (!schedule.trello_member_ids || schedule.trello_member_ids.length === 0 || schedule.trello_member_ids[0].length === 24) {
                continue;
            }

            const correctedMemberIds = [];
            let needsUpdate = false;
            for (const memberName of schedule.trello_member_ids) {
                if (memberNameMap.has(memberName)) {
                    correctedMemberIds.push(memberNameMap.get(memberName));
                    needsUpdate = true;
                } else {
                    // If the name is not found, we keep it as is for now, but it could be logged.
                    console.warn(`[MIGRATION] Could not find Trello ID for member: "${memberName}" in schedule ${schedule.id}`);
                    correctedMemberIds.push(memberName); 
                }
            }

            if (needsUpdate) {
                await client.query(
                    'UPDATE schedules SET trello_member_ids = $1 WHERE id = $2',
                    [correctedMemberIds, schedule.id]
                );
                updatedCount++;
            }
        }

        console.log(`[MIGRATION] Successfully checked all schedules. Corrected ${updatedCount} records.`);

    } catch (error) {
        console.error('[CRITICAL] Failed to run 007_correct_member_ids_data migration.', error);
        // We do not re-throw the error here because a failure in this data migration
        // should not necessarily stop the application from starting. It can be run again later.
    }
};
