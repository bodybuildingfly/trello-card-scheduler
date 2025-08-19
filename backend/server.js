import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// --- Imports for Modular Structure ---
import { initializeDatabase } from './db.js';
import { loadSettings } from './services/settingsService.js';
import { reinitializeCronJob, getSchedulerInstance } from './services/schedulerService.js';
import logAuditEvent from './utils/logger.js';
import schedulesRoutes from './routes/schedulesRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import trelloRoutes from './routes/trelloRoutes.js';
import appStatusRoutes from './routes/appStatusRoutes.js';
import authRoutes from './routes/authRoutes.js';
import usersRoutes from './routes/usersRoutes.js';
import statsRoutes from './routes/statsRoutes.js';
import releasesRoutes from './routes/releasesRoutes.js';

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
// This object will be populated on startup by the settingsService.
let appSettings = {};

// --- API Routes Setup ---
/**
 * @description Middleware to attach server-level config and functions to each request object.
 */
const attachAppConfig = (req, res, next) => {
    req.appSettings = appSettings;
    // Pass a function that can reload settings and re-init the cron job
    req.loadSettings = async () => {
        appSettings = await loadSettings();
        reinitializeCronJob(appSettings);
    };
    req.reinitializeCronJob = () => reinitializeCronJob(appSettings);
    req.cronJob = getSchedulerInstance();
    next();
};

app.use('/api', attachAppConfig);

// Register all the modular routers
app.use('/api/schedules', schedulesRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/trello', trelloRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api', appStatusRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/releases', releasesRoutes);

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
        await initializeDatabase();
        appSettings = await loadSettings();
        reinitializeCronJob(appSettings);
        app.listen(port, () => console.log(`Server is running on http://localhost:${port}`));
    } catch (err) {
        console.error("Failed to start the server.", err);
        // Use the logger for critical startup failures
        await logAuditEvent('CRITICAL', 'Server failed to start.', { error: err.message });
        process.exit(1);
    }
};

// Start the application
startServer();