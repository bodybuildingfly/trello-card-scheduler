import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * @description The main function to run all pending database migrations.
 * @param {import('pg').PoolClient} client - The database client to use for the queries.
 */
export const runMigrations = async (client) => {
    console.log('[MIGRATIONS] Checking for pending database migrations...');

    // Ensure the migrations tracking table exists.
    await client.query(`
        CREATE TABLE IF NOT EXISTS db_migrations (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) UNIQUE NOT NULL,
            executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Get the list of migrations that have already been run.
    const { rows: executedRows } = await client.query('SELECT name FROM db_migrations');
    const executedMigrations = new Set(executedRows.map(row => row.name));

    // Read all migration files from the migrations directory.
    const migrationsDir = path.join(__dirname, 'migrations');
    const migrationFiles = (await fs.readdir(migrationsDir))
        .filter(file => file.endsWith('.js'))
        .sort(); // Sort alphabetically to ensure order.

    let migrationsRun = 0;

    // Loop through each file and run it if it hasn't been executed yet.
    for (const file of migrationFiles) {
        if (!executedMigrations.has(file)) {
            console.log(`[MIGRATIONS] Running new migration: ${file}`);
            try {
                // Dynamically import the migration module.
                const migration = await import(path.join(migrationsDir, file));
                
                // Start a transaction.
                await client.query('BEGIN');
                
                // Execute the migration's 'up' function.
                await migration.up(client);
                
                // Record the migration in the database.
                await client.query('INSERT INTO db_migrations (name) VALUES ($1)', [file]);
                
                // Commit the transaction.
                await client.query('COMMIT');
                
                console.log(`[MIGRATIONS] Successfully ran and recorded migration: ${file}`);
                migrationsRun++;
            } catch (err) {
                // If any error occurs, roll back the transaction.
                await client.query('ROLLBACK');
                console.error(`[CRITICAL] Failed to run migration ${file}. Rolling back.`, err);
                // Re-throw the error to stop the application startup process.
                throw err;
            }
        }
    }

    if (migrationsRun === 0) {
        console.log('[MIGRATIONS] Database is up to date. No new migrations to run.');
    } else {
        console.log(`[MIGRATIONS] Finished running ${migrationsRun} new migration(s).`);
    }
};