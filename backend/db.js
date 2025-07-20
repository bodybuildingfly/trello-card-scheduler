import pg from 'pg';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';

const { Pool } = pg;

// Helper to get __dirname in ES Modules, which is not available by default.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * @description The centralized PostgreSQL connection pool for the application.
 */
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    connectionTimeoutMillis: 5000,
});

/**
 * @description Initializes the database schema by running the schema.sql file.
 * @param {pg.PoolClient} client - The database client to use for the query.
 */
const initializeDatabaseSchema = async (client) => {
    console.log('[INFO] Checking database schema...');
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql')).toString();
    await client.query(schemaSql);
    console.log('[INFO] Database schema check complete.');
};

/**
 * @description Checks for an admin user on startup and creates one if it doesn't exist.
 * @param {pg.PoolClient} client - The database client to use for the query.
 */
const createInitialAdmin = async (client) => {
    const { rows } = await client.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    if (rows.length > 0) {
        console.log('[INFO] Admin user already exists.');
        return;
    }

    console.log('[INFO] No admin user found. Creating initial admin account...');

    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'changeme';

    if (!process.env.ADMIN_PASSWORD) {
        console.warn('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        console.warn('!!! WARNING: Using default admin password.                 !!!');
        console.warn('!!! Please set the ADMIN_PASSWORD environment variable.    !!!');
        console.warn(`!!! Default credentials: ${adminUser} / ${adminPass}                !!!`);
        console.warn('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(adminPass, salt);

    await client.query(
        'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)',
        [adminUser, passwordHash, 'admin']
    );

    console.log(`[INFO] Admin user '${adminUser}' created successfully.`);
};

/**
 * @description A single function to run all database initialization tasks.
 * This should be called once on application startup.
 */
export const initializeDatabase = async () => {
    const client = await pool.connect();
    try {
        await initializeDatabaseSchema(client);
        await createInitialAdmin(client);
    } catch (err) {
        console.error('[CRITICAL] Failed to initialize database.', err);
        throw err; // Re-throw to be caught by the main server start function
    } finally {
        client.release();
    }
};

export default pool;