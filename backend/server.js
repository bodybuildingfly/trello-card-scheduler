import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// --- Imports for Modular Structure ---
import pool from './db.js';
import recordsRoutes from './routes/recordsRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import trelloRoutes from './routes/trelloRoutes.js';
import appStatusRoutes from './routes/appStatusRoutes.js';
import { reinitializeCronJob, getSchedulerInstance } from './services/schedulerService.js';

// --- Express App Setup ---
const app = express();
const port = 5000;

// Helper to get __dirname in ES Modules, which is not available by default.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Middleware ---
const devOrigin = 'http://localhost:3000';
const prodOrigin = undefined; // In production, requests are same-origin.
const corsOptions = {
    origin: process.env.NODE_ENV === 'production' ? prodOrigin : devOrigin,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

// --- Global Application State ---
// This object holds the settings loaded from the database.
let appSettings = {};

/**
 * @description Writes an audit event to the console and the database.
 * @param {'INFO' | 'ERROR' | 'CRITICAL'} level - The severity level of the event.
 * @param {string} message - A description of the event.
 * @param {object} [details={}] - A JSON object containing relevant details.
 */
const logAuditEvent = async (level, message, details = {}) => {
    console.log(`[${level}] ${message}`, JSON.stringify(details));
    try {
        await pool.query('INSERT INTO audit_logs(level, message, details) VALUES($1, $2, $3)', [level, message, details]);
    } catch (err) {
        console.error(`[ERROR] Failed to write to audit log table: ${err.message}`);
    }
};

/**
 * @description Loads all settings from the database into the global appSettings object.
 * It also seeds default settings if they don't exist.
 */
const loadSettings = async () => {
    console.log('[INFO] Loading settings from database...');
    const client = await pool.connect();
    try {
        const { rows } = await client.query('SELECT key, value FROM settings');
        const settingsFromDB = rows.reduce((acc, row) => {
            acc[row.key] = row.value;
            return acc;
        }, {});

        const defaultSettings = {
            TRELLO_API_KEY: process.env.TRELLO_API_KEY || '',
            TRELLO_API_TOKEN: process.env.TRELLO_API_TOKEN || '',
            TRELLO_BOARD_ID: process.env.TRELLO_BOARD_ID || '',
            TRELLO_TO_DO_LIST_ID: process.env.TRELLO_TO_DO_LIST_ID || '',
            TRELLO_DONE_LIST_ID: process.env.TRELLO_DONE_LIST_ID || '',
            TRELLO_LABEL_ID: process.env.TRELLO_LABEL_ID || '',
            CRON_SCHEDULE: process.env.CRON_SCHEDULE || '0 1 * * *',
        };

        for (const key in defaultSettings) {
            if (!settingsFromDB.hasOwnProperty(key)) {
                console.log(`[INFO] Setting '${key}' not found in DB, inserting default.`);
                await client.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING', [key, defaultSettings[key]]);
                settingsFromDB[key] = defaultSettings[key];
            }
        }
        appSettings = settingsFromDB;
        console.log('[INFO] Settings loaded successfully.');
    } catch (err) {
        console.error('[CRITICAL] Failed to load settings.', err);
        process.exit(1);
    } finally {
        client.release();
    }
};

/**
 * @description Initializes the database schema and seeds initial data if the records table is empty.
 */
const initializeDatabaseSchema = async () => {
    const client = await pool.connect();
    try {
        console.log('[INFO] Checking database schema...');
        const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql')).toString();
        await client.query(schemaSql);
        console.log('[INFO] Database schema check complete.');

        const { rows } = await client.query('SELECT COUNT(*) FROM records');
        if (parseInt(rows[0].count, 10) === 0) {
            console.log('[INFO] Records table is empty. Seeding initial data...');
            const seedSql = fs.readFileSync(path.join(__dirname, 'seed.sql')).toString();
            await client.query(seedSql);
            console.log('[INFO] Successfully seeded database with initial demo data.');
        } else {
            console.log('[INFO] Database already contains data. Skipping seed.');
        }
    } catch (err) {
        console.error('[CRITICAL] Failed to initialize database.', err);
        process.exit(1);
    } finally {
        if (client) client.release();
    }
};

// --- API Routes Setup ---

/**
 * @description Middleware to attach server-level config and functions to each request object.
 * This allows controllers to access them without circular dependencies.
 */
const attachAppConfig = (req, res, next) => {
    req.appSettings = appSettings;
    req.loadSettings = loadSettings;
    // We pass the reinitialize function from the service, not the one from this file.
    req.reinitializeCronJob = () => reinitializeCronJob(appSettings, logAuditEvent);
    req.logAuditEvent = logAuditEvent;
    req.cronJob = getSchedulerInstance();
    next();
};

// Apply the middleware to all API routes
app.use('/api', attachAppConfig);

// Register all the modular routers
app.use('/api/records', recordsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/trello', trelloRoutes);
app.use('/api', appStatusRoutes);

// --- Serve Frontend Static Files (Production Only) ---
if (process.env.NODE_ENV === 'production') {
    const buildPath = path.join(__dirname, '../build');
    app.use(express.static(buildPath));
    app.get('*', (req, res) => {
        res.sendFile(path.resolve(buildPath, 'index.html'));
    });
}

/**
 * @description The main application start function.
 * It initializes the database, loads settings, starts the scheduler, and listens for requests.
 */
const startServer = async () => {
    try {
        await initializeDatabaseSchema();
        await loadSettings();
        // Start the scheduler using the imported function from our service
        reinitializeCronJob(appSettings, logAuditEvent);
        app.listen(port, () => console.log(`Server is running on http://localhost:${port}`));
    } catch (err) {
        console.error("Failed to start the server.", err);
        process.exit(1);
    }
};

// Start the application
startServer();