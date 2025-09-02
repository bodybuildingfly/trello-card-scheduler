// Each migration file should export an 'up' function.
// This function receives a database client and should perform the migration.
export const up = async (client) => {
    console.log('[MIGRATION] Running 009_add_start_time_to_schedules...');

    // Add start_hour column
    const hourCheck = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name='schedules' AND column_name='start_hour'
    `);
    if (hourCheck.rows.length === 0) {
        console.log('[MIGRATION] "start_hour" column not found. Adding it to the "schedules" table.');
        await client.query("ALTER TABLE schedules ADD COLUMN start_hour VARCHAR(2)");
    } else {
        console.log('[MIGRATION] "start_hour" column already exists.');
    }

    // Add start_minute column
    const minuteCheck = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name='schedules' AND column_name='start_minute'
    `);
    if (minuteCheck.rows.length === 0) {
        console.log('[MIGRATION] "start_minute" column not found. Adding it to the "schedules" table.');
        await client.query("ALTER TABLE schedules ADD COLUMN start_minute VARCHAR(2)");
    } else {
        console.log('[MIGRATION] "start_minute" column already exists.');
    }

    // Add start_ampm column
    const ampmCheck = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name='schedules' AND column_name='start_ampm'
    `);
    if (ampmCheck.rows.length === 0) {
        console.log('[MIGRATION] "start_ampm" column not found. Adding it to the "schedules" table.');
        await client.query("ALTER TABLE schedules ADD COLUMN start_ampm VARCHAR(2)");
    } else {
        console.log('[MIGRATION] "start_ampm" column already exists.');
    }

    console.log('[MIGRATION] 009_add_start_time_to_schedules completed successfully.');
};
