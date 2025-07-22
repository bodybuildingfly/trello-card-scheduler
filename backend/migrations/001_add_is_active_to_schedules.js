// Each migration file should export an 'up' function.
// This function receives a database client and should perform the migration.
export const up = async (client) => {
    console.log('[MIGRATION] Running 001_add_is_active_to_schedules...');
    
    // Check if the 'is_active' column already exists in the 'schedules' table.
    const columnCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='schedules' AND column_name='is_active'
    `);

    // If the column does not exist, add it with a default value of TRUE.
    if (columnCheck.rows.length === 0) {
        console.log('[MIGRATION] "is_active" column not found. Adding it to the "schedules" table.');
        await client.query('ALTER TABLE schedules ADD COLUMN is_active BOOLEAN DEFAULT TRUE;');
    } else {
        console.log('[MIGRATION] "is_active" column already exists.');
    }
    
    // Ensure any existing schedules that might have a NULL value for is_active are updated.
    // This makes sure all old records are correctly set to 'active'.
    await client.query("UPDATE schedules SET is_active = TRUE WHERE is_active IS NULL;");

    console.log('[MIGRATION] 001_add_is_active_to_schedules completed successfully.');
};