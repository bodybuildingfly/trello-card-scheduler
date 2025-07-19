import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

// --- Imports for Modular Structure ---
import pool from './db.js';
import schedulesRoutes from './routes/schedulesRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import trelloRoutes from './routes/trelloRoutes.js';
import appStatusRoutes from './routes/appStatusRoutes.js';
import authRoutes from './routes/authRoutes.js';
import usersRoutes from './routes/usersRoutes.js';
import { reinitializeCronJob, getSchedulerInstance } from './services/schedulerService.js';

// --- Express App Setup ---
const app = express();
const port = 5000;

// Helper to get __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Middleware ---
const devOrigin = 'http://localhost:3000';
const prodOrigin = undefined;
const corsOptions = {
    origin: process.env.NODE_ENV === 'production' ? prodOrigin : devOrigin,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

// --- Global Application State ---
let appSettings = {};

/**
 * @description Writes an audit event to the console and the database.
 * @param {'INFO' | 'ERROR' | 'CRITICAL'} level - The severity level of the event.
 * @param {string} message - A description of the event.
 * @param {object} [details={}] - A JSON object containing relevant details.
 * @param {object} [user=null] - The user object from the request (req.user).
 */
const logAuditEvent = async (level, message, details = {}, user = null) => {
    const userId = user ? user.id : null;
    const username = user ? user.username : null;

    console.log(`[${level}] ${message}`, JSON.stringify({ ...details, user: username }));
    try {
        await pool.query(
            'INSERT INTO audit_logs(level, message, details, user_id, username) VALUES($1, $2, $3, $4, $5)',
            [level, message, details, userId, username]
        );
    } catch (err) {
        console.error(`[ERROR] Failed to write to audit log table: ${err.message}`);
    }
};

/**
 * @description Loads all settings from the database into the global appSettings object.
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
 * @description Initializes the database schema by running the schema.sql file.
 * Seeding logic has been removed.
 */
const initializeDatabaseSchema = async () => {
    const client = await pool.connect();
    try {
        console.log('[INFO] Checking database schema...');
        const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql')).toString();
        await client.query(schemaSql);
        console.log('[INFO] Database schema check complete.');
    } catch (err) {
        console.error('[CRITICAL] Failed to initialize database.', err);
        process.exit(1);
    } finally {
        if (client) client.release();
    }
};

/**
 * @description Checks for an admin user on startup and creates one if it doesn't exist.
 */
const createInitialAdmin = async () => {
    const client = await pool.connect();
    try {
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

    } catch (err) {
        console.error('[CRITICAL] Failed to create initial admin user.', err);
        process.exit(1);
    } finally {
        client.release();
    }
};

// --- API Routes Setup ---
const attachAppConfig = (req, res, next) => {
    req.appSettings = appSettings;
    req.loadSettings = loadSettings;
    req.reinitializeCronJob = () => reinitializeCronJob(appSettings, logAuditEvent);
    req.logAuditEvent = (level, message, details) => logAuditEvent(level, message, details, req.user);
    req.cronJob = getSchedulerInstance();
    next();
};

app.use('/api', attachAppConfig);

app.use('/api/schedules', schedulesRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/trello', trelloRoutes);
app.use('/api', appStatusRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);


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
 */
const startServer = async () => {
    try {
        await initializeDatabaseSchema();
        await createInitialAdmin();
        await loadSettings();
        reinitializeCronJob(appSettings, logAuditEvent);
        app.listen(port, () => console.log(`Server is running on http://localhost:${port}`));
    } catch (err) {
        console.error("Failed to start the server.", err);
        process.exit(1);
    }
};

// Start the application
startServer();